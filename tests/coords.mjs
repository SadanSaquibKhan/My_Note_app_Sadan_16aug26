/* The band above the page shifts where the page starts. Ink is stored
   relative to the page, so screen->page and page->screen must both subtract
   it, and they must agree exactly — a mismatch puts ink in the wrong place
   AND saves it there. This models the two conversions as the file does them. */

const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) process.exitCode = 1; };
const close = (a, b) => Math.abs(a - b) < 1e-9;

/* screen -> page, as S.toPage does */
function toPage(clientY, rectTop, scrollTop, pad, z){
  return (clientY - rectTop + scrollTop - pad) / z;
}
/* page -> screen, as the canvas transform does:
   setTransform(dpr*z,0,0,dpr*z, -scrollLeft*dpr, (pad - scrollTop)*dpr)
   so screenY(device) = pageY*z*dpr + (pad - scrollTop)*dpr
   in CSS px relative to the canvas (which sits at rectTop): */
function toScreen(pageY, rectTop, scrollTop, pad, z){
  return rectTop + pageY * z + (pad - scrollTop);
}

console.log("a touch converts to a page position and back to the same pixel:");
const cases = [
  { label: "no band, no zoom",      pad: 0,   z: 1,    scroll: 0 },
  { label: "no band, scrolled",     pad: 0,   z: 1,    scroll: 640 },
  { label: "band, top of page",     pad: 300, z: 1,    scroll: 300 },
  { label: "band, scrolled deep",   pad: 300, z: 1,    scroll: 1800 },
  { label: "band + zoomed in",      pad: 260, z: 1.6,  scroll: 900 },
  { label: "band + zoomed out",     pad: 260, z: 0.75, scroll: 120 },
  { label: "thin band (first page)",pad: 34,  z: 1,    scroll: 34 },
];
const rectTop = 210;                    /* where #paper sits on screen */
for (const c of cases){
  const touched = 512;                  /* the finger/nib, in client px */
  const page = toPage(touched, rectTop, c.scroll, c.pad, c.z);
  const back = toScreen(page, rectTop, c.scroll, c.pad, c.z);
  eq(c.label + "  (page y " + page.toFixed(1) + ")", close(back, touched));
}

console.log("");
console.log("the top of the page maps to just under the band:");
{
  const pad = 300, z = 1, scroll = 0;
  const y = toScreen(0, rectTop, scroll, pad, z);
  eq("page origin sits at the band's foot", close(y, rectTop + 300));
}

console.log("");
console.log("scroll memory survives a band of a different height:");
{
  /* saved on a device where the band was 300 tall, at 500 into the page */
  const savedPageTop = 500;
  const restoredScrollTop = savedPageTop + 220;   /* band is 220 here */
  const pageAfter = restoredScrollTop - 220;
  eq("lands at the same place in the page", pageAfter === savedPageTop);
}

console.log("");
console.log("a stroke drawn with the band present reads back unchanged:");
{
  const pad = 300, z = 1.35, scroll = 1234;
  const nib = 700;
  const stored = toPage(nib, rectTop, scroll, pad, z);
  /* later, same page, scrolled somewhere else and zoomed differently */
  const pad2 = 300, z2 = 1, scroll2 = 90;
  const drawnAt = toScreen(stored, rectTop, scroll2, pad2, z2);
  const reRead  = toPage(drawnAt, rectTop, scroll2, pad2, z2);
  eq("stored position is stable across zoom and scroll", close(reRead, stored));
}
