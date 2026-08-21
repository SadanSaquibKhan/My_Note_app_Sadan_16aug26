/* Real-browser check for the cross-page ink shift (Bug G). A vertical stroke at
   the SAME page-x on two adjacent pages must render at the SAME screen-x in the
   LIVE ink layer (#inkLayer) and in the PEEK band (#nextPeekInk). Before the fix
   the peek drew it one centering-margin too far right. Needs headless Chrome :9222
   + a server for the working dir. Run: node tests/peekink-browser.mjs */
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
async function waitFor(cdp, expr, label, timeout = 20000){ const until = Date.now()+timeout; let last;
  while (Date.now() < until){ try { last = await ev(cdp, expr); } catch(e){ last = String(e); } if (last) return last; await sleep(50); }
  throw new Error("timeout " + label + " last=" + JSON.stringify(last)); }

function fixtureExpr(){
  return `(async () => {
    const C = MarginCore;
    const nb = await C.createNotebook("__peekink " + Date.now(), "slate");
    const s1 = (await C.sectionsIn(nb.id))[0];
    let first = (await C.notesIn(nb.id))[0]; const made = [];
    for (let pn = 1; pn <= 2; pn++){
      let n = (pn === 1) ? first : await C.createNote(nb.id, "P"+pn, s1.id);
      await C.saveNote(n.id, { title: "P"+pn, sectionId: s1.id, html: "<p>page "+pn+"</p>" });
      const a = await C.getPageInk(n.id, { create: true });
      const st = C.newStroke("pen", "ink", 3);
      /* a straight VERTICAL line at page-x = 400, from y=200 to y=1200 */
      st.pts = [400,200,.7, 400,500,.7, 400,800,.7, 400,1100,.7, 400,1200,.7];
      await C.saveAsset(a.id, { strokes: [st] });
      made.push({ id: n.id, key: "p"+pn });
    }
    return { nbId: nb.id, pages: made };
  })()`;
}
/* median device-pixel column of drawn (alpha>20) pixels across several rows,
   converted to a SCREEN x via the canvas rect. */
const measureExpr = id => `(() => {
  const cv = document.getElementById(${JSON.stringify(id)});
  if (!cv || !cv.width || !cv.height) return null;
  const ctx = cv.getContext("2d"); const rect = cv.getBoundingClientRect();
  const cols = [];
  for (const fy of [0.2,0.35,0.5,0.65,0.8]){
    const y = Math.min(cv.height-1, Math.max(0, Math.round(cv.height*fy)));
    let row; try { row = ctx.getImageData(0, y, cv.width, 1).data; } catch(e){ return {error:String(e)}; }
    let sum=0, n=0;
    for (let x=0; x<cv.width; x++){ if (row[x*4+3] > 20){ sum+=x; n++; } }
    if (n) cols.push(sum/n);
  }
  if (!cols.length) return null;
  cols.sort((a,b)=>a-b); const centerDev = cols[Math.floor(cols.length/2)];
  const cssX = centerDev / (cv.width / rect.width);
  return { screenX: Math.round(rect.left + cssX), rows: cols.length, rectLeft: Math.round(rect.left), cvw: cv.width, rectw: Math.round(rect.width) };
})()`;

async function main(){
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.attach(t.webSocketDebuggerUrl);
  let bad = 0; const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
  try {
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    /* wide pane so the 794px sheet actually gets a centering margin (the bug is
       invisible when #paper is narrower than the sheet). */
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: true, screenWidth: 1600, screenHeight: 1000 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: APP });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object"`, "boot");
    /* a stale service worker from earlier test runs keeps serving an old cached
       build in this headless profile; unregister it + clear caches, then reload
       fresh so we actually test the working build. */
    await ev(cdp, `(async () => { try {
      if (navigator.serviceWorker){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
      if (window.caches){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
    } catch(e){} return true; })()`);
    await cdp.send("Page.navigate", { url: APP + "?fresh=" + Date.now() });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object"`, "boot2");
    const build0 = await ev(cdp, `MarginCore.BUILD`);
    eq("the test is running the working build (not a stale cached one)", /b16[0-9]/.test(build0 || ""));
    const fx = await ev(cdp, fixtureExpr());
    const p1 = fx.pages[0], p2 = fx.pages[1];
    await cdp.send("Page.navigate", { url: `${APP}?peek=${Date.now()}#/nb/${fx.nbId}/note/${p1.id}` });
    await waitFor(cdp,
      `document.getElementById("body")?.dataset.noteId === ${JSON.stringify(p1.id)} &&
       !document.getElementById("nextPeek")?.hidden &&
       document.getElementById("nextPeekInk")?.getAttribute("data-for") === ${JSON.stringify(p2.id)}`,
      "P1 open + P2 peek", 20000);
    await ev(cdp, `document.getElementById("paper").scrollTop = document.getElementById("prevPeek").getBoundingClientRect().height`);
    await sleep(500);
    const live = await ev(cdp, measureExpr("inkLayer"));
    const peek = await ev(cdp, measureExpr("nextPeekInk"));
    const build = await ev(cdp, `MarginCore.BUILD`);
    console.log(JSON.stringify({ build, live, peek }, null, 2));
    eq("the live ink layer drew the vertical stroke", live && live.screenX != null);
    eq("the peek band drew the vertical stroke", peek && peek.screenX != null);
    if (live && peek && live.screenX != null && peek.screenX != null){
      const diff = Math.abs(live.screenX - peek.screenX);
      console.log("   |live.screenX - peek.screenX| = " + diff + "px");
      eq("peek ink is at the SAME screen-x as live ink (<= 3px)", diff <= 3);
    }
  } finally { try { await fetch(`${CDP}/json/close/${t.id}`); } catch(_){} }
  process.exitCode = bad ? 1 : 0;
  console.log(bad ? `\n${bad} failed` : "\nall peek-ink parity checks passed");
}
main().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
