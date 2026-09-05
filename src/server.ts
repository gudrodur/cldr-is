// Server-side entry: import ONCE, first thing in the entry module, before
// anything formats. Installs Icelandic data for Intl.DateTimeFormat,
// NumberFormat, RelativeTimeFormat and ListFormat. PluralRules is left native;
// it is correct for `is` on every measured runtime.
//
// Measured 2026-09-05 on workerd 1.20260820.1 and 1.20260826.1 (Cloudflare
// Workers): without this, `new Intl.DateTimeFormat("is").format()` returns
// "December" and resolvedOptions().locale is "en-US". See docs/measurements.md.

import "./data/is.ts";

/** A one-line self-test for a health endpoint: true when Icelandic month names resolve. */
export function icelandicIntlStatus(): { month: string; ok: boolean } {
  const month = new Intl.DateTimeFormat("is", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 11, 7)),
  );
  return { month, ok: month === "desember" };
}
