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
// period).tsx).
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
function dateFields(input: string | Date): DateFields {
  if (typeof input === "string") {
    const [y, m, d] = input.slice(0, 10).split("-").map(Number);
    return { year: y!, monthIndex: m! - 1, day: d! };
  }
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
function utcDateTimeFields(input: string | Date): UtcDateTimeFields {
  const d = typeof input === "string" ? new Date(input) : input;
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
function localDateTimeFields(input: string | Date): LocalDateTimeFields {
  const d = typeof input === "string" ? new Date(input) : input;
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
  const { year, monthIndex, day } = dateFields(input);
  return `${day}. ${IS_MONTHS[monthIndex]} ${year}`;
}

// "Mánudagur 12. desember 2020 kl. 20:00" from a timestamptz ISO string or Date.
// Rendered in UTC — Iceland (Atlantic/Reykjavik) is UTC+0 year-round, so UTC
// wall-clock IS Icelandic wall-clock regardless of where the Worker/browser runs.
export function formatIsDateTime(input: string | Date): string {
  const f = utcDateTimeFields(input);
  return `${IS_WEEKDAYS[f.weekday]} ${f.day}. ${IS_MONTHS[f.monthIndex]} ${f.year} kl. ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2026-06-30T09:00" — value for an <input type="datetime-local"> from a
// timestamptz ISO string or Date. UTC parts (Iceland = UTC year-round), so the
// picker shows Icelandic wall-clock and parsing it back as UTC round-trips. Empty
// string for null (a draft has no publish time).
export function toDatetimeLocalValue(input: string | Date | null): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// "20:00" — clock time only, same UTC-is-Icelandic-wall-clock reasoning as above.
export function formatIsTime(input: string | Date): string {
  const f = utcDateTimeFields(input);
  return `${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2.9.2026" — the un-optioned is-IS short date: day and month carry no
// leading zero. What toLocaleDateString("is-IS") renders with Icelandic data.

export function formatIsDateShort(input: string | Date): string {
  const { year, monthIndex, day } = dateFields(input);
  return `${day}.${monthIndex + 1}.${year}`;
}

// "02.09.2026" — zero-padded day and month: the { day: "2-digit",
// month: "2-digit", year: "numeric" } option shape.
export function formatIsDateNumeric(input: string | Date): string {
  const { year, monthIndex, day } = dateFields(input);
  return `${pad2(day)}.${pad2(monthIndex + 1)}.${year}`;
}

// "02.09.2026, 12:07" — zero-padded date plus hour:minute (the day: "2-digit",
// month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
// } option shape. Renders the VIEWER's local wall-clock: a bare toLocaleString
// passes no timeZone, so this is what the reader saw.
export function formatIsDateTimeNumeric(input: string | Date): string {
  const f = localDateTimeFields(input);
  return `${pad2(f.day)}.${pad2(f.monthIndex + 1)}.${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "2.9.2026, 12:07:07" — the un-optioned toLocaleString("is-IS") default: the
// short date plus a time with seconds. Renders the VIEWER's local wall-clock.
export function formatIsDateTimeDefault(input: string | Date): string {
  const f = localDateTimeFields(input);
  return `${f.day}.${f.monthIndex + 1}.${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}:${pad2(f.seconds)}`;
}

// "2. sep. 2026" — numeric day with the abbreviated month: the
// { day: "numeric", month: "short", year: "numeric" } option shape.
export function formatIsDateShortMonth(input: string | Date): string {
  const { year, monthIndex, day } = dateFields(input);
  return `${day}. ${IS_MONTHS_SHORT[monthIndex]} ${year}`;
}

// "2. sep. 2026, 12:07" — the short-month date plus hour:minute: the
// { day: "numeric", month: "short", year: "numeric", hour: "2-digit",
// minute: "2-digit" } option shape. Renders the VIEWER's local wall-clock.
export function formatIsDateTimeShortMonth(input: string | Date): string {
  const f = localDateTimeFields(input);
  return `${f.day}. ${IS_MONTHS_SHORT[f.monthIndex]} ${f.year}, ${pad2(f.hours)}:${pad2(f.minutes)}`;
}

// "1.234.567,89" — what a bare toLocaleString("is-IS") renders with Icelandic
// data: "." for thousands, "," for decimals, at most three fraction digits.
export function formatIsNumber(value: number): string {
  // Negative zero keeps its sign, as toLocaleString("is-IS") renders it
  // ("-0"); value < 0 alone misses -0 (which is not less than zero).
  const negative = value < 0 || Object.is(value, -0);
  // The ICU default of at most three fraction digits is reproduced by rounding
  // to the nearest thousandth first, so a decimal input renders the same
  // "1.234,568" toLocaleString("is-IS") would.
  const rounded = Math.round(Math.abs(value) * 1000) / 1000;
  const [intPart = "0", fracPart] = String(rounded).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = negative ? "-" : "";
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`;
}

