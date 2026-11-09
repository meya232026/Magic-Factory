// The robotic tarantula: an approved jumping spider with only the body changed, after a tarantula reference picture. The same shop, materials, kitbash density, leg rig, IK and pose; new are the domed
// riveted carapace of white plates with a dark mechanism ring round its rim, the eye plate with eight glossy black
// lenses (two large in the centre, six smaller round them, each in a white riveted socket with a glowing orange
// bezel), two big white plated chelicerae with dark curved fangs whose tips glow orange, short plated pedipalps, a
// heavier egg-shaped abdomen that is a white cage of riveted curved bands holding clear glass panes over glowing
// orange coils, tubes and dark gears, and thicker legs with glowing orange joint rings, black bristle spikes along
// every segment and tapered tips with an orange claw for feet.
// Body frame: +x forward (the face), y up, +z the tarantula's right; the origin is the cephalothorax's centre, the
// floor is FLOOR_Y below it. Paired parts are built once for the right side and mirrored (scale.z = -1); side 0 is the
// left, side 1 the right (the near side in the hero view). pose(state) sets everything from one state (see pose).
import * as THREE from 'three';
import {rng} from '../kit/util.js';
import {aimX, coil, cylX, cylZ, D2R, gearGeo, gearX, makeMaterials, merge, put, rbox, ring, sweepX, taperTube, tube, V3} from './parts.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ssw = (e, s, f) => smoother((e - s) / (f - s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;

export const FLOOR_Y = -0.72;
// the foot wheel's radius: the IK puts the wheel's centre this far over the floor
export const WHEEL_R = 0.074;
// the shells are turned round the x axis and squashed in y by these
const SQ_H = 0.86;
const SQ_A = 0.86;

// flat normals everywhere: the facets of the armour catch the softboxes as separate crisp bands
const facet = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
};
// a thick shell of revolution along x: outer radius rFn(u) for u 0..1 over x0..x1, wall t
function shellP(x0, x1, rFn, t, steps = 30) {
  const out = [];
  const inn = [];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    const x = x0 + (x1 - x0) * u;
    const r = rFn(u);
    out.push([x, r]);
    inn.push([x, Math.max(0, r - t)]);
  }
  return [...out, ...inn.reverse()];
}
// an angular armour plate round the x axis: a slab with chamfered top edges (its x1 edge raised by `rise`), swept
// over a0..a1 (degrees, 0 = +y, 90 = +z) in `segs` flat facets
function armour(x0, x1, r, t, a0, a1, segs, ch = 0.014, rise = 0) {
  const s = Math.sign(x1 - x0) || 1;
  const P = [
    [x0, r - t],
    [x0, r - ch],
    [x0 + s * ch, r],
    [x1 - s * ch, r + rise],
    [x1, r + rise - ch],
    [x1, r - t],
  ];
  return facet(sweepX(P, {a0: a0 * D2R, a1: a1 * D2R, segs, smooth: 10}));
}
// a domed plate round the x axis: it follows the radius rf(x) from x0 to x1 lifted by `off`, `t` thick, its two x
// ends chamfered, over a0..a1 degrees; shaded smooth along the dome so the softboxes run over it as long soft bands
function domePlate(rf, x0, x1, a0, a1, off = 0.012, t = 0.032, ch = 0.012) {
  const s = Math.sign(x1 - x0) || 1;
  const n = 12;
  const r = (x) => Math.max(0, rf(x) + off);
  const P = [
    [x0, Math.max(0, r(x0) - t)],
    [x0, Math.max(0, r(x0) - ch)],
  ];
  for (let k = 0; k <= n; k++) {
    const x = x0 + s * ch + ((x1 - x0 - 2 * s * ch) * k) / n;
    P.push([x, r(x)]);
  }
  P.push([x1, Math.max(0, r(x1) - ch)], [x1, Math.max(0, r(x1) - t)]);
  for (let k = n - 1; k >= 1; k--) {
    const x = x0 + ((x1 - x0) * k) / n;
    P.push([x, Math.max(0, r(x) - t)]);
  }
  return sweepX(P, {a0: a0 * D2R, a1: a1 * D2R, segs: Math.max(3, Math.round(Math.abs(a1 - a0) / 3.5)), smooth: 24});
}
const ringZ = (z0, z1, r0, r1, round) => ring(z0, z1, r0, r1, round).rotateY(-Math.PI / 2);
const ringY = (y0, y1, r0, r1, round) => ring(y0, y1, r0, r1, round).rotateZ(Math.PI / 2);

// the carapace's plan: a domed egg along x (u 0 at the back, 1 at the face), an ellipse behind its crown and a blunter
// super-ellipse in front, so the eye plate stands as a broad rounded face
const HX = [-0.42, 0.8];
const HU = 0.45;
const RH = (u) => {
  const v = (u - HU) / (u < HU ? HU : 1 - HU);
  return 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(v), u < HU ? 2.2 : 3.2)));
};
const rH = (x) => RH(clamp((x - HX[0]) / (HX[1] - HX[0]), 0, 1));
// the abdomen in its own frame (origin at the waist joint): x from AX0 back to AX1, an egg fullest a little forward,
// heavier than the jumping spider's
const AX0 = -0.06;
const AX1 = -1.8;
const RA = (u) => 0.86 * Math.pow(Math.sin(Math.PI * clamp(0.035 + u * 0.94, 0, 1)), 0.55) * (1 + 0.06 * Math.sin(Math.PI * u) - 0.05 * u);
const rA = (x) => RA(clamp((x - AX0) / (AX1 - AX0), 0, 1));
const xA = (u) => AX0 + (AX1 - AX0) * u;
// the lens is built at the jumping spider's main-lens radius and scaled to each eye's size
const EYE_R = 0.196;

// the right side's legs: the mount on the flank, the foot's home spot on the floor (body frame), segment lengths
// (coxa, femur, tibia, tarsus). Every leg has its own lengths so the knees stand at different heights; the homes fan
// from forward to back, the front pair reaching ahead as a jumping spider's do.
export const LEGS = [
  {m: [0.44, -0.14, 0.47], home: [1.74, 1.26], Lc: 0.13, Lf: 0.82, Lt: 0.86, Lr: 0.36},
  {m: [0.26, -0.13, 0.48], home: [0.76, 1.86], Lc: 0.13, Lf: 0.8, Lt: 0.84, Lr: 0.35},
  {m: [0.02, -0.13, 0.48], home: [-0.58, 1.92], Lc: 0.13, Lf: 0.86, Lt: 0.9, Lr: 0.36},
  {m: [-0.22, -0.13, 0.42], home: [-1.6, 1.38], Lc: 0.13, Lf: 0.92, Lt: 0.96, Lr: 0.38},
];
export const LEG_NAMES = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
/** The home foot spot of leg i (0-3 left, 4-7 right) in the body frame: the wheel's centre over the floor. */
export const legHome = (i) => {
  const L = LEGS[i % 4];
  const s = i < 4 ? -1 : 1;
  return [L.home[0], FLOOR_Y + WHEEL_R, s * L.home[1]];
};
// where the feet go with the legs tucked in the air (the jump): the front pair reaching ahead and up, the back pair
// trailing, all pulled in toward the body
const TUCK = [
  [1.5, -0.12, 0.86],
  [0.66, -0.3, 1.3],
  [-0.4, -0.36, 1.32],
  [-1.3, -0.26, 1.0],
];
export const legTuck = (i) => {
  const T = TUCK[i % 4];
  return [T[0], T[1], (i < 4 ? -1 : 1) * T[2]];
};

// 2-bone IK in a leg's own side frame (z outward): coxa yaw, femur and tibia pitch (knee up), the tarsus hung from
// the ankle steeply down and a little outward so the wheel lands on its spot
function legIK(L, f) {
  const dx = f[0] - L.m[0];
  const dz = f[2] - L.m[2];
  const dy = f[1] - L.m[1];
  const yaw = Math.atan2(dz, dx);
  const h = Math.hypot(dx, dz) - L.Lc;
  const ax = h - L.Lr * 0.36;
  const ay = dy + L.Lr * 0.93;
  const Draw = Math.hypot(ax, ay);
  const D = clamp(Draw, Math.abs(L.Lf - L.Lt) + 0.02, (L.Lf + L.Lt) * 0.995);
  const ca = clamp((L.Lf * L.Lf + D * D - L.Lt * L.Lt) / (2 * L.Lf * D), -1, 1);
  const fem = Math.atan2(ay, ax) + Math.acos(ca);
  const kx = L.Lf * Math.cos(fem);
  const ky = L.Lf * Math.sin(fem);
  const tx = (ax / (Draw || 1)) * D;
  const ty = (ay / (Draw || 1)) * D;
  const tibA = Math.atan2(ty - ky, tx - kx);
  const tarA = Math.atan2(-0.93, 0.36);
  return {yaw, fem, tib: tibA - fem, tar: tarA - tibA};
}

// ---------------------------------------------------------------- the shared shop every builder uses
function makeShop(M) {
  const grp = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  // small parts (bolts, seams, tabs) collected per parent and material and merged at the end: one draw call each
  const bins = new Map();
  const decal = (parent, geo, mat, m4) => {
    if (!bins.has(parent)) bins.set(parent, new Map());
    const b = bins.get(parent);
    if (!b.has(mat)) b.set(mat, []);
    b.get(mat).push(m4 ? geo.applyMatrix4(m4) : geo);
  };
  const flush = () => {
    for (const [parent, b] of bins) for (const [mat, list] of b) put(parent, merge(list), mat);
    bins.clear();
  };
  const m4 = new THREE.Matrix4();
  const rx = new THREE.Matrix4();
  // a bolt head on the surface of a shell round x: at x, angle a (0 = +y, 90° = +z), radius r
  const bolt = (parent, x, a, r, s = 1, mat = M.black) => decal(parent, new THREE.CylinderGeometry(0.0075 * s, 0.0085 * s, 0.01, 8), mat, m4.makeTranslation(x, Math.cos(a) * r, Math.sin(a) * r).multiply(rx.makeRotationX(a)));
  // a thin dark seam along x on the shell, from x0 to x1 at angle a
  const seam = (parent, x0, x1, a, r, mat = M.black) => decal(parent, new THREE.BoxGeometry(Math.abs(x1 - x0), 0.006, 0.006), mat, m4.makeTranslation((x0 + x1) / 2, Math.cos(a) * r, Math.sin(a) * r).multiply(rx.makeRotationX(a)));
  // a small rectangular tab on the shell: a vent (black) or an accent (orange)
  const tab = (parent, x, a, r, w, l, mat, h = 0.012) => decal(parent, rbox(l, h, w, Math.min(0.006, h / 2.2)), mat, m4.makeTranslation(x, Math.cos(a) * r, Math.sin(a) * r).multiply(rx.makeRotationX(a)));
  // a joint wheel round z: black drum, orange rings on its outer face (or both), graphite hubs, a steel pin, teeth
  // (band: an orange band round the drum; the orange face ring sits on -z, which faces forward on a sideways leg)
  const wheelZ = (parent, r, wd, accent = true, teeth = 0, band = false) => {
    const g = new THREE.Group();
    parent.add(g);
    put(g, ringZ(-wd / 2, wd / 2, 0, r, r * 0.22), M.black);
    if (teeth) put(g, gearGeo(teeth, r * 1.14, r * 0.98, wd * 0.5, r * 0.5), M.graphite);
    put(g, ringZ(-wd * 0.1, wd * 0.1, r * 0.92, r * 1.03, 0.004), band ? M.orange : M.gunmetal);
    for (const s of [-1, 1]) {
      const a = s * (wd / 2 - 0.004);
      const b = a + s * 0.013;
      put(g, ringZ(Math.min(a, b), Math.max(a, b), r * 0.6, r * 0.86, 0.004), accent && s < 0 ? M.orange : M.graphite);
      const c = s * wd * 0.5;
      const d = c + s * 0.016;
      put(g, ringZ(Math.min(c, d), Math.max(c, d), 0, r * 0.42, 0.005), M.graphite);
      for (let k = 0; k < 6; k++) {
        const an = (k / 6) * Math.PI * 2;
        decal(g, new THREE.CylinderGeometry(0.006, 0.006, 0.008, 6).rotateX(Math.PI / 2), M.steel, m4.makeTranslation(Math.cos(an) * r * 0.5, Math.sin(an) * r * 0.5, s * (wd / 2 + 0.012)));
      }
    }
    put(g, cylZ(r * 0.14, r * 0.14, wd + 0.05, 14), M.steel);
    return g;
  };
  // a bristle: a thin black spike from `base` along `dir`
  const UY = new THREE.Vector3(0, 1, 0);
  const qd = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const spike = (parent, base, dir, len, rb = 0.0042) => {
    const g = new THREE.CylinderGeometry(0.0005, rb, len, 5, 1).translate(0, len / 2, 0);
    qd.setFromUnitVectors(UY, dir.clone().normalize());
    decal(parent, g, M.black, new THREE.Matrix4().compose(base, qd, one));
  };
  // bristles along a limb segment round x: n spikes off radius r between x0 and x1, each leaning toward +x (the tip)
  const bristles = (parent, x0, x1, r, n, len, R, lean = [0.4, 0.85], rb = 0.0042) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (x1 - x0) * ((i + R()) / n);
      const a = R() * Math.PI * 2;
      const tl = lean[0] + (lean[1] - lean[0]) * R();
      const c = Math.cos(a);
      const s = Math.sin(a);
      spike(parent, new THREE.Vector3(x, c * r, s * r), new THREE.Vector3(Math.sin(tl), Math.cos(tl) * c, Math.cos(tl) * s), len * (0.7 + 0.6 * R()), rb);
    }
  };
  return {grp, decal, flush, bolt, seam, tab, wheelZ, spike, bristles};
}

export function buildSpider({seed = 11} = {}) {
  const M = makeMaterials();
  // the canopy: clear, bright glass with a hard coat, so it reads light over the mechanism
  M.canopy = new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.04, ior: 1.42, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 2.2});
  // the glow inside the main lenses' bezels: a thin warm ring, kept under 1 so the bloom-free tone curve holds it
  M.glow = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ff6a1c', emissiveIntensity: 1.6});
  // the tarantula's glowing orange: the joint rings, eye bezels, fang and claw tips, the tubes in the cage; and the
  // hotter coils inside the glass
  M.glowO = new THREE.MeshStandardMaterial({color: '#ff5a1f', emissive: '#ff5010', emissiveIntensity: 1.25, roughness: 0.32, metalness: 0});
  M.glowHot = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ffa21a', emissiveIntensity: 3.0, roughness: 0.4, metalness: 0});
  M.glowTube = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ff7a14', emissiveIntensity: 2.6, roughness: 0.35, metalness: 0});
  const R = rng(seed);
  const S = makeShop(M);
  const {grp, bolt, seam, tab, wheelZ} = S;
  const root = new THREE.Group();
  // explode items, as the scorpion's: a part's home, a direction and distance it travels over its window s..f of the
  // explode, past 0.45 a further `far` offset (the teardown layer), an optional turn
  const X = [];
  const ex = (obj, dir, dist, s = 0, f = 1, spin = null, far = null) => {
    const d = new V3(...dir).normalize();
    X.push({obj, home: obj.position.clone(), q0: obj.quaternion.clone(), dir: d, dist, s, f, spin, far: far ? new V3(...far) : d.clone().multiplyScalar(dist * 1.6 + 0.25)});
    return obj;
  };
  const clear = [];
  const anchors = {};
  const anchor = (key, obj, x, y, z) => {
    if (!anchors[key]) anchors[key] = {obj, at: new V3(x, y, z)};
  };
  // side 0 is the left (mirrored), side 1 the right (the near side in the hero view)
  const mirror = (parent) =>
    [-1, 1].map((s) => {
      const g = new THREE.Group();
      g.scale.z = s;
      parent.add(g);
      return g;
    });
  const AX = new V3(1, 0, 0);
  const AY = new V3(0, 1, 0);
  const AZ = new V3(0, 0, 1);
  const body = grp(root);
  const sides = mirror(body);
  const spinners = [];
  // clock: 'T' turns on spinT, 'A' on spinA (the abdomen's gears, which run fast while the canopy is open)
  const spinner = (obj, axis, rate, clock = 'T') => {
    spinners.push({obj, axis, rate, clock, q0: obj.quaternion.clone()});
    return obj;
  };
  // a small camera lens looking along +x of its mount: a black barrel with a thin orange bezel, graphite steps, a deep
  // black element with a small amber pupil under a glass dome
  const lens = (parent, Rr) => {
    const g = new THREE.Group();
    parent.add(g);
    put(g, ring(-0.03, 0.03, Rr * 0.55, Rr, Rr * 0.12), M.black);
    put(g, ring(0.026, 0.034, Rr * 0.9, Rr * 1.01, 0.003), M.orange);
    put(g, ring(0.0, 0.03, Rr * 0.5, Rr * 0.8, 0.005), M.graphite);
    put(g, ring(-0.01, 0.018, Rr * 0.34, Rr * 0.56, 0.004), M.gunmetal);
    const inner = put(g, new THREE.SphereGeometry(Rr * 0.6, 32, 16, 0, Math.PI * 2, 0, 1.2), M.lens);
    inner.rotation.z = -Math.PI / 2;
    inner.position.x = -Rr * 0.32;
    put(g, cylX(Rr * 0.13, Rr * 0.13, 0.006, 20), M.amber, Rr * 0.29, 0, 0);
    const gl = put(g, new THREE.SphereGeometry(Rr * 0.82, 40, 20, 0, Math.PI * 2, 0, 1.25), M.lensGlass);
    gl.rotation.z = -Math.PI / 2;
    gl.position.x = -Rr * 0.42;
    clear.push(gl);
    return g;
  };
  // a ring of small gears and barrels round x: the dark mechanism that shows between the plates
  const gearRing = (parent, x, rr, n, sq, rate) => {
    const w = spinner(grp(parent, x, 0, 0), AX, rate);
    const inner = grp(w);
    inner.scale.y = sq;
    put(inner, ring(-0.035, 0.035, rr * 0.7, rr * 0.92, 0.01), M.graphite);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const g = grp(inner, 0, Math.cos(a) * rr, Math.sin(a) * rr);
      g.rotation.x = -a;
      if (k % 3 === 0) put(g, gearGeo(9, 0.042, 0.034, 0.03, 0.01).rotateX(Math.PI / 2), M.black);
      else if (k % 3 === 1) put(g, cylX(0.024, 0.024, 0.07, 10), k % 6 === 1 ? M.gunmetal : M.black);
      else put(g, rbox(0.05, 0.03, 0.04, 0.008), k % 12 === 2 ? M.orange : M.graphite);
    }
    return w;
  };

  // ================================================================ cephalothorax: the domed carapace and the eye plate
  const head = grp(body);
  const headSq = grp(head);
  headSq.scale.y = SQ_H;
  // the black inner hull, a graphite liner, the faceted belly (the sternum)
  put(headSq, sweepX(shellP(HX[0] + 0.02, HX[1] - 0.03, (u) => RH(u) * 0.88, 0.03)), M.black);
  put(headSq, sweepX(shellP(HX[0] + 0.05, HX[1] - 0.08, (u) => RH(u) * 0.6, 0.02)), M.graphite);
  put(headSq, facet(sweepX(shellP(HX[0] + 0.08, 0.5, (u) => RH(0.06 + u * 0.66) * 0.95, 0.03, 10), {a0: 138 * D2R, a1: 222 * D2R, segs: 6})), M.graphite);
  // the carapace: per side three bays of domed plates in three rows, a dark gap between every plate, rivets along every
  // edge, one black vent and one orange tab; the lower rim stays open over the dark mechanism ring
  const BAYS = [
    [-0.37, -0.17],
    [-0.12, 0.1],
    [0.15, 0.365],
  ];
  const ROWS = [
    [6.5, 30],
    [39, 61],
    [70, 95],
  ];
  const plateBolts = (g, rf, x0, x1, a0, a1, off) => {
    const nA = Math.max(2, Math.round((a1 - a0) / 9));
    for (const x of [x0 + 0.022, x1 - 0.022]) for (let k = 0; k <= nA; k++) bolt(g, x, (a0 + 3 + ((a1 - a0 - 6) * k) / nA) * D2R, rf(x) + off + 0.001, 1.15);
    const nX = Math.max(1, Math.round(Math.abs(x1 - x0) / 0.08));
    for (const a of [a0 + 2.6, a1 - 2.6])
      for (let k = 1; k < nX; k++) {
        const x = x0 + ((x1 - x0) * k) / nX;
        bolt(g, x, a * D2R, rf(x) + off + 0.001, 1.15);
      }
  };
  const topG = [];
  const sideG = [];
  for (const side of mirror(head)) {
    const sq = grp(side);
    sq.scale.y = SQ_H;
    const tg = grp(sq);
    const sg = grp(sq);
    for (const [bi, [x0, x1]] of BAYS.entries()) {
      for (const [ri, [a0, a1]] of ROWS.entries()) {
        const g = ri < 2 ? tg : sg;
        put(g, domePlate(rH, x0, x1, a0, a1), M.shell);
        plateBolts(g, rH, x0, x1, a0, a1, 0.012);
      }
      const xm = (x0 + x1) / 2;
      if (bi === 1) tab(tg, xm, 51.5 * D2R, rH(xm) + 0.014, 0.03, 0.1, M.black);
      if (bi === 2) tab(sg, x0 + 0.06, 90 * D2R, rH(x0 + 0.06) + 0.014, 0.04, 0.06, M.orange);
    }
    topG.push(tg);
    sideG.push(sg);
    ex(tg, [0, 1, 0.5], 0.36, 0.05, 0.7, null, [0, 0.9, 0.5]);
    ex(sg, [0.05, -0.05, 1], 0.36, 0.05, 0.7, null, [0.05, -0.1, 0.9]);
  }
  // the spine channel between the top rows: a recessed black floor and a row of small turning gears with hubs
  const channel = grp(head);
  {
    const sq = grp(channel);
    sq.scale.y = SQ_H;
    put(sq, domePlate(rH, -0.36, 0.58, -6, 6, -0.006, 0.03, 0.006), M.black);
    for (let k = 0; k < 8; k++) {
      const x = -0.27 + k * 0.105;
      const g = spinner(grp(channel, x, (rH(x) - 0.006) * SQ_H, 0), AY, k % 2 ? 1.4 : -1.4);
      put(g, gearGeo(11, 0.029, 0.024, 0.016, 0.008).rotateX(Math.PI / 2), k % 3 === 1 ? M.gunmetal : M.graphite);
      put(g, new THREE.CylinderGeometry(0.011, 0.011, 0.026, 10), k === 2 || k === 5 ? M.orange : M.black, 0, 0.008, 0);
    }
  }
  anchor('channel', channel, 0.1, 0.44, 0);
  ex(channel, [0, 1, 0], 0.5, 0.15, 0.8, null, [0, 1.0, 0]);
  // the visor: the front bay of the carapace over the eye plate, its three rows a little proud of the others
  const visor = grp(head);
  for (const side of mirror(visor)) {
    const sq = grp(side);
    sq.scale.y = SQ_H;
    const [x0, x1] = [0.415, 0.555];
    for (const [a0, a1] of ROWS) {
      put(sq, domePlate(rH, x0, x1, a0, a1, 0.015), M.shell);
      plateBolts(sq, rH, x0, x1, a0, a1, 0.015);
    }
    tab(sq, 0.49, 51.5 * D2R, rH(0.49) + 0.018, 0.03, 0.06, M.orange);
  }
  anchor('visor', visor, 0.5, 0.4, 0.2);
  ex(visor, [0.5, 1, 0], 0.4, 0.1, 0.75, null, [0.6, 0.9, 0]);
  // the eye plate: one domed white plate over the front, riveted round its back edge and its lower lip
  const FX = [0.6, HX[1] + 0.004];
  const face = grp(head);
  {
    const sq = grp(face);
    sq.scale.y = SQ_H;
    put(sq, domePlate(rH, FX[0], FX[1], -128, 128, 0.016, 0.034, 0.012), M.shell);
    for (let k = 0; k <= 24; k++) bolt(sq, FX[0] + 0.022, (-122 + (k * 244) / 24) * D2R, rH(FX[0] + 0.022) + 0.017, 1.15);
    for (const s of [-1, 1])
      for (let k = 0; k < 4; k++) {
        const x = FX[0] + 0.045 + k * 0.035;
        bolt(sq, x, s * 124.5 * D2R, rH(x) + 0.017, 1.15);
      }
    // a graphite lip under the plate's lower edge
    put(sq, domePlate(rH, FX[0] + 0.01, 0.76, 129, 136, 0.006, 0.03, 0.006), M.graphite);
    put(sq, domePlate(rH, FX[0] + 0.01, 0.76, -136, -129, 0.006, 0.03, 0.006), M.graphite);
  }
  anchor('face', face, 0.72, 0.22, 0.26);
  ex(face, [1, 0.1, 0], 0.32, 0.15, 0.8, null, [1.0, 0.1, 0]);

  // the eyes: eight glossy black lenses on the eye plate, two large in the centre and six smaller round them, each built
  // like the jumping spider's main lens (a black barrel, a glowing orange bezel, graphite steps, an iris of ten blades,
  // an amber pupil, a clear dome) and scaled to its size, sitting in a white riveted socket aimed along the plate's
  // normal. The two large ones carry the unscrew rig; the six small ones swivel in their sockets.
  const xFront = (rr) => {
    let lo = HX[0] + (HX[1] - HX[0]) * HU;
    let hi = HX[1];
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (rH(m) > rr) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const onFace = (y, z, off) => {
    const yu = y / SQ_H;
    const rr = Math.hypot(yu, z);
    const x = xFront(Math.max(0.001, rr - off));
    const dr = (rH(x + 0.002) - rH(x - 0.002)) / 0.004;
    return {p: new V3(x, y, z), n: new V3(-dr, yu / (SQ_H * rr), z / rr).normalize()};
  };
  const buildEye = (parent, size, dir, n) => {
    const g = grp(parent);
    g.scale.setScalar(size / EYE_R);
    const mount = grp(g);
    aimX(mount, dir);
    const Rr = EYE_R;
    put(mount, ring(-0.11, 0.074, Rr * 0.84, Rr * 1.0, 0.012), M.black);
    put(mount, ring(0.05, 0.08, Rr * 0.9, Rr * 1.1, 0.006), M.glowO);
    put(mount, ring(0.052, 0.062, Rr * 0.82, Rr * 0.9, 0.002), M.glow);
    put(mount, ring(0.03, 0.062, Rr * 0.72, Rr * 0.86, 0.008), M.graphite);
    put(mount, ring(0.036, 0.054, Rr * 0.58, Rr * 0.74, 0.006), M.black);
    put(mount, ring(0.042, 0.05, Rr * 0.52, Rr * 0.6, 0.003), M.gunmetal);
    put(mount, ring(-0.02, -0.008, 0, Rr * 0.9, 0.003), M.black);
    put(mount, ring(0.04, 0.046, Rr * 0.22, Rr * 0.56, 0.002), M.graphite);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const b = put(mount, rbox(0.006, Rr * 0.42, Rr * 0.17, 0.002), k % 2 ? M.black : M.graphite, 0.046, Math.cos(a) * Rr * 0.4, Math.sin(a) * Rr * 0.4);
      b.rotation.x = a + 0.6;
    }
    const inner = put(mount, new THREE.SphereGeometry(Rr * 0.46, 48, 24, 0, Math.PI * 2, 0, 1.0), M.lens);
    inner.rotation.z = -Math.PI / 2;
    inner.position.x = 0.012;
    put(mount, ring(0.06, 0.066, Rr * 0.12, Rr * 0.19, 0.002), M.gunmetal);
    put(mount, cylX(Rr * 0.1, Rr * 0.1, 0.006, 24), M.amber, 0.064, 0, 0);
    const R1 = Rr * 1.0;
    const glass = put(mount, new THREE.SphereGeometry(R1, 72, 36, 0, Math.PI * 2, 0, 1.05), M.lensGlass);
    glass.rotation.z = -Math.PI / 2;
    glass.position.x = 0.07 - R1 * Math.cos(1.05);
    glass.castShadow = false;
    clear.push(glass);
    // the socket: a white riveted ring flush on the plate, a black seat under the bezel
    const sock = grp(g);
    aimX(sock, n);
    put(sock, ring(-0.05, 0.05, Rr * 1.06, Rr * 1.34, 0.014), M.shell);
    put(sock, ring(-0.05, 0.04, Rr * 1.0, Rr * 1.08, 0.004), M.black);
    for (let k = 0; k < 8; k++) bolt(sock, 0.05, (k / 8) * Math.PI * 2 + 0.2, Rr * 1.22, 1.6);
    return {mount, kids: [...mount.children], glass};
  };
  const EYES = [
    // key, y, z, barrel radius, how far the aim leans forward from the plate's normal
    ['ame', -0.05, 0.128, 0.104, 0.5],
    ['pme', 0.155, 0.066, 0.054, 0.3],
    ['ple', 0.14, 0.205, 0.052, 0.25],
    ['ale', 0.0, 0.3, 0.054, 0.25],
  ];
  const eyeRigs = [];
  const mainEyes = [];
  const pods = [];
  for (const side of mirror(head)) {
    for (const [key, y, z, size, lean] of EYES) {
      const {p, n} = onFace(y, z, 0.016);
      const dir = n.clone().lerp(new V3(1, 0, 0), lean).normalize();
      if (key === 'ame') {
        const eye = grp(side, p.x, p.y, p.z);
        const {mount, kids, glass} = buildEye(eye, size, dir, n);
        // the rig: every ring out along the axis by its own share, turning as if unscrewed; the iris blades swing open
        const OFF = [0, 0.16, 0.16, 0.26, 0.34, 0.42, 0.04, 0.5, ...Array(10).fill(0.56), 0.66, 0.74, 0.76, 1.0];
        eyeRigs.push(kids.map((o, i) => ({o, home: o.position.clone(), q0: o.quaternion.clone(), off: OFF[i] ?? 0.5, spin: i >= 8 && i < 18 ? 0 : i % 2 ? 1.6 : -1.3, blade: i >= 8 && i < 18})));
        mainEyes.push(eye);
        if (side.scale.z > 0) {
          anchor('lens', mount, 0.08, 0, 0);
          anchor('iris', kids[7], 0, EYE_R * 0.4, 0);
          anchor('eyeGlass', glass, 0, EYE_R, 0);
        }
        ex(eye, [1, 0.1, 0.3], 0.3, 0.3, 0.9, null, [0.9, 0.1, 0.35]);
      } else {
        const pg = grp(side, p.x, p.y, p.z);
        const sw = grp(pg);
        buildEye(sw, size, dir, n);
        pods.push({sw, p: pg, key, k: pods.length});
        if (side.scale.z > 0 && key === 'ale') anchor('ale', pg, 0.03, 0, 0);
        ex(pg, [n.x * 0.5 + 0.3, n.y, n.z], 0.34, 0.2, 0.9, null, [n.x * 0.5 + 0.3, n.y * 0.9, n.z * 0.9]);
      }
    }
  }

  // ================================================================ under the face: the jaw, chelicerae, pedipalps
  // a dense dark block of gears, pistons and hoses, two orange cables per side curling down toward the fangs
  const jaw = grp(head);
  {
    put(jaw, facet(rbox(0.36, 0.16, 0.6, 0.012)), M.black, 0.56, -0.32, 0);
    put(jaw, facet(rbox(0.22, 0.05, 0.46, 0.01)), M.graphite, 0.62, -0.41, 0);
    const big = spinner(grp(jaw, 0.64, -0.31, 0), AZ, 1.1);
    put(big, gearGeo(20, 0.1, 0.088, 0.03, 0.03, 5), M.gunmetal);
    put(big, ringZ(-0.03, 0.03, 0, 0.04, 0.006), M.black);
    for (const s of [-1, 1]) {
      const g = spinner(grp(jaw, 0.7, -0.3, s * 0.24), AX, s * 1.6);
      put(g, gearX(14, 0.07, 0.06, 0.024, 0.016), M.black);
      put(g, cylX(0.026, 0.026, 0.04, 14), s > 0 ? M.orange : M.gunmetal, 0.014, 0, 0);
      const p = grp(jaw, 0.42, -0.16, s * 0.3);
      aimX(p, new V3(0.62, -0.36, -s * 0.28));
      put(p, cylX(0.024, 0.024, 0.16, 12), M.black, 0.08, 0, 0);
      put(p, cylX(0.01, 0.01, 0.14, 8), M.steel, 0.2, 0, 0);
      put(p, rbox(0.03, 0.036, 0.036, 0.008), M.graphite, 0.28, 0, 0);
      put(jaw, tube([[0.36, -0.06, s * 0.4], [0.56, -0.18, s * 0.38], [0.7, -0.28, s * 0.3], [0.76, -0.38, s * 0.2]], 0.013, 40, 8), M.orange);
      put(jaw, tube([[0.3, -0.12, s * 0.36], [0.5, -0.3, s * 0.3], [0.66, -0.36, s * 0.24], [0.72, -0.44, s * 0.12]], 0.011, 40, 8), M.black);
      put(jaw, tube([[0.4, -0.2, s * 0.24], [0.58, -0.36, s * 0.32], [0.7, -0.3, s * 0.36], [0.74, -0.2, s * 0.4]], 0.01, 40, 8), M.graphite);
      for (let k = 0; k < 3; k++) put(jaw, rbox(0.04, 0.03, 0.036, 0.008), k === 1 ? M.steel : M.graphite, 0.46 + k * 0.08, -0.34, s * (0.26 - k * 0.02));
    }
  }
  for (let k = 0; k < 8; k++) {
    const z = -0.28 + k * 0.08;
    S.decal(jaw, rbox(0.012, 0.07, 0.016, 0.004), k % 4 === 1 ? M.graphite : M.steel, new THREE.Matrix4().makeTranslation(0.745, -0.33, z));
    S.decal(jaw, new THREE.CylinderGeometry(0.008, 0.009, 0.012, 8).rotateZ(-Math.PI / 2), M.gunmetal, new THREE.Matrix4().makeTranslation(0.745, -0.265, z + 0.04));
  }
  anchor('jaw', jaw, 0.62, -0.32, 0.2);
  ex(jaw, [0.6, -1, 0], 0.3, 0.2, 0.85, null, [0.6, -0.5, 0]);
  // the chelicerae: a black hinge servo with a glowing ring, a bulging white block of two riveted plates over a black
  // core, and the fang: a big dark curved hook whose last third glows orange, curling down and in toward the other one
  const chel = [];
  for (const side of mirror(head)) {
    const c = grp(side, 0.7, -0.16, 0.13);
    put(c, ringZ(-0.06, 0.06, 0, 0.05, 0.01), M.black);
    put(c, ringZ(0.054, 0.068, 0.03, 0.054, 0.003), M.glowO);
    const arm = grp(c);
    const cg = grp(arm);
    aimX(cg, new V3(0.32, -1, -0.06));
    put(cg, cylX(0.07, 0.058, 0.27, 16), M.black, 0.13, 0, 0);
    put(cg, ring(-0.004, 0.024, 0.06, 0.104, 0.004), M.glowO);
    const rC = (x) => 0.104 + 0.036 * Math.sin(Math.PI * clamp((x - 0.02) / 0.24, 0, 1));
    put(cg, domePlate(rC, 0.03, 0.13, -150, 150, 0.0, 0.034, 0.012), M.shell);
    put(cg, domePlate(rC, 0.142, 0.24, -142, 142, 0.004, 0.034, 0.012), M.shell);
    for (const x of [0.05, 0.11, 0.162, 0.22]) for (const a of [-110, -55, 0, 55, 110]) bolt(cg, x, a * D2R, rC(x) + 0.003, 1.2);
    put(cg, ring(0.236, 0.27, 0.03, 0.072, 0.006), M.black);
    put(cg, ring(0.262, 0.274, 0.036, 0.058, 0.002), M.glowO);
    // the fang on its own pivot at the chelicera's tip, so it flares open in the head act
    const fg = grp(arm, 0.07, -0.21, -0.012);
    put(fg, taperTube([[0.07, -0.21, -0.012], [0.165, -0.29, -0.02], [0.225, -0.395, -0.04], [0.235, -0.475, -0.064]], 0.066, 0.031, 36, 16), M.black, -0.07, 0.21, 0.012);
    put(fg, taperTube([[0.235, -0.473, -0.064], [0.212, -0.535, -0.094], [0.165, -0.565, -0.124], [0.13, -0.566, -0.138]], 0.032, 0.003, 28, 14), M.glowTube, -0.07, 0.21, 0.012);
    chel.push({c, arm, fg});
    if (side.scale.z > 0) anchor('chel', arm, 0.12, -0.36, 0.0);
    ex(c, [1, -0.6, 0.2], 0.3, 0.25, 0.9);
  }
  // the pedipalps: three short segments on black servo joints with glowing rings, the first two white plated and
  // bristled, an orange claw on the tip
  const palps = [];
  for (const side of mirror(head)) {
    const p = grp(side, 0.69, -0.2, 0.275);
    const segs = [];
    let parent = p;
    for (const [i, len] of [0.17, 0.14, 0.11].entries()) {
      const j = grp(parent, i ? segs[i - 1].len : 0, 0, 0);
      const rr = 0.044 - i * 0.007;
      put(j, ringZ(-0.034, 0.034, 0, rr + 0.01, 0.006), M.black);
      put(j, ringZ(0.03, 0.04, rr * 0.6, rr + 0.012, 0.002), M.glowO);
      put(j, cylX(rr * 0.6, rr * 0.5, len, 10), M.black, len / 2, 0, 0);
      if (i < 2) {
        put(j, domePlate(() => rr + 0.016, 0.03, len - 0.016, -150, 150, 0, 0.02, 0.008), M.shell);
        for (const x of [0.045, len - 0.03]) for (const a of [-60, 0, 60]) bolt(j, x, a * D2R, rr + 0.017, 1.0);
        S.bristles(j, 0.04, len - 0.02, rr + 0.014, 10, 0.11, R);
      } else {
        put(j, ring(0.02, len * 0.55, rr * 0.5, rr + 0.012, 0.004), M.shell);
        put(j, taperTube([[len * 0.5, 0, 0], [len, -0.02, 0], [len + 0.04, -0.05, 0]], rr * 0.75, 0.003, 16, 10), M.glowO);
      }
      segs.push({j, len});
      parent = j;
    }
    palps.push(segs);
    ex(p, [1, -0.3, 0.6], 0.32, 0.25, 0.9);
  }

  // ================================================================ the waist: a gear ring and a stalk to the abdomen
  const waist = grp(body);
  ex(gearRing(waist, -0.38, 0.22, 14, 0.85, 0.8), [0, -0.3, 0], 0.2, 0.3, 0.9);
  {
    put(waist, cylX(0.12, 0.13, 0.22, 16), M.black, -0.47, 0.03, 0);
    for (const x of [-0.42, -0.5]) put(waist, ring(x - 0.012, x + 0.012, 0.1, 0.14, 0.004), x < -0.45 ? M.orange : M.gunmetal);
    for (const s of [-1, 1]) {
      put(waist, cylX(0.02, 0.02, 0.24, 10), M.black, -0.44, 0.14, s * 0.12);
      put(waist, cylX(0.008, 0.008, 0.22, 8), M.steel, -0.52, 0.14, s * 0.12);
      put(waist, tube([[-0.3, -0.06, s * 0.2], [-0.42, -0.1, s * 0.22], [-0.56, -0.02, s * 0.2], [-0.66, 0.06, s * 0.18]], 0.014, 32, 8), M.black);
    }
  }

  // ================================================================ abdomen: a white cage of curved bands over clear glass
  // panes, glowing coils and tubes over a dark mechanism inside; the caps front and back, the dark belly under it
  const abd = grp(body, -0.42, 0.2, 0);
  abd.rotation.z = -0.24;
  const aSq = grp(abd);
  aSq.scale.y = SQ_A;
  // the dark hull all round under the glass, and the faceted graphite belly
  put(aSq, sweepX(shellP(AX0, AX1 + 0.02, (u) => RA(u) * 0.82, 0.03), {segs: 64}), M.black);
  put(aSq, facet(sweepX(shellP(AX0 - 0.06, AX1 + 0.08, (u) => RA(0.04 + u * 0.92) * 0.97, 0.03, 12), {a0: 134 * D2R, a1: 226 * D2R, segs: 6})), M.graphite);
  // the front cap and the rear cap, white plates riveted round their rims
  const G0 = 0.035;
  const G1 = 0.88;
  const capF = grp(abd);
  {
    const sq = grp(capF);
    sq.scale.y = SQ_A;
    for (let k = 0; k < 5; k++) {
      const a0 = -120 + k * 48 + 4;
      put(sq, domePlate(rA, AX0 - 0.005, xA(G0), a0, a0 + 40, 0.03, 0.04, 0.012), M.shell);
      bolt(sq, xA(G0 * 0.5), (a0 + 22) * D2R, rA(xA(G0 * 0.5)) + 0.031, 1.6, k === 1 ? M.orange : M.black);
    }
    for (let k = -5; k <= 5; k++) bolt(sq, xA(G0) + 0.024, k * 20 * D2R, rA(xA(G0) + 0.024) + 0.031, 1.2);
    tab(sq, xA(G0 * 0.55), 64 * D2R, rA(xA(G0 * 0.55)) + 0.032, 0.03, 0.08, M.black);
  }
  ex(capF, [0.3, 1, 0], 0.3, 0.1, 0.7, null, [0.3, 0.8, 0]);
  // a dark ring of gears and barrels where the cap meets the glass
  ex(gearRing(abd, xA(G0) - 0.01, rA(xA(G0)) * 0.95, 20, SQ_A, -0.6), [0.2, 0.6, 0], 0.25, 0.2, 0.85);
  const capR = grp(abd);
  {
    const sq = grp(capR);
    sq.scale.y = SQ_A;
    put(sq, domePlate(rA, xA(G1), xA(0.945), -150, 150, 0.03, 0.04, 0.012), M.shell);
    put(sq, domePlate(rA, xA(0.952), AX1 - 0.004, -165, 165, 0.03, 0.04, 0.012), M.shell);
    for (let k = -6; k <= 6; k++) bolt(sq, xA(G1) - 0.024, k * 21 * D2R, rA(xA(G1) - 0.024) + 0.031, 1.2);
    for (let k = -5; k <= 5; k++) bolt(sq, xA(0.93), k * 24 * D2R, rA(xA(0.93)) + 0.031, 1.2);
    tab(sq, xA(0.91), 52 * D2R, rA(xA(0.91)) + 0.032, 0.05, 0.06, M.orange);
  }
  ex(capR, [-1, 0.4, 0], 0.32, 0.1, 0.7, null, [-0.9, 0.4, 0]);
  // the cage: meridian bands from cap to cap and two hoops across them, all riveted along both edges, over the clear
  // panes; a few black bristles stand off the bands
  const B_OFF = 0.034;
  const meridian = (g, a, w, u0, u1) => {
    const x0 = xA(u0);
    const x1 = xA(u1);
    put(g, domePlate(rA, x0, x1, a - w, a + w, B_OFF, 0.04, 0.014), M.shell);
    const n = Math.round(Math.abs(x1 - x0) / 0.1);
    for (let k = 1; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      for (const e of [-1, 1]) bolt(g, x, (a + e * (w - 2.2)) * D2R, rA(x) + B_OFF + 0.001, 1.25);
    }
  };
  const hoop = (g, u, du, a0, a1) => {
    const x0 = xA(u - du);
    const x1 = xA(u + du);
    put(g, domePlate(rA, x0, x1, a0, a1, B_OFF + 0.005, 0.046, 0.014), M.shell);
    const n = Math.max(2, Math.round((a1 - a0) / 8));
    const s = Math.sign(x1 - x0);
    for (let k = 0; k <= n; k++) for (const x of [x0 + s * 0.022, x1 - s * 0.022]) bolt(g, x, (a0 + 2 + ((a1 - a0 - 4) * k) / n) * D2R, rA(x) + B_OFF + 0.006, 1.25);
  };
  const pane = (g, a0, a1) => {
    const p = put(g, sweepX(shellP(xA(G0) + 0.01, xA(G1) - 0.01, (u) => RA(G0 + u * (G1 - G0)) + 0.016, 0.012), {a0: a0 * D2R, a1: a1 * D2R, segs: Math.round((a1 - a0) / 2.5)}), M.canopy);
    clear.push(p);
  };
  // bristles off a band's two edges, leaning back toward the tail
  const bandHair = (g, a, w, u0, u1, n) => {
    for (let i = 0; i < n; i++) {
      const u = u0 + (u1 - u0) * ((i + R()) / n);
      const x = xA(u);
      const an = (a + (i % 2 ? 1 : -1) * (w - 1) + (R() - 0.5) * 3) * D2R;
      const rr = rA(x) + B_OFF - 0.004;
      const tl = -(0.25 + 0.5 * R());
      const c = Math.cos(an);
      const s = Math.sin(an);
      S.spike(g, new V3(x, c * rr, s * rr), new V3(Math.sin(tl), Math.cos(tl) * c, Math.cos(tl) * s), 0.2 + 0.14 * R(), 0.006);
    }
  };
  const HOOPS = [0.37, 0.63];
  // the canopy, hinged at its front edge: the top pane between the upper meridians, the top band, the hoops' top runs
  const hingeX = xA(G0);
  const hingeY = (RA(G0) + 0.03) * SQ_A;
  const canopy = grp(abd, hingeX, hingeY, 0);
  {
    const sq = grp(canopy, -hingeX, -hingeY, 0);
    sq.scale.y = SQ_A;
    pane(sq, -54, 54);
    meridian(sq, 0, 5.5, G0 - 0.01, G1 + 0.01);
    for (const u of HOOPS) hoop(sq, u, 0.028, -52, 52);
    bandHair(sq, 0, 5.5, G0 + 0.04, G1 - 0.04, 60);
  }
  anchor('canopy', canopy, -0.5, 0.06, 0.3);
  ex(canopy, [0, 1, 0], 0.55, 0.0, 0.6, null, [0, 0.9, 0]);
  // the side cage per side: the side pane, two meridians, the hoops' side runs
  // the side cage per side, in two bands that open one after the other: the upper (its pane, the 54° meridian and the
  // hoops' upper runs) and the lower (its pane, the 106° meridian, the hoops' lower runs and the rail)
  const aSide = [];
  for (const side of mirror(abd)) {
    const sq = grp(side);
    sq.scale.y = SQ_A;
    const gu = grp(sq);
    pane(gu, 54, 90);
    meridian(gu, 54, 5.5, G0 - 0.01, G1 + 0.01);
    for (const u of HOOPS) hoop(gu, u, 0.028, 52, 90);
    bandHair(gu, 54, 5.5, G0 + 0.04, G1 - 0.04, 48);
    aSide.push({g: gu, w: [0.1, 0.5], dy: 0.07, dz: 0.12});
    ex(gu, [-0.1, 0.4, 1], 0.4, 0.1, 0.75, null, [-0.1, 0.2, 0.9]);
    const g = grp(sq);
    pane(g, 90, 126);
    meridian(g, 106, 5.5, G0 - 0.01, G1 + 0.01);
    for (const u of HOOPS) hoop(g, u, 0.028, 90, 124);
    bandHair(g, 106, 5.5, G0 + 0.04, G1 - 0.04, 52);
    // the dark lower rail the glass seats on, and small hubs along it
    put(g, domePlate(rA, xA(G0), xA(G1), 126, 131, 0.012, 0.03, 0.006), M.graphite);
    for (let k = 0; k < 7; k++) {
      const x = xA(G0 + 0.05 + k * 0.11);
      bolt(g, x, 128.5 * D2R, rA(x) + 0.014, 2.2, k % 3 === 1 ? M.orange : M.gunmetal);
    }
    aSide.push({g, w: [0.22, 0.64], dy: -0.05, dz: 0.18});
    ex(g, [-0.1, 0, 1], 0.4, 0.1, 0.75, null, [-0.1, -0.1, 0.9]);
  }
  // inside the cage: the gear drum along the body (hidden in the hull until the teardown lifts it), the gear clusters
  // and the glowing coils lying on the hull under the glass, glowing tubes and black hoses between them
  const core = grp(abd);
  const coreGears = [];
  {
    const drum = spinner(grp(core, 0, 0.02, 0), AX, 0.9, 'A');
    put(drum, cylX(0.13, 0.13, 1.0, 24), M.graphite, -0.8, 0, 0);
    for (const [x, rr, mat] of [
      [-0.36, 0.3, M.black],
      [-0.54, 0.38, M.gunmetal],
      [-0.74, 0.42, M.black],
      [-0.98, 0.42, M.orange],
      [-1.2, 0.38, M.black],
      [-1.4, 0.3, M.gunmetal],
    ]) {
      const g = grp(drum, x, 0, 0);
      put(g, gearX(Math.round(rr * 70), rr, rr * 0.9, 0.034, 0.14, 6), mat);
      coreGears.push({g, home: g.position.clone(), dir: AX, d: (x + 0.85) * 0.5});
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      put(drum, cylX(0.012, 0.012, 0.94, 8), M.steel, -0.8, Math.cos(a) * 0.17, Math.sin(a) * 0.17);
    }
    // the gear clusters on the hull under the glass, axes out of the hull; they lift off radially in the teardown
    for (const s of [-1, 1]) {
      for (const [u, a, rr, mat, rate] of [
        [0.24, 38, 0.15, M.black, 1.2],
        [0.47, 70, 0.17, M.gunmetal, 1.0],
        [0.58, 26, 0.12, M.black, -1.6],
        [0.74, 84, 0.13, M.graphite, 1.3],
        [0.31, 98, 0.12, M.gunmetal, -1.4],
        [0.52, 8, 0.11, M.graphite, 1.1],
        [0.8, 40, 0.1, M.gunmetal, -1.9],
      ]) {
        const x = xA(u);
        const an = s * a * D2R;
        const rr0 = rA(x) * 0.82 + 0.012;
        const g = grp(core, x, Math.cos(an) * rr0 * SQ_A, Math.sin(an) * rr0);
        g.rotation.x = an;
        const w = spinner(grp(g), AY, rate, 'A');
        put(w, gearGeo(Math.max(9, Math.round(rr * 100)), rr, rr * 0.88, 0.024, rr * 0.28, rr > 0.1 ? 5 : 0).rotateX(Math.PI / 2), mat);
        put(w, new THREE.CylinderGeometry(rr * 0.32, rr * 0.32, 0.05, 16), M.gunmetal, 0, 0.012, 0);
        put(w, new THREE.CylinderGeometry(rr * 0.1, rr * 0.1, 0.07, 10), M.steel, 0, 0.02, 0);
        coreGears.push({g, home: g.position.clone(), dir: new V3(0, Math.cos(an), Math.sin(an)), d: 0.26 + rr});
        if (s > 0 && u === 0.47) anchor('gears', w, 0, 0.03, 0);
      }
    }
    // the glowing coils: a graphite former wound with a hot orange coil between two black end caps, on two clips; they
    // lie along the hull at their own angles and spin on the abdomen's clock
    for (const [i, [u, a, len, yaw, turns]] of [
      [0.2, 18, 0.34, 10, 8],
      [0.26, 76, 0.32, -14, 8],
      [0.34, -32, 0.4, 12, 10],
      [0.44, 44, 0.42, -6, 10],
      [0.5, 100, 0.34, 10, 8],
      [0.55, -68, 0.38, -14, 9],
      [0.6, 14, 0.44, 4, 11],
      [0.69, 64, 0.36, -10, 9],
      [0.76, -22, 0.34, 12, 8],
      [0.8, 104, 0.28, 6, 7],
      [0.42, -102, 0.36, -8, 9],
      [0.68, -94, 0.34, 10, 8],
      [0.3, 36, 0.26, 70, 6],
      [0.62, -40, 0.28, -64, 7],
      [0.15, 60, 0.24, 30, 6],
      [0.16, -14, 0.26, -24, 6],
      [0.5, -16, 0.3, 80, 7],
      [0.36, 86, 0.3, 60, 7],
      [0.72, 28, 0.3, -70, 7],
      [0.84, -60, 0.24, 20, 6],
    ].entries()) {
      const x = xA(u);
      const an = a * D2R;
      const rr0 = rA(x) * 0.82 + 0.06;
      const g = grp(core, x, Math.cos(an) * rr0 * SQ_A, Math.sin(an) * rr0);
      g.rotation.x = an;
      const w = grp(g);
      w.rotation.y = yaw * D2R;
      const sp = spinner(grp(w), AX, i % 2 ? 2.2 : -2.2, 'A');
      put(sp, cylX(0.042, 0.042, len, 16), M.glowO);
      put(sp, coil(0.056, 0.0135, turns, len * 0.8, 260), M.glowHot, -len * 0.4, 0, 0);
      for (const e of [-1, 1]) {
        put(sp, cylX(0.074, 0.074, 0.036, 18), M.black, e * len * 0.47, 0, 0);
        put(sp, ring(e * len * 0.47 - 0.008, e * len * 0.47 + 0.008, 0.073, 0.08, 0.002), M.gunmetal);
      }
      put(sp, cylX(0.008, 0.008, len + 0.07, 8), M.steel);
      for (const e of [-1, 1]) put(w, rbox(0.03, 0.05, 0.1, 0.006), M.black, e * len * 0.3, -0.04, 0);
      coreGears.push({g, home: g.position.clone(), dir: new V3(0, Math.cos(an), Math.sin(an)), d: 0.3});
    }
    // glowing tubes and black hoses running along the hull from the front cap to the back
    const run = (a, da, u0, u1, lift) => {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const u = u0 + ((u1 - u0) * k) / 6;
        const x = xA(u);
        const an = (a + da * Math.sin((k / 6) * Math.PI)) * D2R;
        const rr = rA(x) * 0.82 + lift;
        pts.push([x, Math.cos(an) * rr * SQ_A, Math.sin(an) * rr]);
      }
      return pts;
    };
    for (const [a, da, u0, u1] of [
      [30, 20, 0.14, 0.84],
      [-10, -26, 0.16, 0.8],
      [70, -18, 0.15, 0.86],
      [-56, 22, 0.18, 0.82],
      [110, 10, 0.2, 0.78],
      [-112, -10, 0.2, 0.8],
    ])
      put(core, tube(run(a, da, u0, u1, 0.03), 0.02, 64, 8), M.glowTube);
    for (const [a, da, u0, u1] of [
      [52, 14, 0.13, 0.86],
      [-26, -18, 0.15, 0.84],
      [88, -16, 0.16, 0.82],
      [-80, 12, 0.14, 0.86],
      [4, 22, 0.2, 0.8],
    ])
      put(core, tube(run(a, da, u0, u1, 0.026), 0.021, 64, 8), M.black);
    // the coils' light on the dark mechanism round them: short-range orange lamps between the hull and the glass
    for (const [u, a] of [
      [0.22, 40],
      [0.4, 10],
      [0.5, 70],
      [0.62, 30],
      [0.76, 60],
      [0.36, 100],
      [0.3, -30],
      [0.6, -60],
    ]) {
      const x = xA(u);
      const an = a * D2R;
      const rr = rA(x) * 0.82 + 0.13;
      const l = new THREE.PointLight('#ff7a2a', 0.45, 0.75, 2);
      l.position.set(x, Math.cos(an) * rr * SQ_A, Math.sin(an) * rr);
      core.add(l);
    }
  }
  anchor('core', core, -0.76, 0.5, 0.18);
  ex(core, [-0.2, 1, 0], 0.3, 0.25, 0.85, null, [-0.3, 0.8, 0]);
  // the spinnerets at the back: three black nozzles round an orange ring
  const spin = grp(abd, AX1 + 0.04, -0.12, 0);
  {
    aimX(spin, new V3(-1, -0.5, 0));
    put(spin, ring(-0.02, 0.06, 0.04, 0.1, 0.01), M.black);
    put(spin, ring(0.05, 0.062, 0.06, 0.1, 0.003), M.glowO);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      put(spin, cylX(0.024, 0.016, 0.1, 10), M.black, 0.08, Math.cos(a) * 0.05, Math.sin(a) * 0.05);
    }
  }
  ex(spin, [-1, -0.3, 0], 0.3, 0.2, 0.85);
  // the dark band between the cage and the belly: servo hubs and pistons
  for (const side of mirror(abd)) {
    for (let i = 0; i < 4; i++) {
      const x = xA(0.22 + i * 0.16);
      const a = 136 * D2R;
      const R0 = rA(x) * 0.96;
      const rr = 0.05 - 0.004 * i;
      const g = spinner(grp(side, x, Math.cos(a) * R0 * SQ_A, Math.sin(a) * R0), AZ, i % 2 ? 0.9 : -0.9, 'A');
      put(g, gearGeo(13, rr * 1.35, rr * 1.18, 0.022, rr * 0.4, 4), M.graphite, 0, 0, -0.016);
      put(g, ringZ(-0.016, 0.026, 0, rr, rr * 0.25), M.black);
      put(g, ringZ(0.024, 0.032, rr * 0.62, rr * 0.88, 0.003), i === 1 ? M.glowO : M.gunmetal);
      ex(g, [0, -0.2, 1], 0.3, 0.3, 0.9);
    }
  }

  // ================================================================ the big level on the head: flank servos and pistons
  for (const side of sides) {
    const band = grp(side);
    for (const [i, x] of [0.38, 0.14, -0.1, -0.3].entries()) {
      const a = 104 * D2R;
      const R0 = rH(x) * 0.95;
      const g = spinner(grp(band, x, Math.cos(a) * R0 * SQ_H - 0.02, Math.sin(a) * R0), AZ, i % 2 ? 1.0 : -1.0);
      const rr = 0.058;
      put(g, gearGeo(15, rr * 1.35, rr * 1.18, 0.024, rr * 0.4, 4), M.graphite, 0, 0, -0.02);
      put(g, ringZ(-0.02, 0.03, 0, rr, rr * 0.25), M.black);
      put(g, ringZ(0.028, 0.036, rr * 0.62, rr * 0.88, 0.003), i === 2 ? M.orange : M.gunmetal);
      put(g, cylZ(rr * 0.14, rr * 0.14, 0.1, 12), M.steel, 0, 0, 0.02);
    }
    for (const x of [0.48, 0.24, 0.0]) {
      const p = grp(band, x - 0.12, -0.24, rH(x) * 0.78);
      put(p, cylX(0.02, 0.02, 0.16, 12), M.black);
      put(p, cylX(0.008, 0.008, 0.16, 8), M.steel, 0.12, 0, 0);
    }
    for (const x of [0.06, 0.32]) {
      const a = 53 * D2R;
      const rr = rH(x) * 0.97;
      const g = grp(band, x, Math.cos(a) * rr * SQ_H, Math.sin(a) * rr);
      g.rotation.x = a;
      spinner(g, AY, 1.3);
      put(g, gearGeo(12, 0.04, 0.034, 0.018, 0.01).rotateX(Math.PI / 2), M.graphite);
      put(g, new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12), x > 0.2 ? M.orange : M.gunmetal);
    }
    put(band, tube([[0.6, 0.0, 0.42], [0.3, -0.05, 0.47], [0.0, -0.06, 0.46], [-0.3, -0.02, 0.4]], 0.014, 48, 8), M.black);
    put(band, tube([[0.55, -0.16, 0.38], [0.25, -0.2, 0.42], [-0.05, -0.2, 0.4], [-0.32, -0.12, 0.3]], 0.012, 48, 8), M.graphite);
  }

  // ================================================================ the fine kitbash: about 460 small parts
  // pistons, hoses, boards, screws in slots, gears, wiring and blocks packed in the dark bands of the head (the flank
  // under the side plates, the gap between the rows, the spine channel, round the jaw) and in the abdomen (on the hull
  // under the canopy, in the gaps between the side plates); +y out of the hull, merged per material
  const fine = (parent, n, where) => {
    const kit = grp(parent);
    const bins = new Map();
    const T = new THREE.Matrix4();
    const Rx = new THREE.Matrix4();
    const Ry = new THREE.Matrix4();
    let place = new THREE.Matrix4();
    const add = (geo, mat, local = null) => {
      const g2 = local ? geo.applyMatrix4(local) : geo;
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(g2.applyMatrix4(place));
    };
    const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const types = [
      (s) => {
        add(cylX(0.016 * s, 0.016 * s, 0.07 * s, 12), M.black, at(0, 0.02 * s, 0));
        add(cylX(0.006 * s, 0.006 * s, 0.06 * s, 8), M.steel, at(0.06 * s, 0.02 * s, 0));
        add(rbox(0.018 * s, 0.024 * s, 0.022 * s, 0.004 * s), R() < 0.1 ? M.orange : M.graphite, at(0.095 * s, 0.02 * s, 0));
      },
      (s) => add(tube([[-0.06 * s, 0.005, 0], [-0.02 * s, 0.045 * s, 0.015 * s], [0.03 * s, 0.05 * s, 0.03 * s], [0.07 * s, 0.008, 0.035 * s]], 0.008 * s, 16, 6), R() < 0.8 ? M.black : M.graphite),
      (s) => {
        add(rbox(0.1 * s, 0.008, 0.066 * s, 0.003), M.pcb, at(0, 0.004, 0));
        for (let k = 0; k < 4; k++) add(rbox(0.018 * s, 0.008, 0.016 * s, 0.002), M.black, at((-0.03 + (k % 2) * 0.04) * s, 0.011, (k < 2 ? -0.015 : 0.015) * s));
        for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.005 * s, 0.003, 0.008 * s), M.steel, at((-0.04 + k * 0.016) * s, 0.009, 0.028 * s));
      },
      (s) => {
        add(rbox(0.07 * s, 0.01, 0.024 * s, 0.005), M.black, at(0, 0.005, 0));
        add(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.008, 10), M.steel, at((R() - 0.5) * 0.04 * s, 0.012, 0));
      },
      (s) => {
        add(gearGeo(10 + Math.floor(R() * 6), 0.034 * s, 0.027 * s, 0.012, 0.006).rotateX(Math.PI / 2), M.graphite, at(0, 0.012, 0));
        add(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.02, 10), R() < 0.15 ? M.orange : M.gunmetal, at(0, 0.016, 0));
      },
      (s) => {
        const n2 = 3 + Math.floor(R() * 2);
        for (let k = 0; k < n2; k++) {
          const z = (k - (n2 - 1) / 2) * 0.012 * s;
          add(tube([[-0.08 * s, 0.006, z], [-0.02 * s, 0.022 * s, z * 1.4], [0.04 * s, 0.018 * s, z * 1.2], [0.09 * s, 0.006, z]], 0.0045 * s, 16, 6), k % 3 === 2 ? M.graphite : M.black);
        }
      },
      (s) => {
        add(rbox(0.04 * s, 0.03 * s, 0.034 * s, 0.006 * s), R() < 0.5 ? M.graphite : M.black, at(0, 0.015 * s, 0));
        add(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.01, 6), M.steel, at(0.006 * s, 0.032 * s, 0.004 * s));
      },
    ];
    for (let i = 0; i < n; i++) {
      const [x, y, z, a] = where(i);
      place = T.makeTranslation(x, y, z).clone().multiply(Rx.makeRotationX(a)).multiply(Ry.makeRotationY(R() * Math.PI * 2));
      types[Math.floor(R() * types.length)](0.85 + R() * 0.6);
    }
    for (const [mat, list] of bins) put(kit, merge(list), mat);
    return kit;
  };
  const sgn = () => (R() < 0.5 ? -1 : 1);
  const onShell = (x, a, rr, sq) => [x, Math.cos(a) * rr * sq, Math.sin(a) * rr, a];
  const headKit = fine(head, 270, (i) => {
    const k = i % 6;
    if (k < 3) {
      // the flank under the side plates, where the legs come out
      const x = -0.2 + R() * 0.86;
      return onShell(x, sgn() * (99 + R() * 36) * D2R, rH(x) * (0.9 + R() * 0.06), SQ_H);
    }
    if (k === 3) {
      // the gap between the top and side rows
      const x = -0.16 + R() * 0.8;
      return onShell(x, sgn() * (50 + R() * 6) * D2R, rH(x) * 0.95, SQ_H);
    }
    if (k === 4) {
      // round the jaw, under the face
      const x = 0.36 + R() * 0.36;
      return onShell(x, (180 + (R() - 0.5) * 120) * D2R, rH(x) * (0.8 + R() * 0.1), SQ_H);
    }
    // the spine channel
    const x = -0.16 + R() * 0.74;
    return onShell(x, (R() - 0.5) * 14 * D2R, rH(x) * 0.92, SQ_H);
  });
  ex(headKit, [0, -0.2, 0], 0.04, 0.6, 1.0, null, [0, -0.1, 0]);
  const abdKit = fine(abd, 150, (i) => {
    if (i % 4 < 3) {
      // on the hull under the canopy
      const u = G0 + 0.02 + R() * (G1 - G0 - 0.04);
      const x = xA(u);
      return onShell(x, (R() - 0.5) * 140 * D2R, rA(x) * (0.84 + R() * 0.03), SQ_A);
    }
    // the gaps between the side plates and the band under them
    const u = G0 + R() * (G1 - G0);
    const x = xA(u);
    return onShell(x, sgn() * (R() < 0.5 ? 126 + R() * 10 : 76 + R() * 4) * D2R, rA(x) * 0.95, SQ_A);
  });
  ex(abdKit, [-0.2, 0.3, 0], 0.06, 0.6, 1.0, null, [-0.1, 0.1, 0]);

  // ================================================================ legs
  const legs = [];
  for (const [si, side] of sides.entries()) {
    LEGS.forEach((L, li) => {
      const leg = buildLeg(L, M, S, li, clear, si);
      leg.mount.position.set(...L.m);
      side.add(leg.mount);
      legs.push({side: si, idx: li, name: LEG_NAMES[si * 4 + li], L, ...leg});
      if (si === 1 && li === 0) {
        anchor('hipR1', leg.coxa, 0.0, 0.06, 0);
        anchor('femR1', leg.fem, 0.4, 0.08, 0.0);
        anchor('kneeR1', leg.tib, 0.0, 0.0, 0.08);
        anchor('pistonR1', leg.pis, L.Lt * 0.62, 0.0, 0.06);
        anchor('footR1', leg.foot, 0.0, 0.0, 0.05);
      }
    });
  }
  S.flush();

  // ================================================================ floating debris (only out during the explode)
  const debris = grp(root);
  const D = [];
  const addDebris = (obj, c, spread, d0, d1) => {
    const dir = new V3(R() * 2 - 1, R() * 1.6 - 0.3, R() * 2 - 1);
    dir.x *= 1.5;
    dir.normalize();
    const dist = d0 + (d1 - d0) * R();
    obj.position.set(c[0] + dir.x * spread, c[1] + dir.y * spread, c[2] + dir.z * spread);
    obj.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28);
    debris.add(obj);
    D.push({obj, home: obj.position.clone(), q0: obj.quaternion.clone(), dir, dist, spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: 1 + R() * 2.5, s: R() * 0.15});
  };
  const centres = [
    [0.4, 0.0, 0],
    [-1.0, 0.3, 0],
    [0.0, 0.5, 0],
  ];
  const pick = () => centres[Math.floor(R() * centres.length)];
  for (let k = 0; k < 34; k++) {
    const g = new THREE.Group();
    const r = 0.016 + R() * 0.03;
    put(g, new THREE.SphereGeometry(r, 20, 14), M.black);
    if (k % 9 === 0) put(g, new THREE.TorusGeometry(r * 1.02, r * 0.22, 8, 24), M.orange);
    addDebris(g, pick(), 0.25, 1.4, 3.6);
  }
  for (let k = 0; k < 12; k++) {
    const g = new THREE.Group();
    if (k % 3 === 0) {
      put(g, cylX(0.028, 0.028, 0.09, 20), M.orange);
      put(g, cylX(0.03, 0.03, 0.028, 20), M.black, -0.055, 0, 0);
    } else {
      put(g, cylX(0.013, 0.013, 0.08, 12), M.steel, 0.04, 0, 0);
      put(g, cylX(0.026, 0.026, 0.024, 6), M.black);
    }
    addDebris(g, pick(), 0.2, 1.2, 3.2);
  }
  for (let k = 0; k < 6; k++) {
    const g = new THREE.Group();
    put(g, facet(rbox(0.1 + R() * 0.06, 0.06 + R() * 0.04, 0.08 + R() * 0.05, 0.01)), M.orange);
    put(g, rbox(0.03, 0.03, 0.06, 0.008), M.black, 0.06, 0.03, 0);
    addDebris(g, pick(), 0.2, 1.4, 3.0);
  }
  for (let k = 0; k < 6; k++) {
    const g = new THREE.Group();
    put(g, armour(0, 0.16 + R() * 0.08, 0.2, 0.025, 0, 50 + R() * 40, 3, 0.01), M.shell);
    addDebris(g, pick(), 0.3, 1.0, 2.6);
  }
  for (let k = 0; k < 10; k++) {
    const g = new THREE.Group();
    if (k % 2) put(g, gearGeo(12, 0.05, 0.042, 0.016, 0.012), M.graphite);
    else put(g, ringZ(-0.006, 0.006, 0.02, 0.04, 0.003), k % 4 === 0 ? M.orange : M.steel);
    addDebris(g, pick(), 0.25, 1.0, 3.0);
  }

  // ================================================================ pose
  // state: {explode 0..1 (the full teardown), spinT (the busy clock the gears turn on), t (idle twitches), sub: one
  // sub-assembly's own teardown 0..1 — eyes (the main lenses unscrew, the side lenses swivel), head (the plates lift,
  // the face slides out, the chelicerae and palps articulate), abdomen (the canopy opens, the gears slide out
  // spinning), leg (R1, the near front leg, apart segment by segment, its piston out of the glass); feet: eight body-local wheel spots
  // (left 0-3, right 4-7) the legs reach for by IK, tuck 0..1 (the legs pulled in for the jump's flight), reach (the
  // full explode's travel), palp: how far the palps are raised (0 hanging, 1 up in front of the face)}
  const q = new THREE.Quaternion();
  const fv = [0, 0, 0];
  const pose = ({explode = 0, spinT = 0, spinA = spinT, t = 0, sub = {}, feet = null, tuck = 0, reach = 1, palp = 0.4} = {}) => {
    const e = clamp(explode, 0, 1);
    const kFar = ssw(e, 0.45, 1.0);
    const sE = sub.eyes || 0;
    const sH = sub.head || 0;
    const sA = sub.abdomen || 0;
    for (const it of X) {
      const k = ssw(e, it.s, it.f);
      it.obj.position.copy(it.home).addScaledVector(it.dir, it.dist * k).addScaledVector(it.far, kFar * reach);
      if (it.spin) it.obj.quaternion.copy(it.q0).multiply(q.setFromAxisAngle(it.spin.axis, it.spin.ang * k));
    }
    // gears turn on their clocks (the tour integrates spinA faster while the abdomen is open)
    for (const s of spinners) s.obj.quaternion.copy(s.q0).multiply(q.setFromAxisAngle(s.axis, s.rate * (s.clock === 'A' ? spinA : spinT) * Math.PI * 2 * 0.25));
    // the eye teardown: every ring of the main lenses out along its axis, unscrewing, the iris blades swinging open,
    // the glass leading; the side lenses swivel in their pods
    {
      const ke = Math.max(ssw(sE, 0.0, 0.75), 0.6 * ssw(e, 0.2, 0.8));
      eyeRigs.forEach((rig, ri) => {
        const kk = ri === 1 ? ke : ke * 0.8;
        for (const p of rig) {
          p.o.position.copy(p.home);
          p.o.quaternion.copy(p.q0);
          p.o.position.x += p.off * 0.75 * kk;
          if (p.blade) {
            p.o.position.y *= 1 + 0.6 * kk;
            p.o.position.z *= 1 + 0.6 * kk;
            p.o.quaternion.multiply(q.setFromAxisAngle(AX, 1.1 * kk + 0.25 * kk * Math.sin(spinT * 2)));
          } else if (p.spin) p.o.quaternion.multiply(q.setFromAxisAngle(AX, p.spin * kk * (1 + 0.35 * spinT)));
        }
      });
      const ks = ssw(sE, 0.25, 0.85);
      for (const p of pods) p.sw.rotation.set(0, (p.k % 2 ? 0.7 : -0.6) * ks * Math.sin(spinT * 1.6 + p.k), (p.k % 3 ? 0.4 : -0.5) * ks);
    }
    // the head teardown: the top rows lift and splay, the spine channel rises, the visor tips up and forward, the face
    // slides out on its rails, the jaw drops a little
    {
      const k1 = ssw(sH, 0.0, 0.5);
      const k2 = ssw(sH, 0.15, 0.65);
      topG.forEach((g) => {
        g.position.y += 0.16 * k1;
        g.position.z += 0.1 * k1;
        g.rotation.set(-0.35 * k1, 0, 0);
      });
      sideG.forEach((g) => {
        g.position.y -= 0.02 * k2;
        g.position.z += 0.12 * k2;
      });
      channel.position.y += 0.1 * k1;
      visor.position.x += 0.08 * k2;
      visor.position.y += 0.16 * k2;
      visor.rotation.z = 0.35 * k2 + 0.4 * ssw(e, 0.1, 0.75);
      face.position.x += 0.2 * ssw(sH, 0.25, 0.75);
      for (const m of mainEyes) m.position.x += 0.2 * ssw(sH, 0.25, 0.75);
      for (const p of pods) p.p.position.x += 0.2 * ssw(sH, 0.25, 0.75);
      jaw.position.y -= 0.05 * k2;
    }
    // the chelicerae flex on their hinges; the palps twitch, raised by `palp` and by the head teardown
    const kc = ssw(sH, 0.3, 0.8);
    // the chelicerae swing out and forward, the fangs flare open on their pivots (one flutter each), and both snap
    // shut as the act closes
    chel.forEach((c, i) => {
      c.arm.rotation.z = 0.08 * Math.sin(t * 3.1 + i * 1.7) + 0.32 * kc;
      c.arm.rotation.x = -0.36 * kc;
      c.fg.rotation.z = 0.62 * kc * (0.82 + 0.18 * Math.sin(spinT * 3 + i * Math.PI));
      c.fg.rotation.x = -0.3 * kc;
    });
    palps.forEach((segs, i) => {
      const up = clamp(palp + 0.6 * kc, 0, 1.4);
      const tw = Math.sin(t * 2.3 + i * 2.2) * 0.12 + Math.sin(t * 5.1 + i) * 0.05;
      segs[0].j.rotation.set(0, 0, -1.0 + 0.9 * up + tw);
      segs[1].j.rotation.set(0, 0, -1.1 + 0.3 * up - tw * 0.7);
      segs[2].j.rotation.set(0, 0, -0.5 - 0.4 * up + tw * 0.5);
      segs[0].j.rotation.y = (i ? 1 : -1) * 0.12 * kc;
    });
    // the abdomen teardown: the canopy swings open on its front hinge, the side plates slide out, the drum rises and
    // its gears slide apart along it while the side trains swing out, everything spinning fast
    {
      const k1 = ssw(sA, 0.0, 0.45);
      const k2 = ssw(sA, 0.2, 0.75);
      canopy.rotation.z = -1.15 * k1 - 0.5 * ssw(e, 0.0, 0.6);
      canopy.position.y += 0.08 * k1;
      // band by band: the top band swings open first, then the upper side bands, then the lower ones; the glowing
      // coils rise out of the cage after them
      aSide.forEach((b) => {
        const kb = ssw(sA, b.w[0], b.w[1]);
        b.g.position.y += b.dy * kb;
        b.g.position.z += b.dz * kb;
      });
      const k3 = ssw(sA, 0.32, 0.85);
      core.position.y += 0.34 * k3;
      core.position.x -= 0.05 * k3;
      for (const cg of coreGears) cg.g.position.copy(cg.home).addScaledVector(cg.dir, cg.d * k3);
    }
    for (const d of D) {
      const k = Math.pow(ssw(e, d.s, 0.95), 0.75);
      d.obj.position.copy(d.home).addScaledVector(d.dir, d.dist * k * reach);
      d.obj.quaternion.copy(d.q0).multiply(q.setFromAxisAngle(d.spin, d.ang * k + 0.9 * spinT * kFar));
      const s = ssw(e, d.s * 0.5, d.s * 0.5 + 0.08);
      d.obj.scale.setScalar(Math.max(1e-4, s));
      d.obj.visible = s > 0.001;
    }
    // the legs: IK to the feet (or the homes), blended toward the tucked spots by `tuck`
    for (const L of legs) {
      const i = L.side * 4 + L.idx;
      const f = feet ? feet[i] : legHome(i);
      const tk = legTuck(i);
      for (let k = 0; k < 3; k++) fv[k] = lerp(f[k], tk[k], tuck);
      const a = legIK(L.L, [fv[0], fv[1], L.side === 0 ? -fv[2] : fv[2]]);
      L.pose(a, e, spinT, L.side === 1 && L.idx === 0 ? sub.leg || 0 : 0, kFar * reach);
    }
  };
  pose({});

  root.traverse((o) => {
    if (o.isMesh && o.material && (o.material.transparent || o.material.transmission > 0)) {
      o.castShadow = false;
      if (!clear.includes(o)) clear.push(o);
    }
  });
  return {root, pose, clear, M, anchors, legs};
}

// ---------------------------------------------------------------- a leg
// Built for the right side: the mount on the flank; yaw turns the leg's plane about y (local +x along the leg), then
// the femur, tibia and tarsus pitch about z. White armour shells over black links, black servo wheels at every joint
// with an orange ring on the outer face; the tibia's lower half a glass tube over a piston and a spring; a rubber wheel
// for a foot. The accents differ leg to leg (a strip down the femur, a tab, an orange collar) so the eight never read
// as a row of copies.
function buildLeg(L, M, S, li, clear, si = 0) {
  const {grp, bolt, seam, tab, wheelZ} = S;
  const R = rng(31 + li * 7 + si * 3);
  const mount = new THREE.Group();
  const yawG = grp(mount);
  const coxa = grp(yawG);
  put(coxa, facet(new THREE.CylinderGeometry(0.088, 0.094, 0.16, 8)), M.black);
  put(coxa, ringY(0.062, 0.076, 0.06, 0.094, 0.004), M.orange);
  put(coxa, ringY(0.074, 0.09, 0, 0.046, 0.006), M.graphite);
  put(coxa, facet(rbox(L.Lc + 0.06, 0.1, 0.11, 0.008)), M.graphite, L.Lc / 2, 0, 0);
  put(coxa, armour(0.0, L.Lc + 0.02, 0.072, 0.022, -70, 70, 3, 0.008), M.shell, 0, -0.004, 0);
  // femur: a black link in two white shells with a black band between them, a raised top plate with bolts, a
  // hydraulic cylinder and rod underneath, a dark actuator block on each face
  const F = L.Lf;
  const fem = grp(yawG, L.Lc, 0, 0);
  const femW = wheelZ(fem, 0.09, 0.2, false, li % 2 ? 0 : 16);
  const femBody = grp(fem);
  // the femur's white plates, their rivets and bristles ride in one group that lifts off in the leg teardown
  const femPl = grp(femBody);
  put(femBody, cylX(0.04, 0.034, F, 12), M.black, F / 2, 0, 0);
  put(femPl, armour(0.1, F * 0.56, 0.112, 0.032, -34, 124, 5, 0.018), M.shell);
  put(femPl, armour(0.1, F * 0.56, 0.112, 0.032, -124, -102, 1, 0.012), M.shell);
  // the window in the front shell (the -z face, forward on a sideways leg): a graphite floor, a piston, small gears
  put(femBody, armour(0.12, F * 0.54, 0.08, 0.02, -104, -32, 3, 0.006), M.graphite);
  put(femPl, armour(0.11, F * 0.55, 0.112, 0.03, -99, -37, 3, 0.014), M.shell);
  {
    const a = -68 * D2R;
    const at = (x, rr) => new THREE.Matrix4().makeTranslation(x, Math.cos(a) * rr, Math.sin(a) * rr).multiply(new THREE.Matrix4().makeRotationX(a));
    put(femBody, cylX(0.018, 0.018, F * 0.22, 10), M.black, F * 0.24, Math.cos(a) * 0.094, Math.sin(a) * 0.094);
    put(femBody, cylX(0.007, 0.007, F * 0.2, 8), M.steel, F * 0.42, Math.cos(a) * 0.094, Math.sin(a) * 0.094);
    for (const [k, x] of [0.17, 0.3, 0.44].entries()) {
      S.decal(femBody, gearGeo(10, 0.03, 0.024, 0.012, 0.006).rotateX(Math.PI / 2), M.gunmetal, at(F * x, 0.086 - 0.004 * k).multiply(new THREE.Matrix4().makeTranslation(0, 0, k % 2 ? 0.03 : -0.03)));
      S.decal(femBody, new THREE.CylinderGeometry(0.01, 0.01, 0.024, 10), k === 1 && li % 2 === 0 ? M.orange : M.black, at(F * x, 0.09).multiply(new THREE.Matrix4().makeTranslation(0, 0, k % 2 ? 0.03 : -0.03)));
    }
    S.decal(femBody, rbox(0.06, 0.02, 0.028, 0.005), M.black, at(F * 0.12, 0.088));
  }
  put(femPl, armour(F * 0.6, F - 0.09, 0.1, 0.03, -124, 124, 6, 0.016), M.shell);
  put(femBody, ring(F * 0.545, F * 0.615, 0.06, 0.104, 0.004), M.black);
  put(femPl, armour(0.15, F * 0.52, 0.126, 0.03, -40, 40, 2, 0.014, 0.01), M.shell);
  for (const x of [0.18, F * 0.48]) for (const a of [-30, 30]) bolt(femPl, x, a * D2R, 0.128);
  for (const x of [F * 0.66, F - 0.13]) for (const a of [-62, 62]) bolt(femPl, x, a * D2R, 0.102);
  for (const s of [-1, 1]) seam(femPl, F * 0.63, F - 0.12, s * 92 * D2R, 0.1);
  if (li === 0 || li === 2) for (const s of [-1, 1]) put(femPl, armour(0.2, F * 0.47, 0.116, 0.02, s > 0 ? 70 : -96, s > 0 ? 96 : -70, 2, 0.004), M.black);
  else for (const s of [-1, 1]) tab(femPl, F * 0.78, s * 84 * D2R, 0.102, 0.036, 0.1, M.black, 0.012);
  put(femBody, cylX(0.027, 0.027, F * 0.46, 12), M.black, F * 0.33, -0.104, 0);
  put(femBody, ring(F * 0.52, F * 0.555, 0.027, 0.034, 0.003), M.gunmetal, 0, -0.104, 0);
  put(femBody, cylX(0.011, 0.011, F * 0.36, 8), M.steel, F * 0.7, -0.104, 0);
  for (const f of [0.1, 0.9]) put(femBody, rbox(0.04, 0.03, 0.04, 0.008), M.graphite, F * f, -0.098, 0);
  // a hose down the front face, a row of small dark blocks with screws along the back
  put(femBody, tube([[0.06, -0.05, -0.1], [F * 0.3, -0.085, -0.124], [F * 0.7, -0.085, -0.12], [F - 0.05, -0.05, -0.1]], 0.009, 24, 6), li % 2 ? M.graphite : M.black);
  for (let k = 0; k < 4; k++) S.decal(femBody, rbox(0.05, 0.026, 0.02, 0.005), k % 2 ? M.graphite : M.black, new THREE.Matrix4().makeTranslation(F * (0.2 + k * 0.1), -0.07, 0.112));
  for (const s of [-1, 1]) {
    put(femBody, facet(rbox(F * 0.2, 0.05, 0.026, 0.006)), M.black, F * 0.8, -0.02, s * 0.1);
    put(femBody, cylZ(0.016, 0.016, 0.02, 10), M.gunmetal, F * 0.72, -0.02, s * 0.115);
  }
  // tibia: a white upper shell with a top plate, then the glass segment between two collars: a clear tube over a
  // black cylinder with an orange or steel ring, its steel rod and a spring
  const T = L.Lt;
  const tib = grp(fem, F, 0, 0);
  const kneeW = wheelZ(tib, 0.084, 0.19, false, li % 2 ? 14 : 0);
  const tibBody = grp(tib);
  const tibPl = grp(tibBody);
  put(tibBody, cylX(0.032, 0.026, T * 0.5, 10), M.black, T * 0.25, 0, 0);
  put(tibPl, armour(0.09, T * 0.42, 0.094, 0.028, -30, 122, 5, 0.016), M.shell);
  put(tibPl, armour(0.09, T * 0.42, 0.094, 0.028, -122, -100, 1, 0.01), M.shell);
  put(tibBody, armour(0.11, T * 0.4, 0.066, 0.016, -102, -28, 3, 0.006), M.graphite);
  {
    const a = -66 * D2R;
    put(tibBody, cylX(0.014, 0.014, T * 0.18, 10), M.black, T * 0.2, Math.cos(a) * 0.078, Math.sin(a) * 0.078);
    put(tibBody, cylX(0.006, 0.006, T * 0.14, 8), M.steel, T * 0.33, Math.cos(a) * 0.078, Math.sin(a) * 0.078);
    S.decal(tibBody, gearGeo(9, 0.024, 0.019, 0.01, 0.005).rotateX(Math.PI / 2), M.gunmetal, new THREE.Matrix4().makeTranslation(T * 0.34, Math.cos(a - 0.4) * 0.07, Math.sin(a - 0.4) * 0.07).multiply(new THREE.Matrix4().makeRotationX(a - 0.4)));
  }
  put(tibPl, armour(0.13, T * 0.38, 0.106, 0.026, -36, 36, 2, 0.012, 0.008), M.shell);
  for (const x of [0.16, T * 0.36]) for (const a of [-24, 24]) bolt(tibPl, x, a * D2R, 0.108);
  for (const s of [-1, 1]) seam(tibPl, 0.14, T * 0.38, s * 70 * D2R, 0.094);
  if (li === 1 || li === 3) for (const s of [-1, 1]) tab(tibPl, T * 0.26, s * 92 * D2R, 0.094, 0.034, 0.12, M.black, 0.012);
  put(tibBody, cylX(0.014, 0.014, T * 0.3, 8), M.black, T * 0.24, -0.104, 0);
  put(tibBody, ring(T * 0.42, T * 0.49, 0.05, 0.08, 0.006), M.black);
  put(tibPl, armour(T * 0.49, T * 0.645, 0.094, 0.026, -150, 150, 8, 0.014), M.shell);
  put(tibPl, armour(T * 0.67, T * 0.83, 0.09, 0.026, -150, 150, 8, 0.014), M.shell);
  for (const x of [T * 0.51, T * 0.625, T * 0.69, T * 0.81]) for (const a of [-60, 0, 60]) bolt(tibPl, x, a * D2R, 0.095);
  const pis = grp(tibBody);
  put(pis, cylX(0.04, 0.04, T * 0.2, 16), M.black, T * 0.58, 0, 0);
  put(pis, ring(T * 0.62, T * 0.645, 0.039, 0.047, 0.002), li === 0 || li === 3 ? M.orange : M.gunmetal);
  put(pis, ring(T * 0.49, T * 0.5, 0.036, 0.046, 0.002), M.steel);
  put(pis, cylX(0.015, 0.015, T * 0.22, 10), M.steel, T * 0.76, 0, 0);
  put(pis, coil(0.028, 0.0035, 6 + li, T * 0.15, 200), M.graphite, T * 0.685, 0, 0);
  for (const s of [-1, 1]) put(pis, tube([[T * 0.5, 0.02, s * 0.024], [T * 0.6, 0.036, s * 0.044], [T * 0.72, 0.028, s * 0.03]], 0.004, 16, 6), M.black);
  put(tibPl, ring(T * 0.835, T * 0.9, 0.05, 0.084, 0.006), M.shell);
  put(tibBody, ring(T * 0.86, T * 0.875, 0.083, 0.088, 0.002), M.black);
  put(tibBody, cylX(0.026, 0.024, T * 0.12, 10), M.black, T * 0.94, 0, 0);
  // tarsus: a black faceted link, a short white shell with an orange plate (or an orange collar), and the foot: a
  // rubber wheel with treads on a fork, an orange hub on each face, a steel axle across the leg's plane
  const Rr = L.Lr;
  const tar = grp(tib, T, 0, 0);
  const ankleW = wheelZ(tar, 0.062, 0.14, false);
  const tarBody = grp(tar);
  const tarPl = grp(tarBody);
  put(tarBody, facet(taperTube([[0.02, 0, 0], [Rr * 0.5, -0.004, 0], [Rr - 0.03, 0, 0]], 0.036, 0.024, 12, 6)), M.black);
  put(tarPl, armour(0.07, Rr * 0.7, 0.066, 0.022, -128, 128, 6, 0.012), M.shell);
  if (li % 2 === 0) for (const s of [-1, 1]) tab(tarPl, Rr * 0.42, s * 90 * D2R, 0.066, 0.04, Rr * 0.4, M.black, 0.012);
  put(tarBody, ring(Rr * 0.7, Rr * 0.76, 0.03, 0.064, 0.004), M.black);
  put(tarPl, armour(Rr * 0.76, Rr - 0.03, 0.06, 0.02, -140, 140, 6, 0.01), M.shell);
  for (const x of [0.1, Rr * 0.6]) bolt(tarPl, x, 0, 0.068);
  // the tarantula's foot: a white tapered tip sleeve, a black collar and a glowing orange claw, down along the tarsus
  const foot = grp(tar, Rr, 0, 0);
  put(foot, taperTube([[-0.03, 0, 0], [0.0, 0, 0], [0.04, 0, 0]], 0.09, 0.048, 12, 16), M.shell);
  put(foot, ring(0.034, 0.05, 0.026, 0.048, 0.003), M.black);
  put(foot, taperTube([[0.044, 0, 0], [0.062, 0, 0], [0.082, 0, 0]], 0.034, 0.003, 12, 12), M.glowO);
  // the glowing joint rings round the leg: at both ends of the femur, the tibia's head and its glass, the tarsus' head
  // (each ring carries six black notches, so its spin in the teardown reads)
  const rings = [];
  const gring = (parent, x0, x1, r0, r1, seg) => {
    const g = grp(parent);
    put(g, ring(x0, x1, r0, r1, 0.004), M.glowO);
    for (let k = 0; k < 6; k++) S.decal(g, rbox(x1 - x0 + 0.004, 0.012, 0.016, 0.003), M.black, new THREE.Matrix4().makeRotationX((k / 6) * Math.PI * 2).multiply(new THREE.Matrix4().makeTranslation((x0 + x1) / 2, r1 - 0.003, 0)));
    rings.push({g, seg, dir: seg % 2 ? -1 : 1});
  };
  gring(femBody, 0.07, 0.106, 0.07, 0.122, 0);
  gring(femBody, F - 0.1, F - 0.068, 0.07, 0.114, 1);
  gring(tibBody, 0.062, 0.096, 0.062, 0.106, 1);
  gring(tibBody, T * 0.44, T * 0.47, 0.06, 0.092, 2);
  gring(tibBody, T * 0.9, T * 0.93, 0.04, 0.08, 3);
  gring(tarBody, 0.044, 0.072, 0.04, 0.08, 3);
  // the bristles: thin black spikes all along every segment, leaning toward the tip
  S.bristles(coxa, 0.0, L.Lc + 0.02, 0.09, 20, 0.17, R, [0.3, 0.8], 0.006);
  S.bristles(femPl, 0.12, F - 0.1, 0.118, 52, 0.2, R, [0.45, 0.9], 0.0062);
  S.bristles(tibPl, 0.1, T * 0.42, 0.1, 30, 0.19, R, [0.45, 0.9], 0.0062);
  S.bristles(tibPl, T * 0.5, T * 0.82, 0.096, 26, 0.18, R, [0.45, 0.9], 0.006);
  S.bristles(tarPl, 0.08, Rr - 0.03, 0.07, 36, 0.16, R, [0.45, 0.9], 0.0055);
  // the orange on every joint wheel and the coxa glows
  for (const o of [coxa, femW, kneeW, ankleW]) o.traverse((m) => m.isMesh && m.material === M.orange && (m.material = M.glowO));
  for (const b of [femBody, tibBody, tarBody]) b.scale.set(1, 1.6, 1.6);
  for (const w of [femW, kneeW, ankleW]) w.scale.setScalar(1.3);
  coxa.scale.setScalar(1.34);
  const gap = 0.16;
  return {
    mount,
    coxa,
    fem,
    tib,
    tar,
    pis,
    foot,
    // a: the IK angles; e: the full explode (gaps at every joint, the mount out from the flank); k2: this leg alone
    // apart, femur shell, shin, the piston out of its glass, tarsus and the wheel in turn, every servo wheel spinning
    pose(a, e, spinT, k2, far) {
      const k = ssw(e, 0.4, 1.0);
      yawG.rotation.y = -a.yaw;
      fem.rotation.z = a.fem;
      tib.rotation.z = a.tib;
      tar.rotation.z = a.tar;
      const b1 = ssw(k2, 0.0, 0.35);
      const b2 = ssw(k2, 0.12, 0.5);
      const b3 = ssw(k2, 0.26, 0.66);
      const b4 = ssw(k2, 0.38, 0.8);
      const b5 = ssw(k2, 0.5, 1.0);
      mount.position.set(L.m[0], L.m[1] - 0.05 * b1 - 0.1 * k * far, L.m[2] + 0.3 * b1 + 0.55 * k * far + 0.15 * k);
      fem.position.x = L.Lc + gap * 0.6 * k + 0.14 * b1;
      femBody.position.set(0.0, 0.18 * b2, 0.06 * b2);
      tib.position.x = F + gap * k + 0.24 * b2;
      tibBody.position.set(0, -0.12 * b3, 0.05 * b3);
      pis.position.x = 0.3 * b4 + 0.1 * k;
      tar.position.x = T + gap * k + 0.22 * b3 + 0.12 * b4;
      tarBody.position.x = 0.14 * b5;
      // plate by plate: the femur's plates lift off, then the tibia's, then the tarsus'; the glowing rings spin
      femPl.position.set(0, 0.1 * ssw(k2, 0.18, 0.55), 0.03 * ssw(k2, 0.18, 0.55));
      tibPl.position.set(0, 0.09 * ssw(k2, 0.32, 0.7), 0.03 * ssw(k2, 0.32, 0.7));
      tarPl.position.set(0, 0.07 * ssw(k2, 0.46, 0.88), 0.02 * ssw(k2, 0.46, 0.88));
      foot.position.x = Rr + 0.28 * b5 + 0.08 * k;
      const sp = 7 * spinT;
      femW.rotation.z = sp * b1 + 1.5 * sp * k;
      kneeW.rotation.z = -1.3 * sp * b2 - 1.2 * sp * k;
      ankleW.rotation.z = 1.6 * sp * b3 + sp * k;
      coxa.rotation.y = 0.9 * sp * b1;
      foot.rotation.x = -2 * sp * b5 - 1.4 * sp * k;
      const bs = [b1, b2, b3, b5];
      for (const r of rings) r.g.rotation.x = r.dir * (1.4 * sp * bs[r.seg] + 0.8 * sp * k);
    },
  };
}
