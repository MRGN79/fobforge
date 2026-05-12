import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import initSqlJs from 'sql.js';
import {
  initDb, createEmptyDb, loadDb, exportDb, closeDb, _getDb,
  getContacts, getBadges, getAssignments,
  addBadge, assignBadge, removeBadge,
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
});
