// Write a generated JSON file, touching it only when an answer changed.
//
// The measure scripts used to stamp generatedAt on every run, so re-running them
// with identical results dirtied the tree and hid the real diff behind a date.
// The date now moves only when something else in the file does.
import { readFileSync, writeFileSync } from "node:fs";

const withoutDate = ({ generatedAt: _date, ...rest }) => rest;

/** @returns {"created" | "updated" | "unchanged"} */
export function writeGenerated(path, data, today = new Date().toISOString().slice(0, 10)) {
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // missing or unreadable: write fresh
  }
  const exists = previous !== null;
  if (exists && JSON.stringify(withoutDate(previous)) === JSON.stringify(withoutDate(data))) {
    return "unchanged";
  }
  // generatedAt keeps the position the caller gave it; a bare object gets it first.
  const out = "generatedAt" in data ? { ...data, generatedAt: today } : { generatedAt: today, ...data };
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
  return exists ? "updated" : "created";
}
