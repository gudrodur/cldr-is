# Membership site

The website and member system of an Icelandic political party. It is server-rendered on Cloudflare Workers, serves seven languages and
is Icelandic first. The source is private, so this page gives the approach with
short excerpts.

Read at commit `c623048` on 2026-11-01.

## What it does

| layer | method | detail |
|---|---|---|
| Worker, all `Intl` | [polyfill on the server](../methods.md#polyfill-on-the-server) | `polyfill-force` for dates, numbers, relative time and lists; golden time zones; all seven locales: is, en, pl, es, uk, ru, fil |
| Plural rules | native | correct for all seven and faster |
| Icelandic dates, both sides | [format by hand](../methods.md#format-by-hand) | three modules of 326, 395 and 99 lines, imported by 114 files |
| Icelandic sorting, both sides | [`compareIs`](../methods.md#compareis-by-hand) | the same code as `src/collate.ts` here |
| Browser polyfill | [built and turned off](../methods.md#polyfill-in-the-browser) | `CLIENT_INTL_POLYFILL_ENABLED = false`, about 192 KB gzip |

```ts
// the first import in the Worker entry
import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/add-golden-tz.js";
import "@formatjs/intl-datetimeformat/locale-data/is.js";
// … one locale-data import for each of the seven, for each of the four classes
```

```ts
// what the health endpoint reports
export function icelandicIntlStatus(): { month: string; ok: boolean } {
  const month = new Intl.DateTimeFormat("is", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 11, 7)),
  );
  return { month, ok: month === "desember" };
}
```

## Why it ended up here

The polyfill went in on both sides first. On the browser side it was measured and
removed, because the application only needed a handful of date shapes and the chunk
cost about 192 KB gzip to render them. The server side stayed, because one isolate
serves every language and arbitrary shapes are cheap there. This is the origin of the
main recommendation in this catalogue.

## What it measured

- 26 rendered dates identical between the server and the hydrated browser, with zero
  console errors, in a live check on 2026-09-07.
- The Worker grew from 2,757 KiB to 3,262 KiB gzip with the seven locales
  ([the table](../measurements.md#cost-of-the-workaround-in-one-production-app)).

## What is still open

- Seven `toLocale*(` calls remain in routes and components. They have not been
  classified here, and some may be the non-Icelandic branches its own comments
  describe.
- It sorts in application code. It uses no database collation.

## Relation to this repository

The code in `src/` came from this application, and the shared declarations were still
identical on 2026-11-01. The application has since added four things this repository
does not have: `fromDatetimeLocalValue`, `IS_WEEKDAYS_SHORT`, `formatIsMailDate` and
`formatPublicNumber`. It does not depend on this repository, and it keeps its own copy.
