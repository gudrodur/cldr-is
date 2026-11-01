# The methods

Each method below says what it costs, what it covers, what goes wrong and whether
that was measured. **Measured** means somebody ran it and the result is recorded.
**Not measured** means exactly that, and such a method is listed because it is a
real option, not because it is known to work.

## How the numbers were taken

Measured 2026-11-01 on Node v24.19.0, ICU 78.3, CLDR 48.0, by
[`scripts/measure-methods.mjs`](../scripts/measure-methods.mjs), which writes
[`methods.json`](methods.json).

- **Size:** esbuild `--bundle --minify --format=esm --target=es2022`, then gzip at
  level 9.
- **Correctness:** compared with Node's full ICU, which has the data the affected
  runtimes lack. `test/methods.test.ts` recomputes these counts and fails when they
  change, so a package upgrade that changes a result cannot pass unnoticed.
- **What Node cannot say:** whether a locale exists in a trimmed runtime. For the
  borrowed locales that was checked on Chrome 156 and bare `workerd`, recorded in
  [measurements.md](measurements.md#borrowing-a-locale).

| bundle | raw | gzip |
|---|---|---|
| `src/format.ts` | 3,881 B | **1,361 B** |
| `src/collate.ts` | 4,060 B | **1,813 B** |
| both | 7,972 B | **3,086 B** |
| formatjs `is` data, `src/data/is.ts` | 1,200,933 B | **197,464 B** |
| `@formatjs/intl-collator` 0.3.1 | 6,093,096 B | **808,896 B** |
| date-fns 4.4.0 `format` with `is` | 25,829 B | **7,181 B** |
| dayjs 1.11.23 with `is` | 9,618 B | **4,099 B** |

---

# Dates and numbers

## Format by hand

Render Icelandic from a month table and a few string joins, and never call `Intl`
for it. Code: [`src/format.ts`](../src/format.ts).

```ts
const IS_MONTHS = ["janúar", "febrúar", "mars", /* … */ "desember"];

export const formatIsDate = (d: Date) =>
  `${d.getUTCDate()}. ${IS_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
```

- **Cost:** 1,361 B, shipped to every visitor including those whose browser was
  fine. No runtime cost beyond a string join: about 80 ns.
- **Covers:** the shapes you wrote and no others.
- **Traps:** the short months are CLDR's and differ from what you would type (`maí`
  has no period). A time-zone choice is yours to make, and getting it wrong makes
  the server and the browser disagree during hydration. The header of
  [`src/format.ts`](../src/format.ts) lists these.
- **Measured:** yes, including in production. Both worked examples use it.

## Polyfill on the server

Load formatjs's data for `is` once per isolate, first thing in the Worker entry.
Code: [`src/server.ts`](../src/server.ts).

```ts
import "@formatjs/intl-datetimeformat/polyfill-force.js";
import "@formatjs/intl-datetimeformat/add-golden-tz.js";
import "@formatjs/intl-datetimeformat/locale-data/is.js";
// the same for numberformat, relativetimeformat and listformat
```

- **Cost:** nothing to the browser. The Worker grew from 2,757 KiB to 3,262 KiB gzip
  with seven locales loaded, measured in one application in
  [measurements.md](measurements.md#cost-of-the-workaround-in-one-production-app).
- **Covers:** every shape and every option. It does **not** cover sorting.
- **Traps:**
  - It must be `polyfill-force`. The runtime has the class and answers in English,
    so the conditional polyfill decides nothing is wrong.
  - `polyfill-force` replaces the global for **every** locale. Load data for every
    language you serve, or they regress. Polish throws a `TypeError`.
  - Leave `PluralRules` native. It is correct and faster.
  - The failure is silent, so report a one-line self-test on a health endpoint, as
    `icelandicIntlStatus()` in [`src/server.ts`](../src/server.ts) does.
- **Measured:** yes, in production ([xj-greenfield](worked-examples/xj-greenfield.md)).

## Polyfill in the browser

The same data, loaded lazily behind a `shouldPolyfill` gate. Code:
[`src/client.ts`](../src/client.ts).

- **Cost:** 197,464 B, most of it a time-zone table. Firefox and Safari visitors
  download none of it. Formatting costs about 800 ns with a reused formatter and
  about 28,000 ns for a `toLocaleString` call that passes options.
- **Covers:** every shape, every option and every locale you load. It does **not**
  cover sorting.
- **Trap:** it must finish loading before the first hydration render, or the browser
  disagrees with the server's markup.
- **Measured:** yes. xj-greenfield built it, measured it and turned it off. It is
  still the right choice when you need many locales or arbitrary option shapes in
  the browser.

## Format on the server and send strings

Keep every formatted date and number on the server, and send the browser text
rather than values to format.

- **Cost:** 0 B for formatting, by construction.
- **Covers:** whatever renders once. It does not help a value that changes in the
  browser, such as a live total or a date picker.
- **Trap:** it only moves the problem. On Workers the server needs one of the other
  methods anyway.
- **Measured:** **not as a whole.** The size is zero by construction, and no site
  here was built this way.

## Run SSR on a full-ICU runtime

Node has the complete data, so a server-rendered page on Node has no server problem.

- **Cost:** 0 B, plus whatever moving off Workers costs you.
- **Covers:** server output only. Code that formats again in the browser still hits
  the browser's gap, and a mismatch shows up during hydration.
- **Measured:** Node's output is the oracle for this whole repository. **A deployment
  built this way is not measured here.**

## date-fns and dayjs

Both have their own Icelandic tables and do not use `Intl`, so they work on every
runtime. They do not agree with CLDR, which matters if anything else on the page
does.

| short month | CLDR | date-fns 4.4.0 | dayjs 1.11.23 |
|---|---|---|---|
| January | `jan.` | `jan.` | `jan` |
| March | `mar.` | `mars` | `mar` |
| April | `apr.` | `apríl` | `apr` |
| May | `maí` | `maí` | `maí` |
| June | `jún.` | `júní` | `jún` |
| July | `júl.` | `júlí` | `júl` |
| August | `ágú.` | `ágúst` | `ágú` |
| September | `sep.` | `sept.` | `sep` |

- **Cost:** 7,181 B for date-fns `format` with `is`, 4,099 B for dayjs with `is`.
- **Covers:** dates only. Long months and weekday names match CLDR in both: 0 of 12
  and 0 of 7 differ. Short months differ in **6 of 12** for date-fns and **11 of 12**
  for dayjs.
- **Trap:** neither is wrong as Icelandic. A page mixing one of them with `Intl`
  output shows two spellings of one month, and a test pinned to Node will fail. More
  in [research.md](research.md#the-trap-next-door-date-fns-is-a-separate-axis).
- **Measured:** yes.

## Borrow a locale for numbers

German and Danish happen to use Icelandic's separators, and desktop Chrome and
`workerd` both carry them.

```ts
const n = new Intl.NumberFormat("de", { maximumFractionDigits: 2 });
n.format(1234567.89);              // "1.234.567,89"
`${n.format(2500)} kr.`;      // "2.500 kr."
```

Over 20,000 fixed values against Node's `is`:

| | `de` | `da` | `es` |
|---|---|---|---|
| positive numbers | 0 differ | 0 differ | 1,973 differ |
| negative numbers | 0 differ | 0 differ | 1,974 differ |
| króna, with the suffix added by hand | 0 differ | 0 differ | 1,974 differ |
| percent | **all differ** | **all differ** | **all differ** |

- **Cost:** 0 B.
- **Covers:** plain numbers and króna, if you add the suffix with its no-break space.
  Percent does not match: `de` gives `12,5 %` and `is` gives `12,5%`.
- **Traps:**
  - Choose carefully. `es` does not group four-digit numbers (`1000`). `nb` and `sv`
    use a no-break space to group and U+2212 for minus.
  - Another country's CLDR data can change independently of Iceland's, and nothing
    would tell you. Pin it in a test.
  - It reads as a bug to the next developer. Put it behind one named function, with
    a comment saying why.
- **Measured:** yes, on Node, Chrome 156 and bare `workerd`. No production site here
  does this.

---

# Sorting

Sorting is the harder half. Icelandic treats á, é, í, ó, ú, ý, ð, þ, æ and ö as
letters in their own right, so a fallback collation puts names in the wrong places.
The server polyfill and the browser polyfill above do not cover it.

## `compareIs`, by hand

A comparator with the Icelandic alphabet's order and fallback tables for the rest of
Latin. Code: [`src/collate.ts`](../src/collate.ts).

```ts
names.sort(compareIs);
```

- **Cost:** 1,813 B. Roughly 2× slower than a native `Intl.Collator`: 17 ms against
  7 ms for 10,000 names.
- **Covers:** 0 divergences over all 202,500 ordered pairs of 450 Latin letters, and
  0 over the Icelandic alphabet in both cases.
- **Trap:** do not write your own from the alphabet alone. The Latin letters it does
  not name are where those attempts go wrong, as
  [research.md](research.md#collation-the-part-no-polyfill-fixes-cheaply) describes.
- **Measured:** yes, including in production.

## `@formatjs/intl-collator`

A polyfill for the `Intl.Collator` class.

- **Cost:** 808,896 B for version 0.3.1.
- **Covers:** an ordinary name list comes out right. It differs from ICU on 24 of
  6,084 pairs of the Icelandic alphabet plus ä, ø and å, and on 25,766 of 202,500
  Latin pairs (12.7%). Its README says complete CLDR collation data is future work.
- **Measured:** yes. This method was not written down before 2026-11-01, and the
  earlier single-run figures are in [research.md](research.md).

## Native, gated on support

Use the runtime's collator where it really has Icelandic, and `compareIs` where it
does not.

```ts
const compare = Intl.Collator.supportedLocalesOf("is").length
  ? new Intl.Collator("is").compare
  : compareIs;
```

- **Cost:** 1,813 B for the fallback, with native speed where it exists.
- **Covers:** Edge on the desktop sorts correctly while failing most other checks, so
  this gate is per class and not per browser.
- **Traps:** you now have two code paths, and the one your tests run under Node is not
  the one your Chrome visitors get. Test `compareIs` directly.
- **Measured:** partly. `workerd` omits `is` from `Collator.supportedLocalesOf`
  (measured). The gate itself has not run in production.

## Borrow a collator

Danish, Norwegian and Swedish put æ and ö near the end too, so this looks promising.
It is listed so that nobody has to find out the hard way.

| locale | Icelandic alphabet, of 6,084 pairs | Latin, of 202,500 pairs | ten-name list |
|---|---|---|---|
| `da` | 150 differ | 3,160 differ | wrong |
| `nb` | 72 differ | 4,828 differ | wrong |
| `sv` | 104 differ | 5,876 differ | wrong |
| `de` | 1,032 differ | 15,164 differ | wrong |
| `en` | 1,032 differ | 15,164 differ | wrong |

- **Why it fails:** `da` on Chrome 156 sorts Þórður among the S and T names, where
  Icelandic puts þ after z.
- **Measured:** yes. **Do not use it.**

## Sort in the database

Let the database do it, for example `ORDER BY name COLLATE "is-IS-x-icu"` on Postgres
with ICU.

- **Cost:** 0 B in the browser.
- **Covers:** server-side lists. It does not help a list sorted again in the browser.
  SQLite and D1 have no Icelandic collation built in.
- **Measured:** **no.** Neither production site here uses it. A report would be welcome,
  including what your provider's ICU version does.

## ICU4X

Unicode's Rust and WebAssembly ICU can carry only the data you ask for, which is the
right shape for this problem on paper.

- **Measured:** **no**, neither size nor correctness. A report would be welcome.

---

# Pin it to Node

This applies to every method above, and it matters more than the choice between them.
**The browser you develop in cannot tell you whether your Icelandic is right**, while
Node has the full data. So compare your output with `Intl` under Node:

```ts
expect(formatIsDate(d)).toBe(new Intl.DateTimeFormat("is", options).format(d));
```

Then run the suite in more than one time zone, because a formatter that reads local
fields passes in UTC and fails elsewhere:

```bash
TZ=Europe/Copenhagen npm test
```

[`test/parity.test.ts`](../test/parity.test.ts) is the worked version. Its traps, such
as a selector that matches nothing and so compares nothing, are in
[testing.md](testing.md).

A guard against new `Intl` calls is worth having too, but test that it fires. The one
in [samtak-vefur](worked-examples/samtak-vefur.md) passes while seven call sites break
its rule.
