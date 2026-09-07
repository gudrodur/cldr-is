import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES } from "./country-names.ts";
import { compareIs, IS_ALPHABET } from "../src/collate.ts";

// Every expectation below is computed through Intl.Collator("is") under Node's
// full ICU, so the comparator is pinned to CLDR rather than to the author's
// idea of the Icelandic alphabet. Node is the right oracle precisely because it
// is the runtime that still HAS the data the browsers dropped.
const collator = new Intl.Collator("is");
const icu = (a: string, b: string) => collator.compare(a, b);
const sign = (n: number) => Math.sign(n);

describe("compareIs", () => {
  it("orders the alphabet the way CLDR does, not the way en-US does", () => {
    const scrambled = Array.from("özáaþtæeðd");
    expect(scrambled.slice().sort(compareIs).join("")).toBe("aádðetzþæö");
    // The en-US fallback this replaces, recorded so the difference is visible:
    expect(
      scrambled
        .slice()
        .sort((a, b) => a.localeCompare(b, "en"))
        .join(""),
    ).toBe("aáædðeötzþ");
  });

  it("agrees with ICU on every ordered pair of the alphabet", () => {
    const letters = [...Array.from(IS_ALPHABET), ...Array.from(IS_ALPHABET.toUpperCase())];
    for (const a of letters) {
      for (const b of letters) {
        expect(sign(compareIs(a, b)), `${a} vs ${b}`).toBe(sign(icu(a, b)));
      }
    }
  });

  it("agrees with ICU on the country names the pickers render", () => {
    const names = COUNTRY_NAMES;
    expect(names.slice().sort(compareIs)).toEqual(names.slice().sort(icu));
  });

  it("agrees with ICU on names whose first letter is where the fallback fails", () => {
    const names = [
      "Þórður",
      "Ævar",
      "Örn",
      "Ásta",
      "Ólafur",
      "Úlfur",
      "Ýr",
      "Ína",
      "Einar",
      "Aðalheiður",
    ];
    expect(names.slice().sort(compareIs)).toEqual(names.slice().sort(icu));
    expect(names.slice().sort(compareIs).at(-1)).toBe("Örn");
  });

  it("agrees with ICU on the letters CLDR tailors away from their base letter", () => {
    const odd = [
      ...Array.from("aábdzþæäöøåçñüœß"),
      ...["Bjørn", "Åse", "Müller", "Straße", "Œuvre", "Curaçao"],
    ];
    expect(odd.slice().sort(compareIs)).toEqual(odd.slice().sort(icu));
  });

  it("agrees with ICU on case, digits, spaces and punctuation", () => {
    const mixed = [
      "a",
      "A",
      "aa",
      "aA",
      "Aa",
      "AA",
      "a b",
      "ab",
      "a-b",
      "a_b",
      "2a",
      "10",
      "9",
      "",
    ];
    expect(mixed.slice().sort(compareIs)).toEqual(mixed.slice().sort(icu));
  });

  it("agrees with ICU on 5 000 pseudo-random pairs", () => {
    // Deterministic LCG so a failure is reproducible; the exhaustive 200 000-pair
    // run lives in the PR, not in CI.
    let seed = 20260907;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pool = [
      ...Array.from(IS_ALPHABET),
      ...Array.from(IS_ALPHABET.toUpperCase()),
      ...Array.from("0123456789 _-,.'\"()@&#%+<=>|~$äåøüçñœß"),
    ];
    const word = () =>
      Array.from(
        { length: 1 + Math.floor(next() * 7) },
        () => pool[Math.floor(next() * pool.length)],
      ).join("");
    for (let i = 0; i < 5000; i++) {
      const a = word();
      const b = next() < 0.3 ? a.slice(0, -1) + pool[Math.floor(next() * pool.length)] : word();
      expect(sign(compareIs(a, b)), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(
        sign(icu(a, b)),
      );
    }
  });
});
