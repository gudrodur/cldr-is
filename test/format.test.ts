import { describe, expect, it } from "vitest";
import {
  formatIsDate,
  formatIsDateNumeric,
  formatIsDateShort,
  formatIsDateShortMonth,
  formatIsDateTimeDefault,
  formatIsDateTimeNumeric,
  formatIsDateTimeShortMonth,
  formatIsNumber,
  toDatetimeLocalValue,
} from "../src/format.ts";

describe("formatIsDate", () => {
  it("formats an ISO date-only string in Icelandic", () => {
    expect(formatIsDate("2020-12-12")).toBe("12. desember 2020");
    expect(formatIsDate("2019-05-19")).toBe("19. maí 2019");
    expect(formatIsDate("2024-06-15")).toBe("15. júní 2024");
  });

  it("parses date-only strings by parts (no timezone day-shift)", () => {
    // 2020-01-01 must stay 1. janúar regardless of the host timezone — a
    // Date-based parse at UTC midnight can roll back a day in negative offsets.
    expect(formatIsDate("2020-01-01")).toBe("1. janúar 2020");
  });

  it("ignores a time component on a full ISO string", () => {
    expect(formatIsDate("2020-12-12T23:30:00.000Z")).toBe("12. desember 2020");
  });

  it("formats a Date instance", () => {
    expect(formatIsDate(new Date(2021, 6, 4))).toBe("4. júlí 2021");
  });
});

// #1149. The candidate review form pre-filled its reminder times correctly and
// left the meeting start empty, on the same row, from the same variable. That
// split is the signature of a value that survives `.slice(0, 10)` and dies at
// `.slice(0, 16)`: a timestamptz that reached the client as something other
// than an ISO string with a "T". The form used to hand-roll the slice; it now
// goes through this helper, which reconstructs from Date parts and so does not
// care which of these shapes it is given.
//
// The exact shape production emits was NOT pinned down (the row comes from a
// raw db.execute typed `string | null`, and the value crosses a serialization
// boundary before the form sees it). Every shape it could plausibly be is
// covered below instead — including the Date, on which the old `.slice` threw.
describe("toDatetimeLocalValue — every shape a timestamptz can arrive as", () => {
  const EXPECTED = "2026-08-20T17:30";

  it("ISO string with a T and a Z", () => {
    expect(toDatetimeLocalValue("2026-08-20T17:30:00.000Z")).toBe(EXPECTED);
  });

  it("Postgres-style string with a SPACE instead of a T", () => {
    // This is the shape that produced #1149: slice(0, 16) yields
    // "2026-08-20 17:30", DateTimePicker splits on "T" and gets one part, and
    // the date half then fails its ^\d{4}-\d{2}-\d{2}$ guard — while
    // slice(0, 10) is still a clean "2026-08-20", which is exactly why the
    // reminders looked right.
    expect(toDatetimeLocalValue("2026-08-20 17:30:00+00")).toBe(EXPECTED);
  });

  it("a Date instance, which the old slice threw on", () => {
    expect(toDatetimeLocalValue(new Date("2026-08-20T17:30:00.000Z"))).toBe(EXPECTED);
  });

  it("an explicit offset is normalized to Icelandic wall-clock (UTC)", () => {
    expect(toDatetimeLocalValue("2026-08-20T19:30:00+02:00")).toBe(EXPECTED);
  });

  it("null is empty, not the epoch", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
  });

  it("round-trips through the datetime-local parse the form does on submit", () => {
    // The form reads this value back as UTC wall-clock. If the helper and that
    // parse disagreed, a confirmed meeting would land at the wrong hour.
    const local = toDatetimeLocalValue("2026-08-20T17:30:00.000Z");
    expect(new Date(`${local}:00Z`).toISOString()).toBe("2026-08-20T17:30:00.000Z");
  });
});

// The client-side Intl-gap shapes (#1280). Each manual formatter below is
// pinned to the CLDR rendering of the SAME input under Node's full ICU (this
// file imports no polyfill). Two reference conventions, matching the two
// formatter conventions:
//   - the DATE-ONLY shapes read the calendar date of a date-only/ISO string
//     (dateFields' slice guard, #876), so their Intl reference pins
//     timeZone: "UTC" — the string's own calendar date — and the expectation
//     is host-independent;
//   - the date+TIME shapes render the VIEWER's local wall-clock, exactly like
//     the toLocaleString calls they replaced (which passed no timeZone), so
//     their Intl reference uses the host timezone with no timeZone option and
//     the comparison holds on any host.
// The options objects are the exact ones the converted call sites used to pass
// to toLocale(String|Date)(String).
const noonUtcIso = "2026-09-02T12:07:07Z";

describe("numeric date shapes vs the full-ICU Intl output", () => {
  it("formatIsDateShort matches the un-optioned short date", () => {
    const icu = new Date(noonUtcIso).toLocaleDateString("is-IS", { timeZone: "UTC" });
    expect(formatIsDateShort(noonUtcIso)).toBe(icu);
    expect(icu).toBe("2.9.2026");
  });

  it("formatIsDateNumeric matches the 2-digit day/month options", () => {
    const icu = new Date(noonUtcIso).toLocaleDateString("is-IS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(formatIsDateNumeric(noonUtcIso)).toBe(icu);
    expect(icu).toBe("02.09.2026");
  });

  it("formatIsDateTimeNumeric matches the 2-digit date+time options", () => {
    const icu = new Date(noonUtcIso).toLocaleString("is-IS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(formatIsDateTimeNumeric(noonUtcIso)).toBe(icu);
  });

  it("formatIsDateTimeDefault matches the un-optioned locale default", () => {
    const icu = new Date(noonUtcIso).toLocaleString("is-IS");
    expect(formatIsDateTimeDefault(noonUtcIso)).toBe(icu);
  });

  it("formatIsDateShortMonth matches the numeric-day short-month options", () => {
    const icu = new Date(noonUtcIso).toLocaleDateString("is-IS", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(formatIsDateShortMonth(noonUtcIso)).toBe(icu);
    expect(icu).toBe("2. sep. 2026");
  });

  it("formatIsDateTimeShortMonth matches the short-month date+time options", () => {
    const icu = new Date(noonUtcIso).toLocaleString("is-IS", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(formatIsDateTimeShortMonth(noonUtcIso)).toBe(icu);
  });
});

describe("date shapes on a Date instance", () => {
  it("uses the local calendar date of a local-midnight Date", () => {
    // Local-midnight construction keeps the expectation host-timezone
    // independent: the instant carries the intended date in every timezone.
    expect(formatIsDateShort(new Date(1999, 9, 24))).toBe("24.10.1999");
    expect(formatIsDateNumeric(new Date(2026, 8, 2))).toBe("02.09.2026");
    expect(formatIsDateShortMonth(new Date(2026, 8, 2))).toBe("2. sep. 2026");
    expect(formatIsDateShortMonth(new Date(2026, 4, 19))).toBe("19. maí 2026");
  });

  it("date+time shapes render the LOCAL wall-clock of the Date", () => {
    // A local-constructor instant carries fixed LOCAL fields in every host
    // timezone, so these literals fail on any non-UTC host if the shapes were
    // ever switched back to UTC parts (the replaced toLocaleString calls
    // rendered the viewer's local time, not Icelandic wall-clock).
    const d = new Date(1999, 9, 24, 8, 5, 2);
    expect(formatIsDateTimeNumeric(d)).toBe("24.10.1999, 08:05");
    expect(formatIsDateTimeDefault(d)).toBe("24.10.1999, 08:05:02");
    expect(formatIsDateTimeShortMonth(d)).toBe("24. okt. 1999, 08:05");
  });
});

describe("formatIsNumber vs the full-ICU is-IS rendering", () => {
  const cases: number[] = [
    0,
    -0,
    999,
    1000,
    553323,
    1000000,
    24542053,
    500000.5,
    1234.5,
    1234567.89,
    0.5,
    2.5,
    999.99,
    1 / 3,
    12.345678,
    1000.4,
    0.1 + 0.2,
    -0.0001,
    -999,
    -1234567.89,
  ];
  for (const value of cases) {
    it(`renders ${value} as toLocaleString("is-IS") does`, () => {
      expect(formatIsNumber(value)).toBe(value.toLocaleString("is-IS"));
    });
  }

  it("keeps negative zero's sign", () => {
    expect(formatIsNumber(-0)).toBe("-0");
  });

  it("groups four-digit integers (1.000, not 1000)", () => {
    expect(formatIsNumber(1000)).toBe("1.000");
    expect(formatIsNumber(2500)).toBe("2.500");
  });
});
