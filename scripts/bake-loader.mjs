/**
 * Pre-renders the loading-screen "stack build-up" animation into a single
 * sprite-sheet PNG (opaque black squares on a transparent sheet) so the
 * runtime loader can play it back as a
 * dirt-cheap 2D flipbook (no live WebGL, no shader compile, never starved by
 * the main scene compiling on first paint).
 *
 * The animation is deterministic and stepped frame-by-frame (not real-time),
 * so the output is identical on every machine.
 *
 *   Run:  npm run bake:loader
 *   Out:  src/assets/loader-stack.png   (FRAMES across one row)
 *
 * Keep these constants in sync with the values consumed by LoadingScreen.jsx
 * (they're re-declared there as FRAME_SIZE / FRAME_COUNT / etc.).
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/assets/loader-stack.png')

/* ----------------------------- bake settings ----------------------------- */
const FRAME = 384 // px per frame
const FRAMES = 96 // total frames (build-up, then a seamless orbit loop)
const COLS = 12 // sprite-sheet columns
const ROWS = Math.ceil(FRAMES / COLS)

// Frame at which the stack has finished building; frames [LOOP_START, FRAMES)
// form a seamless orbit loop the runtime replays. Planets complete a whole
// number of revolutions across that span so the wrap is invisible.
const LOOP_START = 48

// Animation tuning (must match the *feel* we want; runtime just plays frames).
const LAYER_COUNT = 4
const LAYER_SIZE = 3.2
const LAYER_GAP = 0.78 // vertical distance between layer centers
const BUILD_DELAY = 0.32 // seconds between each layer dropping in
const BUILD_FALL = 0.85
const BUILD_DURATION = 0.6
const FPS = 30 // playback rate the runtime will assume

const html = /* html */ `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  #sheet{display:block}
</style></head>
<body>
<canvas id="sheet" width="${COLS * FRAME}" height="${ROWS * FRAME}"></canvas>
<script type="module">
import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.js'

const FRAME=${FRAME}, FRAMES=${FRAMES}, COLS=${COLS}, LOOP_START=${LOOP_START};
const LAYER_COUNT=${LAYER_COUNT}, LAYER_SIZE=${LAYER_SIZE}, LAYER_GAP=${LAYER_GAP};
const BUILD_DELAY=${BUILD_DELAY}, BUILD_FALL=${BUILD_FALL}, BUILD_DURATION=${BUILD_DURATION};
const FPS=${FPS};
const easeOut=(t)=>1-Math.pow(1-t,3);
// Deterministic per-seed PRNG (same generator the star texture uses).
const seedRand=(seed)=>{let r=seed*9301+49297;return ()=>{r=(r*9301+49297)%233280;return r/233280;};};

function starTexture(seed){
  const S=512, c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d');
  let r=seed*9301+49297; const rand=()=>{r=(r*9301+49297)%233280;return r/233280;};
  // Opaque black face so each layer reads as a solid black panel (stars on top).
  ctx.fillStyle='#000000'; ctx.fillRect(0,0,S,S);
  const n=70+Math.floor(rand()*40);
  ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1;
  for(let i=0;i<n;i++){
    const x=rand()*S,y=rand()*S,rad=1.2+rand()*2.6;
    ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
    if(rand()>0.88){const l=4+rand()*4;ctx.beginPath();ctx.moveTo(x-l,y);ctx.lineTo(x+l,y);ctx.moveTo(x,y-l);ctx.lineTo(x,y+l);ctx.stroke();}
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}

// Renderer with alpha so frames are transparent.
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(2);
renderer.setSize(FRAME,FRAME,false);
renderer.setClearColor(0x000000,0);
renderer.localClippingEnabled=true;

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(24,1,0.1,100);
// Equal X/Z so the view sits on the square diagonal — a corner points at camera.
const camDist=Math.hypot(8.4,9.6)/Math.SQRT2;
camera.position.set(camDist,6.6,camDist);
camera.lookAt(0,0,0);

const mid=(LAYER_COUNT-1)/2;
const layers=[];
for(let i=0;i<LAYER_COUNT;i++){
  const g=new THREE.Group();
  const y=(i-mid)*LAYER_GAP;
  // square outline built from 4 thin boxes so the line weight is real geometry
  // with sharp corners (GL LineBasicMaterial is always 1px and reads too faint
  // when the frame is downscaled).
  const h=LAYER_SIZE/2;
  const T=0.03; // edge thickness
  const lineMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,toneMapped:false});
  const outline=new THREE.Group();
  const mkBar=(w,d,x,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,T,d),lineMat);m.position.set(x,0,z);outline.add(m);};
  const span=LAYER_SIZE+T;
  mkBar(span,T,0,-h); // back
  mkBar(span,T,0, h); // front
  mkBar(T,span,-h,0); // left
  mkBar(T,span, h,0); // right
  const line=outline;
  // Square face: transparent, stars only (fades in with the layer).
  const planeMat=new THREE.MeshBasicMaterial({
    map:starTexture(i+1),
    transparent:true,
    opacity:0,
    depthWrite:false,
    side:THREE.DoubleSide,
    toneMapped:false,
  });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(LAYER_SIZE,LAYER_SIZE),planeMat);
  plane.rotation.x=-Math.PI/2; plane.position.y=0.001;
  g.add(plane); g.add(line);

  // ---- Mini solar system on the top layer only: a central sun + two small ----
  // planets riding flat orbital rings. Bodies use the same design as before
  // (filled black disc + white outline ring, billboarded to read as clean 2D
  // circles); the orbit rings lie flat in the layer plane.
  const bodies=[]; // {discMat,ringMat,disc,ring} — opacity + billboard each frame
  const orbiters=[]; // moving planets: {disc,ring,radius,baseAngle,step}
  const orbitMats=[];
  if(i===LAYER_COUNT-1){
    const mkBody=(cx,cz,r,ringW)=>{
      const discMat=new THREE.MeshBasicMaterial({
        color:0x000000,transparent:true,opacity:0,toneMapped:false,depthWrite:true,
        side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,
      });
      const disc=new THREE.Mesh(new THREE.CircleGeometry(r,80),discMat);
      disc.position.set(cx,0,cz); disc.renderOrder=2;
      const ringMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,toneMapped:false,side:THREE.DoubleSide});
      const ring=new THREE.Mesh(new THREE.RingGeometry(r-ringW,r+ringW,80),ringMat);
      ring.position.set(cx,0,cz); ring.renderOrder=3;
      g.add(disc); g.add(ring);
      const obj={discMat,ringMat,disc,ring};
      bodies.push(obj);
      return obj;
    };

    const orbits=[0.55,0.95];
    for(const orad of orbits){
      const oMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,toneMapped:false});
      const oRing=new THREE.Mesh(new THREE.TorusGeometry(orad,0.008,8,120),oMat);
      oRing.rotation.x=Math.PI/2; // flat with the layer plane
      oRing.renderOrder=1;
      g.add(oRing);
      orbitMats.push(oMat);
    }

    // Central sun (static, a touch larger).
    mkBody(0,0,0.20,0.035);

    // Two planets that orbit. Each completes a whole number of revolutions over
    // the loop span so the replay is seamless (inner faster than outer).
    const loopSpan=FRAMES-LOOP_START;
    const mkPlanet=(orad,baseAngle,revs)=>{
      const b=mkBody(Math.cos(baseAngle)*orad,Math.sin(baseAngle)*orad,0.12,0.025);
      orbiters.push({disc:b.disc,ring:b.ring,radius:orad,baseAngle,step:2*Math.PI*revs/loopSpan});
    };
    mkPlanet(orbits[0],0.7,2); // inner
    mkPlanet(orbits[1],2.4,1); // outer
  }

  scene.add(g);
  layers.push({g,y,startAt:i*BUILD_DELAY,lineMat,planeMat,bodies,orbiters,orbitMats});
}

function renderAt(frame){
  const time=frame/FPS;
  for(const L of layers){
    const t=Math.min(Math.max((time-L.startAt)/BUILD_DURATION,0),1);
    const e=easeOut(t);
    L.g.position.y=L.y+(1-e)*BUILD_FALL;
    L.lineMat.opacity=e;
    L.planeMat.opacity=e;

    // Advance the orbiting planets (continuous from frame 0; whole revolutions
    // across the loop span keep the wrap seamless).
    for(const o of L.orbiters){
      const a=o.baseAngle+frame*o.step;
      const px=Math.cos(a)*o.radius, pz=Math.sin(a)*o.radius;
      o.disc.position.set(px,0,pz);
      o.ring.position.set(px,0,pz);
    }

    for(const b of L.bodies){
      b.discMat.opacity=e;
      b.ringMat.opacity=0.9*e;
      // Billboard disc + outline so each body reads as a clean 2D circle.
      b.disc.quaternion.copy(camera.quaternion);
      b.ring.quaternion.copy(camera.quaternion);
    }
    for(const oMat of L.orbitMats) oMat.opacity=0.7*e;
  }
  renderer.render(scene,camera);
}

const sheet=document.getElementById('sheet');
const sctx=sheet.getContext('2d');

for(let f=0;f<FRAMES;f++){
  renderAt(f);
  const col=f%COLS, row=Math.floor(f/COLS);
  sctx.drawImage(renderer.domElement,col*FRAME,row*FRAME,FRAME,FRAME);
}

window.__sheetDataURL=sheet.toDataURL('image/png');
window.__baked=true;
</script>
</body></html>`

const browser = await chromium.launch({
  chromiumSandbox: false,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
page.on('console', (m) => console.log('[page]', m.text()))

await page.setContent(html, { waitUntil: 'load' })
await page.waitForFunction(() => window.__baked === true, { timeout: 60000 })

const dataURL = await page.evaluate(() => window.__sheetDataURL)
const base64 = dataURL.replace(/^data:image\/png;base64,/, '')
writeFileSync(OUT, Buffer.from(base64, 'base64'))
await browser.close()

console.log(
  `Baked ${FRAMES} frames -> ${OUT}\n` +
    `Sheet ${COLS}x${ROWS} @ ${FRAME}px (playback ${FPS} fps)`,
)
