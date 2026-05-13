import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import initSqlJs from 'sql.js';
import {
  initDb, createEmptyDb, loadDb, exportDb, closeDb, _getDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
  addContact, editContact, deleteContact,
  addApartment, assignApartment, editApartment, removeApartment,
} from '../js/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  const SQL = await initSqlJs({
    locateFile: f => path.join(__dirname, '../node_modules/sql.js/dist', f),
  });
  initDb(SQL);
});

beforeEach(() => {
  createEmptyDb();
});

afterEach(() => {
  closeDb();
});

// ---------------------------------------------------------------------------
// createEmptyDb
// ---------------------------------------------------------------------------

describe('createEmptyDb', () => {
  it('starts with no contacts', () => {
    expect(getContacts()).toEqual([]);
  });

  it('starts with no badges', () => {
    expect(getBadges()).toEqual([]);
  });

  it('starts with no assignments', () => {
    expect(getAssignments()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addBadge / getBadges
// ---------------------------------------------------------------------------

describe('addBadge', () => {
  it('inserts a badge retrievable by getBadges', () => {
    addBadge('AABBCCDD', 0, 'Resident badge');
    expect(getBadges()).toEqual([{ id: 'AABBCCDD', type: 0, note: 'Resident badge' }]);
  });

  it('stores badge type correctly', () => {
    addBadge('11223344', 2, '');
    expect(getBadges()[0].type).toBe(2);
  });

  it('inserts multiple badges', () => {
    addBadge('AABBCCDD', 0, '');
    addBadge('11223344', 1, '');
    expect(getBadges()).toHaveLength(2);
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => addBadge('AABBCCDD', 0, '')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// assignBadge / getAssignments
// ---------------------------------------------------------------------------

describe('assignBadge', () => {
  it('creates an assignment', () => {
    addBadge('AABBCCDD', 0, '');
    assignBadge('member-1', 'AABBCCDD');
    expect(getAssignments()).toEqual([{ memberId: 'member-1', badgeId: 'AABBCCDD' }]);
  });

  it('supports multiple badges for the same member', () => {
    addBadge('AABBCCDD', 0, '');
    addBadge('11223344', 0, '');
    assignBadge('member-1', 'AABBCCDD');
    assignBadge('member-1', '11223344');
    expect(getAssignments()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// removeBadge
// ---------------------------------------------------------------------------

describe('removeBadge', () => {
  it('removes the assignment record', () => {
    addBadge('AABBCCDD', 0, '');
    assignBadge('member-1', 'AABBCCDD');
    removeBadge('member-1', 'AABBCCDD');
    expect(getAssignments()).toEqual([]);
  });

  it('deletes the badge when no longer assigned to anyone', () => {
    addBadge('AABBCCDD', 0, '');
    assignBadge('member-1', 'AABBCCDD');
    removeBadge('member-1', 'AABBCCDD');
    expect(getBadges()).toEqual([]);
  });

  it('keeps badge when still assigned to another member', () => {
    addBadge('AABBCCDD', 0, '');
    assignBadge('member-1', 'AABBCCDD');
    assignBadge('member-2', 'AABBCCDD');
    removeBadge('member-1', 'AABBCCDD');
    expect(getBadges()).toHaveLength(1);
    expect(getAssignments()).toEqual([{ memberId: 'member-2', badgeId: 'AABBCCDD' }]);
  });

  it('does not throw when assignment does not exist', () => {
    expect(() => removeBadge('member-x', 'FFFFFFFF')).not.toThrow();
    expect(getAssignments()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getContacts
// ---------------------------------------------------------------------------

describe('getContacts', () => {
  it('returns empty array when no members exist', () => {
    expect(getContacts()).toEqual([]);
  });

  it('returns contacts sorted by surname then name', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'Zelda', 'Smith')`);
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m2', 'Alice', 'Smith')`);
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m3', 'Bob', 'Adams')`);
    const contacts = getContacts();
    expect(contacts).toHaveLength(3);
    expect(contacts[0].surname).toBe('Adams');  // Bob Adams first
    expect(contacts[1].name).toBe('Alice');     // Alice Smith before Zelda Smith
    expect(contacts[2].name).toBe('Zelda');
  });

  it('returns member fields correctly', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'John', 'Doe')`);
    const [c] = getContacts();
    expect(c.id).toBe('m1');
    expect(c.name).toBe('John');
    expect(c.surname).toBe('Doe');
  });

  it('returns empty apts array when member has no apartment', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'John', 'Doe')`);
    const [c] = getContacts();
    expect(c.apts).toEqual([]);
  });

  it('returns apartment data for a member', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'John', 'Doe')`);
    db.run(`INSERT INTO APT (ID_APT, Apt, SCS_addr, Block, Floor) VALUES ('a1', '101', 1, 'A', '1')`);
    db.run(`INSERT INTO MEMBER_APT (ID_MEMBER, ID_APT) VALUES ('m1', 'a1')`);
    const [c] = getContacts();
    expect(c.apts).toHaveLength(1);
    expect(c.apts[0]).toMatchObject({ apt: '101', scsAddr: 1, block: 'A', floor: '1' });
  });

  it('returns all apartments when member has multiple', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'Jane', 'Doe')`);
    db.run(`INSERT INTO APT (ID_APT, Apt, SCS_addr, Block, Floor) VALUES ('a1', '101', 1, 'A', '1')`);
    db.run(`INSERT INTO APT (ID_APT, Apt, SCS_addr, Block, Floor) VALUES ('a2', '102', 2, 'A', '1')`);
    db.run(`INSERT INTO MEMBER_APT (ID_MEMBER, ID_APT) VALUES ('m1', 'a1')`);
    db.run(`INSERT INTO MEMBER_APT (ID_MEMBER, ID_APT) VALUES ('m1', 'a2')`);
    const [c] = getContacts();
    expect(c.apts).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// exportDb / loadDb
// ---------------------------------------------------------------------------

describe('exportDb / loadDb', () => {
  it('exportDb returns a non-empty Uint8Array', () => {
    const bytes = exportDb();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('preserves badge data through export + reload', () => {
    addBadge('AABBCCDD', 0, 'test badge');
    const bytes = exportDb();
    closeDb();
    loadDb(bytes);
    expect(getBadges()).toEqual([{ id: 'AABBCCDD', type: 0, note: 'test badge' }]);
  });

  it('exportDb throws when no database is loaded', () => {
    closeDb();
    expect(() => exportDb()).toThrow();
  });

  it('loadDb closes an existing open db before loading', () => {
    addBadge('AABBCCDD', 0, 'kept');
    const bytes = exportDb();
    // _db is already open (createEmptyDb ran in beforeEach) — exercises the close branch
    loadDb(bytes);
    expect(getBadges()).toEqual([{ id: 'AABBCCDD', type: 0, note: 'kept' }]);
  });
});

// ---------------------------------------------------------------------------
// addContact / editContact / deleteContact
// ---------------------------------------------------------------------------

describe('addContact', () => {
  it('inserts a member retrievable by getContacts', () => {
    addContact('m1', 'John', 'Doe');
    const [c] = getContacts();
    expect(c).toMatchObject({ id: 'm1', name: 'John', surname: 'Doe', apts: [] });
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => addContact('m1', 'John', 'Doe')).toThrow();
  });
});

describe('editContact', () => {
  it('updates name and surname', () => {
    addContact('m1', 'John', 'Doe');
    editContact('m1', 'Jane', 'Smith');
    const [c] = getContacts();
    expect(c.name).toBe('Jane');
    expect(c.surname).toBe('Smith');
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => editContact('m1', 'Jane', 'Smith')).toThrow();
  });
});

describe('deleteContact', () => {
  it('removes the member from getContacts', () => {
    addContact('m1', 'John', 'Doe');
    deleteContact('m1');
    expect(getContacts()).toEqual([]);
  });

  it('removes orphaned badges from the BADGE table', () => {
    addContact('m1', 'John', 'Doe');
    addBadge('AABBCCDD', 0, '');
    assignBadge('m1', 'AABBCCDD');
    deleteContact('m1');
    expect(getBadges()).toEqual([]);
  });

  it('keeps badge still assigned to another member', () => {
    addContact('m1', 'John', 'Doe');
    addContact('m2', 'Jane', 'Smith');
    addBadge('AABBCCDD', 0, '');
    assignBadge('m1', 'AABBCCDD');
    assignBadge('m2', 'AABBCCDD');
    deleteContact('m1');
    expect(getBadges()).toHaveLength(1);
    expect(getAssignments()).toEqual([{ memberId: 'm2', badgeId: 'AABBCCDD' }]);
  });

  it('removes orphaned apartments from the APT table', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    deleteContact('m1');
    const result = _getDb().exec("SELECT COUNT(*) AS cnt FROM APT WHERE ID_APT = 'a1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('keeps apartment still linked to another member', () => {
    addContact('m1', 'John', 'Doe');
    addContact('m2', 'Jane', 'Smith');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    assignApartment('m2', 'a1');
    deleteContact('m1');
    const m2 = getContacts().find(c => c.id === 'm2');
    expect(m2.apts).toHaveLength(1);
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => deleteContact('m1')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// addApartment / assignApartment / editApartment / removeApartment
// ---------------------------------------------------------------------------

describe('addApartment', () => {
  it('inserts an apartment with all fields', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 5, 'A', '2');
    assignApartment('m1', 'a1');
    const [c] = getContacts();
    expect(c.apts[0]).toMatchObject({ id: 'a1', apt: '101', scsAddr: 5, block: 'A', floor: '2' });
  });

  it('accepts null scsAddr', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', null, '', '');
    assignApartment('m1', 'a1');
    const [c] = getContacts();
    expect(c.apts[0].scsAddr).toBeNull();
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => addApartment('a1', '101', 1, 'A', '1')).toThrow();
  });
});

describe('assignApartment', () => {
  it('links an apartment to a member', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    expect(getContacts()[0].apts).toHaveLength(1);
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => assignApartment('m1', 'a1')).toThrow();
  });
});

describe('editApartment', () => {
  it('updates all apartment fields', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    editApartment('a1', '202', 2, 'B', '3');
    const [c] = getContacts();
    expect(c.apts[0]).toMatchObject({ apt: '202', scsAddr: 2, block: 'B', floor: '3' });
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => editApartment('a1', '101', 1, 'A', '1')).toThrow();
  });
});

describe('removeApartment', () => {
  it('removes the apartment from the member', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    removeApartment('m1', 'a1');
    expect(getContacts()[0].apts).toEqual([]);
  });

  it('deletes the APT record when no longer linked to anyone', () => {
    addContact('m1', 'John', 'Doe');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    removeApartment('m1', 'a1');
    const result = _getDb().exec("SELECT COUNT(*) AS cnt FROM APT WHERE ID_APT = 'a1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('keeps APT record when still linked to another member', () => {
    addContact('m1', 'John', 'Doe');
    addContact('m2', 'Jane', 'Smith');
    addApartment('a1', '101', 1, 'A', '1');
    assignApartment('m1', 'a1');
    assignApartment('m2', 'a1');
    removeApartment('m1', 'a1');
    const m2 = getContacts().find(c => c.id === 'm2');
    expect(m2.apts).toHaveLength(1);
  });

  it('throws when no database is loaded', () => {
    closeDb();
    expect(() => removeApartment('m1', 'a1')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getContacts — apartment id field
// ---------------------------------------------------------------------------

describe('getContacts apartment id', () => {
  it('includes the apartment id in apt data', () => {
    const db = _getDb();
    db.run(`INSERT INTO MEMBER (ID_MEMBER, Name, Surname) VALUES ('m1', 'John', 'Doe')`);
    db.run(`INSERT INTO APT (ID_APT, Apt, SCS_addr, Block, Floor) VALUES ('a1', '101', 1, 'A', '1')`);
    db.run(`INSERT INTO MEMBER_APT (ID_MEMBER, ID_APT) VALUES ('m1', 'a1')`);
    const [c] = getContacts();
    expect(c.apts[0].id).toBe('a1');
  });
});
