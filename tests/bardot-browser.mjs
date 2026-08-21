/* Real-browser check: minimise the favourites bar to its dot, then hold the dot
   to open it again, and confirm the bar returns to WHERE IT WAS — not the
   top-left corner. Reproduces the reported bug (b154 and earlier snapped to 0,0).
   Needs a headless Chrome on :9222 and a server for the working dir.
   Run: node tests/bardot-browser.mjs [--port=8770] */
const CDP = "http://127.0.0.1:9222";
const arg = (n, d) => { const p = process.argv.find(x => x.startsWith(`--${n}=`)); return p ? p.slice(n.length + 3) : d; };
const APP = `http://127.0.0.1:${arg("port", "8770")}/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Cdp {
  constructor(ws){ this.ws = ws; this.seq = 0; this.pending = new Map(); }
  static async attach(u){ const ws = new WebSocket(u);
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("ws timeout")), 5000);
      ws.addEventListener("open", () => { clearTimeout(t); res(); }, { once: true });
      ws.addEventListener("error", e => { clearTimeout(t); rej(e.error || e); }, { once: true }); });
    const c = new Cdp(ws);
    ws.addEventListener("message", e => { const m = JSON.parse(String(e.data));
      if (m.id && c.pending.has(m.id)){ const p = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? p.reject(new Error(p.method + ": " + m.error.message)) : p.resolve(m.result || {}); } });
    return c; }
  send(method, params = {}){ const id = ++this.seq;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej, method });
      this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function ev(cdp, expression){
  const o = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (o.exceptionDetails){ const d = o.exceptionDetails; throw new Error(d.exception?.description || d.text || "eval failed"); }
  return o.result ? o.result.value : undefined; }
async function waitFor(cdp, expr, label, timeout = 20000){ const until = Date.now() + timeout; let last;
  while (Date.now() < until){ try { last = await ev(cdp, expr); } catch (e) { last = String(e); } if (last) return last; await sleep(50); }
  throw new Error("timeout " + label + " last=" + JSON.stringify(last)); }

async function main(){
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.attach(t.webSocketDebuggerUrl);
  let bad = 0; const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
  try {
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 1200, deviceScaleFactor: 1, mobile: true, screenWidth: 900, screenHeight: 1200 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: APP });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object"`, "boot");
    // build a notebook + note and turn on the favourites bar with a locked list (so it is wanted)
    const fx = await ev(cdp, `(async () => { const C = MarginCore;
      const nb = await C.createNotebook("__bardot " + Date.now(), "slate");
      const n = (await C.notesIn(nb.id))[0];
      const cfg = await C.getMeta("cfg", {});
      cfg.favBar = true; cfg.favMin = false; cfg.favPos = { x: 240, y: 360 };
      cfg.lockList = true; cfg.favTools = ["undo","pen1"];
      await C.setMeta("cfg", cfg);
      return { nbId: nb.id, noteId: n.id }; })()`);
    await cdp.send("Page.navigate", { url: `${APP}?bardot=${Date.now()}#/nb/${fx.nbId}/note/${fx.noteId}` });
    await waitFor(cdp, `document.getElementById("body")?.dataset.noteId === ${JSON.stringify(fx.noteId)}`, "note open");
    await ev(cdp, `(typeof buildFavBar==="function") && buildFavBar()`);
    await sleep(150);
    const shown = await ev(cdp, `(() => { const b=document.getElementById("favBar");
      if (!b || b.hidden) return null; const r=b.getBoundingClientRect(); return { left:Math.round(r.left), top:Math.round(r.top) }; })()`);
    eq("the favourites bar is shown at its saved position (~240,360)",
       shown && Math.abs(shown.left - 240) < 20 && Math.abs(shown.top - 360) < 20);

    // minimise: click the mini button
    await ev(cdp, `document.getElementById("favMini").click()`);
    await sleep(120);
    const dot = await ev(cdp, `(() => { const d=document.getElementById("favDot");
      if (!d || d.hidden) return null; const r=d.getBoundingClientRect(); return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) }; })()`);
    eq("minimising shows the dot", !!dot);

    // hold the dot ~450ms to open (pointerdown, wait past the 400ms hold, pointerup) — no movement
    await ev(cdp, `(() => { const d=document.getElementById("favDot");
      d.dispatchEvent(new PointerEvent("pointerdown", { bubbles:true, pointerId:1, clientX:${dot.x}, clientY:${dot.y} })); return true; })()`);
    await sleep(480);
    await ev(cdp, `(() => { const d=document.getElementById("favDot");
      d.dispatchEvent(new PointerEvent("pointerup", { bubbles:true, pointerId:1, clientX:${dot.x}, clientY:${dot.y} })); return true; })()`);
    await sleep(150);

    const after = await ev(cdp, `(() => { const b=document.getElementById("favBar"), cfgp=(window.cfg&&cfg.favPos)||null;
      const r=b&&!b.hidden?b.getBoundingClientRect():null;
      return { barLeft:r?Math.round(r.left):null, barTop:r?Math.round(r.top):null, hidden:!b||b.hidden, cfgPos:cfgp }; })()`);
    eq("after re-opening, the bar is visible again", !after.hidden);
    eq("the bar did NOT jump to the top-left corner (0,0)",
       after.barLeft !== null && (after.barLeft > 20 || after.barTop > 20));
    eq("the bar returned to ~its saved position (240,360)",
       after.barLeft !== null && Math.abs(after.barLeft - 240) < 30 && Math.abs(after.barTop - 360) < 30);
    console.log(JSON.stringify({ build: await ev(cdp, `MarginCore.BUILD`), shown, dot, after }, null, 2));
  } finally { try { await fetch(`${CDP}/json/close/${t.id}`); } catch(_){} }
  process.exitCode = bad ? 1 : 0;
  console.log(bad ? `\n${bad} failed` : "\nall bar-dot browser checks passed");
}
main().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
