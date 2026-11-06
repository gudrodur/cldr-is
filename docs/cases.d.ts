// Types for docs/cases.js, which is plain browser JS (the demo page loads it
// directly, so it cannot be TypeScript). Lets test/ type-check against it.
export interface Case {
  id: string;
  label: string;
  kind?: string;
  run: () => string;
  extra?: () => unknown;
}
export const INSTANT: string;
export const NAMES: string[];
export const CASES: Case[];
export function sourceOf(c: Case): string;
