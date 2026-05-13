// FobForge — prj.js
// Handles reading and writing .prj files.
// A .prj file is a double-encrypted ZIP archive:
//   Outer layer: ZIP encrypted with ZipCrypto (key A)
//   Inner layer: .xtz files, each an encrypted ZIP (key B)
//   DCDB.xtz contains Device_contacts.db3 (SQLite)
//
// Keys are stored obfuscated — see _k() below.
// ZipCrypto is implemented in pure JS (no external library).

// ---------------------------------------------------------------------------
// Key management (NFR-04)
// Keys are Base64-encoded to avoid plain text in the repository.
// ---------------------------------------------------------------------------

function _k(e) { return atob(e); }
const _KO = 'YnRpY2lubw==';       // outer key
const _KI = 'YnR4dHJwc3c=';       // inner key

// ---------------------------------------------------------------------------
// CRC32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
})();

function crc32byte(crc, byte) {
  return (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
}

export function crc32(data) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    c = crc32byte(c, data[i]);
  }
  return (~c) >>> 0;
}

// ---------------------------------------------------------------------------
// ZipCrypto
// ---------------------------------------------------------------------------

function initKeys(password) {
  const keys = [305419896, 591751049, 878082192];
  for (let i = 0; i < password.length; i++) {
    _updateKeys(keys, password.charCodeAt(i));
  }
  return keys;
}

function _updateKeys(keys, byte) {
  keys[0] = crc32byte(keys[0], byte);
  keys[1] = (keys[1] + (keys[0] & 0xff)) >>> 0;
  keys[1] = (Math.imul(keys[1], 134775813) + 1) >>> 0;
  keys[2] = crc32byte(keys[2], keys[1] >>> 24);
}

function _keyByte(keys) {
  const temp = (keys[2] | 2) >>> 0;
  return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
}

export function zipcryptoDecrypt(encData, password) {
  if (encData.length < 12) {
    throw new Error('Encrypted data too short (< 12 bytes) — file may be corrupt');
  }
  const keys = initKeys(password);
  // Decrypt and discard the 12-byte encryption header
  for (let i = 0; i < 12; i++) {
    const plain = encData[i] ^ _keyByte(keys);
    _updateKeys(keys, plain);
  }
  // Decrypt actual data
  const out = new Uint8Array(encData.length - 12);
  for (let i = 0; i < out.length; i++) {
    const plain = encData[i + 12] ^ _keyByte(keys);
    _updateKeys(keys, plain);
    out[i] = plain;
  }
  return out;
}

export function zipcryptoEncrypt(plainData, password, crc32val) {
  const keys = initKeys(password);
  // Build 12-byte encryption header
  // First 11 bytes: random. Last byte: high byte of CRC32.
  const header = new Uint8Array(12);
  for (let i = 0; i < 11; i++) {
    header[i] = Math.random() * 256 | 0;
  }
  header[11] = (crc32val >>> 24) & 0xff;
  // Encrypt header
  const encHeader = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    encHeader[i] = header[i] ^ _keyByte(keys);
    _updateKeys(keys, header[i]);
  }
  // Encrypt data
  const encData = new Uint8Array(plainData.length);
  for (let i = 0; i < plainData.length; i++) {
    encData[i] = plainData[i] ^ _keyByte(keys);
    _updateKeys(keys, plainData[i]);
  }
  // Concatenate header + data
  const result = new Uint8Array(12 + encData.length);
  result.set(encHeader, 0);
  result.set(encData, 12);
  return result;
}

// ---------------------------------------------------------------------------
// DEFLATE / INFLATE (via browser DecompressionStream / CompressionStream)
// ---------------------------------------------------------------------------

// Feature detection for compression APIs (added in Chrome 80, Firefox 110, Safari 16.1)
function _checkCompressionSupport() {
  if (typeof DecompressionStream === 'undefined' || typeof CompressionStream === 'undefined') {
    throw new Error(
      'Compression APIs not supported in this browser. ' +
      'Please use a modern browser: Chrome 80+, Firefox 110+, Safari 16.1+, Edge 80+'
    );
  }
}

async function inflate(compressed) {
  _checkCompressionSupport();
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const chunks = [];

  const readAll = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  };

  const readPromise = readAll().catch(e => {
    reader.cancel();
    throw e;
  });

  try {
    await writer.write(compressed);
    await writer.close();
  } catch (e) {
    reader.cancel();
    throw e;
  }

  await readPromise;

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function deflate(data) {
  _checkCompressionSupport();
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  const chunks = [];

  const readAll = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  };

  const readPromise = readAll().catch(e => {
    reader.cancel();
    throw e;
  });

  try {
    await writer.write(data);
    await writer.close();
  } catch (e) {
    reader.cancel();
    throw e;
  }

  await readPromise;

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// ZIP parser
// ---------------------------------------------------------------------------

function readUint16(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUint32(buf, offset) {
  return (buf[offset] | (buf[offset+1]<<8) |
          (buf[offset+2]<<16) | (buf[offset+3]<<24)) >>> 0;
}

export function parseZipEntries(buf) {
  const entries = [];
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset < buf.length - 4) {
    const idx = buf.indexOf(0x50, offset);
    if (idx === -1) break;
    if (buf[idx+1] !== 0x4b || buf[idx+2] !== 0x03 || buf[idx+3] !== 0x04) {
      offset = idx + 1;
      continue;
    }

    const flags      = readUint16(buf, idx + 6);
    const method     = readUint16(buf, idx + 8);
    const crc        = readUint32(buf, idx + 14);
    const compSize   = readUint32(buf, idx + 18);
    const uncompSize = readUint32(buf, idx + 22);
    const fnLen      = readUint16(buf, idx + 26);
    const extraLen   = readUint16(buf, idx + 28);
    const fname      = decoder.decode(buf.slice(idx+30, idx+30+fnLen));
    const dataStart  = idx + 30 + fnLen + extraLen;
    const encrypted  = !!(flags & 1);

    // Validate entry data doesn't extend beyond buffer
    if (dataStart + compSize > buf.length) {
      throw new Error(
        `ZIP entry "${fname}" data extends beyond buffer ` +
        `(requires ${dataStart + compSize}, have ${buf.length} bytes)`
      );
    }

    entries.push({
      fname,
      flags,
      method,
      crc,
      compSize,
      uncompSize,
      dataStart,
      compData: buf.slice(dataStart, dataStart + compSize),
      encrypted,
    });

    offset = dataStart + compSize;
  }

  return entries;
}

async function readEntry(entry, password) {
  let data = entry.compData;
  if (entry.encrypted && password) {
    data = zipcryptoDecrypt(data, password);
  }
  if (entry.method === 8) {
    data = await inflate(data);
  }
  // Validate CRC32 unless a data descriptor holds the real value (flag bit 3)
  const hasDataDescriptor = !!(entry.flags & 0x08);
  if (!hasDataDescriptor && entry.crc !== 0 && crc32(data) !== entry.crc) {
    throw new Error(`CRC32 mismatch for "${entry.fname}" — file may be corrupt`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// ZIP builder
// ---------------------------------------------------------------------------

function writeUint16(buf, offset, val) {
  buf[offset]   = val & 0xff;
  buf[offset+1] = (val >> 8) & 0xff;
}

function writeUint32(buf, offset, val) {
  buf[offset]   = val & 0xff;
  buf[offset+1] = (val >> 8)  & 0xff;
  buf[offset+2] = (val >> 16) & 0xff;
  buf[offset+3] = (val >> 24) & 0xff;
}

async function buildZip(files, password) {
  // files: [{ name: string, data: Uint8Array }]
  const localParts = [];
  const centralDir = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const fileCrc   = crc32(file.data);

    // Try deflate, fall back to store if larger
    let compData = await deflate(file.data);
    let method = 8;
    if (compData.length >= file.data.length) {
      compData = file.data;
      method = 0;
    }

    let flags = 0;
    let finalData = compData;
    if (password) {
      flags = 0x0001;
      finalData = zipcryptoEncrypt(compData, password, fileCrc);
    }

    // Local file header (30 bytes + filename)
    const lh = new Uint8Array(30 + nameBytes.length);
    writeUint32(lh, 0,  0x04034b50); // signature
    writeUint16(lh, 4,  20);          // version needed
    writeUint16(lh, 6,  flags);
    writeUint16(lh, 8,  method);
    writeUint32(lh, 10, 0);           // mod time/date
    writeUint32(lh, 14, fileCrc);
    writeUint32(lh, 18, finalData.length);
    writeUint32(lh, 22, file.data.length);
    writeUint16(lh, 26, nameBytes.length);
    writeUint16(lh, 28, 0);           // extra field length
    lh.set(nameBytes, 30);

    centralDir.push({
      nameBytes,
      crc: fileCrc,
      compSize: finalData.length,
      uncompSize: file.data.length,
      method,
      flags,
      offset,
    });

    localParts.push(lh, finalData);
    offset += lh.length + finalData.length;
  }

  // Central directory
  const centralDirStart = offset;
  const cdParts = [];

  for (const cd of centralDir) {
    const entry = new Uint8Array(46 + cd.nameBytes.length);
    writeUint32(entry, 0,  0x02014b50); // signature
    writeUint16(entry, 4,  20);          // version made by
    writeUint16(entry, 6,  20);          // version needed
    writeUint16(entry, 8,  cd.flags);
    writeUint16(entry, 10, cd.method);
    writeUint32(entry, 12, 0);           // mod time/date
    writeUint32(entry, 16, cd.crc);
    writeUint32(entry, 20, cd.compSize);
    writeUint32(entry, 24, cd.uncompSize);
    writeUint16(entry, 28, cd.nameBytes.length);
    writeUint16(entry, 30, 0);           // extra field length
    writeUint16(entry, 32, 0);           // comment length
    writeUint16(entry, 34, 0);           // disk number start
    writeUint16(entry, 36, 0);           // internal attributes
    writeUint32(entry, 38, 0);           // external attributes
    writeUint32(entry, 42, cd.offset);   // local header offset
    entry.set(cd.nameBytes, 46);
    cdParts.push(entry);
    offset += entry.length;
  }

  const cdSize = offset - centralDirStart;

  // End of central directory record
  const eocd = new Uint8Array(22);
  writeUint32(eocd, 0,  0x06054b50);    // signature
  writeUint16(eocd, 4,  0);             // disk number
  writeUint16(eocd, 6,  0);             // disk with central dir
  writeUint16(eocd, 8,  centralDir.length);
  writeUint16(eocd, 10, centralDir.length);
  writeUint32(eocd, 12, cdSize);
  writeUint32(eocd, 16, centralDirStart);
  writeUint16(eocd, 20, 0);             // comment length

  // Assemble final ZIP
  const allParts = [...localParts, ...cdParts, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of allParts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Read a .prj file and return:
// {
//   dbBytes: Uint8Array,   // raw SQLite bytes (the only part we modify)
//   prjCtx: {              // opaque round-trip context — pass to writePrj unchanged
//     outerOrder: [{ name, data }],  // all outer ZIP entries in original order;
//                                    // data=null marks the DCDB.xtz slot (rebuilt on write)
//     dcdbOrder:  [{ name, data }],  // all DCDB.xtz inner entries in original order;
//                                    // data=null marks the .db3 slot (replaced by dbBytes on write)
//   }
// }

export async function readPrj(arrayBuffer) {
  const outer = new Uint8Array(arrayBuffer);
  const outerEntries = parseZipEntries(outer);
  const ko = _k(_KO);
  const ki = _k(_KI);

  const outerOrder = [];
  const dcdbOrder  = [];
  let dbBytes  = null;
  let hasDcdb  = false;

  for (const entry of outerEntries) {
    if (entry.fname === 'DCDB.xtz') {
      hasDcdb = true;
      const dcdbRaw     = await readEntry(entry, ko);
      const dcdbEntries = parseZipEntries(dcdbRaw);
      for (const inner of dcdbEntries) {
        if (inner.fname.endsWith('.db3')) {
          dbBytes = await readEntry(inner, ki);
          dcdbOrder.push({ name: inner.fname, data: null });
        } else {
          dcdbOrder.push({ name: inner.fname, data: await readEntry(inner, ki) });
        }
      }
      outerOrder.push({ name: 'DCDB.xtz', data: null });
    } else {
      outerOrder.push({ name: entry.fname, data: await readEntry(entry, ko) });
    }
  }

  if (!hasDcdb) throw new Error('DCDB.xtz not found in .prj file');
  if (!dbBytes)  throw new Error('Device_contacts.db3 not found in DCDB.xtz');

  return { dbBytes, prjCtx: { outerOrder, dcdbOrder } };
}

// Write a .prj file from:
// {
//   dbBytes: Uint8Array,   // modified (or original) SQLite bytes
//   prjCtx:  object|null,  // context from readPrj; null produces a minimal new .prj
// }
// Returns a Uint8Array ready for download.

export async function writePrj({ dbBytes, prjCtx }) {
  const ki = _k(_KI);
  const ko = _k(_KO);

  // Rebuild DCDB.xtz — replace the .db3 slot, preserve everything else in order
  const dcdbFiles = prjCtx
    ? prjCtx.dcdbOrder.map(e => ({ name: e.name, data: e.data ?? dbBytes }))
    : [{ name: 'DCDB/Device_contacts.db3', data: dbBytes }];

  const dcdbZip = await buildZip(dcdbFiles, ki);

  // Rebuild outer .prj — replace the DCDB.xtz slot, preserve everything else in order
  const outerFiles = prjCtx
    ? prjCtx.outerOrder.map(e => ({ name: e.name, data: e.data ?? dcdbZip }))
    : [{ name: 'DCDB.xtz', data: dcdbZip }];

  return buildZip(outerFiles, ko);
}