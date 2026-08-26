/* Pure navigation model for Margin's proposed Chunks browsing layer.

   Chunks are navigation only: page ids and titles remain untouched. Existing
   pages with no chunkId form one implicit chunk, and a new chunk is offered
   only while creating a page more than four hours after the preceding ordinary
   page in the same section. No DOM and no index.html source matching. */

import assert from "node:assert/strict";

let bad = 0;
function check(label, fn){
  try {
    fn();
    console.log("  ok   " + label);
  } catch (err){
    bad++;
    console.log("  FAIL " + label);
    console.log("       " + err.message);
  }
}

const FOUR_HOURS = 4 * 60 * 60 * 1000;

function isOrdinaryPage(page){
  return !!page && !page.deletedAt && !page.worksFor && !page.drawerKind;
}

function shouldOfferChunk({reason, lastPage, newPage}){
  if (reason !== "new-page") return false;
  if (!isOrdinaryPage(lastPage) || !isOrdinaryPage(newPage)) return false;
  if (lastPage.notebookId !== newPage.notebookId) return false;
  if ((lastPage.sectionId || null) !== (newPage.sectionId || null)) return false;
  const gap = Number(newPage.createdAt) - Number(lastPage.createdAt);
  return Number.isFinite(gap) && gap > FOUR_HOURS;
}

function byOrder(a, b){
  const ao = Number.isFinite(Number(a.navOrder)) ? Number(a.navOrder)
           : Number.isFinite(Number(a.order)) ? Number(a.order)
           : Number(a.createdAt) || 0;
  const bo = Number.isFinite(Number(b.navOrder)) ? Number(b.navOrder)
           : Number.isFinite(Number(b.order)) ? Number(b.order)
           : Number(b.createdAt) || 0;
  if (ao !== bo) return ao - bo;
  return String(a.id).localeCompare(String(b.id));
}

function chunkGroupsForSection(sectionId, chunks, pages){
  const sectionPages = (pages || [])
    .filter(isOrdinaryPage)
    .filter(p => (p.sectionId || null) === (sectionId || null));
  const explicit = (chunks || [])
    .filter(c => c && !c.deletedAt && c.sectionId === sectionId)
    .slice().sort(byOrder);
  const valid = new Map(explicit.map(c => [c.id, c]));
  const assigned = new Map(explicit.map(c => [c.id, []]));
  const implicit = [];

  sectionPages.forEach(page => {
    const chunk = page.chunkId && valid.get(page.chunkId);
    if (!chunk) implicit.push(page);
    else assigned.get(chunk.id).push(page);
  });

  const groups = [];
  if (implicit.length || explicit.length === 0){
    groups.push({id:null, implicit:true,
      name:explicit.length ? "Earlier pages" : "All pages",
      pages:implicit.slice().sort(byOrder)});
  }
  explicit.forEach(chunk => {
    const mine = assigned.get(chunk.id).slice().sort(byOrder);
    /* An empty record is not a navigable chunk. It can exist briefly while sync
       delivers the parent before its page, but it must not consume a C number. */
    if (mine.length) groups.push({id:chunk.id, implicit:false,
      name:chunk.name || "Chunk", pages:mine});
  });
  return groups;
}

function addressMap(sections, chunks, pages){
  const ordinary = (sections || [])
    .filter(s => s && !s.deletedAt && !s.kind)
    .slice().sort(byOrder);
  const out = {};
  ordinary.forEach((section, si) => {
    const groups = chunkGroupsForSection(section.id, chunks, pages);
    groups.forEach((group, ci) => {
      group.pages.forEach((page, pi) => {
        out[page.id] = {
          text:`S${si + 1}C${ci + 1}P${pi + 1}`,
          sectionId:section.id,
          chunkId:group.id,
          pageId:page.id
        };
      });
    });
  });
  return out;
}

console.log("new-page chunk offer:");
const base = {id:"p1", notebookId:"nb", sectionId:"s1", createdAt:1_000};
check("no preceding page means no offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:null, newPage:base}), false);
});
check("exactly four hours does not offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS}}), false);
});
check("four hours plus one millisecond does offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), true);
});
check("a manual action never creates or offers a chunk", () => {
  assert.equal(shouldOfferChunk({reason:"manual", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});
check("a gap across sections does not offer in the new section", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",sectionId:"s2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});
check("drawer/working pages never participate", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:{...base,worksFor:"source"},
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});

console.log("implicit chunk compatibility:");
const legacyPages = [
  {id:"p2",notebookId:"nb",sectionId:"s1",title:"Second",navOrder:2},
  {id:"p1",notebookId:"nb",sectionId:"s1",title:"First",navOrder:1}
];
check("no chunk records gives one implicit chunk containing every page", () => {
  const groups = chunkGroupsForSection("s1", [], legacyPages);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].implicit, true);
  assert.deepEqual(groups[0].pages.map(p => p.id), ["p1","p2"]);
});
check("a missing chunk reference recovers into the implicit chunk", () => {
  const groups = chunkGroupsForSection("s1", [], [{...legacyPages[0],chunkId:"missing"}]);
  assert.deepEqual(groups[0].pages.map(p => p.id), ["p2"]);
});
check("legacy pages stay in C1 before explicit chunks", () => {
  const chunks = [{id:"c1",sectionId:"s1",order:1,name:"Class 1"}];
  const pages = legacyPages.concat([{id:"p3",notebookId:"nb",sectionId:"s1",
    chunkId:"c1",title:"Third",navOrder:3}]);
  const groups = chunkGroupsForSection("s1", chunks, pages);
  assert.deepEqual(groups.map(g => g.id), [null,"c1"]);
});
check("working and summary drawer pages receive no implicit chunk", () => {
  const pages = legacyPages.concat([
    {id:"w1",sectionId:"s1",worksFor:"p1",navOrder:3},
    {id:"sum",sectionId:"s1",drawerKind:"summary",navOrder:4}
  ]);
  assert.deepEqual(chunkGroupsForSection("s1", [], pages)[0].pages.map(p => p.id), ["p1","p2"]);
});

console.log("derived S-C-P addresses:");
const sections = [
  {id:"s2",order:20,name:"Research"},
  {id:"s1",order:10,name:"Teaching"},
  {id:"drawer",order:999,kind:"working",name:"Working"}
];
const chunks = [
  {id:"cB",sectionId:"s1",order:30,name:"Class B"},
  {id:"cA",sectionId:"s1",order:20,name:"Class A"}
];
const pages = [
  {id:"legacy",sectionId:"s1",title:"Do not rename me",navOrder:1},
  {id:"a2",sectionId:"s1",chunkId:"cA",title:"Circuit",navOrder:2},
  {id:"a1",sectionId:"s1",chunkId:"cA",title:"FPGA",navOrder:1},
  {id:"b1",sectionId:"s1",chunkId:"cB",title:"Meeting",navOrder:1},
  {id:"s2p",sectionId:"s2",title:"Paper",navOrder:1},
  {id:"work",sectionId:"drawer",worksFor:"a1",title:"old working name",navOrder:1}
];
check("address is derived separately and never rewrites the title", () => {
  const before = pages.map(p => p.title);
  const map = addressMap(sections, chunks, pages);
  assert.equal(map.legacy.text, "S1C1P1");
  assert.equal(map.a1.text, "S1C2P1");
  assert.equal(map.a2.text, "S1C2P2");
  assert.equal(map.b1.text, "S1C3P1");
  assert.equal(map.s2p.text, "S2C1P1");
  assert.equal(map.work, undefined);
  assert.deepEqual(pages.map(p => p.title), before);
});
check("input array order does not change addresses", () => {
  assert.deepEqual(addressMap(sections, chunks, pages),
    addressMap(sections.slice().reverse(), chunks.slice().reverse(), pages.slice().reverse()));
});
check("reordering recomputes the address while ids, links and titles stay stable", () => {
  const before = addressMap(sections, chunks, pages);
  const reorderedChunks = chunks.map(c => c.id === "cB" ? {...c,order:15} : c);
  const reorderedPages = pages.map(p => p.id === "a2" ? {...p,navOrder:0} : p);
  const reorderedSections = sections.map(s => s.id === "s2" ? {...s,order:5} : s);
  const after = addressMap(reorderedSections, reorderedChunks, reorderedPages);
  assert.equal(before.a1.text, "S1C2P1");
  assert.equal(after.a1.text, "S2C3P2");
  assert.equal(after.a1.pageId, "a1");
  assert.equal(pages.find(p => p.id === "a1").title, "FPGA");
});

process.exitCode = bad ? 1 : 0;

