var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");

/* every id="..." that exists in the markup */
var have = {};
var re = /\sid="([A-Za-z0-9_\-]+)"/g, m;
while ((m = re.exec(html))) have[m[1]] = (have[m[1]] || 0) + 1;

/* every $("...") the script asks for */
var want = {};
var re2 = /\$\("([A-Za-z0-9_\-]+)"\)/g;
while ((m = re2.exec(html))) want[m[1]] = (want[m[1]] || 0) + 1;

var missing = Object.keys(want).filter(function(k){ return !have[k]; });
var dupes = Object.keys(have).filter(function(k){ return have[k] > 1; });

console.log("ids defined in markup : " + Object.keys(have).length);
console.log("ids requested by $()  : " + Object.keys(want).length);

if (missing.length){
  console.log("\nMISSING — $() asks for these but no element has the id:");
  missing.forEach(function(k){ console.log("   " + k + "   (" + want[k] + " use(s))"); });
} else {
  console.log("\nok  every $() target exists in the markup");
}
if (dupes.length){
  console.log("\nDUPLICATE ids (getElementById returns only the first):");
  dupes.forEach(function(k){ console.log("   " + k + " x" + have[k]); });
} else {
  console.log("ok  no duplicate ids");
}
/* unused ids are fine, but list the new ones so nothing was added and forgotten */
var NEW = ["favBar","favGrip","favPop","favPick","setFavBar","marksRow","marksCount","markBtn",
           "setHints","setKeepFoot","setGlide","glideOut","setGlideStop","glideStopOut",
           "setCurve","setStabilise","setFavSize","favSizeOut","curveOut","stabiliseOut",
           "zoomPop","zoomPop100","zoomPopFit","foldPanels","favMini","favEdit","favDot",
           "prevPeek","prevPeekBody","prevPeekInk","nextPeekInk","setUndo","setReset","setCount",
           "lassoShapeBtn","penBtnOut","screenBtn","screenBox","screenOut",
           "blockWall","blockWhy","blockRetry","blockReload","dropMark","imgMenu",
           "imgCrop","imgUncrop","imgMove","imgLock","insertPageBtn","nbTabs","nbTabStrip",
           "nbTabMenu","nbOpenList","gpDlg","gpName","gpSwatches","gpParent","gpSave",
           "gpCancel","gpDelete","gpDlgHead","nbGroup","addGroup","flowCue","setPageFlow",
           "setSmooth","smoothOut","setZoomMin","setZoomMax","zoomMinOut","zoomMaxOut",
           "evenWidthBtn","setEvenWidth",
           "jumpBar","jumpGrip","jumpMini","jumpHome","jumpOpen","jumpPlaces",
           "jumpDot","jumpPop","setJumpBar","addSectionBtn",
           "secDlg","secDlgHead","secName","secSwatches","secDelete","secCancel","secSave",
           "secPane","sectionList","railTog","secTog",
           "lassoStyle","lassoMoreBtn","lassoMore","fixNamesBtn",
           "edgeStack","edgeList","edgeSec","edgeRail",
           "lassoPaste","lassoStylePop","lassoSwatches","lassoInkStyle","lassoTextStyle",
           "lassoBold","lassoItalic","lassoUnder","lassoHl","lassoToText","setLassoContain",
           "setLockList","setLockSec","setLockRail","setTapGrow",
           "railGrip","secGrip","listGrip","secChip","bookChip","lassoGrip",
           "featGuideBtn","featDlg","featX","featClose","featBody",
           "jumpNb0","jumpNb1","jumpNb2","jumpTabs",
           "chromeTabs","chromeStrip","chromeNew","tabUndo","tabUndoBtn",
           "setSimple","setAll","simpleBarBtn","simpleGroupPick","simpleBarPick",
           "imgGrip","exportFullBtn","syncUrl","syncKey","syncSave","syncNow","syncStat","syncChip",
           "fullScrBtn","topTabsBtn","chromeHome","homeBoard","homeTitle","homeAll","homeFolders",
           "homeBooks","homeBooksTitle","homeAddGroup","homeAddNb","recentGrip","recentHide",
           "recentShow","railFoot","railFootHide","railFootMin","railFootShow",
           "coverBand","sumBtn","srcBadge"];
var bad = NEW.filter(function(k){ return !have[k]; });
console.log((bad.length ? "\nNEW ELEMENTS MISSING: " + bad.join(", ")
                        : "\nok  all " + NEW.length + " newly added elements are present"));
process.exitCode = (missing.length || bad.length) ? 1 : 0;
