# samtak-vefur

The website of Samtak svf. (a cooperative) at samtak.is. It is server-rendered with
TanStack Start on Cloudflare Workers, with D1 as its database, and Icelandic only.
The source is private, so this page gives the approach with short excerpts.

Read at commit `845d459` on 2026-11-01.

## What it does

| concern | method | detail |
|---|---|---|
| Dates | [format by hand](../methods.md#format-by-hand) | one module, `lib/dates.ts`, about 37 call sites, CLDR month tables |
| Date tests | literal strings | asserts exact expected text, so not pinned to Node |
| `Intl` elsewhere | a repository guard | bans `toLocale*String`, `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` outside that module |
| Polyfill | none | no formatjs and no dependency on this repository |

It is the smallest possible answer: no polyfill, one small module and a guard. The
module exists because `breytt Jul 20, 2026` reached production on one page.

```js
{
  name: "Icelandic date formatting",
  pattern:
    /\btoLocaleDateString\b|\btoLocaleTimeString\b|\btoLocaleString\b|\bIntl\.DateTimeFormat\b|\bIntl\.RelativeTimeFormat\b/,
  allow: ["apps/web/src/lib/dates.ts"],
  note: "Use formatIsDate / … from lib/dates.ts — Intl silently falls back to English on Workers.",
}
```

## What reading it for this page found

These were found by reading and running the repository's own check. None of them was
observed on the live site.

**The guard has a hole, confirmed by running it.** It strips comments and strings
before matching, and the stripping blanks the inside of template literals, including
`${…}` expressions. So this line is invisible to it:

```ts
const kr = (amount: number) => `${amount.toLocaleString("is-IS")} kr.`;
```

Seven call sites are written like that, and the check still reports every seam intact.
On a Worker, `toLocaleString("is-IS")` groups the English way, so an amount of 1,000 kr.
or more would render as `1,234 kr.`. In the browser on desktop Chrome it does the same.
On any browser with the data it renders correctly, so the same value can differ between
the server's markup and the browser's. The current membership fee of 100 kr. is below
the point where grouping starts, which helps explain why nobody saw it.

**Sorting is not covered.** One admin list uses `new Intl.Collator("is", …)` with a
comment saying Þ, Æ and Ö sort last. On Workers that collator resolves to `en-US`, so
the comment does not hold there. The guard's pattern does not include `Intl.Collator`.

**Dates read local fields.** `getDate()` and `getHours()` give UTC on the server and the
viewer's zone in the browser. A viewer outside Iceland could see a different day or time
than the server rendered, which is a hydration risk. This is a risk read from the code,
not an observed failure.

## The lesson for your own site

- A guard needs a test proving it fires. This one's fixture would have been a single line
  with a `${…}` in it.
- If you ban `Intl` for dates, decide about numbers and sorting at the same time. They
  are the same problem and they are easy to forget.
- The small answer works. Its gaps are about coverage, and
  [`formatIsNumber`](../../src/format.ts) and [`compareIs`](../methods.md#compareis-by-hand)
  would close them for about 3 KB.

These gaps are tracked in the project's own issue tracker. This page describes the state
at the commit above and is not updated with each fix there.
