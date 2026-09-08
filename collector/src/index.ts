// intl-is-reports — what the demo page measured, from whoever opened it.
//
// Two routes and nothing else:
//   POST /report   the page sends its verdict
//   GET  /summary  a public read of what has come back
//
// The summary is public on purpose. A page that collects measurements and keeps
// them private is asking for trust it has not earned; anyone who reports can see
// what their report joined.

interface Env {
  DB: D1Database;
}

const CORS = {
  // The page is served from GitHub Pages, so the browser will preflight this.
  "access-control-allow-origin": "https://gudrodur.github.io",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

// A user agent is a string a client controls, so it is capped and stripped of
// anything that is not printable ASCII before it reaches the database.
function cleanUserAgent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\x20-\x7E]/g, "").slice(0, 400).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanLocale(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // BCP-47-ish. Anything else is not a locale and is not stored.
  return /^[A-Za-z0-9-]{2,35}$/.test(value) ? value : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/report" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ error: "expected JSON" }, 400);
      }

      const userAgent = cleanUserAgent(body.userAgent);
      const resolved = cleanLocale(body.resolved);
      const checked = Number(body.checked);
      const broken = Number(body.broken);
      if (!userAgent || !resolved || !Number.isInteger(checked) || !Number.isInteger(broken)) {
        return json({ error: "userAgent, resolved, checked and broken are required" }, 400);
      }
      if (checked < 1 || checked > 100 || broken < 0 || broken > checked) {
        return json({ error: "checked/broken out of range" }, 400);
      }

      const failing = Array.isArray(body.failing)
        ? body.failing.filter((id) => typeof id === "string" && /^[a-z-]{1,40}$/.test(id)).slice(0, 40)
        : [];

      await env.DB.prepare(
        `INSERT INTO reports (seen_at, user_agent, resolved, checked, broken, failing, country)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          new Date().toISOString().slice(0, 19) + "Z",
          userAgent,
          resolved,
          checked,
          broken,
          JSON.stringify(failing),
          // Cloudflare's country header is as fine-grained as this gets. No IP.
          request.headers.get("cf-ipcountry") ?? null,
        )
        .run();

      return json({ ok: true });
    }

    if (url.pathname === "/summary" && request.method === "GET") {
      // Grouped, never row-by-row: the useful question is "which runtimes have
      // been seen and what did they answer", not "who visited".
      const { results } = await env.DB.prepare(
        `SELECT user_agent, resolved, checked, broken,
                COUNT(*) AS reports,
                MIN(seen_at) AS first_seen,
                MAX(seen_at) AS last_seen
           FROM reports
          GROUP BY user_agent, resolved, checked, broken
          ORDER BY last_seen DESC
          LIMIT 200`,
      ).all();

      const totals = await env.DB.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN broken = 0 THEN 1 ELSE 0 END) AS passing,
                COUNT(DISTINCT user_agent) AS distinct_agents
           FROM reports`,
      ).first();

      return json({
        note: "Reports from https://gudrodur.github.io/intl-is/. No IP addresses, no cookies, no visitor ids.",
        totals,
        runtimes: results,
      });
    }

    return json({ routes: ["POST /report", "GET /summary"] }, 404);
  },
};
