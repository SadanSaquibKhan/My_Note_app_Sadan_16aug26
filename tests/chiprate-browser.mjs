/* Measure chip-drag scroll RATE uniformity in a real browser.
 * Equal-height N-page fixture, open middle page, slow constant-velocity chip
 * drag, sample {fingerY, scrollTop, mountedId} every step, then report the
 * scroll rate (Δglobalscroll per Δfingerpx) so we can see if the join is faster
 * than the page body (the user's report). Global scroll stitches pages together
 * so a swap does not reset the measured position.
 *
 * Chrome CDP on 127.0.0.1:9222 and a server serving THIS working dir must run.
 * Run: node tests/chiprate-browser.mjs [--dir=forward|back] [--chip=book|sec] [--port=8770]
 */
const CDP = "http://127.0.0.1:9222";
const arg = (n, d) => { const p = process.argv.find(x => x.startsWith(`--${n}=`)); return p ? p.slice(n.length + 3) : d; };
const PORT = arg("port", "8770");
const APP = `http://127.0.0.1:${PORT}/index.html`;
const DIR = arg("dir", "forward");
const CHIP = arg("chip", "book");
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Cdp {
  constructor(ws){ this.ws = ws; this.seq = 0; this.pending = new Map(); }
  static async attach(wsUrl){
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("ws timeout")), 5000);
      ws.addEventListener("open", () => { clearTimeout(t); res(); }, { once: true });
      ws.addEventListener("error", e => { clearTimeout(t); rej(e.error || e); }, { once: true }); });
    const c = new Cdp(ws);
    ws.addEventListener("message", e => { const m = JSON.parse(String(e.data));
      if (m.id && c.pending.has(m.id)){ const p = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? p.reject(new Error(p.method + ": " + m.error.message)) : p.resolve(m.result || {}); } });
    return c;
  }
  send(method, params = {}){ const id = ++this.seq;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej, method });
      this.ws.send(JSON.stringify({ id, method, params })); }); }
}
async function ev(cdp, expression){
  const out = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (out.exceptionDetails){ const d = out.exceptionDetails; throw new Error(d.exception?.description || d.text || "eval failed"); }
  return out.result ? out.result.value : undefined;
}
async function waitFor(cdp, expr, label, timeout = 20000){
  const until = Date.now() + timeout; let last;
  while (Date.now() < until){ try { last = await ev(cdp, expr); } catch (e) { last = String(e); } if (last) return last; await sleep(50); }
  throw new Error("timeout " + label + " last=" + JSON.stringify(last));
}

function fixtureExpr(){
  return `(async () => {
    const C = MarginCore;
    const nb = await C.createNotebook("__chiprate " + Date.now(), "slate");
    const secs = await C.sectionsIn(nb.id); const s1 = secs[0];
    await C.updateSection(s1.id, { name: "Sec1", order: 1 });
    const s2 = await C.createSection(nb.id, "Sec2", "blue", { order: 2 });
    const s3 = await C.createSection(nb.id, "Sec3", "green", { order: 3 });
    let first = (await C.notesIn(nb.id))[0]; const made = [];
    async function page(sec, sn, pn){
      let n = (sn===1 && pn===1) ? first : await C.createNote(nb.id, "S"+sn+"P"+pn, sec.id);
      const lines = [];
      for (let i = 0; i < 40; i++){ const nn = String(i+1).padStart(2,"0");
        lines.push('<p data-qa="s'+sn+'p'+pn+'-l'+nn+'">S'+sn+'P'+pn+' line '+nn+'</p>'); }
      await C.saveNote(n.id, { title: "S"+sn+"P"+pn, sectionId: sec.id, html: lines.join("") });
      made.push({ id: n.id, key: "s"+sn+"p"+pn });
    }
    for (const row of [[s1,1],[s2,2],[s3,3]]) for (let pn=1; pn<=3; pn++) await page(row[0], row[1]===1?1:row[1], pn);
    const extra = {}; made.forEach((n,i) => { extra[n.id] = [0,750,1500,750,0,1500,0,1500,750][i]; });
    await C.setMeta("pageExtra", extra);
    for (let i = 0; i < made.length; i++){
      const n = made[i]; const a = await C.getPageInk(n.id, { create: true });
      const st = C.newStroke("pen", "ink", 2.2); const h = 1500 + extra[n.id];
      st.pts = [72,150,.55, 180,260,.6, 110,Math.max(500,h-170),.7, 360,Math.max(520,h-110),.62];
      await C.saveAsset(a.id, { strokes: [st], h });
    }
    return { nbId: nb.id, pages: made };
  })()`;
}

async function main(){
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.attach(t.webSocketDebuggerUrl);
  try {
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 1200, deviceScaleFactor: 1, mobile: true, screenWidth: 900, screenHeight: 1200 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: APP });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object"`, "boot");
    const fx = await ev(cdp, fixtureExpr());
    const pageOrder = fx.pages.map(p => p.id);
    const startIdx = 4;                           // s2p2: middle of section 2, neighbours both ways in-section
    const mid = fx.pages[startIdx];
    const nbrKey = DIR === "back" ? fx.pages[startIdx-1].key : fx.pages[startIdx+1].key;
    const route = `${APP}?rate=${Date.now()}#/nb/${fx.nbId}/note/${mid.id}`;
    await cdp.send("Page.navigate", { url: route });
    // wait for the page AND the peek band we will scroll toward to be populated
    const peekBody = DIR === "back" ? "prevPeekBody" : "nextPeekBody";
    const peekWrap = DIR === "back" ? "prevPeek" : "nextPeek";
    await waitFor(cdp,
      `document.getElementById("body")?.dataset.noteId === ${JSON.stringify(mid.id)} &&
       !document.getElementById("${peekWrap}")?.hidden &&
       document.querySelectorAll("#${peekBody} [data-qa^='${nbrKey}-']").length > 5`,
      "mid page + neighbour peek", 20000);
    await ev(cdp, `(() => { const p=document.getElementById("paper"), prev=document.getElementById("prevPeek");
      const pad=prev.getBoundingClientRect().height; const live=document.getElementById("body").getBoundingClientRect().height;
      p.scrollTop = ${JSON.stringify(DIR)}==="back" ? pad+Math.max(0,live-p.clientHeight) : pad;
      p.dispatchEvent(new Event("scroll",{bubbles:true})); return p.scrollTop; })()`);
    await sleep(200);

    const chipId = CHIP === "book" ? "bookChip" : "secChip";
    // measure hit + track, then touchStart IMMEDIATELY (no ev in between, so the chip cannot tuck away)
    const start = await ev(cdp, `(() => { const el=document.getElementById(${JSON.stringify(chipId)}); const r=el.getBoundingClientRect();
      const p=document.getElementById("paper").getBoundingClientRect(); const track={top:p.top+28,h:Math.max(80,p.height-56)};
      let hx=Math.round((r.left+r.right)/2), hy=Math.round((r.top+r.bottom)/2), found=false;
      scan: for (let yy=Math.ceil(r.top+2); yy<=Math.floor(r.bottom-2); yy+=2){ for (let xx=Math.ceil(r.left+2); xx<=Math.floor(r.right-2); xx+=2){
        const h=document.elementFromPoint(xx,yy); if (h===el||el.contains(h)){ hx=xx; hy=yy; found=true; break scan; } } }
      return { x:hx, y:hy, track, found }; })()`);
    const point = (x, y) => [{ x, y, radiusX: 7, radiusY: 7, force: 0.65, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(start.x, start.y) });
    await sleep(20);
    const engaged = await ev(cdp, `document.body.classList.contains("chipdrag")`);
    const track = start.track;

    const dy = DIR === "back" ? -1 : 1;
    const log = []; let y = start.y;
    for (let step = 0; step < 260; step++){
      y += dy * 1;
      if (y < 8 || y > 1192) break;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(start.x, y) });
      await sleep(14);
      const s = await ev(cdp, `(() => { const p=document.getElementById("paper"), b=document.getElementById("body");
        return { scrollTop:Math.round(p.scrollTop), mounted:b.dataset.noteId,
                 swapping:document.body.classList.contains("swapping"),
                 book:document.getElementById("bookChip").textContent, sec:document.getElementById("secChip").textContent }; })()`);
      log.push({ y, prog: +((y - track.top) / track.h).toFixed(3), ...s });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(300);
    const after = await ev(cdp, `({ mounted:document.getElementById("body").dataset.noteId, scrollTop:Math.round(document.getElementById("paper").scrollTop), book:document.getElementById("bookChip").textContent })`);
    const key = id => { const p = fx.pages.find(p => p.id === id); return p ? p.key : String(id).slice(-4); };
    // rate d(scrollTop)/d(fingerpx) across the FIRST mounted page (before any swap):
    // near-uniform = flat curve; the old bug = low in the body then a big spike at the join.
    // longest clean single-page run (same mounted, not swapping) — avoids the harness's start bounce
    let bestSeg = [], cur = [];
    for (const r of log){
      if (r.swapping){ if (cur.length > bestSeg.length) bestSeg = cur; cur = []; continue; }
      if (cur.length && r.mounted !== cur[cur.length-1].mounted){ if (cur.length > bestSeg.length) bestSeg = cur; cur = []; }
      cur.push(r);
    }
    if (cur.length > bestSeg.length) bestSeg = cur;
    const fseg = bestSeg;
    const first0 = fseg.length ? fseg[0].mounted : null;
    const rateCurve = [];
    for (let i = 2; i < fseg.length; i++){ const dyv = fseg[i].y - fseg[i-2].y; if (!dyv) continue;
      rateCurve.push(Math.round((fseg[i].scrollTop - fseg[i-2].scrollTop) / dyv)); }
    const pos = rateCurve.filter(r => r > 0);
    const rmin = pos.length ? Math.min(...pos) : null, rmax = pos.length ? Math.max(...pos) : null;
    // print every step where mounted or label changed, plus first/last
    const lbl = CHIP === "book" ? "book" : "sec";
    let prev = null; const seq = [];
    log.forEach((r, i) => { const tag = key(r.mounted) + "|" + r[lbl] + "|sw=" + (r.swapping?1:0);
      if (tag !== prev || i === 0 || i === log.length - 1){ seq.push(`y=${r.y} prog=${r.prog} mnt=${key(r.mounted)} scr=${r.scrollTop} ${lbl}=${r[lbl]}${r.swapping?" SW":""}`); prev = tag; } });
    console.log(JSON.stringify({ build: await ev(cdp, `MarginCore.BUILD`), dir: DIR, chip: CHIP, engaged,
      startY: Math.round(start.y), steps: log.length, firstPage: key(first0), firstSegFrames: fseg.length,
      rateMin_px_per_fingerpx: rmin, rateMax_px_per_fingerpx: rmax,
      joinVsBodySpread: (rmin && rmax) ? +(rmax/rmin).toFixed(2) : null,
      rateCurve: rateCurve,
      release: { mounted: key(after.mounted), scrollTop: after.scrollTop, book: after.book } }, null, 2));
    console.log("SEQ (mounted/label changes):"); seq.forEach(s => console.log("  " + s));
  } finally { try { await fetch(`${CDP}/json/close/${t.id}`); } catch(_){} }
}
main().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
