import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { readPrj, writePrj } from '../js/prj.js';

// Integration tests with real BTicino .prj files (internal fixtures, not published)
// These test the full encrypt/decrypt cycle with authentic file structures.

describe('readPrj — real BTicino fixtures', () => {
  it('reads and parses Empty_Project_3.2.13.prj', async () => {
    const buf = await readFile('tests/fixtures/Empty_Project_3.2.13.prj');
    const result = await readPrj(buf.buffer);

    expect(result).toHaveProperty('dbBytes');
    expect(result).toHaveProperty('prjCtx');
    expect(result.dbBytes).toBeInstanceOf(Uint8Array);
    expect(result.dbBytes.length).toBeGreaterThan(0);

    // Verify SQLite magic bytes (first 16 bytes are "SQLite format 3\0")
    const magic = new TextDecoder().decode(result.dbBytes.slice(0, 15));
    expect(magic).toBe('SQLite format 3');
  });

  it('reads and parses Empty_Project_4.0.14.prj', async () => {
    const buf = await readFile('tests/fixtures/Empty_Project_4.0.14.prj');
    const result = await readPrj(buf.buffer);

    expect(result).toHaveProperty('dbBytes');
    expect(result).toHaveProperty('prjCtx');
    expect(result.dbBytes).toBeInstanceOf(Uint8Array);
    expect(result.dbBytes.length).toBeGreaterThan(0);

    // Verify SQLite magic bytes
    const magic = new TextDecoder().decode(result.dbBytes.slice(0, 15));
    expect(magic).toBe('SQLite format 3');
  });
});

describe('readPrj / writePrj round-trip — real fixtures', () => {
  it('round-trips Empty_Project_3.2.13.prj preserving dbBytes and all entries', async () => {
    const original = await readFile('tests/fixtures/Empty_Project_3.2.13.prj');
    const { dbBytes: originalDb, prjCtx } = await readPrj(original.buffer);

    // Re-pack with the same content
    const repacked = await writePrj({ dbBytes: originalDb, prjCtx });

    // Verify db reads back correctly
    const { dbBytes: repackedDb, prjCtx: repackedCtx } = await readPrj(repacked.buffer);
    expect(repackedDb).toEqual(originalDb);

    // Verify outer entry names and order are preserved
    expect(repackedCtx.outerOrder.map(e => e.name)).toEqual(
      prjCtx.outerOrder.map(e => e.name)
    );

    // Verify non-DCDB outer entries are byte-identical after round-trip
    for (const orig of prjCtx.outerOrder.filter(e => e.data !== null)) {
      const repacked = repackedCtx.outerOrder.find(e => e.name === orig.name);
      expect(repacked?.data).toEqual(orig.data);
    }

    // Verify non-db3 DCDB entries (e.g. extra.xml) are byte-identical after round-trip
    for (const orig of prjCtx.dcdbOrder.filter(e => e.data !== null)) {
      const repacked = repackedCtx.dcdbOrder.find(e => e.name === orig.name);
      expect(repacked?.data).toEqual(orig.data);
    }
  });

  it('round-trips Empty_Project_4.0.14.prj preserving dbBytes and all entries', async () => {
    const original = await readFile('tests/fixtures/Empty_Project_4.0.14.prj');
    const { dbBytes: originalDb, prjCtx } = await readPrj(original.buffer);

    // Re-pack with the same content
    const repacked = await writePrj({ dbBytes: originalDb, prjCtx });

    // Verify db reads back correctly
    const { dbBytes: repackedDb, prjCtx: repackedCtx } = await readPrj(repacked.buffer);
    expect(repackedDb).toEqual(originalDb);

    // Verify outer entry names and order are preserved
    expect(repackedCtx.outerOrder.map(e => e.name)).toEqual(
      prjCtx.outerOrder.map(e => e.name)
    );

    // Verify non-DCDB outer entries are byte-identical after round-trip
    for (const orig of prjCtx.outerOrder.filter(e => e.data !== null)) {
      const repacked = repackedCtx.outerOrder.find(e => e.name === orig.name);
      expect(repacked?.data).toEqual(orig.data);
    }

    // Verify non-db3 DCDB entries (e.g. extra.xml) are byte-identical after round-trip
    for (const orig of prjCtx.dcdbOrder.filter(e => e.data !== null)) {
      const repacked = repackedCtx.dcdbOrder.find(e => e.name === orig.name);
      expect(repacked?.data).toEqual(orig.data);
    }
  });
});
