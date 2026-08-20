/*
 * Real-browser regression harness for the navigation-chip page seam.
 *
 * Prerequisites (kept explicit so this test never downloads anything):
 *   python -m http.server 8765 --bind 127.0.0.1
 *   chrome --headless=new --remote-debugging-port=9222 --remote-allow-origins=*
 *
 * Run against the app served from the repository root:
 *   node tests/chipseam-browser.mjs
 *   node tests/chipseam-browser.mjs --chip=sec --assert
 *
 * The fixture is deliberately not a DOM mock. It is written through
 * MarginCore into IndexedDB, includes three sections, unequal saved sheet
 * heights and real page-ink records, and is then opened through the normal
 * hash route. The drag is sent through Chrome's native touch input path.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = name => {
  const p = process.argv.find(x => x.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : null;
};
const APP = arg("url") || "http://127.0.0.1:8765/index.html";
const CDP = arg("cdp") || "http://127.0.0.1:9222";
const CHIP = arg("chip") || "book";
const DIRECTION = arg("direction") || "back";
const SOURCE_KEY = arg("source");
const TARGET_KEY = arg("target");
const ZOOM = Math.max(0.5, Math.min(2, Number(arg("zoom") || 1)));
const LEFTY = process.argv.includes("--lefty");
const FAST = (arg("speed") || "slow") === "fast";
const STEP_PX = FAST ? 6 : 1;
const STEP_DELAY_MS = FAST ? 3 : 18;
const SHOULD_ASSERT = process.argv.includes("--assert");
const KEEP_TARGET = process.argv.includes("--keep-target");
const MAX_SEAM_PX = Number(arg("max-seam") || 2);
const CONTINUE_PX = Number(arg("continue") || 0);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const median = xs => {
  const a = xs.slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
    this.events = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket timed out")), 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener("error", e => { clearTimeout(timer); reject(e.error || e); }, { once: true });
    });
    this.ws.addEventListener("message", e => {
      const msg = JSON.parse(String(e.data));
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result || {});
        return;
      }
      const waiters = this.events.get(msg.method);
      if (waiters && waiters.length) waiters.splice(0).forEach(fn => fn(msg.params || {}));
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  event(method, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const list = this.events.get(method) || [];
      const done = value => { clearTimeout(timer); resolve(value); };
      list.push(done); this.events.set(method, list);
      const timer = setTimeout(() => {
        const at = list.indexOf(done); if (at >= 0) list.splice(at, 1);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
    });
  }
  close() { if (this.ws) this.ws.close(); }
}

async function json(url, options) {
  const r = await fetch(url, options);
  if (!r.ok) throw new Error(`${options?.method || "GET"} ${url}: ${r.status}`);
  return r.json();
}

async function makeTarget() {
  const target = await json(`${CDP}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!target.webSocketDebuggerUrl) throw new Error("Chrome did not return a page debugger URL");
  return target;
}

async function evaluate(cdp, expression) {
  const out = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (out.exceptionDetails) {
    const d = out.exceptionDetails;
    throw new Error(d.exception?.description || d.text || "Runtime.evaluate failed");
  }
  return out.result ? out.result.value : undefined;
}

async function waitFor(cdp, expression, label, timeout = 15000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    try { last = await evaluate(cdp, expression); } catch (e) { last = String(e); }
    if (last) return last;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last)}`);
}

function fixtureExpression() {
  return `(async () => {
    const C = MarginCore;
    const stamp = Date.now();
    const nb = await C.createNotebook("__chip seam " + stamp, "slate");
    const secs = await C.sectionsIn(nb.id);
    const s1 = secs[0];
    await C.updateSection(s1.id, { name: "Sec1", order: 1 });
    const s2 = await C.createSection(nb.id, "Sec2", "blue", { order: 2 });
    const s3 = await C.createSection(nb.id, "Sec3", "green", { order: 3 });
    let first = (await C.notesIn(nb.id))[0];
    const made = [];
    async function page(sec, sn, pn) {
      let n;
      if (sn === 1 && pn === 1) n = first;
      else n = await C.createNote(nb.id, "S" + sn + "P" + pn, sec.id);
      const lines = [];
      const count = 38 + ((sn * 5 + pn * 7) % 10);
      for (let i = 0; i < count; i++) {
        const nn = String(i + 1).padStart(2, "0");
        lines.push('<p data-qa="s' + sn + 'p' + pn + '-l' + nn + '">' +
          'S' + sn + 'P' + pn + ' line ' + nn + ' — chip seam fixture</p>');
      }
      await C.saveNote(n.id, {
        title: "S" + sn + "P" + pn,
        sectionId: sec.id,
        html: lines.join("")
      });
      made.push({ id: n.id, key: "s" + sn + "p" + pn, sn, pn });
      return n;
    }
    for (const row of [[s1,1],[s2,2],[s3,3]]) {
      for (let pn = 1; pn <= 3; pn++) await page(row[0], row[1], pn);
    }
    const extra = {};
    made.forEach((n, i) => { extra[n.id] = [0, 750, 1500, 750, 0, 1500, 0, 1500, 750][i]; });
    await C.setMeta("pageExtra", extra);
    for (let i = 0; i < made.length; i++) {
      const n = made[i];
      const a = await C.getPageInk(n.id, { create: true });
      const st = C.newStroke("pen", i % 2 ? "blue" : "ink", 2.2);
      const h = 1500 + extra[n.id];
      st.pts = [72, 150, .55, 180, 260, .6, 110, Math.max(500, h - 170), .7,
                360, Math.max(520, h - 110), .62];
      await C.saveAsset(a.id, { strokes: [st], h });
    }
    const cfg = await C.getMeta("cfg", {});
    cfg.leftHand = ${LEFTY ? "true" : "false"};
    await C.setMeta("cfg", cfg);
    return { nbId: nb.id, pages: made };
  })()`;
}

const traceExpression = `(function () {
  window.__chipSeamTrace = [];
  window.__chipSeamTracing = true;
  function positions(root) {
    const out = {};
    if (!root) return out;
    root.querySelectorAll("[data-qa]").forEach(el => {
      const r = el.getBoundingClientRect();
      out[el.getAttribute("data-qa")] = { top: r.top, bottom: r.bottom, height: r.height };
    });
    return out;
  }
  function frame(t) {
    if (!window.__chipSeamTracing) return;
    const p = document.getElementById("paper");
    const b = document.getElementById("body");
    const pr = p && p.getBoundingClientRect();
    const prevPage = document.getElementById("prevPeekPage");
    const nextPage = document.getElementById("nextPeekPage");
    window.__chipSeamTrace.push({
      t,
      noteId: b && b.dataset.noteId || null,
      bodyClass: document.body.className,
      scrollTop: p ? p.scrollTop : null,
      scrollHeight: p ? p.scrollHeight : null,
      clientHeight: p ? p.clientHeight : null,
      paperTop: pr ? pr.top : null,
      paperBottom: pr ? pr.bottom : null,
      prevPad: document.getElementById("prevPeek")?.getBoundingClientRect().height || 0,
      prevPage: prevPage ? { top: prevPage.getBoundingClientRect().top,
                             bottom: prevPage.getBoundingClientRect().bottom,
                             height: prevPage.getBoundingClientRect().height } : null,
      nextPage: nextPage ? { top: nextPage.getBoundingClientRect().top,
                             bottom: nextPage.getBoundingClientRect().bottom,
                             height: nextPage.getBoundingClientRect().height } : null,
      live: positions(b),
      prev: positions(document.getElementById("prevPeekBody")),
      next: positions(document.getElementById("nextPeekBody")),
      secLabel: document.getElementById("secChip")?.textContent || "",
      bookLabel: document.getElementById("bookChip")?.textContent || ""
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
})()`;

async function dragAcross(cdp, direction, chipId, sourceId, targetId) {
  const start = await evaluate(cdp, `(() => {
    const el = document.getElementById(${JSON.stringify(chipId)});
    const r = el.getBoundingClientRect();
    const p = document.getElementById("paper").getBoundingClientRect();
    const track = { top: p.top + 28, h: Math.max(80, p.height - 56) };
    const left = Math.max(1, r.left), right = Math.min(innerWidth - 1, r.right);
    let hitX = Math.round((left + right) / 2), hitY = Math.round((r.top + r.bottom) / 2);
    /* Endpoint jump controls can cover the chip centre; choose a hittable pixel. */
    scan: for (let yy = Math.ceil(r.top + 2); yy <= Math.floor(r.bottom - 2); yy += 2) {
      for (let xx = Math.ceil(left + 2); xx <= Math.floor(right - 2); xx += 2) {
        const h = document.elementFromPoint(xx, yy);
        if (h === el || el.contains(h)) { hitX = xx; hitY = yy; break scan; }
      }
    }
    return { x: hitX, y: hitY,
             rect: { left:r.left, right:r.right, top:r.top, bottom:r.bottom },
             track, prog: ((r.top + r.bottom) / 2 - track.top) / track.h,
             noteId: document.getElementById("body").dataset.noteId,
             hit: document.elementFromPoint(hitX, hitY)?.id || null };
  })()`);
  if (!start || start.noteId !== sourceId) throw new Error(`Wrong source page before drag: ${JSON.stringify(start)}`);
  const point = (x, y) => [{ x, y, radiusX: 7, radiusY: 7, force: 0.65, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(start.x, start.y) });
  let y = start.y;
  let crossed = false;
  let crossY = null;
  const dy = direction === "forward" ? 1 : -1;
  for (let step = 0; step < 520; step++) {
    y += dy * STEP_PX;
    if (y < 6 || y > 1194) break;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(start.x, y) });
    await sleep(STEP_DELAY_MS);
    let status = await evaluate(cdp, `({
      mounted: document.getElementById("body")?.dataset.noteId || null,
      swapping: document.body.classList.contains("swapping")
    })`);
    /* Once the join claims the swap, hold the native touch stationary while
       IndexedDB/rendering mounts the page. Otherwise a very fast test loop can
       queue another commanded pixel and mislabel it as post-mount drift. */
    if (status.swapping && status.mounted !== targetId) {
      await waitFor(cdp,
        `document.getElementById("body")?.dataset.noteId === ${JSON.stringify(targetId)}`,
        "target mount during held join", 5000);
      status.mounted = targetId;
    }
    if (status.mounted === targetId) {
      if (!crossed) {
        crossed = true; crossY = y;
        /* Hold the pointer on the join long enough to catch a delayed landing.
           A separate --continue=N run checks motion after the swap. */
        if (CONTINUE_PX <= 0) { await sleep(120); break; }
      }
      if (Math.abs(y - crossY) >= CONTINUE_PX) break;
    }
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
  return { start, endY: y, crossed, crossY };
}

function seamMetric(trace, sourceId, targetId, prefix, side) {
  const firstAfter = trace.findIndex(f => f.noteId === targetId && Object.keys(f.live || {}).some(k => k.startsWith(prefix)));
  if (firstAfter < 0) {
    const last = trace.slice(-12).map(f => ({ t:f.t, noteId:f.noteId, scrollTop:f.scrollTop,
      bodyClass:f.bodyClass, prevPage:f.prevPage, nextPage:f.nextPage }));
    throw new Error("The target page never became live in the trace: " + JSON.stringify(last));
  }
  let beforeIndex = firstAfter - 1;
  while (beforeIndex >= 0 && !Object.keys(trace[beforeIndex][side] || {}).some(k => k.startsWith(prefix))) beforeIndex--;
  if (beforeIndex < 0) throw new Error("No incoming target preview frame was recorded");
  const before = trace[beforeIndex];
  let pageChanges = 0, lastMounted = sourceId;
  trace.forEach(f => {
    if (f.noteId && f.noteId !== lastMounted) {
      pageChanges++; lastMounted = f.noteId;
    }
  });
  /* paintDoc mounts synchronously, then finishHandover does its geometric
     correction on the following animation frame. Compare with that corrected
     frame, while separately retaining the raw first-mounted displacement. */
  let afterIndex = firstAfter;
  for (let i = firstAfter; i < Math.min(trace.length, firstAfter + 5); i++) {
    afterIndex = i;
    if (!(trace[i].bodyClass || "").split(/\s+/).includes("swapping")) break;
  }
  const after = trace[afterIndex], rawAfter = trace[firstAfter];
  const incoming = before[side] || {};
  const keys = Object.keys(incoming).filter(k => after.live[k]);
  const visible = keys.filter(k => {
    const r = incoming[k];
    return r.bottom > before.paperTop - 20 && r.top < before.paperBottom + 20;
  });
  const use = visible.length ? visible : keys;
  const deltas = use.map(k => after.live[k].top - incoming[k].top);
  const rawDeltas = use.filter(k => rawAfter.live[k]).map(k => rawAfter.live[k].top - incoming[k].top);
  return {
    sourceId,
    targetId,
    pageChanges,
    finalMountedId: lastMounted,
    beforeIndex,
    firstAfterIndex: firstAfter,
    afterIndex,
    frameGapMs: after.t - before.t,
    beforeScrollTop: before.scrollTop,
    afterScrollTop: after.scrollTop,
    scrollTopDelta: after.scrollTop - before.scrollTop,
    beforePrevPad: before.prevPad,
    afterPrevPad: after.prevPad,
    anchorsCompared: use.length,
    visibleAnchorsCompared: visible.length,
    seamPx: median(deltas),
    rawMountSeamPx: median(rawDeltas),
    minPx: deltas.length ? Math.min(...deltas) : null,
    maxPx: deltas.length ? Math.max(...deltas) : null,
    approxSkippedLines: deltas.length ? Math.abs(median(deltas)) / median(use.map(k => incoming[k].height)) : null,
    beforeJoinPage: side === "prev" ? before.prevPage : before.nextPage,
    afterPrevPage: after.prevPage
  };
}

async function main() {
  if (CHIP !== "book" && CHIP !== "sec") throw new Error("--chip must be book or sec");
  if (DIRECTION !== "back" && DIRECTION !== "forward") throw new Error("--direction must be back or forward");
  const target = await makeTarget();
  const cdp = new CdpSession(target.webSocketDebuggerUrl);
  const pageErrors = [];
  try {
    await cdp.open();
    await Promise.all([
      cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Network.enable"),
      cdp.send("Log.enable"), cdp.send("Console.enable")
    ]);
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 900, height: 1200, deviceScaleFactor: 1, mobile: true,
      screenWidth: 900, screenHeight: 1200
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    cdp.ws.addEventListener("message", e => {
      const m = JSON.parse(String(e.data));
      if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text);
      if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params?.entry?.level)) {
        const entry = m.params.entry;
        if (!(entry.url || "").endsWith("/favicon.ico")) pageErrors.push(entry.text);
      }
    });
    await cdp.send("Page.navigate", { url: APP });
    await waitFor(cdp, `document.readyState === "complete" && typeof MarginCore === "object"`, "MarginCore boot");
    const fixture = await evaluate(cdp, fixtureExpression());
    const sourceKey = SOURCE_KEY || (DIRECTION === "back" ? "s3p3" : "s3p2");
    const targetKey = TARGET_KEY || (DIRECTION === "back" ? "s3p2" : "s3p3");
    await evaluate(cdp, `Promise.all(${JSON.stringify(fixture.pages.map(n => n.id))}.map(id => MarginCore.setMeta("zoom:" + id, ${JSON.stringify(ZOOM)})))`);
    fixture.source = fixture.pages.find(n => n.key === sourceKey).id;
    fixture.target = fixture.pages.find(n => n.key === targetKey).id;
    const previewSide = DIRECTION === "back" ? "prev" : "next";
    const previewBody = DIRECTION === "back" ? "prevPeekBody" : "nextPeekBody";
    /* A different query string forces a full document load. A hash-only
       navigation would leave pageExtra in the old in-memory cache even though
       the fixture had just written it to IndexedDB. */
    const joiner = APP.includes("?") ? "&" : "?";
    const route = `${APP}${joiner}chipqa=${Date.now()}#/nb/${fixture.nbId}/note/${fixture.source}`;
    await cdp.send("Page.navigate", { url: route });
    await waitFor(cdp,
      `document.getElementById("body")?.dataset.noteId === ${JSON.stringify(fixture.source)} &&
       !document.getElementById("${DIRECTION === "back" ? "prevPeek" : "nextPeek"}")?.hidden &&
       document.querySelectorAll("#${previewBody} [data-qa^='${targetKey}-']").length > 10`,
      sourceKey.toUpperCase() + " with " + targetKey.toUpperCase() + " preview", 20000);
    await waitFor(cdp,
      `Math.abs((parseFloat(getComputedStyle(document.getElementById("paper")).getPropertyValue("--z")) || 1) - ${JSON.stringify(ZOOM)}) < 0.01 &&
       document.body.classList.contains("lefty") === ${LEFTY ? "true" : "false"}`,
      "requested zoom and handedness", 5000);
    await evaluate(cdp, `(() => {
      const p=document.getElementById("paper"), prev=document.getElementById("prevPeek");
      const pad=prev.getBoundingClientRect().height;
      const live=document.getElementById("body").getBoundingClientRect().height;
      p.scrollTop = ${JSON.stringify(DIRECTION)} === "back"
        ? pad : pad + Math.max(0, live - p.clientHeight);
      p.dispatchEvent(new Event("scroll", { bubbles:true }));
      return {scrollTop:p.scrollTop, prev:pad, live};
    })()`);
    await sleep(120);
    await evaluate(cdp, traceExpression);
    const drag = await dragAcross(cdp, DIRECTION, CHIP === "book" ? "bookChip" : "secChip", fixture.source, fixture.target);
    await evaluate(cdp, `window.__chipSeamTracing = false`);
    const trace = await evaluate(cdp, `window.__chipSeamTrace`);
    if (!trace.some(f => f.noteId === fixture.target)) {
      console.error("DRAG " + JSON.stringify(drag));
      console.error("TRACE " + JSON.stringify({ frames:trace.length,
        ids:[...new Set(trace.map(f => f.noteId))],
        minScroll:Math.min(...trace.map(f => f.scrollTop)), maxScroll:Math.max(...trace.map(f => f.scrollTop)),
        minNext:Math.min(...trace.map(f => f.nextPage?.top ?? Infinity)),
        labels:[...new Set(trace.map(f => f.bookLabel))] }));
    }
    const metric = seamMetric(trace, fixture.source, fixture.target, targetKey + "-", previewSide);
    const artifact = path.join(os.tmpdir(), `margin-chipseam-${CHIP}-${DIRECTION}-${Date.now()}.json`);
    fs.writeFileSync(artifact, JSON.stringify({ build: await evaluate(cdp, `MarginCore.BUILD`), fixture, direction:DIRECTION, drag, metric, pageErrors, trace }, null, 2));
    console.log(JSON.stringify({ build: await evaluate(cdp, `MarginCore.BUILD`), chip: CHIP,
      direction:DIRECTION, source:sourceKey, target:targetKey, zoom:ZOOM,
      handedness:LEFTY ? "left" : "right", speed:FAST ? "fast" : "slow",
      drag, metric, pageErrors, artifact }, null, 2));
    if (!drag.crossed) throw new Error(`${CHIP} chip did not cross ${DIRECTION} from ${sourceKey} to ${targetKey}`);
    if (pageErrors.length) throw new Error(`Browser logged ${pageErrors.length} error(s)`);
    const rawBad = metric.rawMountSeamPx == null || Math.abs(metric.rawMountSeamPx) > MAX_SEAM_PX;
    const holdBad = CONTINUE_PX <= 0 && (metric.seamPx == null || Math.abs(metric.seamPx) > MAX_SEAM_PX);
    const loadBad = metric.pageChanges !== 1 || metric.finalMountedId !== fixture.target;
    if (SHOULD_ASSERT && (rawBad || holdBad || loadBad)) {
      throw new Error(`Visible seam raw=${metric.rawMountSeamPx}px held=${metric.seamPx}px exceeds ${MAX_SEAM_PX}px`);
    }
  } finally {
    cdp.close();
    if (!KEEP_TARGET) {
      try { await fetch(`${CDP}/json/close/${target.id}`); } catch (_) {}
    }
  }
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
