// Icelandic collation without Intl.
//
// The part of the gap a polyfill closes worst. On Chromium-based browsers and
// on workerd, `localeCompare(_, "is")` falls back to en-US collation: it sorts
// `ö z á a þ t æ e ð d` as `aáædðeötzþ` where Icelandic order is `aádðetzþæö`.
//
// There IS a polyfill — @formatjs/intl-collator, on npm since 2026-05-14. This
// comment claimed there was none until 2026-09-08, which was asserted rather
// than checked. Measured against native Intl.Collator("is") under Node full
// ICU: it gets an ordinary Icelandic name list right, diverges on 10 of 5,473
// alphabet-and-tailored pairs (all on ä/ø/å), diverges on 25,766 of 202,500
// Latin letter pairs (12.7%), and costs 707,603 B gzip against this file's
// 1,710 B. Its own README says full CLDR/UCA data compilation is still future
// work, which is what those numbers are.
//
// Icelandic treats á é í ó ú ý ð þ æ ö as LETTERS IN THEIR OWN RIGHT, not as
// accented variants — which is exactly what a fallback collation gets wrong.
// Measured over nine names, Icelandic against en-US:
//
//   is     Anna Ari Sigríður Tómas Unnur Vala Þórður Ævar Örvar
//   en-US  Ævar Anna Ari Örvar Sigríður Tómas Unnur Vala Þórður
//
// Ævar goes from last to FIRST (en-US reads Æ as AE) and Örvar from ninth to
// fourth. Those two are the defect; everything else shifts by a place or two.
//
// These lines used to say "Þórður belongs near the end of a name list; en-US
// puts it among the T's, and Ævar lands second instead of second-to-last."
// Every clause of that was wrong and none of it was ever run: en-US sorts Þ
// after T, U, V AND Z, so Þórður stays at the end in both — it is the letter
// that moves LEAST — and Ævar lands first, not second. The example picked the
// weakest case and then described it backwards.
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
// An unlisted LETTER sorts after the alphabet, not before it. Both are wrong
// against ICU, but they are not equally wrong in a member list: a name in a
// script this table does not cover should land at the bottom, not ahead of
// "Aðalheiður". It also happens to move CJK to the side of Latin that ICU puts
// it on. Symbols and emoji keep the low band, which is where ICU has them.
const WEIGHT_UNLISTED_LETTER = 6_000_000;

for (const [i, ch] of Array.from(IS_ALPHABET).entries()) PRIMARY.set(ch, WEIGHT_LETTER + i * 10);

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

const TAILORED = new Map<string, { p: number; s: number }>();

// Latin letters that are NOT Icelandic and that the decompose-to-a-base rule
// below would put in the wrong place. Both tables are READ OFF ICU, and the
// test re-derives them, so a CLDR change fails CI instead of going unnoticed.
//
// This is not academic tidiness. Every one of these used to land in the
// FALLBACK band, which sits below every letter — so "Łukasz" and "Michał"
// sorted ahead of every Icelandic name in the list. Polish is the most widely
// spoken foreign language in Iceland, so that is ordinary member data, not an
// edge case. The obscure entries came free with the same derivation; drawing a
// line through the table by hand is how the next gap gets made.
//
// VARIANTS share an alphabet letter's PRIMARY and differ at the secondary, in
// the order listed. "ä" belongs to "æ" rather than to "a", which is exactly the
// kind of thing the decompose rule gets wrong.
const VARIANTS =
  "\u00E6:\u00E4\u01DF \u00F6:\u022B\u00F8\u01FF d:\u0111 h:\u0127 l:\u0142\u0140 s:\u017F";
// EXTRA_LETTERS have a primary of their OWN, immediately after the named
// letter. The letter band leaves 9 slots between neighbours and the largest
// group here needs 7.
const EXTRA_LETTERS =
  "\u00F6:\u00E5\u01FB\u01C0\u01C1\u01C2\u01C3 i:\u0133\u0131\u0268\u0269 q:\u0239\u024B\u0138 \u00FE:\u01BF\u01BB\u01A8\u01BD\u0185\u0242\u0149 n:\u01CC\u0272\u019E\u0235\u014B t:\u01BE\u0167\u2C66\u01AB\u01AD\u0288\u0236 b:\u0180\u0253\u0183 c:\u023C\u0188 \u00F0:\u0256\u0257\u018C\u0221 z:\u018D\u01B6\u0225\u0240\u0292\u01EF\u01B9\u01BA f:\u0192 h:\u0195 k:\u0199 l:\u01C9\u019A\u0234\u019B g:\u01E5\u0260\u0263\u01A3 p:\u01A5 s:\u023F\u0283\u01AA y:\u024F\u01B4\u021D d:\u0238\u01F3\u01C6 e:\u0247\u01DD\u0259\u025B o:\u0254\u0275\u0223 j:\u0237\u0249 r:\u0280\u024D u:\u0289\u026F\u028A v:\u028B\u028C a:\u2C65";

// A variant sorts after every ACCENTED form of the same letter — ICU gives
// "l ĺ ľ ļ ł ŀ" — so its secondary has to sit above anything secondaryOf can
// return, not start from 1.
const VARIANT_SECONDARY = 1_000_000;
for (const entry of VARIANTS.split(" ")) {
  const [letter = "", list = ""] = entry.split(":");
  const p = PRIMARY.get(letter)!;
  for (const [i, ch] of Array.from(list).entries()) {
    TAILORED.set(ch, { p, s: VARIANT_SECONDARY + i });
  }
}
for (const entry of EXTRA_LETTERS.split(" ")) {
  const [letter = "", list = ""] = entry.split(":");
  const p = PRIMARY.get(letter)!;
  for (const [i, ch] of Array.from(list).entries()) PRIMARY.set(ch, p + i + 1);
}

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
//
// The stand-ins are real code points, so a caller who passes one gets the
// letter's weight instead of the fallback band: measured, 12 code points from
// U+E000 are allocated (6 before the ligatures below joined), and inside that
// window `compareIs("\uE000", "ß")` is -1 where ICU is +1. Left alone
// deliberately — the window is private-use, no keyboard or data source
// produces it, and non-equality still holds. Recorded so it is not
// rediscovered as a bug; if a real input ever lands there, allocate from a
// plane nothing round-trips instead of widening this comment.
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

// The Latin ligatures U+FB00-FB06 expand the same way, but at a different
// level, and the level is measured rather than assumed. Under
// `sensitivity: "accent"` ICU ties six of the seven with the letters they
// expand to — so their difference is BELOW secondary, i.e. tertiary — while
// "ﬅ" separates at accent and belongs with the "ß" group above. Getting that
// backwards is visible in one pair: ICU sorts "aﬁ" BEFORE "Afi" (the ﬁ/fi
// difference is tertiary, so the case difference at position 1 decides), and a
// secondary mark would reverse it, exactly the way a tertiary mark reverses
// "aß" vs "Ass".
//
// Why these seven and nothing else. There are 136 code points whose NFKD is
// two or more ASCII letters — Roman numerals, ₨, ℡, the CJK squared units —
// and 118 of them sort somewhere ICU does not put them. (125 before the seven
// below were fixed; the difference IS the seven. The first version of this
// comment shipped 125 in the same commit that made it wrong, because the
// number was measured before the change and copied in after.) That class wants
// a derived table of the same kind as TAILORED, and it is not this change.
// These seven are here on a reachability argument the others do not have: PDF
// text extraction emits ligature glyphs verbatim, so "Ólaﬁsdóttir" is what a
// pasted name actually looks like, and a name is what this collator is for.
const EXPANSION_TERTIARY = 1;
const TERTIARY_STAND_IN = new Map<string, string>();
function tertiaryStandInFor(letter: string): string {
  const existing = TERTIARY_STAND_IN.get(letter);
  if (existing !== undefined) return existing;
  const ch = String.fromCodePoint(nextStandIn++);
  TERTIARY_STAND_IN.set(letter, ch);
  return ch;
}
function tertiaryExpansionOf(letters: string): string {
  return Array.from(letters).map(tertiaryStandInFor).join("");
}

const EXPANSIONS: Array<[RegExp, string]> = [
  [/ß/g, expansionOf("ss")],
  [/\u1E9E/g, expansionOf("SS")],
  [/œ/g, expansionOf("oe")],
  [/Œ/g, expansionOf("OE")],
  [/\uFB05/g, expansionOf("st")],
  [/\uFB00/g, tertiaryExpansionOf("ff")],
  [/\uFB01/g, tertiaryExpansionOf("fi")],
  [/\uFB02/g, tertiaryExpansionOf("fl")],
  [/\uFB03/g, tertiaryExpansionOf("ffi")],
  [/\uFB04/g, tertiaryExpansionOf("ffl")],
  [/\uFB06/g, tertiaryExpansionOf("st")],
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

// Same, one level down: the ligature stand-ins weigh as the letter they replace
// plus the tertiary mark that separates "ﬁ" from "fi".
for (const [letter, standIn] of TERTIARY_STAND_IN) {
  const base = weigh(letter);
  CACHE.set(standIn.codePointAt(0)!, { ...base, t: base.t + EXPANSION_TERTIARY });
}

// Letters outside the alphabet (ü, ç, ñ …) sort next to the base letter they
// decompose to, separated only at the secondary level — the way ICU treats an
// accent that is not a letter of the locale.
// ICU's secondary order for combining marks, READ OFF ICU rather than reasoned
// about — and it is emphatically NOT code-point order. U+0306 (breve) sorts
// before U+0302 (circumflex) despite the higher code point, the way "_" sorts
// before "-" at the primary level. Groups separated by a space are
// secondary-EQUAL to each other; ICU distinguishes 59 ranks among these 112
// marks, and an implementation that invents its own order gets pairs like
// "ô" vs "ŏ" backwards.
//
// Verified base-independent across n s z g r t k m p, and re-derived from ICU
// by the test, so a CLDR change fails CI rather than going unnoticed. The
// marks Icelandic turns into LETTERS (á é í ó ú ý ö, and the tailored ä å ø)
// never reach here — they are matched by PRIMARY and TAILORED first, which is
// what makes one base-independent table enough.
const MARK_ORDER =
  "\u034F \u0332 \u0313\u0343 \u0314 \u0301\u0341 \u0300\u0340 \u0306 \u0302 \u030C \u030A \u0342 \u0308 \u0344 \u030B \u0303 \u0307 \u0338 \u0327 \u0328 \u0304 \u030D\u030E\u0312\u0315\u031A\u033D\u033E\u033F\u0346\u034A\u034B\u034C\u0350\u0351\u0352\u0357\u035B\u035D\u035E \u0316\u0317\u0318\u0319\u031C\u031D\u031E\u031F\u0320\u0329\u032A\u032B\u032C\u032F\u0333\u033A\u033B\u033C\u0347\u0348\u0349\u034D\u034E\u0353\u0354\u0355\u0356\u0359\u035A\u035C\u035F\u0362 \u0336\u0337 \u0335 \u0305 \u0309 \u030F \u0310 \u0311 \u031B \u0321 \u0322 \u0323 \u0324 \u0325 \u0326 \u032D \u032E \u0330 \u0331 \u0334 \u0339 \u0345 \u0358 \u0360 \u0361 \u0363 \u0368 \u0369 \u0364 \u036A \u0365 \u036B \u0366 \u036C \u036D \u0367 \u036E \u036F";
const MARK_RANK = new Map<number, number>();
for (const [rank, group] of MARK_ORDER.split(" ").entries()) {
  for (const ch of group) MARK_RANK.set(ch.codePointAt(0)!, rank + 1);
}
const MARK_RANK_UNKNOWN = MARK_ORDER.split(" ").length + 1;

// Marks compare POSITIONALLY, first difference wins — the same rule as the
// primary level — so the ranks are folded into one number in order rather than
// added together. Summing the code points, which is what this used to do, made
// any two letters whose marks happened to sum alike interchangeable.
// Marks compare position by position, and a FIXED width is what makes that
// work. Folding only the marks present makes any longer sequence sort after any
// shorter one, which is wrong whenever the longer one differs earlier: "ǡ" is
// a + U+0307 + U+0304 and "ā" is a + U+0304, and since U+0307 outranks U+0304
// ICU puts "ǡ" FIRST. Padding with zero — a value no mark can take, since ranks
// start at 1 — gives the positional comparison for free.
//
// Three positions is the cap, which also keeps every result below
// VARIANT_SECONDARY. A Latin letter carrying more than three combining marks is
// not a name.
const MARK_POSITIONS = 3;
function secondaryOf(marks: string[]): number {
  let secondary = 0;
  for (let i = 0; i < MARK_POSITIONS; i++) {
    const mark = marks[i];
    const rank =
      mark === undefined ? 0 : (MARK_RANK.get(mark.codePointAt(0)!) ?? MARK_RANK_UNKNOWN);
    secondary = secondary * 64 + rank;
  }
  return secondary;
}

function weigh(ch: string): Weight {
  const lower = ch.toLowerCase();
  // 0 lowercase or caseless, 1 titlecase, 2 uppercase. ICU's default
  // caseFirst: false puts lowercase first at the tertiary level. The middle
  // rank is not padding: the Serbo-Croatian digraphs have THREE case forms
  // (\u01C4 \u01C5 \u01C6), and a binary rank cannot separate the first two.
  const t = ch === lower ? 0 : ch === ch.toUpperCase() ? 2 : 1;
  const tailored = TAILORED.get(lower);
  if (tailored) return { ...tailored, t };
  const known = PRIMARY.get(lower);
  if (known !== undefined) return { p: known, s: 0, t };

  const [base, ...marks] = Array.from(lower.normalize("NFD"));
  const baseWeight = base === undefined ? undefined : PRIMARY.get(base);
  if (baseWeight !== undefined) {
    return { p: baseWeight, s: secondaryOf(marks), t };
  }
  if (lower >= "0" && lower <= "9") return { p: WEIGHT_DIGIT + lower.codePointAt(0)!, s: 0, t };
  const punctuation = PUNCTUATION.get(lower);
  if (punctuation !== undefined) return { p: punctuation, s: 0, t };
  if (LETTER.test(lower)) return { p: WEIGHT_UNLISTED_LETTER + lower.codePointAt(0)!, s: 0, t };
  // Anything left — emoji, unlisted symbols — keeps a stable order by code
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
const LETTER = /\p{L}/u;
const EXPANDING = /[ßœŒ\u1E9E\uFB00-\uFB06]/;

function toNfc(value: string): string {
  return COMBINING.test(value) ? value.normalize("NFC") : value;
}

// Composed, then rewritten if it holds an expanding letter. Both tests are
// cheap and an ordinary Icelandic name matches neither.
function prepare(value: string): string {
  const composed = toNfc(value);
  return EXPANDING.test(composed) ? expand(composed) : composed;
}

// Everything above ties. Two strings can still differ here — an expansion makes
// "ß" equal to "ss" at every level ICU compares them on, and ICU then separates
// them below that, ordering the single letter AFTER the pair it expands to.
// Comparing the composed originals by code point gives exactly that order, and
// gives 0 for the case this level exists to protect: input that was only ever
// the same string spelled two ways.
function breakTie(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compareIs(a: string, b: string): number {
  // Canonically equivalent input must compare equal, so both sides are composed
  // before anything else looks at them.
  const A = prepare(a);
  const B = prepare(b);
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
  return secondary || tertiary || breakTie(toNfc(a), toNfc(b));
}
