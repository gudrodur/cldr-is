// docs/methods.md and README.md quote docs/methods.json. These tests keep the
// three in step and keep the record honest: correctness is recomputed here, so a
// dependency or ICU upgrade that changes a result fails instead of leaving the
// catalogue quietly wrong. Sizes depend on esbuild and zlib as well, so they are
// checked against the record, not rebuilt.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error a plain .mjs helper shared with scripts/measure-methods.mjs
import { correctness } from "../scripts/lib/method-correctness.mjs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const record = JSON.parse(read("docs/methods.json"));
const bytes = (name: string) => record.size[name].gzipBytes.toLocaleString("en-US") + " B";

describe("docs/methods.json", () => {
  it("records what the methods do now", async () => {
    expect(await correctness()).toEqual(record.correctness);
  }, 120_000);

  it("measured something in every bundle", () => {
    const sizes = Object.values<{ gzipBytes: number }>(record.size);
    expect(sizes.length).toBeGreaterThan(0);
    for (const { gzipBytes } of sizes) expect(gzipBytes).toBeGreaterThan(100);
  });
});

describe("the documents quote the record", () => {
  const quoted = {
    "README.md": ["manual-format", "manual-collate", "formatjs-is-chunk", "formatjs-collator", "date-fns-format-is", "dayjs-is"],
    "docs/methods.md": Object.keys(record.size),
    "docs/research.md": ["manual-format-and-collate", "formatjs-is-chunk", "formatjs-collator"],
    "docs/index.html": ["manual-format-and-collate", "formatjs-is-chunk"],
    "src/client.ts": ["manual-format-and-collate", "formatjs-is-chunk"],
    "src/collate.ts": ["manual-collate", "formatjs-collator"],
  };

  for (const [path, names] of Object.entries(quoted)) {
    it(`${path} carries the current sizes`, () => {
      const text = read(path);
      for (const name of names) expect(text, name).toContain(bytes(name));
    });
  }

  it("README.md carries the Latin divergence count", () => {
    const { latin } = record.correctness.collation["formatjs-intl-collator"];
    expect(read("README.md")).toContain(latin.divergences.toLocaleString("en-US"));
  });
});

describe("retired figures", () => {
  // Superseded on 2026-11-01. They stay in dated history (measurements.md,
  // testing.md, and the note beside the collator table in research.md), and
  // nowhere that states the current cost.
  const retired = ["2,774", "191,966", "707,603", "707 KB", "1,710 B", "69×"];
  for (const path of ["README.md", "docs/methods.md", "docs/index.html", "src/client.ts", "src/collate.ts"]) {
    it(`${path} no longer quotes them`, () => {
      const text = read(path);
      expect(text.length).toBeGreaterThan(1000);
      for (const figure of retired) expect(text, figure).not.toContain(figure);
    });
  }
});

describe("the copy contract", () => {
  for (const path of ["src/format.ts", "src/collate.ts"]) {
    it(`${path} imports nothing, so it can be copied alone`, () => {
      const source = read(path);
      expect(source.length).toBeGreaterThan(1000);
      expect(source).not.toMatch(/^\s*(import|export\s.*\sfrom)\s/m);
    });
  }
});
