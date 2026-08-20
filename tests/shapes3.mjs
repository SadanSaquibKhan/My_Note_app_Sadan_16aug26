/* Exercise the detectShape that is actually in the file. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const names = ["detectShape", "resampleClosed", "shapeCorners", "inkBounds", "distToSeg"];
const src = names.map(fn => {
  const re = new RegExp("\\n {2}function " + fn + "\\([\\s\\S]*?\\n {2}\\}");
  const m = html.match(re);
  if (!m) { console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
const detectShape = new Function(src + "\n return detectShape;")();

let seed = 7;
const rnd = () => { seed = (seed*1103515245+12345) & 0x7fffffff; return seed/0x7fffffff - 0.5; };
const seg = (a,b,n) => { const p=[]; for(let i=0;i<=n;i++) p.push([a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n]); return p; };
const poly = (cs,per) => { let p=[]; for(let i=0;i<cs.length;i++) p=p.concat(seg(cs[i],cs[(i+1)%cs.length],per)); return p; };
const circle=(cx,cy,rx,ry,n)=>{const p=[];for(let i=0;i<=n;i++){const t=i/n*2*Math.PI;p.push([cx+rx*Math.cos(t),cy+ry*Math.sin(t)]);}return p;};
function noisy(path, wob, gap){
  const out=[]; const stop = gap ? Math.floor(path.length*0.94) : path.length;
  for (let i=0;i<stop;i++) out.push(path[i][0]+rnd()*wob, path[i][1]+rnd()*wob, 0.5);
  return out;
}

const shapes = {
  square:     [poly([[0,0],[200,0],[200,200],[0,200]],14),      "rect"],
  rectangle:  [poly([[0,0],[300,0],[300,160],[0,160]],14),      "rect"],
  rhombus:    [poly([[150,0],[300,110],[150,220],[0,110]],14),  "rhombus"],
  triangle:   [poly([[150,0],[300,220],[0,220]],18),            "triangle"],
  circle:     [circle(150,150,110,110,64),                      "circle"],
  ellipse:    [circle(150,150,140,80,64),                       "circle"],
  line:       [seg([0,0],[320,90],40),                          "line"],
};

let bad = 0;
console.log("shape        wobble gap    read as");
for (const [name,[path,want]] of Object.entries(shapes)){
  for (const [wob,gap] of [[3,false],[7,false],[7,true],[11,true]]){
    seed = 7;
    const r = detectShape(noisy(path, wob, gap));
    const got = r ? r.kind : null;
    const ok = got === want;
    console.log(name.padEnd(12)+String(wob).padEnd(7)+String(gap).padEnd(7)+String(got)+
                (ok?"":"   <-- WRONG, expected "+want));
    if (!ok) bad++;
  }
}
seed = 7;
const scrawl=[]; for(let i=0;i<70;i++) scrawl.push([i*4,100+Math.sin(i/2)*30+Math.sin(i/6)*18]);
const sc = detectShape(noisy(scrawl,3,false));
console.log("\nhandwriting read as " + (sc?sc.kind:null));
if (sc){ console.log("  <-- WRONG, handwriting must be left alone"); bad++; }

/* the shapes keep their place on the page */
seed = 7;
const rh = detectShape(noisy(shapes.rhombus[0],5,false));
const xs = []; for (let i=0;i<rh.pts.length;i+=3) xs.push(rh.pts[i]);
console.log("rhombus drawn across x " + Math.min(...xs).toFixed(0) + ".." + Math.max(...xs).toFixed(0) +
            " (drawn 0..300)");
if (Math.min(...xs) < -30 || Math.max(...xs) > 330){ console.log("  <-- WRONG, moved off its spot"); bad++; }

console.log(bad ? "\n"+bad+" misread" : "\nevery shape read correctly");
process.exitCode = bad ? 1 : 0;
