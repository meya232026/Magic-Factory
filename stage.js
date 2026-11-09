// The robotic anglerfish's stage, copied from the bee's (robobee-shared/stage.js); the key's shadow box and the floor
// shadow's window take a span (the fish is longer than the bee). A near-white product studio. A warm paper backdrop with no horizon, a soft shadow pooled
// on the floor under the bee (the bee's silhouette seen from below, blurred wide, plus a tighter pass for what hangs
// close to the floor), a softbox environment for the clear coat to catch, a key with VSM self-shadows, a rim and a
// fill, GTAO kept off the backdrop and the clear parts, MSAA. The tone curve is linear up to 0.8 and rolls off
// above, hue preserved; the backdrop writes the inverse of that curve, so the paper lands on its exact colour and the
// floor shadow darkens it as drawn. frame(cam, ops) draws one frame; cam = {tx, ty, tz, az, el, d, sx, sy}.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FullScreenQuad, Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildGuides} from './guides.js';

const V3 = THREE.Vector3;
// the paper: top, middle, the floor band (sRGB), and the shadow's tint
export const PAPER = {top: '#fefcf8', mid: '#fcf9f3', low: '#f5efe7', shadow: '#c9bcae'};
const KNEE = 0.8;
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    color *= toneMappingExposure;
    float p = max( color.r, max( color.g, color.b ) );
    if ( p <= ${KNEE.toFixed(2)} ) return color;
    float np = ${KNEE.toFixed(2)} + ${(1 - KNEE).toFixed(2)} * ( 1.0 - exp( -( p - ${KNEE.toFixed(2)} ) / ${(1 - KNEE).toFixed(2)} ) );
    return color * ( np / p );
  }`,
);
export const BEE_LAYER = 1;

const BACK_VERT = /* glsl */ `varying vec3 vW;
  void main(){
  #ifdef SCREEN
    vW = vec3(0.0); gl_Position = vec4(position.xy, 0.99999, 1.0);
  #else
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
  #endif
  }`;
const BACK_FRAG = /* glsl */ `uniform vec3 uTop, uMid, uLow, uTint; uniform vec2 uRes;
  uniform sampler2D tSoft, tNear; uniform mat4 uVP; uniform float uSoft, uNear;
  varying vec3 vW;
  vec3 paper(float y){ return y > 0.42 ? mix(uMid, uTop, smoothstep(0.42, 1.0, y)) : mix(uLow, uMid, smoothstep(0.0, 0.42, y)); }
  // the inverse of the tone curve's shoulder: what to write so the output lands on c
  vec3 untone(vec3 c){
    float p = max(c.r, max(c.g, c.b));
    if (p <= ${KNEE.toFixed(2)}) return c;
    float pin = ${KNEE.toFixed(2)} - ${(1 - KNEE).toFixed(2)} * log(max(1e-4, 1.0 - (p - ${KNEE.toFixed(2)}) / ${(1 - KNEE).toFixed(2)}));
    return c * (pin / p);
  }
  float tap(sampler2D t, vec3 w){
    vec4 c = uVP * vec4(w, 1.0);
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
    vec2 e = smoothstep(0.0, 0.08, uv) * smoothstep(0.0, 0.08, 1.0 - uv);
    return texture2D(t, uv).r * e.x * e.y;
  }
  void main(){
    vec3 c = paper(gl_FragCoord.y / uRes.y);
  #ifndef SCREEN
    float s = clamp(tap(tSoft, vW) * uSoft + tap(tNear, vW) * uNear, 0.0, 1.0);
    c = mix(c, c * uTint, s);
  #endif
    gl_FragColor = vec4(untone(c), 1.0);
  }`;
const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BLUR_FRAG = /* glsl */ `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    float w[5]; w[0] = 0.2270270270; w[1] = 0.1945945946; w[2] = 0.1216216216; w[3] = 0.0540540541; w[4] = 0.0162162162;
    vec4 c = texture2D(tSrc, vUv) * w[0];
    for (int i = 1; i < 5; i++) { c += texture2D(tSrc, vUv + uDir * float(i)) * w[i]; c += texture2D(tSrc, vUv - uDir * float(i)) * w[i]; }
    gl_FragColor = c;
  }`;
// silhouette from below: everything counts, what hangs low counts more
const SIL_VERT = /* glsl */ `varying float vH; uniform float uFloor; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vH = w.y - uFloor; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SIL_FRAG = /* glsl */ `varying float vH; uniform float uFar, uBase; void main(){ float k = 1.0 - clamp(vH / uFar, 0.0, 1.0); gl_FragColor = vec4(uBase + (1.0 - uBase) * k * k, 0.0, 0.0, 1.0); }`;

export function createStage({canvas, floorY = -1.55, span = 3.4}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({radius: 0.13, distanceExponent: 1.6, thickness: 0.9, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  // the backdrop, the guides and every clear part stay out of the AO pass
  const skip = [];
  // extra: meshes skipped only while a mode asks (the shells under x-ray)
  let extra = [];
  const aoSkip = (on) => {
    for (const o of skip) o.visible = on && o.userData.show !== false;
    for (const o of extra) o.visible = on;
  };
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  // ------------------------------------------------------------ the studio the clear coat reflects
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d8d4ce');
    const box = (w, h, pos, k, tint = [1, 0.985, 0.96]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(16, 10, new V3(-4, 16, 6), 3.2); // the big top box
    box(3, 16, new V3(-15, 4, 8), 2.6); // a tall strip, left front
    box(3, 16, new V3(14, 5, -6), 2.0, [0.96, 0.98, 1]); // the rim strip behind
    box(20, 3, new V3(2, 2, 16), 1.5); // a low card in front
    box(8, 8, new V3(10, 2, 12), 1.1); // fill, right front
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#e9e3da', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -3;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.025).texture;
    scene.environmentIntensity = 0.62;
    pm.dispose();
  }
  const KEY = new V3(-0.3, 0.86, 0.55).normalize();
  const key = new THREE.DirectionalLight('#fffaf3', 3.0);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {left: -span, right: span, top: span, bottom: -span, near: 1, far: 18});
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = 6;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.01;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#f2f6ff', 1.1);
  rim.position.set(3, 3, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#fff6ec', 0.3);
  fill.position.set(4, -1, 5);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight('#ffffff', '#d9cfc2', 0.32));

  // ------------------------------------------------------------ backdrop: the paper behind, the floor with its shadow
  const lin = (hex) => new THREE.Color(hex);
  const backU = {
    uTop: {value: lin(PAPER.top)},
    uMid: {value: lin(PAPER.mid)},
    uLow: {value: lin(PAPER.low)},
    uTint: {value: lin(PAPER.shadow)},
    uRes: {value: new THREE.Vector2(1, 1)},
    tSoft: {value: null},
    tNear: {value: null},
    uVP: {value: new THREE.Matrix4()},
    uSoft: {value: 0.42},
    uNear: {value: 0.55},
  };
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, uniforms: backU, defines: {SCREEN: ''}, depthWrite: false, depthTest: false}));
  paper.frustumCulled = false;
  paper.renderOrder = -10;
  scene.add(paper);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, uniforms: backU, depthWrite: false}));
  floor.position.y = floorY;
  floor.renderOrder = -9;
  scene.add(floor);
  skip.push(paper, floor);

  // the floor shadow: the bee from below into two targets, one blurred wide, one tight
  const SR = 512;
  const HALF = span + 0.8;
  const mkRT = () => new THREE.WebGLRenderTarget(SR, SR, {type: THREE.HalfFloatType});
  const soft = [mkRT(), mkRT()];
  const near = [mkRT(), mkRT()];
  backU.tSoft.value = soft[0].texture;
  backU.tNear.value = near[0].texture;
  const shCam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0, 6);
  shCam.up.set(0, 0, -1);
  shCam.layers.set(BEE_LAYER);
  const silU = {uFloor: {value: floorY}, uFar: {value: 1.6}, uBase: {value: 1.0}};
  const silMat = new THREE.ShaderMaterial({vertexShader: SIL_VERT, fragmentShader: SIL_FRAG, uniforms: silU, side: THREE.DoubleSide});
  const blurMat = new THREE.ShaderMaterial({vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, uniforms: {tSrc: {value: null}, uDir: {value: new THREE.Vector2()}}, depthTest: false, depthWrite: false});
  const blurQuad = new FullScreenQuad(blurMat);
  const blur = ([a, b], px, passes) => {
    for (let i = 0; i < passes; i++) {
      blurMat.uniforms.tSrc.value = a.texture;
      blurMat.uniforms.uDir.value.set(px / SR, 0);
      renderer.setRenderTarget(b);
      blurQuad.render(renderer);
      blurMat.uniforms.tSrc.value = b.texture;
      blurMat.uniforms.uDir.value.set(0, px / SR);
      renderer.setRenderTarget(a);
      blurQuad.render(renderer);
    }
  };
  const black = new THREE.Color(0, 0, 0);
  const prevClear = new THREE.Color();
  // floor: 'full' (a wide pass and a tight one), 'one' (the wide pass only), 'half' / 'quarter' (that, every 2nd / 4th
  // frame)
  let floorMode = 'full';
  let floorTick = 0;
  const floorShadow = (c) => {
    if ((floorMode === 'half' && floorTick++ % 2) || (floorMode === 'quarter' && floorTick++ % 4)) return;
    shCam.position.set(c.x, floorY - 0.01, c.z);
    shCam.lookAt(c.x, floorY + 1, c.z);
    shCam.updateMatrixWorld();
    shCam.updateProjectionMatrix();
    renderer.getClearColor(prevClear);
    const prevA = renderer.getClearAlpha();
    const prevOv = scene.overrideMaterial;
    const prevSh = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(black, 1);
    scene.overrideMaterial = silMat;
    const passes = floorMode === 'full' ? [
      [soft, 1.0, 1.0, 3.2, 4],
      [near, 0.0, 1.5, 1.2, 2],
    ] : [[soft, 1.0, 1.0, 3.2, 3]];
    backU.uNear.value = floorMode === 'full' ? 0.55 : 0;
    for (const [rt, base, far, px, passes2] of passes) {
      silU.uBase.value = base;
      silU.uFar.value = far;
      renderer.setRenderTarget(rt[0]);
      renderer.clear();
      renderer.render(scene, shCam);
      blur(rt, px, passes2);
    }
    scene.overrideMaterial = prevOv;
    renderer.shadowMap.autoUpdate = prevSh;
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevA);
    backU.uVP.value.multiplyMatrices(shCam.projectionMatrix, shCam.matrixWorldInverse);
  };

  // a dark studio for the camera lenses only: black all round with a few hard softboxes, so the glass reads deep
  // black with crisp highlights instead of mirroring the pale studio as a grey haze
  const lensEnv = (() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#050506');
    const box = (w, h, dir, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 0.98, 0.95).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(new V3(...dir).normalize().multiplyScalar(15));
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(10, 6, [-0.2, 1, 0.2], 6); // overhead
    box(1.6, 12, [-0.85, 0.3, 0.45], 7); // a tall strip, left
    box(3.2, 2.2, [0.42, 0.62, 0.66], 9); // a small box above the camera: the hot spot on the dome
    box(1.2, 10, [0.75, 0.2, -0.6], 3); // a rim strip behind
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.01).texture;
    pm.dispose();
    return tex;
  })();

  // ------------------------------------------------------------ the bee and the guides
  let bee = null;
  const addBee = (b) => {
    bee = b;
    scene.add(b.root);
    b.root.traverse((o) => {
      if (o.isMesh && !b.clear.includes(o)) o.layers.enable(BEE_LAYER);
    });
    skip.push(...b.clear);
    for (const m of [b.M.lens, b.M.lensGlass]) {
      if (!m) continue;
      m.envMap = lensEnv;
      m.needsUpdate = true;
    }
  };
  const guides = buildGuides();
  scene.add(guides.group);
  skip.push(guides.group);

  const size = {w: 1920, h: 1080, pr: 1};
  const resize = (w, h, pr) => {
    Object.assign(size, {w, h, pr});
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    backU.uRes.value.set(Math.round(w * pr), Math.round(h * pr));
    guides.resize(Math.round(w * pr), Math.round(h * pr), pr);
  };
  // cam: target (tx, ty, tz), azimuth from +z toward +x, elevation, distance, screen shift sx/sy in CSS px
  const frame = (cam, ops = {}) => {
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    const c = bee ? bee.root.position : new V3();
    key.target.position.set(c.x + 0.1, c.y, c.z);
    key.position.copy(key.target.position).addScaledVector(KEY, 8);
    key.target.updateMatrixWorld();
    guides.update(camera, ops);
    floorShadow(c);
    composer.render();
  };
  const pv = new V3();
  /** World point to CSS px, or null behind the camera. Call after frame(). */
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setAOSkip = (list) => {
    extra = list;
  };
  // a live page's quality knobs: MSAA samples, the AO pass, the key's shadow map
  const setQuality = ({samples, ao, shadow, floor, self, blur}) => {
    if (blur !== undefined) key.shadow.blurSamples = blur;
    if (floor !== undefined) floorMode = floor;
    if (self !== undefined) key.castShadow = self;
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined && shadow !== key.shadow.mapSize.x) {
      key.shadow.mapSize.set(shadow, shadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
  };
  return {renderer, scene, camera, composer, gtao, key, resize, frame, addBee, addBody: addBee, size, floorY, project, setAOSkip, setQuality};
}
