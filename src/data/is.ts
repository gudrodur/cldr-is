// Icelandic locale data for the four Intl classes that Chromium-based runtimes
// ship without it. Every import is a side effect: `polyfill-force` replaces the
// GLOBAL class (for every locale, not just `is`), and the locale-data import
// registers the CLDR data on it. Importing this file alone is enough on a
// runtime that formats only Icelandic; a runtime that also formats other
// locales must load their data too, or those locales fall back to the
// polyfill's empty state (see README, "Why polyfill-force").

/* eslint-disable import/no-unassigned-import */
import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/add-golden-tz.js";
import "@formatjs/intl-datetimeformat/locale-data/is.js";
import "@formatjs/intl-numberformat/polyfill-force.js";
import "@formatjs/intl-numberformat/locale-data/is.js";
import "@formatjs/intl-relativetimeformat/polyfill-force.js";
import "@formatjs/intl-relativetimeformat/locale-data/is.js";
import "@formatjs/intl-listformat/polyfill-force.js";
import "@formatjs/intl-listformat/locale-data/is.js";
/* eslint-enable import/no-unassigned-import */
