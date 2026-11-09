// The robotic bee's kitbash shop: the materials (gloss white shell, orange accent, graphite and black mechanism,
// steel, the lens, the clear abdomen and the wing membrane) and the geometry every part is cut from. Everything is
// built along +x and placed by the caller: sweepX turns a closed (x, r) profile round the x axis, whole or as an arc
// with capped ends, which gives rings, collars, domes, shell plates and capsules from one function; gearGeo cuts a
// toothed wheel with a bore; tube runs a cable along points.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const V3 = THREE.Vector3;
export const D2R = Math.PI / 180;
export const PAL = {white: '#f4f2ee', orange: '#ff5a1f', graphite: '#2f3238', black: '#111214', steel: '#cdd1d6'};

export function makeMaterials() {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    // the white plastic: a soft base under a hard clear coat, so the softboxes sit on it as crisp bars
    shell: phys({color: PAL.white, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05}),
    // inside faces of the shells, a shade darker and matte
    shellIn: phys({color: '#dedad4', roughness: 0.6, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.4, side: THREE.DoubleSide}),
    orange: phys({color: PAL.orange, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08}),
    // the orange panel at a wing tip: a film on the membrane, both faces, pulled forward so it never fights it
    orangeFilm: phys({color: PAL.orange, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}),
    graphite: std({color: PAL.graphite, roughness: 0.36, metalness: 0.72}),
    gunmetal: std({color: '#555a62', roughness: 0.28, metalness: 0.9}),
    black: phys({color: PAL.black, roughness: 0.3, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.12}),
    rubber: std({color: '#1b1c1f', roughness: 0.7, metalness: 0}),
    steel: std({color: PAL.steel, roughness: 0.2, metalness: 1}),
    // the camera eye: a deep black inner element under a dark glass dome; its colour darkens only what shows
    // through it, the highlights stay at full strength
    lens: phys({color: '#020203', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4}),
    lensGlass: phys({color: '#6f7277', roughness: 0, metalness: 0, transmission: 1, thickness: 0, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, envMapIntensity: 2.4}),
    amber: std({color: '#000000', emissive: '#ffa040', emissiveIntensity: 4.5}),
    // circuit boards in the thorax: a dark green-black laminate
    pcb: std({color: '#1b241f', roughness: 0.55, metalness: 0.1}),
    // the clear abdomen window: real transmission, so the mechanism inside refracts a touch
    glass: phys({color: '#ffffff', roughness: 0.0, metalness: 0, transmission: 1, thickness: 0, ior: 1.3, specularIntensity: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.02}),
    // the wing film: a faint grey-white sheet; the veins and the rim carry the read
    membrane: phys({color: '#eef0f2', roughness: 0.38, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.35, iridescenceIOR: 1.3}),
    // the wing rim: a pale clear-ish tube
    rim: phys({color: '#e4e7ea', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.55, depthWrite: false}),
    vein: std({color: '#4a4d53', roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.72}),
    veinCore: std({color: '#5a5d63', roughness: 0.5, metalness: 0.2}),
    led: std({color: '#000000', emissive: PAL.orange, emissiveIntensity: 1.4}),
    // the wasp: the orange light inside the waist rings, the abdomen gaps and the sting, a touch hotter than led
    glow: std({color: '#000000', emissive: '#ff6a1c', emissiveIntensity: 1.9}),
    // the sting: clear glass tinted toward amber, the glow core shows through it
    // a faint amber tint in the glass itself
    sting: phys({color: '#fff0e2', roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.035, ior: 1.3, attenuationColor: '#ffb27a', attenuationDistance: 1.4, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8}),
    // the sting's rim: a fresnel edge in warm amber over the glass, strongest where the surface turns from the eye
    stingRim: new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {uColor: {value: new THREE.Color('#7c5236')}, uK: {value: 0.85}},
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uK; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(uColor, f * uK); }',
    }),
    stingCore: std({color: '#000000', emissive: '#ff7424', emissiveIntensity: 2.0}),
  };
}

// ------------------------------------------------------------ sweepX: a closed (x, r) profile turned round the x axis
// profile: [[x, r], ...] closed loop, either winding. a0..a1: the arc, angle 0 at +y, 90° at +z. Profile corners
// sharper than `smooth` degrees keep a hard edge; softer ones are shaded smooth. A partial arc gets capped ends.
export function sweepX(profile, {a0 = 0, a1 = Math.PI * 2, segs = 64, smooth = 32} = {}) {
  let P = profile.map(([x, r]) => [x, Math.max(0, r)]);
  let area = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, r0] = P[i];
    const [x1, r1] = P[(i + 1) % P.length];
    area += x0 * r1 - x1 * r0;
  }
  if (area < 0) P = P.reverse();
  const n = P.length;
  // outward edge normals in the (x, r) plane
  const EN = [];
  for (let i = 0; i < n; i++) {
    const [x0, r0] = P[i];
    const [x1, r1] = P[(i + 1) % n];
    const l = Math.hypot(x1 - x0, r1 - r0) || 1;
    EN.push([(r1 - r0) / l, -(x1 - x0) / l]);
  }
  const cosS = Math.cos(smooth * D2R);
  const vN = (i, e) => {
    // normal at vertex i as seen from edge e (e is i-1 or i)
    const other = e === i ? (i - 1 + n) % n : i;
    const a = EN[e];
    const b = EN[other];
    if (a[0] * b[0] + a[1] * b[1] < cosS) return a;
    const x = a[0] + b[0];
    const y = a[1] + b[1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
  const pos = [];
  const nor = [];
  const idx = [];
  const cs = [];
  for (let j = 0; j <= segs; j++) {
    const th = a0 + ((a1 - a0) * j) / segs;
    cs.push([Math.cos(th), Math.sin(th)]);
  }
  for (let e = 0; e < n; e++) {
    const i0 = e;
    const i1 = (e + 1) % n;
    const [x0, r0] = P[i0];
    const [x1, r1] = P[i1];
    if (Math.hypot(x1 - x0, r1 - r0) < 1e-9) continue;
    const n0 = vN(i0, e);
    const n1 = vN(i1, e);
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const [c, s] = cs[j];
      pos.push(x0, r0 * c, r0 * s, x1, r1 * c, r1 * s);
      nor.push(n0[0], n0[1] * c, n0[1] * s, n1[0], n1[1] * c, n1[1] * s);
    }
    for (let j = 0; j < segs; j++) {
      const a = base + j * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      idx.push(a, b, c, a, c, d);
    }
  }
  if (!full) {
    const tri = THREE.ShapeUtils.triangulateShape(
      P.map(([x, r]) => new THREE.Vector2(x, r)),
      [],
    );
    for (const [th, flip] of [
      [a0, true],
      [a1, false],
    ]) {
      const c = Math.cos(th);
      const s = Math.sin(th);
      // the cap's normal: -d/dθ at a0, +d/dθ at a1
      const nx = 0;
      const ny = flip ? s : -s;
      const nz = flip ? -c : c;
      const base = pos.length / 3;
      for (const [x, r] of P) {
        pos.push(x, r * c, r * s);
        nor.push(nx, ny, nz);
      }
      for (const t of tri) {
        if (flip) idx.push(base + t[0], base + t[2], base + t[1]);
        else idx.push(base + t[0], base + t[1], base + t[2]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// a rounded rectangle profile for a ring: x0..x1 wide, r0..r1 deep, corners rounded by `round`
export function ringProfile(x0, x1, r0, r1, round = 0.01, steps = 3) {
  const rr = Math.min(round, (x1 - x0) / 2.01, (r1 - r0) / 2.01);
  const pts = [];
  const corner = (cx, cr, a0) => {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k / steps) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rr, cr + Math.sin(a) * rr]);
    }
  };
  corner(x1 - rr, r0 + rr, -Math.PI / 2);
  corner(x1 - rr, r1 - rr, 0);
  corner(x0 + rr, r1 - rr, Math.PI / 2);
  corner(x0 + rr, r0 + rr, Math.PI);
  return pts;
}
export const ring = (x0, x1, r0, r1, round, opts) => sweepX(ringProfile(x0, x1, r0, r1, round), opts);

// a thick spherical shell from polar angle p0 to p1 (0 = +x pole), outer radius R, wall t; the rims stay sharp so
// the clear coat draws a crisp line along them
export function domeProfile(R, t, p0, p1, steps = 24) {
  const out = [];
  const inn = [];
  for (let k = 0; k <= steps; k++) {
    const p = p0 + ((p1 - p0) * k) / steps;
    out.push([R * Math.cos(p), R * Math.sin(p)]);
    inn.push([(R - t) * Math.cos(p), (R - t) * Math.sin(p)]);
  }
  return [...out, ...inn.reverse()];
}
export const dome = (R, t, p0, p1, opts) => sweepX(domeProfile(R, t, p0, p1), opts);

// a solid of revolution from a radius function: r(u) for u in 0..1 along x0..x1, closed to the axis at both ends
export function solidProfile(x0, x1, rFn, steps = 32) {
  const pts = [[x0, 0]];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    pts.push([x0 + (x1 - x0) * u, rFn(u)]);
  }
  pts.push([x1, 0]);
  return pts;
}
export const solid = (x0, x1, rFn, opts, steps) => sweepX(solidProfile(x0, x1, rFn, steps), opts);
// a capsule-like rounded radius: r0 at the start, r1 at the end, ends rounded over `cap` of the length
export const capsuleR = (r0, r1, cap = 0.12) => (u) => {
  const r = r0 + (r1 - r0) * u;
  const e = Math.min(u, 1 - u) / cap;
  return e >= 1 ? r : r * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)));
};

// ------------------------------------------------------------ gears, boxes, tubes
// a spur gear around +z: `teeth` teeth between rRoot and rOut, `width` thick, a bore of holeR, lightening holes
export function gearGeo(teeth, rOut, rRoot, width, holeR = 0, spokes = 0) {
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts = [
      [rRoot, a0],
      [rRoot, a0 + da * 0.18],
      [rOut, a0 + da * 0.32],
      [rOut, a0 + da * 0.6],
      [rRoot, a0 + da * 0.74],
    ];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(r * Math.cos(a), r * Math.sin(a)) : sh.lineTo(r * Math.cos(a), r * Math.sin(a))));
  }
  sh.closePath();
  if (holeR) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  // round lightening holes between the bore and the rim
  if (spokes) {
    const rc = (holeR + rRoot) / 2;
    const rh = Math.min((rRoot - holeR) * 0.3, (Math.PI * rc) / spokes * 0.55);
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * rc, Math.sin(a) * rc, rh, 0, Math.PI * 2, true);
      sh.holes.push(h);
    }
  }
  const bev = Math.min(width * 0.18, (rOut - rRoot) * 0.3);
  const g = new THREE.ExtrudeGeometry(sh, {depth: width - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 1, curveSegments: 10});
  g.translate(0, 0, -(width - bev * 2) / 2);
  return g;
}
// the same gear with its axis along +x
export const gearX = (...a) => gearGeo(...a).rotateY(Math.PI / 2);

export const rbox = (w, h, d, r = 0.01) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
export const cylX = (r0, r1, len, seg = 32) => new THREE.CylinderGeometry(r1, r0, len, seg).rotateZ(-Math.PI / 2);
export const cylZ = (r0, r1, len, seg = 32) => new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2);

/** A cable or rod through points (Vector3 or arrays), radius r. */
export function tube(points, r, tubular = 64, radial = 10, closed = false) {
  const pts = points.map((p) => (p.isVector3 ? p : new V3(...p)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5), tubular, r, radial, closed);
}

/** A coil spring along +x: radius R, wire r, `turns` over len. */
export function coil(R, r, turns, len, seg = 240) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = u * turns * Math.PI * 2;
    pts.push(new V3(u * len, Math.cos(a) * R, Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, false);
}

export const merge = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
  // mergeGeometries wants identical attribute sets: keep position and normal only
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', g.attributes.position);
  o.setAttribute('normal', g.attributes.normal);
  return o;
}));

/** Put a mesh of geo/mat at (x, y, z) into parent; returns it. Every mesh casts and takes shadows. */
export function put(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Rotate an object so its local +x points along dir. */
export function aimX(obj, dir) {
  obj.quaternion.setFromUnitVectors(new V3(1, 0, 0), dir.clone().normalize());
  return obj;
}

/** Instances of one geometry at a list of matrices (casts and takes shadows). */
export function instances(parent, geo, mat, mats) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = true;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}
