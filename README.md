# cldr-is

A catalogue of ways to get Icelandic dates, numbers and sorting right in
JavaScript on the runtimes that ship without the data, with a measurement beside
each one. It is written for Icelandic developers.

**It is not an npm package and will not become one** (decided 2026-11-01,
[#23](https://github.com/gudrodur/cldr-is/issues/23)). The code in `src/` is here
to be read, copied and measured. The repository keeps its name because its URLs
are already in use.

### → [Does your browser speak Icelandic?](https://gudrodur.github.io/cldr-is/)

Twelve checks that run in whichever browser opens the page. Open it in Chrome and
in Firefox to see the problem in ten seconds.

## The problem

Chromium keeps only minimal locale data for languages its own UI is not
translated into, and Icelandic is one of them. Code that passes `"is"` to `Intl`
gets English back, with no error:

```js
new Date(2026, 11, 7).toLocaleDateString("is", { month: "long" }); // "December"
(1234567.89).toLocaleString("is");                                 // "1,234,567.89"
["Örvar", "Þórður", "Ævar"].sort(new Intl.Collator("is").compare); // wrong order
```

| runtime | what fails | how it was measured |
|---|---|---|
| Cloudflare Workers | everything except plural rules, for **every visitor** of a server-rendered page | bare `workerd` and a real deployed Worker |
| Chrome and Edge on the desktop | nearly everything (Edge sorts correctly) | this machine, and reports through the page |
| Chromium browsers on Android | the króna symbol only: `2.500 ISK` | reports through the page, explained by Chromium's build filters |
| Firefox, Safari, everything on iOS, Node | nothing | reports through the page |

Your tests can pass while production is wrong, because Node has the full data. If
you develop in Firefox, you will not see it at all.

The reasoning, the evidence and the corrections are in
[docs/research.md](docs/research.md). The raw tables are in
[docs/measurements.md](docs/measurements.md).

## The methods

Full detail, code and traps for each one: **[docs/methods.md](docs/methods.md)**.
Sizes are gzip, for what a reader would actually ship, and come from
`npm run measure:methods`, which writes [docs/methods.json](docs/methods.json).

### Dates and numbers

| method | added size | correct? | measured? |
|---|---|---|---|
| [Format by hand](docs/methods.md#format-by-hand) | **1,361 B** | yes, for the shapes you write | yes |
| [Polyfill on the server](docs/methods.md#polyfill-on-the-server) | 0 B to the browser, about 500 KiB gzip on the Worker | yes, every shape | yes, in production |
| [Polyfill in the browser](docs/methods.md#polyfill-in-the-browser) | **197,464 B**, Chromium visitors only | yes, every shape | yes, then turned off |
| [Format on the server, send strings](docs/methods.md#format-on-the-server-and-send-strings) | 0 B | as correct as the server | size by construction, not in production |
| [Run SSR on a full-ICU runtime](docs/methods.md#run-ssr-on-a-full-icu-runtime) | 0 B | yes, server output only | Node's output yes, not as a deployment |
| [date-fns `is`](docs/methods.md#date-fns-and-dayjs) | **7,181 B** | short months differ from CLDR, 6 of 12 | yes |
| [dayjs `is`](docs/methods.md#date-fns-and-dayjs) | **4,099 B** | short months differ from CLDR, 11 of 12 | yes |
| [Borrow `de` or `da` for numbers](docs/methods.md#borrow-a-locale-for-numbers) | 0 B | plain numbers and króna yes, percent no | yes, on Chrome and `workerd` |

### Sorting

| method | added size | divergent Latin letter pairs, of 202,500 | measured? |
|---|---|---|---|
| [`compareIs`, by hand](docs/methods.md#compareis-by-hand) | **1,813 B** | **0** | yes |
| [`@formatjs/intl-collator`](docs/methods.md#formatjsintl-collator) | **808,896 B** | 25,766 (12.7%) | yes |
| [Native, gated on support](docs/methods.md#native-gated-on-support) | 1,813 B as the fallback | 0, and faster where native exists | partly |
| [Borrow `da`, `nb` or `sv`](docs/methods.md#borrow-a-collator) | 0 B | 3,160 to 5,876, and a name list comes out wrong | yes, **do not use** |
| [Sort in the database](docs/methods.md#sort-in-the-database) | 0 B | unknown | **no** |
| [ICU4X](docs/methods.md#icu4x) | unknown | unknown | **no** |

## How to choose

1. **Server-rendered on Workers?** That is the largest problem, since it reaches
   every visitor. Polyfill on the server, or format by hand on both sides.
2. **Dates, numbers and sorting in the browser?** Format by hand. It is 64× smaller
   than the browser polyfill and it covers sorting, which the polyfill does not.
3. **Many locales or arbitrary option shapes in the browser?** That is the case the
   browser polyfill still wins.
4. **Whichever you pick:** [pin it to Node](docs/methods.md#pin-it-to-node) and run
   the suite in more than one time zone. Your browser cannot tell you whether the
   Icelandic is right, and that check matters more than the choice of method.

## What two production sites do

They reached different answers to the same problem, and each has gaps worth
learning from.

- **[Membership site](docs/worked-examples/membership-site.md):** polyfill on the
  server for seven languages, Icelandic by hand on both sides, and the browser
  polyfill built and then turned off.
- **[Cooperative site](docs/worked-examples/cooperative-site.md):** no polyfill, one hand
  written date module and a guard that bans `Intl` elsewhere. Reading it for this
  catalogue found number and sorting gaps, which that page describes.

## Copying the code

- [`src/format.ts`](src/format.ts) and [`src/collate.ts`](src/collate.ts) import
  nothing, and a test keeps it so. Copy them along with the matching tests in
  [`test/`](test/).
- [`src/server.ts`](src/server.ts) and [`src/client.ts`](src/client.ts) need the
  `@formatjs` packages at the versions in [`package.json`](package.json).

The licence is MIT.

## Add to this

A method missing from the tables, a measurement of one marked **no**, or a runtime
nobody has reported belongs here. Open an issue, or open
[the page](https://gudrodur.github.io/cldr-is/) in that runtime and send the report.
A number needs its method and date beside it, because that is what makes a
catalogue like this one worth trusting. The history in
[docs/testing.md](docs/testing.md) shows what went wrong when one did not.

```bash
npm ci
npm test                  # the methods, pinned to Node's full ICU
npm run measure:methods   # rewrites docs/methods.json only if an answer changed
npm run probe             # bare workerd; needs wrangler on PATH
```

## Names

The repo and package were renamed `intl-is` -> `cldr-is` on 2026-09-09. The
report collector Worker and its D1 database keep the old name, `intl-is-reports`,
on purpose: a Worker name is a hostname and does not redirect, and the demo page
posts to it. A local checkout may also still sit in a directory called `intl-is`.
Details in [`CLAUDE.md`](CLAUDE.md).
