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

  it("treats canonically equivalent input as equal, the way ICU does", () => {
    // ICU normalises before it compares, so "\u00e1" and "a" + U+0301 are the same
    // string to it. Text really does arrive decomposed — macOS filesystems and
    // some paste sources produce NFD — and a comparator that misses this both
    // splits a name from its own other spelling AND, before the fix, reported two
    // DIFFERENT decomposed letters as equal, because their combining marks shared
    // a fallback weight.
    for (const ch of Array.from(
      "\u00e1\u00e9\u00ed\u00f3\u00fa\u00fd\u00e4\u00f6\u00e5\u00f8\u00fc\u00e7\u00f1\u00c1\u00d3\u00dc",
    )) {
      expect(sign(compareIs(ch, ch.normalize("NFD"))), `${ch} vs NFD`).toBe(0);
    }
    for (const name of ["\u00c1sta", "\u00de\u00f3r\u00f0ur", "\u00c6var", "\u00d6rn"]) {
      expect(sign(compareIs(name, name.normalize("NFD"))), name).toBe(0);
    }
    // The pair that used to tie wrongly: two different letters, both decomposed.
    expect(sign(compareIs("a\u0300", "a\u0301"))).toBe(sign(icu("a\u0300", "a\u0301")));
  });

  it("separates an expansion from what it expands to, on ICU's level", () => {
    // "\u00df" equals "ss" at base sensitivity but not above it, and the level it
    // differs on is SECONDARY, not tertiary — measured through
    // sensitivity: "accent", which has no case level and still separates them.
    // That is why ICU sorts "a\u00df" AFTER "Ass" even though "a" sorts before "A":
    // a secondary difference outranks an earlier case difference. A tertiary
    // marker gets that pair backwards, so this test pins the ordering that
    // distinguishes the two models rather than only the easy "\u00df" vs "ss" pair.
    const family = [
      "ss",
      "sS",
      "Ss",
      "SS",
      "\u00df",
      "\u1e9e",
      "oe",
      "oE",
      "Oe",
      "OE",
      "\u0153",
      "\u0152",
    ];
    expect(family.slice().sort(compareIs)).toEqual(family.slice().sort(icu));
    const straddling = [
      "a\u00df",
      "Ass",
      "\u00dfa",
      "ssA",
      "Stra\u00dfe",
      "Strasse",
      "STRASSE",
      "STRA\u1e9eE",
    ];
    expect(straddling.slice().sort(compareIs)).toEqual(straddling.slice().sort(icu));
    expect(
      sign(compareIs("a\u00df", "Ass")),
      "secondary must outrank the earlier case difference",
    ).toBe(sign(icu("a\u00df", "Ass")));
  });

  it("never reports two different characters as equal", () => {
    // ICU parity outside the Icelandic set is NOT claimed, but a comparator that
    // returns 0 for distinct input is broken whatever the locale: a caller reads
    // 0 as "these are the same" and drops one of them. An earlier version clamped
    // the fallback weight into a 100-wide band, so every character above U+0062 —
    // all of CJK, emoji, symbols and lone surrogates — compared equal to every
    // other, and a sort of them returned its own input order.
    const outside = [
      "\u4e2d",
      "\u6587",
      "\u65e5",
      "\ud83d\ude00",
      "\ud83d\ude01",
      "\u00a7",
      "\u00b6",
      "\u20ac",
      "\u00a3",
      "\u2192",
      "\u03b1",
      "\u0416",
      "\u05d0",
      "\ud800",
      "\udc00",
    ];
    for (const a of outside) {
      for (const b of outside) {
        if (a === b) continue;
        expect(sign(compareIs(a, b)), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).not.toBe(0);
      }
    }
    // Within a band the order is by code POINT, stable whichever way the input
    // happened to be arranged. Note this is not JavaScript's own `<`, which
    // compares UTF-16 code units and puts an astral character before a lone low
    // surrogate. There are two bands on purpose — see the next test.
    for (const band of [
      outside.filter((ch) => /\p{L}/u.test(ch)),
      outside.filter((ch) => !/\p{L}/u.test(ch)),
    ]) {
      const byCodePoint = band.slice().sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
      expect(band.slice().sort(compareIs)).toEqual(byCodePoint);
      expect(band.slice().reverse().sort(compareIs)).toEqual(byCodePoint);
    }
  });

  it("puts an unlisted LETTER after the alphabet, never before it", () => {
    // Both placements are wrong against ICU, but they are not equally wrong in
    // a member list. A name in a script this table does not cover belongs at
    // the bottom, not ahead of "Aðalheiður". Measured over assigned characters
    // this also agrees with ICU far more often than one shared band did
    // (18.5% divergent vs 53.5%; on Latin-plus-CJK-plus-digits, 1.0% vs 37.9%).
    for (const foreign of ["中", "Ж", "א", "α", "ᚠ"]) {
      expect(sign(compareIs(foreign, "Aðalheiður")), foreign).toBe(1);
      expect(sign(compareIs(foreign, "Örn")), foreign).toBe(1);
    }
    // Symbols and emoji keep the low band, which is the side ICU has them on.
    for (const symbol of ["§", "€", "😀"]) {
      expect(sign(compareIs(symbol, "a")), symbol).toBe(sign(icu(symbol, "a")));
    }
  });

  it("agrees with ICU on EVERY ordered pair of Latin letters", () => {
    // The Icelandic alphabet is not the whole of what a member name contains.
    // Polish is the most widely spoken foreign language in Iceland, and before
    // the letter tables "Łukasz" sorted ahead of every Icelandic name because
    // "ł" fell into the fallback band. This walks all 450 Latin letters through
    // Latin Extended-B against the oracle.
    const letters: string[] = [];
    for (const [from, to] of [
      [0x41, 0x5a],
      [0x61, 0x7a],
      [0xc0, 0xff],
      [0x100, 0x24f],
    ]) {
      for (let cp = from!; cp <= to!; cp++) {
        const ch = String.fromCodePoint(cp);
        if (/\p{L}/u.test(ch)) letters.push(ch);
      }
    }
    expect(letters.length).toBeGreaterThan(440);
    for (const a of letters) {
      for (const b of letters) {
        expect(sign(compareIs(a, b)), `${a} (U+${a.codePointAt(0)!.toString(16)}) vs ${b}`).toBe(
          sign(icu(a, b)),
        );
      }
    }
  });

  it("sorts a real multilingual member list exactly as ICU does", () => {
    // The languages actually spoken in Iceland, not a synthetic corpus.
    const names = [
      "Łukasz",
      "Michał",
      "Wojciech",
      "Þórður",
      "Ævar",
      "Örn",
      "Ásta",
      "Ólafur",
      "Aðalheiður",
      "Einar",
      "Úlfur",
      "Ýrr",
      "Ína",
      "Nguyễn",
      "Đặng",
      "Müller",
      "Bjørn",
      "Åse",
      "Ólöf",
      "Šimon",
      "Żaneta",
      "İbrahim",
      "Işık",
      "Márta",
      "Erzsébet",
      "Kļaviņš",
      "Ģirts",
    ];
    expect(names.slice().sort(compareIs)).toEqual(names.slice().sort(icu));
    // The one that motivated the table: not first any more.
    expect(names.slice().sort(compareIs)[0]).toBe("Aðalheiður");
  });

  it("re-derives its three tables from ICU, so a CLDR change fails here", () => {
    // MARK_ORDER, VARIANTS and EXTRA_LETTERS were read off ICU rather than
    // reasoned about. That is only safe if something notices when ICU moves.
    const base = new Intl.Collator("is", { sensitivity: "base" });
    const alphabet = Array.from(IS_ALPHABET);

    // 1. The combining marks are in ICU's secondary order, which is NOT code
    //    point order: U+0306 sorts before U+0302.
    const marks = Array.from({ length: 0x70 }, (_, i) => 0x300 + i);
    const ranked = marks.slice().sort((x, y) => {
      const probe = (m: number) => "n" + String.fromCodePoint(m);
      return icu(probe(x), probe(y)) || x - y;
    });
    const firstFive = ranked.slice(0, 5);
    expect(firstFive, "ICU's mark order moved — re-run the generator").toEqual([
      0x34f, 0x332, 0x313, 0x343, 0x314,
    ]);
    expect(sign(icu("n\u0306", "n\u0302")), "breve before circumflex, not code-point order").toBe(
      -1,
    );

    // 2. Every letter the tables place is still placed there by ICU.
    for (const [variant, letter] of [
      ["ł", "l"],
      ["đ", "d"],
      ["ħ", "h"],
      ["ſ", "s"],
      ["ä", "æ"],
      ["ø", "ö"],
    ]) {
      expect(base.compare(variant!, letter!), `${variant} shares ${letter}'s primary`).toBe(0);
    }
    // 3. And every letter with its own primary still has one.
    for (const extra of ["ı", "ŋ", "ĸ", "ŧ", "å"]) {
      expect(
        alphabet.some((l) => base.compare(extra, l) === 0),
        `${extra} has its own primary`,
      ).toBe(false);
    }
  });

  it("pins where the combining-mark ranks stop applying", () => {
    // The mark order is read off ICU, but it is only reached through the
    // decompose-to-a-base path in weigh(), which needs NFC to compose the base
    // and its mark back into ONE code point. That holds for every letter the
    // Icelandic alphabet uses and for the accented Latin letters around it.
    // It does not hold for a base with no precomposed form.
    expect("a\u0306".normalize("NFC")).toBe("\u0103"); // composes -> ordered by rank
    expect("n\u0306".normalize("NFC")).toBe("n\u0306"); // does not -> fallback band

    // Composing bases: ICU parity.
    for (const [a, b] of [
      ["a\u0306", "a\u0302"],
      ["o\u0307", "o\u0304"],
      ["u\u030A", "u\u0308"],
    ]) {
      expect(sign(compareIs(a!, b!)), `${a} vs ${b}`).toBe(sign(icu(a!, b!)));
    }

    // Non-composing base: NOT claimed, and this pins that it is a known limit
    // rather than something that silently changed. Measured 2026-09-08: 37.8%
    // of the 112x112 mark pairs on such a base diverge.
    expect(sign(compareIs("n\u0306", "n\u0302"))).toBe(1);
    expect(sign(icu("n\u0306", "n\u0302"))).toBe(-1);
  });

  it("agrees with ICU on 20 000 pseudo-random pairs, decomposed forms included", () => {
    // Deterministic LCG so a failure is reproducible. The pool is every character
    // the parity claim covers; the wider full-Unicode sweep lives in the PR,
    // because outside this set ICU parity is explicitly not claimed.
    let seed = 20260907;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pool = [
      ...Array.from(IS_ALPHABET),
      ...Array.from(IS_ALPHABET.toUpperCase()),
      ...Array.from("0123456789 _-,.'\"()@&#%+<=>|~$äåøüçñœßẞáéíóúýÁÉÍÓÚÝ"),
    ];
    const word = () =>
      Array.from(
        { length: 1 + Math.floor(next() * 7) },
        () => pool[Math.floor(next() * pool.length)],
      ).join("");
    // Half the strings are decomposed, so the NFD path is exercised at scale
    // rather than only on the hand-picked letters above.
    const maybeDecompose = (value: string) => (next() < 0.5 ? value.normalize("NFD") : value);
    for (let i = 0; i < 20000; i++) {
      const a = maybeDecompose(word());
      const b = maybeDecompose(
        next() < 0.3 ? a.slice(0, -1) + pool[Math.floor(next() * pool.length)] : word(),
      );
      expect(sign(compareIs(a, b)), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(
        sign(icu(a, b)),
      );
    }
  });
});
