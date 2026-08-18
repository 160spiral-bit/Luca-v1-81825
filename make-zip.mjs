#!/usr/bin/env node
/* Builds project.zip — a DEFLATE-compressed archive of the entire project.
   Zero dependencies (uses node:zlib + node:fs only). Run:  node make-zip.mjs
   Also executed automatically by the luca-project-zipper postinstall hook. */

import { deflateRawSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/* project root = the directory containing this script */
const ROOT = here;
const OUT = join(ROOT, "project.zip");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".idea", ".vscode"]);
const SKIP_FILES = new Set([".DS_Store"]);

function collect(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, out);
    else if (st.isFile()) {
      if (name.endsWith(".zip") && dir === ROOT) continue; /* never pack previous archives */
      out.push(full);
    }
  }
  return out;
}

/* ---------- zip writer (store paths, DEFLATE data) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

function buildZip(files) {
  const { time, date } = dosDateTime(new Date());
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join("/");
    const nameBuf = Buffer.from(rel, "utf8");
    const data = readFileSync(file);
    const crc = crc32(data);
    const compressed = deflateRawSync(data, { level: 9 });

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),            /* version needed */
      u16(0x0800),        /* flags: UTF-8 names */
      u16(8),             /* method: DEFLATE */
      u16(time),
      u16(date),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),             /* extra len */
      nameBuf,
    ]);

    chunks.push(local, compressed);

    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),          /* version made by */
        u16(20),          /* version needed */
        u16(0x0800),
        u16(8),
        u16(time),
        u16(date),
        u32(crc),
        u32(compressed.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0),           /* extra */
        u16(0),           /* comment */
        u16(0),           /* disk */
        u16(0),           /* internal attrs */
        u32(0),           /* external attrs */
        u32(offset),      /* local header offset */
        nameBuf,
      ]),
    );

    offset += local.length + compressed.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(cdBuf.length),
    u32(offset),
    u16(0),
  ]);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

/* ---------- go ---------- */

const files = collect(ROOT, []);
const zip = buildZip(files);
writeFileSync(OUT, zip);

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`project.zip written → ${OUT}`);
console.log(`${files.length} files · ${kb(zip.length)} compressed`);
for (const f of files) {
  console.log("  " + relative(ROOT, f).split(sep).join("/"));
}
