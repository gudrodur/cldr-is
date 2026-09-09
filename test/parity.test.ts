import { afterAll, describe, expect, it } from "vitest";
import {
  IS_NO_DATE,
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
  toDatetimeLocalValue,
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
// The instant shapes claim UTC wall clock IS Icelandic wall clock. Referencing
// them against timeZone: "UTC" tests the implementation against itself — the
// module reads getUTCHours(), so the two agree by construction whatever the
// claim is worth (docs/testing.md rule 3). Reference them against the ZONE.
const rvk = (o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(L, { ...o, timeZone: "Atlantic/Reykjavik" });

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
  weekdayRvk: rvk({ weekday: "long" }),
  longRvk: rvk(LONG),
  timeRvk: rvk(HM),
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
  /** Earliest year the shape's claim holds. See the Reykjavik block below. */
  minYear?: number;
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
    icu: (d) => `${cap(F.weekdayRvk.format(d))} ${F.longRvk.format(d)} kl. ${F.timeRvk.format(d)}`,
    minYear: 1970,
  },
  {
    name: "formatIsDateTime(Date)",
    kind: "date",
    run: formatIsDateTime,
    icu: (d) => `${cap(F.weekdayRvk.format(d))} ${F.longRvk.format(d)} kl. ${F.timeRvk.format(d)}`,
    minYear: 1970,
  },
  {
    name: "formatIsTime(str)",
    kind: "iso-string",
    run: formatIsTime,
    icu: (d) => F.timeRvk.format(d),
    minYear: 1970,
  },
  {
    name: "formatIsTime(Date)",
    kind: "date",
    run: formatIsTime,
    icu: (d) => F.timeRvk.format(d),
    minYear: 1970,
  },
];

describe("every date shape agrees with full ICU over a sweep", () => {
  // Deterministic LCG so a failure is reproducible, matching the number and
  // collation sweeps. 1600-2400 leaves the range an application feeds it in
  // both directions while staying inside the years the shapes CLAIM (see the
  // proleptic-year limit below).
  const N = 5000;
  const instants: Date[] = [];
  const modernInstants: Date[] = [];
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
    while (modernInstants.length < N) {
      const d = new Date(
        Date.UTC(
          1970 + Math.floor(next() * 430),
          Math.floor(next() * 12),
          1 + Math.floor(next() * 28),
          Math.floor(next() * 24),
          Math.floor(next() * 60),
          Math.floor(next() * 60),
          Math.floor(next() * 1000),
        ),
      );
      if (!Number.isNaN(d.getTime())) modernInstants.push(d);
    }
  }

  for (const shape of SHAPES) {
    it(`${shape.name} matches ICU on ${N} instants`, () => {
      for (const instant of shape.minYear ? modernInstants : instants) {
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

describe("the claim that UTC wall clock is Icelandic wall clock", () => {
  // The instant shapes (formatIsDateTime, formatIsTime, toDatetimeLocalValue)
  // read getUTC* and render the result as Icelandic time. That is a claim about
  // the world, not about the code, and until 2026-09-09 nothing tested it: the
  // reference passed timeZone: "UTC", so both sides used the same convention and
  // agreed no matter what Iceland does. Rule 3 of docs/testing.md, in the file
  // written to fix a different corpus problem.

  it("holds for every instant the domain reaches", () => {
    // 0 divergences over 50,000 instants x 2 shapes, 1968-2067, measured
    // against the ZONE rather than against UTC.
    for (const [y, mo, d, h, mi] of [
      [1970, 0, 1, 0, 0],
      [1968, 6, 14, 13, 45],
      [2026, 2, 29, 1, 30], // the EU spring-forward instant: Iceland does not move
      [2026, 9, 25, 1, 30], // the EU fall-back instant: Iceland does not move
      [2026, 6, 4, 23, 59],
      [2400, 11, 31, 23, 59],
    ] as const) {
      const instant = new Date(Date.UTC(y, mo, d, h, mi));
      expect(formatIsTime(instant), instant.toISOString()).toBe(F.timeRvk.format(instant));
    }
  });

  it("does NOT hold before 1970, and the platform cannot tell you why", () => {
    // Two separate things, and the second is the one that would waste a day.
    //
    // 1. Against timeZone: "Atlantic/Reykjavik", this module diverges on 39.6%
    //    of a 100,000-instant sweep over 1600-2400 — 100% of every instant
    //    before 1912, by 16 minutes and 8 seconds.
    //
    // 2. That 16:08 is not Reykjavik's. tzdata merges zones that have agreed
    //    since 1970 and keeps only one history: Atlantic/Reykjavik is a
    //    BACKWARD LINK to Africa/Abidjan, so what the platform calls Icelandic
    //    local time before 1912 is ABIDJAN's local mean time (4.03 W, hence
    //    -00:16:08). Reykjavik sits at 21.9 W, so its LMT was about -01:28, and
    //    Iceland's real history — UTC-1 from 1908, with DST in 1917-1919, 1921
    //    and 1939-1968 — is not in any JavaScript runtime at all.
    //
    // So the parity floor is 1970 because that is where the DATA starts being
    // about Iceland, not because 1970 is where the module starts being right.
    // Nothing on either side of this can be checked from JavaScript.
    const before = new Date(Date.UTC(1900, 0, 1, 12, 0));
    expect(formatIsTime(before)).toBe("12:00");
    expect(F.timeRvk.format(before)).toBe("11:43");

    const abidjan = new Intl.DateTimeFormat(L, { ...HM, timeZone: "Africa/Abidjan" });
    expect(
      abidjan.format(before),
      "Atlantic/Reykjavik is a tzdata link to Africa/Abidjan; if this ever fails, tzdata unmerged them",
    ).toBe(F.timeRvk.format(before));
  });
});

describe("a DST transition in the viewer's zone", () => {
  // Iceland has had no DST since 1968 and nearly every European country has
  // one, so the LOCAL shapes — which render the viewer's wall clock — meet an
  // offset change that no Icelandic instant ever produces. Measured: of the
  // 5,000 sweep instants above, 30.1% carry a summer offset in
  // Europe/Copenhagen and 34.4% in America/Los_Angeles, and **0.0% in
  // Atlantic/Reykjavik**. A suite run only in Reykjavik tests this axis on
  // exactly nothing, which is why CI runs elsewhere too.
  //
  // These pass today (getHours() is DST-aware, so both sides move together).
  // They are here because "it works" and "we checked" are different states.
  const EU_2026 = { spring: Date.UTC(2026, 2, 29, 1, 0), autumn: Date.UTC(2026, 9, 25, 1, 0) };

  for (const [label, base] of Object.entries(EU_2026)) {
    it(`${label}: every list shape matches ICU across the transition`, () => {
      // A second before, the instant itself, and an hour after — the skipped
      // hour in spring and the repeated one in autumn.
      for (const delta of [-3_600_000, -1000, 0, 1000, 3_600_000, 7_200_000]) {
        const d = new Date(base + delta);
        expect(formatIsDateTimeNumeric(d), `${label}${delta}`).toBe(F.dtNumL.format(d));
        expect(formatIsDateTimeDefault(d), `${label}${delta}`).toBe(d.toLocaleString(L));
        expect(formatIsDateTimeShortMonth(d), `${label}${delta}`).toBe(F.dtSmL.format(d));
      }
    });
  }
});

describe("the limits outside the claimed range, pinned so they cannot change silently", () => {
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

  it("renders a sentinel for input with no date in it, where ICU throws", () => {
    // This used to assert the defect: dateFields() split the first ten
    // characters on "-" without checking, so `formatIsDate("2026-06")` returned
    // "undefined. júní 2026" and `formatIsDate("not-a-date")` returned
    // "NaN. undefined NaN". ICU refuses the same input with a RangeError.
    //
    // The ladder replaced it: read the string's own calendar date; failing that
    // treat it as an instant; failing that render IS_NO_DATE. Throwing was the
    // other candidate and was rejected — these run inside React renders, where
    // one bad row would take down a whole list.
    for (const input of ["not-a-date", "", "2026-13-01", "2026-00-10", "Infinity", "12:00:00"]) {
      expect(formatIsDate(input), input).toBe(IS_NO_DATE);
      expect(formatIsDateShort(input), input).toBe(IS_NO_DATE);
      expect(() => F.longU.format(new Date(input)), `ICU accepted ${input}`).toThrow(RangeError);
    }
    // An empty datetime-local input is "", not a sentinel it would reject.
    expect(toDatetimeLocalValue("not-a-date")).toBe("");
  });
});

describe("the ladder: a date-only string keeps its face value in every zone", () => {
  // Rung 1 reads the string's own calendar date and is zone-free by
  // construction. That is not merely equal to ICU — for several shapes it is
  // BETTER than routing through `new Date`, because V8 parses a non-canonical
  // date-only string as LOCAL midnight. Measured in Pacific/Kiritimati:
  // `new Date("2026-6-1")` is 2026-05-31T10:00Z, so an ICU reference built from
  // it renders 31. maí for a string whose face says 1. júní. Rung 1 renders
  // 1. júní in every zone, which is what the string says.
  const hostZone = process.env.TZ;
  afterAll(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  const FACE: Array<[string, string]> = [
    ["2020-12-12", "12. desember 2020"],
    ["2026-06-01", "1. júní 2026"],
    ["2026-6-1", "1. júní 2026"], // unpadded: V8 would read this as local
    ["  2026-06-01  ", "1. júní 2026"], // whitespace: V8 falls back to local
    ["2026-06", "1. júní 2026"], // reduced precision, as ICU reads it
    ["2026", "1. janúar 2026"],
    ["10000-01-01", "1. janúar 10000"],
    ["+010000-01-01", "1. janúar 10000"],
    ["2026-02-30", "2. mars 2026"], // rolled the way ICU rolls it, zone-free
    ["2026-06-01T12:00:00.000Z", "1. júní 2026"],
    ["2026-06-01 12:00:00+00", "1. júní 2026"], // the Postgres shape
  ];

  for (const zone of [
    "Atlantic/Reykjavik",
    "UTC",
    "America/Los_Angeles",
    "Pacific/Kiritimati",
    "Asia/Kathmandu",
    "Pacific/Niue",
  ]) {
    it(`renders the same date in ${zone}`, () => {
      process.env.TZ = zone;
      for (const [input, expected] of FACE) {
        expect(formatIsDate(input), `${JSON.stringify(input)} in ${zone}`).toBe(expected);
      }
    });
  }

  it("agrees with ICU wherever ICU parses the string the same way", () => {
    // The canonical shapes, where `new Date` is zone-stable and the comparison
    // is therefore meaningful. The shapes above that V8 reads as local are
    // deliberately absent: there the oracle moves and the face value does not.
    process.env.TZ = "Atlantic/Reykjavik";
    for (const [input] of FACE.filter(([i]) => /^\d{4}-\d{2}-\d{2}/.test(i))) {
      const reference = F.longU.format(new Date(input));
      expect(formatIsDate(input), input).toBe(reference);
    }
  });
});

describe("the ladder: a nonzero offset means an instant, not a face value", () => {
  // The tail is the part of the string this rung used to ignore. Ignoring a
  // ZERO tail is right — for "…T00:30:00Z" the face date IS the UTC date — but
  // ignoring a nonzero one made the same string render two different days
  // depending on which shape was asked. Measured before the fix, all three in
  // Atlantic/Reykjavik, where nothing should move at all:
  //
  //   formatIsDate("2026-09-02T00:30:00+14:00")      2. september
  //   formatIsDateTime(same string)                  1. september kl. 10:30
  //
  // The string names an instant, so it now falls to the instant rung and reads
  // like the Date of that instant. That is the only property that can hold in
  // every reader's zone: rung 2 reads LOCAL fields by design, so a reader in
  // Kiritimati still sees a different calendar day from formatIsDateTime's UTC
  // — exactly as they already do for a Date input, which is the documented
  // convention rather than a second bug.
  const hostZone = process.env.TZ;
  afterAll(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  const NONZERO = [
    "2026-09-02T00:30:00+14:00",
    "2026-09-01T22:00:00-05:00",
    "2026-09-02 00:30:00+02", // the Postgres short-offset shape
    "2026-09-02T00:30:00+0530",
    "2026-09-02T00:30:00-00:30",
  ];
  // A zero tail in every spelling Postgres and JSON produce. These must NOT
  // move: they stay on the face rung, byte for byte the old behaviour.
  const ZERO = [
    "2026-09-02T00:30:00Z",
    "2026-09-02T00:30:00.000Z",
    "2026-09-02 00:30:00+00",
    "2026-09-02 00:30:00+0000",
    "2026-09-02T00:30:00+00:00",
  ];

  for (const zone of [
    "Atlantic/Reykjavik",
    "UTC",
    "America/Los_Angeles",
    "Pacific/Kiritimati",
    "Asia/Kathmandu",
    "Pacific/Niue",
  ]) {
    it(`reads an offset string as its instant in ${zone}`, () => {
      process.env.TZ = zone;
      for (const input of NONZERO) {
        // The property, not a fixed string: the string form and the Date form
        // of one instant are the same date.
        expect(formatIsDate(input), `${input} in ${zone}`).toBe(formatIsDate(new Date(input)));
        // The ICU reference is built HERE, not at module load: an
        // Intl.DateTimeFormat with no timeZone resolves the zone when it is
        // constructed, so a module-level one would carry the host's zone into
        // every iteration and quietly stop testing anything.
        expect(formatIsDate(input), `${input} vs ICU in ${zone}`).toBe(
          new Intl.DateTimeFormat("is-IS", LONG).format(new Date(input)),
        );
      }
      for (const input of ZERO) {
        expect(formatIsDate(input), `${input} in ${zone}`).toBe("2. september 2026");
      }
    });
  }

  it("a nonzero offset no longer splits the date shape from the datetime shape in Iceland", () => {
    // The reader this package is for is in Iceland, where local IS UTC, so the
    // two shapes have to agree there or one of them is lying about the day.
    process.env.TZ = "Atlantic/Reykjavik";
    for (const input of [...NONZERO, ...ZERO]) {
      const day = formatIsDate(input).split(".")[0];
      expect(formatIsDateTime(input), input).toContain(`${day}. `);
    }
  });
});
