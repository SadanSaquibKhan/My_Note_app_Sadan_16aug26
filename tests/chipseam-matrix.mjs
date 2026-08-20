/*
 * 78 real-browser seam scenarios. Each case delegates to chipseam-browser.mjs,
 * which creates a real IndexedDB notebook with unequal saved page heights and
 * ink, then drives Chrome's native touch input. Run with the local server and
 * CDP Chrome described at the top of that file.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.join(here, "chipseam-browser.mjs");
const valueArg = name => {
  const hit = process.argv.find(x => x.startsWith("--" + name + "="));
  return hit ? Number(hit.slice(name.length + 3)) : null;
};
const from = Math.max(1, valueArg("from") || 1);
const limit = valueArg("limit") || Infinity;

const within = [];
for (let s = 1; s <= 3; s++) {
  for (let p = 1; p <= 2; p++) {
    within.push({ direction:"forward", source:`s${s}p${p}`, target:`s${s}p${p + 1}` });
    within.push({ direction:"back", source:`s${s}p${p + 1}`, target:`s${s}p${p}` });
  }
}
const boundaries = [
  { direction:"forward", source:"s1p3", target:"s2p1" },
  { direction:"back", source:"s2p1", target:"s1p3" },
  { direction:"forward", source:"s2p3", target:"s3p1" },
  { direction:"back", source:"s3p1", target:"s2p3" }
];
/* At global progress zero jumpNb0 deliberately covers bookChip, so native
   touch cannot exercise that chip there. The first-page join remains covered
   by secChip; notebook-chip cases begin at the next genuinely hittable page. */
const notebook = [...within, ...boundaries].filter(x => !x.source.startsWith("s1"));
const representative = [
  { chip:"sec", direction:"forward", source:"s1p1", target:"s1p2" },
  { chip:"sec", direction:"back", source:"s1p2", target:"s1p1" },
  { chip:"book", direction:"forward", source:"s2p2", target:"s2p3" },
  { chip:"book", direction:"back", source:"s2p1", target:"s1p3" },
  { chip:"sec", direction:"forward", source:"s3p2", target:"s3p3" },
  { chip:"sec", direction:"back", source:"s3p3", target:"s3p2" },
  { chip:"book", direction:"forward", source:"s2p3", target:"s3p1" },
  { chip:"book", direction:"back", source:"s3p1", target:"s2p3" }
];

const cases = [];
function add(label, base, extra = {}) {
  cases.push({ label, ...base, ...extra });
}
within.forEach((x, i) => add(`section slow ${i + 1}`, { chip:"sec", ...x }));
notebook.forEach((x, i) => add(`notebook slow ${i + 1}`, { chip:"book", ...x }));
within.forEach((x, i) => add(`section fast ${i + 1}`, { chip:"sec", ...x }, { speed:"fast" }));
notebook.forEach((x, i) => add(`notebook fast ${i + 1}`, { chip:"book", ...x }, { speed:"fast" }));
representative.forEach((x, i) => add(`zoom 75% ${i + 1}`, x, { zoom:0.75 }));
representative.forEach((x, i) => add(`zoom 150% ${i + 1}`, x, { zoom:1.5 }));
representative.forEach((x, i) => add(`left-handed ${i + 1}`, x, { lefty:true }));
representative.forEach((x, i) => add(`continue after join ${i + 1}`, x, { continue:12 }));

function run(c) {
  const args = [harness, "--assert", `--chip=${c.chip}`, `--direction=${c.direction}`,
    `--source=${c.source}`, `--target=${c.target}`];
  if (c.speed) args.push(`--speed=${c.speed}`);
  if (c.zoom) args.push(`--zoom=${c.zoom}`);
  if (c.lefty) args.push("--lefty");
  if (c.continue) args.push(`--continue=${c.continue}`);
  return new Promise(resolve => {
    execFile(process.execPath, args, { cwd:path.dirname(here), timeout:45000, maxBuffer:4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        let result = null;
        try {
          const a = stdout.indexOf("{"), b = stdout.lastIndexOf("}");
          if (a >= 0 && b >= a) result = JSON.parse(stdout.slice(a, b + 1));
        } catch (_) {}
        resolve({ error, stdout, stderr, result });
      });
  });
}

let failed = 0, ran = 0;
const chosen = cases.slice(from - 1, from - 1 + limit);
for (let i = 0; i < chosen.length; i++) {
  const c = chosen[i], absolute = from + i;
  const r = await run(c);
  ran++;
  if (r.error || !r.result) {
    failed++;
    console.log(`FAIL ${absolute}/${cases.length} ${c.label}: ${r.error?.message || "no JSON"}`);
    const detail = (r.stderr || r.stdout || "").trim().split(/\r?\n/).slice(-4).join(" | ");
    if (detail) console.log("     " + detail);
    continue;
  }
  const m = r.result.metric;
  console.log(`ok   ${String(absolute).padStart(2)}/${cases.length} ${c.label}` +
    ` raw=${m.rawMountSeamPx}px held=${m.seamPx}px changes=${m.pageChanges}`);
}
console.log(`\n${ran} real-browser scenarios run, ${failed} failed (matrix total ${cases.length})`);
process.exitCode = failed ? 1 : 0;
