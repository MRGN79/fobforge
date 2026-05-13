// FobForge — db.js
// SQLite read/write via sql.js (WebAssembly).
// Receives raw SQLite bytes from prj.js.
// Exposes clean read/write functions to app.js.
// Never touches the DOM — no ui.js calls here.

let _db = null;
let _SQL = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

// Must be called once after sql.js is loaded.
// sqljs: the SQL object from initSqlJs()

export function initDb(sqljs) {
  _SQL = sqljs;
}

// Create a new empty database with the required schema.
// Returns nothing — call getContacts(), getBadges(), getAssignments() after.

export function createEmptyDb() {
  if (!_SQL) throw new Error('SQL engine not initialized');
  if (_db) { _db.close(); _db = null; }

  _db = new _SQL.Database();
  _db.run(`
    CREATE TABLE MEMBER (
      ID_MEMBER TEXT PRIMARY KEY NOT NULL,
      Name      TEXT NOT NULL DEFAULT '',
      Surname   TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE APT (
      ID_APT   TEXT PRIMARY KEY NOT NULL,
      Apt      TEXT    DEFAULT '',
      SCS_addr INTEGER DEFAULT 0,
      Block    TEXT    DEFAULT '',
      Floor    TEXT    DEFAULT ''
    );
    CREATE TABLE MEMBER_APT (
      ID_MEMBER TEXT NOT NULL,
      ID_APT    TEXT NOT NULL
    );
    CREATE TABLE BADGE (
      ID_BADGE   TEXT    PRIMARY KEY NOT NULL,
      BADGE_TYPE INTEGER NOT NULL DEFAULT 0,
      Note       TEXT    DEFAULT ''
    );
    CREATE TABLE MEMBER_BADGE (
      ID_MEMBER TEXT NOT NULL,
      ID_BADGE  TEXT NOT NULL,
      PRIMARY KEY (ID_MEMBER, ID_BADGE)
    );
  `);
}

// Load raw SQLite bytes into memory.
// Returns nothing — call getContacts(), getBadges(), getAssignments() after.

export function loadDb(bytes) {
  if (_db) {
    _db.close();
    _db = null;
  }
  _db = new _SQL.Database(bytes);
}

// Export current database state as Uint8Array for prj.js.

export function exportDb() {
  if (!_db) throw new Error('No database loaded');
  return _db.export();
}

// Close and release the database.

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// Exposed for automated tests only — do not use in application code.
export function _getDb() { return _db; }

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

// Returns array of contact objects:
// {
//   id:      string (GUID),
//   name:    string,
//   surname: string,
//   apts:    [{ apt, scsAddr, block, floor }, ...]  — all apartments for this member
// }

export function getContacts() {
  if (!_db) return [];

  const memberResult = _db.exec(`
    SELECT ID_MEMBER AS id, Name AS name, Surname AS surname
    FROM MEMBER
    ORDER BY Surname, Name
  `);
  if (!memberResult.length) return [];

  const { columns: mc, values: mv } = memberResult[0];
  const contacts = mv.map(row => {
    const obj = { apts: [] };
    mc.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });

  const aptResult = _db.exec(`
    SELECT ma.ID_MEMBER AS memberId,
           a.ID_APT     AS id,
           a.Apt        AS apt,
           a.SCS_addr   AS scsAddr,
           a.Block      AS block,
           a.Floor      AS floor
    FROM MEMBER_APT ma
    JOIN APT a ON a.ID_APT = ma.ID_APT
  `);

  if (aptResult.length) {
    const { columns: ac, values: av } = aptResult[0];
    const aptMap = {};
    av.forEach(row => {
      const apt = {};
      ac.forEach((col, i) => { apt[col] = row[i]; });
      const { memberId, ...aptData } = apt;
      if (!aptMap[memberId]) aptMap[memberId] = [];
      aptMap[memberId].push(aptData);
    });
    contacts.forEach(c => { c.apts = aptMap[c.id] ?? []; });
  }

  return contacts;
}

// Returns array of badge objects:
// {
//   id:   string (8-char hex UID),
//   type: number (0=Resident, 1=Passepartout, 2=Master Apt.),
//   note: string,
// }

export function getBadges() {
  if (!_db) return [];

  const result = _db.exec(`
    SELECT ID_BADGE AS id, BADGE_TYPE AS type, Note AS note
    FROM BADGE
  `);
  if (!result.length) return [];

  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Returns array of assignment objects:
// {
//   memberId: string (GUID),
//   badgeId:  string (8-char hex UID),
// }

export function getAssignments() {
  if (!_db) return [];

  const result = _db.exec(`
    SELECT ID_MEMBER AS memberId, ID_BADGE AS badgeId
    FROM MEMBER_BADGE
  `);
  if (!result.length) return [];

  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Write functions
// ---------------------------------------------------------------------------

// Add a new badge to the BADGE table.
// uid:  string (8-char hex, already validated and uppercased)
// type: number (0, 1 or 2)
// note: string (optional)

export function addBadge(uid, type = 0, note = '') {
  if (!_db) throw new Error('No database loaded');

  _db.run(
    'INSERT INTO BADGE (ID_BADGE, BADGE_TYPE, Note) VALUES (?, ?, ?)',
    [uid, type, note]
  );
}

// Assign a badge to a contact (MEMBER_BADGE table).
// memberId: string (GUID)
// badgeId:  string (8-char hex UID)

export function assignBadge(memberId, badgeId) {
  if (!_db) throw new Error('No database loaded');

  _db.run(
    'INSERT INTO MEMBER_BADGE (ID_MEMBER, ID_BADGE) VALUES (?, ?)',
    [memberId, badgeId]
  );
}

// Remove a badge assignment from a contact.
// Also removes the badge from BADGE table if no other assignments exist.

export function removeBadge(memberId, badgeId) {
  if (!_db) throw new Error('No database loaded');

  // Remove assignment
  _db.run(
    'DELETE FROM MEMBER_BADGE WHERE ID_MEMBER = ? AND ID_BADGE = ?',
    [memberId, badgeId]
  );

  // Check if badge is still assigned to anyone else
  const stmt = _db.prepare('SELECT COUNT(*) AS cnt FROM MEMBER_BADGE WHERE ID_BADGE = ?');
  let count = 0;
  try {
    stmt.bind([badgeId]);
    stmt.step();
    count = stmt.getAsObject()['cnt'] ?? 0;
  } finally {
    stmt.free();
  }

  if (count === 0) {
    _db.run('DELETE FROM BADGE WHERE ID_BADGE = ?', [badgeId]);
  }
}

// ---------------------------------------------------------------------------
// Contact CRUD
// ---------------------------------------------------------------------------

// Add a new contact (member).
// memberId: UUID string (generated by app)
// name, surname: strings

export function addContact(memberId, name, surname) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES (?, ?, ?)',
    [memberId, name, surname]
  );
}

// Update contact name and surname.

export function editContact(memberId, name, surname) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'UPDATE MEMBER SET Name = ?, Surname = ? WHERE ID_MEMBER = ?',
    [name, surname, memberId]
  );
}

// Delete a contact and cascade cleanup.
// Removes: MEMBER, MEMBER_APT, MEMBER_BADGE, and any orphaned BADGE/APT records.

export function deleteContact(memberId) {
  if (!_db) throw new Error('No database loaded');

  // Collect badge IDs before removing assignments (to clean up orphans after)
  const badgeStmt = _db.prepare('SELECT ID_BADGE FROM MEMBER_BADGE WHERE ID_MEMBER = ?');
  const badgeIds = [];
  try {
    badgeStmt.bind([memberId]);
    while (badgeStmt.step()) badgeIds.push(badgeStmt.get()[0]);
  } finally {
    badgeStmt.free();
  }

  // Collect apt IDs before removing assignments (to clean up orphans after)
  const aptStmt = _db.prepare('SELECT ID_APT FROM MEMBER_APT WHERE ID_MEMBER = ?');
  const aptIds = [];
  try {
    aptStmt.bind([memberId]);
    while (aptStmt.step()) aptIds.push(aptStmt.get()[0]);
  } finally {
    aptStmt.free();
  }

  _db.run('DELETE FROM MEMBER_APT WHERE ID_MEMBER = ?', [memberId]);
  _db.run('DELETE FROM MEMBER_BADGE WHERE ID_MEMBER = ?', [memberId]);
  _db.run('DELETE FROM MEMBER WHERE ID_MEMBER = ?', [memberId]);

  // Delete orphaned badges (no remaining assignments anywhere)
  for (const badgeId of badgeIds) {
    const countStmt = _db.prepare('SELECT COUNT(*) AS cnt FROM MEMBER_BADGE WHERE ID_BADGE = ?');
    let count = 0;
    try {
      countStmt.bind([badgeId]);
      countStmt.step();
      count = countStmt.getAsObject()['cnt'] ?? 0;
    } finally {
      countStmt.free();
    }
    if (count === 0) _db.run('DELETE FROM BADGE WHERE ID_BADGE = ?', [badgeId]);
  }

  // Delete orphaned apartments (no remaining member links anywhere)
  for (const aptId of aptIds) {
    const countStmt = _db.prepare('SELECT COUNT(*) AS cnt FROM MEMBER_APT WHERE ID_APT = ?');
    let count = 0;
    try {
      countStmt.bind([aptId]);
      countStmt.step();
      count = countStmt.getAsObject()['cnt'] ?? 0;
    } finally {
      countStmt.free();
    }
    if (count === 0) _db.run('DELETE FROM APT WHERE ID_APT = ?', [aptId]);
  }
}

// ---------------------------------------------------------------------------
// Apartment CRUD
// ---------------------------------------------------------------------------

// Add a new apartment.
// aptId: UUID string (generated by app)
// apt, scsAddr, block, floor: apartment details (all optional)

export function addApartment(aptId, apt, scsAddr, block, floor) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'INSERT INTO APT (ID_APT, Apt, SCS_addr, Block, Floor) VALUES (?, ?, ?, ?, ?)',
    [aptId, apt, scsAddr, block, floor]
  );
}

// Assign an apartment to a contact (create MEMBER_APT link).

export function assignApartment(memberId, aptId) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'INSERT INTO MEMBER_APT (ID_MEMBER, ID_APT) VALUES (?, ?)',
    [memberId, aptId]
  );
}

// Update apartment details.

export function editApartment(aptId, apt, scsAddr, block, floor) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'UPDATE APT SET Apt = ?, SCS_addr = ?, Block = ?, Floor = ? WHERE ID_APT = ?',
    [apt, scsAddr, block, floor, aptId]
  );
}

// Remove an apartment assignment from a contact.
// Also removes the apartment if no other members use it (cleanup).

export function removeApartment(memberId, aptId) {
  if (!_db) throw new Error('No database loaded');
  _db.run(
    'DELETE FROM MEMBER_APT WHERE ID_MEMBER = ? AND ID_APT = ?',
    [memberId, aptId]
  );

  // Check if apartment is still assigned to anyone else
  const stmt = _db.prepare('SELECT COUNT(*) AS cnt FROM MEMBER_APT WHERE ID_APT = ?');
  let count = 0;
  try {
    stmt.bind([aptId]);
    stmt.step();
    count = stmt.getAsObject()['cnt'] ?? 0;
  } finally {
    stmt.free();
  }

  if (count === 0) {
    _db.run('DELETE FROM APT WHERE ID_APT = ?', [aptId]);
  }
}