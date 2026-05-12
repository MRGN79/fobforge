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

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

// Returns array of contact objects:
// {
//   id:       string (GUID),
//   name:     string,
//   surname:  string,
//   apt:      string,
//   scsAddr:  number,
//   block:    string,
//   floor:    string,
// }

export function getContacts() {
  if (!_db) return [];

  const sql = `
    SELECT
      m.ID_MEMBER  AS id,
      m.Name       AS name,
      m.Surname    AS surname,
      a.Apt        AS apt,
      a.SCS_addr   AS scsAddr,
      a.Block      AS block,
      a.Floor      AS floor
    FROM MEMBER m
    LEFT JOIN MEMBER_APT ma ON ma.ID_MEMBER = m.ID_MEMBER
    LEFT JOIN APT a         ON a.ID_APT     = ma.ID_APT
    GROUP BY m.ID_MEMBER
    ORDER BY m.Surname, m.Name
  `;

  const result = _db.exec(sql);
  if (!result.length) return [];

  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
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
  stmt.bind([badgeId]);
  stmt.step();
  const count = stmt.getAsObject()['cnt'] ?? 0;
  stmt.free();

  if (count === 0) {
    _db.run('DELETE FROM BADGE WHERE ID_BADGE = ?', [badgeId]);
  }
}