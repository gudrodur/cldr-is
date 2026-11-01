// The server polyfill replaces global Intl classes, so it gets a file of its
// own: vitest isolates files, and nothing else here should run polyfilled.
import { expect, it } from "vitest";
import { icelandicIntlStatus } from "../src/server";

it("the server polyfill answers in Icelandic", () => {
  expect(icelandicIntlStatus()).toEqual({ month: "desember", ok: true });
});
