import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  crc32,
  zipcryptoEncrypt,
  zipcryptoDecrypt,
  parseZipEntries,
  writePrj,
  readPrj,
} from '../js/prj.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Builds a raw ZIP local-file entry (header + data).
// Options:
//   encrypted  — sets bit 0 of the flags field
//   flags      — overrides the entire flags field
//   forcedCrc  — stores this value in the CRC field instead of crc32(data)
function buildEntry(filename, data, { encrypted = false, flags = null, forcedCrc = null } = {}) {
  const nameBytes  = new TextEncoder().encode(filename);
  const crcVal     = forcedCrc !== null ? forcedCrc : crc32(data);
  const entryFlags = flags !== null ? flags : (encrypted ? 0x0001 : 0x0000);
  const buf        = new Uint8Array(30 + nameBytes.length + data.length);
  const v          = new DataView(buf.buffer);
  v.setUint32(0,  0x04034b50,       true); // PK\x03\x04
  v.setUint16(4,  20,               true); // version needed
  v.setUint16(6,  entryFlags,       true);
  v.setUint16(8,  0,                true); // method: stored
  v.setUint32(10, 0,                true); // mod time/date
  v.setUint32(14, crcVal,           true);
  v.setUint32(18, data.length,      true); // comp size
  v.setUint32(22, data.length,      true); // uncomp size
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0,                true); // extra field length
  buf.set(nameBytes, 30);
  buf.set(data, 30 + nameBytes.length);
  return buf;
}

// Wraps an inner ZIP buffer as an unencrypted stored DCDB.xtz entry so that
// readPrj can process it without needing the real encryption keys.
function buildSyntheticPrj(dcdbXtzContent) {
  return buildEntry('DCDB.xtz', dcdbXtzContent);
}

// ---------------------------------------------------------------------------
// crc32
// ---------------------------------------------------------------------------

describe('crc32', () => {
  it('returns 0 for empty input', () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
  });

  it('matches well-known CRC32 for "123456789"', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xCBF43926);
  });

  it('is deterministic', () => {
    const data = new TextEncoder().encode('fobforge');
    expect(crc32(data)).toBe(crc32(data));
  });

  it('returns different values for different inputs', () => {
    const a = crc32(new TextEncoder().encode('hello'));
    const b = crc32(new TextEncoder().encode('world'));
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// zipcryptoEncrypt / zipcryptoDecrypt
// ---------------------------------------------------------------------------

describe('zipcryptoEncrypt / zipcryptoDecrypt', () => {
  it('round-trips data correctly', () => {
    const plain = new TextEncoder().encode('Hello, FobForge!');
    const encrypted = zipcryptoEncrypt(plain, 'password', crc32(plain));
    const decrypted = zipcryptoDecrypt(encrypted, 'password');
    expect(decrypted).toEqual(plain);
  });

  it('encrypted output is 12 bytes longer than plaintext', () => {
    const plain = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    const encrypted = zipcryptoEncrypt(plain, 'key', crc32(plain));
    expect(encrypted.length).toBe(plain.length + 12);
  });

  it('wrong password produces wrong plaintext', () => {
    const plain = new TextEncoder().encode('secret');
    const encrypted = zipcryptoEncrypt(plain, 'correct', crc32(plain));
    const wrong = zipcryptoDecrypt(encrypted, 'wrong');
    expect(wrong).not.toEqual(plain);
  });

  it('handles empty data', () => {
    const plain = new Uint8Array(0);
    const encrypted = zipcryptoEncrypt(plain, 'pass', crc32(plain));
    const decrypted = zipcryptoDecrypt(encrypted, 'pass');
    expect(decrypted).toEqual(plain);
  });

  it('throws when encrypted data is shorter than 12 bytes', () => {
    expect(() => zipcryptoDecrypt(new Uint8Array(5), 'pass')).toThrow('too short');
  });
});

// ---------------------------------------------------------------------------
// parseZipEntries
// ---------------------------------------------------------------------------

describe('parseZipEntries', () => {
  it('returns empty array for empty buffer', () => {
    expect(parseZipEntries(new Uint8Array([]))).toEqual([]);
  });

  it('returns empty array when no valid signature found', () => {
    expect(parseZipEntries(new Uint8Array([1, 2, 3, 4, 5]))).toEqual([]);
  });

  it('skips 0x50 bytes not followed by a valid PK local-file signature', () => {
    const data  = new TextEncoder().encode('content');
    const valid = buildEntry('real.txt', data);
    // Prepend a spurious 0x50 0x00 0x00 0x00 — not a PK\x03\x04 sequence
    const buf   = new Uint8Array(4 + valid.length);
    buf[0] = 0x50; buf[1] = 0x00; buf[2] = 0x00; buf[3] = 0x00;
    buf.set(valid, 4);
    const entries = parseZipEntries(buf);
    expect(entries).toHaveLength(1);
    expect(entries[0].fname).toBe('real.txt');
  });

  it('throws when entry data extends beyond buffer', () => {
    const data  = new TextEncoder().encode('hello');
    const entry = buildEntry('test.txt', data);
    // Corrupt the compSize field (offset 18) to exceed the buffer length
    new DataView(entry.buffer).setUint32(18, 999999, true);
    expect(() => parseZipEntries(entry)).toThrow('data extends beyond buffer');
  });

  it('parses a single stored entry', () => {
    const data    = new TextEncoder().encode('test content');
    const zip     = buildEntry('test.txt', data);
    const entries = parseZipEntries(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].fname).toBe('test.txt');
    expect(entries[0].method).toBe(0);
    expect(entries[0].encrypted).toBe(false);
    expect(entries[0].compData).toEqual(data);
  });

  it('sets encrypted flag when bit 0 of flags is set', () => {
    const data    = new TextEncoder().encode('data');
    const zip     = buildEntry('secret.bin', data, { encrypted: true });
    const entries = parseZipEntries(zip);
    expect(entries[0].encrypted).toBe(true);
  });

  it('parses multiple sequential entries', () => {
    const d1 = new TextEncoder().encode('file one');
    const d2 = new TextEncoder().encode('file two');
    const e1 = buildEntry('one.txt', d1);
    const e2 = buildEntry('two.txt', d2);
    const zip = new Uint8Array(e1.length + e2.length);
    zip.set(e1, 0);
    zip.set(e2, e1.length);
    const entries = parseZipEntries(zip);
    expect(entries).toHaveLength(2);
    expect(entries[0].fname).toBe('one.txt');
    expect(entries[1].fname).toBe('two.txt');
  });
});

// ---------------------------------------------------------------------------
// readPrj — structural error paths
// ---------------------------------------------------------------------------

describe('readPrj — structural errors', () => {
  it('throws when DCDB.xtz is absent from the outer archive', async () => {
    // Minimal EOCD (22 bytes) with zero entries: parseZipEntries returns []
    const eocd = new Uint8Array(22);
    new DataView(eocd.buffer).setUint32(0, 0x06054b50, true); // EOCD signature
    await expect(readPrj(eocd.buffer)).rejects.toThrow('DCDB.xtz not found');
  });

  it('throws when Device_contacts.db3 is absent from DCDB.xtz', async () => {
    // Inner ZIP contains an entry that does not end in .db3
    const innerZip = buildEntry('other_file.txt', new TextEncoder().encode('data'));
    await expect(readPrj(buildSyntheticPrj(innerZip).buffer)).rejects.toThrow('Device_contacts.db3 not found');
  });
});

// ---------------------------------------------------------------------------
// readEntry — CRC validation branches
//
// Strategy: build a synthetic outer .prj where DCDB.xtz is an unencrypted
// stored entry, so readEntry returns its compData without touching the keys.
// The inner DCDB.xtz is likewise a stored entry whose CRC / flags we control.
// ---------------------------------------------------------------------------

describe('readEntry — CRC and flag branches', () => {
  const dbData = new TextEncoder().encode('sqlite db content for crc branch tests');

  it('skips CRC check when data descriptor flag (bit 3) is set', async () => {
    const innerEntry = buildEntry('DCDB/Device_contacts.db3', dbData, {
      flags: 0x0008,         // hasDataDescriptor = true — CRC field must be ignored
      forcedCrc: 0xdeadbeef, // deliberately wrong
    });
    const { dbBytes } = await readPrj(buildSyntheticPrj(innerEntry).buffer);
    expect(dbBytes).toEqual(dbData);
  });

  it('skips CRC check when the stored CRC field is zero', async () => {
    const innerEntry = buildEntry('DCDB/Device_contacts.db3', dbData, {
      forcedCrc: 0,          // crc === 0 → skip check
    });
    const { dbBytes } = await readPrj(buildSyntheticPrj(innerEntry).buffer);
    expect(dbBytes).toEqual(dbData);
  });

  it('throws on CRC32 mismatch', async () => {
    const innerEntry = buildEntry('DCDB/Device_contacts.db3', dbData, {
      forcedCrc: 0xdeadbeef, // wrong CRC, no data descriptor flag
    });
    await expect(readPrj(buildSyntheticPrj(innerEntry).buffer)).rejects.toThrow('CRC32 mismatch');
  });
});

// ---------------------------------------------------------------------------
// readPrj / writePrj round-trip
// ---------------------------------------------------------------------------

describe('readPrj / writePrj round-trip', () => {
  it('preserves dbBytes through write-then-read (minimal prj, no prjCtx)', async () => {
    const original = new TextEncoder().encode('mock sqlite payload');
    const prjBytes = await writePrj({ dbBytes: original, prjCtx: null });

    expect(prjBytes).toBeInstanceOf(Uint8Array);
    expect(prjBytes.length).toBeGreaterThan(0);

    const { dbBytes } = await readPrj(prjBytes.buffer);
    expect(dbBytes).toEqual(original);
  });

  it('preserves outer entries beyond DCDB.xtz in original order', async () => {
    const dbBytes    = new TextEncoder().encode('db');
    const xtz0data   = new TextEncoder().encode('xtz0 payload');
    const xtz1data   = new TextEncoder().encode('xtz1 payload');
    const prjCtx = {
      outerOrder: [
        { name: '0.xtz',    data: xtz0data },
        { name: 'DCDB.xtz', data: null },
        { name: '1.xtz',    data: xtz1data },
      ],
      dcdbOrder: [{ name: 'DCDB/Device_contacts.db3', data: null }],
    };
    const prjBytes = await writePrj({ dbBytes, prjCtx });
    const result   = await readPrj(prjBytes.buffer);

    expect(result.dbBytes).toEqual(dbBytes);
    const names = result.prjCtx.outerOrder.map(e => e.name);
    expect(names).toEqual(['0.xtz', 'DCDB.xtz', '1.xtz']);
    expect(result.prjCtx.outerOrder.find(e => e.name === '0.xtz').data).toEqual(xtz0data);
    expect(result.prjCtx.outerOrder.find(e => e.name === '1.xtz').data).toEqual(xtz1data);
  });

  it('preserves non-db3 entries inside DCDB.xtz (e.g. extra.xml)', async () => {
    const dbBytes    = new TextEncoder().encode('db');
    const xmlPayload = new TextEncoder().encode('<extra>test</extra>');
    const prjCtx = {
      outerOrder: [{ name: 'DCDB.xtz', data: null }],
      dcdbOrder: [
        { name: 'DCDB/Device_contacts.db3', data: null },
        { name: 'DCDB/extra.xml',           data: xmlPayload },
      ],
    };
    const prjBytes = await writePrj({ dbBytes, prjCtx });
    const result   = await readPrj(prjBytes.buffer);

    expect(result.dbBytes).toEqual(dbBytes);
    const xml = result.prjCtx.dcdbOrder.find(e => e.name === 'DCDB/extra.xml');
    expect(xml?.data).toEqual(xmlPayload);
  });

  it('round-trips large compressible data (exercises deflate → inflate path)', async () => {
    // 1 080 bytes of repeated text compress well → buildZip picks method=8 for
    // the inner .db3 entry → readEntry calls inflate, covering that branch.
    const dbBytes  = new TextEncoder().encode('FobForge-'.repeat(120));
    const prjBytes = await writePrj({ dbBytes, prjCtx: null });
    const result   = await readPrj(prjBytes.buffer);
    expect(result.dbBytes).toEqual(dbBytes);
  });
});

// ---------------------------------------------------------------------------
// deflate / inflate stream error paths
// ---------------------------------------------------------------------------

describe('deflate / inflate error paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deflate: rejects when CompressionStream writer throws', async () => {
    vi.stubGlobal('CompressionStream', class {
      constructor() {
        this.readable = { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) };
        this.writable = { getWriter: () => ({ write: async () => { throw new Error('write fail'); }, close: async () => {} }) };
      }
    });
    await expect(writePrj({ dbBytes: new TextEncoder().encode('x'), prjCtx: null })).rejects.toThrow('write fail');
  });

  it('deflate: rejects when CompressionStream reader throws', async () => {
    vi.stubGlobal('CompressionStream', class {
      constructor() {
        this.readable = { getReader: () => ({ read: async () => { throw new Error('read fail'); }, cancel: async () => {} }) };
        this.writable = { getWriter: () => ({ write: async () => {}, close: async () => {} }) };
      }
    });
    await expect(writePrj({ dbBytes: new TextEncoder().encode('x'), prjCtx: null })).rejects.toThrow('read fail');
  });

  it('inflate: rejects when DecompressionStream writer throws', async () => {
    const dbBytes  = new TextEncoder().encode('FobForge-'.repeat(120));
    const prjBytes = await writePrj({ dbBytes, prjCtx: null });
    vi.stubGlobal('DecompressionStream', class {
      constructor() {
        this.readable = { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) };
        this.writable = { getWriter: () => ({ write: async () => { throw new Error('decompress fail'); }, close: async () => {} }) };
      }
    });
    await expect(readPrj(prjBytes.buffer)).rejects.toThrow('decompress fail');
  });
});
