// Icelandic date formatting without Intl, pinned to CLDR.
//
// COPY THIS FILE if you would rather hand-write than depend on a package —
// that is a supported way to use this repo, and for dates and numbers it is a
// reasonable choice. What is worth taking with you is not the code, which is
// thirty lines you could write yourself, but three things that are easy to get
// wrong and invisible when you do:
//
//   1. IS_MONTHS_SHORT is CLDR's abbreviated set, with the periods where CLDR
//      puts them and none on "maí". date-fns disagrees (mars, apríl, júní,
//      júlí, ágúst, sept.), so copying from there diverges.
//   2. The date+time shapes read the viewer's LOCAL parts, because a bare
//      toLocaleString passes no timeZone. Reaching for getUTCHours() because
//      "Iceland is UTC anyway" is correct in Iceland and wrong for every
//      reader outside it, and no test written in Iceland will catch it.
//   3. Date-only strings ("2020-12-12") are read by their parts, never through
//      new Date(), which parses them as UTC midnight and can shift a day.
//
// Then pin whatever you write against Node's full ICU — see test/format.test.ts.
// getDay() 0 = Sunday; getMonth() 0 = January.

export const IS_WEEKDAYS = [
  "Sunnudagur",
  "Mánudagur",
  "Þriðjudagur",
  "Miðvikudagur",
  "Fimmtudagur",
  "Föstudagur",
  "Laugardagur",
];

export const IS_MONTHS = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
];

// Abbreviated (CLDR "short" width) Icelandic month names — what
// Intl.DateTimeFormat month: "short" renders for `is` ("sep.", "maí" keeps no
// period).
export const IS_MONTHS_SHORT = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "maí",
  "jún.",
  "júl.",
  "ágú.",
  "sep.",
  "okt.",
  "nóv.",
  "des.",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

// Whole calendar-date fields from a Date or an ISO/date string. A string is
// read by its first ten characters so a date-only value ("2020-12-12") cannot
// shift a day through a timezone; a Date is read with LOCAL fields, which is
// what toLocaleDateString renders in the browser and how formatIsDate has
// always behaved. Shared by every date-only shape so they all treat their
// input identically.
type DateFields = { year: number; monthIndex: number; day: number };

// The value every shape renders when it cannot read a date at all. Chosen over
// throwing (one bad row would take down a whole list render, and these run
// inside React renders) and over an empty string (a blank cell cannot be told
// from a missing value). ICU throws for the same input; this does not, and that
// is a deliberate divergence, pinned in the tests.
export const IS_NO_DATE = "—";

// A date-only string, read by its parts. Zone-free by construction: the string
// carries a calendar date and nothing else, so there is no instant to convert
// and no zone to convert it in.
//
// Accepts what the callers actually produce: YYYY-MM-DD, the same with an
// unpadded month or day, a reduced-precision YYYY-MM or YYYY (which ICU reads
// as the first of the month and the first of the year), and any of those
// followed by a time — the "T" form, the Postgres space form, an offset. It
// deliberately does NOT accept a month of 13: that looks like a date and is not,
// and letting it through is how "1. undefined 2026" reached a page. A day the
// month does not have IS accepted and rolled forward, because that is what ICU
// does with the same string and because rolling here is zone-free — leaving it
// to the instant rung below would roll it too, only in the reader's zone, so the
// answer would depend on which rung fired.
const DATE_ONLY = /^\+?(\d{4,6})(?:-(\d{1,2})(?:-(\d{1,2}))?)?(?:[T ].*)?$/;

function parseDateOnly(input: string): DateFields | null {
  const match = DATE_ONLY.exec(input.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] === undefined ? 1 : Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Read the fields back off a UTC construction, so an over-long day rolls the
  // way ICU rolls it and every reader sees the same answer. setUTCFullYear is
  // needed because Date.UTC maps years 0-99 into 1900+.
  const rolled = new Date(Date.UTC(year, month - 1, day));
  rolled.setUTCFullYear(year, month - 1, day);
  if (Number.isNaN(rolled.getTime())) return null;
  return {
    year: rolled.getUTCFullYear(),
    monthIndex: rolled.getUTCMonth(),
    day: rolled.getUTCDate(),
  };
}

// Whole calendar-date fields from a Date or a string. A Date is read with LOCAL
// fields, which is what toLocaleDateString renders in the browser and how
// formatIsDate has always behaved. A string is read by its parts first, and only
// if that fails is it treated as an instant — with LOCAL fields, so that one
// instant renders as one date whichever shape it arrived in. Returns null when
// there is no date in the input at all. Shared by every date-only shape so they
// all treat their input identically.
function dateFields(input: string | Date): DateFields | null {
  if (typeof input === "string") {
    const parsed = parseDateOnly(input);
    if (parsed) return parsed;
    const instant = new Date(input.trim());
    if (Number.isNaN(instant.getTime())) return null;
    return {
      year: instant.getFullYear(),
      monthIndex: instant.getMonth(),
      day: instant.getDate(),
    };
  }
  if (Number.isNaN(input.getTime())) return null;
  return { year: input.getFullYear(), monthIndex: input.getMonth(), day: input.getDate() };
}

// UTC date+time fields. Rendered in UTC — Iceland (Atlantic/Reykjavik) is
// UTC+0 year-round, so UTC wall-clock IS Icelandic wall-clock regardless of
// where the Worker/browser runs. Shared by every date+time shape; the same
// reasoning formatIsDateTime documents.
type UtcDateTimeFields = DateFields & {
  weekday: number;
  hours: number;
  minutes: number;
  seconds: number;
};
function utcDateTimeFields(input: string | Date): UtcDateTimeFields | null {
  const d = typeof input === "string" ? new Date(input.trim()) : input;
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getUTCFullYear(),
    monthIndex: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  };
}

// LOCAL date+time fields of a Date or an ISO string. The three *list* shapes
// below (DateTimeNumeric/DateTimeDefault/DateTimeShortMonth) replace client
// toLocaleString("is-IS") calls that passed NO timeZone option, so they must
// render what the viewer's browser rendered: local wall-clock — for an
// Icelander that is UTC, for anyone else their own zone. The instant-shaped
// formatters in this module (formatIsDateTime, formatIsTime,
// toDatetimeLocalValue) deliberately stay on UTC fields: Iceland is UTC+0
// year-round, so a governance instant must read as Icelandic wall-clock no
// matter where the server or a reader sits. Two conventions in one module, on
// purpose.
type LocalDateTimeFields = DateFields & { hours: number; minutes: number; seconds: number };
function localDateTimeFields(input: string | Date): LocalDateTimeFields | null {
  const d = typeof input === "string" ? new Date(input.trim()) : input;
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    monthIndex: d.getMonth(),
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
  };
}

// "12. desember 2020" from a Date or an ISO string. Date-only strings
// ("2020-12-12") are parsed by their parts to avoid a timezone shifting the day.
export function formatIsDate(input: string | Date): string {
  const f = dateFields(input);
  if (!f) return IS_NO_DATE;
  return `${f.day}. ${IS_MONTHS[f.monthIndex]} ${f.year}`;
}

// "Mánudagur 12. desember 2020 kl. 20:00" from a timestamptz ISO string or Date.
// Rendered in UTC — Iceland (Atlantic/Reykjavik) is UTC+0 year-round, so UTC
// wall-clock IS Icelandic wall-clock regardless of where the Worker/browser runs.
export function formatIsDateTime(input: string | Date): string {
  const f = utcDateTimeFields(input);
  if (!f) return IS_NO_DATE;
  return `${IS_WEEKDAYS[f.weekday]} ${f.day}. ${IS_MONTHS[f.monthIndex]} ${f.year} kl. ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2026-06-30T09:00" — value for an <input type="datetime-local"> from a
// timestamptz ISO string or Date. UTC parts (Iceland = UTC year-round), so the
// picker shows Icelandic wall-clock and parsing it back as UTC round-trips. Empty
// string for null (a draft has no publish time).
export function toDatetimeLocalValue(input: string | Date | null): string {
  if (!input) return "";
  const f = utcDateTimeFields(input);
  // An empty string, not IS_NO_DATE: this feeds an <input type="datetime-local">,
  // whose empty state is "" and which would reject anything else.
  if (!f) return "";
  return `${f.year}-${pad2(f.monthIndex + 1)}-${pad2(f.day)}T${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "20:00" — clock time only, same UTC-is-Icelandic-wall-clock reasoning as above.
export function formatIsTime(input: string | Date): string {
  const f = utcDateTimeFields(input);
  if (!f) return IS_NO_DATE;
  return `${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2.9.2026" — the un-optioned is-IS short date: day and month carry no
// leading zero. What toLocaleDateString("is-IS") renders with Icelandic data.

export function formatIsDateShort(input: string | Date): string {
  const f = dateFields(input);
  if (!f) return IS_NO_DATE;
  return `${f.day}.${f.monthIndex + 1}.${f.year}`;
}

// "02.09.2026" — zero-padded day and month: the { day: "2-digit",
// month: "2-digit", year: "numeric" } option shape.
export function formatIsDateNumeric(input: string | Date): string {
  const f = dateFields(input);
  if (!f) return IS_NO_DATE;
  return `${pad2(f.day)}.${pad2(f.monthIndex + 1)}.${f.year}`;
}

// "02.09.2026, 12:07" — zero-padded date plus hour:minute (the day: "2-digit",
// month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
// } option shape. Renders the VIEWER's local wall-clock: a bare toLocaleString
// passes no timeZone, so this is what the reader saw.
export function formatIsDateTimeNumeric(input: string | Date): string {
  const f = localDateTimeFields(input);
  if (!f) return IS_NO_DATE;
  return `${pad2(f.day)}.${pad2(f.monthIndex + 1)}.${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2.9.2026, 12:07:07" — the un-optioned toLocaleString("is-IS") default: the
// short date plus a time with seconds. Renders the VIEWER's local wall-clock.
export function formatIsDateTimeDefault(input: string | Date): string {
  const f = localDateTimeFields(input);
  if (!f) return IS_NO_DATE;
  return `${f.day}.${f.monthIndex + 1}.${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}:${pad2(f.seconds)}`;
}

// "2. sep. 2026" — numeric day with the abbreviated month: the
// { day: "numeric", month: "short", year: "numeric" } option shape.
export function formatIsDateShortMonth(input: string | Date): string {
  const f = dateFields(input);
  if (!f) return IS_NO_DATE;
  return `${f.day}. ${IS_MONTHS_SHORT[f.monthIndex]} ${f.year}`;
}

// "2. sep. 2026, 12:07" — the short-month date plus hour:minute: the
// { day: "numeric", month: "short", year: "numeric", hour: "2-digit",
// minute: "2-digit" } option shape. Renders the VIEWER's local wall-clock.
export function formatIsDateTimeShortMonth(input: string | Date): string {
  const f = localDateTimeFields(input);
  if (!f) return IS_NO_DATE;
  return `${f.day}. ${IS_MONTHS_SHORT[f.monthIndex]} ${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// Rounds the shortest decimal representation of a positive non-integer to at
// most three fraction digits, half away from zero — Intl.NumberFormat's default
// roundingMode. Returns the integer and fraction parts, the fraction absent
// when it rounds away entirely.
function roundDecimal(abs: number): [string, string | undefined] {
  const text = String(abs);
  // Exponent form only appears here below 1e-6, and every such value rounds to
  // zero at three fraction digits.
  if (text.includes("e")) return ["0", undefined];

  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length <= 3) return [whole, fraction || undefined];

  let kept = fraction.slice(0, 3);
  if (Number(fraction[3]) >= 5) {
    // Carry, digit by digit, so the increment happens in decimal and never in
    // binary. A carry off the front lands on the integer part.
    const bumped = (BigInt(whole + kept) + 1n).toString().padStart(whole.length + 3, "0");
    return [bumped.slice(0, -3), bumped.slice(-3).replace(/0+$/, "") || undefined];
  }
  kept = kept.replace(/0+$/, "");
  return [whole, kept || undefined];
}

// "1.234.567,89" — what a bare toLocaleString("is-IS") renders with Icelandic
// data: "." for thousands, "," for decimals, at most three fraction digits.
// Pinned to Node full ICU across the whole double range in test/format.test.ts,
// not only over the amounts an application is likely to pass.
export function formatIsNumber(value: number): string {
  // ICU renders the non-finite values as words of its own, and "Infinity" is
  // not one of them.
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";

  // Negative zero keeps its sign, as toLocaleString("is-IS") renders it
  // ("-0"); value < 0 alone misses -0 (which is not less than zero).
  const negative = value < 0 || Object.is(value, -0);
  const abs = Math.abs(value);

  let intPart: string;
  let fracPart: string | undefined;
  if (Number.isInteger(abs)) {
    // Two traps live in this branch, and both only show up above the magnitudes
    // an ISK amount ever reaches — which is exactly why they survived. String()
    // switches to exponent notation at 1e21 ("1e+21" where ICU writes the
    // twenty-two digits), and multiplying by 1000 to get the fraction rounding
    // pushes a large integer through a value the double cannot represent, so
    // 1e20 came back as 99.999.999.999.999.980.000.
    //
    // Note what ICU does NOT do here: it writes the SHORTEST digits that
    // round-trip to the double and pads the rest with zeros, so 1.23e22 renders
    // as 123 followed by twenty zeros. BigInt(abs) would write the double's
    // exact value instead — ...001.048.576 — which is arithmetically truer and
    // is not what toLocaleString returns.
    if (Number.isSafeInteger(abs)) {
      intPart = String(abs);
    } else {
      const [mantissa = "0", exponent = "0"] = abs.toExponential().split("e");
      intPart = mantissa.replace(".", "").padEnd(Number(exponent) + 1, "0");
    }
  } else {
    // At most three fraction digits, the ICU default. The rounding is done on
    // the DECIMAL string rather than by multiplying by 1000, because the
    // multiplication is itself a lossy double operation: 812432265405282.6
    // came out as …,8 where ICU renders …,6. String(abs) is the shortest
    // decimal that round-trips to this double, which is the same number ICU
    // rounds, so rounding that string cannot disagree with it.
    [intPart = "0", fracPart] = roundDecimal(abs);
  }

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = negative ? "-" : "";
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`;
}

