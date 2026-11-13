#!/usr/bin/env node
// Measures every method in docs/methods.md and writes docs/methods.json.
//
//   npm run measure:methods
//
// Size: esbuild --bundle --minify --format=esm --target=es2022, then gzip -9.
// Correctness: each method against Node's full ICU, which is the oracle because
// Node ships the complete CLDR data the affected runtimes lack.
//
// Two kinds of number, kept apart because they age differently. `correctness`
// depends only on the pinned packages and the ICU in this Node, so
// test/methods.test.ts recomputes it and fails on drift. `size` also depends on
// esbuild and zlib, so it is recorded and not asserted to the byte.
//
// What this cannot measure: whether a borrowed locale exists in a trimmed
// runtime. Node has every locale, so `de` passing here says nothing about Chrome
// or workerd. That was measured in those runtimes and recorded in
// docs/measurements.md, "Borrowing a locale".

import { writeGenerated } from "./lib/write-generated.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, constants } from "node:zlib";
import { build } from "esbuild";

import { correctness } from "./lib/method-correctness.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every bundle is a real entry file's worth of code, so a reader can rerun one by hand. */
const BUNDLES = {
  "manual-format": 'export * from "./src/format.ts";',
  "manual-collate": 'export * from "./src/collate.ts";',
  "manual-format-and-collate": 'export * from "./src/format.ts"; export * from "./src/collate.ts";',
  "formatjs-is-chunk": 'import "./src/data/is.ts";',
  "formatjs-collator": 'import "@formatjs/intl-collator/polyfill-force.js";',
  "date-fns-format-is": `
    import { format } from "date-fns/format";
    import { is } from "date-fns/locale/is";
    export const f = (d) => format(d, "d. MMMM yyyy", { locale: is });`,
  "dayjs-is": `
    import dayjs from "dayjs";
    import "dayjs/locale/is.js";
    export const f = (d) => dayjs(d).locale("is").format("D. MMMM YYYY");`,
};

async function measureBundle(contents) {
  const out = await build({
    stdin: { contents, resolveDir: ROOT, loader: "ts" },
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    write: false,
    logLevel: "silent",
  });
  const code = out.outputFiles[0].contents;
  if (code.length === 0) throw new Error("empty bundle: nothing was measured");
  return {
    rawBytes: code.length,
    gzipBytes: gzipSync(code, { level: constants.Z_BEST_COMPRESSION }).length,
  };
}

const size = {};
for (const [name, contents] of Object.entries(BUNDLES)) {
  size[name] = await measureBundle(contents);
}

const result = {
  generatedBy: "scripts/measure-methods.mjs",
  generatedAt: "",
  node: process.version,
  icu: process.versions.icu,
  cldr: process.versions.cldr,
  size,
  correctness: await correctness(),
};

const status = writeGenerated(join(ROOT, "docs/methods.json"), result);
console.log(
  `docs/methods.json ${status}: ${Object.keys(size).length} bundles sized, ${result.correctness ? "correctness measured" : "no correctness"} (Node ${process.version})`,
);
