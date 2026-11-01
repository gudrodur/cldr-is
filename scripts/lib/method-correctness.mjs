// How far each method's output is from Node's full ICU. Shared by
// scripts/measure-methods.mjs, which records it, and test/methods.test.ts, which
// fails when the record no longer matches. One definition, so the table and its
// check cannot part company.
//
// Divergence counts are deterministic: the value sweep is a fixed seeded
// sequence, so a changed count means a package or ICU changed.

import { format as dateFnsFormat } from "date-fns/format";
import { is as dateFnsIs } from "date-fns/locale/is";
import dayjs from "dayjs";
import "dayjs/locale/is.js";

const NAMES = ["Ævar", "Anna", "Ari", "Örvar", "Sigríður", "Tómas", "Unnur", "Vala", "Þórður", "Ýrr"];

function latinLetters() {
  const letters = [];
  for (const [from, to] of [
    [0x41, 0x5a],
    [0x61, 0x7a],
    [0xc0, 0xff],
    [0x100, 0x24f],
  ]) {
    for (let cp = from; cp <= to; cp += 1) {
      const ch = String.fromCodePoint(cp);
      if (/\p{L}/u.test(ch)) letters.push(ch);
    }
  }
  return letters;
}

/** Fixed sequence, so a count here is comparable between runs. */
function sweep(count) {
  const values = [];
  let state = 20261101;
  for (let i = 0; i < count; i += 1) {
    state = (Math.imul(state, 48271) + 1) >>> 0;
    const magnitude = 10 ** (state % 10);
    values.push((state / 2 ** 32) * magnitude);
  }
  return values;
}

function countDiffering(values, method, oracle) {
  let differing = 0;
  for (const value of values) {
    if (method(value) !== oracle(value)) differing += 1;
  }
  return { compared: values.length, differing };
}

function pairDivergences(letters, compare, oracle) {
  let divergences = 0;
  for (const a of letters) {
    for (const b of letters) {
      if (Math.sign(compare(a, b)) !== Math.sign(oracle(a, b))) divergences += 1;
    }
  }
  return { compared: letters.length ** 2, divergences };
}

function numbers() {
  const positive = sweep(20000);
  const whole = positive.map((v) => Math.round(v));
  const negative = positive.map((v) => -v - 1);
  const isDecimal = new Intl.NumberFormat("is", { maximumFractionDigits: 2 });
  const isKr = new Intl.NumberFormat("is", { style: "currency", currency: "ISK" });
  const isPercent = new Intl.NumberFormat("is", { style: "percent", maximumFractionDigits: 2 });
  const out = {};
  for (const locale of ["de", "da", "es"]) {
    const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const whole0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
    out[locale] = {
      positive: countDiffering(positive, (v) => decimal.format(v), (v) => isDecimal.format(v)),
      negative: countDiffering(negative, (v) => decimal.format(v), (v) => isDecimal.format(v)),
      kronaWithSuffix: countDiffering(whole, (v) => `${whole0.format(v)}\u00a0kr.`, (v) => isKr.format(v)),
      percent: countDiffering(positive, (v) => percent.format(v / 100), (v) => isPercent.format(v / 100)),
    };
  }
  return out;
}

function dates() {
  const months = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 15, 12));
  const days = Array.from({ length: 7 }, (_, d) => new Date(2026, 5, 7 + d, 12));
  const intl = (options) => {
    const f = new Intl.DateTimeFormat("is", options);
    return (d) => f.format(d);
  };
  const long = intl({ day: "numeric", month: "long", year: "numeric" });
  const short = intl({ day: "numeric", month: "short", year: "numeric" });
  const weekday = intl({ weekday: "long" });
  const dfns = (pattern) => (d) => dateFnsFormat(d, pattern, { locale: dateFnsIs });
  const dj = (pattern) => (d) => dayjs(d).locale("is").format(pattern);
  return {
    "date-fns": {
      longMonth: countDiffering(months, dfns("d. MMMM yyyy"), long),
      shortMonth: countDiffering(months, dfns("d. MMM yyyy"), short),
      weekday: countDiffering(days, dfns("EEEE"), weekday),
    },
    dayjs: {
      longMonth: countDiffering(months, dj("D. MMMM YYYY"), long),
      shortMonth: countDiffering(months, dj("D. MMM YYYY"), short),
      weekday: countDiffering(days, dj("dddd"), weekday),
    },
  };
}

async function collation() {
  const oracle = new Intl.Collator("is");
  // The 36 letters plus the foreign ones Icelandic tails after o and æ, in both
  // cases. A smaller set than the 450 Latin letters, and the one a name list hits.
  const { compareIs, IS_ALPHABET } = await import("../../src/collate.ts");
  const lower = [...IS_ALPHABET, "ä", "ø", "å"].map((c) => c.toLowerCase());
  const alphabet = [...new Set([...lower, ...lower.map((c) => c.toUpperCase())])];
  const latin = latinLetters();
  const expectedNames = [...NAMES].sort(oracle.compare).join(" ");
  const report = (compare) => ({
    alphabet: pairDivergences(alphabet, compare, oracle.compare),
    latin: pairDivergences(latin, compare, oracle.compare),
    nameListCorrect: [...NAMES].sort(compare).join(" ") === expectedNames,
  });

  const out = {};
  for (const locale of ["en", "da", "nb", "sv", "de"]) {
    out[`borrowed-${locale}`] = report(new Intl.Collator(locale).compare);
  }
  out.compareIs = report(compareIs);

  // The polyfill replaces the global, so it is loaded last and only for this
  // comparison. Every native collator above was already constructed.
  const native = Intl.Collator;
  await import("@formatjs/intl-collator/polyfill-force.js");
  const polyfilled = new Intl.Collator("is");
  if (polyfilled.resolvedOptions().locale !== "is") {
    throw new Error("the collator polyfill did not resolve is: nothing was measured");
  }
  out["formatjs-intl-collator"] = report(polyfilled.compare);
  Object.defineProperty(Intl, "Collator", { value: native, configurable: true, writable: true });
  return out;
}

export async function correctness() {
  return { numbers: numbers(), dates: dates(), collation: await collation() };
}
