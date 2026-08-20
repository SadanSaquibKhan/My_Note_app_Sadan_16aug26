# Margin sync server (Cloudflare Worker + D1)

The small always-on service the app talks to, to sync **light data only** —
notes, sections, notebooks, ink strokes, settings. It never handles audio.
See `../SYNC-PLAN.md` for the why.

Status: **scaffold, not deployed.** It works, but the app doesn't call it yet
(that is the client half, built later, in `index.html`). Deploy it only when
you're ready to start Phase 1.

## Deploy (once, ~10 minutes) — you run these, an AI can guide each line
```bash
npm install -g wrangler          # the Cloudflare tool
wrangler login                   # opens a browser, sign in to your Cloudflare account
cd sync-server

wrangler d1 create margin        # prints a database_id — paste it into wrangler.toml
wrangler d1 execute margin --file=schema.sql --remote   # create the table

# pick any long random password and remember it — the app will use the same one
wrangler secret put SYNC_KEY

wrangler deploy                  # prints your URL, e.g. https://margin-sync.<you>.workers.dev
```

## Test it works (no app needed)
```bash
KEY="the-password-you-chose"
URL="https://margin-sync.<you>.workers.dev"
curl -s -H "x-margin-key: $KEY" "$URL/pull?since=0"        # -> {"now":...,"records":[]}
curl -s -H "x-margin-key: $KEY" -H "content-type: application/json" \
     -d '{"records":[{"store":"notes","id":"t1","updated_at":1,"body":{"title":"hi"}}]}' \
     "$URL/push"                                           # -> {"ok":true,...}
curl -s -H "x-margin-key: $KEY" "$URL/pull?since=0"        # -> now returns the t1 row
```

## API (what the app will call)
- `GET /pull?since=<ms>&device=<id>` → `{ now, records:[…] }` — everything changed
  since the cursor, skipping this device's own writes.
- `POST /push` `{ records:[{store,id,updated_at,deleted,device,body}] }` →
  upserts, **last-writer-wins** by `updated_at`. `body` is the record's JSON with
  any blob removed.

## Cost
Comfortably inside Cloudflare's free tier for one person's notes. See
`../SYNC-PLAN.md`.
