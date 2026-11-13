#!/usr/bin/env node
// Print the byte size of every entry in an ICU .dat package, optionally
// filtered by a substring. This exists because `strings icudtl.dat | grep`
// answers PRESENCE and nothing else — it lists entry names, and every size
// quoted in this repo's tables needs the package table of contents.
//
// Usage:
//   node scripts/icu-entry-sizes.mjs /opt/google/chrome/icudtl.dat is
//   node scripts/icu-entry-sizes.mjs ./icudtl.dat            # everything
//
// Format (ICU udata "offset TOC" package), read from ICU's own udata.cpp:
//   DataHeader { uint16 headerSize; uint8 0xda; uint8 0x27; UDataInfo info; }
//   at `headerSize`:  uint32 count, then count x { uint32 nameOffset, dataOffset }
//   nameOffset and dataOffset are both relative to the start of that count word.
// An entry's size is the gap to the next entry's data, which is why this reads
// the whole table rather than seeking to one name.

import { readFileSync } from "node:fs";

const [, , file, filter] = process.argv;
if (!file) {
  console.error("usage: icu-entry-sizes.mjs <icudtl.dat> [name-substring]");
  process.exit(2);
}

const buf = readFileSync(file);
if (buf[2] !== 0xda || buf[3] !== 0x27) {
  console.error(`${file}: not an ICU data file (magic is ${buf[2]?.toString(16)} ${buf[3]?.toString(16)}, want da 27)`);
  process.exit(2);
}
// UDataInfo.isBigEndian sits 4 bytes past the 4-byte DataHeader prefix.
const bigEndian = buf[8] === 1;
const u16 = (o) => (bigEndian ? buf.readUInt16BE(o) : buf.readUInt16LE(o));
const u32 = (o) => (bigEndian ? buf.readUInt32BE(o) : buf.readUInt32LE(o));

const base = u16(0);
const count = u32(base);
const entries = [];
for (let i = 0; i < count; i++) {
  const e = base + 4 + i * 8;
  const nameOffset = u32(e);
  const dataOffset = u32(e + 4);
  const start = buf.indexOf(0, base + nameOffset);
  entries.push({ name: buf.toString("latin1", base + nameOffset, start), dataOffset });
}
// Entries are stored in name order and their data in the same order, so the
// gap to the next entry IS the size. The last one runs to end of file.
for (let i = 0; i < entries.length; i++) {
  const next = i + 1 < entries.length ? entries[i + 1].dataOffset : buf.length - base;
  entries[i].size = next - entries[i].dataOffset;
}

const shown = filter ? entries.filter((e) => e.name.includes(filter)) : entries;
let total = 0;
for (const e of shown) {
  total += e.size;
  console.log(`${String(e.size).padStart(9)}  ${e.name}`);
}
console.log(`${String(total).padStart(9)}  TOTAL (${shown.length} of ${count} entries)`);
