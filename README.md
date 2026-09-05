# intl-is

Icelandic locale data for the JavaScript `Intl` API on runtimes that ship
without it.

**Status: not published, not yet built as a package.** This repository holds
the code and the measurements while the approach earns production mileage in
one application. It will go to npm when that experience exists.

## The problem

Chromium keeps only "the minimum locale data for non-UI languages", and
Icelandic is one of them because Chrome's own UI is not translated to it. Every
runtime built on Chromium's ICU inherits the gap:

- **Chrome and Edge**: `new Date().toLocaleDateString("is", { month: "long" })`
  returns `December`, not `desember`. Every Icelandic website that formats
  dates through `Intl` shows English month and weekday names to most of its
  visitors, and the usual fix in the wild is a hand-written month table.
- **Cloudflare Workers (workerd)** embeds the same ICU data, so the server side
  has the gap too. Upstream: [cloudflare/workerd#64](https://github.com/cloudflare/workerd/issues/64),
  open since 2022.

Firefox, Safari and Node ship full ICU and are fine.

Measured 2026-09-05 on bare workerd: for `is`, `Intl.DateTimeFormat`,
`NumberFormat`, `RelativeTimeFormat` and `ListFormat` all resolve to `en-US`;
only `PluralRules` is correct. Full table in [docs/measurements.md](docs/measurements.md).

## What this is

A thin recipe over [formatjs](https://formatjs.github.io/docs/polyfills)'s
CLDR-generated polyfills. formatjs owns the data; the value here is knowing
exactly what to load and how:

- which four classes need data for `is` (and that `PluralRules` must be left
  native, it is correct and faster);
- why it has to be `polyfill-force`, not `polyfill`: the runtime *has* an
  `Intl.DateTimeFormat`, it just answers in English, so the conditional
  polyfill does nothing;
- that `polyfill-force` replaces the global class for **every** locale, so a
  server that formats other languages must load their data too, or they
  regress (measured: with only `is` loaded, `en` pluralised 21 as "one" and
  Polish relative time came out in Icelandic);
- that the browser needs a `shouldPolyfill` gate and a lazy chunk, so only
  Chromium visitors download anything;
- a one-line self-test for a health endpoint.

```ts
// server entry, first import
import "intl-is/server";

// browser, before the first render that formats a date
import { installIcelandicIntl } from "intl-is/client";
await installIcelandicIntl();
```

`scripts/probe-worker-intl.mjs` measures a bare workerd for any locale and
prints the table above, so the gap can be re-checked per workerd release. It was
ported from the application this was developed in and may still name it.

## Cost

The data is not free: about 3.5 MB raw on a Worker bundle for seven locales, and
a 190 KB gzip lazy chunk in the browser, most of it time-zone data. Numbers in
[docs/measurements.md](docs/measurements.md).

## The real fix is upstream

This is a workaround. The fix is Chromium including `is` in its ICU build, and
Cloudflare shipping full ICU (workerd#64). If you can help either along, do that
instead of installing this.

## License

MIT
