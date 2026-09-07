// Icelandic collation without Intl.
//
// This is the one part of the gap a polyfill CANNOT close: formatjs ships no
// Collator polyfill, so on Chromium-based browsers and on workerd
// `localeCompare(_, "is")` falls back to en-US collation and there is nothing
// to install. It sorts `ö z á a þ t æ e ð d` as `aáædðeötzþ`; Icelandic order
// is `aádðetzþæö`.
//
// Icelandic treats á é í ó ú ý ð þ æ ö as LETTERS IN THEIR OWN RIGHT, not as
// accented variants — which is exactly what a fallback collation gets wrong.
// Þórður belongs near the end of a name list; en-US puts it among the T's, and
// Ævar lands second instead of second-to-last.
//
// Pinned to Node full ICU in test/collate.test.ts rather than to taste. Parity
// was measured over every ordered pair of the alphabet in both cases, 253
// Icelandic country names, the letters CLDR tailors away from their base letter
// (ä ø å œ ß), ASCII punctuation, case and digits, and 200 000 random strings
// drawn from the whole character set: no divergence. The unclaimed edge is
// characters outside that set — CJK, emoji, unlisted symbols — which get a
// stable code-point order ICU is not promised to agree with.
export const IS_ALPHABET = "aábcdðeéfghiíjklmnoópqrstuúvwxyýzþæö";

const PRIMARY = new Map<string, number>();
for (const [i, ch] of Array.from(IS_ALPHABET).entries()) PRIMARY.set(ch, 1000 + i * 10);

// The letters CLDR's Icelandic tailoring places somewhere OTHER than next to
// the letter they decompose to, measured against Node full ICU:
//   a á b ç d é ñ œ ß ü z þ æ ä ö ø å
// ä and ø are primary-equal to æ and ö (they differ only at the secondary
// level); å is a primary of its own AFTER them; œ is a primary of its own just
// after o. Everything else — ç ñ ü é and friends — decomposes to its base
// letter and needs no entry here.
// ICU's default for `is` is non-ignorable — "a b" sorts before "ab" — and it
// orders punctuation by DUCET category, not by code point ("_" before "-" even
// though "_" is U+005F and "-" is U+002D). This is the order Node full ICU
// produces for the ASCII set, read off rather than reasoned about. Characters
// outside it fall back to code-point order, which is stable but not ICU-exact.
const ASCII_PUNCTUATION = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";
const PUNCTUATION = new Map<string, number>(
  Array.from(ASCII_PUNCTUATION).map((ch, i) => [ch, 100 + i]),
);

const TAILORED = new Map<string, { p: number; s: number }>([
  ["ä", { p: PRIMARY.get("æ")!, s: 1 }],
  ["ø", { p: PRIMARY.get("ö")!, s: 1 }],
  ["å", { p: PRIMARY.get("ö")! + 5, s: 0 }],
]);

// Letters that expand to two at the primary level (measured: base sensitivity
// says "œ" equals "oe" and "ß" equals "ss"), so they are rewritten before
// weighing rather than given a weight of their own.
const EXPANSIONS: Array<[RegExp, string]> = [
  [/ß/g, "ss"],
  [/œ/g, "oe"],
  [/Œ/g, "Oe"],
];

function expand(value: string): string {
  let out = value;
  for (const [from, to] of EXPANSIONS) out = out.replace(from, to);
  return out;
}

type Weight = { p: number; s: number };

// Weights are keyed and cached by CODE POINT, not by string. A sort re-weighs
// the same characters on every one of its O(n log n) comparisons, so the work
// per character has to be a map lookup on a number; building a string, lower-
// casing it and normalising it each time is what makes a hand-written collator
// slow. The cache is bounded by the number of DISTINCT characters a process
// ever sorts — an alphabet, not a data set.
const CACHE = new Map<number, Weight>();
const CASE_FOLD = new Map<number, number>();
function weighCodePoint(cp: number): Weight {
  const hit = CACHE.get(cp);
  if (hit !== undefined) return hit;
  const ch = String.fromCodePoint(cp);
  const w = weigh(ch);
  CACHE.set(cp, w);
  CASE_FOLD.set(cp, ch.toLowerCase().codePointAt(0)!);
  return w;
}

// Letters outside the alphabet (ü, ç, ñ …) sort next to the base letter they
// decompose to, separated only at the secondary level — the way ICU treats an
// accent that is not a letter of the locale.
function weigh(ch: string): Weight {
  const lower = ch.toLowerCase();
  const tailored = TAILORED.get(lower);
  if (tailored) return tailored;
  const known = PRIMARY.get(lower);
  if (known !== undefined) return { p: known, s: 0 };

  const [base, ...marks] = Array.from(lower.normalize("NFD"));
  const baseWeight = base === undefined ? undefined : PRIMARY.get(base);
  if (baseWeight !== undefined) {
    return { p: baseWeight, s: marks.reduce((n, m) => n + m.codePointAt(0)!, 1) };
  }
  if (lower >= "0" && lower <= "9") return { p: 500 + lower.codePointAt(0)!, s: 0 };
  const punctuation = PUNCTUATION.get(lower);
  if (punctuation !== undefined) return { p: punctuation, s: 0 };
  // Anything left — CJK, emoji, unlisted symbols — keeps a stable order by code
  // point above the punctuation we know and below the digits. Exact ICU parity
  // for those is not claimed; see the note on ASCII_PUNCTUATION.
  return { p: 400 + Math.min(lower.codePointAt(0)!, 99), s: 0 };
}

// Only strings that actually contain an expanding letter pay for the rewrite.
const EXPANDING = /[ßœŒ]/;

// 0 for lowercase and caseless characters, 1 for uppercase. ICU's default
// caseFirst: false puts lowercase first at the tertiary level.
function caseRank(cp: number): number {
  return cp === (CASE_FOLD.get(cp) ?? cp) ? 0 : 1;
}

export function compareIs(a: string, b: string): number {
  const A = EXPANDING.test(a) ? expand(a) : a;
  const B = EXPANDING.test(b) ? expand(b) : b;
  let i = 0;
  let j = 0;
  let secondary = 0;
  let tertiary = 0;
  while (i < A.length && j < B.length) {
    const ca = A.codePointAt(i)!;
    const cb = B.codePointAt(j)!;
    const wa = weighCodePoint(ca);
    const wb = weighCodePoint(cb);
    if (wa.p !== wb.p) return wa.p < wb.p ? -1 : 1;
    if (secondary === 0) secondary = Math.sign(wa.s - wb.s);
    if (tertiary === 0) tertiary = caseRank(ca) - caseRank(cb);
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  // A prefix sorts before the longer string it is a prefix of.
  if (i < A.length) return 1;
  if (j < B.length) return -1;
  return secondary || tertiary;
}
