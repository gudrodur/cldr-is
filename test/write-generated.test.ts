import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { writeGenerated } from "../scripts/lib/write-generated.mjs";

// `npm run measure` used to rewrite generatedAt on every run, so a re-run with
// identical answers dirtied the tree and buried the real diff in a date change.
const file = () => join(mkdtempSync(join(tmpdir(), "gen-")), "out.json");

it("writes a new file with the given date", () => {
  const f = file();
  expect(writeGenerated(f, { a: 1 }, "2026-11-06")).toBe("created");
  expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ generatedAt: "2026-11-06", a: 1 });
});

it("leaves the file byte-identical when only the date would change", () => {
  const f = file();
  writeGenerated(f, { a: 1 }, "2026-11-06");
  const before = readFileSync(f, "utf8");
  expect(writeGenerated(f, { a: 1 }, "2026-12-01")).toBe("unchanged");
  expect(readFileSync(f, "utf8")).toBe(before);
});

it("bumps the date when an answer changes", () => {
  const f = file();
  writeGenerated(f, { a: 1 }, "2026-11-06");
  expect(writeGenerated(f, { a: 2 }, "2026-12-01")).toBe("updated");
  expect(JSON.parse(readFileSync(f, "utf8"))).toEqual({ generatedAt: "2026-12-01", a: 2 });
});

it("overwrites an unparseable existing file", () => {
  const f = file();
  writeFileSync(f, "not json");
  expect(writeGenerated(f, { a: 1 }, "2026-11-06")).toBe("created");
});
