// The robotic piranha, built from code after its reference render,
// on the approved anglerfish's assembly (roboangler-shared/angler.js) so the angler's film ports 1:1.
// A deep body, the head and the gaping jaws about 40% of the length. The skull is a boxy super-ellipsoid cut above a
// plane tilted up through the hinge, the lower jaw a deeper scoop below a plane, hung on the hinge and dropped 34°, so
// the mouth gapes 60°. Both are a dark lining under separate riveted white plates with gaps, the kitbash in every gap;
// a crest of short spikes on top, a thick angry brow over a black camera eye ringed in dark rings and a thin glow
// ring. Both rims carry two rows of curved glass fangs with glowing tips; inside, a ribbed throat lit from within.
// Behind the head: a clear glass barrel on white rib bands over a packed machine (gears of four sizes, glowing coils,
// pipes, a shaft, the bee's kitbash), a segmented tail stalk of white collars over dark joints with thin glow rings,
// the forked tail fan, a tall spiny dorsal sail, a pectoral fan on a pivot hub and small ventral and anal fins.
// Authored in the angler's orange; the green look (../green/look.js) turns it in the sim.
// Body frame: +x forward (the mouth), y up, +z the fish's right, the near side in the hero view. Paired parts are
// built once and mirrored (scale.z = -1). The five teardown slots are named groups (slots.OPTICS = the near eye,
// WING = the near pectoral on its hub, LEG = the tail stalk, THORAX = the glass flank, ABDOMEN = the lower jaw);
// pose({...}) takes the angler's parameters (lure = the stalk telescoping, cage = the tail fan spreading, flare = the
// coils, rib = the flank opening) as a pure function of time.
import * as THREE from 'three';
import {rng} from '../kit/util.js';
import {aimX, coil, cylX, cylZ, D2R, gearGeo, gearX, instances, makeMaterials, merge, plate, put, rbox, ring, solid, sweepX, taperTube, tube, V3} from './parts.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ssw = (x, a, b) => smoother((x - a) / (b - a));
const deg = (a) => a * D2R;

// the floor sits close under the fish, so the still's soft shadow lands in frame (round 3)
export const FLOOR_Y = -1.28;
// the mouth: the hinge line (along z), the upper jaw's cut above level and the lower jaw's drop below it, degrees.
// Round 3: a short, tall gape (the opening at the front about as tall as the jaws are long), never a long low one.
export const HINGE = new V3(0.35, -0.03, 0);
export const GAPE_UP = 29;
export const GAPE_LO = 36;
// the barrel: its axis height, its lateral squash, its half height along x (the head end to the tail stalk)
const AXIS_Y = 0.1;
const SQZ = 0.7;
// round 3: deeper, the back humping up behind the head
export const RB = (x) => 0.3 + 0.6 * Math.pow(Math.sin((clamp((x + 1.42) / 1.36, 0, 1) * Math.PI) / 2), 1.25);
// the skull's and the jaw's super-ellipsoids (the jaw's in its own frame, origin at the hinge)
const CU = new V3(0.42, 0.12, 0);
const CL = new V3(0.55, 0.0, 0);
const sm = (x) => smoother(x);
// the skull: its top, the bottom of its section (cut away below the jaw plane), its half width, the rounding of the
// snout's front
// Round 3: the head a third shorter, the front blunt (a squared super-ellipse cap over the last 0.2), the top humped
// high at the back of the skull and falling to the snout along the upper jaw's tilt.
const XSN = 1.07;
const kfU = (x) => Math.pow(Math.max(0, 1 - Math.pow(clamp((x - (XSN - 0.22)) / 0.22, 0, 1), 3.2)), 1 / 3.2);
const topU = (x) => 1.03 - 0.3 * sm((x - 0.22) / 0.86);
const botU = (x) => -0.64 + 0.74 * sm((x - 0.1) / 0.95);
const cyU = (x) => (topU(x) + botU(x)) / 2;
const ryU = (x) => ((topU(x) - botU(x)) / 2) * kfU(x);
const rzU = (x) => (0.62 - 0.18 * sm((x - 0.4) / 0.65)) * kfU(x);
// the jaw (its own frame, the rim plane at y = 0): its depth below the rim, a section centred 0.2 above it, the chin
// squared off; the front a little wider than the upper jaw's and, dropped, a little ahead of it (the underbite)
const XJF = 1.0;
const kfL = (x) => Math.pow(Math.max(0, 1 - Math.pow(clamp((x - (XJF - 0.2)) / 0.2, 0, 1), 3.2)), 1 / 3.2);
const dL = (x) => 0.26 + 0.28 * sm((x + 0.3) / 0.6) - 0.05 * sm((x - 0.6) / 0.35);
const cyL = () => 0.2;
const ryL = (x) => (dL(x) + 0.2) * kfL(x);
const rzL = (x) => (0.6 - 0.05 * sm((x - 0.3) / 0.6)) * kfL(x);

// A section swept along x: at each x a super-ellipse (squareness n) centred at height cy(x), half height ry(x), half
// width rz(x), walked by the angle from +y (up) or from -y (a jaw's floor), 90 deg at +z. at(x, aMax, s): the angle at
// the arc-length fraction s of the way from the pole to aMax, so rows of plates keep even widths over the flat top and
// down the flat side alike.
function sweepSec(cy, ry, rz, n, up = true) {
  const e = 2 / n;
  const sy = up ? 1 : -1;
  const pw = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const P = (x, ang) => new V3(x, cy(x) + sy * ry(x) * pw(Math.cos(ang)), rz(x) * pw(Math.sin(ang)));
  const N = (x, ang) => {
    const h = 1e-4;
    const dx = P(x + h, ang).sub(P(x - h, ang));
    const da = P(x, ang + h).sub(P(x, ang - h));
    const nn = new V3().crossVectors(dx, da);
    const p = P(x, ang);
    const out = new V3(0, p.y - cy(x), p.z);
    if (nn.lengthSq() < 1e-14) return out.normalize();
    nn.normalize();
    if (nn.dot(out) < 0) nn.negate();
    return nn;
  };
  // the angle (from the pole) where the section at x crosses the height y
  const angAt = (x, y) => {
    const kk = (sy * (y - cy(x))) / Math.max(1e-6, ry(x));
    if (kk >= 1) return 0;
    if (kk <= -1) return Math.PI;
    return Math.acos(Math.sign(kk) * Math.pow(Math.abs(kk), n / 2));
  };
  const NA = 40;
  const at = (x, aMax, s) => {
    const r1 = ry(x);
    const r2 = rz(x);
    let acc = 0;
    const L = [0];
    let py = sy * r1;
    let pz = 0;
    for (let i = 1; i <= NA; i++) {
      const g = (aMax * i) / NA;
      const yy = sy * r1 * pw(Math.cos(g));
      const zz = r2 * pw(Math.sin(g));
      acc += Math.hypot(yy - py, zz - pz);
      L.push(acc);
      py = yy;
      pz = zz;
    }
    const tgt = Math.min(1, Math.abs(s)) * acc;
    let i = 1;
    while (i < NA && L[i] < tgt) i++;
    const f = (tgt - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]);
    const ang = (aMax * (i - 1 + f)) / NA;
    const over = Math.abs(s) > 1 ? (Math.abs(s) - 1) * aMax : 0;
    return Math.sign(s) * (ang + over);
  };
  return {P, N, angAt, at};
}
const bisect = (ok, lo, hi) => {
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    if (ok(m)) lo = m;
    else hi = m;
  }
  return lo;
};

export function buildPiranha({seed = 41} = {}) {
  const M = makeMaterials();
  // the fangs: clear glass, the vertex colour warm at the root to white
  M.tooth = new THREE.MeshPhysicalMaterial({color: '#f4f3f1', vertexColors: true, roughness: 0.1, metalness: 0.3, transmission: 0.12, thickness: 0.26, ior: 1.52, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 3.2, attenuationColor: '#e6e0da', attenuationDistance: 0.5});
  M.toothTip = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ff8a34', emissiveIntensity: 2.6});
  // the fin film, a touch denser than the bee's so it reads on the pale studio, and its glowing edge band (the vertex
  // alpha fades it in toward the rim)
  M.fin = M.membrane.clone();
  M.fin.opacity = 0.72;
  M.fin.color.set('#e8eaec');
  M.finEdge = new THREE.MeshPhysicalMaterial({color: '#ffffff', vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: '#ff6a1c', emissiveIntensity: 0.75, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1});
  M.finVein = new THREE.MeshStandardMaterial({color: '#7a8087', roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.5});
  M.glow = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ff6418', emissiveIntensity: 2.4});
  M.coil = new THREE.MeshStandardMaterial({color: '#140a04', emissive: '#ff7420', emissiveIntensity: 3.2, roughness: 0.4});
  M.bezel = new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ff8a30', emissiveIntensity: 5.5});
  M.lining = new THREE.MeshStandardMaterial({color: '#0b0c0e', roughness: 0.6, metalness: 0.25, envMapIntensity: 0.35});
  // the flank's clear barrel: real transmission, so the machine behind it reads crisp under the studio's highlights
  M.flank = new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.06, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.15});
  // the glass's specular band and its rim catch: unlit white, faded, drawn over the barrel
  M.glint = new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false});
  M.glintSoft = new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.26, depthWrite: false});
  const R = rng(seed);
  // the film's extra parts draw from their own stream, so the still's geometry never moves
  const R2 = rng(seed + 977);
  const root = new THREE.Group();
  const clear = [];
  const anchors = {};
  const anchor = (key, obj, x, y, z) => {
    if (!anchors[key]) anchors[key] = {obj, at: new V3(x, y, z)};
  };
  const grp = (parent, x = 0, y = 0, z = 0, name = '') => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (name) g.name = name;
    parent.add(g);
    return g;
  };
  const mirror = (parent) =>
    [1, -1].map((s) => {
      const g = new THREE.Group();
      g.scale.z = s;
      parent.add(g);
      return g;
    });

  // ---------------------------------------------------------------- the kitbash shop (the angler's)
  const kitShop = () => {
    const bins = new Map();
    let place = new THREE.Matrix4();
    const add = (geo, mat, local = null) => {
      const g2 = local ? geo.applyMatrix4(local) : geo;
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(g2.applyMatrix4(place));
    };
    const at = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const types = [
      (s) => {
        add(cylX(0.016 * s, 0.016 * s, 0.07 * s, 14), M.black, at(0, 0.02 * s, 0));
        add(cylX(0.006 * s, 0.006 * s, 0.06 * s, 8), M.steel, at(0.06 * s, 0.02 * s, 0));
        add(rbox(0.018 * s, 0.024 * s, 0.022 * s, 0.004 * s), R() < 0.25 ? M.steel : M.graphite, at(0.095 * s, 0.02 * s, 0));
      },
      (s) => add(tube([[-0.06 * s, 0.005, 0], [-0.02 * s, 0.045 * s, 0.015 * s], [0.03 * s, 0.05 * s, 0.03 * s], [0.07 * s, 0.008, 0.035 * s]], 0.008 * s, 20, 8), R() < 0.8 ? M.black : M.graphite),
      (s) => {
        add(rbox(0.1 * s, 0.008, 0.066 * s, 0.003), M.pcb, at(0, 0.004, 0));
        for (let k = 0; k < 4; k++) add(rbox(0.018 * s, 0.008, 0.016 * s, 0.002), M.black, at((-0.03 + (k % 2) * 0.04) * s, 0.011, (k < 2 ? -0.015 : 0.015) * s));
      },
      (s) => {
        add(gearGeo(10 + Math.floor(R() * 6), 0.034 * s, 0.027 * s, 0.012, 0.006).rotateX(Math.PI / 2), R() < 0.15 ? M.steel : M.graphite, at(0, 0.012, 0));
        add(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.02, 12), M.gunmetal, at(0, 0.016, 0));
      },
      (s) => {
        add(rbox(0.04 * s, 0.03 * s, 0.034 * s, 0.006 * s), R() < 0.5 ? M.graphite : M.black, at(0, 0.015 * s, 0));
        add(new THREE.CylinderGeometry(0.007 * s, 0.007 * s, 0.01, 6), M.steel, at(0.006 * s, 0.032 * s, 0.004 * s));
      },
      (s) => {
        add(cylX(0.02 * s, 0.02 * s, 0.05 * s, 14), M.gunmetal, at(0, 0.02 * s, 0));
        add(cylX(0.024 * s, 0.024 * s, 0.012 * s, 14), R() < 0.4 ? M.steel : M.black, at(0.028 * s, 0.02 * s, 0));
      },
      (s) => {
        add(cylX(0.022 * s, 0.022 * s, 0.03 * s, 14).rotateZ(Math.PI / 2), M.black, at(0, 0.015 * s, 0));
        add(cylX(0.012 * s, 0.012 * s, 0.012 * s, 10).rotateZ(Math.PI / 2), M.steel, at(0, 0.032 * s, 0));
      },
    ];
    return {
      drop(p, n, s) {
        const qn = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n.clone().normalize());
        place = new THREE.Matrix4().compose(p, qn.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), R() * Math.PI * 2)), new V3(1, 1, 1));
        types[Math.floor(R() * types.length)](s);
      },
      into(parent) {
        for (const [mat, list] of bins) put(parent, merge(list), mat);
      },
    };
  };

  // ---------------------------------------------------------------- plates on a surface walked by (x, s)
  // F(x, s) the point, Nf(x, s) the outward normal. cs: the four corners [x, s] (back-top, front-top, front-bottom,
  // back-bottom), bilinear between them, so a plate can be a trapezoid or a chevron; off lifts it off the surface, t
  // its wall. rv: small dark screws inset at its corners (and along its long edges). Returns a group (the plate and its
  // screws), so the teardown can lift it whole.
  const screwGeo = cylX(0.012, 0.012, 0.02, 12);
  const screwHead = cylX(0.0055, 0.0055, 0.026, 6);
  // Round 3: cs may also be a function (u, v) -> [x, s], so a plate's outline can curve (a crescent round the eye, a
  // brow that swoops), and bulge puffs its middle off the surface, so every plate is bent along both axes like a
  // sculpted shell rather than a slab laid on the skull.
  const quad = (parent, F, Nf, cs, t, mat, {off = 0, rv = 4, res = 0.032, bulge = 0} = {}) => {
    const B = typeof cs === 'function' ? cs : (u, v) => {
      const [[x0, s0], [x1, s1], [x2, s2], [x3, s3]] = cs;
      const xa = x0 + (x1 - x0) * u;
      const sa = s0 + (s1 - s0) * u;
      const xb = x3 + (x2 - x3) * u;
      const sb = s3 + (s2 - s3) * u;
      return [xa + (xb - xa) * v, sa + (sb - sa) * v];
    };
    let flip = false;
    const S0 = (u, v) => {
      const vv = flip ? 1 - v : v;
      const [x, s] = B(u, vv);
      return F(x, s).addScaledVector(Nf(x, s), off + bulge * Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * vv)), 0.6));
    };
    const e = 1e-3;
    const [xm, sm] = B(0.5, 0.5);
    const du = S0(0.5 + e, 0.5).sub(S0(0.5 - e, 0.5));
    const dv = S0(0.5, 0.5 + e).sub(S0(0.5, 0.5 - e));
    if (new V3().crossVectors(du, dv).dot(Nf(xm, sm)) < 0) flip = true;
    const lu = S0(0, 0.5).distanceTo(S0(1, 0.5));
    const lv = S0(0.5, 0).distanceTo(S0(0.5, 1));
    const g = new THREE.Group();
    parent.add(g);
    put(g, plate(S0, [0, 1], [0, 1], t, Math.max(3, Math.ceil(lu / res)), Math.max(3, Math.ceil(lv / res)), null), mat);
    if (rv) {
      const spots = [
        [0.1, 0.22],
        [0.9, 0.22],
        [0.9, 0.78],
        [0.1, 0.78],
      ];
      if (rv > 4 && lu > 0.3) spots.push([0.5, 0.22], [0.5, 0.78]);
      const geos = [];
      const heads = [];
      for (const [u, v] of spots) {
        const [x, s] = B(u, v);
        const p = F(x, s);
        const n = Nf(x, s);
        p.addScaledVector(n, off + bulge * Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.6));
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), n), new V3(1, 1, 1));
        geos.push(screwGeo.clone().applyMatrix4(m));
        heads.push(screwHead.clone().applyMatrix4(m));
      }
      put(g, merge(geos), M.steel);
      put(g, merge(heads), M.graphite);
    }
    return g;
  };

  const gearAt = (parent, F, Nf, x, s, r, n, mat, inset = 0.06) => {
    const p = F(x, s);
    const nn = Nf(x, s);
    const g = grp(parent);
    g.position.copy(p).addScaledVector(nn, -inset);
    g.quaternion.setFromUnitVectors(new V3(0, 0, 1), nn);
    put(g, gearGeo(n, r, r * 0.85, 0.035, r * 0.22, r > 0.08 ? 5 : 0), mat);
    put(g, cylZ(r * 0.3, r * 0.3, 0.05, 18), M.black);
    put(g, cylZ(r * 0.1, r * 0.1, 0.07, 10), M.steel);
    return g;
  };

  // ================================================================ the skull (HEAD) and its upper jaw
  const head = grp(root, 0, 0, 0, 'HEAD');
  const headSides = mirror(head);
  const SU = sweepSec(cyU, ryU, rzU, 2.4, true);
  const tanU = Math.tan(deg(GAPE_UP));
  const yPU = (x) => HINGE.y + tanU * (x - HINGE.x);
  const aRU = (x) => SU.angAt(x, yPU(x));
  const FU = (x, s) => SU.P(x, SU.at(x, aRU(x), s));
  const NU = (x, s) => SU.N(x, SU.at(x, aRU(x), s));
  const xFU = bisect((x) => aRU(x) > 0.05 && ryU(x) > 0.01, HINGE.x, 1.6);
  const XBU = -0.02;
  // the dark lining: the whole cap, inset; inside the mouth it is the roof
  quad(head, FU, NU, [[XBU, -1], [xFU, -1], [xFU, 1], [XBU, 1]], 0.016, M.lining, {off: -0.1, rv: 0, res: 0.04});
  // the mechanism between the lining and the plates, so every seam shows it
  {
    const k = kitShop();
    for (let i = 0; i < 560; i++) {
      const x = XBU + 0.02 + R() * (xFU - XBU - 0.24);
      const s = (R() * 2 - 1) * 0.96;
      const p = FU(x, s);
      const n = NU(x, s);
      k.drop(p.addScaledVector(n, -0.1), n, 1.0 + R() * 1.0);
    }
    k.into(head);
  }
  const plates = [];
  // Round 3: fewer, larger plates in three sizes (the big brow, cheek and jaw plates; medium crown, snout and lip
  // plates; a few small ones), every outline curved and every plate bulged, gaps of 0.03-0.05 over the mechanism.
  const HP = (side, cs, opt = {}) => {
    const g = quad(side, FU, NU, cs, opt.t ?? 0.05, opt.mat ?? M.shell, {res: 0.026, ...opt});
    plates.push(g);
    return g;
  };
  // a band between two curves in (x, s): u runs along it, v across
  const band = (top, bot) => (u, v) => {
    const a = top(u);
    const b = bot(u);
    return [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v];
  };
  // a glowing trim: a thin line sunk just under a seam, the only way green reaches the plating
  const trim = (parent, F, Nf, pts, r = 0.009, inset = 0.014) => {
    const P = pts.map(([x, s]) => F(x, s).addScaledVector(Nf(x, s), -inset));
    put(parent, tube(P, r, Math.max(24, P.length * 5), 6), M.glow);
  };
  const xF = xFU;
  // the eye's place on the skull, (x, s): high on the side, a little ahead of the hinge
  const XE = 0.5;
  const SE = 0.6;
  // the cheek crescent: round the back of the eye and under it, angle a from above-behind (215) to below-front (50)
  const cheek = (rx, rs) => (u) => {
    const a = deg(215 - 165 * u);
    return [XE + rx * Math.cos(a), SE + rs * Math.sin(a)];
  };
  // the crest: two raised pieces along the top, the rear one over the hump
  HP(head, [[0.0, -0.075], [0.42, -0.075], [0.42, 0.075], [0.0, 0.075]], {t: 0.07, off: 0.03, bulge: 0.02});
  HP(head, [[0.47, -0.07], [xF - 0.1, -0.085], [xF - 0.1, 0.085], [0.47, 0.07]], {t: 0.07, off: 0.03, bulge: 0.02});
  for (const side of headSides) {
    // the crown behind the brow, medium, its lower edge bowed up
    HP(side, band((u) => [0.0 + 0.4 * u, 0.115], (u) => [0.0 + 0.34 * u, 0.29 - 0.05 * Math.sin(Math.PI * u)]), {bulge: 0.03});
    // the snout's top in front of the brow, medium
    HP(side, band((u) => [0.62 + (xF - 0.1 - 0.62) * u, 0.12], (u) => [0.7 + (xF - 0.1 - 0.7) * u, 0.4 - 0.04 * u]), {bulge: 0.025});
    // the cheek: the big crescent round the eye, raised, bulged, screws along it
    HP(side, band(cheek(0.24, 0.17), cheek(0.42, 0.28)), {t: 0.07, off: 0.02, bulge: 0.04, rv: 6});
    trim(side, FU, NU, [...Array(17).keys()].map((i) => cheek(0.225, 0.158)(i / 16)));
    // the snout's side in front of the eye: big, its back edge bowed in toward the eye
    HP(side, band((u) => [0.8 - 0.06 * Math.sin(Math.PI * u) + 0.04 * u, 0.45 + 0.43 * u], (u) => [xF - 0.03, 0.45 + 0.43 * u]), {t: 0.06, bulge: 0.035, rv: 6});
    // small plates: one in the notch between the brow's tip and the snout, one under the cheek's tail, one behind it
    HP(side, [[0.6, 0.44], [0.72, 0.45], [0.74, 0.5], [0.62, 0.5]], {t: 0.04, rv: 0, bulge: 0.01});
    HP(side, [[0.78, 0.86], [xF - 0.05, 0.87], [xF - 0.05, 0.91], [0.8, 0.905]], {t: 0.04, rv: 0, bulge: 0.008});
    HP(side, [[-0.02, 0.94], [0.1, 0.93], [0.1, 0.99], [-0.02, 0.99]], {t: 0.05, rv: 0, bulge: 0.01});
    // the lip along the rim, where the fangs come out, in two pieces; the hinge-corner plate, raised
    HP(side, band((u) => [0.42 + 0.3 * u, 0.915], (u) => [0.42 + 0.3 * u, 0.975]), {t: 0.06, rv: 4, bulge: 0.012});
    HP(side, band((u) => [0.76 + (xF - 0.03 - 0.76) * u, 0.93], (u) => [0.76 + (xF - 0.03 - 0.76) * u, 0.975]), {t: 0.06, rv: 4, bulge: 0.012});
    HP(side, band((u) => [0.13 + 0.25 * u, 0.86 + 0.03 * u], (u) => [0.11 + 0.27 * u, 1.0]), {t: 0.08, off: 0.03, rv: 4, bulge: 0.02});
    gearAt(side, FU, NU, 0.12, 0.8, 0.085, 13, M.graphite);
    gearAt(side, FU, NU, 0.04, 0.24, 0.06, 10, M.gunmetal, 0.05);
    // the gum: a dark strip at the rim
    HP(side, [[0.4, 0.975], [xF, 0.975], [xF, 1.0], [0.4, 1.0]], {t: 0.1, mat: M.black, rv: 0});
    // the gum line glowing along the rim, where the fangs come out
    {
      const pts = [];
      for (let x = 0.42; x <= xF - 0.005; x += 0.03) {
        const p = FU(x, 0.985);
        pts.push(p.addScaledVector(NU(x, 0.985), -0.06));
      }
      pts.push(FU(xF, 0).addScaledVector(NU(xF, 0), -0.06));
      put(side, tube(pts, 0.013, 80, 8), M.glow);
    }
    // the ribs of the roof, inside the lining: rows following the rim, rows up into the head
    const lin = (x, s, inset = 0.12) => FU(x, s).addScaledVector(NU(x, s), -inset);
    for (const s of [0.6, 0.78, 0.92]) {
      const pts = [];
      for (let x = 0.2; x <= xF - 0.04; x += 0.05) pts.push(lin(x, s));
      put(side, tube(pts, 0.017, 60, 8), M.graphite);
    }
    for (const x of [0.3, 0.48, 0.66, 0.84]) {
      const pts = [];
      for (let s = 0.3; s <= 0.99; s += 0.06) pts.push(lin(x, s, 0.125));
      put(side, tube(pts, 0.016, 30, 8), M.graphite);
    }
  }
  // the nose: one big plate over the blunt front, so the cap never shows the machine
  HP(head, [[xF - 0.13, -0.9], [xF - 0.002, -0.9], [xF - 0.002, 0.9], [xF - 0.13, 0.9]], {t: 0.06, off: 0.012, bulge: 0.02, rv: 6});
  // two short horns on the snout's top, raked forward; the old crest row of spikes is gone (it read as a crocodile)
  const spikeG = grp(head, 0, 0, 0, 'SPIKES');
  {
    const spike = (parent, p, dir, L, r0) => {
      const pts = [];
      const back = new V3(-1, 0, 0);
      for (let s = 0; s <= 1.0001; s += 0.125) pts.push(p.clone().addScaledVector(dir, L * s).addScaledVector(back, 0.18 * L * s * s));
      put(parent, taperTube(pts, r0, 0.004, 20, 10, 1), M.shell);
    };
    for (const side of mirror(spikeG)) {
      const x = xFU - 0.14;
      const p = FU(x, 0.2).addScaledVector(NU(x, 0.2), 0.03);
      spike(side, p, NU(x, 0.2).add(new V3(0.5, 0.35, 0.05)).normalize(), 0.16, 0.045);
    }
  }

  // ---------------------------------------------------------------- the fangs
  // Two rows on each rim: about 12 big fangs a side and a row of smaller ones behind them, each a thick glass cone
  // bent along an arc (a hook): it leaves the rim toward the other jaw and a little outward, then curls in toward the
  // middle of the mouth; the front ones are the longest, the spacing jittered, every fang its own twist. A glowing tip
  // on each, a warm tint at the root (the vertex colour). Never longer than the gap at that point allows.
  const WARM = new THREE.Color('#ffb070');
  const WHITE = new THREE.Color('#ffffff');
  const teeth = [];
  const fangRow = (parent, F, Nf, xFront, xBack, down, centre, gapAt, {nBig, nSmall, Lmax, inset, row}) => {
    const g = grp(parent, 0, 0, 0, row);
    // the rim, front to back, by arc length
    const RIM = [];
    for (let i = 0; i <= 120; i++) {
      const x = xFront - 0.004 - ((xFront - 0.004 - xBack) * i) / 120;
      RIM.push({x, p: F(x, 0.985)});
    }
    const acc = [0];
    for (let i = 1; i < RIM.length; i++) acc.push(acc[i - 1] + RIM[i].p.distanceTo(RIM[i - 1].p));
    const xAt = (w) => {
      const L = w * acc[acc.length - 1];
      let i = 1;
      while (i < acc.length - 1 && acc[i] < L) i++;
      const k = (L - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
      return RIM[i - 1].x + (RIM[i].x - RIM[i - 1].x) * k;
    };
    const one = (sgn, w, L0, back) => {
      const x = xAt(w);
      const s = 0.985 * sgn;
      const root0 = F(x, s);
      const nOut = Nf(x, s);
      const toC = centre.clone().sub(root0);
      const inward = toC.addScaledVector(down, -toC.dot(down)).normalize();
      const p = root0.clone().addScaledVector(nOut, -inset).addScaledVector(inward, back);
      const L = Math.min(L0, gapAt(p) * 0.5);
      if (L < 0.05) return;
      const rb = 0.022 + 0.1 * L;
      const side = new V3().crossVectors(down, inward).normalize();
      const a0 = deg(12 + 14 * R());
      const sweep = deg(48 + 40 * R());
      const twist = (R() - 0.5) * 0.6;
      const N = 12;
      const pts = [];
      const pos = p.clone().addScaledVector(down, -0.035);
      for (let k = 0; k <= N; k++) {
        pts.push(pos.clone());
        const a = a0 - sweep * (k / N);
        const dir = down.clone().multiplyScalar(Math.cos(a)).addScaledVector(inward, -Math.sin(a)).addScaledVector(side, twist * (k / N)).normalize();
        pos.addScaledVector(dir, (L + 0.035) / N);
      }
      const TUB = 36;
      const RAD = 14;
      const geo = taperTube(pts, rb, 0.0035, TUB, RAD, 1.15);
      const col = [];
      for (let v = 0; v < geo.attributes.position.count; v++) {
        const u = Math.floor(v / (RAD + 1)) / TUB;
        const c = WARM.clone().lerp(WHITE, smoother(u / 0.12));
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.deleteAttribute('uv');
      // the glowing tip: the last fifth of the curve, a hair proud of the glass
      const tipPts = pts.slice(10);
      const rt = (u) => 0.0035 + (rb - 0.0035) * Math.pow(1 - u, 1.15);
      const tip = taperTube(tipPts, rt(0.83) * 1.05, 0.0038, 10, 10, 1);
      const at = pts[0].clone();
      geo.translate(-at.x, -at.y, -at.z);
      tip.translate(-at.x, -at.y, -at.z);
      const f = grp(g, at.x, at.y, at.z);
      const m = put(f, geo, M.tooth);
      m.castShadow = false;
      // round 3: no glowing tip (a row of green dots); the root's warm tint turns to the green gum line in the look
      teeth.push({o: f, home: at.clone(), q0: f.quaternion.clone(), out: nOut.clone(), down: down.clone(), inward: inward.clone(), along: w, side: sgn, row, L, spin: (R2() - 0.5) * 2.4});
    };
    for (const sgn of [1, -1]) {
      for (let k = 0; k < nBig; k++) {
        const w = (k + 0.5 + (R() - 0.5) * 0.6) / nBig;
        one(sgn, w * 0.97, Lmax * (0.36 + 0.64 * Math.pow(1 - w, 0.85)) * (0.76 + 0.34 * R()), 0);
      }
      for (let k = 0; k < nSmall; k++) {
        const w = (k + 0.5 + (R() - 0.5) * 0.8) / nSmall;
        one(sgn, 0.04 + w * 0.9, Lmax * (0.2 + 0.14 * R()), 0.075);
      }
    }
    return g;
  };
  const gapAll = (p, H) => Math.hypot(p.x - H.x, p.y - H.y) * Math.tan(deg(GAPE_UP + GAPE_LO));
  {
    const down = new V3(Math.sin(deg(GAPE_UP)), -Math.cos(deg(GAPE_UP)), 0);
    const centre = new V3((xFU + HINGE.x) / 2, yPU((xFU + HINGE.x) / 2), 0);
    fangRow(head, FU, NU, xFU, HINGE.x + 0.06, down, centre, (p) => gapAll(p, HINGE), {nBig: 9, nSmall: 7, Lmax: 0.4, inset: 0.035, row: 'up'});
  }

  // ---------------------------------------------------------------- the eyes (OPTICS)
  // A big glossy black lens under a thin glowing ring, in a socket of three dark stepped rings and a white bezel,
  // screws round the outer ring; hidden behind the lens, three lens rings and the iris for the film. Mount frame: +x
  // out of the head.
  let eyeRig = null;
  const eyes = [];
  for (const [si, side] of headSides.entries()) {
    const p = FU(XE, SE);
    const n = NU(XE, SE).add(new V3(0.28, 0.04, 0)).normalize();
    const eye = grp(side, 0, 0, 0, si === 0 ? 'OPTICS' : 'OPTICS_far');
    const mount = grp(eye);
    mount.position.copy(p).addScaledVector(n, -0.01);
    aimX(mount, n);
    const parts = [];
    const P2 = (geo, mat, x = 0, y = 0, z = 0, off = 0, spin = 0, s = 0) => {
      const m = put(mount, geo, mat, x, y, z);
      parts.push({o: m, home: m.position.clone(), q0: m.quaternion.clone(), off, spin, s});
      return m;
    };
    P2(ring(-0.1, 0.02, 0.176, 0.205, 0.008), M.graphite, 0, 0, 0, 0, 0, 0);
    P2(ring(-0.12, 0.0, 0.0, 0.18, 0.01), M.black, 0, 0, 0, 0, 0, 0);
    P2(ring(-0.06, 0.025, 0.148, 0.178, 0.006), M.black, 0, 0, 0, 0.12, 0.8, 0.3);
    P2(ring(-0.03, 0.045, 0.128, 0.15, 0.005), M.gunmetal, 0, 0, 0, 0.3, -1.2, 0.2);
    P2(ring(-0.01, 0.06, 0.111, 0.13, 0.004), M.black, 0, 0, 0, 0.48, 1.6, 0.12);
    P2(ring(0.045, 0.066, 0.096, 0.113, 0.003), M.bezel, 0, 0, 0, 0.62, 0, 0.08);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      P2(cylX(0.01, 0.01, 0.02, 10), M.steel, 0.03, Math.cos(a) * 0.163, Math.sin(a) * 0.163, 0.12, 0.8, 0.3);
    }
    const lens = P2(new THREE.SphereGeometry(0.1, 48, 24, 0, Math.PI * 2, 0, 1.15), M.lens, 0.0, 0, 0, 0.75, 0, 0);
    lens.rotation.z = -Math.PI / 2;
    lens.position.x = -0.03;
    parts[parts.length - 1].home.x = -0.03;
    parts[parts.length - 1].q0 = lens.quaternion.clone();
    eyes.push(eye);
    if (si === 0) {
      anchor('lens', mount, 0.1, 0, 0);
      anchor('eyeRing', mount, 0.04, 0.17, 0);
      anchor('barrel', mount, 0.05, 0.14, 0);
      const extra = grp(mount);
      extra.visible = false;
      const ringA = grp(extra);
      put(ringA, ring(-0.02, 0.02, 0.1, 0.15, 0.005), M.graphite);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        put(ringA, rbox(0.034, 0.03, 0.026, 0.007), M.orange, 0, Math.cos(a) * 0.158, Math.sin(a) * 0.158);
      }
      const ringB = grp(extra);
      put(ringB, ring(-0.018, 0.018, 0.1, 0.165, 0.005), M.shell);
      const ringC = grp(extra);
      for (let k = 0; k < 4; k++) put(ringC, ring(-0.03 + k * 0.014, -0.018 + k * 0.014, 0.09, 0.128 - (k % 2) * 0.007, 0.003), k % 2 ? M.gunmetal : M.black);
      const iris = grp(extra, -0.05, 0, 0);
      const blades = [];
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const pv = grp(iris, k * 0.0014, Math.cos(a) * 0.15, Math.sin(a) * 0.15);
        put(pv, rbox(0.005, 0.14, 0.054, 0.003), k % 2 ? M.gunmetal : M.steel, 0, -0.064, 0);
        put(pv, cylX(0.01, 0.01, 0.01, 10), M.orange);
        blades.push({o: pv, a});
      }
      anchor('iris', iris, 0, 0.11, 0.07);
      anchor('lensRing', ringA, 0, 0.15, 0);
      eyeRig = {parts, extra, rings: [[ringA, 0.4, 2.2], [ringB, 0.7, -1.8], [ringC, 0.26, 1.3]], iris, blades};
    }
  }
  // the brow: one big swooping plate standing proud over the eye, thick, slanting down toward the snout, its
  // underside edge trimmed with a glowing line
  const brows = [];
  for (const side of headSides) {
    const b = grp(side, 0, 0, 0, 'BROW');
    brows.push(b);
    const top = (u) => [0.04 + 0.84 * u, 0.27 + 0.15 * u + 0.03 * Math.sin(Math.PI * u)];
    const bot = (u) => [0.08 + 0.82 * u, 0.36 + 0.24 * u - 0.02 * Math.sin(Math.PI * u)];
    quad(b, FU, NU, band(top, bot), 0.12, M.shell, {off: 0.08, rv: 6, bulge: 0.05, res: 0.024});
    trim(b, FU, NU, [...Array(13).keys()].map((i) => {
      const [x, s2] = bot(0.08 + (0.84 * i) / 12);
      return [x, s2 + 0.012];
    }), 0.009, 0.0);
  }
  anchor('brow', brows[0], ...FU(0.5, 0.45).addScaledVector(NU(0.5, 0.45), 0.12).toArray());
  // the jaw hinge: a black drum on the mouth corner, a glow ring on its face, a graphite hub, screws round it
  for (const side of headSides) {
    const p = FU(HINGE.x - 0.02, 0.99);
    const hz = grp(side, p.x, p.y, p.z - 0.02);
    put(hz, cylZ(0.1, 0.1, 0.12, 32), M.black);
    put(hz, cylZ(0.075, 0.075, 0.03, 32), M.graphite, 0, 0, 0.06);
    put(hz, cylZ(0.022, 0.022, 0.08, 14), M.steel, 0, 0, 0.08);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      put(hz, cylZ(0.01, 0.01, 0.02, 10), M.steel, Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.08);
    }
  }

  // ================================================================ the lower jaw (ABDOMEN), hung on the hinge
  const jaw = grp(root, HINGE.x, HINGE.y, HINGE.z, 'ABDOMEN');
  jaw.rotation.z = -deg(GAPE_LO);
  const jawSides = mirror(jaw);
  const SL = sweepSec(cyL, ryL, rzL, 2.4, false);
  const aRL = (x) => SL.angAt(x, 0);
  const FL = (x, s) => SL.P(x, SL.at(x, aRL(x), s));
  const NL = (x, s) => SL.N(x, SL.at(x, aRL(x), s));
  const xFL = bisect((x) => aRL(x) > 0.05 && ryL(x) > 0.21, 0.2, 1.45);
  const XBL = -0.3;
  quad(jaw, FL, NL, [[XBL, -1], [xFL, -1], [xFL, 1], [XBL, 1]], 0.016, M.lining, {off: -0.1, rv: 0, res: 0.04});
  {
    const k = kitShop();
    for (let i = 0; i < 400; i++) {
      const x = XBL + 0.04 + R() * (xFL - XBL - 0.24);
      const s = (R() * 2 - 1) * 0.96;
      const n = NL(x, s);
      k.drop(FL(x, s).addScaledVector(n, -0.1), n, 1.0 + R() * 1.0);
    }
    k.into(jaw);
  }
  const JP = (side, cs, opt = {}) => {
    const g = quad(side, FL, NL, cs, opt.t ?? 0.05, opt.mat ?? M.shell, {res: 0.026, ...opt});
    plates.push(g);
    return g;
  };
  // the keel under the chin: two raised pieces
  JP(jaw, [[0.18, -0.085], [0.6, -0.085], [0.6, 0.085], [0.18, 0.085]], {t: 0.06, off: 0.015, bulge: 0.015});
  JP(jaw, [[0.65, -0.09], [xFL - 0.06, -0.12], [xFL - 0.06, 0.12], [0.65, 0.09]], {t: 0.06, off: 0.015, bulge: 0.015});
  for (const side of jawSides) {
    // the big jaw plate along the side, its upper edge swooping up toward the chin
    JP(side, band((u) => [-0.08 + 0.7 * u, 0.13], (u) => [-0.04 + 0.66 * u, 0.6 - 0.12 * Math.sin(Math.PI * u * 0.8)]), {t: 0.07, bulge: 0.045, rv: 6});
    trim(side, FL, NL, [...Array(13).keys()].map((i) => {
      const u = i / 12;
      return [-0.04 + 0.66 * u, 0.6 - 0.12 * Math.sin(Math.PI * u * 0.8) + 0.03];
    }));
    // the chin: big, squared, wider than the snout above it, its back edge bowed
    JP(side, band((u) => [0.68 + 0.05 * Math.sin(Math.PI * u), 0.13 + 0.68 * u], (u) => [xFL - 0.02, 0.13 + 0.68 * u]), {t: 0.07, bulge: 0.04, rv: 4});
    // behind the hinge: a medium plate over the jaw's root
    JP(side, band((u) => [-0.3 + 0.18 * u, 0.12], (u) => [-0.28 + 0.14 * u, 0.7]), {bulge: 0.02, rv: 0});
    // small plates in the step between the side plate and the lip
    JP(side, [[-0.06, 0.68], [0.16, 0.66], [0.16, 0.75], [-0.06, 0.76]], {t: 0.04, rv: 0, bulge: 0.01});
    JP(side, [[0.2, 0.64], [0.36, 0.6], [0.36, 0.72], [0.2, 0.74]], {t: 0.04, rv: 0, bulge: 0.01});
    gearAt(side, FL, NL, 0.5, 0.66, 0.07, 11, M.graphite, 0.05);
    // the lip along the rim, two pieces
    JP(side, band((u) => [-0.12 + 0.52 * u, 0.82], (u) => [-0.12 + 0.52 * u, 0.955]), {t: 0.06, rv: 4, bulge: 0.015});
    JP(side, band((u) => [0.45 + (xFL - 0.03 - 0.45) * u, 0.84], (u) => [0.45 + (xFL - 0.03 - 0.45) * u, 0.955]), {t: 0.06, rv: 4, bulge: 0.015});
    JP(side, [[-0.1, 0.955], [xFL, 0.955], [xFL, 1.0], [-0.1, 1.0]], {t: 0.1, mat: M.black, rv: 0});
    // a glowing slot near the chin: a black recess with a glowing insert (a line, not a dot)
    {
      const x = 0.6;
      const s = 0.56;
      const p = FL(x, s);
      const n = NL(x, s);
      const g = grp(side);
      g.position.copy(p).addScaledVector(n, 0.012);
      const tx = FL(x + 0.01, s).sub(FL(x - 0.01, s)).normalize();
      const by = new V3().crossVectors(n, tx).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, by, n));
      put(g, rbox(0.36, 0.07, 0.03, 0.02), M.black);
      put(g, rbox(0.3, 0.026, 0.03, 0.012), M.glow, 0, 0, 0.012);
    }
    // the floor ribs inside the scoop, the glow line along the rim
    const lin = (x, s, inset = 0.12) => FL(x, s).addScaledVector(NL(x, s), -inset);
    for (const s of [0.6, 0.8, 0.93]) {
      const pts = [];
      for (let x = -0.1; x <= xFL - 0.05; x += 0.05) pts.push(lin(x, s));
      put(side, tube(pts, 0.017, 60, 8), M.graphite);
    }
    for (const x of [0.05, 0.25, 0.45, 0.65, 0.85]) {
      const pts = [];
      for (let s = 0.2; s <= 0.99; s += 0.06) pts.push(lin(x, s, 0.125));
      put(side, tube(pts, 0.016, 30, 8), M.graphite);
    }
    const pts = [];
    for (let x = -0.05; x <= xFL - 0.005; x += 0.03) pts.push(FL(x, 0.985).addScaledVector(NL(x, 0.985), -0.06));
    pts.push(FL(xFL, 0).addScaledVector(NL(xFL, 0), -0.06));
    put(side, tube(pts, 0.013, 80, 8), M.glow);
  }
  // the chin's front: one wide plate over the squared tip
  JP(jaw, [[xFL - 0.12, -0.94], [xFL - 0.002, -0.94], [xFL - 0.002, 0.94], [xFL - 0.12, 0.94]], {t: 0.06, off: 0.012, bulge: 0.02, rv: 6});
  // the tongue: a ribbed, segmented spine from the floor at the front back down the throat, glow rings on it
  {
    const sp = grp(jaw);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      pts.push(new V3(0.8 - 1.0 * u, -0.3 + 0.1 * Math.sin(u * 2.6) - 0.06 * u, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    put(sp, tube(pts, 0.04, 80, 10), M.black);
    for (let k = 0; k < 18; k++) {
      const u = 0.02 + (k / 17) * 0.96;
      const v = grp(sp);
      v.position.copy(curve.getPointAt(u));
      aimX(v, curve.getTangentAt(u));
      put(v, ring(-0.024, 0.024, 0.045, 0.092 - 0.024 * u, 0.008), k % 2 ? M.steel : M.gunmetal);
      for (const sgn of [-1, 1]) put(v, rbox(0.026, 0.02, 0.08, 0.006), M.graphite, 0, 0.0, sgn * 0.09);
    }
  }
  {
    const down = new V3(0, 1, 0);
    const centre = new V3((xFL + 0.06) / 2, 0, 0);
    fangRow(jaw, FL, NL, xFL, 0.06, down, centre, (p) => gapAll(p, new V3()), {nBig: 9, nSmall: 7, Lmax: 0.44, inset: 0.035, row: 'lo'});
  }

  // ---------------------------------------------------------------- the throat: a dark bulb behind the mouth with
  // ribbed rings receding into it, glow rings between them, a soft light inside
  let throat = null;
  {
    const th = grp(root, 0.08, -0.14, 0, 'THROAT');
    throat = th;
    put(th, new THREE.SphereGeometry(0.5, 40, 28).scale(0.85, 0.95, 1.0), M.lining);
    // Round 3: the ring tunnel runs forward to the mouth corner, so its green-lit rings stand in the gape: each ring a
    // segmented collar (a torus and a crown of blocks), a thin glow ring inside every other one, a dark sleeve behind
    {
      const NR = 10;
      const blocks = [];
      for (let k = 0; k < NR; k++) {
        const u = k / (NR - 1);
        const r = 0.36 - 0.17 * u;
        const x = 0.56 - 0.62 * u;
        const m = put(th, new THREE.TorusGeometry(r, 0.03 - 0.008 * u, 10, 48).rotateY(Math.PI / 2), k % 2 ? M.gunmetal : M.graphite, x, 0.04, 0);
        m.scale.set(1, 0.95, 1.05);
        const nb = 14;
        for (let j = 0; j < nb; j++) {
          const a = (j / nb) * Math.PI * 2 + k * 0.21;
          blocks.push(rbox(0.034, 0.04, 0.05 * r * 3.2, 0.006).rotateX(a).translate(x - 0.02, 0.04 + Math.cos(a) * (r + 0.03) * 0.95, Math.sin(a) * (r + 0.03) * 1.05));
        }
        if (k % 2 === 0) {
          const gl = put(th, new THREE.TorusGeometry(r - 0.04, 0.012, 6, 48).rotateY(Math.PI / 2), M.glow, x - 0.03, 0.04, 0);
          gl.scale.set(1, 0.95, 1.05);
        }
      }
      put(th, merge(blocks), M.black);
      const sleeve = M.lining.clone();
      sleeve.side = THREE.DoubleSide;
      put(th, new THREE.CylinderGeometry(0.2, 0.37, 0.66, 32, 1, true).rotateZ(Math.PI / 2), sleeve, 0.25, 0.04, 0);
    }
    // ribbed hoses round the gullet's walls
    for (const [y, z] of [
      [0.28, 0.26],
      [-0.26, 0.28],
      [0.3, -0.24],
      [-0.28, -0.26],
    ]) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push(new V3(0.42 - 0.6 * u, y * (1 - 0.25 * u), z * (1 - 0.2 * u)));
      }
      put(th, tube(pts, 0.03, 40, 8), M.black);
      const c = new THREE.CatmullRomCurve3(pts);
      const ribs = [];
      for (let k = 0; k < 16; k++) {
        const u = k / 15;
        const q = c.getPointAt(u);
        const tg = c.getTangentAt(u);
        ribs.push(new THREE.TorusGeometry(0.034, 0.008, 6, 14).rotateY(Math.PI / 2).applyMatrix4(new THREE.Matrix4().compose(q, new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), tg), new V3(1, 1, 1))));
      }
      put(th, merge(ribs), M.gunmetal);
    }
    for (const side of mirror(th)) {
      for (const [x, y, r, n, mat, z] of [
        [0.02, -0.16, 0.13, 16, M.graphite, 0.44],
        [-0.13, -0.3, 0.08, 11, M.gunmetal, 0.4],
        [0.12, -0.32, 0.06, 9, M.steel, 0.38],
      ]) {
        put(side, gearGeo(n, r, r * 0.85, 0.04, r * 0.2, r > 0.1 ? 5 : 0), mat, x, y, z);
        put(side, cylZ(r * 0.3, r * 0.3, 0.06, 18), M.black, x, y, z);
      }
      const cg = coil(0.04, 0.009, 7, 0.2, 200);
      put(side, cg, M.coil, -0.18, -0.12, 0.38);
      put(side, cylX(0.026, 0.026, 0.22, 14), M.black, -0.08, -0.12, 0.38);
    }
    const pl = new THREE.PointLight('#ff7a2a', 1.6, 0.9, 2);
    pl.position.set(0.3, 0.04, 0);
    th.add(pl);
  }

  // ================================================================ the glass flank (THORAX): a clear barrel on white
  // rib bands over a packed machine, built round and squashed sideways
  const body = grp(root, 0, AXIS_Y, 0, 'THORAX');
  body.scale.z = SQZ;
  const bodySides = mirror(body);
  const XB0 = 0.04;
  const XB1 = -1.42;
  put(body, solid(XB1 - 0.02, XB0, (u) => RB(XB1 - 0.02 + u * (XB0 - XB1 + 0.02)) * 0.52, {}, 40), M.black);
  put(body, cylX(0.07, 0.07, 2.2, 24), M.graphite, -0.6, 0, 0);
  for (const x of [-1.2, -0.9, -0.6, -0.3, 0.0]) put(body, ring(x - 0.03, x + 0.03, 0.06, 0.12, 0.01), M.gunmetal);
  // the kitbash between the core and the glass, glowing parts among it
  let kitG = null;
  {
    const k = kitShop();
    // round 3: half the kitbash, and all of it deeper than the big gears, so nothing but glass stands in front of them
    for (let i = 0; i < 540; i++) {
      const x = XB1 + 0.04 + R() * (XB0 - XB1 - 0.06);
      const a = R() * Math.PI * 2;
      const rb = RB(x);
      const r = rb * 0.5 + Math.pow(R(), 1.1) * rb * 0.2;
      k.drop(new V3(x, Math.cos(a) * r, Math.sin(a) * r), new V3(0, Math.cos(a), Math.sin(a)), 1.4 + R() * 1.6);
    }
    kitG = grp(body);
    k.into(kitG);
  }
  // the drive: gears of four sizes standing on the flank (axis across the body), each on a hub; the coils glowing
  // between them, pipes and ribbed hoses over them. Every cluster is its own group (mech[]), so the flank teardown can
  // slide it out and spin it.
  const mech = [];
  const coils = [];
  const zIn = (x, y, d) => Math.sqrt(Math.max(0, RB(x) ** 2 - y * y)) * d;
  for (const [si, side] of bodySides.entries()) {
    const gears = [
      // round 3: three big wheels right behind the glass (diameter 0.3-0.37 of the body's height), the rest deeper
      [-0.42, 0.05, 0.34, 38, 0.8, M.graphite, 0.7],
      [-0.86, -0.14, 0.28, 32, 0.74, M.gunmetal, -0.85],
      [-1.24, 0.08, 0.13, 16, 0.72, M.graphite, 1.2],
      [-0.08, -0.26, 0.16, 18, 0.62, M.gunmetal, -1.4],
      [-1.12, 0.14, 0.12, 14, 0.62, M.graphite, 2.0],
      [-0.5, -0.5, 0.11, 13, 0.6, M.gunmetal, -1.8],
      [-0.16, 0.36, 0.1, 12, 0.6, M.gunmetal, 2.2],
      [-1.2, -0.16, 0.08, 10, 0.6, M.gunmetal, 2.4],
    ];
    gears.forEach(([x, y, r, n, d, mat, rate], i) => {
      const z = zIn(x, y, d);
      const g = grp(side, x, y, z);
      const wheel = grp(g);
      put(wheel, gearGeo(n, r, r * 0.86, 0.045, r * 0.2, r > 0.12 ? 6 : 4), mat);
      put(wheel, cylZ(r * 0.32, r * 0.32, 0.06, 24), M.black);
      put(wheel, cylZ(r * 0.12, r * 0.12, 0.09, 12), M.steel);
      if (r > 0.12) for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        put(wheel, cylZ(0.012, 0.012, 0.06, 8), M.steel, Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, 0);
      }
      // the axle back into the core
      put(g, cylZ(0.022, 0.022, z, 10), M.gunmetal, 0, 0, -z / 2);
      mech.push({o: g, wheel, home: g.position.clone(), side: si, rate, out: 0.25 + 0.4 * (1 - d) + 0.2 * r, s: i * 0.04});
      if (si === 0 && i === 0) anchor('gear', g, 0, r * 0.7, 0.03);
    });
    // the coils: a dark core, a glowing winding, gunmetal end caps; along the body and upright
    [
      [[-0.5, 0.5], [1, 0.06, 0], 0.24, 0.045, 0.7],
      [[-0.93, 0.16], [0.3, 1, 0], 0.32, 0.05, 0.6],
    ].forEach(([[x, y], dir, L, R0, d], i) => {
      const z = zIn(x, y, d);
      const g = grp(side, x, y, z);
      const ax = grp(g);
      aimX(ax, new V3(...dir));
      put(ax, cylX(R0 * 0.62, R0 * 0.62, L, 18), M.black, 0, 0, 0);
      const cg = coil(R0 * 0.82, R0 * 0.16, Math.round(L / (R0 * 0.38)), L * 0.86, 360);
      cg.translate(-L * 0.43, 0, 0);
      put(ax, cg, M.coil);
      for (const sgn of [-1, 1]) put(ax, ring(sgn * L * 0.47 - 0.022, sgn * L * 0.47 + 0.022, R0 * 0.5, R0 * 1.15, 0.006), M.gunmetal);
      coils.push({o: g, home: g.position.clone(), side: si, s: 0.2 + i * 0.05});
      if (si === 0 && i === 0) anchor('coil', g, 0.1, R0, 0);
    });
    // pistons with glowing caps across the machine
    const piston = (a, b, r) => {
      const A = new V3(...a);
      const B = new V3(...b);
      const d = B.clone().sub(A);
      const L = d.length();
      const g = grp(side);
      g.position.copy(A);
      aimX(g, d);
      put(g, cylX(r, r, L * 0.55, 18), M.black, L * 0.3, 0, 0);
      put(g, cylX(r * 1.15, r * 1.15, 0.03, 18), M.gunmetal, L * 0.55, 0, 0);
      put(g, cylX(r * 0.42, r * 0.42, L * 0.5, 12), M.steel, L * 0.72, 0, 0);
      for (const x of [0, L]) {
        put(g, new THREE.SphereGeometry(r * 1.5, 16, 12), M.black, x, 0, 0);
        put(g, new THREE.TorusGeometry(r * 1.5, r * 0.32, 8, 24), M.gunmetal, x, 0, 0);
      }
    };
    piston([-1.3, 0.05, zIn(-1.3, 0.05, 0.7)], [-0.98, -0.3, zIn(-0.98, -0.3, 0.8)], 0.032);
    piston([-0.36, 0.6, zIn(-0.36, 0.6, 0.6)], [-0.04, 0.34, zIn(-0.04, 0.34, 0.75)], 0.03);
    piston([-0.82, -0.52, zIn(-0.82, -0.52, 0.6)], [-0.5, -0.66, zIn(-0.5, -0.66, 0.5)], 0.028);
    // hoses arching over the machine, black and graphite; two ribbed
    const hose = (P, r, ribbed, mat) => {
      const pts = P.map(([x, y, d]) => new V3(x, y, zIn(x, y, d)));
      put(side, tube(pts, r, 64, 8), mat);
      if (ribbed) {
        const c = new THREE.CatmullRomCurve3(pts);
        const rs = [];
        const n = Math.round(c.getLength() / 0.035);
        for (let k = 0; k <= n; k++) {
          const u = k / n;
          rs.push(new THREE.TorusGeometry(r * 1.12, r * 0.28, 6, 14).rotateY(Math.PI / 2).applyMatrix4(new THREE.Matrix4().compose(c.getPointAt(u), new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), c.getTangentAt(u)), new V3(1, 1, 1))));
        }
        put(side, merge(rs), M.gunmetal);
      }
    };
    hose([[0.0, 0.62, 0.7], [-0.2, 0.68, 0.74], [-0.5, 0.62, 0.78], [-0.9, 0.5, 0.78], [-1.25, 0.24, 0.72]], 0.026, true, M.black);
    hose([[0.0, -0.6, 0.7], [-0.25, -0.7, 0.66], [-0.6, -0.68, 0.66], [-1.05, -0.48, 0.7], [-1.32, -0.22, 0.7]], 0.024, true, M.black);
  }
  // the clear barrel: one half a side between the crest and the keel, a thin shell just under the ribs
  const glass = [];
  for (const [si, side] of bodySides.entries()) {
    const out = [];
    const inn = [];
    for (let k = 0; k <= 40; k++) {
      const x = XB0 - ((XB0 - XB1) * k) / 40;
      out.push([x, RB(x) + 0.005]);
      inn.push([x, RB(x) - 0.01]);
    }
    const prof = [...out, ...inn.reverse()];
    const gp = grp(side, 0, 0, 0, si === 0 ? 'FLANK_GLASS' : '');
    const m = put(gp, sweepX(prof, {a0: deg(7), a1: deg(173), segs: 64}), M.flank);
    m.castShadow = false;
    m.renderOrder = 1;
    // the specular band: a long bright streak high on the barrel and a soft halo round it, plus the rim's catch
    // along the lower edge, all riding with the glass in the teardown
    const strip = (r0, a0, a1, xa, xb, mat) => {
      const pr = [];
      for (let k = 0; k <= 24; k++) pr.push([xa + ((xb - xa) * k) / 24, RB(xa + ((xb - xa) * k) / 24) + r0]);
      for (let k = 24; k >= 0; k--) pr.push([xa + ((xb - xa) * k) / 24, RB(xa + ((xb - xa) * k) / 24) + r0 - 0.008]);
      const sm2 = put(gp, sweepX(pr, {a0: deg(a0), a1: deg(a1), segs: 8, smooth: 0}), mat);
      sm2.castShadow = false;
      sm2.renderOrder = 2;
    };
    strip(0.016, 50, 57, -1.06, -0.1, M.glint);
    strip(0.013, 42, 66, -1.12, -0.06, M.glintSoft);
    strip(0.016, 140, 146, -1.0, -0.14, M.glintSoft);
    glass.push({o: gp, side: si});
    if (si === 0) anchor('flank', gp, -0.55, 0.25, RB(-0.55) * 0.95);
  }
  // the rib bands: white plates curving over the glass from the crest to the keel, bowed back at the middle, screws
  // along them; each hangs on a hinge at its top so the flank teardown can lift it. Two broad gill plates in front,
  // each in three pieces with gaps over the gears.
  const ribs = [];
  const ribBand = (parent, xc, w, a0, a1, off, t, bow, rvN) => {
    const S = (u, v) => {
      const a = deg(a0 + (a1 - a0) * v);
      const x = xc + w * (u - 0.5) - bow * Math.sin(a);
      const r = RB(x) + off;
      return new V3(x, Math.cos(a) * r, Math.sin(a) * r);
    };
    const nrm = (q) => new V3(0, q.y, q.z).normalize();
    const g = new THREE.Group();
    parent.add(g);
    put(g, plate(S, [0, 1], [0, 1], t, 6, Math.max(8, Math.ceil(Math.abs(a1 - a0) / 3)), nrm), M.shell);
    if (rvN) {
      const geos = [];
      const heads = [];
      for (let i = 0; i < rvN; i++) {
        const p = S(0.5, (i + 0.5) / rvN);
        const n = nrm(p);
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new V3(1, 0, 0), n), new V3(1, 1, 1));
        geos.push(screwGeo.clone().applyMatrix4(m));
        heads.push(screwHead.clone().applyMatrix4(m));
      }
      put(g, merge(geos), M.gunmetal);
      put(g, merge(heads), M.black);
    }
    return g;
  };
  for (const [si, side] of bodySides.entries()) {
    // the gill plates
    for (const [xc, w, bow, cuts] of [
      [-0.02, 0.12, 0.09, [[9, 56], [66, 116], [126, 171]]],
      [-0.22, 0.07, 0.1, [[9, 46], [134, 171]]],
    ]) {
      for (const [a0, a1] of cuts) {
        const g = ribBand(side, xc, w, a0, a1, 0.04, 0.06, bow, 3);
        ribs.push({o: g, side: si, gill: true, x: xc, a: deg(a0), k: ribs.filter((r) => r.side === si).length});
      }
    }
    for (const [i, xc] of [-0.64, -1.0, -1.3].entries()) {
      const pv = grp(side, xc, Math.cos(deg(8)) * RB(xc), Math.sin(deg(8)) * RB(xc));
      const g = ribBand(pv, xc, 0.1 - i * 0.012, 8, 172, 0.03, 0.06, 0.12 - 0.02 * i, 7);
      g.position.set(-pv.position.x, -pv.position.y, -pv.position.z);
      ribs.push({o: pv, home: pv.position.clone(), side: si, gill: false, x: xc, k: i});
      if (si === 0 && i === 1) anchor('rib', pv, 0, -RB(xc) * 0.7, RB(xc) * 0.75);
    }
  }
  // the crest along the back and the keel along the belly: white plates in a row with gaps, a dark strip under them
  {
    const strip = (a0, a1, segs, off, t) => {
      for (const [x0, x1] of segs) {
        const S = (u, v) => {
          const x = x1 + (x0 - x1) * u;
          const a = deg(a0 + (a1 - a0) * v);
          const r = RB(x) + off;
          return new V3(x, Math.cos(a) * r, Math.sin(a) * r);
        };
        put(body, plate(S, [0, 1], [0, 1], t, 10, 6, (q) => new V3(0, q.y, q.z).normalize()), M.shell);
      }
    };
    const segs = [
      [0.04, -0.3],
      [-0.34, -0.66],
      [-0.7, -1.02],
      [-1.06, -1.4],
    ];
    put(body, sweepX([[XB0, RB(XB0) - 0.06], [XB1, RB(XB1) - 0.06], [XB1, RB(XB1) + 0.01], [XB0, RB(XB0) + 0.01]], {a0: deg(-9), a1: deg(9), segs: 8}), M.black);
    put(body, sweepX([[XB0, RB(XB0) - 0.06], [XB1, RB(XB1) - 0.06], [XB1, RB(XB1) + 0.01], [XB0, RB(XB0) + 0.01]], {a0: deg(171), a1: deg(189), segs: 8}), M.black);
    strip(-8.5, 8.5, segs, 0.045, 0.05);
    strip(171.5, 188.5, segs, 0.045, 0.05);
  }
  anchor('core', body, -0.6, 0, 0.4);

  // ================================================================ the tail stalk (LEG): a chain of segments that
  // telescopes apart; the tail fan rides on the last one
  const stalk = grp(root, XB1 + 0.02, AXIS_Y, 0, 'LEG');
  stalk.scale.z = 0.86;
  const stalkSegs = [];
  {
    const SEG = [
      {L: 0.28, r0: 0.3, r1: 0.215},
      {L: 0.15, r0: 0.215, r1: 0.205},
      {L: 0.15, r0: 0.205, r1: 0.195},
      {L: 0.15, r0: 0.195, r1: 0.185},
    ];
    let parent = stalk;
    let x0 = 0;
    SEG.forEach((S, k) => {
      const g = grp(parent, k === 0 ? 0 : -SEG[k - 1].L, 0, 0);
      // the core, the white collar over most of it, the dark joint at its rear, a thin glow ring in the joint
      put(g, solid(-S.L - 0.01, 0.0, (u) => (S.r1 + (S.r0 - S.r1) * u) * 0.8, {}, 12), M.black);
      if (k === 0) {
        put(g, sweepX([[0, S.r0 - 0.03], [-S.L, S.r1 - 0.03], [-S.L, S.r1 + 0.004], [0, S.r0 + 0.004]], {segs: 48}), M.graphite);
        const kk = kitShop();
        for (let i = 0; i < 90; i++) {
          const x = -0.02 - R() * (S.L - 0.04);
          const a = R() * Math.PI * 2;
          const r = S.r1 + (S.r0 - S.r1) * (1 + x / S.L);
          kk.drop(new V3(x, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95), new V3(0.3, Math.cos(a), Math.sin(a)).normalize(), 1.2 + R() * 0.8);
        }
        kk.into(g);
        for (const [xa, w] of [
          [-0.04, 0.045],
          [-0.17, 0.04],
        ]) {
          const r = S.r1 + (S.r0 - S.r1) * (1 + xa / S.L);
          put(g, ring(xa - w / 2, xa + w / 2, r - 0.02, r + 0.03, 0.01), M.shell);
        }
      } else {
        put(g, ring(-S.L * 0.78, -0.012, S.r0 - 0.03, S.r0 + 0.035, 0.014), M.shell);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          const m = put(g, cylX(0.014, 0.014, 0.02, 10), M.gunmetal, -S.L * 0.4, Math.cos(a) * (S.r0 + 0.036), Math.sin(a) * (S.r0 + 0.036));
          m.rotation.x = a;
          aimX(m, new V3(0, Math.cos(a), Math.sin(a)));
        }
      }
      put(g, ring(-S.L, -S.L * 0.8, S.r1 - 0.045, S.r1 + 0.012, 0.008), M.black);
      put(g, ring(-S.L * 0.92, -S.L * 0.86, S.r1 + 0.008, S.r1 + 0.02, 0.003), M.glow);
      // the servo in the joint ahead of this segment, hidden at rest: shown in the gap when the stalk comes apart
      let servo = null;
      if (k > 0) {
        servo = grp(g, 0.0, 0, 0);
        servo.visible = false;
        const sg = grp(servo);
        put(sg, gearX(12, S.r0 * 1.05, S.r0 * 0.9, 0.026, S.r0 * 0.3, 4), k % 2 ? M.orange : M.gunmetal);
        put(servo, cylX(S.r0 * 0.5, S.r0 * 0.5, 0.1, 18), M.black);
        put(servo, cylX(S.r0 * 0.2, S.r0 * 0.2, 0.16, 10), M.steel);
        servo.userData.gear = sg;
      }
      stalkSegs.push({g, p0: g.position.clone(), q0: g.quaternion.clone(), k, L: S.L, r0: S.r0, servo});
      if (k === 1) anchor('stalk', g, -S.L * 0.4, S.r0 + 0.05, 0);
      if (k === 2) anchor('joint', g, -S.L * 0.9, S.r1 + 0.03, 0);
      parent = g;
      x0 -= S.L;
    });
  }
  // the tail: a white bracket round the hub, the forked fan
  const lastSeg = stalkSegs[stalkSegs.length - 1];
  const tail = grp(lastSeg.g, -lastSeg.L, 0, 0, 'TAIL');
  // ================================================================ fins: milky film, dark rays, a glowing band at the
  // serrated rim
  // A fan in its own frame: the hub at the origin, rays in the xy plane at angs (degrees from +x) of lens, bowed in the
  // plane and cupped out of it; the membrane spans each pair of rays, its outer edge scalloped in between the tips, so
  // the rays stand out of it as points.
  const edgeBand = (memAt, nu, nv, s0) => {
    const pos = [];
    const col = [];
    const idx = [];
    const c = new THREE.Color('#ff7a2a');
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const s = s0 + ((1 - s0) * i) / nu;
        const p = memAt(s, j / nv);
        pos.push(p.x, p.y, p.z);
        const a = Math.pow(smoother((s - s0) / (1 - s0)), 1.1) * 0.82;
        col.push(c.r, c.g, c.b, a);
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
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const buildFan = ({angs, lens, bow = 0.03, cup = 0.05, scal = 0.13, rod = 0.012, start = 0.1, billow = 0.025, band = 0.7, tips = [], sleeves = [], hubR = 0.07}) => {
    const g = new THREE.Group();
    const K = angs.length;
    const dirs = angs.map((a) => new V3(Math.cos(deg(a)), Math.sin(deg(a)), 0));
    const perp = dirs.map((d) => new V3(-d.y, d.x, 0));
    const ray = (k, s) => new V3().addScaledVector(dirs[k], s * lens[k]).addScaledVector(perp[k], bow * lens[k] * Math.sin(Math.PI * s)).add(new V3(0, 0, cup * lens[k] * s * s));
    const sEdge = (w) => 1 - scal * Math.pow(Math.sin(Math.PI * w), 0.7);
    const mem = (k, s, w) => {
      const se = s * sEdge(w);
      const p = ray(k, se).lerp(ray(k + 1, se), w);
      p.z += billow * Math.sin(Math.PI * w) * se * (lens[k] + lens[k + 1]);
      return p;
    };
    const memGeos = [];
    const bandGeos = [];
    const veins = [];
    const joints = [];
    for (let k = 0; k < K - 1; k++) {
      const nu = 26;
      const nv = 8;
      const pos = [];
      const idx = [];
      for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv; j++) {
          const p = mem(k, start + ((1 - start) * i) / nu, j / nv);
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
      memGeos.push(geo);
      bandGeos.push(edgeBand((s, w) => mem(k, s, w), 10, 8, band));
      for (const s of [0.34, 0.58, 0.8]) {
        const pts = [];
        for (let j = 0; j <= 6; j++) pts.push(mem(k, s + (R() - 0.5) * 0.02, j / 6));
        veins.push(tube(pts, 0.0022, 12, 4));
        joints.push(mem(k, s, 0), mem(k, s, 1));
      }
      const pts = [];
      for (let s = 0.32; s <= 1.0001; s += 0.06) pts.push(mem(k, s, 0.5 + 0.04 * Math.sin(s * 9 + k)));
      veins.push(tube(pts, 0.0024, 24, 4));
    }
    const mm = put(g, merge(memGeos), M.fin);
    mm.renderOrder = 2;
    mm.castShadow = false;
    clear.push(mm);
    const bm = put(g, mergeBand(bandGeos), M.finEdge);
    bm.renderOrder = 3;
    bm.castShadow = false;
    clear.push(bm);
    const vv = put(g, merge(veins), M.finVein);
    vv.castShadow = false;
    vv.renderOrder = 4;
    instances(g, new THREE.SphereGeometry(0.006, 8, 6), M.veinCore, joints.map((p) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))).castShadow = false;
    // the rim: a thin glowing thread along the scalloped edge
    const edge = [];
    for (let k = 0; k < K - 1; k++) for (let j = k > 0 ? 1 : 0; j <= 12; j++) edge.push(mem(k, 1, j / 12));
    const ec = new THREE.CatmullRomCurve3(edge, false, 'centripetal');
    put(g, new THREE.TubeGeometry(ec, edge.length * 4, 0.0065, 6, false), M.orange);
    // the rays: dark rods, black clips, a point standing out of the edge at each tip
    for (let k = 0; k < K; k++) {
      const pts = [];
      for (let s = 0; s <= 1.0001; s += 0.125) pts.push(ray(k, s));
      put(g, taperTube(pts, rod, rod * 0.45, 32, 8, 1), M.gunmetal);
      for (const s of [0.3, 0.55, 0.78]) {
        const c = put(g, rbox(0.026, 0.015, 0.015, 0.005), M.black);
        c.position.copy(ray(k, s));
        aimX(c, ray(k, s + 0.01).sub(ray(k, s)));
      }
      const tp = [];
      for (let s = 0.9; s <= 1.0001; s += 0.025) tp.push(ray(k, s));
      tp.push(ray(k, 1).addScaledVector(dirs[k], 0.05 * lens[k] * 0.2 + 0.03));
      put(g, taperTube(tp, rod * 1.1, 0.003, 12, 8, 1), M.orange);
      if (sleeves.includes(k)) {
        const sp = [];
        for (let s = 0.04; s <= 0.34; s += 0.04) sp.push(ray(k, s));
        put(g, taperTube(sp, rod * 2.8, rod * 2.1, 16, 12, 1), M.shell);
      }
      if (tips.includes(k)) {
        const tq = [];
        for (let s = 0.8; s <= 1.0001; s += 0.04) tq.push(ray(k, s));
        put(g, taperTube(tq, rod * 1.6, rod * 0.8, 12, 10, 1), M.orange);
      }
    }
    put(g, new THREE.SphereGeometry(hubR, 24, 16), M.black);
    put(g, new THREE.TorusGeometry(hubR * 1.02, hubR * 0.2, 8, 32), M.gunmetal);
    return g;
  };
  // the dorsal sail: rays rooted in a row along the back, each a spiny rod raking up and back, the film between them
  // scalloped below each tip, the glowing band along the top; the leading ray in a white armour sleeve. Frame: x
  // forward, y up, rooted at the origin.
  const buildSail = ({xs, ys, hs, rake0, rakeAdd, bend, scal = 0.16, band = 0.68}) => {
    const g = new THREE.Group();
    const K = xs.length;
    const C = xs.map((x0, k) => {
      const L = hs[k];
      const pts = [];
      let x = x0;
      let y = ys[k];
      const n = 30;
      pts.push(new V3(x, y, 0));
      for (let i = 1; i <= n; i++) {
        const s = i / n;
        const th = deg(rake0 + rakeAdd * k) + bend * Math.pow(s, 1.5);
        x -= Math.sin(th) * (L / n);
        y += Math.cos(th) * (L / n);
        pts.push(new V3(x, y, 0));
      }
      return (s) => {
        const f = clamp(s, 0, 1) * n;
        const i = Math.min(n - 1, Math.floor(f));
        return pts[i].clone().lerp(pts[i + 1], f - i);
      };
    });
    const sEdge = (w) => 1 - scal * Math.pow(Math.sin(Math.PI * w), 0.75);
    const mem = (k, s, w) => {
      const se = s * sEdge(w);
      const p = C[k](se).lerp(C[k + 1](se), w);
      p.z += 0.02 * Math.sin(Math.PI * w) * se;
      return p;
    };
    const memGeos = [];
    const bandGeos = [];
    const veins = [];
    for (let k = 0; k < K - 1; k++) {
      const nu = 24;
      const nv = 8;
      const pos = [];
      const idx = [];
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
        const p = mem(k, 0.02 + (0.98 * i) / nu, j / nv);
        pos.push(p.x, p.y, p.z);
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j;
        idx.push(a, a + nv + 1, a + 1, a + 1, a + nv + 1, a + nv + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      memGeos.push(geo);
      bandGeos.push(edgeBand((s, w) => mem(k, s, w), 10, 8, band));
      for (const s of [0.3, 0.52, 0.74]) {
        const pts = [];
        for (let j = 0; j <= 5; j++) pts.push(mem(k, s + (R() - 0.5) * 0.02, j / 5));
        veins.push(tube(pts, 0.0024, 10, 4));
      }
      const pts = [];
      for (let s = 0.1; s <= 1.0001; s += 0.08) pts.push(mem(k, s, 0.5));
      veins.push(tube(pts, 0.0026, 20, 4));
    }
    const mm = put(g, merge(memGeos), M.fin);
    mm.renderOrder = 2;
    mm.castShadow = false;
    clear.push(mm);
    const bm = put(g, mergeBand(bandGeos), M.finEdge);
    bm.renderOrder = 3;
    bm.castShadow = false;
    clear.push(bm);
    const vv = put(g, merge(veins), M.finVein);
    vv.castShadow = false;
    vv.renderOrder = 4;
    const edge = [];
    for (let k = 0; k < K - 1; k++) for (let j = k > 0 ? 1 : 0; j <= 12; j++) edge.push(mem(k, 1, j / 12));
    put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, false, 'centripetal'), edge.length * 4, 0.007, 6, false), M.orange);
    for (let k = 0; k < K; k++) {
      const pts = [];
      for (let s = 0; s <= 1.0001; s += 0.05) pts.push(C[k](s));
      put(g, taperTube(pts, 0.034, 0.011, 40, 10, 1), M.gunmetal);
      const tp = [];
      for (let s = 0.86; s <= 1.0001; s += 0.035) tp.push(C[k](s));
      const tan = C[k](1).sub(C[k](0.97)).normalize();
      tp.push(C[k](1).addScaledVector(tan, 0.06));
      put(g, taperTube(tp, 0.016, 0.003, 14, 8, 1), M.orange);
      for (const s of [0.28, 0.5, 0.7]) {
        const c = put(g, ring(-0.012, 0.012, 0.02, 0.04, 0.004), M.gunmetal);
        c.position.copy(C[k](s));
        aimX(c, C[k](s + 0.01).sub(C[k](s)));
      }
      const sl = [];
      for (let s = 0; s <= (k === 0 ? 0.72 : 0.3); s += 0.02) sl.push(C[k](s));
      put(g, taperTube(sl, k === 0 ? 0.058 : 0.046, k === 0 ? 0.028 : 0.036, 24, 12, 1), M.shell);
      put(g, cylX(0.05, 0.05, 0.05, 16).rotateZ(Math.PI / 2), M.gunmetal, C[k](0).x, C[k](0).y - 0.01, 0);
    }
    return g;
  };
  // merge the band geometries with their 4-component colour
  function mergeBand(geos) {
    const pos = [];
    const col = [];
    const nor = [];
    for (const gg of geos) {
      const g2 = gg.toNonIndexed();
      pos.push(...g2.attributes.position.array);
      col.push(...g2.attributes.color.array);
      nor.push(...g2.attributes.normal.array);
    }
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    o.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    return o;
  }

  // the tail fan: big and forked, the outer rays long
  let tailFan = null;
  {
    put(tail, ring(-0.02, 0.1, 0.17, 0.27, 0.02), M.shell);
    put(tail, ring(0.1, 0.13, 0.15, 0.24, 0.01), M.black);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = put(tail, cylX(0.015, 0.015, 0.02, 10), M.gunmetal, 0.04, Math.cos(a) * 0.272, Math.sin(a) * 0.272);
      aimX(m, new V3(0, Math.cos(a), Math.sin(a)));
    }
    const angs = [];
    const lens = [];
    // round 3: as tall as the body, forked into two broad lobes, fewer and bolder rays
    for (let k = 0; k < 11; k++) {
      const a = -62 + (124 * k) / 10;
      angs.push(180 + a);
      lens.push(0.46 + 0.98 * Math.pow(Math.abs(a) / 62, 1.5));
    }
    tailFan = grp(tail, -0.03, 0, 0);
    tailFan.add(buildFan({angs, lens, bow: 0.025, cup: 0.02, scal: 0.05, rod: 0.022, sleeves: [0, 1, 9, 10], hubR: 0.11, band: 0.6}));
    anchor('tail', tailFan, -0.95, 0.3, 0);
    anchor('tailHub', tail, 0.05, 0.27, 0);
  }
  // the dorsal sail on the crest
  const dorsal = grp(root, 0, 0, 0, 'DORSAL');
  {
    // each ray roots on the crest's height at its x
    // round 3: six broad panels between seven bold white-sheathed spines, raked well back, rooted from the hump
    const xs = [0.04, -0.18, -0.4, -0.62, -0.84, -1.04, -1.22];
    const sail = buildSail({xs, ys: xs.map((x) => (x > 0 ? Math.max(AXIS_Y + RB(x), topU(x)) : AXIS_Y + RB(x)) + 0.02), hs: [0.52, 0.62, 0.66, 0.64, 0.58, 0.48, 0.36], rake0: 40, rakeAdd: 3, bend: deg(20), scal: 0.2});
    dorsal.add(sail);
    anchor('spine', sail, -0.5, 1.5, 0);
  }
  // the pectoral fins (WING): a fan on a mechanical hub (a pivot drum, a cone, a strut down to the fan), low behind
  // the mouth corner, swept back and down, tilted out toward the viewer
  const pecs = [];
  for (const [si, side] of mirror(root).entries()) {
    const hz = 0.48;
    const hub = grp(side, -0.05, -0.4, hz, si === 0 ? 'WING' : 'WING_far');
    put(hub, ring(-0.05, 0.05, 0.1, 0.17, 0.015).rotateY(-Math.PI / 2), M.shell);
    put(hub, cylZ(0.095, 0.095, 0.16, 28), M.gunmetal, 0, 0, 0.06);
    put(hub, cylZ(0.105, 0.105, 0.025, 28), M.black, 0, 0, 0.13);
    put(hub, new THREE.ConeGeometry(0.07, 0.12, 24).rotateX(Math.PI / 2), M.steel, 0, 0, 0.2);
    put(hub, cylZ(0.11, 0.11, 0.014, 28), M.gunmetal, 0, 0, 0.0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      put(hub, cylZ(0.012, 0.012, 0.02, 8), M.steel, Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.145);
    }
    const orient = grp(hub, 0, 0, 0.1);
    orient.rotation.set(deg(-14), deg(20), 0);
    const angs = [];
    const lens = [];
    for (let k = 0; k < 8; k++) {
      angs.push(186 + (48 * k) / 7);
      lens.push(1.02 - 0.32 * Math.pow(k / 7, 1.2));
    }
    const fan = buildFan({angs, lens, bow: -0.04, cup: 0.05, scal: 0.12, rod: 0.014, sleeves: [0], tips: [], hubR: 0.07, band: 0.64});
    orient.add(fan);
    // the strut: a steel rod from the drum down to the fan's lower ray, black sleeves on it
    {
      const a = deg(angs[5]);
      const end = new V3(Math.cos(a) * lens[5] * 0.42, Math.sin(a) * lens[5] * 0.42, 0);
      const sg = grp(orient);
      sg.position.set(0, 0, 0.02);
      const d = end.length();
      const st = grp(sg);
      aimX(st, end);
      put(st, cylX(0.018, 0.018, d, 12), M.steel, d / 2, 0, 0);
      put(st, cylX(0.03, 0.03, d * 0.4, 14), M.black, d * 0.3, 0, 0);
      put(st, new THREE.SphereGeometry(0.032, 14, 10), M.gunmetal, d, 0, 0);
    }
    pecs.push({hub, orient});
    if (si === 0) {
      anchor('fin', fan, -0.75, -0.25, 0);
      anchor('finHub', hub, 0, 0, 0.2);
    }
  }
  // small fins: a pelvic pair under the throat, a ventral pair under the belly, an anal fin before the stalk
  const smalls = [];
  for (const [si, side] of mirror(root).entries()) {
    for (const [x, y, z, angs, lens, rx] of [
      [0.08, -0.62, 0.2, [214, 232, 250, 264], [0.36, 0.4, 0.36, 0.28], -20],
      [-0.62, -0.56, 0.15, [200, 220, 240, 258], [0.44, 0.48, 0.44, 0.34], -18],
    ]) {
      const v = grp(side, x, y, z);
      v.rotation.set(deg(rx), 0, 0);
      v.add(buildFan({angs, lens, rod: 0.008, hubR: 0.04, scal: 0.16, band: 0.62}));
      put(v, cylZ(0.05, 0.05, 0.05, 18), M.gunmetal);
      smalls.push(v);
    }
    if (si === 0) {
      const a = grp(side, -1.18, AXIS_Y - RB(-1.18) * 0.95, 0.0);
      a.add(buildFan({angs: [200, 220, 240, 258], lens: [0.46, 0.52, 0.46, 0.34], rod: 0.009, hubR: 0.04, scal: 0.16, band: 0.62}));
      smalls.push(a);
    }
  }

  // ================================================================ floating debris: hidden inside the body until the
  // full explode throws it out
  const debris = grp(root, 0, 0, 0, 'DEBRIS');
  const D = [];
  {
    const centres = [
      [-0.5, 0.15, 0],
      [0.55, 0.35, 0],
      [0.85, -0.5, 0],
      [-1.2, 0.15, 0],
    ];
    const add = (obj, d0, d1) => {
      const c = centres[Math.floor(R2() * centres.length)];
      const dir = new V3(R2() * 2 - 1, R2() * 2 - 1, R2() * 2 - 1);
      dir.x *= 1.6;
      dir.normalize();
      const home = new V3(c[0] + dir.x * 0.25, c[1] + dir.y * 0.25, c[2] + dir.z * 0.25);
      obj.position.copy(home);
      obj.rotation.set(R2() * 6.28, R2() * 6.28, R2() * 6.28);
      obj.visible = false;
      debris.add(obj);
      D.push({obj, home, q0: obj.quaternion.clone(), dir, dist: d0 + (d1 - d0) * R2(), axis: new V3(R2() - 0.5, R2() - 0.5, R2() - 0.5).normalize(), ang: 1 + R2() * 2.5, s: R2() * 0.18});
    };
    for (let k = 0; k < 46; k++) {
      const g = new THREE.Group();
      const r = 0.02 + R2() * 0.045;
      put(g, new THREE.SphereGeometry(r, 20, 14), M.black);
      if (k % 6 === 0) put(g, new THREE.TorusGeometry(r * 1.02, r * 0.22, 8, 24), M.orange);
      add(g, 1.0, 2.5);
    }
    for (let k = 0; k < 14; k++) {
      const g = new THREE.Group();
      put(g, cylX(0.018, 0.018, 0.16, 10), M.steel);
      put(g, cylX(0.034, 0.034, 0.03, 6), M.gunmetal, 0.08, 0, 0);
      add(g, 0.9, 2.3);
    }
    for (let k = 0; k < 10; k++) {
      const g = new THREE.Group();
      put(g, gearGeo(12, 0.07 + R2() * 0.04, 0.058, 0.024, 0.02), k % 3 ? M.graphite : M.orange);
      add(g, 1.0, 2.4);
    }
    for (let k = 0; k < 9; k++) {
      const g = new THREE.Group();
      const w = 0.1 + R2() * 0.1;
      put(g, rbox(w, w * (0.6 + R2() * 0.5), w * (0.7 + R2() * 0.4), 0.018), M.orange);
      add(g, 1.3, 2.6);
    }
  }
  {
    const p = FL(0.8, 0.55);
    anchor('jaw', jaw, p.x, p.y, p.z);
    const lo = teeth.filter((T) => T.row === 'lo' && T.side > 0).sort((a, b) => Math.abs(a.along - 0.25) - Math.abs(b.along - 0.25))[0];
    const up = teeth.filter((T) => T.row === 'up' && T.side > 0).sort((a, b) => Math.abs(a.along - 0.3) - Math.abs(b.along - 0.3))[0];
    anchor('fang', lo.o, 0, 0, 0);
    anchor('upfang', up.o, 0, 0, 0);
  }
  // the angler's anchor names, so its film (tour_bee.js, sim_bee.js) ports without edits: the lure's bulb and cage are
  // the tail hub and fan, its shields the ribs, its piston carousel the coils, its glass dome the eye's outer ring
  for (const [alias, key] of [
    ['bulb', 'tailHub'],
    ['cage', 'tail'],
    ['shield', 'rib'],
    ['barrels', 'coil'],
    ['eyeGlass', 'eyeRing'],
  ])
    anchors[alias] = anchors[key];

  // ================================================================ pose
  const slots = {OPTICS: eyes[0], WING: pecs[0].hub, LEG: stalk, THORAX: body, ABDOMEN: jaw};
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const AX = new V3(1, 0, 0);
  const AY = new V3(0, 1, 0);
  const AZ = new V3(0, 0, 1);
  const tv = new V3();
  const tv2 = new V3();
  const HOME = new Map();
  for (const o of [jaw, stalk, tail, tailFan, throat, kitG, dorsal, spikeG, ...brows, ...eyes, ...pecs.map((p) => p.hub), ...smalls, ...glass.map((g) => g.o), ...ribs.map((r) => r.o), ...coils.map((c) => c.o), ...plates]) HOME.set(o, {p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone()});
  const home = (o) => {
    const h = HOME.get(o);
    o.position.copy(h.p);
    o.quaternion.copy(h.q);
    o.scale.copy(h.s);
    return o;
  };
  // each skull and jaw plate lifts off along the line from its cap's centre through its middle in the explode
  const plateDirs = plates.map((g) => {
    const geo = g.children[0].geometry;
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new V3());
    const isJaw = jaw.children.includes(g) || jawSides.some((s) => s.children.includes(g));
    return c.sub(isJaw ? CL : CU).normalize();
  });
  const eyeAxes = eyes.map((e2) => new V3(1, 0, 0).applyQuaternion(e2.children[0].quaternion));
  // idle 0..1: the breathing jaw, the swaying tail, the undulating fins; swim 0..1 the heavy stroke. gape: the lower
  // jaw's drop in degrees. The teardowns, each 0..1, on the angler's five: eye (the rings unscrew out along the axis,
  // the iris opens), fin / finFlip (the near pectoral out of its hub and turned over), lure (the tail stalk telescopes
  // apart, a servo spinning in every joint), cage (the tail fan spreads), flare (the coils and the throat burn
  // brighter), rib (the near glass lifts off, the ribs swing up on their hinges, the gears and coils slide out
  // spinning), drop (the lower jaw drops away) and teeth (the fang rows fly out along their rims). explode 0..1:
  // everything apart. spinT: the clock the gears and loose parts turn on. bend: [[about z, about y], ...] per stalk
  // joint, the lag the film adds as the fish turns.
  const pose = ({t = 0, idle = 1, gape = GAPE_LO, swim = 0, eye = 0, fin = 0, finFlip = 0, lure: lureOpen = 0, cage: cageOpen = null, flare = 0, rib = 0, drop = 0, teeth: teethOpen = null, explode = 0, spinT = t, bend = null, tailYaw = 0} = {}) => {
    const k = idle;
    const e = clamp(explode, 0, 1);
    const kFar = ssw(e, 0.35, 1.0);
    const eyeK = Math.max(eye, ssw(e, 0.05, 0.5));
    const finK = Math.max(fin, ssw(e, 0.0, 0.45));
    const stalkK = Math.max(lureOpen, ssw(e, 0.1, 0.55));
    const fanK = Math.max(cageOpen ?? lureOpen, ssw(e, 0.15, 0.6));
    const flareK = Math.max(flare, 0.5 * ssw(e, 0.2, 0.6));
    const ribK = Math.max(rib, ssw(e, 0.0, 0.5));
    const ribFar = ssw(e, 0.0, 0.5);
    const dropK = Math.max(drop, ssw(e, 0.05, 0.5));
    const teethK = Math.max(teethOpen ?? drop, ssw(e, 0.1, 0.6));

    // ---- the jaw: it breathes, snaps through gape, drops away off the hinge; the fangs fly out along the rims
    home(jaw);
    jaw.rotation.z = -deg(gape + 2.5 * k * Math.sin(t * 1.9) + 14 * dropK + 8 * dropK * Math.sin(spinT * 0.9));
    jaw.position.add(tv.set(0.16 * dropK + 0.5 * kFar, -0.32 * dropK - 0.32 * kFar, 0));
    for (const T of teeth) {
      const d0 = 0.06 + 0.3 * T.along + (T.row === 'up' ? 0.05 : 0);
      const kk = ssw(teethK, d0, d0 + 0.55);
      T.o.position.copy(T.home);
      T.o.quaternion.copy(T.q0);
      if (kk <= 0) continue;
      const wave = 0.07 * kk * Math.sin(spinT * 0.95 - T.along * 7 + (T.row === 'up' ? 1.5 : 0));
      const dist = (0.26 + 0.16 * T.L) * kk * (1 + 1.3 * kFar) + wave;
      tv2.crossVectors(T.down, T.out).normalize();
      T.o.position.addScaledVector(T.out, dist).addScaledVector(T.down, 0.07 * kk).addScaledVector(tv2, 0.09 * kk * Math.cos(spinT * 0.95 - T.along * 7) * T.side);
      T.o.quaternion.setFromAxisAngle(tv2, -0.45 * kk + 3 * wave).multiply(q.setFromAxisAngle(T.down, T.spin * kk + kk * 0.5 * spinT * Math.sign(T.spin)));
    }
    if (throat) {
      home(throat).position.add(tv.set(0.1 * kFar, -0.35 * kFar, 0));
      throat.children.forEach((c) => {
        if (c.isPointLight) c.intensity = 1.4 * (1 + 2 * flareK);
      });
    }

    // ---- the eye: the stepped rings and the lens unscrew out along the axis, three hidden rings follow, the iris opens
    for (const p of eyeRig.parts) {
      const kk = ssw(eyeK, p.s, Math.min(1, p.s + 0.72));
      p.o.position.copy(p.home);
      p.o.quaternion.copy(p.q0);
      p.o.position.x += p.off * kk * (1 + 0.5 * kFar);
      if (p.spin) p.o.quaternion.premultiply(q.setFromAxisAngle(AX, p.spin * kk * (1 + 0.35 * spinT)));
    }
    {
      const ex = eyeRig;
      ex.extra.visible = eyeK > 0.002;
      const kr = ssw(eyeK, 0.14, 0.86);
      for (const [o, off, sp] of ex.rings) {
        o.position.x = off * kr * (1 + 0.5 * kFar + 0.12 * Math.sin(spinT * 0.9 + off * 9));
        o.rotation.x = sp * kr * (1 + 0.35 * spinT);
      }
      const ki = ssw(eyeK, 0.5, 1.0);
      ex.iris.rotation.x = 0.7 * ki;
      for (const b of ex.blades) b.o.rotation.x = b.a + deg(12 + 70 * ki - 16 * ki * (0.5 + 0.5 * Math.sin(spinT * 1.6)));
    }
    eyes.forEach((e2, i) => home(e2).position.addScaledVector(eyeAxes[i], 1.0 * kFar));
    brows.forEach((b) => home(b).position.add(tv.set(0.1 * kFar, 0.75 * kFar, 0)));
    home(spikeG).position.y += 0.9 * kFar;

    // ---- the pectoral fins: the heavy row while swimming; the near one leaves its hub and turns over
    pecs.forEach((p, i) => {
      p.orient.rotation.x = deg(-14) + (0.1 * k + 0.2 * swim) * Math.sin(t * 2.2 + i);
      p.orient.rotation.y = deg(20) + (0.06 * k + 0.12 * swim) * Math.sin(t * 2.2 + 0.8 + i);
      const o = i === 0 ? finK : ssw(e, 0.0, 0.45);
      const fl = i === 0 ? finFlip : 0;
      home(p.hub).position.add(tv.set(0.8 * o - 0.7 * kFar + 0.45 * Math.sin(Math.PI * 2 * fl), -0.3 * o - 0.3 * kFar + 0.38 * Math.sin(Math.PI * fl), 1.0 * o + 0.5 * kFar));
      p.hub.quaternion.setFromAxisAngle(AX, Math.PI * 2 * fl + 0.5 * spinT * kFar).multiply(q.setFromAxisAngle(AZ, 0.22 * o + 0.18 * Math.sin(Math.PI * fl)));
    });

    // ---- the tail stalk: segment by segment from the root, a servo spinning in each gap; the fan sweeps and spreads
    home(stalk).position.x -= 0.35 * kFar;
    for (const S of stalkSegs) {
      const kk = ssw(stalkK, S.k * 0.08, S.k * 0.08 + 0.5);
      const gap = 0.16 * kk * (1 + 0.6 * kFar);
      S.g.position.copy(S.p0);
      S.g.position.x -= gap;
      const bz = bend ? bend[S.k]?.[0] ?? 0 : 0;
      const by = bend ? bend[S.k]?.[1] ?? 0 : 0;
      const turn = kk * 0.25 * Math.sin(spinT * 0.55 + S.k * 1.3);
      S.g.quaternion.copy(S.q0).multiply(q.setFromAxisAngle(AY, 0.05 * k * Math.sin(t * 1.6 - S.k * 0.5) + 0.12 * swim * Math.sin(t * 3.1 - S.k * 0.5) + by)).multiply(q.setFromAxisAngle(AZ, bz + 0.6 * turn));
      if (S.servo) {
        S.servo.visible = kk > 0.01;
        S.servo.position.x = gap * 0.5;
        S.servo.scale.setScalar(Math.max(1e-3, Math.min(1, kk * 2)));
        S.servo.userData.gear.rotation.x = spinT * (S.k % 2 ? 2.2 : -2.2);
      }
    }
    home(tail);
    tail.rotation.y = tailYaw + 0.12 * k * Math.sin(t * 1.6 - 2) + 0.35 * swim * Math.sin(t * 3.1 - 2);
    tail.position.x -= 0.6 * kFar;
    home(tailFan).scale.set(1, 1 + 0.25 * fanK, 1);
    tailFan.rotation.x = 0.4 * fanK * Math.sin(spinT * 0.8);

    // ---- the dorsal sail, the small fins
    home(dorsal).position.y += 0.75 * kFar;
    dorsal.rotation.z = 0.03 * k * Math.sin(t * 1.4) + 0.08 * swim * Math.sin(t * 3.1) + 0.2 * kFar;
    smalls.forEach((s2, i) => {
      home(s2).position.y -= 0.6 * kFar;
      s2.rotation.z = 0.1 * k * Math.sin(t * 2.6 + i) + 0.2 * swim * Math.sin(t * 3.1 + i);
    });

    // ---- the skull's and the jaw's plates lift off in the explode
    plates.forEach((g, i) => home(g).position.addScaledVector(plateDirs[i], 0.5 * kFar));

    // ---- the flank: the near glass lifts off and out, the ribs swing up on their top hinges one after another, the
    // gill plates step out, the gears and the coils slide out and spin; the coils burn brighter while it is open
    for (const G of glass) {
      const own = G.side === 0 ? ribK : ribFar;
      const kk = ssw(own, 0.0, 0.5);
      home(G.o).position.add(tv.set(0.05 * kk, 0.35 * kk + 0.3 * kFar, (0.55 * kk + 0.6 * kFar) / SQZ));
      G.o.rotation.x = -0.25 * kk;
    }
    for (const Rb of ribs) {
      const own = Rb.side === 0 ? ribK : ribFar;
      const kk = ssw(own, 0.1 + Rb.k * 0.04, 0.6 + Rb.k * 0.04);
      home(Rb.o);
      if (Rb.gill) Rb.o.position.add(tv.set(0.04 * kk, 0.05 * kk * Math.cos(Rb.a), (0.3 * kk + 0.7 * kFar) / SQZ));
      else {
        Rb.o.rotation.x = -deg(70 + 8 * Math.sin(spinT * 1.1 + Rb.k)) * kk;
        Rb.o.position.z += (0.1 * kk + 0.7 * kFar) / SQZ;
      }
    }
    for (const Mh of mech) {
      const own = Mh.side === 0 ? ribK : ribFar;
      const kk = ssw(own, 0.3 + Mh.s, 0.8 + Mh.s);
      Mh.o.position.copy(Mh.home);
      Mh.o.position.z += (Mh.out * kk * (1 + 1.2 * kFar + 0.15 * Math.sin(spinT * 0.8 + Mh.s * 9))) / SQZ;
      Mh.wheel.rotation.z = Mh.rate * spinT * (1 + 4 * kk);
    }
    for (const C of coils) {
      const own = C.side === 0 ? ribK : ribFar;
      const kk = ssw(own, C.s, C.s + 0.5);
      home(C.o).position.z += ((0.3 * kk + 0.8 * kFar) / SQZ);
      C.o.rotation.y = 0.4 * kk * Math.sin(spinT * 0.7 + C.s * 7);
    }
    M.coil.emissiveIntensity = 3.2 * (1 + 1.5 * flareK);
    if (kitG) home(kitG).scale.setScalar(1 + 0.12 * kFar);

    // ---- loose parts
    for (const d of D) {
      const kk = Math.pow(ssw(e, d.s, 0.95), 0.75);
      d.obj.position.copy(d.home).addScaledVector(d.dir, d.dist * kk);
      d.obj.quaternion.copy(d.q0).multiply(q2.setFromAxisAngle(d.axis, d.ang * kk + 0.9 * spinT * kFar));
      const sc = ssw(e, d.s * 0.5, d.s * 0.5 + 0.08);
      d.obj.scale.setScalar(Math.max(1e-4, sc));
      d.obj.visible = sc > 0.001;
    }
  };
  pose({});

  root.traverse((o) => {
    if (o.isMesh && o.material && (o.material.transparent || o.material.transmission > 0)) {
      o.castShadow = false;
      if (!clear.includes(o)) clear.push(o);
    }
  });
  const anchorAt = (key, out = new V3()) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return out.copy(a.at).applyMatrix4(a.obj.matrixWorld);
  };
  return {root, pose, clear, M, slots, anchors, anchorAt, teeth, stalkSegs, ribs, mech, coils};
}
