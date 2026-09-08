# intl-is

Icelandic locale data, collation, and a working recipe for the JavaScript
`Intl` API on runtimes that ship without it.

**Status: not published, not yet built as a package.** This repository holds the
code and the measurements while the approach earns production mileage in one
application. It will go to npm when that experience exists.

**It is a recipe as much as a package, and copying it is a supported way to use
it.** For dates and numbers, hand-writing your own is a reasonable choice — the
code is thirty lines and you can write them. What is worth taking is not the
code but the parts that are easy to get wrong and invisible when you do: the
CLDR values, the three traps in [`src/format.ts`](src/format.ts), and above all
the way to check your own work (["Pin it to
Node"](#pin-whatever-you-write-to-node) below). Copy the file, keep the tests,
delete the rest. For **collation** the advice is the opposite: do not hand-write
it — see [below](#collation-the-part-no-polyfill-can-fix) for why.

## The problem

Chromium keeps only "the minimum locale data for non-UI languages", and
Icelandic is one of them because Chrome's own UI is not translated to it. Every
runtime built on Chromium's ICU inherits the gap:

- **Chromium-based browsers** — Chrome, Edge, Opera, Brave, and anything else on
  the same engine: `new Date().toLocaleDateString("is", { month: "long" })`
  returns `December`, not `desember`. **Firefox and Safari ship full ICU and are
  not affected**, which is what makes this easy to miss: the developer testing in
  Firefox sees Icelandic and ships English to most of their visitors.
- **Cloudflare Workers (workerd)** embeds the same ICU data, so a server-rendered
  page has the gap too. Upstream:
  [cloudflare/workerd#64](https://github.com/cloudflare/workerd/issues/64), open
  since 2022.

Node ships full ICU and is fine — which is why Node is the right oracle to test
against, and why a test suite can pass while production is wrong.

Measured 2026-09-05 on bare workerd and Chrome 152: for `is`,
`Intl.DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`, `ListFormat` and
`Collator` all resolve to `en-US`; only `PluralRules` is correct. Full tables in
[docs/measurements.md](docs/measurements.md).

## Two ways to close it

|  | polyfill the data | format manually |
|---|---|---|
| what it is | load formatjs's CLDR data for `is` | render Icelandic from a month table and a few string joins |
| browser cost | **191,966 B gzip**, Chromium visitors only | **1,618 B gzip**, everyone |
| speed | 30,474 ns per `toLocaleString` call | 98 ns |
| covers collation | **no — no Collator polyfill exists** | yes |
| covers arbitrary locales and options | yes | no, only the shapes you write |

Both were built and shipped in the same application. The recommendation below is
what came out of running them, not a preference stated in advance.

### On the server: polyfill

The server is where the polyfill earns its size. It is loaded once per isolate,
not per visitor, and it makes every `Intl` class work for every locale the site
serves — which matters the moment the site is not Icelandic-only.

```ts
// server entry, FIRST import
import "intl-is/server";
```

Four things that are not obvious and each cost a debugging session:

- it has to be `polyfill-force`, not `polyfill`: the runtime *has* an
  `Intl.DateTimeFormat`, it just answers in English, so the conditional polyfill
  decides nothing is wrong and does nothing;
- `polyfill-force` replaces the global class for **every** locale, so a server
  that formats other languages must load their data too, or they regress
  (measured: with only `is` loaded, `en` pluralised 21 as "one" and Polish
  relative time came out in Icelandic);
- leave `PluralRules` native — it is already correct for `is`, and faster;
- a one-line self-test on a health endpoint is worth having, because this failure
  is silent and looks like English copy.

### In the browser: format manually

This is the part where our recommendation changed after measuring it.

The obvious move is to load the same data in the browser behind a
`shouldPolyfill` gate. We built that ([`src/client.ts`](src/client.ts)), shipped
it behind a flag, measured it, and **turned it off**: 191,966 B gzip, most of it
the time-zone table `@formatjs/intl-datetimeformat` needs, to fix a handful of
rendered dates. The manual formatters that replaced it are 1,618 B gzip for
dates, numbers *and* collation — 119× smaller — and about 310× faster per call
than the `toLocaleString` they replaced.

[`src/format.ts`](src/format.ts) has the shapes we needed, and
`formatIsNumber` beside them. Import them, or copy the file — both are fine.

### Pin whatever you write to Node

This is the part that matters more than the code, and the reason "write it by
hand" is safe advice here rather than reckless. **The runtime you are developing
in cannot tell you whether your Icelandic is right** — your Chrome is the broken
one. Node still has the data, so Node is the oracle:

```ts
// Node full ICU renders what CLDR says. Assert against it, not against taste.
expect(formatIsDateTimeNumeric(d)).toBe(
  d.toLocaleString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit" }),
);
```

Write that once per shape and the hand-written table stops being a guess. It is
what catches the abbreviated months (`sep.` with a period, `maí` without), and
it is why copying this repo's *tests* matters more than copying its code.

Two ways to get the test itself wrong:

- **Do not pin with `timeZone: "UTC"` on the Intl side unless the call site
  passes one.** That makes the equality true by construction and hides the bug
  it was meant to catch. It hid exactly this one from us for a review round: the
  date+time shapes were reading UTC parts where the calls they replaced read the
  viewer's, which matched perfectly in Reykjavík and diverged in 19 of 49
  comparisons in `Europe/Copenhagen`.
- **Run the suite in more than one time zone.** `TZ=Europe/Copenhagen npm test`
  costs nothing and is the only thing that would have caught the above.

### Server-rendered pages: the two halves must agree

This is the reason the choice matters more on an SSR page than in a SPA. If the
server formats with full data and the client re-renders with fallback data, the
markup disagrees with itself and React reports a hydration mismatch — or worse,
silently keeps one of the two.

There are only two coherent answers: the same data on both sides, or manual
formatting on both sides. **Icelandic formatting manual everywhere** is the one
we run: the server keeps the polyfill for the other locales and for anything
still going through `Intl`, while every Icelandic date, number and sort on both
sides comes from the same pure functions. They cannot disagree, because they are
the same code — and they are right, because they are pinned to CLDR.

Measured on the live site in Chrome 152 (2026-09-07): 26 formatted Icelandic
dates in the server markup, every one present identically in the hydrated DOM,
zero console errors or warnings. In that same browser at that same moment,
`toLocaleDateString("is-IS", { month: "long" })` returned `August 15, 2026` and
`Intl.DateTimeFormat("is").resolvedOptions().locale` returned `en-US`. The
runtime was broken and the page was right.

## Collation: the part no polyfill can fix

formatjs has no `Collator` polyfill. So on Chromium and workerd,
`localeCompare(_, "is")` silently sorts by the English alphabet and there is
nothing to install:

```
ö z á a þ t æ e ð d   →  aáædðeötzþ   (en-US fallback)
                      →  aádðetzþæö   (Icelandic)
```

`á é í ó ú ý ð þ æ ö` are letters in their own right, not accented variants. In a
member list, Ævar lands second instead of second-to-last and Þórður sorts among
the T's.

```ts
import { compareIs } from "intl-is/collate";

names.sort(compareIs);
```

Pinned to Node full ICU over every ordered pair of the alphabet, 253 Icelandic
country names, the letters CLDR tailors away from their base letter (`ä ø å œ ß`),
ASCII punctuation, case, digits, and 200 000 random strings drawn from the whole
character set — **zero divergences**. Two details were read off ICU rather than
reasoned about, and both would have been wrong from memory: ICU orders
punctuation by DUCET category, so `_` sorts before `-` despite the higher code
point, and `œ`/`ß` expand to `oe`/`ss` instead of taking a weight of their own.

Not claimed: characters outside that set — CJK, emoji, unlisted symbols — get a
stable code-point order that ICU is not promised to agree with.

It is about **3× slower than a native `Intl.Collator`** (20 ms versus 7 ms
sorting 10 000 names). That is the honest cost of being correct on a runtime
whose collator is not, and it is the one measurement here that does not favour
this approach.

## The trap next door: date-fns is a separate axis

A polyfill fixes `Intl`. It does not fix a library that never used `Intl`.
[react-day-picker](https://daypicker.dev/) — and therefore every shadcn/ui
calendar and date picker — localises through **date-fns**, so a fully polyfilled
page still renders `October 2026` and `Su Mo Tu We Th Fr Sa` until a locale is
passed:

```ts
import { is } from "date-fns/locale/is";
<DayPicker locale={is} />   // október, Má Þr Mi Fi Fö La Su, Monday-first
```

One more thing to check once you do: date-fns's abbreviated Icelandic months are
**not** CLDR's. date-fns gives `mars, apríl, júní, júlí, ágúst, sept.` where CLDR
gives `mar., apr., jún., júl., ágú., sep.` — six of twelve differ. If anything
else on the page renders CLDR short months, the calendar will not match it.

## Measurements

Every number in this README, with its method and date:
[docs/measurements.md](docs/measurements.md).
`scripts/probe-worker-intl.mjs` re-measures a bare workerd for any locale
(`npm run probe`, needs `wrangler` on PATH), so the gap can be re-checked per
workerd release.

## Do not wait for the upstream fix

This is a workaround, and the honest reading of the evidence is that it is a
**permanent** one. An earlier version of this README said "if you can help
either along, do that instead of installing this". That was optimism, not a
reading of the threads.

**Chromium's exclusion is policy, not an oversight.**
[`filters/common.json`](https://chromium.googlesource.com/chromium/deps/icu/+/refs/heads/main/filters/common.json)
says *"Keep only the minimum locale data for non-UI languages"*, and the
qualifying condition is whether Chrome's own UI is translated into the language
— not whether the language is used on the web. Icelandic does not qualify and is
not going to start qualifying because a website asked.

**workerd#64 is not a refusal. It is silence, which is worse.**
[cloudflare/workerd#64](https://github.com/cloudflare/workerd/issues/64) was
opened 2022-09-30. The maintainer was *receptive* — "annoying but maybe not a
huge deal for a server binary" — and the reporter went and measured it: swapping
in the full `icudt71l.dat` took the binary from 63 MB to 82 MB, the data from
~10 MB to ~30 MB, and nothing crashed. Five comments over five days, and then
**nothing: no comment, no label, no assignee, for 1,434 days** as of 2026-09-08.
A willing maintainer and four years of silence is a worse signal than a "no",
because a "no" can be argued with.

**Mozilla went the other way and stopped, which is the interesting part.**
[Bug 1612379](https://bugzilla.mozilla.org/show_bug.cgi?id=1612379) proposed
trimming Firefox from 459 locales to roughly 100–150 — about 1.8 MB — and it
stalled on the principle that dropping languages with millions of speakers is
not acceptable, and that once Firefox's intl data is available to the Web it
should remain available. Deprioritised P2 → P5, to revisit "once we have ICU4X".

That is the whole thing in one comparison: two vendors looked at the same
1–2 MB and reached opposite conclusions, and that is why your Icelandic dates
work in Firefox and not in Chrome. It is a values split, not a technical
inevitability — and a values split does not get resolved by filing a bug.

The one thing worth watching is **ICU4X**, which both threads independently
point at: the workerd reporter ("I'm starting to understand why the Unicode
Consortium is pushing ICU4X") and Mozilla's own resolution. Data loaded on
demand per locale is the shape that makes this question go away, rather than the
shape that makes someone choose which languages are worth 1.8 MB.

## License

MIT
