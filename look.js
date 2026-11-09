// The green look for any creature film (first made for longcat/wasp and longcat/tarantula): the palette swap, the warm
// glows turned green, the labels as two columns of soft cards inside the green page's viewport, and the operator's
// pointer on its pill buttons. A creature's own film keeps its tour (movement, cameras, timing) and only routes its
// state through these.
import * as THREE from 'three';
import {REST, VIEWPORT} from './console.js';

export const HUE = 0.405;
export const ORANGE_TO = '#17b865';
export const PAPER_GREEN = {top: '#ffffff', mid: '#fcfefd', low: '#f0f6f2', shadow: '#b4c6bd'};
// the old consoles centre the subject in a 3D window at (800, 426); the green page's window centres at (785, 536)
export const SHIFT = [-15, 110];

const ss = (a, b, t) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** Every warm accent left in a creature's materials and lights (glows, tints, rims) turned to the same green. */
export function retint(root) {
  const hsl = {};
  const fix = (c, minS = 0.4) => {
    if (!c?.isColor) return;
    // a glow colour above 1 (an HDR basic material, the octopus's coils and rings) is read and written at unit peak
    const k = Math.max(1, c.r, c.g, c.b);
    c.multiplyScalar(1 / k);
    c.getHSL(hsl);
    if ((hsl.h < 0.15 || hsl.h > 0.96) && hsl.s > minS) c.setHSL(HUE, Math.min(0.85, hsl.s), hsl.l);
    c.multiplyScalar(k);
  };
  const vc = new THREE.Color();
  root.traverse((o) => {
    // colours baked into a geometry's vertices (the shark's fang tips), turned once per geometry
    const ca = o.geometry?.attributes?.color;
    if (ca && !o.geometry.userData.tinted && [].concat(o.material || []).some((m) => m.vertexColors)) {
      o.geometry.userData.tinted = true;
      for (let i = 0; i < ca.count; i++) {
        vc.setRGB(ca.getX(i), ca.getY(i), ca.getZ(i));
        fix(vc);
        ca.setXYZ(i, vc.r, vc.g, vc.b);
      }
      ca.needsUpdate = true;
    }
    if (o.isLight && !o.userData.tinted) {
      o.userData.tinted = true;
      fix(o.color, 0.3);
    }
    for (const m of [].concat(o.material || [])) {
      // a colour the creature's pose rewrites every frame (the octopus's pulsing core) is turned again whenever it no
      // longer matches what was last written here
      const done = (m.userData.tinted ??= {});
      for (const key of ['color', 'emissive', 'attenuationColor']) {
        const c = m[key];
        if (!c?.isColor || done[key]?.equals(c)) continue;
        fix(c);
        done[key] = c.clone();
      }
      const u = m.uniforms?.uColor?.value;
      if (u?.isColor && !done.u?.equals(u)) {
        fix(u, 0.2);
        done.u = u.clone();
      }
    }
  });
}

// the old consoles' capitals in the page's voice: units, axes and part codes keep their case
const fixCase = (x) =>
  x
    .replace(/ø/g, 'Ø')
    .replace(/\bn·m\b/g, 'N·m')
    .replace(/\b(cpu|imu|ar|dof|led)\b/g, (m) => m.toUpperCase())
    .replace(/\b([lr])(\d)\b/g, (m, a, d) => a.toUpperCase() + d)
    .replace(/(\d) k\b/g, '$1 K');
/** A part name in capitals, in sentence case. */
export const nice = (s) => {
  const x = fixCase(s.toLowerCase());
  return x.charAt(0).toUpperCase() + x.slice(1);
};
/** A part's note in capitals, lower case with commas. */
export const niceSub = (s) => fixCase(s.toLowerCase().replace(/ · /g, ', '));

/** Labels in two columns at the green viewport's edges; text: old capital name -> [name, sub] (or [name] to keep the
 *  converted note) in the page's voice, anything missing converted by nice / niceSub. */
export function makeLabels(st, anchors, text = {}) {
  const p = new THREE.Vector3();
  return ({set, o}) => {
    if (o < 0.02) return [];
    const pts = [];
    for (const [key, name, sub] of set) {
      const A = anchors[key];
      if (!A) continue;
      // an anchor is {obj, at} (a point on a part) or a function giving the world point (the octopus's)
      let w;
      if (typeof A === 'function') w = A();
      else {
        A.obj.updateWorldMatrix(true, false);
        w = A.obj.localToWorld(p.copy(A.at));
      }
      const at = st.project(w);
      const n2 = text[name]?.[0] ?? nice(name);
      const s2 = text[name]?.[1] ?? niceSub(sub);
      if (at && at[0] > VIEWPORT.x0 + 30 && at[0] < VIEWPORT.x1 - 30 && at[1] > VIEWPORT.y0 + 30 && at[1] < VIEWPORT.y1 - 60) pts.push({name: n2, sub: s2, at});
    }
    const mid = (VIEWPORT.x0 + VIEWPORT.x1) / 2;
    const out = [];
    const stack = (col, x, w) => {
      let y = Math.max(VIEWPORT.y0 + 30, Math.min(col.length ? col[0].at[1] - 10 : 0, VIEWPORT.y1 - 90 - 44 * col.length));
      for (const c of col) {
        y = Math.max(y, Math.min(VIEWPORT.y1 - 90, c.at[1] - 10));
        out.push({name: c.name, sub: c.sub, at: c.at, label: [x, y], w, o});
        y += 44;
      }
    };
    stack(pts.filter((x) => x.at[0] < mid).sort((a, b) => a.at[1] - b.at[1]), VIEWPORT.x0 + 8, 'l');
    stack(pts.filter((x) => x.at[0] >= mid).sort((a, b) => a.at[1] - b.at[1]), VIEWPORT.x1 - 8, 'r');
    return out;
  };
}

/** The operator's pointer on the pill buttons; button maps an act to its pill. */
export function makeCursor(ui, SCRIPT, button = (act) => (act === 'assemble' ? 'exploded' : act)) {
  const EV = SCRIPT.filter((e) => e.t > 0 && ui.spots[button(e.act)]).map((e) => ({t: e.t, spot: ui.spots[button(e.act)]}));
  const [RX, RY] = REST;
  const WP = [[0, RX, RY + 40]];
  let [px, py, pt] = [RX, RY + 40, 0];
  EV.forEach((e) => {
    const [x, y] = e.spot;
    const travel = Math.min(0.6, 0.28 + Math.hypot(x - px, y - py) / 1000);
    const arrive = e.t - 0.08;
    WP.push([Math.max(pt + 0.01, arrive - travel), px, py]);
    WP.push([arrive, x, y], [e.t + 0.16, x, y]);
    [px, py, pt] = [x + 30, y + 46, e.t + 0.5];
    WP.push([pt, px, py]);
  });
  WP.push([pt + 0.8, RX, RY + 60]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(20, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.5) {
        ring = 1 - (t - e.t) / 0.5;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}
