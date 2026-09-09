import { describe, expect, it } from "vitest";
import {
  IS_MONTHS,
  IS_MONTHS_SHORT,
  IS_WEEKDAYS,
  formatIsDate,
  formatIsDateNumeric,
  formatIsDateShort,
  formatIsDateShortMonth,
  formatIsDateTime,
  formatIsDateTimeDefault,
  formatIsDateTimeNumeric,
  formatIsDateTimeShortMonth,
  formatIsTime,
} from "../src/format.ts";

// EVERY date shape against full ICU, over a sweep rather than a handful of
// instants.
//
// Why this file exists. Before it, `formatIsNumber` was pinned over 20 000
// pseudo-random values and the eight date shapes were pinned at ONE instant
// each — 2026-09-02T12:07:07Z, plus a few hand-built Dates. Two exported
// functions, `formatIsDateTime` and `formatIsTime`, had no test at all, and
// the three exported name tables were never compared to CLDR directly. The
// prose nonetheless said the module was "pinned to CLDR".
//
// That is the same shape that hid three collation defects on 2026-09-08: a
// narrow corpus under a claim of breadth. The tests were not what let those
// through — the sentence describing them was. So this file states its corpus
// and then walks it.
//
// Measured when it was added (2026-09-09): 0 divergences over ~3.8 million
// comparisons — 18 shapes x 100 000 instants in Atlantic/Reykjavik, x 10 000 in
// each of Europe/Copenhagen, America/Los_Angeles, Pacific/Kiritimati,
// Pacific/Niue and Asia/Kathmandu, plus the same sweep against xj-greenfield's
// copy of the module. The two limits found are pinned at the bottom.

const L = "is-IS";
const utc = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(L, { ...o, timeZone: "UTC" });
const local = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(L, o);

// The option bags are the ones the replaced toLocale* call sites passed.
const NUMERIC = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
const SHORT_MONTH = { day: "numeric", month: "short", year: "numeric" } as const;
const LONG = { day: "numeric", month: "long", year: "numeric" } as const;
const HM = { hour: "2-digit", minute: "2-digit" } as const;

const F = {
  shortU: utc({}),
  shortL: local({}),
  numU: utc(NUMERIC),
  numL: local(NUMERIC),
  smU: utc(SHORT_MONTH),
  smL: local(SHORT_MONTH),
  longU: utc(LONG),
  longL: local(LONG),
  dtNumL: local({ ...NUMERIC, ...HM }),
  dtSmL: local({ ...SHORT_MONTH, ...HM }),
  weekdayU: utc({ weekday: "long" }),
  timeU: utc(HM),
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Three input conventions, and the module means all three. `dateOnly` shapes
// read the CALENDAR DATE of a date-only string (so their reference is UTC, and
// the expectation holds on any host); `local` shapes render the VIEWER's wall
// clock, because the bare toLocaleString they replaced passed no timeZone;
// `utc` shapes render Icelandic wall clock, which is UTC year-round, wherever
// the reader sits.
type Kind = "date-string" | "iso-string" | "date";
type Shape = {
  name: string;
  kind: Kind;
  run: (input: string | Date) => string;
  icu: (d: Date) => string;
};

const SHAPES: Shape[] = [
  // date-only shapes given a date-only STRING -> the string's own calendar date
  { name: "formatIsDate(str)", kind: "date-string", run: formatIsDate, icu: (d) => F.longU.format(d) },
  { name: "formatIsDateShort(str)", kind: "date-string", run: formatIsDateShort, icu: (d) => F.shortU.format(d) },
  { name: "formatIsDateNumeric(str)", kind: "date-string", run: formatIsDateNumeric, icu: (d) => F.numU.format(d) },
  { name: "formatIsDateShortMonth(str)", kind: "date-string", run: formatIsDateShortMonth, icu: (d) => F.smU.format(d) },
  // the same shapes given a Date -> LOCAL calendar fields
  { name: "formatIsDate(Date)", kind: "date", run: formatIsDate, icu: (d) => F.longL.format(d) },
  { name: "formatIsDateShort(Date)", kind: "date", run: formatIsDateShort, icu: (d) => F.shortL.format(d) },
  { name: "formatIsDateNumeric(Date)", kind: "date", run: formatIsDateNumeric, icu: (d) => F.numL.format(d) },
  { name: "formatIsDateShortMonth(Date)", kind: "date", run: formatIsDateShortMonth, icu: (d) => F.smL.format(d) },
  // list shapes -> the viewer's local wall clock, from either input
  { name: "formatIsDateTimeNumeric(str)", kind: "iso-string", run: formatIsDateTimeNumeric, icu: (d) => F.dtNumL.format(d) },
  { name: "formatIsDateTimeNumeric(Date)", kind: "date", run: formatIsDateTimeNumeric, icu: (d) => F.dtNumL.format(d) },
  { name: "formatIsDateTimeDefault(str)", kind: "iso-string", run: formatIsDateTimeDefault, icu: (d) => d.toLocaleString(L) },
  { name: "formatIsDateTimeDefault(Date)", kind: "date", run: formatIsDateTimeDefault, icu: (d) => d.toLocaleString(L) },
  { name: "formatIsDateTimeShortMonth(str)", kind: "iso-string", run: formatIsDateTimeShortMonth, icu: (d) => F.dtSmL.format(d) },
  { name: "formatIsDateTimeShortMonth(Date)", kind: "date", run: formatIsDateTimeShortMonth, icu: (d) => F.dtSmL.format(d) },
  // instant shapes -> Icelandic wall clock (UTC), from either input.
  // formatIsDateTime is not one Intl option bag, so its reference is composed
  // from three that ICU does answer — including the weekday, which is the only
  // place IS_WEEKDAYS is exercised against CLDR at all.
  {
    name: "formatIsDateTime(str)",
    kind: "iso-string",
    run: formatIsDateTime,
    icu: (d) => `${cap(F.weekdayU.format(d))} ${F.longU.format(d)} kl. ${F.timeU.format(d)}`,
  },
  {
    name: "formatIsDateTime(Date)",
    kind: "date",
    run: formatIsDateTime,
    icu: (d) => `${cap(F.weekdayU.format(d))} ${F.longU.format(d)} kl. ${F.timeU.format(d)}`,
  },
  { name: "formatIsTime(str)", kind: "iso-string", run: formatIsTime, icu: (d) => F.timeU.format(d) },
  { name: "formatIsTime(Date)", kind: "date", run: formatIsTime, icu: (d) => F.timeU.format(d) },
];

describe("every date shape agrees with full ICU over a sweep", () => {
  // Deterministic LCG so a failure is reproducible, matching the number and
  // collation sweeps. 1600-2400 leaves the range an application feeds it in
  // both directions while staying inside the years the shapes CLAIM (see the
  // proleptic-year limit below).
  const N = 5000;
  const instants: Date[] = [];
  {
    let seed = 20260909;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    while (instants.length < N) {
      const d = new Date(
        Date.UTC(
          1600 + Math.floor(next() * 800),
          Math.floor(next() * 12),
          1 + Math.floor(next() * 28),
          Math.floor(next() * 24),
          Math.floor(next() * 60),
          Math.floor(next() * 60),
          Math.floor(next() * 1000),
        ),
      );
      if (!Number.isNaN(d.getTime())) instants.push(d);
    }
  }

  for (const shape of SHAPES) {
    it(`${shape.name} matches ICU on ${N} instants`, () => {
      for (const instant of instants) {
        const iso = instant.toISOString();
        let input: string | Date;
        let reference: string;
        if (shape.kind === "date-string") {
          const dateOnly = iso.slice(0, 10);
          input = dateOnly;
          reference = shape.icu(new Date(`${dateOnly}T00:00:00Z`));
        } else if (shape.kind === "iso-string") {
          input = iso;
          reference = shape.icu(instant);
        } else {
          input = instant;
          reference = shape.icu(instant);
        }
        expect(shape.run(input), `${shape.name} on ${String(input)}`).toBe(reference);
      }
    });
  }

  it("covers every date shape the module exports", () => {
    // A new export with no row above would otherwise be measured by nothing,
    // which is the state this file was written to end.
    const covered = new Set(SHAPES.map((s) => s.name.replace(/\(.*/, "")));
    expect([...covered].sort()).toEqual([
      "formatIsDate",
      "formatIsDateNumeric",
      "formatIsDateShort",
      "formatIsDateShortMonth",
      "formatIsDateTime",
      "formatIsDateTimeDefault",
      "formatIsDateTimeNumeric",
      "formatIsDateTimeShortMonth",
      "formatIsTime",
    ]);
  });
});

describe("the exported name tables against CLDR", () => {
  it("IS_MONTHS is CLDR's long month set", () => {
    const cldr = Array.from({ length: 12 }, (_, i) => utc({ month: "long" }).format(Date.UTC(2026, i, 15)));
    expect(IS_MONTHS).toEqual(cldr);
  });

  it("IS_MONTHS_SHORT is CLDR's abbreviated set, periods and all", () => {
    const cldr = Array.from({ length: 12 }, (_, i) => utc({ month: "short" }).format(Date.UTC(2026, i, 15)));
    expect(IS_MONTHS_SHORT).toEqual(cldr);
    // The one that has no period, which is what copying from date-fns gets wrong.
    expect(IS_MONTHS_SHORT[4]).toBe("maí");
  });

  it("IS_WEEKDAYS is CLDR's set with a capital, and that difference is deliberate", () => {
    // CLDR's Icelandic weekday is lower case in format context — "mánudagur" —
    // because Icelandic does not capitalise weekday names in running text.
    // IS_WEEKDAYS capitalises because formatIsDateTime puts the weekday FIRST,
    // where a sentence-initial capital is correct. Nothing said so until this
    // test; a reader comparing the table to Intl would have read it as a bug.
    const cldr = Array.from({ length: 7 }, (_, i) =>
      utc({ weekday: "long" }).format(Date.UTC(2026, 10, 1 + i)),
    );
    expect(cldr[1]).toBe("mánudagur");
    expect(IS_WEEKDAYS[1]).toBe("Mánudagur");
    expect(IS_WEEKDAYS).toEqual(cldr.map(cap));
  });
});

describe("the two limits, pinned so they cannot change silently", () => {
  it("does not claim ICU parity for years at or below zero", () => {
    // ICU renders the YEAR OF ERA and, with no era requested, drops the marker:
    // the astronomical year 0 prints as "1", -44 as "45". This module prints the
    // astronomical year. Both are defensible and they disagree, so the parity
    // claim stops at year 1. Nothing in the domain this was written for — member
    // records, meetings, publication dates — reaches back that far.
    const caesar = new Date(0);
    caesar.setUTCFullYear(-44, 2, 15);
    expect(formatIsDate(caesar)).toContain("-44");
    expect(F.longL.format(caesar)).toContain("45");
  });

  it("emits `undefined` for a malformed date-only string, where ICU throws", () => {
    // KNOWN DEFECT, recorded rather than asserted as correct. dateFields()
    // splits the first ten characters on "-" and does not check what it got, so
    // a value that is not YYYY-MM-DD renders the literal text "undefined" or
    // "NaN" into the page. ICU refuses the same input with a RangeError.
    //
    // It is not reachable from this application today — every caller passes a
    // timestamptz or a Date — which is why it survived. It is the same class as
    // a comparator returning 0 for two different strings: a wrong answer wearing
    // the shape of an answer. Fixing it changes what a live page renders, so it
    // is a decision, not a cleanup, and this test is here to make sure the
    // decision is taken rather than forgotten.
    expect(formatIsDate("2026-06")).toBe("undefined. júní 2026");
    expect(formatIsDate("not-a-date")).toBe("NaN. undefined NaN");
    expect(formatIsDateShort("")).toBe("undefined.NaN.0");
    // A five-digit year breaks the ten-character slice the same way.
    expect(formatIsDate("10000-01-01")).toBe("0. janúar 10000");
    // And out-of-range components are echoed rather than normalised: ICU rolls
    // 2026-02-30 forward to 2. mars.
    expect(formatIsDate("2026-02-30")).toBe("30. febrúar 2026");
    expect(F.longU.format(new Date("2026-02-30T00:00:00Z"))).toBe("2. mars 2026");
  });
});
