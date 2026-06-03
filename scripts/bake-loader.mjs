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
const FRAMES = 96 // total frames (build-up, then it holds the last frame)
const COLS = 12 // sprite-sheet columns
const ROWS = Math.ceil(FRAMES / COLS)

// Animation tuning (must match the *feel* we want; runtime just plays frames).
const LAYER_COUNT = 4
const LAYER_SIZE = 3.2
const LAYER_GAP = 0.95 // vertical distance between layer centers
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

const FRAME=${FRAME}, FRAMES=${FRAMES}, COLS=${COLS};
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
  // Transparent face: stars only (no black fill).
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

  // ---- Planets: a full circular silhouette per planet, centered on the -----
  // layer plane so the circle shows both above and below the square. Each is a
  // filled black disc (occludes stars/layers behind it) with a white outline
  // ring. Both are billboarded to face the camera, so they read as clean 2D
  // circles from the current view.
  let pr=seedRand(700+i*13);
  const planetCount=2+Math.floor(pr()*2); // 2..3
  const radius=0.17; // all planets the same size
  const edgeMargin=0.45; // min gap between a planet's circle and the square edge
  const m=LAYER_SIZE/2-radius-edgeMargin; // keep planets clear of the edges
  const minDist=radius*2+0.30; // minimum center-to-center spacing
  // Pick well-separated centers via rejection sampling.
  const centers=[];
  for(let p=0;p<planetCount;p++){
    let cx=0,cz=0;
    for(let attempt=0;attempt<40;attempt++){
      cx=(pr()*2-1)*m; cz=(pr()*2-1)*m;
      if(centers.every(c=>Math.hypot(c.x-cx,c.z-cz)>=minDist)) break;
    }
    centers.push({x:cx,z:cz});
  }
  const planetMats=[];
  for(let p=0;p<planetCount;p++){
    const px=centers[p].x;
    const pz=centers[p].z;

    // Filled black disc (full circle) — opaque so it hides what's behind it.
    const discMat=new THREE.MeshBasicMaterial({
      color:0x000000,transparent:true,opacity:0,toneMapped:false,depthWrite:true,
      side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,
    });
    const disc=new THREE.Mesh(new THREE.CircleGeometry(radius,96),discMat);
    disc.position.set(px,0,pz);
    disc.renderOrder=2;

    // White outline: full ring of the same radius.
    const ringMat=new THREE.MeshBasicMaterial({
      color:0xffffff,transparent:true,opacity:0,toneMapped:false,side:THREE.DoubleSide,
    });
    const ringW=0.03; // outline thickness
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius-ringW,radius+ringW,96),ringMat);
    ring.position.set(px,0,pz);
    ring.renderOrder=3;

    g.add(disc); g.add(ring);
    planetMats.push({discMat,ringMat,disc,ring});
  }

  scene.add(g);
  layers.push({g,y,startAt:i*BUILD_DELAY,lineMat,planeMat,planetMats});
}

function renderAt(time){
  for(const L of layers){
    const t=Math.min(Math.max((time-L.startAt)/BUILD_DURATION,0),1);
    const e=easeOut(t);
    L.g.position.y=L.y+(1-e)*BUILD_FALL;
    L.lineMat.opacity=e;
    L.planeMat.opacity=e;

    for(const P of L.planetMats){
      P.discMat.opacity=e;
      P.ringMat.opacity=0.9*e;
      // Billboard disc + outline to face the camera so each reads as a clean
      // 2D circle centered on the layer plane (visible above and below it).
      P.disc.quaternion.copy(camera.quaternion);
      P.ring.quaternion.copy(camera.quaternion);
    }
  }
  renderer.render(scene,camera);
}

const sheet=document.getElementById('sheet');
const sctx=sheet.getContext('2d');

for(let f=0;f<FRAMES;f++){
  const time=f/FPS;
  renderAt(time);
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
