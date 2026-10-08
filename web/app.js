(function(){
THREE.ColorManagement.legacyMode = false;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const HOME = new THREE.Vector3(17, 13, 17);
camera.position.copy(HOME);
const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 1.8, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 9; controls.maxDistance = 38;
controls.maxPolarAngle = Math.PI*0.47; controls.minPolarAngle = 0.15;
controls.enablePan = false;

// ---------- helpers ----------
const mats = {};
function M(key, color, opts={}){ if(!mats[key]) mats[key]=new THREE.MeshStandardMaterial({color, roughness:.8, metalness:0, ...opts}); return mats[key]; }
function mat(color, opts={}){ return new THREE.MeshStandardMaterial({color, roughness:.8, ...opts}); }
function mesh(geo, material, x=0,y=0,z=0, parent=scene){ const m=new THREE.Mesh(geo, material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; parent.add(m); return m; }
function box(w,h,d,material,x,y,z,parent){ return mesh(new THREE.BoxGeometry(w,h,d), material, x,y,z,parent); }
function rbox(w,h,d,r,material,x,y,z,parent){
  const s=new THREE.Shape(), hw=w/2-r, hh=h/2-r;
  s.moveTo(-hw,-h/2); s.lineTo(hw,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-hh); s.lineTo(w/2,hh); s.quadraticCurveTo(w/2,h/2,hw,h/2);
  s.lineTo(-hw,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,hh); s.lineTo(-w/2,-hh); s.quadraticCurveTo(-w/2,-h/2,-hw,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r*0.6,bevelEnabled:true,bevelThickness:r*0.6,bevelSize:r*0.5,bevelSegments:3,curveSegments:6});
  g.translate(0,0,-(d-2*r*0.6)/2); return mesh(g, material, x,y,z,parent);
}
function cyl(rt,rb,h,material,x,y,z,parent,seg=32){ return mesh(new THREE.CylinderGeometry(rt,rb,h,seg), material,x,y,z,parent); }
function sph(r,material,x,y,z,parent){ return mesh(new THREE.SphereGeometry(r,32,20), material,x,y,z,parent); }
function canvasTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return {tex:t, ctx:g, canvas:c}; }
function rr(g,x,y,w,h,r){ g.beginPath(); if(g.roundRect) g.roundRect(x,y,w,h,r); else g.rect(x,y,w,h); }
const clickables = [];
function clickable(obj, name, act){ obj.traverse(o=>{ if(o.isMesh) o.userData.hit={name,act}; }); clickables.push(obj); }
const toastEl=$('toast'); let toastT;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove('show'),1800); }

// ---------- themes ----------
const THEMES = {
  lofi:  {bg:'#1a1430', wallA:'#4b3a7c', wallB:'#3d2e66', trim:'#7a68b0', floor:'#c48552', rug:'#6b4fb0', rug2:'#8a6fd0', sofa:'#e07a8b', cushion:'#ffd6a5', bean:'#ffb86b', wood:'#a8714a', accent:'#ff8ad1', sign:'ON AIR', lamp:'#ffc37a', sky:['#1b1446','#4b2c7a','#c0608e'], speaker:'#4a3529'},
  hiphop:{bg:'#121116', wallA:'#4a4850', wallB:'#3c3a42', trim:'#f2c94c', floor:'#55505c', rug:'#f2c94c', rug2:'#141418', sofa:'#2c2c33', cushion:'#e63946', bean:'#e63946', wood:'#2f2f36', accent:'#f2c94c', sign:'BOOM BAP', lamp:'#ffe2a0', sky:['#0b0b14','#24243a','#5a4a2a'], speaker:'#1c1c20'},
  rock:  {bg:'#0d0809', wallA:'#2a1a1e', wallB:'#201417', trim:'#ff3b3b', floor:'#33302f', rug:'#8b1e2b', rug2:'#1a1a1c', sofa:'#6e1822', cushion:'#1a1a1c', bean:'#2a2a2e', wood:'#1e1e21', accent:'#ff3b3b', sign:'ROCK ON', lamp:'#ff9a7a', sky:['#0a0508','#2a0d14','#6e1a22'], speaker:'#141416'}
};
let theme = THEMES.lofi;

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xb9a6ff, 0x2a1830, 0.9); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe2c4, 0.75); key.position.set(8,16,10); key.castShadow=true;
key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:50}); key.shadow.bias=-0.0006;
scene.add(key);
const tvLight = new THREE.PointLight(0xff8ad1, 1.2, 9, 1.8); tvLight.position.set(0,3.4,-3.6); scene.add(tvLight);
const winLight = new THREE.PointLight(0x9a86ff, .6, 8, 2); winLight.position.set(-3.8,4,0.2); scene.add(winLight);

// ---------- room shell ----------
const H=6.2, T=0.3, INNER=5.0;
const floorTex = canvasTex(1024,1024,(g,w,h)=>{
  g.fillStyle='#ffffff'; g.fillRect(0,0,w,h);
  const rows=12; for(let r=0;r<rows;r++){ const y=r*h/rows; g.fillStyle=`hsl(0,0%,${86+((r*37)%9)}%)`; g.fillRect(0,y,w,h/rows);
    g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(0,y,w,3); let x=(r*173)%300; while(x<w){ g.fillRect(x,y,3,h/rows); x+=260+((r*x)%180);} }
});
const floorMat = new THREE.MeshStandardMaterial({color:theme.floor, map:floorTex.tex, roughness:.75});
box(10.6,0.6,10.6, M('slab','#2a1f3a'), 0,-0.3,0);
const floorMesh=box(10,0.08,10, floorMat, 0,0.04,0);
const surfMeshes=[floorMesh];

const walls=[];
function wall(w, pos, rotY, k, outside){
  const g=new THREE.Group(); g.position.copy(pos); g.rotation.y=rotY; scene.add(g);
  surfMeshes.push(box(w, H, T, M(k, theme.wallA), 0, H/2, 0, g));
  box(w, 1.5, T+0.04, M(k+'w', theme.wallB), 0, 0.75, 0.01, g);
  box(w, 0.08, T+0.1, M('trim', theme.trim, {emissive:new THREE.Color(theme.trim), emissiveIntensity:.15}), 0, 1.52, 0.02, g);
  box(w+T, 0.18, T+0.12, M('cap','#2a1f3a'), 0, H+0.09, 0, g);
  walls.push({g, outside}); return g;
}
const back  = wall(10.3, new THREE.Vector3(0,0,-5.15), 0,           'wallA', p=>p.z<-5);
const left  = wall(10.3, new THREE.Vector3(-5.15,0,0), Math.PI/2,  'wallL', p=>p.x<-5);
const rightW = wall(10.3, new THREE.Vector3(5.15,0,0), -Math.PI/2, 'wallR', p=>p.x>5);
const frontW = wall(10.3, new THREE.Vector3(0,0,5.15), Math.PI,    'wallF', p=>p.z>5);
// fixed things on walls that decor may not overlap: [centre u, centre v, width, height]
back.userData.blocked=[[0,3.4,5.6,3.4],[0,5.45,4.6,.9]]; left.userData.blocked=[[.2,3.85,6.6,4.4]]; rightW.userData.blocked=[]; frontW.userData.blocked=[];
[back,left,rightW,frontW].forEach((g,i)=>g.userData.wallName=['안쪽 벽','왼쪽 벽','오른쪽 벽','앞쪽 벽'][i]);

// window + wall decor (left wall)
const skyTex = canvasTex(512,360,()=>{});
function drawSky(){ const g=skyTex.ctx, w=512,h=360; const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,theme.sky[0]); gr.addColorStop(.6,theme.sky[1]); gr.addColorStop(1,theme.sky[2]); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='#fff'; for(let i=0;i<40;i++){ g.globalAlpha=.4+((i*13)%6)/10; g.fillRect((i*97)%w,(i*53)%(h*.6),2,2);} g.globalAlpha=1;
  g.fillStyle='#fff4d6'; g.shadowColor='#fff4d6'; g.shadowBlur=30; g.beginPath(); g.arc(120,90,34,0,7); g.fill(); g.shadowBlur=0;
  let x=0; while(x<w){ const bw=30+((x*7)%40), bh=70+((x*13)%120); g.fillStyle='rgba(10,6,20,.85)'; g.fillRect(x,h-bh,bw,bh); g.fillStyle='rgba(255,210,120,.7)'; for(let k=0;k<5;k++) g.fillRect(x+6+((k*11)%(bw-10)),h-bh+12+k*18,4,5); x+=bw+4; }
  skyTex.tex.needsUpdate=true; }
drawSky();
mesh(new THREE.PlaneGeometry(4,2.8), new THREE.MeshBasicMaterial({map:skyTex.tex}), 0.2,3.9,T/2+0.02, left);
const frameMat = M('frame','#efe2cf');
[[0,1.45,4.3,.14],[0,-1.45,4.3,.14],[-2.08,0,.14,3],[2.08,0,.14,3],[0,0,.08,2.8],[0,0.1,4,.08]].forEach(([x,y,w,h])=>box(w,h,.12,frameMat,0.2+x,3.9+y,T/2+0.06,left));
box(4.6,.12,.5, frameMat, 0.2, 2.42, T/2+0.25, left);
[-2.6,3.0].forEach(x=>{ const c=box(.8,4.2,.08, M('curtain','#c45c7d'), x, 3.8, T/2+.15, left); c.rotation.y=.08; });
const posterTex = canvasTex(256,340,(g)=>{ g.fillStyle='#f2e4cf'; g.fillRect(0,0,256,340); g.fillStyle='#ff7f6b'; g.fillRect(16,40,224,224); g.fillStyle='#2a1840'; g.beginPath(); g.arc(128,152,80,0,7); g.fill(); g.fillStyle='#ffd166'; g.beginPath(); g.arc(128,152,22,0,7); g.fill(); g.fillStyle='#2a1840'; g.font='bold 30px sans-serif'; g.fillText('SIDE A',72,310); });
const bulbs=[];
function stringLights(group){ for(let i=0;i<=14;i++){ const t=i/14, x=-4.8+9.6*t, y=5.55-0.25*Math.sin(t*Math.PI*3)**2;
  const b=sph(.07, new THREE.MeshBasicMaterial({color:['#ffd166','#ff8fab','#9bf6ff'][i%3]}), x,y,T/2+0.1, group); b.castShadow=false; bulbs.push(b);} }
stringLights(left); stringLights(back);

// TV (back wall)
const tvC = canvasTex(1024,576,()=>{});
let playing=false, progress=0.38, last=performance.now();
let songTitle='Midnight City — lofi hip hop mix';
function drawTV(t){
  const g=tvC.ctx,w=1024,h=576; const gr=g.createLinearGradient(0,0,w,h);
  gr.addColorStop(0,theme.sky[0]); gr.addColorStop(.55,theme.sky[1]); gr.addColorStop(1,theme.accent); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='#ffd59a'; g.shadowColor='#ffb86b'; g.shadowBlur=60; g.beginPath(); g.arc(w/2,330+Math.sin(t/1600)*6,120,0,7); g.fill(); g.shadowBlur=0;
  g.fillStyle='rgba(20,10,35,.92)'; let x=0,i=0; while(x<w){ const bw=50+((i*37)%60), bh=90+((i*53)%150); g.fillRect(x,h-bh,bw,bh); x+=bw+6; i++; }
  g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(0,0,w,96);
  g.fillStyle='#fff'; g.font='bold 40px "Noto Sans KR", sans-serif'; g.fillText(songTitle,32,58);
  g.fillStyle='#ff3d3d'; rr(g,w-150,26,56,40,10); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.moveTo(w-130,36); g.lineTo(w-108,46); g.lineTo(w-130,56); g.fill();
  g.fillStyle='rgba(255,255,255,.3)'; g.fillRect(32,h-30,w-64,8); g.fillStyle='#ff3d3d'; g.fillRect(32,h-30,(w-64)*progress,8);
  g.beginPath(); g.arc(32+(w-64)*progress,h-26,12,0,7); g.fill();
  if(!playing){ g.fillStyle='rgba(0,0,0,.45)'; g.fillRect(0,0,w,h); g.fillStyle='#fff'; g.beginPath(); g.moveTo(w/2-40,h/2-50); g.lineTo(w/2+55,h/2); g.lineTo(w/2-40,h/2+50); g.fill(); }
  tvC.tex.needsUpdate=true;
}
const tvGroup=new THREE.Group(); tvGroup.position.set(0,0,T/2); back.add(tvGroup);
box(5.3,3.1,.16, M('tvframe','#15101f',{roughness:.4}), 0,3.4,0.08, tvGroup);
const tvScreenMat=new THREE.MeshBasicMaterial({map:tvC.tex, toneMapped:false});
// a 'hole' material: writes transparent pixels so the real YouTube iframe behind the canvas shows through
const tvHoleMat=new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0, blending:THREE.NoBlending});
const tvScreen=mesh(new THREE.PlaneGeometry(5.05,2.84), tvScreenMat, 0,3.4,0.17, tvGroup); tvScreen.castShadow=false;
clickable(tvGroup,'TV · 유튜브 영상 (클릭: 재생/일시정지)', ()=>togglePlay());
const signC = canvasTex(1024,180,()=>{});
function drawSign(){ const g=signC.ctx; g.clearRect(0,0,1024,180); g.font='96px Jua, "Noto Sans KR", sans-serif'; g.textAlign='center'; g.lineWidth=6;
  g.shadowColor=theme.accent; g.shadowBlur=30; g.strokeStyle=theme.accent; g.strokeText('♪ '+theme.sign,512,120); g.shadowBlur=10; g.strokeStyle='#fff'; g.lineWidth=2; g.strokeText('♪ '+theme.sign,512,120); signC.tex.needsUpdate=true; }
drawSign();
mesh(new THREE.PlaneGeometry(4.4,.78), new THREE.MeshBasicMaterial({map:signC.tex, transparent:true, toneMapped:false}), 0,5.45,T/2+0.05, back).castShadow=false;

// rug (decor, not movable)
cyl(2.9,2.9,.03, M('rug',theme.rug), .3,.1,.7, scene, 64).castShadow=false;
cyl(2.1,2.1,.035, M('rug2',theme.rug2), .3,.11,.7, scene, 64).castShadow=false;

// ---------- avatars ----------
function label(text, bg='rgba(20,14,40,.88)', dot='#3ddc97'){
  const w=Math.max(160, text.length*30+70); const {tex}=canvasTex(w,64,(g)=>{ g.fillStyle=bg; rr(g,2,2,w-4,60,30); g.fill();
    g.fillStyle=dot; g.beginPath(); g.arc(32,32,9,0,7); g.fill(); g.fillStyle='#fff'; g.font='bold 30px "Noto Sans KR", sans-serif'; g.textBaseline='middle'; g.fillText(text,52,34); });
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true})); s.scale.set(w/64*.42,.42,1); s.renderOrder=10; return s; }
function bubble(text){
  const w=text.length*34+60; const {tex}=canvasTex(w,96,(g)=>{ g.fillStyle='#fff'; rr(g,2,2,w-4,70,24); g.fill(); g.beginPath(); g.moveTo(40,70); g.lineTo(30,94); g.lineTo(64,70); g.fill();
    g.fillStyle='#2a1a44'; g.font='600 32px "Noto Sans KR", sans-serif'; g.textBaseline='middle'; g.fillText(text,28,38); });
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, depthTest:false, transparent:true})); s.scale.set(w/96*.62,.62,1); s.renderOrder=11; return s; }
const avatars=[];
function buildAvatar(o){
  const g=new THREE.Group(); g.position.set(...o.pos); g.rotation.y=o.rot||0; (o.parent||scene).add(g);
  const skin=mat(o.skin,{roughness:.6}), shirt=mat(o.shirt), pants=mat(o.pants), hair=mat(o.hair,{roughness:.7}), shoe=mat(o.shoes||'#ffffff');
  const sit=o.pose==='sit';
  if(sit){ [-.17,.17].forEach(x=>{ const l=mesh(new THREE.CapsuleGeometry(.13,.42,6,12), pants, x,.15,.3, g); l.rotation.x=Math.PI/2; sph(.15, shoe, x,.12,.62, g); }); }
  const legs=[];
  if(!sit){ [-.17,.17].forEach(x=>{ const hip=new THREE.Group(); hip.position.set(x,.62,0); g.add(hip); mesh(new THREE.CapsuleGeometry(.13,.45,6,12), pants, 0,-.24,0, hip); sph(.16, shoe, 0,-.54,.06, hip); legs.push(hip); }); }
  const by = sit ? .55 : .95;
  mesh(new THREE.CapsuleGeometry(.36,.32,8,16), shirt, 0,by+.2,0, g);
  mesh(new THREE.CapsuleGeometry(.1,.4,6,10), shirt, -.45,by+.18,0, g).rotation.z=.25;
  const armR=mesh(new THREE.CapsuleGeometry(.1,.4,6,10), shirt, .45,by+.18,0, g); armR.rotation.z=-.25;
  if(o.wave){ armR.rotation.z=-2.4; armR.position.set(.55,by+.55,0); }
  const head=new THREE.Group(); head.position.set(0,by+.95,0); g.add(head);
  sph(.5, skin, 0,0,0, head);
  const st=o.style;
  if(st!=='beanie' && st!=='curly') mesh(new THREE.SphereGeometry(st==='short'?.52:.54,32,16,0,Math.PI*2,0,Math.PI*(st==='short'?.42:.52)), hair, 0,.04,-.03, head).rotation.x=st==='short'?-.35:-.25;
  if(st==='bun') sph(.2, hair, 0,.58,-.12, head);
  if(st==='long'){ const b=mesh(new THREE.CapsuleGeometry(.42,.55,6,16), hair, 0,-.35,-.2, head); b.scale.z=.6; }
  if(st==='cap'){ cyl(.32,.32,.04, hair, 0,.32,.42, head).scale.z=1.3; }
  if(st==='curly'){ for(let i=0;i<14;i++){ const a=i/14*Math.PI*2; sph(.17, hair, Math.cos(a)*.42, .22+Math.sin(i*1.7)*.08, Math.sin(a)*.42-.05, head); } sph(.42, hair, 0,.3,-.05, head); }
  if(st==='spiky'){ mesh(new THREE.SphereGeometry(.53,32,16,0,Math.PI*2,0,Math.PI*.4), hair, 0,.04,-.03, head); for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; const c=mesh(new THREE.ConeGeometry(.12,.38,8), hair, Math.cos(a)*.25,.55,Math.sin(a)*.25-.05, head); c.rotation.set(Math.sin(a)*.6,0,-Math.cos(a)*.6); } }
  if(st==='beanie'){ mesh(new THREE.SphereGeometry(.56,32,16,0,Math.PI*2,0,Math.PI*.5), hair, 0,.06,0, head); const band=new THREE.Mesh(new THREE.TorusGeometry(.55,.07,10,32), mat('#f3efe6')); band.rotation.x=Math.PI/2; band.position.y=.08; head.add(band); sph(.13, mat('#f3efe6'), 0,.66,0, head); }
  [-.18,.18].forEach(x=>{ sph(.06, mat('#2a1a20',{roughness:.3}), x,.02,.46, head); if(o.blush!==false) sph(.08, mat('#ff8fa3',{transparent:true,opacity:.6}), x*1.5,-.12,.4, head).scale.z=.4; });
  if(o.glasses){ [-.18,.18].forEach(x=>{ const r=new THREE.Mesh(new THREE.TorusGeometry(.12,.02,8,24), mat(o.glassColor||'#2a1a44')); r.position.set(x,.02,.5); head.add(r); }); }
  if(o.phones){ const band=new THREE.Mesh(new THREE.TorusGeometry(.56,.05,10,32,Math.PI), mat(o.phones)); band.position.y=.05; head.add(band);
    [-.56,.56].forEach(x=>{ cyl(.17,.17,.16, mat(o.phones), x,0,0, head).rotation.z=Math.PI/2; }); }
  const tag=label(o.name, o.tagBg, o.dot); tag.position.set(0,by+1.85+(st==='bun'||st==='spiky'?.15:0),0); g.add(tag);
  let bub=null; if(o.say){ bub=bubble(o.say); bub.position.set(.9,by+2.45,0); g.add(bub); }
  return {g, head, by, bub, legs};
}
function sayOn(a,text){ if(a.chat) a.g.remove(a.chat); const b=bubble(text.slice(0,40)); b.position.set(.9,a.by+2.45,0); a.g.add(b); a.chat=b; a.chatUntil=performance.now()+6000; }
function avatar(o){ const a={o, phase:Math.random()*6, ...buildAvatar(o)}; avatars.push(a); return a; }
function rebuildAvatar(a){ if(a.chat) a.chat=null; a.g.parent&&a.g.parent.remove(a.g); const i=clickables.indexOf(a.g); if(i>=0) clickables.splice(i,1); Object.assign(a, buildAvatar(a.o)); if(a.onBuild) a.onBuild(a); }


// ---------- furniture catalog (each item: group with origin at floor centre; fp = footprint w(x) × d(z)) ----------
const speakers=[]; let record=null;
const CATALOG = {
  console:{name:'TV 콘솔', fp:[4.6,1.2], build(g){
    box(4.6,1.1,1.2, M('wood', theme.wood), 0,.55,0, g).userData.paint=true;
    [-1.5,0,1.5].forEach(x=>box(1.3,.75,.04, M('woodDoor','#8e5f3e'), x,.55,.62, g).userData.paint='sub');
    const tt=new THREE.Group(); tt.position.set(-1,1.1,0); g.add(tt);
    rbox(1.9,.24,1.0,.06, M('ttBody','#efe4d4'), 0,.12,0, tt);
    const rec=new THREE.Group(); rec.position.set(-.15,.27,0); tt.add(rec);
    cyl(.42,.42,.03, M('vinyl','#141418',{roughness:.3}), 0,0,0, rec,48); cyl(.14,.14,.035, M('label','#ff7f6b'), 0,.002,0, rec); box(.06,.01,.3, M('lblStripe','#ffd166'), 0,.02,.08, rec);
    const arm=cyl(.02,.02,.7, M('arm','#bbb',{metalness:.6,roughness:.3}), .62,.36,-.1, tt); arm.rotation.z=Math.PI/2; arm.rotation.y=.6;
    clickable(tt,'턴테이블 (클릭: 재생/일시정지)', ()=>togglePlay()); record=rec;
    const amp=new THREE.Group(); amp.position.set(1.15,1.1,.05); g.add(amp);
    rbox(1.6,.5,.85,.05, M('amp','#2f2a3a'), 0,.25,0, amp);
    [-.5,-.15,.2].forEach(x=>{ cyl(.1,.1,.06, M('knob','#c9c2d8',{metalness:.5}), x,.25,.44, amp).rotation.x=Math.PI/2; });
    box(.4,.18,.02, new THREE.MeshBasicMaterial({color:'#9bf6ff'}), .5,.28,.44, amp);
  }},
  speaker:{name:'스탠드 스피커', fp:[1.05,1.0], build(g){
    rbox(1.05,3,1,.06, M('spk',theme.speaker), 0,1.5,0, g).userData.paint=true;
    g.userData.cones=[];
    [[2.2,.33],[1.0,.4],[2.75,.12]].forEach(([y,r])=>{ const o=cyl(r,r,.05, M('cone','#0e0b0a',{roughness:.5}), 0,y,.5, g); o.rotation.x=Math.PI/2; cyl(r*.45,r*.45,.07, M('dust','#3b2a22'), 0,y,.51, g).rotation.x=Math.PI/2; if(r>.3) g.userData.cones.push(o); });
    clickable(g,'스피커 · 비트에 맞춰 진동', ()=>{ g.userData.kick=1; });
  }},
  shelf:{name:'LP 선반', fp:[1.2,1.1], build(g){
    const wood=M('shelf','#8a5a3b');
    box(1.2,4.2,.06, M('shelfBack','#5a3a26'), 0,2.1,-.52, g).userData.paint='main';
    [-.565,.565].forEach(x=>{ box(.07,4.2,1.1, wood, x,2.1,0, g).userData.paint='main'; });
    [.035,1.05,2.05,3.05,4.165].forEach(y=>{ box(1.06,.07,1.08, wood, 0,y,.01, g).userData.paint='main'; });
    const cols=['#ff6b6b','#ffd166','#06d6a0','#4cc9f0','#b388eb','#f15bb5','#fee440','#00bbf9'];
    for(let k=0;k<4;k++){ const y0=[.07,1.085,2.085,3.085][k];
      for(let r=0;r<8;r++){ if(k===3&&r>5) break; const hh=.78-(r%3)*.06; const rec=box(.08,hh,.78, M('rec'+((r+k*3)%8),cols[(r+k*3)%8],{roughness:.6}), -.41+r*.11,y0+hh/2,-.06, g); if(r===7) rec.rotation.z=-.12; } }
    cyl(.22,.18,.36, M('pot','#e8d6c0'), 0,4.38,0, g);
    [[0,.2,0],[.15,.1,.1],[-.15,.12,-.05]].forEach(([x,y,z])=>sph(.25, M('leaf','#4caf7a'), x,4.65+y,z, g));
    clickable(g,'LP 선반 · 플레이리스트 열기', ()=>{ $('pl').hidden=false; renderPL(); });
  }},
  sofa:{name:'3인 소파', fp:[1.8,5.6], build(g){
    const s=M('sofa',theme.sofa);
    [rbox(1.7,.9,5,.18, s, 0,.45,0, g), rbox(.5,1.5,5,.18, s, -.6,1.2,0, g), rbox(1.8,1.25,.4,.15, s, 0,.62,-2.6, g), rbox(1.8,1.25,.4,.15, s, 0,.62,2.6, g)].forEach(m=>m.userData.paint=true);
    rbox(.9,.3,1.3,.12, M('cushion',theme.cushion), .1,1.05,-1.4, g).userData.paint='sub';
    rbox(.9,.3,1.3,.12, M('cushion2','#f2e8cf'), .1,1.05,.1, g).userData.paint='sub';
    box(1.2,.04,1.1, M('blanket','#9bd1c9'), .2,.92,1.6, g).rotation.y=.12;
  }},
  table:{name:'커피 테이블', fp:[2.4,1.8], build(g){
    rbox(2.4,.16,1.8,.05, M('tableTop','#d9a877'), 0,.8,0, g).userData.paint=true;
    [[-1,-.75],[1,-.75],[-1,.75],[1,.75]].forEach(([x,z])=>cyl(.06,.06,.76, M('leg','#5c3d29'), x,.38,z, g,12).userData.paint='sub');
    cyl(.16,.14,.32, M('mug','#ffffff',{roughness:.4}), -.6,1.04,-.3, g);
    const hp=new THREE.Mesh(new THREE.TorusGeometry(.32,.05,12,32,Math.PI), M('hp',theme.accent)); hp.position.set(.4,.9,.2); hp.rotation.x=-Math.PI/2.4; hp.castShadow=true; g.add(hp);
  }},
  bean:{name:'빈백', fp:[2.2,2.2], build(g){ const b=sph(1, M('bean',theme.bean,{roughness:.95}), 0,.55,0, g); b.scale.set(1.1,.62,1.1); b.userData.paint=true; }},
  lamp:{name:'플로어 조명', fp:[.8,.8], build(g, opt={}){
    cyl(.3,.34,.06, M('lampBase','#2a1f30'), 0,.03,0, g).userData.paint='sub'; cyl(.03,.03,3.2, M('lampBase','#2a1f30'), 0,1.6,0, g,8).userData.paint='sub';
    const shade=cyl(.28,.46,.6, new THREE.MeshStandardMaterial({color:'#ffe2a8',emissive:new THREE.Color('#ffc37a'),emissiveIntensity:.9,side:THREE.DoubleSide}), 0,3.5,0, g);
    shade.userData.paint=true; g.userData.shade=shade;
    if(opt.light){ const l=new THREE.PointLight(theme.lamp, 1.6, 12, 1.6); l.position.set(0,3.6,0); g.add(l); g.userData.light=l; }
    clickable(g,'조명 (클릭: 켜기/끄기)', ()=>{ g.userData.off=!g.userData.off; });
  }},
  plant:{name:'몬스테라 화분', fp:[.9,.9], build(g){
    box(.9,.9,.9, M('planter','#e8d6c0'), 0,.45,0, g).userData.paint=true;
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; const leaf=mesh(new THREE.ConeGeometry(.16,1.6,8), M('leaf2','#3fa36b'), Math.cos(a)*.18,1.6,Math.sin(a)*.18, g); leaf.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5); leaf.userData.paint='sub'; }
  }},
  boombox:{name:'붐박스', fp:[1.5,.7], build(g){
    rbox(1.5,.9,.6,.08, M('boom','#e63946'), 0,.45,0, g).userData.paint=true;
    g.userData.cones=[];
    [-.42,.42].forEach(x=>{ const c=cyl(.26,.26,.05, M('cone','#0e0b0a'), x,.45,.31, g); c.rotation.x=Math.PI/2; g.userData.cones.push(c); cyl(.1,.1,.07, M('gold','#f2c94c',{metalness:.6,roughness:.3}), x,.45,.32, g).rotation.x=Math.PI/2; });
    box(.36,.16,.02, new THREE.MeshBasicMaterial({color:'#9bf6ff'}), 0,.62,.31, g);
    const h=new THREE.Mesh(new THREE.TorusGeometry(.5,.04,8,24,Math.PI), M('handle','#141418')); h.position.y=.9; h.userData.paint='sub'; g.add(h);
    clickable(g,'붐박스 · 비트에 맞춰 진동', ()=>{ g.userData.kick=1; });
  }},
  guitar:{name:'일렉 기타', fp:[.8,.8], build(g){
    cyl(.3,.34,.05, M('stand','#141418'), 0,.03,0, g);
    const gt=new THREE.Group(); gt.position.set(0,.2,0); gt.rotation.x=-.18; g.add(gt);
    const b1=cyl(.42,.42,.12, M('gbody','#e63946',{roughness:.35}), 0,.55,0, gt); b1.rotation.x=Math.PI/2; b1.userData.paint=true;
    const b2=cyl(.32,.32,.12, M('gbody','#e63946',{roughness:.35}), 0,1.05,0, gt); b2.rotation.x=Math.PI/2; b2.userData.paint=true;
    box(.6,.14,.13, M('pick','#f3efe6'), 0,.62,.03, gt);
    box(.1,1.4,.06, M('neck','#8a5a3b'), 0,1.85,0, gt).userData.paint='sub'; box(.18,.32,.06, M('head','#141418'), 0,2.66,0, gt);
  }},
  ampstack:{name:'기타 앰프', fp:[1.4,1.0], build(g){
    rbox(1.4,1.1,1.0,.05, M('ampk','#1a1a1c'), 0,.55,0, g).userData.paint=true;
    rbox(1.4,1.1,1.0,.05, M('ampk','#1a1a1c'), 0,1.66,0, g).userData.paint=true;
    [.55,1.66].forEach(y=>box(1.2,.85,.02, M('grill','#3a3a40',{roughness:1}), 0,y,.51, g));
    box(1.42,.12,1.02, M('gold','#d4a95a',{metalness:.6,roughness:.3}), 0,2.25,0, g).userData.paint='sub';
  }},
  stool:{name:'큐브 스툴', fp:[.8,.8], build(g){
    rbox(.8,.7,.8,.1, M('stool','#ffd166'), 0,.35,0, g).userData.paint=true;
    rbox(.82,.12,.82,.06, M('stoolTop','#2a1f3a'), 0,.72,0, g).userData.paint='sub';
  }},
};
const INVENTORY = ['boombox','guitar','ampstack','stool','bean','plant','lamp','speaker','table','shelf'];
// ---------- wall decor (items hang on a wall group; local x = along the wall, y = height, +z = into the room) ----------
function photoPlaceholder(w,h){ const W=512, Hh=Math.round(512*h/w); return canvasTex(W,Hh,(g)=>{ const gr=g.createLinearGradient(0,0,W,Hh); gr.addColorStop(0,'#3d2e66'); gr.addColorStop(1,'#c0608e'); g.fillStyle=gr; g.fillRect(0,0,W,Hh);
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=6; g.setLineDash([18,12]); g.strokeRect(24,24,W-48,Hh-48); g.setLineDash([]);
  g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 120px sans-serif'; g.fillText('＋',W/2,Hh/2-40); g.font='bold 44px "Noto Sans KR", sans-serif'; g.fillText('사진 넣기',W/2,Hh/2+60); }).tex; }
function frameBuild(w,h){ return g=>{
  box(w,h,.08, M('frameWood','#2a1f30'), 0,0,.04, g).userData.paint='main';
  const mt=mesh(new THREE.PlaneGeometry(w-.14,h-.14), M('frameMat','#f3efe6',{roughness:.95}), 0,0,.081, g); mt.userData.paint='sub';
  const pw=w-.38, ph=h-.38; const ph1=mesh(new THREE.PlaneGeometry(pw,ph), new THREE.MeshStandardMaterial({map:photoPlaceholder(pw,ph),roughness:.6}), 0,0,.083, g);
  ph1.castShadow=false; g.userData.photo=ph1; g.userData.aspect=pw/ph; }; }
const WALLCAT = {
  frameL:{name:'가로 액자', size:[1.6,1.2], build:frameBuild(1.6,1.2), photo:true},
  frameP:{name:'세로 액자', size:[1.0,1.4], build:frameBuild(1.0,1.4), photo:true},
  frameS:{name:'작은 액자', size:[.8,.8], build:frameBuild(.8,.8), photo:true},
  poster:{name:'LP 포스터', size:[1.5,2], build(g){ box(1.56,2.06,.03, M('posterEdge','#f2e4cf'), 0,0,.015, g).userData.paint='main'; mesh(new THREE.PlaneGeometry(1.5,2), new THREE.MeshStandardMaterial({map:posterTex.tex,roughness:.9}), 0,0,.032, g).castShadow=false; }},
  record:{name:'LP 액자', size:[1.1,1.1], build(g){ box(1.1,1.1,.08, M('recFrame','#f3efe6'), 0,0,.04, g).userData.paint='main';
    const d=cyl(.44,.44,.02, M('vinyl','#141418',{roughness:.3}), 0,0,.09, g,48); d.rotation.x=Math.PI/2; const l=cyl(.15,.15,.025, M('recLabel','#ff7f6b'), 0,0,.095, g); l.rotation.x=Math.PI/2; l.userData.paint='sub'; }},
  neon:{name:'네온사인', size:[2.2,.8], build(g){ const t=canvasTex(1024,360,(c)=>{ c.font='170px Jua, "Noto Sans KR", sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.lineWidth=12; c.shadowColor='#fff'; c.shadowBlur=40; c.strokeStyle='#fff'; c.strokeText('VIBES',512,190); c.shadowBlur=0; c.lineWidth=4; c.strokeText('VIBES',512,190); }).tex;
    const n=mesh(new THREE.PlaneGeometry(2.2,.78), new THREE.MeshBasicMaterial({map:t, transparent:true, color:'#9bf6ff', toneMapped:false}), 0,0,.05, g); n.castShadow=false; n.userData.paint='main'; }},
  wshelf:{name:'벽 선반', size:[1.8,.9], build(g){ box(1.8,.08,.5, M('wshelf','#8a5a3b'), 0,-.4,.25, g).userData.paint='main';
    [-.55,-.45,-.35].forEach((x,i)=>{ const r=box(.04,.6,.6, M('rec'+i,['#ff6b6b','#ffd166','#4cc9f0'][i]), x,-.06,.25, g); r.rotation.z=-.15+i*.05; });
    cyl(.14,.11,.22, M('pot','#e8d6c0'), .5,-.25,.25, g); sph(.18, M('leaf','#4caf7a'), .5,-.02,.25, g); }},
  clock:{name:'벽시계', size:[.9,.9], build(g){ const rim=cyl(.45,.45,.08, M('clockRim','#e07a8b'), 0,0,.04, g,48); rim.rotation.x=Math.PI/2; rim.userData.paint='main';
    const face=cyl(.39,.39,.09, M('clockFace','#f3efe6'), 0,0,.045, g,48); face.rotation.x=Math.PI/2; face.userData.paint='sub';
    const hands=[[.05,.24],[.035,.33]].map(([w,l])=>{ const p=new THREE.Group(); p.position.z=.1; g.add(p); box(w,l,.02, M('hand','#2a1f30'), 0,l/2-.04,0, p); return p; }); g.userData.hands=hands; }},
};
const WALL_INVENTORY=['frameL','frameP','frameS','neon','record','poster','wshelf','clock'];
const PARTS_LATE = ({frameL:['틀','매트'], frameP:['틀','매트'], frameS:['틀','매트'], record:['틀','라벨'], clock:['테두리','시계판']});
const wallItems=[];
function sizeOf(g){ return g.userData.size||WALLCAT[g.userData.type].size; }
function makeWall(type, wg, u, v){ const g=new THREE.Group(); g.userData={type, id:++itemSeq, movable:true, wall:true}; WALLCAT[type].build(g);
  g.position.set(u,v,T/2); wg.add(g); movables.push(g); return g; }
const PALETTE = ['#e07a8b','#ffb86b','#ffd166','#3fa36b','#4cc9f0','#9b7bff','#e63946','#8a5a3b','#2c2c33','#f3efe6'];
const PARTS = {console:['본체','문'], sofa:['본체','쿠션'], table:['상판','다리'], lamp:['갓','기둥'], plant:['화분','잎'], boombox:['본체','손잡이'], guitar:['바디','넥'], ampstack:['본체','장식'], stool:['본체','방석']};
const SURF = {wall:{name:'벽지', pal:['#4b3a7c','#3b5a7c','#2f5d50','#7c3a4b','#3c3a42','#e9e2d6','#f2d7c4','#c9d6e8','#1e1b26','#a8714a']},
              floor:{name:'바닥', pal:['#c48552','#8a5a3b','#e0c39a','#55505c','#2e2a2a','#d9d2c5','#7c9a8a','#9b7bff','#e07a8b','#3a3550']}};

const movables=[]; let itemSeq=0;
function make(type, x, z, rot=0, opt={}){
  const g=new THREE.Group(); g.userData={type, id:++itemSeq, movable:true}; CATALOG[type].build(g, opt);
  g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); movables.push(g);
  if(g.userData.cones) speakers.push(g);
  return g;
}
// initial layout
const consoleG = make('console', 0, -4.25);
make('speaker', -3, -4.25); make('speaker', 3, -4.25);
make('shelf', 4.25, -4.35);
const sofaG = make('sofa', -4.0, .3);
make('lamp', -4.1, -3.1, 0, {light:true});
make('plant', -4.1, 4.1);
make('table', .4, .6);
const beanG = make('bean', 2.6, 2.9); beanG.userData.seat='me';

const me = avatar({parent:beanG, pos:[0,.85,0], rot:-0.6, pose:'sit', skin:'#ffdcc2', hair:'#2b2033', style:'bun', shirt:'#c9b6ff', pants:'#5b4a91', shoes:'#ffffff', phones:'#ffb86b', glasses:false, blush:true, name:'나', tagBg:'rgba(123,92,255,.92)'});
me.sitting=beanG; me.onBuild=a=>clickable(a.g,'나 · 눌러서 캐릭터 꾸미기', ()=>setDressing(true)); me.onBuild(me);

// floating notes
const noteTex = canvasTex(64,64,(g)=>{ g.fillStyle='#fff'; g.font='52px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('♪',32,34); });
const notes=[]; for(let i=0;i<10;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:noteTex.tex, color:['#ffd166','#ff8fab','#9bf6ff'][i%3], transparent:true, depthWrite:false})); s.scale.set(.45,.45,1); s.userData.t=i/10; scene.add(s); notes.push(s); }

// ---------- theme apply ----------
function applyTheme(name){
  theme=THEMES[name];
  document.body.style.background=theme.bg; scene.background=null;
  ['wallA','wallL','wallR','wallF'].forEach(k=>mats[k].color.set(theme.wallA));
  ['wallAw','wallLw','wallRw','wallFw'].forEach(k=>mats[k].color.set(theme.wallB));
  mats.trim.color.set(theme.trim); mats.trim.emissive.set(theme.trim);
  floorMat.color.set(theme.floor); mats.rug.color.set(theme.rug); mats.rug2.color.set(theme.rug2);
  mats.sofa.color.set(theme.sofa); mats.cushion.color.set(theme.cushion); mats.bean.color.set(theme.bean);
  mats.wood.color.set(theme.wood); mats.spk.color.set(theme.speaker); mats.hp.color.set(theme.accent);
  movables.forEach(g=>g.userData.light && g.userData.light.color.set(theme.lamp)); tvLight.color.set(theme.accent);
  drawSky(); drawSign();
  document.documentElement.style.setProperty('--pop', theme.accent);
  songTitle = {lofi:'Midnight City — lofi hip hop mix', hiphop:'90s Boom Bap Mix — Hip Hop Classics', rock:'Classic Rock Anthems — 70s & 80s'}[name];
  $('song').textContent=songTitle;
}
applyTheme('lofi');

// ---------- play state & views ----------
const playBtn=$('play'), prog=$('prog');
playBtn.addEventListener('click',togglePlay);
$('pl-x').addEventListener('click',()=>$('pl').hidden=true);
let tween=null;
function goTo(pos, target=new THREE.Vector3(0,1.8,0)){ tween={from:camera.position.clone(), to:pos.clone(), tf:controls.target.clone(), tt:target.clone(), t:0}; }
$('v-reset').addEventListener('click',()=>goTo(HOME));
$('v-top').addEventListener('click',()=>goTo(new THREE.Vector3(0.01,30,4)));
const spinBtn=$('v-spin');
function setSpin(on){ controls.autoRotate=on; spinBtn.setAttribute('aria-pressed',on); spinBtn.textContent=on?'↻ 자동 회전 켜짐':'↻ 자동 회전 꺼짐'; }
spinBtn.addEventListener('click',()=>setSpin(!controls.autoRotate));
controls.addEventListener('start',()=>{ tween=null; if(controls.autoRotate) setSpin(false); });
setSpin(false);

// ---------- decorate mode ----------
let editing=false, selected=null, drag=null, snapshot=null;
const hint=$('hint');
function setHint(){ hint.innerHTML = editing
  ? '<span class="mode">꾸미기 모드</span><span><b>가구 드래그</b> 이동 <span class="long">· <kbd>R</kbd> 회전 · <kbd>Del</kbd> 치우기 · 벽·바닥 눌러 색 바꾸기</span></span>'
  : '<b>WASD</b> 걷기 · <b>E</b> 앉기 · <b>Enter</b> 말하기 <span class="long">· 드래그 회전 · 스크롤 확대</span>'; }
setHint();
const grid=new THREE.GridHelper(10,20,0xffffff,0xffffff); grid.position.y=.13; grid.material.transparent=true; grid.material.opacity=.18; grid.visible=false; scene.add(grid);
const fpMat=new THREE.MeshBasicMaterial({color:0x3ddc97, transparent:true, opacity:.45, depthWrite:false, side:THREE.DoubleSide});
const fpMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1), fpMat); fpMesh.rotation.x=-Math.PI/2; fpMesh.position.y=.14; fpMesh.visible=false; fpMesh.renderOrder=5; scene.add(fpMesh);
const fpEdge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)), new THREE.LineBasicMaterial({color:0x3ddc97})); fpMesh.add(fpEdge);
const selBox=new THREE.BoxHelper(undefined, 0xffb86b); selBox.visible=false; scene.add(selBox);

function footprint(g, pos=g.position, rot=g.rotation.y){ const [w,d]=CATALOG[g.userData.type].fp; const q=Math.round(rot/(Math.PI/2))%2!==0; const hw=(q?d:w)/2, hd=(q?w:d)/2; return {x0:pos.x-hw,x1:pos.x+hw,z0:pos.z-hd,z1:pos.z+hd,w:hw*2,d:hd*2}; }
function valid(g, pos, rot){ const a=footprint(g,pos,rot);
  if(a.x0<-INNER-1e-3||a.x1>INNER+1e-3||a.z0<-INNER-1e-3||a.z1>INNER+1e-3) return false;
  return !movables.some(o=>{ if(o===g||o.userData.wall) return false; const b=footprint(o); return a.x0<b.x1-0.02&&a.x1>b.x0+0.02&&a.z0<b.z1-0.02&&a.z1>b.z0+0.02; }); }
function showFP(g, ok){ const f=footprint(g); fpMesh.visible=true; fpMesh.position.set((f.x0+f.x1)/2,.14,(f.z0+f.z1)/2); fpMesh.scale.set(f.w+.35,f.d+.35,1);
  const c=ok?0x3ddc97:0xff6b6b; fpMat.color.setHex(c); fpEdge.material.color.setHex(c); }

const tool=$('tool');
let part='main', surface=null, surfAt=null;
const partsWrap=$('parts'), swWrap=$('swatches'), custom=$('custom');
function renderSwatches(list){ swWrap.innerHTML=''; list.forEach(c=>{ const b=document.createElement('button'); b.className='sw'; b.style.background=c; b.title=c; b.setAttribute('aria-label','색 '+c); b.addEventListener('click',()=>applyColor(c)); swWrap.appendChild(b); }); }
function renderParts(g){ partsWrap.innerHTML=''; const names=PARTS[g.userData.type]||(g.userData.wall&&PARTS_LATE[g.userData.type]); if(!names) { part='main'; return; }
  names.forEach((n,i)=>{ const b=document.createElement('button'); b.textContent=n; const key=i?'sub':'main'; b.setAttribute('aria-pressed', key===part);
    b.addEventListener('click',()=>{ part=key; renderParts(g); }); partsWrap.appendChild(b); }); }
function cat(g){ return g.userData.wall?WALLCAT[g.userData.type]:CATALOG[g.userData.type]; }
function select(g){
  selected=g; surface=null;
  if(!g){ tool.hidden=true; fpMesh.visible=false; wallFP.visible=false; selBox.visible=false; return; }
  part='main'; $('tool-name').textContent=cat(g).name; $('rot').hidden=!!g.userData.wall; $('del').hidden=false; $('photo').hidden=!(g.userData.wall&&WALLCAT[g.userData.type].photo); $('sizeRow').hidden=!g.userData.photo; if(g.userData.photo) syncSize(g);
  renderParts(g); renderSwatches(PALETTE);
  selBox.setFromObject(g); selBox.visible=true; if(g.userData.wall){ fpMesh.visible=false; showWallFP(g,true); } else { wallFP.visible=false; showFP(g,true); } tool.hidden=false; placeTool();
}
function selectSurface(kind, point){
  select(null); surface=kind; surfAt=point.clone();
  $('tool-name').textContent=SURF[kind].name; $('rot').hidden=true; $('del').hidden=true; $('photo').hidden=true; $('sizeRow').hidden=true; partsWrap.innerHTML='';
  renderSwatches(SURF[kind].pal); tool.hidden=false; placeTool();
}
function placeTool(){ let top;
  if(selected){ const b=new THREE.Box3().setFromObject(selected); top=new THREE.Vector3((b.min.x+b.max.x)/2,b.max.y+.3,(b.min.z+b.max.z)/2); }
  else if(surface){ top=surfAt.clone(); } else return;
  top.project(camera); const x=(top.x+1)/2*innerWidth, y=(1-top.y)/2*innerHeight; const half=Math.min(tool.offsetWidth/2+8, innerWidth/2);
  const L=Math.round(Math.max(half,Math.min(innerWidth-half,x))), Tp=Math.round(Math.max(tool.offsetHeight+80,y));
  if(Math.abs(L-(tool._l||0))>1||Math.abs(Tp-(tool._t||0))>1){ tool._l=L; tool._t=Tp; tool.style.left=L+'px'; tool.style.top=Tp+'px'; } }
function paint(g,c,which){ (g.userData.colors=g.userData.colors||{})[which==='sub'?'sub':'main']=c; g.traverse(o=>{ if(!o.isMesh||!o.userData.paint) return; const isSub=o.userData.paint==='sub'; if(isSub!==(which==='sub')) return;
  if(!o.userData.own){ o.material=o.material.clone(); o.userData.own=true; } o.material.color.set(c); if(g.userData.type==='lamp'&&!isSub) o.material.emissive.set(c); }); }
function paintSurface(kind,c){ const col=new THREE.Color(c);
  if(kind==='floor') floorMat.color.copy(col);
  else { ['wallA','wallL','wallR','wallF'].forEach(k=>mats[k].color.copy(col)); ['wallAw','wallLw','wallRw','wallFw'].forEach(k=>mats[k].color.copy(col).multiplyScalar(.78)); } }
function applyColor(c){ if(selected) paint(selected,c,part); else if(surface) paintSurface(surface,c); custom.value=c; }
custom.addEventListener('input',()=>applyColor(custom.value));
function rotateSel(){ if(!selected) return; const r=selected.rotation.y+Math.PI/2;
  if(valid(selected, selected.position, r)){ selected.rotation.y=r; select(selected); }
  else { const p=freeSpot(selected, r); if(p){ selected.rotation.y=r; selected.position.copy(p); select(selected); } else toast('돌릴 공간이 부족해요'); } }
function removeSel(){ if(!selected) return; const g=selected; if(g.userData.seat){ toast('캐릭터가 앉아 있어서 치울 수 없어요. 다른 곳으로 옮겨보세요'); return; } g.parent.remove(g); movables.splice(movables.indexOf(g),1); select(null); toast(cat(g).name+' 치웠어요'); }
$('rot').addEventListener('click',rotateSel); $('del').addEventListener('click',removeSel);
addEventListener('keydown',e=>{ if(!editing||!selected) return; if(e.key==='r'||e.key==='R'){ rotateSel(); } if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); removeSel(); } if(e.key==='Escape') select(null); });
addEventListener('keydown',e=>{ if(editing&&surface&&e.key==='Escape') select(null); });

function freeSpot(g, rot=g.rotation.y){ // spiral search from room centre on a 0.5 grid
  const p=new THREE.Vector3(); for(let r=0;r<=10;r++) for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++){ if(Math.max(Math.abs(i),Math.abs(j))!==r) continue; p.set(.5+i*.5,0,1+j*.5); if(valid(g,p,rot)) return p.clone(); } return null; }
function spawn(type){ const g=make(type, 0, 0); g.position.y=0; const p=freeSpot(g);
  if(!p){ scene.remove(g); movables.pop(); toast('방에 빈 자리가 없어요'); return; }
  g.position.copy(p); g.userData.drop=0; select(g); toast(CATALOG[type].name+' 놓았어요 · 끌어서 옮겨보세요'); }

// ---------- wall decor placement ----------
const WALLS=[back,left,rightW,frontW];
const wallFPMat=new THREE.MeshBasicMaterial({color:0x3ddc97, transparent:true, opacity:.35, depthWrite:false});
const wallFP=new THREE.Mesh(new THREE.PlaneGeometry(1,1), wallFPMat); wallFP.visible=false; wallFP.renderOrder=5;
wallFP.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1,1)), new THREE.LineBasicMaterial({color:0x3ddc97})));
function rectsHit(a,b){ return Math.abs(a[0]-b[0])*2 < a[2]+b[2]-.02 && Math.abs(a[1]-b[1])*2 < a[3]+b[3]-.02; }
function validWall(g, wg, u, v, sz){ const [w,h]=sz||sizeOf(g); const r=[u,v,w,h];
  if(Math.abs(u)+w/2>4.9 || v-h/2<1.62 || v+h/2>H-.12) return false;
  if(wg.userData.blocked.some(b=>rectsHit(r,b))) return false;
  return !movables.some(o=>o!==g && o.userData.wall && o.parent===wg && rectsHit(r,[o.position.x,o.position.y,...sizeOf(o)])); }
function showWallFP(g, ok){ const [w,h]=sizeOf(g); g.parent.add(wallFP); wallFP.position.set(g.position.x,g.position.y,T/2+.006); wallFP.scale.set(w+.3,h+.3,1); wallFP.visible=true;
  const c=ok?0x3ddc97:0xff6b6b; wallFPMat.color.setHex(c); wallFP.children[0].material.color.setHex(c); }
function furnitureRects(wg){ // tall floor furniture standing against this wall, as wall rects, so new decor is not hidden behind it
  const out=[]; movables.forEach(o=>{ if(o.userData.wall) return; const b=new THREE.Box3().setFromObject(o); let x0=1e9,x1=-1e9,z0=1e9;
    for(const X of [b.min.x,b.max.x]) for(const Z of [b.min.z,b.max.z]){ const l=wg.worldToLocal(new THREE.Vector3(X,0,Z)); x0=Math.min(x0,l.x); x1=Math.max(x1,l.x); z0=Math.min(z0,l.z); }
    if(z0<T/2+1.6) out.push([(x0+x1)/2, b.max.y/2, x1-x0+.2, b.max.y+.4]); }); return out; }
function freeWallSpot(g){ const vis=WALLS.filter(w=>w.visible), hid=WALLS.filter(w=>!w.visible); const [w,h]=sizeOf(g);
  for(const [list,strict] of [[vis,true],[hid,true],[vis,false],[hid,false]]) for(const wg of list){ const fr=strict?furnitureRects(wg):[];
    for(let dv=0; dv<=8; dv++) for(const sv of [1,-1]) { const v=4.2+sv*dv*.25; for(let du=0; du<=19; du++) for(const su of [1,-1]){ const u=su*du*.25;
      if(validWall(g,wg,u,v) && !fr.some(r=>rectsHit([u,v,w,h],r))) return {wg,u,v}; } } }
  return null; }
function spawnWall(type){ const g=makeWall(type, back, 0, 4); const p=freeWallSpot(g);
  if(!p){ g.parent.remove(g); movables.pop(); toast('벽에 빈 자리가 없어요'); return; }
  p.wg.add(g); g.position.set(p.u,p.v,T/2);
  if(!p.wg.visible){ const n=new THREE.Vector3(0,0,1).applyQuaternion(p.wg.quaternion); const side=new THREE.Vector3(n.z,0,-n.x);
    goTo(n.clone().multiplyScalar(15).add(side.multiplyScalar(6)).setY(13)); toast('보이지 않던 벽에 걸어서 방을 돌렸어요'); }
  select(g); toast(WALLCAT[type].name+' 걸었어요 · 끌어서 옮겨보세요'+(WALLCAT[type].photo?' · 사진도 넣어보세요':'')); }
const wallMeshes=surfMeshes.slice(1);
function wallPoint(ev){ setRay(ev); const hit=ray.intersectObjects(wallMeshes,false).find(h=>isShown(h.object)); if(!hit) return null;
  const wg=hit.object.parent; const loc=wg.worldToLocal(hit.point.clone()); return {wg,u:loc.x,v:loc.y}; }
// photos: from the file picker (phone: photo library / camera / files) or dropped onto a frame
const localPhotos={}; let localN=0; const photoCache={};
function drawPhoto(g,img){ const a=g.userData.aspect, W=1024, Hh=Math.round(W/a); const c=document.createElement('canvas'); c.width=W; c.height=Hh; const x=c.getContext('2d');
  const s=Math.max(W/img.width, Hh/img.height); x.drawImage(img,(W-img.width*s)/2,(Hh-img.height*s)/2,img.width*s,img.height*s);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; const m=g.userData.photo.material; if(m.map&&m.map.dispose&&m.map.userData_owned) m.map.dispose(); m.map=t; t.userData_owned=true; m.needsUpdate=true; }
function setPhoto(g, file){ if(!file||!/^image\//.test(file.type)){ toast('이미지 파일만 넣을 수 있어요'); return; }
  const url=URL.createObjectURL(file); const img=new Image();
  img.onload=()=>{ // keep a downscaled JPEG copy for upload on save
    const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    c.toBlob(blob=>{ const id='local:'+(++localN); localPhotos[id]={img:c, blob}; g.userData.photoId=id; drawPhoto(g,c); URL.revokeObjectURL(url); toast(view.demo?'사진을 넣었어요 · 로그인하면 저장할 수 있어요':'사진을 넣었어요 · 저장하면 계속 남아요'); },'image/jpeg',.88); };
  img.onerror=()=>{ URL.revokeObjectURL(url); toast('이 사진은 열 수 없어요. 다른 파일을 골라주세요'); }; img.src=url; }
// free frame sizing
function resizeFrame(g,w,h){ const col=g.userData.colors; while(g.children.length) g.remove(g.children[0]);
  frameBuild(w,h)(g); g.userData.size=[w,h]; if(col){ if(col.main) paint(g,col.main,'main'); if(col.sub) paint(g,col.sub,'sub'); }
  if(g.userData.photoId) photoFor(g.userData.photoId).then(img=>drawPhoto(g,img)).catch(()=>{}); }
const szW=$('sz-w'), szH=$('sz-h'), szOut=$('sz-out'); let szWarn=0;
function syncSize(g){ const [w,h]=sizeOf(g); szW.value=w; szH.value=h; szOut.textContent=`${Math.round(w*30)} × ${Math.round(h*30)} cm`; }
function onSize(){ const g=selected; if(!g||!g.userData.photo) return; const w=+(+szW.value).toFixed(1), h=+(+szH.value).toFixed(1);
  if(validWall(g,g.parent,g.position.x,g.position.y,[w,h])){ resizeFrame(g,w,h); showWallFP(g,true); selBox.setFromObject(g); }
  else if(Date.now()-szWarn>1500){ szWarn=Date.now(); toast('창문·TV나 다른 장식에 닿아서 더 키울 수 없어요'); }
  syncSize(g); }
szW.addEventListener('input',onSize); szH.addEventListener('input',onSize);
const photoInput=$('photoInput');
$('photo').addEventListener('click',()=>{ if(selected&&selected.userData.photo){ photoInput.value=''; photoInput.click(); } });
photoInput.addEventListener('change',()=>{ if(selected&&selected.userData.photo&&photoInput.files[0]) setPhoto(selected, photoInput.files[0]); });
canvas.addEventListener('dragover',e=>{ e.preventDefault(); });
canvas.addEventListener('drop',e=>{ e.preventDefault(); const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(!f) return;
  setRay(e); const hit=ray.intersectObjects(movables,true).filter(h=>isShown(h.object)&&!h.object.isSprite)[0]; let o=hit&&hit.object; while(o&&!o.userData.movable) o=o.parent;
  if(o&&o.userData.photo) setPhoto(o,f); else if(selected&&selected.userData.photo) setPhoto(selected,f); else toast('사진을 액자 위에 놓아주세요'); });
// drawer tabs
function showTab(w){ $('tab-floor').setAttribute('aria-selected',!w); $('tab-wall').setAttribute('aria-selected',w); $('items').hidden=w; $('items-wall').hidden=!w;
  $('dsub').textContent = w ? '누르면 벽에 걸려요 · 벽 위에서 끌어 옮기기 · 액자에는 내 사진을 넣을 수 있어요' : '누르면 방에 나타나요 · 가구를 눌러 색 바꾸기 · 벽과 바닥도 눌러보세요'; }
$('tab-floor').addEventListener('click',()=>showTab(false)); $('tab-wall').addEventListener('click',()=>showTab(true));
// default wall decor
makeWall('poster', left, -3.95, 4.1);
const demoFrame = makeWall('frameP', back, -3.9, 4.4);
makeWall('clock', back, 3.75, 5.3);
makeWall('record', rightW, -2.5, 3.8);
makeWall('frameL', rightW, 0, 3.9);

// ---------- seats ----------
const SEATS={bean:{p:[0,.85,0], r:-0.6}, sofa:{p:[.45,.55,0], r:Math.PI/2, along:1.9}, stool:{p:[0,.8,0], r:0}};
function sitOn(a, item, worldHint){ const S=SEATS[item.userData.type]; const p=S.p.slice();
  if(S.along&&worldHint){ const l=item.worldToLocal(worldHint.clone()); p[2]=Math.max(-S.along,Math.min(S.along,l.z)); }
  a.o.parent=item; a.o.pose='sit'; a.o.pos=p; a.o.rot=S.r; a.sitting=item; rebuildAvatar(a); }
function standAt(a, x, z, rot){ a.o.parent=scene; a.o.pose='stand'; a.o.pos=[x,0,z]; a.o.rot=rot; a.sitting=null; rebuildAvatar(a); }
function seatAvatars(){ const seat=movables.find(g=>g.userData.seat==='me');
  if(view.isOwner){ if(me.sitting!==null&&seat&&!walkedOff) sitOn(me,seat); else if(!movables.includes(me.sitting)&&me.o.parent!==scene) standAt(me,0,3.6,Math.PI); }
  else if(me.o.parent!==scene){ let sx=0,sz=3.6; outer: for(let r=0;r<4;r+=.5) for(let a=0;a<12;a++){ const x=Math.sin(a/12*6.283)*r, z=3.6+Math.cos(a/12*6.283)*r*.5; if(!blocked(x,z)){ sx=x; sz=z; break outer; } } standAt(me,sx,sz,Math.PI); }
  if(hostA){ if(seat&&!view.hostHere){ hostA.g.visible=true; sitOn(hostA,seat); } else hostA.g.visible=false; } }

function avatarData(o){ const {parent,pos,rot,pose,wave,say,tagBg,dot,...rest}=o; return rest; }
function serializeRoom(){ const hex=c=>'#'+c.getHexString();
  return { v:1,
    floor: movables.filter(g=>!g.userData.wall).map(g=>({t:g.userData.type, x:+g.position.x.toFixed(2), z:+g.position.z.toFixed(2), r:+g.rotation.y.toFixed(4), c:g.userData.colors||null, seat:g.userData.seat||null, l:!!g.userData.light})),
    wall: movables.filter(g=>g.userData.wall).map(g=>({t:g.userData.type, w:WALLS.indexOf(g.parent), u:+g.position.x.toFixed(2), v:+g.position.y.toFixed(2), s:g.userData.size||null, c:g.userData.colors||null, p:g.userData.photoId||null})),
    surf:{wall:hex(mats.wallA.color), floor:hex(floorMat.color)} }; }
function applyRoom(d){ if(!d||!Array.isArray(d.floor)) return; select(null);
  movables.forEach(g=>g.parent&&g.parent.remove(g)); movables.length=0; speakers.length=0; record=null;
  d.floor.forEach(it=>{ if(!CATALOG[it.t]) return; const g=make(it.t, it.x, it.z, it.r, {light:it.l}); if(it.seat) g.userData.seat=it.seat;
    if(it.c){ if(it.c.main) paint(g,it.c.main,'main'); if(it.c.sub) paint(g,it.c.sub,'sub'); } });
  d.wall.forEach(it=>{ if(!WALLCAT[it.t]||!WALLS[it.w]) return; const g=makeWall(it.t, WALLS[it.w], it.u, it.v);
    if(it.s&&g.userData.photo) resizeFrame(g,it.s[0],it.s[1]);
    if(it.c){ if(it.c.main) paint(g,it.c.main,'main'); if(it.c.sub) paint(g,it.c.sub,'sub'); }
    if(it.p&&g.userData.photo){ g.userData.photoId=it.p; photoFor(it.p).then(img=>{ if(g.userData.photoId===it.p) drawPhoto(g,img); }).catch(()=>{}); } });
  if(d.surf){ paintSurface('wall',d.surf.wall); paintSurface('floor',d.surf.floor); }
  seatAvatars(); }
function takeSnapshot(){ snapshot=serializeRoom(); }
function restore(){ applyRoom(snapshot); }
function setEditing(on){ editing=on; if(!on&&pendingRoom){ const d=pendingRoom; pendingRoom=null; setTimeout(()=>{ if(!editing&&!dressing&&JSON.stringify(d)===lastRoomJSON) applyRoom(d); },0); } document.body.classList.toggle('editing',on); $('drawer').hidden=!on; $('player').hidden=on; grid.visible=on; document.querySelector('.themes').hidden=on;
  avatars.forEach(a=>a.bub&&(a.bub.visible=!on)); $('pl').hidden=true; if(!on) select(null); setHint();
  if(on){ setSpin(false); takeSnapshot(); goTo(new THREE.Vector3(13,17,13)); } }
$('edit').addEventListener('click',()=>setEditing(true));
$('save').addEventListener('click',()=>{ setEditing(false); saveRoom(); });
$('cancel').addEventListener('click',()=>{ restore(); setEditing(false); toast('변경을 취소했어요'); });

// inventory thumbnails (rendered once with a small offscreen renderer)
(function buildInventory(){
  const tr=new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true}); tr.setSize(160,136); tr.outputEncoding=THREE.sRGBEncoding; tr.toneMapping=THREE.ACESFilmicToneMapping;
  const ts=new THREE.Scene(); ts.add(new THREE.HemisphereLight(0xffffff,0x443355,1.2)); const dl=new THREE.DirectionalLight(0xffffff,1); dl.position.set(3,5,4); ts.add(dl);
  const cam=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  const wrap=$('items');
  INVENTORY.forEach(type=>{ const g=new THREE.Group(); g.userData={type}; CATALOG[type].build(g); ts.add(g);
    const b=new THREE.Box3().setFromObject(g), c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()); const r=Math.max(s.x,s.y,s.z)*.72;
    cam.left=-r*1.18; cam.right=r*1.18; cam.top=r; cam.bottom=-r; cam.position.set(c.x+6,c.y+5,c.z+6); cam.lookAt(c); cam.updateProjectionMatrix();
    tr.render(ts,cam); const url=tr.domElement.toDataURL(); ts.remove(g);
    const btn=document.createElement('button'); btn.className='item'; btn.innerHTML=`<img alt="" src="${url}"><span>${CATALOG[type].name}</span><small>${CATALOG[type].fp[0]}×${CATALOG[type].fp[1]}칸</small>`;
    btn.addEventListener('click',()=>spawn(type)); wrap.appendChild(btn); });
  const wwrap=$('items-wall');
  WALL_INVENTORY.forEach(type=>{ const g=new THREE.Group(); g.userData={type}; WALLCAT[type].build(g); ts.add(g);
    const b=new THREE.Box3().setFromObject(g), c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()); const r=Math.max(s.x,s.y)*.62;
    cam.left=-r*1.18; cam.right=r*1.18; cam.top=r; cam.bottom=-r; cam.position.set(c.x+2.2,c.y+1.4,c.z+6); cam.lookAt(c); cam.updateProjectionMatrix();
    tr.render(ts,cam); const url=tr.domElement.toDataURL(); ts.remove(g); const W=WALLCAT[type];
    const btn=document.createElement('button'); btn.className='item'; btn.innerHTML=`<img alt="" src="${url}"><span>${W.name}</span><small>${W.photo?'내 사진 넣기':W.size[0]+'×'+W.size[1]}</small>`;
    btn.addEventListener('click',()=>spawnWall(type)); wwrap.appendChild(btn); });
  // the catalog builds registered thumbnail meshes as clickables; drop those
  for(let i=clickables.length-1;i>=0;i--){ let o=clickables[i], inScene=false; while(o){ if(o===scene) inScene=true; o=o.parent; } if(!inScene) clickables.splice(i,1); }
  tr.dispose();
})();

// ---------- character dressing ----------
const STYLES=[['bun','똥머리'],['long','긴 머리'],['short','짧은 머리'],['curly','곱슬'],['spiky','삐죽 머리'],['cap','캡모자'],['beanie','비니']];
const ACCS=[['phones','헤드폰'],['glasses','안경'],['blush','볼터치']];
const GEN=['#2b2033','#6b3f2a','#c99a5b','#f3efe6','#ff8fab','#e63946','#ffb86b','#ffd166','#3fa36b','#4cc9f0','#9b7bff','#5b4a91'];
const CPARTS=[['skin','피부',['#ffe8d6','#ffdcc2','#f6c9a4','#e9b996','#c68b62','#8d5a3b','#5e3a26']],['hair','머리·모자',GEN],['shirt','상의',GEN],['pants','하의',GEN],['shoes','신발',GEN],['phones','헤드폰',GEN],['glassColor','안경테',['#2a1a44','#141418','#c99a5b','#e63946','#4cc9f0','#f3efe6']]];
let dressing=false, dressSnap=null, cpart='hair';
const PHONE_DEFAULT='#ffb86b';
function chip(wrap,label,pressed,onClick,dot){ const b=document.createElement('button'); b.innerHTML=(dot?`<span class="dot" style="background:${dot}"></span>`:'')+label; b.setAttribute('aria-pressed',pressed); b.addEventListener('click',onClick); wrap.appendChild(b); }
function renderDresser(){
  const o=me.o, st=$('styles'), ac=$('accs'), cp=$('cparts'), pal=$('cpal');
  st.innerHTML=''; STYLES.forEach(([k,n])=>chip(st,n,o.style===k,()=>{ o.style=k; rebuildAvatar(me); renderDresser(); }));
  ac.innerHTML=''; ACCS.forEach(([k,n])=>{ const on=k==='phones'?!!o.phones:k==='blush'?o.blush!==false:!!o[k];
    chip(ac,n,on,()=>{ if(k==='phones') o.phones=o.phones?null:(o._phones||PHONE_DEFAULT); else if(k==='blush') o.blush=!on; else o[k]=!on; rebuildAvatar(me); renderDresser(); }); });
  cp.innerHTML=''; CPARTS.forEach(([k,n])=>{ if(k==='phones'&&!o.phones) return; if(k==='glassColor'&&!o.glasses) return;
    const cur=k==='glassColor'?(o.glassColor||'#2a1a44'):o[k]; chip(cp,n,cpart===k,()=>{ cpart=k; renderDresser(); },cur); });
  if((cpart==='phones'&&!o.phones)||(cpart==='glassColor'&&!o.glasses)) cpart='hair';
  pal.innerHTML=''; const list=CPARTS.find(p=>p[0]===cpart)[2];
  list.forEach(c=>{ const b=document.createElement('button'); b.className='sw'; b.style.background=c; b.title=c; b.setAttribute('aria-label','색 '+c); b.addEventListener('click',()=>setPartColor(c)); pal.appendChild(b); });
  const lab=document.createElement('label'); lab.className='sw custom'; lab.title='직접 고르기'; lab.innerHTML='<input type="color" aria-label="색 직접 고르기">';
  const inp=lab.querySelector('input'); inp.value=(cpart==='glassColor'?(o.glassColor||'#2a1a44'):o[cpart])||'#ffffff'; inp.addEventListener('input',()=>setPartColor(inp.value,true)); pal.appendChild(lab);
}
function setPartColor(c, live){ me.o[cpart]=c; if(cpart==='phones') me.o._phones=c; rebuildAvatar(me); if(!live) renderDresser(); else { const d=[...$('cparts').children].find(b=>b.getAttribute('aria-pressed')==='true'); if(d&&d.firstChild) d.firstChild.style.background=c; } }
$('nick').addEventListener('input',e=>{ me.o.name=e.target.value.trim()||'나'; rebuildAvatar(me); });
function setDressing(on){
  if(on&&editing) return;
  if(!on&&pendingRoom){ const d=pendingRoom; pendingRoom=null; setTimeout(()=>{ if(!editing&&!dressing&&JSON.stringify(d)===lastRoomJSON) applyRoom(d); },0); }
  dressing=on; document.body.classList.toggle('dressing',on); $('dresser').hidden=!on; document.querySelector('.themes').hidden=on; $('pl').hidden=true; tip.classList.remove('show');
  if(on){ dressSnap=JSON.parse(JSON.stringify({...me.o, parent:undefined})); setSpin(false); renderDresser(); $('nick').value=me.o.name;
    const v=new THREE.Vector3(); me.g.getWorldPosition(v); const q=new THREE.Quaternion(); me.g.getWorldQuaternion(q);
    const dir=new THREE.Vector3(0,0,1).applyQuaternion(q); dir.y=0; dir.normalize(); dir.applyAxisAngle(new THREE.Vector3(0,1,0),.35);
    const wide=innerWidth>760; const side=new THREE.Vector3(dir.z,0,-dir.x).multiplyScalar(wide?1.7:0);
    const down=wide?0:-1.1; // phone: panel covers the lower half, so aim lower
    goTo(v.clone().add(dir.clone().multiplyScalar(7.5)).add(side).add(new THREE.Vector3(0,3+down,0)), v.clone().add(new THREE.Vector3(0,1.2+down,0)).add(side)); }
  else goTo(HOME);
}
$('dress').addEventListener('click',()=>setDressing(true));
$('d-save').addEventListener('click',()=>{ setDressing(false); saveRoom('캐릭터를'); });
$('d-cancel').addEventListener('click',()=>{ const p=me.o.parent; me.o={...dressSnap, parent:p}; rebuildAvatar(me); setDressing(false); toast('변경을 취소했어요'); });

// ---------- playlists (YouTube links) ----------
let playlists=[], openPL=null, nowPL=null, nowIdx=0;
function parseYT(raw){ let u; try{ u=new URL(raw.trim().match(/^https?:/)?raw.trim():'https://'+raw.trim()); }catch(e){ return null; }
  const h=u.hostname.replace(/^www\.|^m\.|^music\./,''); const id=/^[\w-]{11}$/;
  if(h==='youtu.be'){ const v=u.pathname.slice(1,12); if(id.test(v)) return {k:'v', y:v}; }
  if(h==='youtube.com'||h==='youtube-nocookie.com'){
    const v=u.searchParams.get('v'); if(v&&id.test(v)) return {k:'v', y:v};
    const m=u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/); if(m) return {k:'v', y:m[2]};
    const l=u.searchParams.get('list'); if(l&&/^[\w-]{10,64}$/.test(l)) return {k:'l', y:l}; }
  return null; }
function ytUrl(t){ return t.k==='l'?'https://www.youtube.com/playlist?list='+t.y:'https://www.youtube.com/watch?v='+t.y; }
function featured(){ return playlists.find(p=>p.featured)||playlists[0]||null; }
function setStatus(t){ $('pl-status').textContent=t; }
const isPlaceholderTitle=t=>/^유튜브 (영상|재생목록) · /.test(t.title);

// ---------- Supabase ----------
const SB_URL='https://qidhrwbrflwisgumccpe.supabase.co';
const SB_KEY='sb_publishable_qaMMiNECnpYYsMfnJlnGVQ_we45KKMa'; // publishable key: safe in the browser, access is enforced by RLS
const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
const view={ session:null, me:null, host:null, room:null, isOwner:true, demo:true, hostHere:false };
const cloud={ get canEdit(){ return view.isOwner; } };
let hostA=null, walkedOff=false;
const uid=()=>view.session&&view.session.user.id;

const writeChains={};
function chain(key, fn){ return writeChains[key]=(writeChains[key]||Promise.resolve()).catch(()=>{}).then(fn); }
function savePL(p){
  if(view.demo){ setStatus('로그인하면 플레이리스트가 저장돼요'); return; }
  if(!view.isOwner) return;
  setStatus('저장 중…');
  chain('pl:'+p.id, async()=>{
    let r=await sb.from('lr_playlists').upsert({id:p.id, owner_id:uid(), name:p.name.slice(0,40), position:p.order}); if(r.error) throw r.error;
    r=await sb.from('lr_playlist_tracks').delete().eq('playlist_id',p.id); if(r.error) throw r.error;
    if(p.tracks.length){ r=await sb.from('lr_playlist_tracks').insert(p.tracks.map((t,i)=>({playlist_id:p.id, position:i, kind:t.k==='l'?'list':'video', youtube_id:t.y, title:t.title.slice(0,120)}))); if(r.error) throw r.error; }
    if(p.featured&&view.room.featured_playlist_id!==p.id){ r=await sb.from('lr_rooms').update({featured_playlist_id:p.id}).eq('id',view.room.id); if(r.error) throw r.error; view.room.featured_playlist_id=p.id; }
  }).then(()=>{ setStatus('저장됨 · 방문자에게도 보여요'); rt.send('pl',{}); })
    .catch(e=>{ setStatus(''); toast('플레이리스트를 저장하지 못했어요'+(e&&e.message?' · '+e.message:'')); }); }
function renderPL(){
  const chips=$('pl-chips'), head=$('pl-head'), list=$('pl-list'); const ed=view.isOwner;
  if(!playlists.some(p=>p===openPL)) openPL=featured();
  $('pl-sub').textContent = ed ? 'LP 선반 = 내 플레이리스트 · ★ 대표 플레이리스트는 방문자에게 들려줘요' : (view.host?view.host.display_name+'님의 플레이리스트예요':'');
  chips.innerHTML=''; playlists.forEach(p=>{ const b=document.createElement('button'); b.textContent=(p.featured?'★ ':'')+p.name; b.setAttribute('aria-pressed',p===openPL); b.addEventListener('click',()=>{ openPL=p; renderPL(); }); chips.appendChild(b); });
  if(ed){ const nb=document.createElement('button'); nb.textContent='＋ 새 플레이리스트'; nb.addEventListener('click',newPL); chips.appendChild(nb); }
  head.innerHTML=''; list.innerHTML='';
  $('pl-add').hidden=!ed||!openPL;
  if(!openPL){ list.innerHTML='<li class="empty">'+(ed?'아직 플레이리스트가 없어요. ＋ 새 플레이리스트를 눌러 유튜브 링크로 첫 곡을 넣어보세요.':'아직 플레이리스트가 없어요.')+'</li>'; return; }
  if(ed){ const inp=document.createElement('input'); inp.value=openPL.name; inp.maxLength=40; inp.setAttribute('aria-label','플레이리스트 이름'); let t;
      inp.addEventListener('input',()=>{ openPL.name=inp.value.trim()||'이름 없는 플레이리스트'; clearTimeout(t); t=setTimeout(()=>{ savePL(openPL); renderChipsOnly(); },600); }); head.appendChild(inp);
    const f=document.createElement('button'); f.className='feat'; f.textContent='★ 대표'; f.title='방문자가 들어오면 이 플레이리스트가 재생돼요'; f.setAttribute('aria-pressed',!!openPL.featured);
      f.addEventListener('click',()=>{ playlists.forEach(p=>p.featured=false); openPL.featured=true; savePL(openPL); renderPL(); startPL(openPL); }); head.appendChild(f);
    const d=document.createElement('button'); d.className='delpl'; d.textContent='삭제'; d.addEventListener('click',()=>deletePL(openPL,d)); head.appendChild(d);
  } else { const b=document.createElement('b'); b.textContent=openPL.name; head.appendChild(b); }
  if(!openPL.tracks.length) list.innerHTML='<li class="empty">'+(ed?'아래에 유튜브 링크를 붙여넣어 곡을 추가하세요.':'아직 곡이 없어요.')+'</li>';
  openPL.tracks.forEach((t,i)=>{ const li=document.createElement('li'); li.className='trk'+(nowPL===openPL&&nowIdx===i?' now':'');
    li.innerHTML=`<span class="n">${i+1}</span><span class="t"><b></b><small>${t.k==='l'?'유튜브 재생목록':'유튜브 영상'}</small></span>`; li.querySelector('b').textContent=t.title;
    const play=document.createElement('button'); play.textContent='▶'; play.setAttribute('aria-label','재생'); play.addEventListener('click',()=>{ startPL(openPL,i,true); renderPL(); }); li.appendChild(play);
    if(ed){ [['↑',-1],['↓',1]].forEach(([g,dlt])=>{ const b=document.createElement('button'); b.textContent=g; b.setAttribute('aria-label',dlt<0?'위로':'아래로'); b.disabled=(i+dlt<0||i+dlt>=openPL.tracks.length);
        b.addEventListener('click',()=>{ const a=openPL.tracks; [a[i],a[i+dlt]]=[a[i+dlt],a[i]]; if(nowPL===openPL){ if(nowIdx===i) nowIdx=i+dlt; else if(nowIdx===i+dlt) nowIdx=i; } savePL(openPL); renderPL(); updateNow(); }); li.appendChild(b); });
      const x=document.createElement('button'); x.className='x2'; x.textContent='✕'; x.setAttribute('aria-label','빼기'); x.addEventListener('click',()=>{ const wasNow=nowPL===openPL&&nowIdx===i; openPL.tracks.splice(i,1); if(nowPL===openPL&&(nowIdx>i||nowIdx>=openPL.tracks.length)) nowIdx=Math.max(0,nowIdx-1); savePL(openPL); renderPL(); if(wasNow) loadNow(playing); else updateNow(); }); li.appendChild(x); }
    list.appendChild(li); });
}
function renderChipsOnly(){ const keep=document.activeElement; renderPL(); if(keep&&keep.getAttribute('aria-label')==='플레이리스트 이름'){ const i=$('pl-head').querySelector('input'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }
function newId(){ return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>(Math.random()*16|0).toString(16)); }
function newPL(){ const p={id:newId(), name:'새 플레이리스트', order:playlists.length, featured:!playlists.length, tracks:[]};
  playlists.push(p); openPL=p; savePL(p); renderPL(); const i=$('pl-head').querySelector('input'); if(i){ i.focus(); i.select(); } }
function deletePL(p,btn){ if(btn.dataset.sure!=='1'){ btn.dataset.sure='1'; btn.textContent='정말 삭제?'; setTimeout(()=>{ if(btn.isConnected){ btn.dataset.sure=''; btn.textContent='삭제'; } },3000); return; }
  playlists.splice(playlists.indexOf(p),1);
  if(!view.demo) chain('pl:'+p.id, async()=>{ const r=await sb.from('lr_playlists').delete().eq('id',p.id); if(r.error) throw r.error; }).then(()=>rt.send('pl',{})).catch(()=>toast('삭제하지 못했어요'));
  if(p.featured&&playlists[0]){ playlists[0].featured=true; savePL(playlists[0]); } if(nowPL===p) startPL(featured()); openPL=featured(); renderPL(); }
$('pl-add').addEventListener('submit',e=>{ e.preventDefault(); const err=$('pl-err'); const t=parseYT($('pl-url').value);
  if(!t){ err.textContent='유튜브 영상이나 재생목록 링크를 넣어주세요. 예: https://youtu.be/… 또는 youtube.com/watch?v=…'; return; }
  err.textContent=''; t.title=$('pl-title').value.trim()||(t.k==='l'?'유튜브 재생목록':'유튜브 영상')+' · '+t.y;
  openPL.tracks.push(t); $('pl-url').value=''; $('pl-title').value=''; savePL(openPL);
  if(!nowPL||!nowPL.tracks.length) startPL(openPL,openPL.tracks.length-1); else updateNow(); renderPL(); });
function startPL(p,i=0,autoplay=false){ nowPL=p; nowIdx=i; progress=0; loadNow(autoplay||playing); }
function updateNow(){ const t=nowPL&&nowPL.tracks[nowIdx];
  songTitle=t?t.title:'플레이리스트가 비어 있어요'; $('song').textContent=songTitle;
  $('song-sub').textContent=t?(nowPL.name+' · '+(nowIdx+1)+'/'+nowPL.tracks.length):(view.isOwner?'☰ 를 눌러 유튜브 링크를 추가해보세요':'아직 곡이 없어요');
  const a=$('yt'); a.href=t?ytUrl(t):'https://www.youtube.com'; }
function step(d){ if(!nowPL||!nowPL.tracks.length) return; nowIdx=(nowIdx+d+nowPL.tracks.length)%nowPL.tracks.length; progress=0; loadNow(true); if(!$('pl').hidden) renderPL(); djSend(); }
$('prev').addEventListener('click',()=>step(-1)); $('next').addEventListener('click',()=>step(1));
$('pl-open').addEventListener('click',()=>{ const p=$('pl'); p.hidden=!p.hidden; $('find').hidden=true; if(!p.hidden) renderPL(); });
function setPlaylists(list){ const cur=nowPL&&nowPL.id, curIdx=nowIdx, open=openPL&&openPL.id; playlists=list.sort((a,b)=>(a.order||0)-(b.order||0));
  openPL=playlists.find(p=>p.id===open)||null; const np=playlists.find(p=>p.id===cur);
  if(np){ const same=np.tracks[curIdx]&&nowPL.tracks[curIdx]&&np.tracks[curIdx].y===nowPL.tracks[curIdx].y; nowPL=np; nowIdx=Math.min(curIdx,Math.max(0,np.tracks.length-1)); if(same) updateNow(); else loadNow(playing); } else startPL(featured());
  if(!$('pl').hidden) renderPL(); }
async function loadPlaylists(ownerId){
  const r=await sb.from('lr_playlists').select('id,name,position,lr_playlist_tracks(position,kind,youtube_id,title)').eq('owner_id',ownerId).order('position');
  if(r.error){ toast('플레이리스트를 불러오지 못했어요'); return; }
  setPlaylists(r.data.map(p=>({id:p.id, name:p.name, order:p.position, featured:view.room&&view.room.featured_playlist_id===p.id,
    tracks:(p.lr_playlist_tracks||[]).sort((a,b)=>a.position-b.position).map(t=>({k:t.kind==='list'?'l':'v', y:t.youtube_id, title:t.title}))}))); }

// ---------- YouTube player (a real iframe, placed behind the transparent TV screen with CSS3D) ----------
const cssRenderer=new THREE.CSS3DRenderer(); const cssScene=new THREE.Scene();
cssRenderer.domElement.className='css3d'; document.body.insertBefore(cssRenderer.domElement, canvas);
const ytWrap=document.createElement('div'); ytWrap.className='ytwrap'; ytWrap.innerHTML='<div id="ytp"></div>';
const ytObj=new THREE.CSS3DObject(ytWrap); cssScene.add(ytObj); ytWrap.style.opacity='0';
cssRenderer.domElement.firstChild.appendChild(ytWrap);
let yt=null, ytReady=false, ytWant=null;
window.onYouTubeIframeAPIReady=()=>{ yt=new YT.Player('ytp',{ width:1280, height:720, playerVars:{controls:0, rel:0, playsinline:1, modestbranding:1, iv_load_policy:3, disablekb:1, origin:location.origin},
  events:{ onReady:()=>{ ytReady=true; if(ytWant) loadNow(ytWant.auto); },
    onStateChange:e=>{ const S=YT.PlayerState;
      if(e.data===S.PLAYING){ setPlaying(true); fillTitle(); ytFailed.clear(); }
      else if(e.data===S.PAUSED){ setPlaying(false); }
      else if(e.data===S.ENDED){ if(view.isOwner||!rt.djActive()) step(1); }
      djSend(); },
    onError:()=>{ const t=nowPL&&nowPL.tracks[nowIdx]; if(t) ytFailed.add(t.y);
      if(!nowPL||nowPL.tracks.every(x=>ytFailed.has(x.y))){ setPlaying(false); toast('이 플레이리스트의 영상은 방에서 재생할 수 없어요 · 유튜브에서 다른 사이트 재생을 막았거나 끝난 라이브일 수 있어요'); return; }
      toast('이 영상은 방에서 재생할 수 없어요 · 다음 곡으로 넘어가요'); setTimeout(()=>step(1),1500); } } }); };
const ytFailed=new Set();
function setPlaying(on){ playing=on; playBtn.textContent=on?'❚❚':'▶'; $('tapplay').hidden=true; }
function loadNow(autoplay, startAt=0){ updateNow(); const t=nowPL&&nowPL.tracks[nowIdx];
  if(!ytReady){ ytWant={auto:autoplay}; return; }
  if(!t){ yt.stopVideo(); setPlaying(false); return; }
  if(t.k==='l') (autoplay?yt.loadPlaylist:yt.cuePlaylist).call(yt,{list:t.y, listType:'playlist'});
  else (autoplay?yt.loadVideoById:yt.cueVideoById).call(yt,{videoId:t.y, startSeconds:startAt});
  if(!autoplay){ setPlaying(false); $('tapplay').hidden=false; } }
function fillTitle(){ const t=nowPL&&nowPL.tracks[nowIdx]; if(!t||!yt.getVideoData) return; const real=(yt.getVideoData().title||'').trim(); if(!real) return;
  if(isPlaceholderTitle(t)){ t.title=real.slice(0,120); updateNow(); if(view.isOwner) savePL(nowPL); if(!$('pl').hidden) renderPL(); } }
function togglePlay(){ if(!ytReady&&nowPL&&nowPL.tracks[nowIdx]){ toast(window.YT?'유튜브 플레이어를 준비하고 있어요 · 잠시 후 다시 눌러주세요':'유튜브 플레이어를 불러오지 못했어요 · 광고 차단 기능이 유튜브를 막고 있는지 확인해주세요'); return; }
  if(!ytReady||!(nowPL&&nowPL.tracks[nowIdx])){ playing=!playing; playBtn.textContent=playing?'❚❚':'▶'; return; }
  const st=yt.getPlayerState(); if(st===YT.PlayerState.PLAYING) yt.pauseVideo(); else { if(st===-1||st===YT.PlayerState.CUED||st===YT.PlayerState.ENDED) yt.playVideo(); else yt.playVideo(); } }
$('tapplay').addEventListener('click',()=>{ togglePlay(); });
function updateTVLayer(){ const show=ytReady&&back.visible&&!!(nowPL&&nowPL.tracks[nowIdx]);
  ytWrap.style.opacity=show?'1':'0'; tvScreen.material=show?tvHoleMat:tvScreenMat;
  { tvScreen.updateWorldMatrix(true,false); tvScreen.matrixWorld.decompose(ytObj.position, ytObj.quaternion, ytObj.scale); ytObj.scale.set(5.05/1280, 2.84/720, 1); } }

// ---------- realtime: who is here, where they walk, chat and the shared DJ ----------
const peers=new Map();
const rt={ ch:null, key:null, lastMv:0, lastDj:0, dj:null,
  send(ev,payload){ if(this.ch) this.ch.send({type:'broadcast', event:ev, payload:{k:this.key, ...payload}}); },
  djActive(){ return !!this.dj && Date.now()-this.dj.recv<15000; } };
function myPresence(){ return {name:me.o.name, av:avatarData(me.o), host:view.isOwner, uid:uid()||null}; }
function joinRoomChannel(roomId){
  $('chat-log').innerHTML=''; chatLine('sys','','방에 들어왔어요 · 채팅은 지금 이 방에 있는 사람에게만 보여요');
  if(rt.ch){ sb.removeChannel(rt.ch); rt.ch=null; } peers.forEach(p=>dropPeer(p)); peers.clear(); rt.dj=null;
  if(!sb) return;
  rt.key=uid()||('guest-'+Math.random().toString(36).slice(2,10));
  const ch=sb.channel('lr-room:'+roomId,{config:{presence:{key:rt.key}, broadcast:{self:false}}}); rt.ch=ch;
  ch.on('presence',{event:'sync'},()=>syncPeers(ch.presenceState()));
  ch.on('broadcast',{event:'mv'},({payload:m})=>{ const p=peers.get(m.k); if(!p) return; p.tx=m.x; p.ty=m.y; p.tz=m.z; p.tr=m.r; p.moving=m.m; if(m.p!==p.a.o.pose){ p.a.o.pose=m.p; p.a.o.pos=[m.x,m.y,m.z]; rebuildAvatar(p.a); } });
  ch.on('broadcast',{event:'say'},({payload:m})=>{ const p=peers.get(m.k); if(p) sayOn(p.a,m.text); chatLine('',(m.name||(p&&p.a.o.name)||'손님').replace(/ ★$/,''),String(m.text||'').slice(0,80)); });
  ch.on('broadcast',{event:'look'},({payload:m})=>{ const p=peers.get(m.k); if(p){ p.a.o={...p.a.o, ...m.av, name:m.name}; rebuildAvatar(p.a); } });
  ch.on('broadcast',{event:'dj'},({payload:m})=>{ if(view.isOwner) return; rt.dj={...m, recv:Date.now()}; followDj(); });
  ch.on('broadcast',{event:'pl'},()=>{ if(!view.isOwner&&view.host) loadPlaylists(view.host.id); });
  ch.on('broadcast',{event:'room'},()=>{ if(!view.isOwner&&view.host) reloadRoom(); });
  ch.subscribe(st=>{ if(st==='SUBSCRIBED'){ ch.track(myPresence()); sendMv(true); djSend(); } }); }
function syncPeers(state){
  const keys=new Set(Object.keys(state).filter(k=>k!==rt.key));
  peers.forEach((p,k)=>{ if(!keys.has(k)){ chatLine('sys','',p.a.o.name.replace(/ ★$/,'')+'님이 나갔어요'); dropPeer(p); peers.delete(k); } });
  keys.forEach(k=>{ const info=state[k][0]||{}; if(peers.has(k)) return;
    const a=avatar({...ME_DEFAULT, ...(info.av||{}), name:(info.name||'손님')+(info.host?' ★':''), parent:scene, pose:'stand', pos:[0,0,3.6], rot:Math.PI, tagBg:info.host?'rgba(255,184,107,.9)':undefined});
    peers.set(k,{a, tx:0, ty:0, tz:3.6, tr:Math.PI, moving:false, host:!!info.host}); chatLine('sys','',(info.name||'손님')+'님이 들어왔어요'); sendMv(true); });
  view.hostHere=[...peers.values()].some(p=>p.host); if(hostA) hostA.g.visible=!view.hostHere;
  const n=peers.size+1; $('who').textContent = n>1 ? `${n}명 함께 듣는 중` : '지금은 혼자 듣는 중'; $('chat-who').textContent = n>1 ? `${n}명` : '혼자 듣는 중'; }
function dropPeer(p){ p.a.g.parent&&p.a.g.parent.remove(p.a.g); const i=avatars.indexOf(p.a); if(i>=0) avatars.splice(i,1); }
function sendMv(force){ if(!rt.ch) return; const now=performance.now(); if(!force&&now-rt.lastMv<100) return; rt.lastMv=now;
  const w=new THREE.Vector3(); me.g.getWorldPosition(w); const q=new THREE.Quaternion(); me.g.getWorldQuaternion(q); const r=new THREE.Euler().setFromQuaternion(q,'YXZ').y;
  rt.send('mv',{x:+w.x.toFixed(2), y:+w.y.toFixed(2), z:+w.z.toFixed(2), r:+r.toFixed(2), p:me.o.pose, m:!!walk.moving}); }
function djSend(){ if(!view.isOwner||!rt.ch||!ytReady) return; const t=nowPL&&nowPL.tracks[nowIdx];
  rt.send('dj',{pl:nowPL&&nowPL.id, i:nowIdx, y:t&&t.y, t:yt.getCurrentTime?yt.getCurrentTime():0, on:playing, at:Date.now()}); rt.lastDj=performance.now(); }
function followDj(){ const d=rt.dj; if(!d||!ytReady||!$('dj-follow').checked) return;
  const p=playlists.find(x=>x.id===d.pl); if(!p) return;
  const expected=d.t+(d.on?(Date.now()-d.at)/1000:0);
  if(nowPL!==p||nowIdx!==d.i){ nowPL=p; nowIdx=d.i; if(d.on&&!playing&&!userTapped){ loadNow(false); return; } loadNow(d.on, expected); return; }
  if(Math.abs((yt.getCurrentTime()||0)-expected)>3) yt.seekTo(expected,true);
  if(d.on&&!playing&&userTapped) yt.playVideo(); if(!d.on&&playing) yt.pauseVideo(); }
let userTapped=false; addEventListener('pointerdown',()=>{ userTapped=true; },{once:true,capture:true});

// chat
$('chat-in').addEventListener('keydown',e=>{ if(e.key==='Escape') e.target.blur(); });
// chat window: a running log next to the speech bubbles (live only; not stored on the server)
let chatUnread=0;
function chatLine(kind, who, text){ const log=$('chat-log'); const li=document.createElement('li'); li.className=kind;
  const t=new Date(); const hhmm=t.getHours()+':'+String(t.getMinutes()).padStart(2,'0');
  if(kind!=='sys'){ const sm=document.createElement('small'); sm.textContent=(kind==='mine'?'나':who)+' · '+hhmm; li.appendChild(sm); }
  const sp=document.createElement('span'); sp.textContent=text; li.appendChild(sp); log.appendChild(li);
  while(log.children.length>100) log.firstChild.remove(); log.scrollTop=log.scrollHeight;
  if(kind!=='mine'&&document.body.classList.contains('chat-min')){ chatUnread++; const b=$('chat-new'); b.textContent=chatUnread; b.hidden=false; } }
$('chat-min').addEventListener('click',()=>{ const min=document.body.classList.toggle('chat-min'); $('chat-min').setAttribute('aria-expanded',!min); if(!min){ chatUnread=0; $('chat-new').hidden=true; $('chat-log').scrollTop=1e9; } });
if(matchMedia('(max-width:760px)').matches) document.body.classList.add('chat-min');
$('chat').addEventListener('submit',e=>{ e.preventDefault(); const i=$('chat-in'); const text=i.value.trim(); if(!text){ i.blur(); return; } i.value='';
  sayOn(me,text); chatLine('mine',me.o.name,text); rt.send('say',{text:text.slice(0,80), name:me.o.name}); i.blur(); });

// ---------- walking with WASD / arrow keys ----------
const walk={keys:new Set(), moving:false, vel:0};
const typing=e=>{ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable); };
addEventListener('keydown',e=>{ if(typing(e)||editing||dressing) return; const k=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){ walk.keys.add(k); e.preventDefault(); }
  if(k==='e'&&!e.repeat) toggleSit();
  if(k==='enter'&&!e.repeat){ e.preventDefault(); $('chat-in').focus(); } });
addEventListener('keyup',e=>walk.keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>walk.keys.clear());
document.querySelectorAll('[data-key]').forEach(b=>{ const k=b.dataset.key;
  b.addEventListener('pointerdown',e=>{ e.preventDefault(); walk.keys.add(k); b.setPointerCapture(e.pointerId); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,()=>walk.keys.delete(k))); });
$('sit').addEventListener('click',()=>toggleSit());
function blocked(x,z){ const R=.32; if(Math.abs(x)>INNER-R||Math.abs(z)>INNER-R) return true;
  return movables.some(g=>{ if(g.userData.wall) return false; const f=footprint(g); return x>f.x0-R&&x<f.x1+R&&z>f.z0-R&&z<f.z1+R; }); }
function standUp(){ const w=new THREE.Vector3(); me.g.getWorldPosition(w); const item=me.sitting; const c=item?item.position:w;
  for(let r=1;r<4;r+=.25) for(let a=0;a<16;a++){ const ang=a/16*Math.PI*2+Math.PI/2, x=c.x+Math.sin(ang)*r, z=c.z+Math.cos(ang)*r; if(!blocked(x,z)){ standAt(me,x,z,ang); walkedOff=true; sendMv(true); return true; } }
  return false; }
function updateSitBtn(){ const b=$('sit'); if(!b) return; const t=me.sitting?'🧍 일어나기 (E)':'🪑 앉기 (E)'; if(b.textContent!==t) b.textContent=t; }
function seatTaken(item){ return hostA&&hostA.sitting===item&&hostA.g.visible&&item.userData.type!=='sofa'; }
function sitHere(item, point){ if(seatTaken(item)){ toast('그 자리에는 방 주인이 앉아 있어요'); return; } sitOn(me,item,point); sendMv(true); }
function toggleSit(){ if(editing||dressing) return;
  if(me.sitting){ standUp(); return; }
  const p=me.g.position; let best=null, bd=2.2;
  movables.forEach(g=>{ if(!SEATS[g.userData.type]) return; const f=footprint(g); const dx=Math.max(f.x0-p.x,0,p.x-f.x1), dz=Math.max(f.z0-p.z,0,p.z-f.z1); const d=Math.hypot(dx,dz); if(d<bd){ bd=d; best=g; } });
  if(!best){ toast('앉을 곳이 가까이 없어요 · 빈백·소파·스툴 가까이에서 E'); return; }
  sitHere(best,p.clone()); }
const tmpV=new THREE.Vector3();
function updateWalk(dt){
  const k=walk.keys; let ix=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0), iz=(k.has('s')||k.has('arrowdown')?1:0)-(k.has('w')||k.has('arrowup')?1:0);
  const want=(ix||iz)&&!editing&&!dressing;
  if(want&&me.sitting){ if(!standUp()) return; }
  if(want&&controls.autoRotate) setSpin(false);
  walk.moving=!!want;
  if(want){
    const fwd=tmpV.copy(controls.target).sub(camera.position); fwd.y=0; fwd.normalize(); const right=new THREE.Vector3(-fwd.z,0,fwd.x);
    const dir=new THREE.Vector3().addScaledVector(right,ix).addScaledVector(fwd,-iz).normalize(); const sp=3.2*dt;
    const p=me.g.position; const nx=p.x+dir.x*sp, nz=p.z+dir.z*sp; const ox=p.x, oz=p.z;
    if(!blocked(nx,p.z)) p.x=nx; if(!blocked(p.x,nz)) p.z=nz;
    const moved=new THREE.Vector3(p.x-ox,0,p.z-oz); me.o.pos=[p.x,0,p.z];
    const targetR=Math.atan2(dir.x,dir.z); let d=targetR-me.g.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); me.g.rotation.y+=d*Math.min(1,dt*12); me.o.rot=me.g.rotation.y;
    sendMv(false);
  } else if(walk.wasMoving) sendMv(true);
  walk.wasMoving=walk.moving;
  const swing=walk.moving?Math.sin(performance.now()/90)*.6:0; (me.legs||[]).forEach((l,i)=>l.rotation.x+= ((i?swing:-swing)-l.rotation.x)*.3);
}
function updatePeers(dt){ peers.forEach(p=>{ const g=p.a.g; if(g.parent!==scene) return; const k=Math.min(1,dt*10);
  g.position.x+=(p.tx-g.position.x)*k; g.position.y+=(p.ty-g.position.y)*k; g.position.z+=(p.tz-g.position.z)*k;
  let d=p.tr-g.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); g.rotation.y+=d*k;
  const swing=p.moving?Math.sin(performance.now()/90)*.6:0; (p.a.legs||[]).forEach((l,i)=>l.rotation.x+=((i?swing:-swing)-l.rotation.x)*.3); }); }

// ---------- accounts, rooms and saving ----------
let lastRoomJSON='', pendingRoom=null;
const DEFAULT_LAYOUT=serializeRoom();
const ME_DEFAULT=avatarData(me.o);
async function uploadLocalPhotos(){ let failed=0;
  for(const g of movables){ const id=g.userData.photoId; if(!id||!id.startsWith('local:')) continue; const L=localPhotos[id];
    try{ const path=`${uid()}/${newId()}.jpg`;
      let r=await sb.storage.from('room-photos').upload(path, L.blob, {contentType:'image/jpeg', upsert:false}); if(r.error) throw r.error;
      r=await sb.from('lr_photos').insert({owner_id:uid(), storage_path:path, width:L.img.width, height:L.img.height}).select('id').single(); if(r.error) throw r.error;
      localPhotos[r.data.id]=L; movables.forEach(o=>{ if(o.userData.photoId===id) o.userData.photoId=r.data.id; }); }
    catch(e){ failed++; } }
  return failed; }
async function saveRoom(what='방을'){
  if(view.demo){ toast('로그인하면 '+what+' 저장할 수 있어요'); openAuth('signup'); return; }
  if(!view.isOwner){ toast('이 방은 주인만 꾸밀 수 있어요'); return; }
  try{
    const failed=await uploadLocalPhotos();
    const d=serializeRoom(); d.wall.forEach(w=>{ if(w.p&&w.p.startsWith('local:')) w.p=null; });
    let r=await sb.from('lr_rooms').update({layout:d}).eq('id',view.room.id); if(r.error) throw r.error;
    r=await sb.from('lr_profiles').update({avatar:avatarData(me.o), display_name:(me.o.name||view.me.display_name).slice(0,20)}).eq('id',uid()); if(r.error) throw r.error;
    lastRoomJSON=JSON.stringify(d); rt.send('room',{}); if(rt.ch) rt.ch.track(myPresence()); rt.send('look',{av:avatarData(me.o), name:me.o.name});
    toast(failed?`${what} 저장했어요 · 사진 ${failed}장은 올리지 못했어요`:`${what} 저장했어요`);
  }catch(e){ toast('저장하지 못했어요 · '+(e.message||'잠시 후 다시 시도해주세요')); } }
const photoUrlCache={};
function photoFor(id){
  if(localPhotos[id]) return Promise.resolve(localPhotos[id].img);
  if(photoCache[id]) return photoCache[id];
  return photoCache[id]=(async()=>{ const r=await sb.from('lr_photos').select('storage_path').eq('id',id).single(); if(r.error) throw r.error;
    const s=await sb.storage.from('room-photos').createSignedUrl(r.data.storage_path, 3600); if(s.error) throw s.error;
    return await new Promise((res,rej)=>{ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>res(img); img.onerror=rej; img.src=s.data.signedUrl; }); })(); }
function setReadOnly(ro){ document.body.classList.toggle('ro',ro); $('edit').hidden=ro; $('dress').hidden=!view.session;
  me.onBuild=a=>{ if(view.session) clickable(a.g,'나 · 눌러서 캐릭터 꾸미기', ()=>setDressing(true)); }; rebuildAvatar(me); }
async function reloadRoom(){ if(!view.host) return; const r=await sb.from('lr_rooms').select('id,owner_id,layout,visibility,featured_playlist_id').eq('owner_id',view.host.id).maybeSingle();
  if(r.error||!r.data) return; view.room=r.data; const L=r.data.layout; const js=JSON.stringify(L); if(js===lastRoomJSON) return; lastRoomJSON=js;
  if(editing||dressing) pendingRoom=L; else applyRoom(L&&L.floor&&L.floor.length?L:DEFAULT_LAYOUT); }
function renderHeader(){
  const h=view.host; $('room-title').textContent = view.demo ? '새벽 감성 방 (체험)' : (view.isOwner?'내 리스닝 룸':h.display_name+'님의 방');
  $('cloud').textContent = view.demo ? '로그인하면 꾸민 방이 저장돼요' : (view.isOwner?'@'+h.handle+' · 저장하면 다시 열어도 그대로예요':'@'+h.handle+' · 구경 중');
  $('acct').innerHTML=''; const A=$('acct');
  if(view.session&&view.me){ const b=document.createElement('button'); b.className='chip'; b.textContent='@'+view.me.handle; b.title='내 방으로'; b.addEventListener('click',()=>go(view.me.handle)); A.appendChild(b);
    const o=document.createElement('button'); o.className='chip'; o.textContent='로그아웃'; o.addEventListener('click',async()=>{ await sb.auth.signOut(); location.hash=''; location.reload(); }); A.appendChild(o); }
  else { const b=document.createElement('button'); b.className='chip strong'; b.textContent='로그인 / 회원가입'; b.addEventListener('click',()=>openAuth('login')); A.appendChild(b); }
  const V=$('visit'); V.innerHTML=''; V.hidden = view.demo;
  if(!view.demo&&view.isOwner){ const s=document.createElement('select'); s.id='vis'; s.setAttribute('aria-label','방 공개 범위');
      [['public','🌐 누구나 구경'],['friends','👥 친구만'],['private','🔒 나만']].forEach(([v,n])=>{ const o=document.createElement('option'); o.value=v; o.textContent=n; if(view.room.visibility===v) o.selected=true; s.appendChild(o); });
      s.addEventListener('change',async()=>{ const r=await sb.from('lr_rooms').update({visibility:s.value}).eq('id',view.room.id); toast(r.error?'바꾸지 못했어요':'공개 범위를 바꿨어요'); if(!r.error) view.room.visibility=s.value; });
      V.appendChild(s);
      const c=document.createElement('button'); c.className='chip'; c.textContent='🔗 내 방 링크 복사'; c.addEventListener('click',()=>{ const url=location.origin+location.pathname+'#/@'+h.handle; (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('링크를 복사했어요 · 친구에게 보내보세요')).catch(()=>toast(url)); }); V.appendChild(c); }
  else if(!view.demo){ const f=document.createElement('button'); f.className='chip'; f.id='follow'; V.appendChild(f); const l=document.createElement('button'); l.className='chip'; l.id='like'; V.appendChild(l); refreshSocial(); } }
async function refreshSocial(){ const f=$('follow'), l=$('like'); if(!f) return; const h=view.host;
  const [fo, likes, mine]=await Promise.all([ uid()?sb.from('lr_follows').select('follower_id').eq('follower_id',uid()).eq('followee_id',h.id):Promise.resolve({data:[]}),
    sb.from('lr_room_likes').select('user_id',{count:'exact',head:true}).eq('room_id',view.room.id),
    uid()?sb.from('lr_room_likes').select('user_id').eq('room_id',view.room.id).eq('user_id',uid()):Promise.resolve({data:[]}) ]);
  const following=!!(fo.data&&fo.data.length), liked=!!(mine.data&&mine.data.length);
  f.textContent=following?'✓ 팔로잉':'＋ 팔로우'; f.onclick=async()=>{ if(!uid()) return openAuth('login'); const q=following?sb.from('lr_follows').delete().eq('follower_id',uid()).eq('followee_id',h.id):sb.from('lr_follows').insert({follower_id:uid(), followee_id:h.id}); const r=await q; if(r.error) toast('잠시 후 다시 시도해주세요'); refreshSocial(); };
  l.textContent=(liked?'♥ ':'♡ ')+(likes.count||0); l.onclick=async()=>{ if(!uid()) return openAuth('login'); const q=liked?sb.from('lr_room_likes').delete().eq('room_id',view.room.id).eq('user_id',uid()):sb.from('lr_room_likes').insert({room_id:view.room.id, user_id:uid()}); const r=await q; if(r.error) toast('잠시 후 다시 시도해주세요'); refreshSocial(); }; }
function go(handle){ location.hash='#/@'+handle; }
async function openRoom(handle){
  const pr=await sb.from('lr_profiles').select('id,handle,display_name,avatar').eq('handle',handle.toLowerCase()).maybeSingle();
  if(pr.error||!pr.data){ toast('@'+handle+' 방을 찾을 수 없어요'); return openDemo(); }
  const rr=await sb.from('lr_rooms').select('id,owner_id,layout,visibility,featured_playlist_id').eq('owner_id',pr.data.id).maybeSingle();
  if(rr.error||!rr.data){ toast(pr.data.display_name+'님의 방은 친구에게만 공개돼 있어요'); return openDemo(); }
  view.demo=false; view.host=pr.data; view.room=rr.data; view.isOwner=!!uid()&&uid()===pr.data.id; view.hostHere=false;
  if(hostA){ const i=avatars.indexOf(hostA); if(i>=0) avatars.splice(i,1); hostA.g.parent&&hostA.g.parent.remove(hostA.g); hostA=null; }
  if(!view.isOwner) hostA=avatar({...ME_DEFAULT, ...(pr.data.avatar||{}), name:pr.data.display_name+' ★', parent:scene, pose:'sit', pos:[0,0,0], tagBg:'rgba(255,184,107,.9)'});
  me.o={...me.o, ...ME_DEFAULT, ...((view.me&&view.me.avatar)||{}), name: view.me?view.me.display_name:'손님'}; me.sitting=view.isOwner?me.sitting:null; walkedOff=false;
  const L=rr.data.layout; lastRoomJSON=JSON.stringify(L); applyRoom(L&&L.floor&&L.floor.length?L:DEFAULT_LAYOUT);
  setReadOnly(!view.isOwner); renderHeader(); playlists=[]; nowPL=null; await loadPlaylists(pr.data.id); joinRoomChannel(rr.data.id); }
function openDemo(){ view.demo=true; view.isOwner=true; view.host=null; view.room=null; setReadOnly(false); $('dress').hidden=false; renderHeader();
  setPlaylists([{id:'example', name:'새벽 감성 로파이 (예시)', order:0, featured:true, tracks:[{k:'v', y:'rFZHOHl-L8A', title:'lofi hip hop radio — beats to relax/study to'}]}]); }
async function ensureProfile(){ const u=view.session.user;
  let r=await sb.from('lr_profiles').select('id,handle,display_name,avatar').eq('id',u.id).maybeSingle(); if(r.data){ view.me=r.data; return; }
  const meta=u.user_metadata||{}; let handle=(meta.lr_handle||meta.username||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20); if(handle.length<3) handle='user_'+u.id.slice(0,6);
  for(let i=0;i<4;i++){ const h=i?handle.slice(0,16)+'_'+Math.floor(Math.random()*999):handle;
    r=await sb.from('lr_profiles').insert({id:u.id, handle:h, display_name:(meta.display_name||h).slice(0,20), avatar:ME_DEFAULT}).select('id,handle,display_name,avatar').single();
    if(!r.error){ view.me=r.data; toast('환영해요! @'+h+' 방이 만들어졌어요'); return; } }
  toast('프로필을 만들지 못했어요 · 새로고침 해주세요'); }
async function route(){ const m=location.hash.match(/^#\/@([a-z0-9_]{3,20})$/i);
  if(m) return openRoom(m[1]); if(view.me) return go(view.me.handle); openDemo(); }

// auth dialog
function openAuth(mode){ const d=$('auth'); d.dataset.mode=mode; $('auth-err').textContent=''; $('auth-title').textContent=mode==='signup'?'내 리스닝 룸 만들기':'로그인';
  $('auth-submit').textContent=mode==='signup'?'가입하고 방 만들기':'로그인'; $('auth-switch').textContent=mode==='signup'?'이미 계정이 있어요 · 로그인':'처음이에요 · 회원가입';
  d.querySelectorAll('.su').forEach(e=>e.hidden=mode!=='signup'); d.hidden=false; $('a-email').focus(); }
$('auth-switch').addEventListener('click',()=>openAuth($('auth').dataset.mode==='signup'?'login':'signup'));
$('auth-x').addEventListener('click',()=>$('auth').hidden=true);
$('auth-form').addEventListener('submit',async e=>{ e.preventDefault(); const mode=$('auth').dataset.mode, err=$('auth-err'); err.textContent='';
  const email=$('a-email').value.trim(), pw=$('a-pw').value; if(!email||pw.length<6){ err.textContent='이메일과 6자 이상 비밀번호를 넣어주세요'; return; }
  $('auth-submit').disabled=true;
  try{
    if(mode==='signup'){ const handle=$('a-handle').value.trim().toLowerCase(), name=$('a-name').value.trim();
      if(!/^[a-z0-9_]{3,20}$/.test(handle)){ err.textContent='아이디는 영어 소문자·숫자·_ 3~20자예요'; return; }
      if(!name){ err.textContent='닉네임을 넣어주세요'; return; }
      const taken=await sb.from('lr_profiles').select('id').eq('handle',handle).maybeSingle(); if(taken.data){ err.textContent='이미 쓰는 아이디예요'; return; }
      // username is required by another app that shares this project's sign-up trigger
      const r=await sb.auth.signUp({email, password:pw, options:{data:{username:handle, lr_handle:handle, display_name:name}, emailRedirectTo:location.origin+location.pathname}});
      if(r.error){ err.textContent=/database error/i.test(r.error.message)?'이 아이디는 쓸 수 없어요 · 다른 아이디로 해주세요':r.error.message; return; }
      if(!r.data.session){ $('auth').hidden=true; toast('메일함에서 인증 링크를 누르면 가입이 끝나요'); return; } }
    else { const r=await sb.auth.signInWithPassword({email, password:pw}); if(r.error){ err.textContent='이메일이나 비밀번호가 맞지 않아요'; return; } }
    $('auth').hidden=true;
  } finally { $('auth-submit').disabled=false; } });

(async function boot(){
  updateNow(); setPlaying(false); $('tapplay').hidden=true;
  if(!sb){ openDemo(); toast('서버에 연결하지 못해서 체험 모드로 열었어요'); return; }
  const s=await sb.auth.getSession(); view.session=s.data.session; if(view.session) await ensureProfile();
  sb.auth.onAuthStateChange(async(ev,session)=>{ const was=uid(); view.session=session; if(session&&session.user.id!==was){ await ensureProfile(); if(!location.hash) go(view.me.handle); else route(); } });
  addEventListener('hashchange',route); await route();
})();


// ---------- find other rooms ----------
let findSeq=0, findT=null;
function openFind(){ const f=$('find'); f.hidden=!f.hidden; if(!f.hidden){ $('pl').hidden=true; $('find-q').value=''; $('find-q').focus(); searchRooms(''); } }
$('find-open').addEventListener('click',openFind);
$('find-x').addEventListener('click',()=>$('find').hidden=true);
$('find-q').addEventListener('input',e=>{ clearTimeout(findT); findT=setTimeout(()=>searchRooms(e.target.value),250); });
$('find-q').addEventListener('keydown',e=>{ if(e.key==='Escape'){ $('find').hidden=true; e.target.blur(); } if(e.key==='Enter'){ const b=$('find-list').querySelector('button'); if(b) b.click(); } });
async function searchRooms(q){
  const list=$('find-list'), seq=++findSeq;
  if(!sb){ list.innerHTML='<li class="empty">서버에 연결되지 않아서 찾을 수 없어요</li>'; return; }
  list.innerHTML='<li class="empty">찾는 중…</li>';
  const clean=q.replace(/[^0-9a-zA-Z_가-힣ㄱ-ㅎㅏ-ㅣ ]/g,'').trim().slice(0,20);
  let profs=[];
  if(clean){ const r=await sb.from('lr_profiles').select('id,handle,display_name,avatar').or(`handle.ilike.%${clean}%,display_name.ilike.%${clean}%`).limit(12); profs=r.data||[]; }
  else { const r=await sb.from('lr_rooms').select('owner_id,updated_at').order('updated_at',{ascending:false}).limit(12); const ids=(r.data||[]).map(x=>x.owner_id);
    if(ids.length){ const p=await sb.from('lr_profiles').select('id,handle,display_name,avatar').in('id',ids); profs=ids.map(id=>(p.data||[]).find(x=>x.id===id)).filter(Boolean); } }
  if(seq!==findSeq) return;
  const vis=new Set(); if(profs.length){ const r=await sb.from('lr_rooms').select('owner_id').in('owner_id',profs.map(p=>p.id)); (r.data||[]).forEach(x=>vis.add(x.owner_id)); }
  if(seq!==findSeq) return;
  list.innerHTML='';
  if(!profs.length){ list.innerHTML='<li class="empty">'+(clean?'"'+clean.replace(/[<>&]/g,'')+'"(으)로 찾은 방이 없어요':'아직 구경할 방이 없어요')+'</li>'; return; }
  if(!clean){ const h=document.createElement('li'); h.className='plfoot'; h.textContent='최근에 꾸민 방'; list.appendChild(h); }
  profs.forEach(p=>{ const li=document.createElement('li'); const b=document.createElement('button'); const open=vis.has(p.id); const here=view.host&&view.host.id===p.id;
    b.innerHTML='<span class="face"></span><span class="who"><b></b><small></small></span><span class="tag"></span>';
    const face=b.querySelector('.face'); face.style.background=(p.avatar&&p.avatar.shirt)||'#c9b6ff'; face.textContent=(p.display_name||p.handle).slice(0,1);
    b.querySelector('b').textContent=p.display_name; b.querySelector('small').textContent='@'+p.handle+(uid()===p.id?' · 내 방':'');
    const tag=b.querySelector('.tag'); tag.textContent= here?'지금 여기':(open?'들어가기 →':'🔒 친구 공개'); if(here) tag.classList.add('here');
    b.addEventListener('click',async()=>{ if(!open&&uid()!==p.id){
      if(!uid()){ toast(p.display_name+'님의 방은 친구에게만 공개돼 있어요 · 로그인하고 팔로우해보세요'); return; }
      const r=await sb.from('lr_follows').upsert({follower_id:uid(), followee_id:p.id},{ignoreDuplicates:true});
      toast(r.error?'팔로우하지 못했어요':p.display_name+'님을 팔로우했어요 · 상대도 나를 팔로우하면 방에 들어갈 수 있어요'); return; } $('find').hidden=true; go(p.handle); });
    li.appendChild(b); list.appendChild(li); }); }

// ---------- picking ----------
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2(), tip=$('tip'), floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let downAt=null;
function setRay(ev){ const r=canvas.getBoundingClientRect(); mouse.set(((ev.clientX-r.left)/r.width)*2-1, -((ev.clientY-r.top)/r.height)*2+1); ray.setFromCamera(mouse,camera); }
function isShown(o){ while(o){ if(!o.visible) return false; o=o.parent; } return true; }
function pick(ev){ setRay(ev); const hits=ray.intersectObjects(clickables,true).filter(h=>isShown(h.object)); return hits.length?hits[0].object.userData.hit:null; }
function pickMovable(ev){ setRay(ev); const hits=ray.intersectObjects(movables,true).filter(h=>isShown(h.object)&&!h.object.isSprite);
  if(!hits.length) return null; let o=hits[0].object; while(o&&!o.userData.movable) o=o.parent; return o; }
function floorPoint(ev){ setRay(ev); const p=new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane,p)?p:null; }

canvas.addEventListener('pointerdown',ev=>{ downAt=[ev.clientX,ev.clientY];
  if(!editing) return;
  const g=pickMovable(ev);
  if(g&&g.userData.wall){ select(g); drag={wall:true, g, startParent:g.parent, start:g.position.clone(), ok:true}; controls.enabled=false; canvas.setPointerCapture(ev.pointerId); }
  else if(g){ select(g); const fp=floorPoint(ev); drag={g, start:g.position.clone(), off:fp?fp.sub(g.position):new THREE.Vector3(), ok:true}; controls.enabled=false; canvas.setPointerCapture(ev.pointerId); }
});
canvas.addEventListener('pointermove',ev=>{
  if(drag&&drag.wall){ const wp=wallPoint(ev); if(!wp) return; const g=drag.g; const [w,h]=sizeOf(g); const snap=v=>Math.round(v*4)/4;
    const u=Math.max(-4.9+w/2,Math.min(4.9-w/2,snap(wp.u))), v=Math.max(1.62+h/2,Math.min(H-.12-h/2,snap(wp.v)));
    if(g.parent!==wp.wg) wp.wg.add(g); g.position.set(u,v,T/2+.06); drag.ok=validWall(g,wp.wg,u,v); showWallFP(g,drag.ok); canvas.style.cursor='grabbing'; tip.classList.remove('show'); return; }
  if(drag){ const fp=floorPoint(ev); if(!fp) return; const p=fp.sub(drag.off); const f=footprint(drag.g);
    const snap=v=>Math.round(v*4)/4; p.set(snap(p.x),0,snap(p.z));
    p.x=Math.max(-INNER+f.w/2,Math.min(INNER-f.w/2,p.x)); p.z=Math.max(-INNER+f.d/2,Math.min(INNER-f.d/2,p.z));
    drag.g.position.copy(p); drag.g.position.y=.15; drag.ok=valid(drag.g,p,drag.g.rotation.y); showFP(drag.g,drag.ok); canvas.style.cursor='grabbing'; tip.classList.remove('show'); return; }
  if(editing){ const g=pickMovable(ev); canvas.style.cursor=g?'grab':'default';
    if(g){ tip.textContent=cat(g).name+(g.userData.wall?' · 벽 위에서 끌어 옮기기':' · 끌어서 옮기기')+(g.userData.photo?' · 사진 파일을 끌어다 놓아도 돼요':' · 눌러서 색 바꾸기'); tip.style.left=ev.clientX+'px'; tip.style.top=ev.clientY+'px'; tip.classList.add('show'); } else tip.classList.remove('show'); return; }
  const sg=!pick(ev)&&pickMovable(ev); if(sg&&SEATS[sg.userData.type]){ tip.textContent=CATALOG[sg.userData.type].name+' · 눌러서 앉기'; tip.style.left=ev.clientX+'px'; tip.style.top=ev.clientY+'px'; tip.classList.add('show'); canvas.style.cursor='pointer'; return; }
  const h=pick(ev); if(h){ tip.textContent=h.name; tip.style.left=ev.clientX+'px'; tip.style.top=ev.clientY+'px'; tip.classList.add('show'); canvas.style.cursor='pointer'; } else { tip.classList.remove('show'); canvas.style.cursor='grab'; } });
canvas.addEventListener('pointerup',ev=>{
  if(drag&&drag.wall){ const g=drag.g; if(!drag.ok){ drag.startParent.add(g); g.position.copy(drag.start); toast('창문·TV나 다른 장식과 겹쳐서 원래 자리로 돌아갔어요'); } g.position.z=T/2; drag=null; controls.enabled=true; select(g); return; }
  if(drag){ const g=drag.g; if(!drag.ok){ g.position.copy(drag.start); toast('다른 가구와 겹쳐서 원래 자리로 돌아갔어요'); } g.position.y=0; drag=null; controls.enabled=true; select(g); return; }
  if(!downAt) return; const moved=Math.hypot(ev.clientX-downAt[0],ev.clientY-downAt[1]); downAt=null; if(moved>5) return;
  if(editing){ if(pickMovable(ev)) return; setRay(ev); const hit=ray.intersectObjects(surfMeshes,false).find(h=>isShown(h.object));
    if(hit) selectSurface(hit.object===floorMesh?'floor':'wall', hit.point); else select(null); return; }
  const h=pick(ev); if(h){ h.act(); return; }
  const g=pickMovable(ev); if(g&&SEATS[g.userData.type]){ const hit=ray.intersectObject(g,true)[0]; sitHere(g, hit?hit.point:g.position.clone()); } });

// ---------- loop ----------
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); cssRenderer.setSize(w,h); camera.aspect=w/h; camera.fov = w<760 ? 48 : 35; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
let tvTick=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now; const t=now/1000;
  if(tween){ tween.t=Math.min(1,tween.t+dt*1.4); const e=1-Math.pow(1-tween.t,3); camera.position.lerpVectors(tween.from,tween.to,e); controls.target.lerpVectors(tween.tf,tween.tt,e); if(tween.t>=1) tween=null; }
  controls.update();
  const p=camera.position; walls.forEach(w=>{ w.g.visible=!w.outside(p); });
  const beat = playing ? Math.pow(Math.max(0,Math.sin(t*Math.PI*2*1.4)),8) : 0;
  if(playing&&record) record.rotation.y -= dt*3.5;
  if(ytReady&&yt.getDuration&&yt.getDuration()>0) progress=Math.min(1,(yt.getCurrentTime()||0)/yt.getDuration()); else if(playing) progress=(progress+dt/225)%1;
  updateWalk(dt); updatePeers(dt);
  if(view.isOwner&&rt.ch&&performance.now()-rt.lastDj>5000) djSend();
  avatars.forEach(a=>{ if(a.chat&&performance.now()>a.chatUntil){ a.g.remove(a.chat); a.chat=null; } });
  prog.style.width=(progress*100)+'%';
  speakers.forEach(s=>{ s.userData.kick=Math.max(0,(s.userData.kick||0)-dt*2); const k=1+beat*.06+s.userData.kick*.15; s.userData.cones.forEach(c=>c.scale.set(k,1,k)); });
  avatars.forEach(a=>{ a.head.rotation.z = playing? Math.sin(t*Math.PI*1.4+a.phase)*.08 : 0; a.head.position.y=a.by+.95+(playing?beat*.04:0); if(a.bub) a.bub.position.y=a.by+2.45+Math.sin(t*2+a.phase)*.05; });
  notes.forEach((n,i)=>{ n.userData.t=(n.userData.t+dt*(playing?.12:0))%1; const u=n.userData.t; n.position.set((i%2?3:-3)+Math.sin(u*6+i)*.4, 3.2+u*2.8, -3.7+Math.cos(i)*.3); n.material.opacity=(playing&&!editing)?Math.sin(u*Math.PI):0; });
  bulbs.forEach((b,i)=>b.scale.setScalar(1+Math.sin(t*3+i)*.15));
  movables.forEach(g=>{ if(g.userData.type==='lamp'){ const on=!g.userData.off; if(g.userData.light) g.userData.light.intensity += ((on?1.6:0)-g.userData.light.intensity)*.15; g.userData.shade.material.emissiveIntensity=on?.9:.05; } });
  tvLight.intensity=1+beat*.5;
  if((tvTick%1)<dt){ const d=new Date(); movables.forEach(g=>{ const hd=g.userData.hands; if(!hd) return; hd[0].rotation.z=-((d.getHours()%12)+d.getMinutes()/60)/12*Math.PI*2; hd[1].rotation.z=-(d.getMinutes()+d.getSeconds()/60)/60*Math.PI*2; }); }
  if(selected){ selBox.setFromObject(selected); } if(selected||surface) placeTool();
  if((tvTick+=dt)>.1){ tvTick=0; drawTV(now); }
  updateTVLayer(); updateSitBtn();
  renderer.render(scene,camera); cssRenderer.render(cssScene,camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
