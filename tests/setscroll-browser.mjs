/* Real-browser check: a drag to SCROLL the Settings list must not flip a control
   it started on, while a still tap still toggles it. Needs headless Chrome :9222
   and a server for the working dir. Run: node tests/setscroll-browser.mjs */
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
async function waitFor(cdp, expr, label, timeout = 15000){ const until = Date.now()+timeout; let last;
  while (Date.now() < until){ try { last = await ev(cdp, expr); } catch(e){ last = String(e); } if (last) return last; await sleep(50); }
  throw new Error("timeout " + label + " last=" + JSON.stringify(last)); }

async function main(){
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.attach(t.webSocketDebuggerUrl);
  let bad = 0; const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
  try {
    await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 820, height: 1000, deviceScaleFactor: 1, mobile: true, screenWidth: 820, screenHeight: 1000 });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: APP });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object" && !!document.getElementById("setBtn")`, "boot");
    await sleep(300);
    await ev(cdp, `document.getElementById("setBtn").click()`);
    // open the "While writing" group and pick a checkbox mid-list
    await waitFor(cdp, `(() => { const d=document.getElementById("setDlg"); return d && d.open && !!document.getElementById("setHover"); })()`, "settings open");
    await ev(cdp, `(() => { const g=document.querySelector('.setgroup[data-group="write"]'); if(g) g.open=true; return true; })()`);
    await sleep(120);
    const box = await ev(cdp, `(() => { const c=document.getElementById("setHover"); const lab=c.closest("label"); const r=lab.getBoundingClientRect();
      return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), checked:c.checked }; })()`);
    const build = await ev(cdp, `MarginCore.BUILD`);

    // 1) DRAG (scroll) starting on the checkbox — pointerdown, move 40px, click at release
    await ev(cdp, `(() => { const c=document.getElementById("setHover"); const lab=c.closest("label");
      function pe(type, y){ lab.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,clientX:${box.x},clientY:y})); }
      pe("pointerdown", ${box.y}); pe("pointermove", ${box.y - 20}); pe("pointermove", ${box.y - 45});
      lab.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:${box.x},clientY:${box.y - 45}}));
      pe("pointerup", ${box.y - 45}); return true; })()`);
    const afterDrag = await ev(cdp, `document.getElementById("setHover").checked`);
    eq("a drag (scroll) starting on the checkbox does NOT toggle it", afterDrag === box.checked);

    // 2) TAP (no move) — pointerdown then click, no movement
    await ev(cdp, `(() => { const c=document.getElementById("setHover"); const lab=c.closest("label");
      lab.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerId:1,clientX:${box.x},clientY:${box.y}}));
      lab.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:${box.x},clientY:${box.y}}));
      lab.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true,pointerId:1,clientX:${box.x},clientY:${box.y}}));
      return true; })()`);
    const afterTap = await ev(cdp, `document.getElementById("setHover").checked`);
    eq("a still tap DOES toggle it", afterTap === !box.checked);
    console.log(JSON.stringify({ build, box, afterDrag, afterTap }, null, 2));
  } finally { try { await fetch(`${CDP}/json/close/${t.id}`); } catch(_){} }
  process.exitCode = bad ? 1 : 0;
  console.log(bad ? `\n${bad} failed` : "\nall settings-scroll browser checks passed");
}
main().catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
