import { describe, it, expect } from 'vitest';
import {
  crc32,
  zipcryptoEncrypt,
  zipcryptoDecrypt,
  parseZipEntries,
  writePrj,
  readPrj,
} from '../js/prj.js';

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
});

// ---------------------------------------------------------------------------
// parseZipEntries
// ---------------------------------------------------------------------------

describe('parseZipEntries', () => {
  function buildEntry(filename, data, { encrypted = false } = {}) {
    const nameBytes = new TextEncoder().encode(filename);
    const crcVal    = crc32(data);
    const flags     = encrypted ? 0x0001 : 0x0000;
    const buf       = new Uint8Array(30 + nameBytes.length + data.length);
    const v         = new DataView(buf.buffer);
    v.setUint32(0,  0x04034b50,    true); // PK\x03\x04
    v.setUint16(4,  20,            true); // version needed
    v.setUint16(6,  flags,         true);
    v.setUint16(8,  0,             true); // method: stored
    v.setUint32(10, 0,             true); // mod time/date
    v.setUint32(14, crcVal,        true);
    v.setUint32(18, data.length,   true); // comp size
    v.setUint32(22, data.length,   true); // uncomp size
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0,             true); // extra field length
    buf.set(nameBytes, 30);
    buf.set(data, 30 + nameBytes.length);
    return buf;
  }

  it('returns empty array for empty buffer', () => {
    expect(parseZipEntries(new Uint8Array([]))).toEqual([]);
  });

  it('returns empty array when no valid signature found', () => {
    expect(parseZipEntries(new Uint8Array([1, 2, 3, 4, 5]))).toEqual([]);
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
// readPrj / writePrj round-trip
// Node 18+ provides CompressionStream/DecompressionStream natively.
// ---------------------------------------------------------------------------

describe('readPrj / writePrj round-trip', () => {
  it('preserves dbBytes through write-then-read', async () => {
    const original = new TextEncoder().encode('mock sqlite payload');
    const prjBytes = await writePrj({ dbBytes: original, rawXtz0: null, rawXtz1: null });

    expect(prjBytes).toBeInstanceOf(Uint8Array);
    expect(prjBytes.length).toBeGreaterThan(0);

    const { dbBytes } = await readPrj(prjBytes.buffer);
    expect(dbBytes).toEqual(original);
  });

  it('round-trips with rawXtz0 present', async () => {
    const dbBytes  = new TextEncoder().encode('db');
    const rawXtz0  = new TextEncoder().encode('xtz0 payload');
    const prjBytes = await writePrj({ dbBytes, rawXtz0, rawXtz1: null });
    const result   = await readPrj(prjBytes.buffer);
    expect(result.dbBytes).toEqual(dbBytes);
    expect(result.rawXtz0).toEqual(rawXtz0);
  });
});
