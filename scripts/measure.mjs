// Regenerate docs/reference.json: run every check in docs/cases.js under this
// Node's full ICU and record what it answers.
//
// Node is the oracle because it is the runtime that still HAS the data the
// browsers dropped. Run it after a Node upgrade (CLDR moves between ICU
// versions) and commit the result; test/reference.test.ts fails if the
// committed file has drifted from what Node produces now, so a stale reference
// cannot sit unnoticed behind a page that claims to show the correct answers.
import { writeFileSync } from "node:fs";
import { CASES, INSTANT, NAMES, sourceOf } from "../docs/cases.js";

const cases = CASES.map((c) => ({
  id: c.id,
  label: c.label,
  expr: sourceOf(c),
  kind: c.kind ?? "value",
  cldr: c.run(),
  ...(c.extra ? { extra: c.extra() } : {}),
}));

const out = {
  generatedBy: `Node ${process.version} (full ICU)`,
  generatedAt: new Date().toISOString().slice(0, 10),
  instant: INSTANT,
  names: NAMES,
  cases,
};

const path = new URL("../docs/reference.json", import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${cases.length} cases from ${out.generatedBy}`);
for (const c of cases) console.log(`  ${c.label.padEnd(18)} ${c.cldr}`);
