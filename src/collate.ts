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
// (ä ø å œ ß), both the composed and decomposed spelling of every accented
// letter, ASCII punctuation, case and digits, and 500 000 random strings drawn
// from that set: 407,114 comparisons, no divergence.
//
// The unclaimed edge is characters outside that set — CJK, emoji, unlisted
// symbols — which sort by code point, an order ICU is not promised to agree
// with. What IS guaranteed for them is that two different characters never
// compare equal; see the fallback in `weigh`.
export const IS_ALPHABET = "aábcdðeéfghiíjklmnoópqrstuúvwxyýzþæö";

const PRIMARY = new Map<string, number>();
// The bands are spread far apart on purpose. The fallback band has to hold a
// whole code point (up to U+10FFFF) without colliding with the digits above it,
// so every other band is pushed clear of that range rather than the fallback
// being squeezed into a small one. Squeezing it is what made every unlisted
// character compare equal to every other; see WEIGHT_FALLBACK below.
const WEIGHT_PUNCTUATION = 1_000;
const WEIGHT_FALLBACK = 2_000_000;
const WEIGHT_DIGIT = 4_000_000;
const WEIGHT_LETTER = 5_000_000;

for (const [i, ch] of Array.from(IS_ALPHABET).entries())
  PRIMARY.set(ch, WEIGHT_LETTER + i * 10);

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
  Array.from(ASCII_PUNCTUATION).map((ch, i) => [ch, WEIGHT_PUNCTUATION + i]),
);

const TAILORED = new Map<string, { p: number; s: number }>([
  ["ä", { p: PRIMARY.get("æ")!, s: 1 }],
  ["ø", { p: PRIMARY.get("ö")!, s: 1 }],
  ["å", { p: PRIMARY.get("ö")! + 5, s: 0 }],
]);

// Letters that expand to TWO letters rather than taking a weight of their own:
// at base sensitivity ICU says "œ" equals "oe" and "ß" equals "ss".
//
// They are not equal, though, and the level they differ on is the one that is
// easy to get wrong. Measured: `Intl.Collator("is", { sensitivity: "accent" })`
// — primary plus secondary, no case — already reports "ß" > "ss", so the
// difference is SECONDARY. That is why it beats a case difference earlier in
// the string: ICU sorts "aß" AFTER "Ass" even though lowercase "a" sorts before
// "A". Expanding to plain "ss" and adding a tertiary marker gets that pair
// backwards.
//
// So an expansion rewrites to private-use stand-ins that weigh like the letter
// they replace but carry a secondary mark, rather than to the bare letters.
const EXPANSION_SECONDARY = 1;
const STAND_IN = new Map<string, string>();
let nextStandIn = 0xe000;
function standInFor(letter: string): string {
  const existing = STAND_IN.get(letter);
  if (existing !== undefined) return existing;
  const ch = String.fromCodePoint(nextStandIn++);
  STAND_IN.set(letter, ch);
  return ch;
}
function expansionOf(letters: string): string {
  return Array.from(letters).map(standInFor).join("");
}

const EXPANSIONS: Array<[RegExp, string]> = [
  [/ß/g, expansionOf("ss")],
  [/\u1E9E/g, expansionOf("SS")],
  [/œ/g, expansionOf("oe")],
  [/Œ/g, expansionOf("OE")],
];

function expand(value: string): string {
  let out = value;
  for (const [from, to] of EXPANSIONS) out = out.replace(from, to);
  return out;
}

type Weight = { p: number; s: number; t: number };

// Weights are keyed and cached by CODE POINT, not by string. A sort re-weighs
// the same characters on every one of its O(n log n) comparisons, so the work
// per character has to be a map lookup on a number; building a string, lower-
// casing it and normalising it each time is what makes a hand-written collator
// slow. The cache is bounded by the number of DISTINCT characters a process
// ever sorts — an alphabet, not a data set.
const CACHE = new Map<number, Weight>();
function weighCodePoint(cp: number): Weight {
  const hit = CACHE.get(cp);
  if (hit !== undefined) return hit;
  const w = weigh(String.fromCodePoint(cp));
  CACHE.set(cp, w);
  return w;
}

// The expansion stand-ins never reach `weigh` — they are seeded here, weighing
// as the letter they replace plus the secondary mark that separates "ß" from
// "ss". Seeded after `weigh` is defined, and read only from inside a function.
for (const [letter, standIn] of STAND_IN) {
  const base = weigh(letter);
  CACHE.set(standIn.codePointAt(0)!, { ...base, s: base.s + EXPANSION_SECONDARY });
}

// Letters outside the alphabet (ü, ç, ñ …) sort next to the base letter they
// decompose to, separated only at the secondary level — the way ICU treats an
// accent that is not a letter of the locale.
function weigh(ch: string): Weight {
  const lower = ch.toLowerCase();
  // 0 for lowercase and caseless characters, 1 for uppercase. ICU's default
  // caseFirst: false puts lowercase first at the tertiary level.
  const t = ch === lower ? 0 : 1;
  const tailored = TAILORED.get(lower);
  if (tailored) return { ...tailored, t };
  const known = PRIMARY.get(lower);
  if (known !== undefined) return { p: known, s: 0, t };

  const [base, ...marks] = Array.from(lower.normalize("NFD"));
  const baseWeight = base === undefined ? undefined : PRIMARY.get(base);
  if (baseWeight !== undefined) {
    return { p: baseWeight, s: marks.reduce((n, m) => n + m.codePointAt(0)!, 1), t };
  }
  if (lower >= "0" && lower <= "9") return { p: WEIGHT_DIGIT + lower.codePointAt(0)!, s: 0, t };
  const punctuation = PUNCTUATION.get(lower);
  if (punctuation !== undefined) return { p: punctuation, s: 0, t };
  // Anything left — CJK, emoji, unlisted symbols — keeps a stable order by code
  // point above the punctuation we know and below the digits. Exact ICU parity
  // for those is not claimed; see the note on ASCII_PUNCTUATION. What IS
  // claimed is the code-point order, so the code point must survive into the
  // weight: an earlier version clamped it to `Math.min(cp, 99)` to stay inside
  // a 100-wide band, which gave every character above U+0062 the same weight
  // and made them all compare EQUAL — CJK, emoji, symbols and lone surrogates
  // alike. Two distinct characters returning 0 is worse than an order ICU
  // disagrees with, because a caller reads 0 as "these are the same".
  return { p: WEIGHT_FALLBACK + lower.codePointAt(0)!, s: 0, t };
}

// Two cheap tests decide whether a string needs any preparation at all. An
// ordinary Icelandic name matches neither and goes straight to weighing.
//
// The normalisation is not decoration. ICU normalises its input, so "á" and
// "a" + U+0301 are the SAME string to it and compare equal. Weighing raw code
// points made them differ — and worse, two different decomposed letters
// compared EQUAL to each other, because their combining marks both landed in
// the fallback bucket. Text arrives decomposed from macOS filesystems and from
// some paste sources, so this is a real input, not a theoretical one.
const COMBINING = /\p{M}/u;
const EXPANDING = /[ßœŒ\u1E9E]/;

function toNfc(value: string): string {
  return COMBINING.test(value) ? value.normalize("NFC") : value;
}

export function compareIs(a: string, b: string): number {
  // Canonically equivalent input must compare equal, so both sides are composed
  // before anything else looks at them.
  const na = toNfc(a);
  const nb = toNfc(b);
  const A = EXPANDING.test(na) ? expand(na) : na;
  const B = EXPANDING.test(nb) ? expand(nb) : nb;
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
    if (tertiary === 0) tertiary = wa.t - wb.t;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  // A prefix sorts before the longer string it is a prefix of.
  if (i < A.length) return 1;
  if (j < B.length) return -1;
  if (secondary || tertiary) return secondary || tertiary;

  // Everything above ties. Two strings can still differ here — an expansion
  // makes "ß" equal to "ss" at every level ICU compares them on, and ICU then
  // separates them below that, ordering the single letter AFTER the pair it
  // expands to. Comparing the composed originals by code point gives exactly
  // that order, and gives 0 for the case this level exists to protect: input
  // that was only ever the same string spelled two ways.
  return na === nb ? 0 : na < nb ? -1 : 1;
}
