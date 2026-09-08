// The checks, defined ONCE.
//
// Both the generator (scripts/measure.mjs, which runs them under Node's full
// ICU to produce docs/reference.json) and the demo page (docs/index.html, which
// runs them in the reader's browser) import this file. That is the whole point:
// an expression that is written twice eventually says two different things, and
// a comparison page whose two sides have drifted apart is worse than no page.
//
// Plain .js with no dependencies so Node and the browser can both import it
// without a build step.

// One fixed instant, so a rendering never depends on when the page is opened.
export const INSTANT = "2026-09-02T12:07:07Z";
const d = new Date(INSTANT);

// Ten Icelandic names covering the letters a fallback collation misplaces.
export const NAMES = [
  "Þórður",
  "Ævar",
  "Örn",
  "Ásta",
  "Ólafur",
  "Aðalheiður",
  "Einar",
  "Úlfur",
  "Ýrr",
  "Ína",
];

// Date cases pin timeZone: "UTC" on BOTH sides, so the comparison is about
// locale data and not about where the reader is sitting. (In an application the
// opposite is usually right — see the README on local wall-clock — but here the
// question is only whether the browser has the Icelandic data.)
const UTC = { timeZone: "UTC" };

export const CASES = [
  {
    id: "date-bare",
    label: "Bare date",
    run: () => d.toLocaleDateString("is-IS", { timeZone: "UTC" }),
  },
  {
    id: "date-long-month",
    label: "Long month",
    run: () =>
      d.toLocaleDateString("is-IS", { day: "numeric", month: "long", year: "numeric", ...UTC }),
  },
  {
    id: "weekday",
    label: "Weekday",
    run: () => d.toLocaleDateString("is-IS", { weekday: "long", ...UTC }),
  },
  {
    id: "date-short-month",
    label: "Short month",
    run: () =>
      d.toLocaleDateString("is-IS", { day: "numeric", month: "short", year: "numeric", ...UTC }),
  },
  {
    id: "date-time",
    label: "Date + time",
    run: () => d.toLocaleString("is-IS", { timeZone: "UTC" }),
  },
  {
    id: "number",
    label: "Number",
    run: () => (1234567.89).toLocaleString("is-IS"),
  },
  {
    id: "currency",
    label: "Currency",
    run: () => (2500).toLocaleString("is-IS", { style: "currency", currency: "ISK" }),
  },
  {
    id: "relative-time",
    label: "Relative time",
    run: () => new Intl.RelativeTimeFormat("is").format(-2, "day"),
  },
  {
    id: "list",
    label: "List",
    run: () => new Intl.ListFormat("is").format(["a", "b", "c"]),
  },
  {
    id: "display-name",
    label: "Language name",
    run: () => new Intl.DisplayNames(["is"], { type: "language" }).of("is"),
  },
  {
    id: "sort",
    label: "Sort",
    kind: "list",
    run: () => NAMES.slice().sort((a, b) => a.localeCompare(b, "is")).join(", "),
  },
  {
    id: "plural",
    label: "Plural category",
    // Needs a gloss or it reads as a bug: select() returns a CLDR CATEGORY
    // KEYWORD, not text. Someone reading "one" between "miðvikudagur" and
    // "íslenska" sees an untranslated "einn", and that is not what it is.
    note: (extra) =>
      `A category name, not a translation. The keywords are the same in every ` +
      `locale (Icelandic has <code>${extra.categoriesIs.join("</code>, <code>")}</code>; ` +
      `Polish has <code>${extra.categoriesPl.join("</code>, <code>")}</code>). ` +
      `This row is the proof the Icelandic rules really are present: English ` +
      `answers <code>${extra.english}</code> for 21, Icelandic answers ` +
      `<code>one</code> — which is why it is “21 bíll”, not “21 bílar”.`,
    extra: () => ({
      english: new Intl.PluralRules("en").select(21),
      categoriesIs: new Intl.PluralRules("is").resolvedOptions().pluralCategories,
      categoriesPl: new Intl.PluralRules("pl").resolvedOptions().pluralCategories,
    }),
    run: () => new Intl.PluralRules("is").select(21),
  },
];

// The displayed expression is DERIVED from the function, never typed beside it —
// a label that has to be kept in sync with the code it describes is the same
// duplication in a smaller place.
export function sourceOf(c) {
  return c.run
    .toString()
    .replace(/^\(\)\s*=>\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}
