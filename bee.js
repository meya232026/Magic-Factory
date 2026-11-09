// The robotic wasp: the approved robotic bee (../robobee-shared/bee.js) with only the body changed. Kept as the bee has
// them: the materials, the thorax and its kitbash, the neck collar, the four-wing set (forewings narrowed toward the
// wasp's), the lens eyes, the debris and the pose. New: a triangular head (the skull bent into a chin under a riveted
// face plate, the lens eyes a third larger with a thicker orange lip, open serrated mandibles), two long segmented
// antennae, a thin waist of dark beads and orange-lit rings, a long banded abdomen with orange light in its gaps and a
// glass sting, and longer legs that hang in flight with black spikes on the shins and orange claws.
// Body frame: +x forward (head), y up, +z the bee's right. The right side is built once and mirrored (scale.z = -1).
// pose({explode, flap, flapAmp, display, t}): explode 0..1 is staged per part (s..f windows); the wings blend from
// their flight pose (spread level, beating) to the display pose (display = 1: spread face-on to the hero camera).
import * as THREE from 'three';
import {rng} from '../kit/util.js';
import {aimX, capsuleR, cylX, cylZ, D2R, dome, gearGeo, gearX, instances, makeMaterials, merge, put, rbox, ring, solid, sweepX, tube, V3} from './parts.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ssw = (e, s, f) => smoother((e - s) / (f - s));

// a tapered thick ring along x: outer radius ra at x0 to rb at x1, wall t, corners chamfered by ch; an arc a0..a1
// (0 at +y, 90° at +z) when given
function taper(x0, x1, ra, rb, t, ch = 0.008, a0 = 0, a1 = Math.PI * 2) {
  const sx = Math.sign(x1 - x0) || 1;
  return sweepX(
    [
      [x0 + sx * ch, ra],
      [x1 - sx * ch, rb],
      [x1, rb - ch],
      [x1, rb - t + ch],
      [x1 - sx * ch, rb - t],
      [x0 + sx * ch, ra - t],
      [x0, ra - t + ch],
      [x0, ra - ch],
    ],
    {a0, a1, segs: a1 - a0 < 6 ? 40 : 72},
  );
}
// a ring around +z (joint wheels, washers), z0..z1
const ringZ = (z0, z1, r0, r1, round) => ring(z0, z1, r0, r1, round).rotateY(-Math.PI / 2);
// a quaternion turning a wing's frame (span +x, leading edge +y, normal +z) to span s, its face toward f, its
// leading edge on the side of lead
function wingQuat(s, f, lead) {
  const S = new V3(...s).normalize();
  const F = new V3(...f);
  const n0 = F.addScaledVector(S, -F.dot(S)).normalize();
  const c = new V3().crossVectors(n0, S);
  if (c.dot(new V3(...lead)) < 0) c.negate();
  const n = new V3().crossVectors(S, c);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(S, c, n));
}
// the hero camera's direction from the bee (az 36°, el 9°), in the right side's frame and the mirrored one
export const CAM_DIR = [0.58, 0.156, 0.8];
const CAM_L = [0.58, 0.156, -0.8];

// bake (the live page): static meshes merged per material, see below; the films build the bee as it is
// lightFan (the live page): the wing-blur copies without their veins (dense geometry at under 3% opacity)
export function buildBee({seed = 11, bake = false, lightFan = false} = {}) {
  const M = makeMaterials();
  const R = rng(seed);
  const root = new THREE.Group();
  // explode items: each part's home, direction and distance, and the window of explode it moves in. Past 0.45 every
  // part also travels its `far` offset (the teardown layer, by default its own direction a good deal further), so the
  // partial explode of the reference stays exactly where it was. `rate` turns a part about `raxis` all the time.
  const X = [];
  let TAG = '';
  const ex = (obj, dir, dist, s = 0, f = 1, spin = null, far = null, rate = 0, raxis = null) => {
    const d = new V3(...dir).normalize();
    X.push({obj, home: obj.position.clone(), q0: obj.quaternion.clone(), dir: d, dist, s, f, spin, far: far ? new V3(...far) : d.clone().multiplyScalar(dist * 1.8 + 0.25), rate, raxis, group: TAG});
    return obj;
  };
  // clear meshes: kept out of the AO pass and the floor shadow
  const clear = [];
  // anchors for the console's labels: {obj, at} = a point in an object's frame, so a label follows its part through
  // the explode; the near side (+z) only
  const anchors = {};
  const anchor = (key, obj, x, y, z) => {
    if (!anchors[key]) anchors[key] = {obj, at: new V3(x, y, z)};
  };
  const grp = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  // the right side is built once; the left is the same group mirrored
  const mirror = (parent) =>
    [1, -1].map((s) => {
      const g = new THREE.Group();
      g.scale.z = s;
      parent.add(g);
      return g;
    });
  const sides = mirror(root);
  const AX = new V3(1, 0, 0);
  const AY = new V3(0, 1, 0);
  const AZ = new V3(0, 0, 1);

  // ================================================================ head
  TAG = 'head';
  let eyeRig = null;
  const H = new V3(1.0, 0.12, 0);
  const RH = 0.38;
  // the wasp's own parts draw from a second stream, so the bee's kitbash and debris land exactly where they did
  const R2 = rng(seed + 66);
  const head = grp(root, H.x, H.y, H.z);
  ex(head, [1, 0.08, 0], 0.5, 0.35, 1.0, null, [1.35, 0.18, 0]);
  const headSides = mirror(head);
  // the skull: the bee's two caps over a black core, drawn narrower front to back and taller, and bent into the
  // wasp's triangle: below the eyes the shell pinches toward the middle and runs forward and down into a chin, so the
  // face narrows to the jaw
  const SK = new V3(0.88, 1.06, 1.06);
  const deform = (p) => {
    const t = Math.pow(Math.min(1, Math.max(0, -p.y / RH)), 1.4);
    p.z *= 1 - 0.52 * t;
    p.x += 0.19 * t;
    p.y -= 0.12 * t;
    return p;
  };
  // the deformed geometry keeps its creases: each normal goes through the inverse transpose of the bend's Jacobian
  const deformGeo = (g) => {
    const pa = g.attributes.position;
    const na = g.attributes.normal;
    const p = new V3();
    const n = new V3();
    const c = [new V3(), new V3(), new V3()];
    const J = new THREE.Matrix3();
    const h = 1e-4;
    for (let i = 0; i < pa.count; i++) {
      p.fromBufferAttribute(pa, i);
      const f0 = deform(p.clone());
      for (let k = 0; k < 3; k++) {
        const q = p.clone();
        q.setComponent(k, q.getComponent(k) + h);
        c[k].copy(deform(q)).sub(f0).divideScalar(h);
      }
      J.set(c[0].x, c[1].x, c[2].x, c[0].y, c[1].y, c[2].y, c[0].z, c[1].z, c[2].z).invert().transpose();
      n.fromBufferAttribute(na, i).applyMatrix3(J).normalize();
      pa.setXYZ(i, f0.x, f0.y, f0.z);
      na.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  };
  const onSkull = (d, lift = 0) => {
    const p = deform(new V3(...d).normalize().multiplyScalar(RH + lift));
    return new V3(p.x * SK.x, p.y * SK.y, p.z * SK.z);
  };
  const skull = grp(head);
  skull.scale.copy(SK);
  const skullSides = mirror(skull);
  put(skull, deformGeo(new THREE.SphereGeometry(RH - 0.022, 64, 48)), M.black);
  put(skull, deformGeo(dome(RH, 0.03, 0, 1.38, {segs: 96})), M.shell);
  put(skull, deformGeo(dome(RH, 0.03, 1.46, 2.5, {segs: 96})), M.shell);
  put(skull, ring(-0.36, -0.28, 0.16, 0.235, 0.012), M.graphite);
  // under the chin: a black mouth block and a graphite lip between the mandible roots
  const CHIN = onSkull([0.42, -0.9, 0]);
  put(head, rbox(0.12, 0.06, 0.16, 0.02), M.black, CHIN.x - 0.02, CHIN.y - 0.01, 0);
  put(head, rbox(0.08, 0.03, 0.1, 0.01), M.graphite, CHIN.x + 0.03, CHIN.y - 0.04, 0);
  for (const side of headSides) {
    // the face plate's edge: a dark seam from the antenna socket down to the chin, a row of rivets inside it
    const seam = [];
    for (let k = 0; k <= 16; k++) {
      const s = k / 16;
      seam.push(onSkull([0.8, 0.62 - 1.5 * s, 0.36 - 0.24 * s], 0.002));
    }
    put(side, tube(seam, 0.008, 64, 6), M.black);
    const mats = [];
    for (let k = 0; k <= 11; k++) {
      const s = 0.04 + k * 0.085;
      mats.push(new THREE.Matrix4().makeTranslation(...onSkull([0.86, 0.56 - 1.45 * s, 0.25 - 0.19 * s], -0.002).toArray()));
    }
    instances(side, new THREE.SphereGeometry(0.0095, 10, 8), M.graphite, mats);
  }
  // the mandibles: two curved white sickles under the jaw, open, an orange serrated strip along each inner edge
  {
    const Lm = 0.42;
    const cl = (s) => [Lm * s, 0.3 * s * s];
    const wd = (s) => 0.068 * Math.pow(1 - s, 0.7) + 0.006;
    const edge = (s, off) => {
      const [x, y] = cl(s);
      const tx = Lm;
      const ty = 0.6 * s;
      const l = Math.hypot(tx, ty);
      return [x - (ty / l) * off, y + (tx / l) * off];
    };
    const body = new THREE.Shape();
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const p = edge(k / N, -wd(k / N));
      k ? body.lineTo(...p) : body.moveTo(...p);
    }
    for (let k = N; k >= 0; k--) body.lineTo(...edge(k / N, wd(k / N)));
    const teeth = new THREE.Shape();
    const T0 = 0.14;
    const T1 = 0.9;
    const NT = 6;
    teeth.moveTo(...edge(T0, wd(T0) - 0.014));
    for (let k = 0; k < NT; k++) {
      const a = T0 + ((T1 - T0) * k) / NT;
      const b = T0 + ((T1 - T0) * (k + 0.55)) / NT;
      const c = T0 + ((T1 - T0) * (k + 1)) / NT;
      teeth.lineTo(...edge(a, wd(a) - 0.002));
      teeth.lineTo(...edge(b, wd(b) + 0.04 * (1 - 0.4 * (k / NT))));
      teeth.lineTo(...edge(c, wd(c) - 0.002));
    }
    for (let k = 12; k >= 0; k--) {
      const s = T0 + ((T1 - T0) * k) / 12;
      teeth.lineTo(...edge(s, wd(s) - 0.014));
    }
    const ext = (sh, d, bv) => new THREE.ExtrudeGeometry(sh, {depth: d, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4}).translate(0, 0, -d / 2);
    const bodyGeo = ext(body, 0.044, 0.01);
    const teethGeo = ext(teeth, 0.028, 0.005);
    for (const side of headSides) {
      // hung from the chin, each blade runs down and hooks forward, its toothed edge on the inside of the curve; the
      // blade's face turned to the side so the hook reads in the hero view, the pair splayed apart
      const m = grp(side, CHIN.x + 0.0, CHIN.y - 0.01, 0.1);
      const X1 = new V3(0.3, -0.9, 0.3).normalize();
      const Y1 = new V3(1, 0, -0.25).addScaledVector(X1, -new V3(1, 0, -0.25).dot(X1)).normalize();
      const Z1 = new V3().crossVectors(X1, Y1);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X1, Y1, Z1));
      put(m, cylZ(0.04, 0.04, 0.07, 20), M.black);
      put(m, cylZ(0.022, 0.022, 0.08, 16), M.gunmetal);
      put(m, bodyGeo, M.shell);
      put(m, teethGeo, M.orange);
      for (const s of [0.22, 0.42]) {
        const [x, y] = cl(s);
        put(m, cylZ(0.009, 0.009, 0.05, 10), M.graphite, x, y, 0);
      }
      ex(m, [0.6, -0.6, 0.5], 0.12, 0.4, 1.0, {axis: AY, ang: 0.35}, [0.3, -0.35, 0.3]);
    }
  }
  // orange dots and black vents on the shell
  for (const side of skullSides) {
    for (const d of [
      [0.55, -0.35, 0.76],
      [-0.1, 0.4, 0.91],
    ]) {
      const n = new V3(...d).normalize();
      const m = put(side, cylX(0.016, 0.016, 0.012, 20), M.orange);
      m.position.copy(deform(n.clone().multiplyScalar(RH + 0.001)));
      aimX(m, n);
    }
    const v = new V3(0.62, -0.62, 0.48).normalize();
    const vent = grp(side);
    vent.position.copy(deform(v.clone().multiplyScalar(RH - 0.004)));
    aimX(vent, v);
    put(vent, rbox(0.02, 0.05, 0.1, 0.008), M.black);
    put(vent, rbox(0.024, 0.02, 0.03, 0.006), M.graphite, 0.002, 0, 0.065);
  }
  // the eyes: the bee's camera lens on each side, a third larger, its orange lip thicker. A black barrel standing
  // proud of the shell, closed by a black backplate (the shell would show through the glass otherwise); graphite steps
  // inside, a dark iris of blades round a deep black element and a small amber pupil, all under a clear glass dome that
  // carries the highlights. Mount frame: +x out of the head, the shell's surface at about x = 0.035.
  const EYE_N = new V3(0.46, 0.2, 0.86).normalize();
  const EYE_S = 1.32;
  for (const side of headSides) {
    const n = EYE_N;
    const eye = grp(side);
    const mount = grp(eye);
    anchor('lens', mount, 0.12, 0, 0);
    mount.position.copy(onSkull(n.toArray())).addScaledVector(n, -0.035 * EYE_S);
    mount.scale.setScalar(EYE_S);
    aimX(mount, n);
    put(mount, ring(-0.07, 0.076, 0.172, 0.214, 0.012), M.black);
    put(mount, ring(0.056, 0.086, 0.19, 0.228, 0.006), M.orange);
    put(mount, ring(0.036, 0.048, 0, 0.174, 0.003), M.black);
    put(mount, ring(0.04, 0.07, 0.152, 0.176, 0.008), M.graphite);
    put(mount, ring(0.046, 0.062, 0.122, 0.155, 0.006), M.black);
    put(mount, ring(0.05, 0.058, 0.112, 0.124, 0.003), M.gunmetal);
    // iris: a dark disc and ten overlapping blades
    put(mount, ring(0.048, 0.054, 0.045, 0.12, 0.002), M.graphite);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const b = put(mount, rbox(0.006, 0.07, 0.03, 0.002), k % 2 ? M.black : M.graphite, 0.058, Math.cos(a) * 0.082, Math.sin(a) * 0.082);
      b.rotation.x = a + 0.6;
    }
    const inner = put(mount, new THREE.SphereGeometry(0.075, 48, 24, 0, Math.PI * 2, 0, 1.0), M.lens);
    inner.rotation.z = -Math.PI / 2;
    inner.position.x = 0.01;
    put(mount, ring(0.082, 0.09, 0.022, 0.032, 0.003), M.gunmetal);
    put(mount, cylX(0.016, 0.016, 0.008, 24), M.amber, 0.088, 0, 0);
    const glass = put(mount, new THREE.SphereGeometry(0.2, 72, 36, 0, Math.PI * 2, 0, 0.86), M.lensGlass);
    glass.rotation.z = -Math.PI / 2;
    glass.position.x = 0.13 - 0.2;
    glass.castShadow = false;
    ex(eye, [0.4, 0.05, 1], 0.24, 0.5, 1.0, null, [0.25, 0.05, 0.55]);
    if (!eyeRig) {
      // the near lens as a rig for its own teardown: every ring slides out along the optical axis by its own share and
      // turns as if unscrewed, the iris blades swing open and spread, the glass leads the way out
      const kids = [...mount.children];
      const OFF = [0, 0.14, 0.04, 0.22, 0.3, 0.38, 0.46, ...Array(10).fill(0.54), 0.66, 0.78, 0.8, 1.0];
      eyeRig = kids.map((o, i) => ({o, home: o.position.clone(), q0: o.quaternion.clone(), off: OFF[i] ?? 0.5, spin: i >= 7 && i < 17 ? 0 : (i % 2 ? 1.6 : -1.3), blade: i >= 7 && i < 17}));
      anchor('barrel', kids[0], 0, 0.2, 0);
      anchor('iris', kids[6], 0, 0.1, 0);
      anchor('eyeInner', kids[17], 0, 0.075, 0);
      anchor('eyeGlass', kids[20], 0, 0.2, 0);
    }
  }
  // antennae: a socket on the brow, a long whip that rises and curves forward and down, sleeved in dark segments
  // with orange bands, an orange tip
  const antennae = [];
  for (const side of headSides) {
    const a = grp(side, ...onSkull([0.5, 0.84, 0.2], -0.01).toArray());
    put(a, new THREE.SphereGeometry(0.038, 24, 16), M.black);
    put(a, ring(-0.012, 0.012, 0.03, 0.052, 0.006).rotateZ(Math.PI / 2), M.orange, 0, 0.012, 0);
    const pts = [[0, 0, 0], [0.04, 0.24, 0.05], [0.2, 0.5, 0.12], [0.5, 0.62, 0.2], [0.82, 0.52, 0.27], [1.04, 0.28, 0.32], [1.14, 0.06, 0.34]].map((p) => new V3(...p));
    put(a, tube(pts, 0.014, 120, 10), M.black);
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let k = 0; k < 17; k++) {
      const u = 0.05 + k * 0.053;
      const r = 0.023 - k * 0.0005;
      const seg = put(a, cylX(r, r, k % 3 === 1 ? 0.024 : 0.044, 16), k % 3 === 1 ? M.orange : k % 2 ? M.graphite : M.black);
      seg.position.copy(curve.getPointAt(u));
      aimX(seg, curve.getTangentAt(u));
    }
    const tip = grp(a);
    anchor('antenna', tip, 0.14, 0, 0);
    tip.position.copy(curve.getPointAt(1));
    aimX(tip, curve.getTangentAt(1));
    put(tip, cylX(0.019, 0.004, 0.13, 20), M.orange, 0.06, 0, 0);
    put(tip, cylX(0.02, 0.02, 0.024, 20), M.black, -0.008, 0, 0);
    ex(a, [0.3, 1, 0.3], 0.3, 0.45, 1.0, {axis: AZ, ang: -0.3}, [0.25, 0.75, 0.2]);
    antennae.push(a);
  }

  // ================================================================ neck collar
  TAG = 'neck';
  const neck = grp(root, 0.6, 0.1, 0);
  anchor('collar', neck, 0, 0.14, 0.28);
  ex(neck, [1, 0, 0], 0.26, 0.4, 1.0, null, [0.95, 0.05, 0]);
  put(neck, cylX(0.17, 0.17, 0.42, 40), M.black);
  // the collar in 10 segments with slots between, orange and graphite in turn, a black ring behind it, a gear inside
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2 + 0.06;
    put(neck, ring(-0.035, 0.035, 0.255, 0.3, 0.01, {a0, a1: a0 + (Math.PI * 2) / 10 - 0.12, segs: 16}), k % 2 ? M.graphite : M.orange);
  }
  put(neck, ring(-0.06, 0.06, 0.2, 0.255, 0.008), M.graphite);
  const neckGear = put(neck, gearX(30, 0.272, 0.25, 0.035, 0.18), M.gunmetal, 0.075, 0, 0);
  put(neck, ring(-0.12, -0.06, 0.17, 0.3, 0.012), M.black);
  {
    const mats = [];
    for (let k = 0; k < 9; k++) {
      const a = ((k + 0.5) / 9) * Math.PI * 2;
      mats.push(new THREE.Matrix4().makeTranslation(0.058, Math.cos(a) * 0.29, Math.sin(a) * 0.29));
    }
    instances(neck, cylX(0.013, 0.013, 0.016, 12), M.steel, mats);
  }

  // ================================================================ thorax: white rings and dark gear sections along x
  TAG = 'thorax';
  const thorax = grp(root, 0, 0.06, 0);
  put(thorax, cylX(0.22, 0.22, 0.98, 48), M.black, 0.07, 0, 0);
  // A: the front white ring, a window cut on each flank; dark ring stack and small gears behind the windows
  const ringA = grp(thorax);
  ex(ringA, [1, 0.15, 0], 0.12, 0.3, 0.9, null, [0.62, 0.42, 0]);
  put(ringA, taper(0.52, 0.34, 0.39, 0.41, 0.06, 0.016, -1.05, 1.05), M.shell);
  put(ringA, taper(0.52, 0.34, 0.39, 0.41, 0.06, 0.016, 2.1, 4.18), M.shell);
  put(ringA, ring(0.5, 0.53, 0.3, 0.39, 0.006), M.graphite);
  for (const x of [0.37, 0.43, 0.49]) put(thorax, ring(x - 0.018, x + 0.018, 0.22, 0.33, 0.006), x === 0.43 ? M.gunmetal : M.graphite);
  for (const side of sides) {
    const g = grp(side, 0.43, 0.06, 0.3);
    put(g, gearGeo(16, 0.07, 0.06, 0.03, 0.015, 4), M.gunmetal);
    put(g, cylZ(0.024, 0.024, 0.05, 16), M.gunmetal, 0, 0, 0.012);
    put(g, gearGeo(10, 0.042, 0.034, 0.03, 0.01), M.graphite, 0.0, -0.1, 0.004);
  }
  // B: dark section, two gears, a ring of small barrels between them, orange spacers
  const B = [
    [0.3, 36, 0.355, 0.33, 0.045, M.graphite, 6],
    [0.17, 30, 0.335, 0.31, 0.05, M.gunmetal, 5],
  ];
  B.forEach(([x, n, ro, rr, w, mat, sp], i) => {
    const g = grp(thorax, x, 0, 0);
    if (i === 0) anchor('gears', g, 0, 0.12, 0.32);
    put(g, gearX(n, ro, rr, w, 0.22, sp), mat);
    put(g, ring(-w / 2 - 0.006, w / 2 + 0.006, 0.22, 0.26, 0.006), M.black);
    ex(g, [i ? -0.5 : 0.5, 0.05, 0], 0.14, 0.55, 1.0, {axis: AX, ang: 0.6 * (i ? 1 : -1)}, [i ? 0.12 : 0.42, -0.08, 0], i ? 0.7 : -0.5, AX);
  });
  {
    const barrels = grp(thorax);
    ex(barrels, [0, 1, 0], 0.06, 0.6, 1.0, {axis: AX, ang: 0.4}, [0.05, 0.3, 0], 0.3, AX);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      put(barrels, cylX(0.03, 0.03, 0.08, 18), k % 2 ? M.black : M.graphite, 0.235, Math.cos(a) * 0.29, Math.sin(a) * 0.29);
      put(barrels, cylX(0.033, 0.033, 0.014, 18), k % 2 ? M.gunmetal : M.graphite, 0.235, Math.cos(a) * 0.29, Math.sin(a) * 0.29);
    }
  }
  for (const x of [0.335, 0.135]) put(thorax, ring(x - 0.007, x + 0.007, 0.24, 0.345, 0.003), x > 0.2 ? M.orange : M.gunmetal);
  // C: the middle white ring, two black grooves, a port on each flank
  const ringC = grp(thorax);
  anchor('ringC', ringC, 0.04, 0.24, 0.3);
  ex(ringC, [0, 1, 0], 0.08, 0.5, 1.0, null, [0, 0.82, 0]);
  // two arcs with a window on each flank, so the dark cluster shows through
  const WIN = 0.5;
  for (const [a0, a1] of [
    [-Math.PI / 2 + WIN, Math.PI / 2 - WIN],
    [Math.PI / 2 + WIN, (3 * Math.PI) / 2 - WIN],
  ]) {
    put(ringC, taper(0.12, -0.04, 0.395, 0.39, 0.075, 0.018, a0, a1), M.shell);
    for (const x of [0.07, 0.01]) put(ringC, ring(x - 0.005, x + 0.005, 0.37, 0.396, 0.002, {a0: a0 + 0.02, a1: a1 - 0.02, segs: 40}), M.black);
  }
  // D: dark section, a gear, radial actuators with steel rods, orange caps
  {
    const g = grp(thorax, -0.09, 0, 0);
    put(g, gearX(40, 0.36, 0.335, 0.04, 0.22, 8), M.graphite);
    put(g, ring(-0.03, 0.03, 0.22, 0.26, 0.006), M.black);
    ex(g, [-0.3, 0, 0], 0.14, 0.55, 1.0, {axis: AX, ang: 0.9}, [-0.3, -0.1, 0], 0.45, AX);
    const act = grp(thorax);
    anchor('act', act, -0.18, -0.16, 0.26);
    ex(act, [0, -1, 0], 0.06, 0.6, 1.0, null, [-0.05, -0.55, 0]);
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + 0.2;
      const c = grp(act, -0.18, Math.cos(a) * 0.28, Math.sin(a) * 0.28);
      put(c, cylX(0.034, 0.034, 0.1, 20), M.black);
      put(c, cylX(0.038, 0.038, 0.018, 20), k === 3 ? M.orange : M.gunmetal, 0.05, 0, 0);
      put(c, cylX(0.012, 0.012, 0.06, 12), M.steel, -0.07, 0, 0);
    }
  }
  // E: the waist, white, tapering into the abdomen joint, an orange lip
  const ringE = grp(thorax);
  ex(ringE, [-1, 0, 0], 0.12, 0.35, 0.95, null, [-0.55, 0.3, 0]);
  for (const [a0, a1] of [
    [-Math.PI / 2 + 0.38, Math.PI / 2 - 0.38],
    [Math.PI / 2 + 0.38, (3 * Math.PI) / 2 - 0.38],
  ]) {
    put(ringE, taper(-0.25, -0.42, 0.34, 0.29, 0.07, 0.016, a0, a1), M.shell);
    put(ringE, ring(-0.36, -0.348, 0.29, 0.33, 0.003, {a0: a0 + 0.02, a1: a1 - 0.02, segs: 40}), M.black);
  }
  put(ringE, ring(-0.26, -0.235, 0.24, 0.335, 0.008), M.graphite);
  // saddle plates over the top, each on a black hinge bar
  [
    [0.33, 0.56, 0.455, 0.44, -0.9, 0.9],
    [-0.06, 0.15, 0.455, 0.45, -0.75, 0.75],
  ].forEach(([x0, x1, ra, rb, a0, a1], i) => {
    const p = grp(thorax);
    if (i === 0) anchor('plate', p, 0.45, 0.47, 0);
    put(p, taper(x1, x0, rb, ra, 0.04, 0.012, a0, a1), M.shell);
    put(p, taper(x1 - 0.012, x0 + 0.012, rb - 0.04, ra - 0.04, 0.012, 0.004, a0 + 0.04, a1 - 0.04), M.graphite);
    put(p, cylX(0.02, 0.02, x1 - x0 + 0.04, 16), M.black, (x0 + x1) / 2, 0.41, 0);
    if (i === 0) {
      for (let k = 0; k < 4; k++) {
        const a = -0.36 + k * 0.24;
        put(p, rbox(0.09, 0.012, 0.028, 0.005), M.black, x0 + 0.07, Math.cos(a) * 0.457, Math.sin(a) * 0.457).rotation.x = -a;
      }
      put(p, taper(x1 - 0.03, x1 - 0.06, 0.448, 0.447, 0.01, 0.003, -0.6, 0.6), M.orange);
    } else {
      for (const a of [-0.45, 0.45]) put(p, cylX(0.015, 0.015, 0.01, 16).rotateZ(Math.PI / 2), M.graphite, 0.04, Math.cos(a) * 0.455, Math.sin(a) * 0.455).rotation.x = -a;
    }
    ex(p, [0.1 * (1 - i * 2), 1, 0], 0.34 + i * 0.06, 0.02 + i * 0.05, 0.75, {axis: AZ, ang: 0.25 * (1 - i * 2)}, [0.25 * (1 - i * 2), 1.15 + i * 0.25, 0]);
  });
  // struts along the thorax over the dark sections, each with a graphite clamp and a collar
  {
    const st = grp(thorax);
    ex(st, [0, 1, 0], 0.05, 0.6, 1.0, null, [0, 0.5, 0]);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.31;
      const y = Math.cos(a) * 0.375;
      const z = Math.sin(a) * 0.375;
      put(st, cylX(0.014, 0.014, 0.58, 12), k % 3 === 0 ? M.steel : M.black, 0.1, y, z);
      put(st, rbox(0.04, 0.05, 0.05, 0.01), M.graphite, 0.24, y, z).rotation.x = -a;
      put(st, cylX(0.022, 0.022, 0.016, 14), M.gunmetal, -0.06, y, z);
    }
    const mats = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const [x, r] of [
        [0.33, 0.27],
        [0.2, 0.25],
        [-0.06, 0.26],
      ]) mats.push(new THREE.Matrix4().makeTranslation(x, Math.cos(a) * r, Math.sin(a) * r));
    }
    instances(st, cylX(0.011, 0.011, 0.03, 8), M.steel, mats);
  }
  // the fine kitbash: small pistons, hoses, circuit boards, screws in slots, small gears, wiring bundles and
  // blocks packed round the core along the whole thorax, under the shells and behind the windows. Each part is built
  // with +y pointing out of the core and set on it at (x, angle, radius); merged per material, one draw call each.
  {
    const kit = grp(thorax);
    anchor('core', kit, 0.04, -0.06, 0.33);
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
      // a piston: a black barrel, a steel rod, a graphite clevis
      (s) => {
        add(cylX(0.016 * s, 0.016 * s, 0.07 * s, 14), M.black, at(0, 0.02 * s, 0));
        add(cylX(0.006 * s, 0.006 * s, 0.06 * s, 8), M.steel, at(0.06 * s, 0.02 * s, 0));
        add(rbox(0.018 * s, 0.024 * s, 0.022 * s, 0.004 * s), M.graphite, at(0.095 * s, 0.02 * s, 0));
      },
      // a hose arching off the core
      (s) => add(tube([[-0.06 * s, 0.005, 0], [-0.02 * s, 0.045 * s, 0.015 * s], [0.03 * s, 0.05 * s, 0.03 * s], [0.07 * s, 0.008, 0.035 * s]], 0.008 * s, 20, 8), R() < 0.8 ? M.black : M.graphite),
      // a circuit board with chips and a row of pads
      (s) => {
        add(rbox(0.1 * s, 0.008, 0.066 * s, 0.003), M.pcb, at(0, 0.004, 0));
        for (let k = 0; k < 4; k++) add(rbox(0.018 * s, 0.008, 0.016 * s, 0.002), M.black, at((-0.03 + (k % 2) * 0.04) * s, 0.011, (k < 2 ? -0.015 : 0.015) * s));
        for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.005 * s, 0.003, 0.008 * s), M.steel, at((-0.04 + k * 0.016) * s, 0.009, 0.028 * s));
      },
      // a screw in a slot
      (s) => {
        add(rbox(0.07 * s, 0.01, 0.024 * s, 0.005), M.black, at(0, 0.005, 0));
        add(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.008, 12), M.steel, at((R() - 0.5) * 0.04 * s, 0.012, 0));
      },
      // a small gear lying on the core, a gunmetal hub
      (s) => {
        add(gearGeo(10 + Math.floor(R() * 6), 0.034 * s, 0.027 * s, 0.012, 0.006).rotateX(Math.PI / 2), M.graphite, at(0, 0.012, 0));
        add(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.02, 12), M.gunmetal, at(0, 0.016, 0));
      },
      // a wiring bundle: three or four thin leads side by side
      (s) => {
        const n = 3 + Math.floor(R() * 2);
        for (let k = 0; k < n; k++) {
          const z = (k - (n - 1) / 2) * 0.012 * s;
          add(tube([[-0.08 * s, 0.006, z], [-0.02 * s, 0.022 * s, z * 1.4], [0.04 * s, 0.018 * s, z * 1.2], [0.09 * s, 0.006, z]], 0.0045 * s, 20, 6), k % 3 === 2 ? M.graphite : M.black);
        }
      },
      // a block with a bolt on it
      (s) => {
        add(rbox(0.04 * s, 0.03 * s, 0.034 * s, 0.006 * s), R() < 0.5 ? M.graphite : M.black, at(0, 0.015 * s, 0));
        add(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.01, 6), M.steel, at(0.006 * s, 0.032 * s, 0.004 * s));
      },
    ];
    for (let i = 0; i < 260; i++) {
      const x = -0.42 + R() * 0.94;
      const a = R() * Math.PI * 2;
      const r = 0.22 + Math.pow(R(), 1.4) * 0.12;
      place = T.makeTranslation(x, Math.cos(a) * r, Math.sin(a) * r).clone().multiply(Rx.makeRotationX(a)).multiply(Ry.makeRotationY(R() * Math.PI * 2));
      types[Math.floor(R() * types.length)](0.8 + R() * 0.6);
    }
    for (const [mat, list] of bins) put(kit, merge(list), mat);
    ex(kit, [0, -0.2, 0], 0.04, 0.6, 1.0, null, [0, -0.12, 0]);
  }
  // the sternum under the core, where the legs hang
  put(thorax, rbox(0.66, 0.14, 0.34, 0.04), M.black, 0.1, -0.27, 0);
  put(thorax, rbox(0.52, 0.05, 0.4, 0.02), M.graphite, 0.1, -0.2, 0);
  // cables: neck to the wing roots, round the gears, under the belly
  {
    const cab = [
      [[[0.5, 0.16, 0.12], [0.42, 0.36, 0.24], [0.28, 0.36, 0.34], [0.2, 0.22, 0.4]], 0.018, M.black],
      [[[0.52, -0.08, 0.2], [0.36, -0.12, 0.4], [0.16, -0.04, 0.42], [-0.04, 0.02, 0.4], [-0.24, 0.0, 0.32]], 0.016, M.black],
      [[[0.48, 0.04, 0.24], [0.34, 0.2, 0.4], [0.16, 0.26, 0.42], [-0.02, 0.2, 0.4]], 0.012, M.graphite],
      [[[0.46, -0.16, 0.2], [0.3, -0.02, 0.42], [0.1, 0.1, 0.43], [-0.1, -0.04, 0.4], [-0.26, -0.12, 0.3]], 0.011, M.black],
      [[[0.0, 0.34, 0.2], [0.1, 0.4, 0.3], [0.24, 0.36, 0.36]], 0.016, M.black],
      [[[0.4, -0.24, 0.12], [0.22, -0.3, 0.26], [0.02, -0.26, 0.3], [-0.2, -0.18, 0.26]], 0.02, M.black],
      [[[0.1, 0.32, 0.28], [-0.04, 0.38, 0.22], [-0.2, 0.32, 0.18], [-0.34, 0.18, 0.12]], 0.014, M.graphite],
      [[[0.26, -0.2, 0.3], [0.18, -0.36, 0.3], [0.04, -0.38, 0.22]], 0.014, M.black],
    ];
    for (const side of sides) for (const [pts, r, m] of cab) put(side, tube(pts.map(([x, y, z]) => [x, y + 0.06, z]), r, 64, 10), m);
  }
  // per side: a shoulder pad over the front leg, a smaller one behind, a gear pair on the flank
  for (const side of sides) {
    const pad = grp(side, 0.3, -0.12, 0.17);
    anchor('pad', pad, 0.21, 0.02, 0);
    aimX(pad, new V3(0.12, -0.32, 0.94));
    put(pad, dome(0.21, 0.03, 0, 1.12), M.shell);
    put(pad, dome(0.19, 0.008, 0.06, 1.08), M.shellIn);
    put(pad, rbox(0.03, 0.1, 0.036, 0.012), M.orange, 0.208, 0.03, 0);
    put(pad, rbox(0.03, 0.046, 0.02, 0.008), M.black, 0.214, 0.03, 0);
    for (const [y, z] of [[-0.1, 0.05]]) {
      const d = put(pad, cylX(0.012, 0.012, 0.01, 16), M.orange, Math.sqrt(0.21 * 0.21 - y * y - z * z), y, z);
      aimX(d, new V3(d.position.x, y, z));
    }
    ex(pad, [0.2, -0.3, 1], 0.36, 0.0, 0.7, {axis: AX, ang: 0.35}, [0.25, -0.45, 0.95]);
    const pad2 = grp(side, -0.08, -0.12, 0.16);
    aimX(pad2, new V3(-0.12, -0.45, 0.88));
    put(pad2, dome(0.12, 0.022, 0, 0.9), M.shell);
    put(pad2, dome(0.106, 0.008, 0.05, 0.86), M.shellIn);
    put(pad2, rbox(0.022, 0.022, 0.06, 0.008), M.black, 0.12, -0.02, 0);
    ex(pad2, [-0.3, -0.6, 1], 0.3, 0.08, 0.8, {axis: AY, ang: -0.3}, [-0.3, -0.55, 0.85]);
    const gc = grp(side, 0.22, 0.04, 0.36);
    put(gc, gearGeo(24, 0.1, 0.088, 0.026, 0.02, 5), M.graphite);
    put(gc, gearGeo(12, 0.052, 0.042, 0.028, 0.01), M.gunmetal, 0.14, 0.05, 0.006);
    put(gc, cylZ(0.034, 0.034, 0.05, 24), M.orange, 0, 0, 0.012);
    put(gc, cylZ(0.02, 0.02, 0.05, 20), M.gunmetal, 0.14, 0.05, 0.016);
    put(gc, cylZ(0.011, 0.011, 0.03, 12), M.steel, 0, 0, 0.045);
    ex(gc, [0, 0.2, 1], 0.28, 0.5, 1.0, {axis: AZ, ang: 1.2}, [0.05, 0.35, 0.75], 0.9, AZ);
  }

  // ================================================================ wings
  TAG = 'wings';
  // flight: spread level, leading edge forward. display: face-on to the hero camera, the near pair swept back
  // (fore up, hind down), the far pair forward past the head.
  const WP = {
    flight: [
      [[-0.22, 0.1, 0.97], [0, 1, 0], [1, 0, 0]],
      [[-0.45, 0.0, 0.89], [0, 1, 0], [1, 0, 0]],
    ],
    display: [
      [
        [[-0.65, 0.45, 0.6], CAM_DIR, [0, 1, 0]],
        [[-0.7, -0.55, 0.45], CAM_DIR, [0, 1, 0]],
      ],
      [
        [[0.4, 0.22, 0.89], CAM_L, [0, 1, 0]],
        [[0.55, -0.35, 0.76], CAM_L, [0, 1, 0]],
      ],
    ],
  };
  // A beating wing is drawn as a soft fan: NG faint copies spread over one whole stroke (denser at the ends of the
  // stroke, where a real wing dwells), so the 7.5 Hz beat reads as a motion-blurred blade at 60 fps and never strobes.
  // As the beat winds down the fan closes onto the rest pose and the solid wing fades in over it. The solid wings use
  // their own material clones (so they can fade without touching the body), the ghosts another set.
  const NG = 24;
  // a live page on a weak GPU draws every fanStep-th copy only, each one fanStep times as strong
  let fanStep = 1;
  const ghostMats = new Map();
  const solidMats = new Map();
  const cloneFor = (map, src, ghost) => {
    if (!map.has(src)) {
      const m = src.clone();
      m.userData.base = src.opacity ?? 1;
      m.userData.transparent = src.transparent;
      if (ghost) {
        m.transparent = true;
        m.depthWrite = false;
      }
      map.set(src, m);
    }
    return map.get(src);
  };
  const wings = [];
  for (const [si, side] of sides.entries()) {
    for (const fore of [true, false]) {
      const w = buildWing(fore ? {S: 2.9, C: 0.5} : {S: 2.2, C: 0.52}, M, R, clear);
      const hinge = fore ? grp(side, 0.26, 0.33, 0.33) : grp(side, -0.2, 0.08, 0.36);
      put(hinge, rbox(0.1, 0.05, 0.1, 0.016), M.graphite, 0, -0.04, -0.04);
      put(hinge, new THREE.SphereGeometry(0.048, 24, 16), M.black);
      put(hinge, ringZ(0.02, 0.034, 0.03, 0.05, 0.004), fore ? M.orange : M.graphite);
      // the ghosts: the wing without its clips, dots and root hardware, in faint materials
      const ghosts = [];
      for (let i = 0; i < NG; i++) {
        const gw = w.group.clone(true);
        const drop = [];
        gw.traverse((o) => {
          if (o.isInstancedMesh || o.userData.small || (lightFan && o.isMesh && (o.material === M.vein || o.material === M.veinCore))) drop.push(o);
        });
        for (const o of drop) o.parent.remove(o);
        gw.traverse((o) => {
          if (!o.isMesh) return;
          o.material = cloneFor(ghostMats, o.material, true);
          o.castShadow = false;
          o.receiveShadow = false;
          o.renderOrder = 4;
          clear.push(o);
        });
        const og = grp(hinge);
        og.add(gw);
        og.visible = false;
        ghosts.push(og);
      }
      w.group.traverse((o) => {
        if (o.isMesh) o.material = cloneFor(solidMats, o.material, false);
      });
      const orient = grp(hinge);
      // the detach rig: det carries the wing out of its hinge and turns it about its own centre, so a flip spins the
      // wing in place instead of swinging it round the hinge
      const det = grp(orient);
      const piv = grp(det);
      piv.add(w.group);
      const C = new V3(fore ? 1.55 : 1.25, -0.22, 0);
      det.position.copy(C);
      piv.position.copy(C).negate();
      ex(hinge, [-0.1, 0.5, 1], 0.4, 0.3, 1.0, null, [-0.15, 0.75, 0.95]);
      const fi = fore ? 0 : 1;
      wings.push({side: si, fore, hinge, orient, det, C, solid: w.group, ghosts, qF: wingQuat(...WP.flight[fi]), qD: wingQuat(...WP.display[si][fi])});
      anchor(fore ? 'hinge' : 'hinge2', hinge, 0, 0.02, 0);
      if (fore) anchor('wing', w.group, 1.6, -0.1, 0);
    }
  }

  // ================================================================ legs
  TAG = 'legs';
  const legs = [];
  // one pose per leg, near side then far side: front legs reach forward, rear legs trail, knees bend by different
  // amounts and the feet hang at different heights; the segments get longer toward the back
  // the wasp's legs are the bee's, longer (the shin and the foot most) and hanging down and back in flight
  const LEG = [
    [
      {at: [0.44, -0.25, 0.14], yaw: 30, splay: 14, a: [58, -62, -24], Lf: 0.4, Lt: 1.0, Lr: 0.2},
      {at: [0.13, -0.27, 0.17], yaw: 0, splay: 22, a: [18, -46, -16], Lf: 0.46, Lt: 1.1, Lr: 0.24},
      {at: [-0.2, -0.24, 0.14], yaw: -32, splay: 18, a: [-30, -14, -18], Lf: 0.5, Lt: 1.16, Lr: 0.26},
    ],
    [
      {at: [0.44, -0.25, 0.14], yaw: 22, splay: 16, a: [44, -40, -12], Lf: 0.42, Lt: 1.02, Lr: 0.21},
      {at: [0.13, -0.27, 0.17], yaw: -6, splay: 20, a: [8, -36, -20], Lf: 0.44, Lt: 1.06, Lr: 0.23},
      {at: [-0.2, -0.24, 0.14], yaw: -26, splay: 18, a: [-18, -24, -6], Lf: 0.48, Lt: 1.12, Lr: 0.25},
    ],
  ];
  for (const [si, side] of sides.entries()) {
    for (const L of LEG[si]) {
      const leg = buildLeg(L, M);
      leg.mount.position.set(...L.at);
      side.add(leg.mount);
      ex(leg.mount, [0, -0.6, 1], 0.22, 0.25, 0.95, null, [0, -0.55, 0.75]);
      legs.push({side: si, idx: legs.filter((x) => x.side === si).length, ...leg});
      const li = legs.filter((x) => x.side === si).length;
      anchor(`knee${li}`, leg.tib, 0, 0, 0.06);
      anchor(`hip${li}`, leg.mount, 0, 0, 0.06);
      if (li === 2) anchor('foot', leg.foot, 0, 0, 0.04);
    }
  }

  // ================================================================ waist and abdomen
  TAG = 'abdomen';
  const ringS = (a, b, r0, r1, rd, o) => ring(Math.min(a, b), Math.max(a, b), r0, r1, rd, o);
  // the waist: a thin stalk out of the thorax's rear ring, four dark beads with an orange-lit ring between each
  const waist = grp(root, -0.4, -0.05, 0);
  waist.rotation.z = 18 * D2R;
  const WL = 0.66;
  anchor('waist', waist, -0.33, 0.1, 0.06);
  put(waist, cylX(0.045, 0.045, WL + 0.08, 20), M.black, -WL / 2, 0, 0);
  put(waist, ringS(-0.03, 0.02, 0.06, 0.2, 0.012), M.black);
  put(waist, ringS(-0.05, -0.03, 0.06, 0.15, 0.005), M.gunmetal);
  put(waist, ringS(-0.064, -0.05, 0.05, 0.11, 0.004), M.glow);
  const beads = [];
  for (let k = 0; k < 5; k++) {
    const x0 = -0.075 - k * 0.112;
    const b = grp(waist);
    put(b, solid(x0, x0 - 0.088, capsuleR(0.084 - k * 0.003, 0.08 - k * 0.003, 0.3), {}, 20), k % 2 ? M.graphite : M.black);
    put(b, ringS(x0 - 0.038, x0 - 0.05, 0.07, 0.088 - k * 0.003, 0.003), M.gunmetal);
    put(b, ringS(x0 - 0.094, x0 - 0.106, 0.04, 0.072, 0.003), M.glow);
    ex(b, [-1, 0, 0], 0.02 + 0.015 * k, 0.4, 1.0, null, [-0.08 - 0.06 * k, 0, 0]);
    beads.push(b);
  }
  // the abdomen: a long body swelling to its widest a third of the way back and tapering to a point. Six white
  // riveted bands over a black core; in each gap an orange-lit ring with dark barrels and blocks packed round it; a
  // dark collar at the tip and a clear glass sting with an orange core
  const abd = grp(waist, -WL - 0.02, 0, 0);
  abd.rotation.z = 10 * D2R;
  const LG = 1.56;
  const gr = (u) => (u < 0.32 ? 0.12 + 0.29 * Math.pow(Math.sin(((u / 0.32) * Math.PI) / 2), 0.75) : 0.065 + 0.345 * (1 - Math.pow((u - 0.32) / 0.68, 1.6)));
  const gx = (u) => -u * LG;
  put(abd, ringS(0.02, -0.04, 0.05, 0.11, 0.008), M.gunmetal);
  put(abd, solid(0, -LG, (u) => gr(u) * 0.74, {}, 60), M.black);
  // a band: the outer skin follows the body's profile from ua to ub, wall t
  const band = (ua, ub, lift, t) => {
    const out = [];
    const inn = [];
    for (let k = 0; k <= 12; k++) {
      const u = ua + ((ub - ua) * k) / 12;
      out.push([gx(u), gr(u) + lift]);
      inn.push([gx(u), gr(u) + lift - t]);
    }
    return sweepX([...out, ...inn.reverse()], {segs: 72});
  };
  const NB = 5;
  const U0 = 0.045;
  const U1 = 0.9;
  const P = (U1 - U0) / NB;
  const rivet = new THREE.SphereGeometry(0.0075, 10, 8);
  const segs = [];
  for (let i = 0; i < NB; i++) {
    const seg = grp(abd);
    const ua = U0 + i * P;
    const ub = ua + P * 0.6;
    put(seg, band(ua, ub, 0.012, 0.05), M.shell);
    // a black groove round the band's middle
    const um = (ua + ub) / 2;
    put(seg, ringS(gx(um) + 0.006, gx(um) - 0.006, gr(um) - 0.02, gr(um) + 0.016, 0.002), M.black);
    // rivets along both edges
    const mats = [];
    for (const u of [ua + 0.012, ub - 0.012]) {
      const nr = Math.round(22 * gr(u) / 0.3);
      for (let k = 0; k < nr; k++) {
        const a = ((k + (u > um ? 0.5 : 0)) / nr) * Math.PI * 2;
        const r = gr(u) + 0.008;
        mats.push(new THREE.Matrix4().makeTranslation(gx(u), Math.cos(a) * r, Math.sin(a) * r));
      }
    }
    instances(seg, rivet, M.graphite, mats);
    // the gap behind this band: the orange ring and the dark mechanism round it
    if (i < NB - 1) {
      const ga = ub;
      const gb = U0 + (i + 1) * P;
      const xa = gx(ga);
      const xb = gx(gb);
      const rr = gr((ga + gb) / 2);
      const xm = (xa + xb) / 2;
      const gl = xa - xb;
      put(seg, ringS(xa - gl * 0.18, xb + gl * 0.18, rr * 0.6, rr * 0.93, 0.004), M.glow);
      const n = 12;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + i * 0.4;
        const y = Math.cos(a) * rr * 0.92;
        const z = Math.sin(a) * rr * 0.92;
        if (k % 3 === 0) put(seg, cylX(0.024, 0.024, gl * 0.8, 14), M.black, xm, y, z);
        else if (k % 3 === 1) put(seg, rbox(gl * 0.5, 0.026, 0.034, 0.008), M.graphite, xm, y, z).rotation.x = -a;
      }
      put(seg, gearX(30, rr * 0.9, rr * 0.84, 0.016, rr * 0.55, 0), M.gunmetal, xa - 0.01, 0, 0);
      put(seg, gearX(30, rr * 0.9, rr * 0.84, 0.016, rr * 0.55, 0), M.graphite, xb + 0.01, 0, 0);
    }
    if (i === 0) anchor('s1', seg, gx(um), gr(um) * 0.8, gr(um) * 0.7);
    if (i === 1) anchor('gearA', seg, gx(ub + 0.03), gr(ub) * 0.6, gr(ub) * 0.7);
    if (i === 3) anchor('capsule', seg, gx(um), gr(um) * 0.4, gr(um) * 0.95);
    ex(seg, [-1, 0, 0], 0.03 + 0.03 * i, 0.3, 1.0, null, [-0.06 - 0.09 * i, 0, 0]);
    segs.push(seg);
  }
  // the tip: a dark collar, the glass sting with its orange core
  const s4 = grp(abd);
  const xt = gx(U1);
  anchor('sting', s4, xt - 0.6, 0, 0.04);
  put(s4, solid(xt + 0.02, gx(1) - 0.02, (u) => (gr(U1) + 0.006) * (1 - 0.5 * u), {}, 16), M.black);
  put(s4, ringS(xt - 0.03, xt - 0.05, gr(U1) * 0.7, gr(U1) + 0.012, 0.004), M.gunmetal);
  put(s4, ringS(gx(1) + 0.01, gx(1) - 0.02, 0.03, 0.062, 0.004), M.glow);
  // the sting slides out of its collar on its own rod (stingK, the end of the abdomen's teardown), its core glowing
  // hotter as it goes; at rest the rod and its lit rings sit hidden inside the collar
  const STING_X = gx(1) - 0.02;
  const sting = grp(s4, STING_X, 0, 0);
  const stingGeo = solid(0, -0.66, (u) => 0.068 * Math.pow(1 - u, 0.9) + 0.002, {}, 32);
  put(sting, stingGeo, M.sting);
  // the glass's edge: a faint amber line where the cone turns away from the eye, so the clear body reads on white
  put(sting, stingGeo, M.stingRim).renderOrder = 5;
  put(sting, solid(-0.02, -0.5, (u) => 0.018 * (1 - u) + 0.001, {}, 12), M.stingCore);
  put(sting, cylX(0.03, 0.03, 0.36, 18), M.gunmetal, 0.18, 0, 0);
  for (const x of [0.09, 0.19, 0.29]) put(sting, ringS(x - 0.008, x + 0.008, 0.02, 0.038, 0.003), M.glow);
  put(sting, ringS(-0.06, -0.075, 0.05, 0.064, 0.003), M.orange);
  put(sting, ringS(0.0, -0.03, 0.03, 0.058, 0.004), M.black);
  ex(s4, [-1, 0, 0], 0.26, 0.3, 1.0, null, [-0.6, 0, 0]);

  // ================================================================ floating debris
  const debris = grp(root);
  const D = [];
  // the near eye and the hero camera: nothing may hang in the line between them at the reference pose, or inside the head
  const EYE = H.clone().add(new V3(0.5, 0.04, 0.865).normalize().multiplyScalar(RH));
  const CAM = EYE.clone().add(new V3(...CAM_DIR).multiplyScalar(7.6));
  const sight = new THREE.Line3(EYE, CAM);
  const tmp = new V3();
  const addDebris = (obj, c, spread, d0, d1) => {
    const dir = new V3();
    const home = new V3();
    let dist = 0;
    for (let tries = 0; tries < 12; tries++) {
      dir.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1);
      dir.x *= 1.6;
      dir.normalize();
      dist = d0 + (d1 - d0) * R();
      home.set(c[0] + dir.x * spread, c[1] + dir.y * spread, c[2] + dir.z * spread);
      // where it hangs at explode 0.4
      const p = home.clone().addScaledVector(dir, dist * 0.45);
      if (sight.closestPointToPoint(p, true, tmp).distanceTo(p) > 0.34 && p.distanceTo(H) > RH + 0.12) break;
    }
    obj.position.copy(home);
    obj.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28);
    debris.add(obj);
    // small loose parts (balls, bolts, washers, small gears) a weak GPU may thin out
    obj.updateMatrixWorld(true);
    const small = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere()).radius < 0.1;
    D.push({obj, home: obj.position.clone(), q0: obj.quaternion.clone(), dir, dist, spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: 1 + R() * 2.5, s: R() * 0.15, small, keep: true});
  };
  const centres = [
    [0.15, 0.06, 0],
    [-0.7, -0.15, 0],
    [0.8, 0.12, 0],
  ];
  const pick = () => centres[Math.floor(R() * centres.length)];
  // black balls, some with an orange band
  for (let k = 0; k < 40; k++) {
    const g = new THREE.Group();
    const r = 0.016 + R() * 0.032;
    put(g, new THREE.SphereGeometry(r, 20, 14), M.black);
    if (k % 8 === 0) put(g, new THREE.TorusGeometry(r * 1.02, r * 0.22, 8, 24), M.orange);
    addDebris(g, pick(), 0.25, 2.0, 5.6);
  }
  for (let k = 0; k < 22; k++) {
    const g = new THREE.Group();
    put(g, new THREE.SphereGeometry(0.012 + R() * 0.022, 16, 12), M.black);
    addDebris(g, pick(), 0.3, 0.5, 1.4);
  }
  // bolts: an orange barrel with a black cap, or a steel shank with a black head
  for (let k = 0; k < 12; k++) {
    const g = new THREE.Group();
    if (k % 3 === 0) {
      put(g, cylX(0.028, 0.028, 0.09, 20), M.orange);
      put(g, cylX(0.03, 0.03, 0.028, 20), M.black, -0.055, 0, 0);
    } else {
      put(g, cylX(0.013, 0.013, 0.08, 12), M.steel, 0.04, 0, 0);
      put(g, cylX(0.026, 0.026, 0.024, 6), M.black);
    }
    addDebris(g, pick(), 0.2, 1.6, 4.6);
  }
  // shell shards: white pieces, two with an orange skin
  for (let k = 0; k < 6; k++) {
    const g = new THREE.Group();
    const Rr = 0.32 + R() * 0.2;
    const p0 = 0.15 + R() * 0.3;
    const p1 = p0 + 0.35 + R() * 0.35;
    const a0 = R() * 6;
    const a1 = a0 + 0.6 + R() * 0.9;
    const sh = put(g, dome(Rr, 0.03, p0, p1, {a0, a1, segs: 24}), M.shell);
    sh.position.x = -Rr;
    if (k < 2) put(g, dome(Rr + 0.004, 0.014, p0 + (p1 - p0) * 0.2, p1 - 0.02, {a0: a0 + 0.03, a1: a1 - 0.03, segs: 20}), M.orange).position.x = -Rr;
    addDebris(g, pick(), 0.3, 1.4, 3.4);
  }
  // small gears and orange washers
  for (let k = 0; k < 10; k++) {
    const g = new THREE.Group();
    if (k % 2) {
      const ro = 0.05 + R() * 0.04;
      put(g, gearGeo(12 + Math.floor(R() * 8), ro, ro * 0.84, 0.022, ro * 0.3, 4), M.graphite);
    }
    else put(g, ringZ(-0.008, 0.008, 0.025, 0.05, 0.004), k % 4 ? M.graphite : M.orange);
    addDebris(g, pick(), 0.25, 1.4, 4.4);
  }
  // the chunky pieces: orange bars with black end caps, segments of the collar with their bolts, white blocks with
  // an orange face
  for (let k = 0; k < 5; k++) {
    const g = new THREE.Group();
    const L = 0.24 + R() * 0.12;
    put(g, rbox(L, 0.085, 0.1, 0.018), M.orange);
    for (const s of [-1, 1]) put(g, rbox(0.04, 0.092, 0.106, 0.012), M.black, (s * L) / 2, 0, 0);
    put(g, rbox(L * 0.5, 0.02, 0.06, 0.006), M.graphite, 0, 0.045, 0);
    put(g, cylZ(0.014, 0.014, 0.12, 12), M.steel, L * 0.2, 0, 0);
    addDebris(g, pick(), 0.3, 2.0, 3.6);
  }
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group();
    const a1 = 0.5 + R() * 0.25;
    put(g, ring(-0.055, 0.055, 0.25, 0.34, 0.014, {a0: 0, a1, segs: 16}), M.orange).position.y = -0.295;
    put(g, ring(-0.06, 0.06, 0.22, 0.252, 0.006, {a0: 0.04, a1: a1 - 0.04, segs: 16}), M.graphite).position.y = -0.295;
    put(g, cylX(0.014, 0.014, 0.024, 10), M.steel, 0.058, 0.0, 0.08);
    addDebris(g, pick(), 0.3, 1.8, 3.2);
  }
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group();
    put(g, rbox(0.12, 0.08, 0.1, 0.016), M.shell);
    put(g, rbox(0.124, 0.03, 0.104, 0.01), M.orange, 0, 0.032, 0);
    addDebris(g, pick(), 0.3, 1.2, 3.2);
  }
  // the big orange blocks of the reference: placed where they hang at the reference pose (explode 0.4), mostly above
  // the bee, clear of the eye's line to the camera; they come out of the thorax with the first stage of the explode
  {
    const K04 = Math.pow(ssw(0.4, 0, 0.95), 0.75);
    const SPOTS = [
      [-0.5, 1.32, 0.3],
      [0.45, 1.6, -0.3],
      [-1.3, 1.05, -0.25],
      [1.75, 0.95, -0.55],
      [-1.8, -0.1, 0.95],
      [-0.95, -0.9, 0.9],
      [0.2, 1.12, 0.8],
    ];
    for (const [tx, ty, tz] of SPOTS) {
      const g = new THREE.Group();
      const L = 0.32 + R() * 0.14;
      put(g, rbox(L, 0.11, 0.13, 0.024), M.orange);
      put(g, rbox(L * 0.4, 0.114, 0.05, 0.01), M.shell, -L * 0.12, 0, 0.044);
      for (const s of [-1, 1]) put(g, rbox(0.05, 0.12, 0.14, 0.016), M.black, (s * L) / 2, 0, 0);
      put(g, cylZ(0.016, 0.016, 0.16, 12), M.steel, L * 0.22, 0, 0);
      const home = new V3(0.1 + (R() - 0.5) * 0.3, 0.1, (R() - 0.5) * 0.2);
      const dir = new V3(tx, ty, tz).sub(home);
      const dist = dir.length() / K04;
      dir.normalize();
      g.position.copy(home);
      g.rotation.set(R() * 6.28, R() * 6.28, R() * 6.28);
      debris.add(g);
      D.push({obj: g, home: home.clone(), q0: g.quaternion.clone(), dir, dist, spin: new V3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), ang: 0.8 + R() * 1.2, s: 0});
    }
  }
  // a spare wing and a forewing tip that came off, face-on to the hero camera
  for (const [opt, at, dir, dist, s, lead] of [
    [{S: 1.85, C: 0.46, u0: 0, sleeve: true}, [-0.3, 0.44, 0.55], [-0.93, 0.0, 0.37], 2.9, [-0.92, 0.1, 0.38], [0.1, 1, 0]],
    [{S: 1.7, C: 0.44, u0: 0.62}, [0.2, 0.45, 0.1], [-0.25, 1, 0.1], 1.9, [0.35, -0.9, -0.2], [1, 0.2, 0]],
  ]) {
    const w = buildWing(opt, M, R, clear);
    const g = grp(debris, ...at);
    const o = grp(g);
    o.quaternion.copy(wingQuat(s, CAM_DIR, lead));
    o.add(w.group);
    w.group.position.x = opt.u0 ? -opt.S * (opt.u0 + (1 - opt.u0) / 2) : -opt.S * 0.55;
    D.push({obj: g, home: g.position.clone(), q0: g.quaternion.clone(), dir: new V3(...dir).normalize(), dist, spin: new V3(0.2, 1, 0.3).normalize(), ang: 0.5, s: 0.04});
  }

  // the wasp's waist and sting must read in the hero view: any loose part that hangs in front of them at the
  // reference pose (explode 0.4) slides sideways off the line of sight. Positions only, the random stream is untouched.
  {
    const cd = new V3(...CAM_DIR).normalize();
    root.updateMatrixWorld(true);
    const keepPts = [];
    for (let k = 0; k <= 8; k++) keepPts.push(waist.localToWorld(new V3((-WL - 0.1) * (k / 8), 0, 0)));
    for (let k = 0; k <= 6; k++) keepPts.push(abd.localToWorld(new V3(-LG - 0.7 * (k / 6), 0, 0)));
    for (const [x, y] of [[0, 0], [0.08, -0.18], [0.2, -0.34]]) keepPts.push(head.localToWorld(new V3(CHIN.x + x, CHIN.y + y, 0.12)));
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (const c of keepPts) c.applyMatrix4(inv);
    const K04 = (d) => Math.pow(ssw(0.4, d.s, 0.95), 0.75);
    for (const d of D) {
      for (let it = 0; it < 3; it++) {
        const p = d.home.clone().addScaledVector(d.dir, d.dist * K04(d));
        let moved = false;
        for (const c of keepPts) {
          const v = p.clone().sub(c);
          const along = v.dot(cd);
          if (along < -0.4) continue;
          const perp = v.addScaledVector(cd, -along);
          const l = perp.length();
          if (l < 0.26) {
            if (l < 1e-3) perp.set(0, 1, 0);
            d.home.addScaledVector(perp.normalize(), 0.3 - l);
            moved = true;
            break;
          }
        }
        if (!moved) break;
      }
      d.obj.position.copy(d.home);
    }
  }

  // ================================================================ pose
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  // blur: 1 draws a beating wing as the motion-blurred fan, 0 as the sharp wing (a high-speed camera). reach scales the
  // full explode's travel (the teardown layer and the loose parts) so a framed view can keep it all in shot; the
  // partial explode up to 0.45 never changes.
  // sub: {head, neck, thorax, wings, legs, abdomen} 0..1, one assembly coming apart on its own (its parts take the
  // larger of it and explode, travelling subReach of their far layer); eye: the near lens's teardown; wingOut and
  // wingFlip: the near forewing pulled out of its hinge and turned over (wingFlip 1 = one full turn); legK: the near
  // middle leg apart segment by segment; spinT: the clock the gears and the loose parts turn on (the caller speeds it).
  const CORE0 = M.stingCore.emissiveIntensity;
  const pose = ({explode = 0, flap = 0, flapAmp = 0, display = 1, t = 0, blur = 1, reach = 1, sub = {}, subReach = 0.75, eye = 0, wingOut = 0, wingFlip = 0, legK = 0, stingK = 0, spinT = t} = {}) => {
    const e = Math.min(1, Math.max(0, explode));
    const kFar = ssw(e, 0.45, 1.0);
    const loose = 1 + (reach - 1) * kFar;
    for (const it of X) {
      const s = sub[it.group] || 0;
      const ee = Math.max(e, s);
      const k = ssw(ee, it.s, it.f);
      const fr = ssw(ee, 0.45, 1.0) * (s > e ? subReach : reach);
      it.obj.position.copy(it.home).addScaledVector(it.dir, it.dist * k).addScaledVector(it.far, fr);
      if (it.spin || it.rate) {
        it.obj.quaternion.copy(it.q0);
        if (it.spin) it.obj.quaternion.multiply(q.setFromAxisAngle(it.spin.axis, it.spin.ang * k));
        if (it.rate) it.obj.quaternion.multiply(q.setFromAxisAngle(it.raxis, it.rate * spinT));
      }
    }
    neckGear.rotation.x = -0.4 * spinT;
    // the lens: rings out along the optical axis, unscrewing; the blades open
    for (const p of eyeRig) {
      p.o.position.copy(p.home);
      p.o.position.x += p.off * 0.72 * eye;
      p.o.quaternion.copy(p.q0);
      if (p.blade) {
        p.o.position.y *= 1 + 0.55 * eye;
        p.o.position.z *= 1 + 0.55 * eye;
        p.o.quaternion.multiply(q.setFromAxisAngle(AX, 1.1 * eye + 0.25 * eye * Math.sin(spinT * 2)));
      } else if (p.spin) p.o.quaternion.multiply(q.setFromAxisAngle(AX, p.spin * eye * (1 + 0.35 * spinT)));
    }
    for (const d of D) {
      const k = Math.pow(ssw(e, d.s, 0.95), 0.75);
      d.obj.position.copy(d.home).addScaledVector(d.dir, d.dist * k * loose);
      d.obj.quaternion.copy(d.q0).multiply(q.setFromAxisAngle(d.spin, d.ang * k + 0.9 * spinT * kFar));
      const sc = ssw(e, d.s * 0.5, d.s * 0.5 + 0.08);
      d.obj.scale.setScalar(Math.max(1e-4, sc));
      d.obj.visible = sc > 0.001 && d.keep !== false;
    }
    const dk = smoother(display);
    // the fan's weight: 0 at rest (the solid wing alone), 1 in full beat (the fan alone)
    const gk = ssw(flapAmp, 3, 14) * blur;
    // the film carries the fan's body; thin, hard parts (rim, veins, the orange tips) only streak faintly, brightest
    // where the copies bunch up at the ends of the stroke, as in a long exposure
    for (const m of ghostMats.values()) m.opacity = Math.min(1, (m.userData.base * gk * (m.userData.base < 0.5 ? 6.0 : 1.35) * fanStep) / NG);
    for (const m of solidMats.values()) {
      const fade = 1 - gk;
      const tr = fade < 0.999 || m.userData.transparent;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.opacity = m.userData.base * fade;
    }
    // one wing pose: its rest blend, the stroke about the body axis, the twist about its own span
    const wingAt = (out, w, ph) => {
      out.slerpQuaternions(w.qF, w.qD, dk);
      out.premultiply(q.setFromAxisAngle(AX, -flapAmp * Math.sin(ph) * D2R));
      out.multiply(q2.setFromAxisAngle(AX, flapAmp * 0.4 * Math.cos(ph) * D2R));
    };
    for (const w of wings) {
      const ph = flap + (w.fore ? 0 : 0.7);
      wingAt(w.orient.quaternion, w, ph);
      // the near forewing's detach: out of the hinge and towards the viewer, turned over about its span
      const near = w === wings[0];
      const o = near ? wingOut : 0;
      const f = near ? wingFlip : 0;
      w.det.position.set(w.C.x + 0.9 * o, w.C.y - 0.1 * o, w.C.z + 0.8 * o);
      w.det.rotation.set(Math.PI * 2 * f, 0.3 * Math.sin(Math.PI * f), 0.35 * o);
      w.solid.visible = gk < 0.999;
      w.ghosts.forEach((og, i) => {
        og.visible = gk > 0.001 && i % fanStep === 0;
        if (og.visible) wingAt(og.quaternion, w, ph + (i / NG) * Math.PI * 2);
      });
    }
    for (const L of legs) {
      const k2 = L.side === 0 && L.idx === 1 ? legK : 0;
      L.pose(e, spinT, k2);
      if (k2) {
        L.mount.position.z += 0.32 * k2;
        L.mount.position.y -= 0.08 * k2;
      }
    }
    // the antennae sway a little, always
    antennae.forEach((a, i) => (a.rotation.x = 0.04 * Math.sin(t * 1.7 + i)));
    // the sting out of its collar, the core brighter while it is out
    sting.position.x = STING_X - 0.34 * stingK;
    M.stingCore.emissiveIntensity = CORE0 * (1 + 1.6 * stingK);
  };
  pose({});

  // the live page's bake: every static mesh merged per material into the nearest node that moves, so a frame issues a
  // few hundred draws instead of thousands. The nodes that move (explode items, loose parts, the lens rings, the wing
  // and leg rigs, the turning gears, the antennae) keep their own; a mirrored side's meshes get their winding back.
  if (bake) {
    const moving = new Set([root, neckGear, ...X.map((i) => i.obj), ...D.map((d) => d.obj), ...eyeRig.map((p) => p.o), ...antennae]);
    for (const w of wings) for (const o of [w.hinge, w.orient, w.det, w.solid, ...w.ghosts]) moving.add(o);
    for (const L of legs) for (const o of [L.mount, ...L.anim]) moving.add(o);
    const flip = (g) => {
      for (const name of ['position', 'normal']) {
        const a = g.attributes[name].array;
        for (let i = 0; i < a.length; i += 9) {
          for (let k = 0; k < 3; k++) {
            const v = a[i + 3 + k];
            a[i + 3 + k] = a[i + 6 + k];
            a[i + 6 + k] = v;
          }
        }
      }
    };
    const bakeInto = (node) => {
      const buckets = new Map();
      const walk = (o, m) => {
        for (const c of [...o.children]) {
          if (moving.has(c) || c.isInstancedMesh) {
            bakeInto(c);
            continue;
          }
          c.updateMatrix();
          const mc = m.clone().multiply(c.matrix);
          if (c.isMesh) {
            const key = `${c.material.uuid}|${c.renderOrder}|${c.castShadow}`;
            if (!buckets.has(key)) buckets.set(key, {mat: c.material, ro: c.renderOrder, cast: c.castShadow, geos: []});
            const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
            g.applyMatrix4(mc);
            if (mc.determinant() < 0) flip(g);
            buckets.get(key).geos.push(g);
          }
          walk(c, mc);
          if (c.isMesh || c.children.length === 0) o.remove(c);
        }
      };
      walk(node, new THREE.Matrix4());
      for (const b of buckets.values()) {
        const m = new THREE.Mesh(merge(b.geos), b.mat);
        m.renderOrder = b.ro;
        m.castShadow = b.cast;
        m.receiveShadow = true;
        node.add(m);
      }
    };
    bakeInto(root);
    clear.length = 0;
  }

  root.traverse((o) => {
    if (o.isMesh && o.material && (o.material.transparent || o.material.transmission > 0)) {
      o.castShadow = false;
      if (!clear.includes(o)) clear.push(o);
    }
  });
  // x-ray: the white shells turn to a faint glass so the mechanism shows through; k 0..1
  const shellMats = [M.shell, M.shellIn];
  const shellMeshes = [];
  root.traverse((o) => {
    if (o.isMesh && shellMats.includes(o.material)) shellMeshes.push(o);
  });
  const setXray = (k) => {
    for (const m of shellMats) {
      const tr = k > 0.001;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.opacity = 1 - 0.8 * k;
      m.depthWrite = k < 0.5;
    }
  };
  // cheap glass for weak GPUs: the two transmission materials (the lens dome, the abdomen capsule) become plain
  // transparent ones, so the frame skips the extra pass transmission renders
  const glassFull = {glass: M.glass.clone(), lensGlass: M.lensGlass.clone()};
  const setCheapGlass = (on) => {
    for (const [k, m] of [['glass', M.glass], ['lensGlass', M.lensGlass]]) {
      const full = glassFull[k];
      m.transmission = on ? 0 : full.transmission;
      m.transparent = on;
      m.opacity = on ? (k === 'glass' ? 0.22 : 0.55) : 1;
      m.color.set(on && k === 'lensGlass' ? '#101114' : full.color);
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  };
  const setFanStep = (n) => {
    fanStep = Math.max(1, n | 0);
  };
  // keep: the share of the small loose parts that show (1 = all of them)
  const setDebrisKeep = (keep) => {
    D.forEach((d, i) => {
      if (d.small) d.keep = ((i * 0.6180339) % 1) < keep;
    });
  };
  // cheap shading for weak GPUs: the clear coat and the iridescence off every physical material (each is a second
  // specular lobe per pixel); the look keeps its colours and gloss
  const physical = new Set();
  root.traverse((o) => {
    if (o.isMesh && o.material?.isMeshPhysicalMaterial) physical.add(o.material);
  });
  const physFull = new Map([...physical].map((m) => [m, {clearcoat: m.clearcoat, iridescence: m.iridescence}]));
  let cheapShade = false;
  const setCheapShading = (on) => {
    if (on === cheapShade) return;
    cheapShade = on;
    for (const [m, f] of physFull) {
      m.clearcoat = on ? 0 : f.clearcoat;
      m.iridescence = on ? 0 : f.iridescence;
      if (on && m.roughness > 0.25) m.roughness = Math.max(0.22, m.roughness - 0.08);
      else if (!on) m.roughness = m.userData.rough0 ?? m.roughness;
      m.needsUpdate = true;
    }
  };
  for (const m of physical) m.userData.rough0 = m.roughness;
  return {root, pose, clear, M, H, anchors, setXray, shellMeshes, legs, setCheapGlass, setFanStep, setCheapShading, setDebrisKeep};
}

// ---------------------------------------------------------------- a wing
// opts: S span, C chord, sleeve (an orange sleeve on the leading spar), u0 (start of a detached panel, 0 = whole wing)
// Wing frame: span along +x, leading edge toward +y, membrane normal +z; the root rod runs from the origin to x0.
function buildWing({S, C, sleeve = false, u0 = 0}, M, R, clear) {
  const g = new THREE.Group();
  const x0 = u0 > 0 ? 0 : 0.3;
  // the outline: a leading edge that runs nearly straight and curves down over the last 28% of the span; a trailing
  // edge that swells to the full chord at 62% and closes on the leading edge in an ellipse, so the tip is round
  const leb = (u) => C * 0.1 * Math.sin(Math.PI * u * 0.85);
  const ell = (k) => Math.sqrt(Math.max(0, 1 - k * k));
  const le = (u) => leb(u) - C * 0.4 * (1 - ell(Math.max(0, (u - 0.72) / 0.28)));
  const te = (u) => (u <= 0.62 ? leb(u) - C * (0.16 + 0.84 * Math.pow(Math.sin(((u / 0.62) * Math.PI) / 2), 1.3)) : leb(u) - C * (0.4 + 0.6 * ell((u - 0.62) / 0.38)));
  const w = (u) => Math.max(0, le(u) - te(u));
  const surf = (u, s, lift = 0) => {
    const ww = w(u);
    return new V3(x0 + u * S, le(u) - s * ww, C * 0.045 * Math.sin(Math.PI * s) * Math.min(1, u * 4) + lift);
  };
  const U0 = u0;
  // ---- membrane: a cambered grid; the orange tip on the same surface
  const grid = (ua, ub, sMax, nu, nv) => {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= nu; i++) {
      const u = ua + ((ub - ua) * i) / nu;
      const sm = sMax(u);
      for (let j = 0; j <= nv; j++) {
        const p = surf(Math.min(u, 0.9995), (j / nv) * sm);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j;
        idx.push(a, a + nv + 1, a + 1, a + 1, a + nv + 1, a + nv + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const mem = new THREE.Mesh(grid(U0, 1, () => 1, 90, 18), M.membrane);
  mem.renderOrder = 2;
  g.add(mem);
  clear.push(mem);
  // the tip: an orange crescent along the outline, widest at the tip, offset inward in the wing plane
  {
    const path = [];
    for (let i = 0; i <= 44; i++) path.push(surf(0.8 + (0.1995 * i) / 44, 0));
    for (let i = 26; i >= 0; i--) path.push(surf(0.9 + (0.0995 * i) / 26, 1));
    const pos = [];
    const idx = [];
    const n = path.length;
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      const f = i / (n - 1);
      const wd = C * 0.075 * Math.pow(Math.sin(Math.PI * f), 0.6);
      const p = path[i];
      pos.push(p.x, p.y, p.z, p.x + (ty / l) * wd, p.y - (tx / l) * wd, p.z);
      if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    put(g, geo, M.orangeFilm);
  }

  // ---- the rim round the outline, orange and thicker round the tip
  const N = 120;
  const outline = [];
  for (let i = 0; i <= N; i++) outline.push(surf(U0 + ((1 - U0) * i) / N, 0));
  for (let i = N; i >= 0; i--) outline.push(surf(U0 + ((1 - U0) * i) / N, 1));
  if (u0 > 0) outline.push(surf(U0, 0.5), surf(U0, 0.02));
  const rimR = S * 0.0032;
  const rimCurve = new THREE.CatmullRomCurve3(outline, false, 'centripetal');
  g.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve, 420, rimR, 8, false), M.rim));
  put(g, new THREE.TubeGeometry(rimCurve, 420, rimR * 0.34, 5, false), M.veinCore).castShadow = false;
  {
    const tipPts = [];
    for (let i = 0; i <= 30; i++) tipPts.push(surf(0.84 + (0.16 * i) / 30, 0));
    for (let i = 30; i >= 0; i--) tipPts.push(surf(0.93 + (0.07 * i) / 30, 1));
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tipPts, false, 'centripetal'), 160, rimR * 1.9, 10, false), M.orange);
  }
  // the leading spar from the root, tapering; an orange sleeve on the hindwing
  if (u0 === 0) {
    const sp = [];
    for (let i = 0; i <= 20; i++) sp.push(surf((0.62 * i) / 20, 0.015, 0.003));
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 80, S * 0.0068, 10, false), M.rim);
    const core = [];
    for (let i = 0; i <= 12; i++) core.push(surf((0.4 * i) / 12, 0.02, 0.004));
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(core), 40, S * 0.0048, 8, false), M.black);
    if (sleeve) {
      const sl = [];
      for (let i = 0; i <= 12; i++) sl.push(surf(0.08 + (0.34 * i) / 12, 0.015, 0.003));
      put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sl), 40, S * 0.0088, 12, false), M.orange);
    }
  }

  // ---- veins: longitudinal ones fanning out from the root and curving onto the trailing edge, forks, cross veins
  const K = 7;
  const veinPts = [];
  const longi = [];
  for (let k = 0; k < K; k++) {
    const sk = 0.07 + (k / (K - 1)) * 0.82;
    const uEnd = k < 2 ? 0.97 : 0.97 - (k - 1) * 0.055;
    const uBend = uEnd - 0.32;
    const ph = R() * 6;
    const sAt = (u) => {
      let s = 0.12 + 0.5 * (k / K) + (sk - 0.12 - 0.5 * (k / K)) * smoother(u / 0.35);
      s += 0.014 * Math.sin(u * 13 + ph) + 0.006 * Math.sin(u * 31 + ph * 2);
      if (u > uBend) s += (1 - s) * Math.pow((u - uBend) / (uEnd - uBend), 2.2);
      return Math.min(0.995, Math.max(0.01, s));
    };
    longi.push({sAt, uEnd});
    const pts = [];
    for (let u = Math.max(0.02, U0); u <= uEnd + 1e-6; u += 0.02) pts.push(surf(u, sAt(u)));
    if (pts.length > 2) veinPts.push([pts, S * 0.00105]);
  }
  for (const k of [2, 4]) {
    const uf = 0.42 + R() * 0.12;
    const {sAt, uEnd} = longi[k];
    const pts = [];
    for (let u = uf; u <= Math.min(0.97, uEnd + 0.04); u += 0.02) {
      const f = (u - uf) / (uEnd + 0.04 - uf);
      pts.push(surf(u, Math.min(0.995, sAt(u) + 0.12 * Math.sqrt(Math.max(0, f)))));
    }
    if (uf > U0 && pts.length > 2) veinPts.push([pts, S * 0.00095]);
  }
  // cross veins between neighbours, and from the first vein to the leading edge, bowed and uneven
  const lanes = [{sAt: () => 0.0, uEnd: 1}, ...longi];
  const joints = [];
  for (let k = 0; k < lanes.length - 1; k++) {
    const a = lanes[k];
    const b = lanes[k + 1];
    const uMax = Math.min(a.uEnd, b.uEnd) - 0.03;
    let u = Math.max(0.1, U0 + 0.02) + R() * 0.06;
    while (u < uMax) {
      const sa = a.sAt(u);
      const du = (R() - 0.5) * 0.03;
      const sb = b.sAt(u + du);
      veinPts.push([[surf(u, sa), surf(u + du * 0.5 + (R() - 0.5) * 0.012, (sa + sb) / 2), surf(u + du, sb)], S * 0.0006]);
      if (R() < 0.55) joints.push(surf(u, sa));
      if (R() < 0.35) joints.push(surf(u + du, sb));
      // now and then a short intercalary vein runs along the lane from this cross vein
      if (R() < 0.3 && u > 0.3) {
        const pts = [];
        for (let k2 = 0; k2 <= 4; k2++) {
          const uu = u + du * 0.5 + k2 * 0.02;
          pts.push(surf(uu, a.sAt(uu) * 0.5 + b.sAt(uu) * 0.5 + 0.01 * Math.sin(k2 + u * 20)));
        }
        veinPts.push([pts, S * 0.0006]);
      }
      u += 0.035 + R() * 0.05 - (u > 0.6 ? 0.008 : 0);
    }
  }
  const veins = put(g, merge(veinPts.map(([pts, r]) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 3), r, 5, false))), M.vein);
  veins.castShadow = false;
  veins.renderOrder = 3;
  // small dark dots where cross veins meet the long ones
  if (joints.length) {
    const dot = new THREE.SphereGeometry(S * 0.0021, 8, 6);
    instances(g, dot, M.veinCore, joints.map((p) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))).castShadow = false;
  }

  // ---- black clips along the leading and trailing edges
  {
    const mats = [];
    const place = (u, s) => {
      const p = surf(u, s);
      const p2 = surf(u + 0.004, s);
      const qq = new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), p2.sub(p).normalize());
      mats.push(new THREE.Matrix4().compose(p, qq, new V3(1, 1, 1)));
    };
    for (const u of [0.14, 0.27, 0.4, 0.52, 0.64, 0.74]) if (u > U0 + 0.02) place(u, 0);
    for (const u of [0.3, 0.55, 0.78]) if (u > U0 + 0.02) place(u, 1);
    if (mats.length) instances(g, rbox(S * 0.03, S * 0.01, S * 0.01, S * 0.0035), M.black, mats);
  }

  // ---- the root: a black rod from the hinge, an orange clamp, a graphite plate where the veins meet
  if (u0 === 0) {
    const ry = le(0) - w(0) * 0.4;
    for (const m of [
      put(g, cylX(0.028, 0.022, x0 + 0.02, 20), M.black, (x0 + 0.02) / 2, ry * 0.5, 0),
      put(g, rbox(0.1, 0.075, 0.07, 0.014), M.orange, x0 * 0.6, ry * 0.45, 0),
      put(g, rbox(0.022, 0.085, 0.078, 0.006), M.black, x0 * 0.6 + 0.05, ry * 0.45, 0),
      put(g, cylX(0.04, 0.04, 0.03, 20), M.graphite, x0 * 0.25, ry * 0.2, 0),
      put(g, rbox(0.07, w(0) * 1.1, 0.03, 0.01), M.graphite, x0 + 0.02, le(0) - w(0) * 0.45, 0.004),
    ])
      m.userData.small = true;
  }
  return {group: g};
}

// ---------------------------------------------------------------- a leg
// L: {yaw, splay, a: [femur, tibia, tarsus] degrees, Lf, Lt}. Built for the right side, segments hang along -y;
// the joints turn about z (the wheel axes). pose(e) opens a gap at every joint as the bee comes apart.
function buildLeg(L, M) {
  const mount = new THREE.Group();
  const yaw = new THREE.Group();
  yaw.rotation.y = L.yaw * D2R;
  mount.add(yaw);
  const spl = new THREE.Group();
  spl.rotation.x = -L.splay * D2R;
  yaw.add(spl);
  // a joint wheel: black drum, an accent ring on each face (orange on the outer face of the hip and knee only), a
  // graphite hub and a steel pin
  const wheel = (parent, r, wd, y = 0, accent = false) => {
    const g = new THREE.Group();
    g.position.y = y;
    parent.add(g);
    put(g, ringZ(-wd / 2, wd / 2, 0, r, r * 0.3), M.black);
    for (const s of [-1, 1]) {
      const a = s * (wd / 2 - 0.004);
      const b = a + s * 0.012;
      put(g, ringZ(Math.min(a, b), Math.max(a, b), r * 0.58, r * 0.84, 0.004), accent && s > 0 ? M.orange : M.graphite);
      const c = s * wd * 0.5;
      const d = c + s * 0.016;
      put(g, ringZ(Math.min(c, d), Math.max(c, d), 0, r * 0.44, 0.006), M.graphite);
    }
    put(g, cylZ(r * 0.15, r * 0.15, wd + 0.056, 14), M.steel);
    return g;
  };
  const along = (geo) => geo.rotateZ(-Math.PI / 2);
  // coxa: a big wheel on the sternum
  const hipW = wheel(spl, 0.08, 0.1, 0, true);
  // femur: a black servo barrel with a servo box on its side, graphite bands, a piston alongside
  const fem = new THREE.Group();
  fem.rotation.z = L.a[0] * D2R;
  spl.add(fem);
  const femBody = new THREE.Group();
  fem.add(femBody);
  put(femBody, along(solid(0, L.Lf, capsuleR(0.054, 0.046, 0.18), {}, 32)), M.black, 0, -0.05, 0);
  for (const f of [0.3, 0.62]) put(femBody, along(ring(L.Lf * f, L.Lf * f + 0.02, 0.048, 0.06, 0.004)), M.graphite, 0, -0.05, 0);
  put(femBody, rbox(0.04, L.Lf * 0.32, 0.05, 0.01), M.black, 0.042, -0.05 - L.Lf * 0.45, 0.024);
  put(femBody, rbox(0.044, 0.018, 0.054, 0.006), M.gunmetal, 0.042, -0.05 - L.Lf * 0.3, 0.024);
  put(femBody, along(cylX(0.012, 0.012, L.Lf * 0.62, 12)), M.steel, -0.062, -0.05 - L.Lf * 0.5, 0);
  put(femBody, along(cylX(0.02, 0.02, L.Lf * 0.3, 12)), M.graphite, -0.062, -0.05 - L.Lf * 0.28, 0);
  for (const f of [0.22, 0.78]) put(femBody, rbox(0.026, 0.022, 0.026, 0.007), M.graphite, -0.054, -0.05 - L.Lf * f, 0);
  // knee and tibia: a long white shell, a black rod beside it, an orange collar near the ankle
  const tib = new THREE.Group();
  tib.rotation.z = L.a[1] * D2R;
  fem.add(tib);
  const kneeW = wheel(tib, 0.07, 0.11, 0, true);
  // a black link the full length, a long slim white shell over most of it
  put(tib, along(solid(0, L.Lt, capsuleR(0.028, 0.024, 0.08), {}, 24)), M.black, 0, -0.06, 0);
  put(tib, along(solid(L.Lt * 0.1, L.Lt * 0.9, capsuleR(0.042, 0.03, 0.09), {}, 40)), M.shell, 0, -0.06, 0);
  put(tib, along(cylX(0.01, 0.01, L.Lt * 0.72, 12)), M.black, 0.038, -0.06 - L.Lt * 0.46, 0);
  for (const f of [0.16, 0.78]) put(tib, rbox(0.024, 0.02, 0.022, 0.006), M.graphite, 0.034, -0.06 - L.Lt * f, 0);
  put(tib, along(ring(L.Lt * 0.92, L.Lt * 0.97, 0.022, 0.034, 0.004)), M.gunmetal, 0, -0.06, 0);
  put(tib, rbox(0.012, L.Lt * 0.4, 0.01, 0.004), M.graphite, -0.036, -0.06 - L.Lt * 0.5, 0.026);
  // black spikes down the back of the shin, two longer spurs at the ankle
  const spike = (parent, len, x, y, ang) => {
    const m = put(parent, new THREE.ConeGeometry(0.015, len, 10).translate(0, len / 2, 0), M.black, x, y, 0);
    m.rotation.z = ang;
    return m;
  };
  for (const f of [0.26, 0.4, 0.54, 0.68, 0.82]) spike(tib, 0.095, -0.036, -0.06 - L.Lt * f, 2.2);
  for (const z of [-0.02, 0.02]) spike(tib, 0.1, -0.02, -0.06 - L.Lt * 0.95, 2.6).position.z = z;
  // ankle and tarsus: a black link with an orange collar, a foot wheel and a claw
  const tar = new THREE.Group();
  tar.rotation.z = L.a[2] * D2R;
  tib.add(tar);
  const ankleW = wheel(tar, 0.052, 0.08, 0, true);
  put(tar, along(solid(0, L.Lr, capsuleR(0.03, 0.025, 0.2), {}, 16)), M.black, 0, -0.04, 0);
  put(tar, along(ring(L.Lr * 0.45, L.Lr * 0.6, 0.024, 0.036, 0.004)), M.gunmetal, 0, -0.04, 0);
  const foot = wheel(tar, 0.058, 0.064, -0.08 - L.Lr);
  // the claw: two curved orange hooks with sharp tips; spikes on the foot segment
  for (const z of [-0.022, 0.022]) {
    put(foot, tube([[0, -0.03, z], [0.03, -0.09, z], [0.075, -0.12, z * 1.4], [0.11, -0.115, z * 1.6]], 0.012, 16, 8), M.orange);
    const tipc = put(foot, new THREE.ConeGeometry(0.012, 0.05, 10).rotateZ(-Math.PI / 2), M.orange, 0.13, -0.11, z * 1.6);
    tipc.rotation.z = 0.25;
  }
  for (const f of [0.35, 0.75]) spike(tar, 0.05, -0.028, -0.04 - L.Lr * f, 2.3);
  const gap = 0.24;
  return {
    mount,
    tib,
    foot,
    // the leg's nodes that move, kept apart by the live page's bake
    anim: [femBody, tib, tar, foot, hipW, kneeW, ankleW],
    // k2: this leg alone apart, the femur shell, the shin, the ankle and the foot in turn, every servo wheel spinning
    pose(e, spinT = 0, k2 = 0) {
      const k = ssw(e, 0.45, 1.0);
      const a = ssw(k2, 0.0, 0.45);
      const b = ssw(k2, 0.18, 0.65);
      const c = ssw(k2, 0.36, 0.85);
      const d = ssw(k2, 0.52, 1.0);
      femBody.position.y = -gap * 0.5 * k - 0.16 * a;
      tib.position.y = -(L.Lf + 0.05) - gap * k - 0.3 * b;
      tar.position.y = -(L.Lt + 0.07) - gap * k - 0.3 * c;
      foot.position.y = -0.08 - L.Lr - 0.22 * d;
      const sp = 7 * spinT;
      hipW.rotation.z = sp * a;
      kneeW.rotation.z = -1.3 * sp * b;
      ankleW.rotation.z = 1.6 * sp * c;
      foot.rotation.z = -2 * sp * d;
    },
  };
}
