// The construction drawing around the scorpion, copied from the bee's (robobee-shared/guides.js) with a centre and a
// scale: hairline arcs and dashed circles in a few tilted planes, dots and small hollow markers riding on them, short
// ticks. All in world space round the scorpion, so a camera orbit gives them depth. Lines are fat lines with a width
// in device pixels; resize() keeps them hairline at any pixel ratio.
import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {rng} from '../kit/util.js';

const V3 = THREE.Vector3;
const INK = '#8a8178';

export function buildGuides({centre = [0.05, 0.1, 0], seed = 5, scale = 1} = {}) {
  const R = rng(seed);
  const group = new THREE.Group();
  const lines = [];
  const C = new V3(...centre);
  // two unit vectors spanning the plane with normal n
  const basis = (n) => {
    const a = Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
    const u = new V3().crossVectors(a, n).normalize();
    return [u, new V3().crossVectors(n, u)];
  };
  const circ = (c, r, n, a) => {
    const [u, v] = basis(n.clone().normalize());
    return c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
  };
  const arc = (c, r, n, a0, a1, {dashed = false, width = 1, opacity = 0.5, dash = 0.045} = {}) => {
    const N = Math.max(24, Math.round(Math.abs(a1 - a0) * r * 60));
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const p = circ(c, r, n, a0 + ((a1 - a0) * i) / N);
      pts.push(p.x, p.y, p.z);
    }
    const g = new LineGeometry();
    g.setPositions(pts);
    const m = new LineMaterial({color: INK, linewidth: width, transparent: true, opacity, dashed, dashSize: dash, gapSize: dash * 0.8, depthWrite: false, worldUnits: false});
    const l = new Line2(g, m);
    l.computeLineDistances();
    l.renderOrder = 4;
    group.add(l);
    lines.push({m, width, opacity});
    return l;
  };
  const seg = (a, b, opts = {}) => {
    const g = new LineGeometry();
    g.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
    const m = new LineMaterial({color: INK, linewidth: opts.width ?? 1, transparent: true, opacity: opts.opacity ?? 0.45, dashed: !!opts.dashed, dashSize: 0.04, gapSize: 0.035, depthWrite: false});
    const l = new Line2(g, m);
    l.computeLineDistances();
    l.renderOrder = 4;
    group.add(l);
    lines.push({m, width: opts.width ?? 1, opacity: opts.opacity ?? 0.45});
  };

  // the rings: [radius, normal, arcs, dashed, width, opacity]
  const RINGS = [
    [2.75, new V3(0.35, 0.25, 1), [[0.15, 1.9], [2.4, 3.5], [4.1, 5.6]], false, 1.0, 0.42],
    [2.05, new V3(0.1, 1, 0.3), [[0, Math.PI * 2]], true, 1.0, 0.45],
    [1.35, new V3(1, 0.15, 0.05), [[0.3, 2.6], [3.3, 5.5]], false, 1.1, 0.5],
    [3.45, new V3(0.55, 0.75, 0.35), [[0.6, 2.2], [3.6, 4.6]], false, 0.9, 0.32],
    [1.7, new V3(-0.4, 0.3, 1), [[0, Math.PI * 2]], true, 0.9, 0.36],
    [2.35, new V3(0.9, -0.2, 0.4), [[1.0, 2.9], [4.2, 5.9]], false, 0.9, 0.34],
  ];
  for (const R of RINGS) R[0] *= scale;
  const onRing = [];
  for (const [r, n, arcs, dashed, w, o] of RINGS) {
    for (const [a0, a1] of arcs) arc(C, r, n, a0, a1, {dashed, width: w, opacity: o});
    onRing.push([r, n, arcs]);
  }
  // a small ring round the sensor head and one round the stinger, offset from the main centre
  arc(new V3(1.3, 0.2, 0.0), 0.55, new V3(0.75, 0.25, 0.6), 0, Math.PI * 2, {dashed: true, width: 0.9, opacity: 0.4, dash: 0.03});
  arc(new V3(-0.4, 1.7, 0), 0.8, new V3(-0.3, 0.2, 1), 0.4, 4.6, {width: 0.9, opacity: 0.38});

  // dots and hollow markers riding on the rings, ticks across them
  const dots = [];
  const marks = new THREE.Group();
  group.add(marks);
  const dotGeo = new THREE.SphereGeometry(1, 10, 8);
  const dotMat = new THREE.MeshBasicMaterial({color: '#5d5751', transparent: true, opacity: 0.75, depthWrite: false});
  const ringGeo = new THREE.RingGeometry(0.62, 1, 28);
  const ringMat = new THREE.MeshBasicMaterial({color: '#6e675f', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide});
  for (const [r, n, arcs] of onRing) {
    for (const [a0, a1] of arcs) {
      const k = Math.max(1, Math.round((a1 - a0) * 1.6));
      for (let i = 0; i < k; i++) {
        const a = a0 + (a1 - a0) * R();
        const p = circ(C, r, n, a);
        if (R() < 0.6) {
          const d = new THREE.Mesh(dotGeo, dotMat);
          d.position.copy(p);
          d.scale.setScalar(0.009 + R() * 0.012);
          d.renderOrder = 5;
          group.add(d);
          dots.push(d);
        } else {
          const m = new THREE.Mesh(ringGeo, ringMat);
          m.position.copy(p);
          m.scale.setScalar(0.022 + R() * 0.016);
          m.renderOrder = 5;
          marks.add(m);
        }
        // a short tick across the ring at some of them
        if (R() < 0.35) {
          const t = circ(C, r * 1.04, n, a);
          const b = circ(C, r * 0.96, n, a);
          seg(t, b, {width: 1, opacity: 0.5});
        }
      }
    }
  }
  // a few straight dashed leaders out from the body
  for (const [a, b] of [
    [new V3(1.4, 0.3, 0.2), new V3(2.6, 1.2, 0.5)],
    [new V3(-0.8, 0.2, 0.4), new V3(-2.2, 0.0, 1.2)],
    [new V3(0.2, 0.6, -0.3), new V3(0.6, 2.2, -0.8)],
  ]) {
    seg(a, b, {dashed: true, width: 0.9, opacity: 0.38});
  }

  return {
    group,
    resize(w, h, pr) {
      for (const L of lines) {
        L.m.resolution.set(w, h);
        L.m.linewidth = L.width * pr;
      }
    },
    // ops.guides 0..1 fades the whole drawing
    update(camera, ops = {}) {
      const k = ops.guides ?? 1;
      group.userData.show = k > 0.001;
      group.visible = group.userData.show;
      for (const L of lines) L.m.opacity = Math.min(1, L.opacity * 1.1 * k);
      dotMat.opacity = 0.75 * k;
      ringMat.opacity = 0.7 * k;
      for (const m of marks.children) m.quaternion.copy(camera.quaternion);
    },
  };
}
