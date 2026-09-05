#!/usr/bin/env node
// Re-runnable probe for the Worker Intl locale-data gap (#1263): starts a
// scratch worker on BARE workerd (imports nothing from this repo, so the
// formatjs polyfill that post-#1264 production loads cannot mask the gap),
// reads one JSON blob of per-locale Intl results, prints it as a markdown
// table, and kills the dev server by PID.
//
//   node scripts/probe-worker-intl.mjs
//
// Exits 0 when a table was measured and printed, 2 when the probe could not
// run (wrangler failed to start, the worker never became reachable, or the
// response was not the expected JSON). The output is self-contained: workerd
// version, wrangler version, probe date, table, and a verdict per locale
// (native / fallback en-US / polyfilled). Nothing outside the scratch dir and
// the spawned wrangler process is touched, and the dev server is always killed
// by its own PID/process group, never by pkill.
//
// Why this exists: workerd embeds Chromium's trimmed ICU, which drops Icelandic
// locale data, so every Intl formatter for `is` on the Worker silently renders
// English/en-US conventions. #1263 measured the gap with ad-hoc probe workers;
// this is that probe checked in, so the table can be re-derived after any
// workerd or wrangler bump instead of re-derived by hand. See
// docs/troubleshooting.md "Intl on workerd has no Icelandic locale data".

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER_BIN = join(ROOT, "node_modules", ".bin", "wrangler");

// The probe itself, as the scratch worker's source. BARE workerd: no imports,
// no polyfills, no bindings. Dates are fixed (2026-12-07 is a Monday) so the
// table is comparable run to run.
const WORKER_SRC = `export default {
  fetch() {
    const LOCALES = ["is", "en", "pl", "es", "uk", "ru", "tl"];
    const PLURALS = [1, 2, 5, 11, 21, 101];
    const WORDS = ["ö", "z", "á", "a", "þ", "t", "æ", "e", "ð", "d"];
    const d = new Date(Date.UTC(2026, 11, 7, 12, 0));
    const safe = (fn) => {
      try {
        return fn();
      } catch (e) {
        return "ERR " + e.message;
      }
    };
    const out = { locales: {} };
    for (const l of LOCALES) {
      out.locales[l] = {
        resolved: new Intl.DateTimeFormat(l).resolvedOptions().locale,
        month: new Intl.DateTimeFormat(l, { month: "long", timeZone: "UTC" }).format(d),
        weekday: new Intl.DateTimeFormat(l, { weekday: "long", timeZone: "UTC" }).format(d),
        plural: PLURALS.map((n) => new Intl.PluralRules(l).select(n)).join("/"),
        collatorResolved: new Intl.Collator(l).resolvedOptions().locale,
        sorted: [...WORDS].sort(new Intl.Collator(l).compare).join(""),
        number: new Intl.NumberFormat(l).format(1234567.89),
        relative: safe(() => new Intl.RelativeTimeFormat(l).format(-2, "day")),
        list: safe(() => new Intl.ListFormat(l).format(["a", "b", "c"])),
      };
    }
    out.supported = {
      dtf: Intl.DateTimeFormat.supportedLocalesOf(Object.keys(out.locales)),
      plural: Intl.PluralRules.supportedLocalesOf(Object.keys(out.locales)),
      collator: Intl.Collator.supportedLocalesOf(Object.keys(out.locales)),
      number: Intl.NumberFormat.supportedLocalesOf(Object.keys(out.locales)),
    };
    return new Response(JSON.stringify(out), {
      headers: { "content-type": "application/json" },
    });
  }
};
`;

const WRANGLER_CONFIG = `{
  "name": "intl-probe",
  "main": "worker.mjs",
  "compatibility_date": "2026-05-25",
  "compatibility_flags": ["nodejs_compat"]
}
`;

function fail(msg, logPath) {
  console.error(`probe-worker-intl: ${msg}`);
  if (logPath) console.error(`wrangler log: ${logPath}`);
  process.exit(2);
}

function wranglerVersion() {
  const r = spawnSync(WRANGLER_BIN, ["--version"], { encoding: "utf8" });
  if (r.status !== 0) return "unknown";
  const m = r.stdout.match(/\d+\.\d+\.\d+/);
  return m ? m[0] : "unknown";
}

// The @cloudflare/workerd-* package name carries the version, e.g.
// node_modules/.pnpm/@cloudflare+workerd-linux-64@1.20260826.1/...
function workerdVersion() {
  const pnpm = join(ROOT, "node_modules", ".pnpm");
  let dirs;
  try {
    dirs = readdirSync(pnpm).filter((d) => d.startsWith("@cloudflare+workerd-"));
  } catch {
    return "unknown";
  }
  const pick =
    dirs.find((d) => d.includes("linux-64")) ?? dirs.sort().at(-1);
  if (!pick) return "unknown";
  // name encodes the version: "@cloudflare+workerd-linux-64@1.20260826.1"
  const pkg = join(pnpm, pick, "node_modules", "@cloudflare", pick.split("@")[0].replace("+", "/").replace("@cloudflare/", ""), "package.json");
  try {
    return JSON.parse(readFileSync(pkg, "utf8")).version;
  } catch {
    return pick.split("@").at(-1);
  }
}

async function freePort() {
  const srv = createServer();
  await new Promise((resolve, reject) => {
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", resolve);
  });
  const port = srv.address().port;
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), "intl-probe-"));
  const logPath = join(scratch, "wrangler-dev.log");
  writeFileSync(join(scratch, "worker.mjs"), WORKER_SRC);
  writeFileSync(join(scratch, "wrangler.jsonc"), WRANGLER_CONFIG);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  const logFd = await import("node:fs/promises").then((f) => f.open(logPath, "w"));

  const child = spawn(WRANGLER_BIN, ["dev", "--local", "--port", String(port)], {
    cwd: scratch,
    detached: true, // own process group, so kill(-pid) takes wrangler + workerd
    stdio: ["ignore", logFd, logFd],
  });

  const stop = async () => {
    if (child.exitCode !== null) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      return;
    }
    await Promise.race([
      new Promise((r) => child.once("exit", r)),
      delay(5000),
    ]);
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
  };
  process.once("exit", stop);
  process.once("SIGINT", () => stop().then(() => process.exit(130)));
  process.once("SIGTERM", () => stop().then(() => process.exit(143)));

  let json = null;
  const deadline = Date.now() + 90_000;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        fail(`wrangler exited early (code ${child.exitCode})`, logPath);
      }
      try {
        const res = await fetch(url);
        if (res.ok) {
          json = await res.json();
          break;
        }
      } catch {}
      await delay(500);
    }
  } finally {
    await stop();
    await logFd.close();
  }

  if (!json || !json.locales || !json.supported) {
    const tail = readFileSync(logPath, "utf8").split("\n").slice(-25).join("\n");
    console.error(tail);
    fail("worker never answered with the expected JSON", logPath);
  }

  const wv = workerdVersion();
  const wru = wranglerVersion();
  const when = new Date().toISOString().replace(/T/, " ").replace(/\.\d+Z$/, " UTC");

  console.log("# Worker Intl probe (bare workerd, no polyfill)");
  console.log(`workerd ${wv} via wrangler ${wru}, probed ${when}`);
  console.log("scratch worker imports nothing from this repo; production's formatjs polyfill is not loaded.");
  console.log("");

  const cell = (v) => String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const cols = [
    "locale",
    "DateTimeFormat month",
    "weekday",
    "PluralRules(1,2,5,11,21,101)",
    "Collator order",
    "NumberFormat 1234567.89",
    "RelativeTimeFormat -2 day",
    "ListFormat a,b,c",
    "resolved locale",
  ];
  console.log(`| ${cols.join(" | ")} |`);
  console.log(`|${cols.map(() => "---").join("|")}|`);

  const verdicts = [];
  for (const [l, r] of Object.entries(json.locales)) {
    const row = [
      l,
      r.month,
      r.weekday,
      r.plural,
      r.sorted,
      r.number,
      r.relative,
      r.list,
      r.resolved,
    ];
    console.log(`| ${row.map(cell).join(" | ")} |`);
    const canonical = Intl.getCanonicalLocales(l)[0];
    const res = r.resolved;
    let verdict;
    if (res === canonical || res.startsWith(`${canonical}-`)) {
      verdict = "native";
    } else if (res.startsWith("en")) {
      verdict = "fallback en-US";
    } else {
      verdict = "polyfilled";
    }
    verdicts.push(`- \`${l}\`: ${verdict} (DateTimeFormat resolved \`${res}\`)`);
  }

  console.log("");
  console.log("Verdict:");
  for (const v of verdicts) console.log(v);
  console.log("");
  console.log(
    `supportedLocalesOf: dtf ${JSON.stringify(json.supported.dtf)} | plural ${JSON.stringify(json.supported.plural)} | collator ${JSON.stringify(json.supported.collator)} | number ${JSON.stringify(json.supported.number)}`,
  );

  rmSync(scratch, { recursive: true, force: true });
  process.exit(0);
}

main().catch((e) => {
  console.error(`probe-worker-intl: ${e.message}`);
  process.exit(2);
});
