/* Margin sync — a tiny Cloudflare Worker over one D1 database.
   It moves ONLY light data (notes, sections, notebooks, ink strokes, settings).
   It never sees audio: the client strips blobs before pushing.

   Two endpoints, both need the header  x-margin-key: <your secret>
     POST /push  { records: [ {store,id,updated_at,deleted,device,body}, ... ] }
        -> upserts each, last-writer-wins by updated_at. Returns { ok, now }.
     GET  /pull?since=<ms>[&device=<id>]
        -> { now, records:[...] } — everything changed since <since>,
           optionally skipping rows this device itself wrote.

   Deploy: see README.md. */

const CORS = {
  "Access-Control-Allow-Origin": "*",            // tighten to your Pages origin later
  "Access-Control-Allow-Headers": "content-type, x-margin-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    // one shared secret proves the device is yours (kept as a Worker secret)
    if (req.headers.get("x-margin-key") !== env.SYNC_KEY)
      return json({ error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const now = Date.now();

    try {
      if (url.pathname === "/pull" && req.method === "GET") {
        const since = Number(url.searchParams.get("since") || 0) || 0;
        const device = url.searchParams.get("device") || "";
        // rows changed since the cursor; skip the caller's own echoes
        const q = device
          ? env.DB.prepare(
              "SELECT store,id,updated_at,deleted,device,body FROM records WHERE updated_at > ? AND (device IS NULL OR device <> ?) ORDER BY updated_at ASC LIMIT 5000"
            ).bind(since, device)
          : env.DB.prepare(
              "SELECT store,id,updated_at,deleted,device,body FROM records WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 5000"
            ).bind(since);
        const { results } = await q.all();
        return json({ now, records: results || [] });
      }

      if (url.pathname === "/push" && req.method === "POST") {
        const in_ = await req.json();
        const recs = Array.isArray(in_ && in_.records) ? in_.records : [];
        // last-writer-wins: only overwrite if the incoming row is newer
        const stmt = env.DB.prepare(
          `INSERT INTO records (store,id,updated_at,deleted,device,body)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(store,id) DO UPDATE SET
             updated_at=excluded.updated_at,
             deleted=excluded.deleted,
             device=excluded.device,
             body=excluded.body
           WHERE excluded.updated_at > records.updated_at`
        );
        const batch = [];
        for (const r of recs) {
          if (!r || !r.store || !r.id) continue;
          batch.push(
            stmt.bind(
              String(r.store),
              String(r.id),
              Number(r.updated_at) || 0,
              r.deleted ? 1 : 0,
              r.device || null,
              typeof r.body === "string" ? r.body : JSON.stringify(r.body || {})
            )
          );
        }
        if (batch.length) await env.DB.batch(batch);
        return json({ ok: true, now, count: batch.length });
      }

      if (url.pathname === "/") return json({ ok: true, service: "margin-sync", now });
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  },
};
