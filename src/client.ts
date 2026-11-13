// The browser polyfill: load formatjs's `is` data lazily, behind a
// shouldPolyfill gate so only Chromium-based browsers pay for it.
//
// KEPT, BUT NOT THE USUAL RECOMMENDATION. The application this came from
// shipped it behind a flag, measured it and turned it off: 197,464 B gzip,
// most of it the time-zone table, against 3,086 B for manual formatters that
// also cover collation, which this polyfill does not. See docs/methods.md,
// "Polyfill in the browser".
//
// It is still the right choice if you need arbitrary locales and arbitrary
// option shapes in the browser — which manual formatting cannot give you.

// Browser entry: a lazy loader. Chrome and Edge trim Icelandic from their ICU
// build (Chrome's UI is not translated to it), so on Chromium every Intl
// formatter for `is` resolves to en-US; Firefox and Safari ship full ICU and
// need nothing. formatjs's shouldPolyfill() answers "does THIS runtime lack
// data for this locale", so the data chunk (about 1.1 MB raw, 190 KB gzip,
// most of it time-zone data) is fetched only where it is needed.
//
// Call `await installIcelandicIntl()` before the first render that formats a
// date, or the first client render can disagree with server-rendered markup.

import { shouldPolyfill as shouldPolyfillDateTimeFormat } from "@formatjs/intl-datetimeformat/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillListFormat } from "@formatjs/intl-listformat/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillNumberFormat } from "@formatjs/intl-numberformat/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillRelativeTimeFormat } from "@formatjs/intl-relativetimeformat/should-polyfill.js";

/** True when this runtime lacks Icelandic data for any of the four classes. */
export function needsIcelandicIntl(): boolean {
  return [
    shouldPolyfillDateTimeFormat("is"),
    shouldPolyfillNumberFormat("is"),
    shouldPolyfillRelativeTimeFormat("is"),
    shouldPolyfillListFormat("is"),
  ].some(Boolean);
}

/** Loads the data only when needed. Resolves true if the chunk was installed. */
export async function installIcelandicIntl(): Promise<boolean> {
  if (!needsIcelandicIntl()) return false;
  await import("./data/is.js");
  return true;
}
