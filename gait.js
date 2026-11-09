// The spider's walk, copied from the scorpion's (roboscorp-shared/gait.js): a body path integrated from velocity keys and an alternating tetrapod gait for eight legs
// (L1 R2 L3 R4 against R1 L2 R3 L4), after the hexapod's (hexsim-shared/motion.js) but simpler. Pure functions of t,
// no three.js. World: y up; a yaw ψ turns the body's +x to (cos ψ, 0, -sin ψ), as three.js rotation.y does.
// keys: [[t, speed, yawRate°/s], ...] eased between; the path is moved so that at tRef the body stands at the origin
// facing +x. A step starts whenever the phase clock (∫ rate dt) crosses a group's mark; once started it always
// finishes, and it lands where the leg's home spot will be a moment after touchdown, so the feet settle home when the
// body stops. footLocal(i, t) gives a foot in the body frame of the path (the turntable turns on top of it).
import {FLOOR_Y, legHome, WHEEL_R} from './spider.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const GA = [0, 5, 2, 7];
const GB = [4, 1, 6, 3];
export const STRIDE_HZ = 2.7;
const SWING = 0.46 / STRIDE_HZ;
const LIFT = 0.12;

export function buildGait({keys, duration, tRef = 2.8, t0 = -1.5}) {
  const HZ = 240;
  const N = Math.ceil((duration - t0) * HZ) + 2;
  const at = (t) => {
    // eased velocity between keys
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va, wa] = keys[i];
      const [tb, vb, wb] = keys[i + 1];
      if (t <= tb) {
        const k = smoother((t - ta) / (tb - ta));
        return [va + (vb - va) * k, wa + (wb - wa) * k];
      }
    }
    const l = keys[keys.length - 1];
    return [l[1], l[2]];
  };
  const X = new Float64Array(N);
  const Z = new Float64Array(N);
  const Y = new Float64Array(N);
  const RATE = new Float64Array(N);
  const PH = new Float64Array(N);
  const move = (t) => {
    const [v, w] = at(t);
    return Math.min(1, Math.abs(v) / 0.35 + Math.abs(w) / 45);
  };
  for (let i = 1; i < N; i++) {
    const t = t0 + (i - 0.5) / HZ;
    const [v, w] = at(t);
    const ym = Y[i - 1] + (w * Math.PI) / 180 / HZ / 2;
    X[i] = X[i - 1] + (v * Math.cos(ym)) / HZ;
    Z[i] = Z[i - 1] - (v * Math.sin(ym)) / HZ;
    Y[i] = Y[i - 1] + (w * Math.PI) / 180 / HZ;
    // the legs keep stepping for half a second after the body stops, so they settle
    RATE[i] = STRIDE_HZ * Math.max(move(t), move(t - 0.25), move(t - 0.5));
    PH[i] = PH[i - 1] + RATE[i] / HZ;
  }
  const idx = (t) => Math.min(N - 1.000001, Math.max(0, (t - t0) * HZ));
  const samp = (A, t) => {
    const f = idx(t);
    const i = Math.floor(f);
    return A[i] + (A[i + 1] - A[i]) * (f - i);
  };
  // the rigid move that puts the body at the origin facing +x at tRef
  const rx = samp(X, tRef);
  const rz = samp(Z, tRef);
  const ry = samp(Y, tRef);
  const c = Math.cos(-ry);
  const s = Math.sin(-ry);
  const pathAt = (t) => {
    const x = samp(X, t) - rx;
    const z = samp(Z, t) - rz;
    // rotate by -ry about y: (x, z) → (x c + z s, -x s + z c) with the three.js sense
    return {x: x * c + z * s, z: -x * s + z * c, yaw: samp(Y, t) - ry};
  };
  const toWorld = (p, lx, lz) => [p.x + lx * Math.cos(p.yaw) + lz * Math.sin(p.yaw), p.z - lx * Math.sin(p.yaw) + lz * Math.cos(p.yaw)];

  // the step schedule: every crossing of a group's mark starts a swing for its four legs
  const swings = Array.from({length: 8}, () => []);
  for (let i = 1; i < N; i++) {
    const t = t0 + i / HZ;
    for (const [grp, off] of [
      [GA, 0],
      [GB, 0.5],
    ]) {
      if (Math.floor(PH[i] - off) > Math.floor(PH[i - 1] - off) && PH[i] - off > 0) {
        for (const l of grp) {
          const S = swings[l];
          if (S.length && S[S.length - 1].t1 > t - 0.04) continue;
          S.push({t0: t, t1: t + SWING});
        }
      }
    }
  }
  const start = Array.from({length: 8}, (_, l) => {
    const h = legHome(l);
    return toWorld(pathAt(t0), h[0], h[2]);
  });
  swings.forEach((S, l) => {
    let from = start[l];
    const h = legHome(l);
    for (const sw of S) {
      sw.from = from;
      sw.to = toWorld(pathAt(sw.t1 + 0.1), h[0], h[2]);
      from = sw.to;
    }
  });
  const footWorld = (l, t) => {
    let planted = start[l];
    for (const sw of swings[l]) {
      if (sw.t0 > t) break;
      if (t < sw.t1) {
        const q = (t - sw.t0) / (sw.t1 - sw.t0);
        const e = smoother((q - 0.04) / 0.9);
        const y = Math.pow(Math.sin(Math.PI * q), 1.1);
        return [sw.from[0] + (sw.to[0] - sw.from[0]) * e, FLOOR_Y + WHEEL_R + LIFT * y, sw.from[1] + (sw.to[1] - sw.from[1]) * e, y];
      }
      planted = sw.to;
    }
    return [planted[0], FLOOR_Y + WHEEL_R, planted[1], 0];
  };
  /** A foot in the body frame of the path at t, given the body's height y and its pitch and roll (radians). */
  const footLocal = (l, t, body) => {
    const p = pathAt(t);
    const f = footWorld(l, t);
    let x = f[0] - p.x;
    let y = f[1] - body.y;
    let z = f[2] - p.z;
    // undo yaw (rotation.y = yaw): R(-yaw) about y
    const cy = Math.cos(-p.yaw);
    const sy = Math.sin(-p.yaw);
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    // undo roll about x, then pitch about z (the root's Euler order is YXZ: R = Ry Rx Rz)
    const cr = Math.cos(-body.roll);
    const sr = Math.sin(-body.roll);
    [y, z] = [y * cr - z * sr, y * sr + z * cr];
    const cp = Math.cos(-body.pitch);
    const sp = Math.sin(-body.pitch);
    [x, y] = [x * cp - y * sp, x * sp + y * cp];
    return [x, y, z];
  };
  const lifted = (l, t) => footWorld(l, t)[3];
  return {pathAt, footWorld, footLocal, lifted, rateAt: (t) => samp(RATE, t), phaseAt: (t) => samp(PH, t), velAt: at, swings};
}
