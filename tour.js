// The JS-8 simulator tour, after the scorpion's (roboscorp-shared/tour.js) under the camera rules of
// 2026-10-31: frame 0 is already the low front 3/4 hero view with the spider big and running; every teardown is shot
// from that hero side (within about ±35°, the eyes toward the camera, a little above, pushing in on the part); the
// variety lives in the transitions, the explode's turntable and the final jump. The camera rides a smoothed copy of
// the body's path, never the stride bob or the jump.
// The film: the spider runs in, brakes, crouches and jumps at the camera; then the operator opens one assembly after
// another: the main lenses unscrew and the side lenses swivel, the near front leg lifts and comes apart segment by
// segment with its piston out of the glass, the abdomen's canopy swings open and the gears lift out spinning fast, the
// head's plates lift and the fangs and palps work; then it explodes on a turntable, snaps back together, walks a few
// steps and jumps at the camera again.
// Script: the entry's timeline.json, {duration, script: [{t, act}]}; act is an assembly (eyes, leg, abdomen, head),
// 'exploded', 'assemble', 'hero' (the walk) or 'jump' (the final jump). Everything is a pure function of film time t.
import * as THREE from 'three';
import {VIEWPORT} from './console.js';
import {buildGait, STRIDE_HZ} from './gait.js';
import {CROUCH, jumpAt, jumpKeys} from './jump.js';
import {FLOOR_Y, LEG_NAMES} from './spider.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const D2R = Math.PI / 180;
// a fast in, eased out pulse: 0 before a, up to 1 at b, back to 0 by c
const pulse = (a, b, c, t) => ss(a, b, t) * (1 - ss(b, c, t));
// millimetres per scene unit, for the readouts
const MM = 220;
export const REACH = 0.7;

export const ASSEMBLIES = ['hero', 'eyes', 'leg', 'abdomen', 'head', 'jump'];
export const ASSEMBLY_LABEL = {hero: 'HERO', eyes: 'OPTICS', leg: 'LEG R1', abdomen: 'ABDOMEN', head: 'HEAD', jump: 'JUMP'};
export const DISPLAY2 = ['labels', 'exploded', 'turntable', 'trace'];
export const DISPLAY2_LABEL = {labels: 'LABELS', exploded: 'EXPLODED', turntable: 'TURNTABLE', trace: 'GAIT TRACE'};
const BUTTON = {eyes: 'eyes', leg: 'leg', abdomen: 'abdomen', head: 'head', exploded: 'exploded', assemble: 'exploded', hero: 'hero', jump: 'jump'};

// each act's own clock (seconds after its click): when its parts open and when they close
const ACT = {
  eyes: {open: [0.3, 1.3], close: [1.95, 2.45]},
  leg: {open: [0.5, 1.45], close: [2.05, 2.5]},
  abdomen: {open: [0.3, 1.35], close: [2.0, 2.5]},
  head: {open: [0.3, 1.3], close: [1.95, 2.45]},
};

// ------------------------------------------------------------ cameras: [az, el, d, tx, ty, tz, sx, sy, fov] in the
// frame of the smoothed body path (az from the spider's right toward its face: 90 is straight at the face, the hero
// side is about 66), u = seconds into the view
const H = 66;
export const CAMS = {
  intro: (u) => {
    const k = ss(0, 3.2, u);
    return [lerp(H + 8, H - 4, k), lerp(10, 8, k), lerp(7.6, 6.8, k), lerp(-0.2, 0.4, k), lerp(0.0, -0.06, k), 0.0, 0, -14, 36];
  },
  eyes: (u) => [lerp(H + 4, H + 12, ss(0, 2.6, u)), lerp(12, 8, ss(0, 2.6, u)), lerp(6.0, 5.3, ss(0, 1.8, u)), 0.62, 0.04, 0.0, 0, -14, 36],
  leg: (u) => [lerp(H - 16, H - 26, ss(0, 2.6, u)), lerp(16, 12, ss(0, 2.6, u)), lerp(6.6, 6.0, ss(0, 1.8, u)), 0.8, 0.06, 0.56, 0, -14, 36],
  abdomen: (u) => [lerp(H - 4, H - 14, ss(0, 2.6, u)), lerp(36, 31, ss(0, 2.6, u)), lerp(8.2, 7.6, ss(0, 1.8, u)), -0.7, 0.4, 0.0, 0, -14, 36],
  head: (u) => [lerp(H + 22, H + 14, ss(0, 2.6, u)), lerp(18, 14, ss(0, 2.6, u)), lerp(6.5, 5.9, ss(0, 1.8, u)), 0.45, 0.08, 0.0, 0, -14, 36],
  exploded: (u) => [H + 10 * u, lerp(16, 22, ss(0, 2.0, u)), lerp(11.0, 12.2, ss(0, 1.6, u)), -0.25, 0.3, 0.0, 0, -14, 36],
  hero: (u) => [lerp(H - 30, H + 26, ss(0, 3.0, u)), lerp(14, 7, ss(0, 3.0, u)), lerp(8.4, 7.2, ss(0, 3.0, u)), 0.3, -0.04, 0.0, 0, -14, 36],
  jump: (u) => [lerp(H + 24, H + 18, ss(0, 3.0, u)), lerp(7, 5, ss(0, 1.6, u)), lerp(7.4, 6.9, ss(0, 1.2, u)) - 0.25 * ss(1.4, 3.3, u), 0.5, lerp(-0.04, 0.02, ss(0.4, 1.8, u)), 0.0, 0, -14, 36],
};

export function makeTour(TL) {
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const EVENTS = SCRIPT.map((e) => e.t);
  const at = (act) => SCRIPT.filter((e) => e.act === act).map((e) => e.t);
  const T_EXP = at('exploded')[0] ?? 999;
  const T_ASM = at('assemble')[0] ?? 999;
  const T_HERO = at('hero')[0] ?? 999;
  const T_JUMP = at('jump')[0] ?? 999;
  const T_LEG = at('leg')[0] ?? 999;
  // the two jumps: at the camera out of the run-in, and the last one
  const J1 = {t0: 1.5, tl: 1.98, ta: 2.55, dist: 1.1, h: 0.52};
  const J2 = {t0: T_JUMP + 0.25, tl: T_JUMP + 0.72, ta: T_JUMP + 1.3, dist: 1.35, h: 0.6};
  const jumpBoth = (t) => {
    const a = jumpAt(t, J1);
    const b = jumpAt(t, J2);
    return {dy: a.dy + b.dy, pitch: a.pitch + b.pitch, tuck: Math.max(a.tuck, b.tuck), air: Math.max(a.air, b.air)};
  };
  const openOf = (act, t) => {
    let v = 0;
    for (const t0 of at(act)) {
      const A = ACT[act];
      v = Math.max(v, ss(t0 + A.open[0], t0 + A.open[1], t) * (1 - ss(t0 + A.close[0], t0 + A.close[1], t)));
    }
    return v;
  };
  const explodeAt = (t) => ss(T_EXP + 0.2, T_EXP + 1.8, t) * (1 - ss(T_ASM, T_ASM + 1.0, t));
  // the turntable: one full turn from the explode to just after the spider is whole again, eased at both ends
  const TT = [T_EXP + 0.2, T_ASM + 1.3];
  const turnAt = (t) => {
    const [a, b] = TT;
    if (t <= a) return 0;
    const R = 0.6;
    const span = b - a;
    const v = 360 / (span - R);
    const x = Math.min(t, b) - a;
    if (x < R) return (v * x * x) / (2 * R);
    if (x < span - R) return v * (x - R / 2);
    const y = x - (span - R);
    return v * (span - 1.5 * R) + v * y - (v * y * y) / (2 * R);
  };
  const activity = (t) => Math.max(...Object.keys(ACT).map((a) => openOf(a, t)), explodeAt(t));
  // the busy clocks: every gear turns on spinT, six times faster while an assembly is open; the abdomen's own gears
  // on spinA, five times faster again while the canopy is up
  const DT = 1 / 240;
  const SPIN = [0];
  const SPINA = [0];
  for (let i = 1; i * DT <= DURATION + 1; i++) {
    const tm = (i - 0.5) * DT;
    const r = 1 + 5 * activity(tm);
    SPIN.push(SPIN[i - 1] + r * DT);
    SPINA.push(SPINA[i - 1] + (r + 5 * openOf('abdomen', tm)) * DT);
  }
  const look = (A, t) => {
    const u = Math.max(0, Math.min(A.length - 2, t / DT));
    const i = Math.floor(u);
    return A[i] + (A[i + 1] - A[i]) * (u - i);
  };
  const spinAt = (t) => (t < 0 ? t : look(SPIN, t));
  const spinAAt = (t) => (t < 0 ? t : look(SPINA, t));

  // the walk: the run-in on a gentle curve to a stop, the first jump's travel, still through the acts, a short walk
  // on a curve after the reassembly, a stop, the last jump's travel
  const gait = buildGait({
    duration: DURATION + 0.5,
    tRef: 1.42,
    keys: [
      [-1.5, 1.05, 12],
      [0.7, 1.0, 9],
      [1.42, 0, 0],
      ...jumpKeys(J1),
      [T_HERO + 0.3, 0, 0],
      [T_HERO + 0.8, 0.62, -16],
      [T_JUMP - 0.55, 0.55, -16],
      [T_JUMP - 0.05, 0, 0],
      ...jumpKeys(J2),
    ],
  });
  // the camera's path: the body's path low-passed (gaussian, sigma 0.4 s), so the camera follows the spider without
  // picking up the jump's dash or the stride
  const CHZ = 60;
  const C0 = -1.5;
  const CN = Math.ceil((DURATION + 1 - C0) * CHZ);
  const raw = Array.from({length: CN}, (_, i) => gait.pathAt(C0 + i / CHZ));
  const SIG = 0.4 * CHZ;
  const KR = Math.ceil(3 * SIG);
  const KW = Array.from({length: 2 * KR + 1}, (_, j) => Math.exp(-0.5 * Math.pow((j - KR) / SIG, 2)));
  const CX = new Float64Array(CN);
  const CZ = new Float64Array(CN);
  const CY = new Float64Array(CN);
  for (let i = 0; i < CN; i++) {
    let sx = 0;
    let sz = 0;
    let sy = 0;
    let sw = 0;
    for (let j = -KR; j <= KR; j++) {
      const p = raw[Math.max(0, Math.min(CN - 1, i + j))];
      const w = KW[j + KR];
      sx += p.x * w;
      sz += p.z * w;
      sy += p.yaw * w;
      sw += w;
    }
    CX[i] = sx / sw;
    CZ[i] = sz / sw;
    CY[i] = sy / sw;
  }
  const camPath = (t) => {
    const u = Math.max(0, Math.min(CN - 1.000001, (t - C0) * CHZ));
    const i = Math.floor(u);
    const f = u - i;
    return {x: CX[i] + (CX[i + 1] - CX[i]) * f, z: CZ[i] + (CZ[i + 1] - CZ[i]) * f, yaw: CY[i] + (CY[i + 1] - CY[i]) * f};
  };

  // the near front leg (R1): lifted off the floor and held up in front before it comes apart
  const legLiftAt = (t) => {
    let v = 0;
    for (const t0 of at('leg')) v = Math.max(v, ss(t0 + 0.05, t0 + 0.45, t) * (1 - ss(t0 + 2.2, t0 + 2.65, t)));
    return v;
  };
  // the body: the path, the jumps, a bob with the stride, a slow breath, a lean off the lifted leg
  const bodyAt = (t) => {
    const p = gait.pathAt(t);
    const rate = gait.rateAt(t) / STRIDE_HZ;
    const ph = gait.phaseAt(t);
    const [, w] = gait.velAt(t);
    const j = jumpBoth(t);
    const run = Math.min(1, rate) * (1 - j.air);
    let y = j.dy + 0.014 * Math.sin(ph * Math.PI * 4) * run + 0.006 * Math.sin(t * 1.7);
    let roll = -w * 0.001 + 0.01 * Math.sin(ph * Math.PI * 2) * run;
    const pitch = j.pitch + 0.008 * Math.sin(t * 1.3 + 1);
    const kl = legLiftAt(t);
    roll -= 0.05 * kl;
    y += 0.02 * kl;
    return {x: p.x, z: p.z, y, yaw: p.yaw, roll, pitch, rate, jump: j};
  };
  const feetAt = (t, b) => {
    const F = [];
    for (let l = 0; l < 8; l++) {
      const f = gait.footLocal(l, t, b);
      if (l === 4) {
        const k = legLiftAt(t);
        f[0] -= 0.3 * k;
        f[1] += 0.62 * k;
        f[2] -= 0.12 * k;
      }
      F.push(f);
    }
    return F;
  };
  // the palps: up in front of the face for the jumps and the head act, otherwise hanging and twitching
  const palpAt = (t, j) => 0.35 + 0.55 * j.tuck + 0.35 * pulse(J1.t0, J1.tl, J1.ta + 0.3, t) + 0.35 * pulse(J2.t0, J2.tl, J2.ta + 0.3, t) + 0.5 * pulse(J2.ta + 0.35, J2.ta + 0.8, J2.ta + 1.8, t);
  // the close: after the last landing the main lenses focus on the camera (their rings run out a little and back)
  const focusAt = (t) => 0.38 * pulse(J2.ta + 0.4, J2.ta + 0.85, J2.ta + 1.75, t);

  // the camera: each act's view, blended over 0.9 s with a short dolly out, on the smoothed path
  const VIEWS = [{t: -1, key: 'intro'}, ...SCRIPT.map((e) => ({t: e.t, key: e.act === 'assemble' ? 'exploded' : e.act}))];
  const viewIdx = (t) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= t) i++;
    return i;
  };
  const camFn = (V, t) => CAMS[V.key](t - (V.key === 'intro' ? 0 : V.t));
  // the follow time: the camera follows the smoothed path, except into a jump, where its follow eases to a stop
  // just before take-off (the speed falls from 1 to 0 over a..b), so the spider leaps toward a camera that holds
  const ease = (t, a, b) => {
    if (t <= a) return t;
    const u = Math.min(1, (t - a) / (b - a));
    return a + (b - a) * (u - (u * u) / 2);
  };
  const followT = (V, t) => (V.key === 'intro' ? ease(t, 0.8, 1.95) : V.key === 'jump' ? ease(t, J2.t0 - 0.6, J2.tl) : t);
  // a view's camera in the world: its framing turned with the path's heading and put on the path
  const world = (V, t) => {
    const o = camFn(V, t);
    const p = camPath(followT(V, t));
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    return [o[0] + p.yaw / D2R, o[1], o[2], p.x + o[3] * cy + o[5] * sy, o[4], p.z - o[3] * sy + o[5] * cy, o[6], o[7], o[8]];
  };
  // each view blended from the last one over 0.9 s in world space, with a short dolly out
  const camAt = (t) => {
    const i = viewIdx(t);
    let o = world(VIEWS[i], t);
    if (VIEWS[i].key === 'exploded' && i > 0 && VIEWS[i - 1].key === 'exploded') o = world(VIEWS[i - 1], t);
    else if (i > 0) {
      const k = ss(VIEWS[i].t, VIEWS[i].t + 0.9, t);
      if (k < 1) {
        const a = world(VIEWS[i - 1], t);
        const dAz = ((((o[0] - a[0]) % 360) + 540) % 360) - 180;
        const b = o.map((v, n) => lerp(a[n], v, k));
        b[0] = a[0] + dAz * k;
        b[2] += 0.6 * Math.sin(Math.PI * k);
        o = b;
      }
    }
    return {az: o[0], el: o[1], d: o[2], tx: o[3], ty: o[4], tz: o[5], sx: o[6], sy: o[7], fov: o[8]};
  };
  const actAt = (t) => VIEWS[viewIdx(t)].key;

  const stateAt = (t) => {
    const ex = explodeAt(t);
    const open = Object.fromEntries(Object.keys(ACT).map((a) => [a, openOf(a, t)]));
    const body = bodyAt(t);
    return {
      t,
      spinT: spinAt(t),
      spinA: spinAAt(t),
      explode: ex,
      sub: {eyes: Math.max(open.eyes, focusAt(t)), leg: open.leg, abdomen: open.abdomen, head: open.head},
      body,
      feet: feetAt(t, body),
      tuck: body.jump.tuck,
      palp: palpAt(t, body.jump),
      open,
      cam: camAt(t),
      view: actAt(t),
      guides: 0.35 + 0.65 * Math.min(1, ex * 2.5 + activity(t)),
      turn: turnAt(t),
    };
  };

  // labels: on while an act's parts are moving apart and while they hang open, gone before they close
  const LABELS = {
    eyes: [['lens', 'MAIN OPTIC R', 'Ø 46 MM · 9 ELEMENTS'], ['iris', 'IRIS', '10 BLADES · F/1.4'], ['eyeGlass', 'DOME GLASS', 'SAPPHIRE · AR COAT'], ['ale', 'SIDE OPTIC', '6 SECONDARY · SWIVEL']],
    leg: [['hipR1', 'COXA SERVO', 'YAW ±45°'], ['femR1', 'FEMUR PLATES', 'RIVETED · 52 BRISTLES'], ['kneeR1', 'KNEE RING', 'GLOW RING · 2.4 N·M'], ['pistonR1', 'TIBIA PISTON', 'PLATED · 60 MM'], ['footR1', 'CLAW TIP', 'GLOW · 14 MM']],
    abdomen: [['canopy', 'GLASS CAGE', '5 BANDS · HINGED'], ['gears', 'FLANK GEARS', '7 PER SIDE · 5× SPEED'], ['core', 'GLOW COILS', '20 COILS · 5× SPEED']],
    head: [['visor', 'BROW PLATE', 'LIFT 40 MM'], ['channel', 'SPINE CHANNEL', '8 GEARS'], ['face', 'EYE PLATE', '8 LENSES'], ['chel', 'FANG', 'FLARE 40° · GLOW TIP'], ['jaw', 'JAW BLOCK', '4 LINES · 2 GEARS']],
    exploded: [['lens', 'OPTICS', '2 + 6 LENSES'], ['core', 'GLOW COILS', 'SPINNING FREE'], ['canopy', 'CAGE', 'GLASS · 5 BANDS'], ['kneeR1', 'LEG RINGS', '8 × 4 JOINTS']],
  };
  const labelAt = (t, s) => {
    const v = s.view;
    if (ACT[v]) {
      const t0 = at(v).filter((x) => x <= t).pop();
      const A = ACT[v];
      return {set: LABELS[v], o: ss(t0 + A.open[0] + 0.1, t0 + A.open[0] + 0.45, t) * (1 - ss(t0 + A.close[0] - 0.25, t0 + A.close[0], t))};
    }
    if (v === 'exploded') return {set: LABELS.exploded, o: ss(T_EXP + 0.4, T_EXP + 0.8, t) * (1 - ss(T_EXP + 2.3, T_EXP + 2.6, t))};
    return {set: [], o: 0};
  };

  // the optics: the iris opens wide for the eye act, stops down for the jumps; the focus range follows the camera
  const irisAt = (t) => {
    const j = jumpBoth(t);
    return Math.max(0.05, Math.min(1, 0.35 + 0.6 * Math.max(openOf('eyes', t), focusAt(t)) - 0.25 * j.air + 0.06 * Math.sin(t * 2.1)));
  };
  const telemetry = (t, s) => {
    const b = s.body;
    const j = b.jump;
    const ex = s.explode > 0.04;
    const walking = b.rate > 0.05;
    // the step diagram: stance and swing spans of every leg over the last 1.6 s, as fractions of the window
    const W0 = t - 1.6;
    const steps = [0, 1, 2, 3, 4, 5, 6, 7].map((l) => {
      const row = [];
      let x = W0;
      for (const sw of gait.swings[l]) {
        if (sw.t1 < W0) continue;
        if (sw.t0 > t) break;
        const a = Math.max(W0, sw.t0);
        const c = Math.min(t, sw.t1);
        if (a > x) row.push([(x - W0) / 1.6, (a - W0) / 1.6, false]);
        row.push([(a - W0) / 1.6, (c - W0) / 1.6, true]);
        x = c;
      }
      if (x < t) row.push([(x - W0) / 1.6, 1, false]);
      return row;
    });
    const legOpen = s.open.leg > 0.08;
    const free = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ex || (i === 4 && legOpen));
    const lifts = [0, 1, 2, 3, 4, 5, 6, 7].map((l) => gait.lifted(l, t));
    const nLift = lifts.reduce((a, v) => a + v, 0);
    // the crouch loads every knee, the flight unloads them
    const crouch = Math.max(0, -j.dy) / CROUCH;
    const servos = lifts.map((v, i) => (free[i] ? 0 : Math.max(0.04, Math.min(1, (j.air ? 0.1 : (v > 0.05 ? 0.16 : 0.34 + (0.22 * nLift) / 4) + 0.55 * crouch) + [0.06, 0.1, 0.04, 0.0, 0.08, 0.02, 0.09, 0.05][i] + 0.04 * Math.sin(t * 6 + i) - (i === 4 ? 0.3 * legLiftAt(t) : 0)))));
    const v = s.view;
    const opening = ACT[v] ? s.open[v] : 0;
    const NAME = {eyes: 'OPTICS OPEN', leg: 'LEG R1 APART', abdomen: 'ABDOMEN OPEN', head: 'HEAD OPEN'};
    let status = 'STANDING';
    let kind = 'ok';
    const jumpState = j.air ? 'AIRBORNE' : (t > J1.t0 && t < J1.tl) || (t > J2.t0 && t < J2.tl) ? 'CROUCH' : (t > J1.ta && t < J1.ta + 0.45) || (t > J2.ta && t < J2.ta + 0.45) ? 'LANDING' : null;
    if (walking && !jumpState) status = t < 3 ? 'RUN-IN' : 'WALK';
    if (ACT[v] && opening > 0.05) [status, kind] = [NAME[v], 'warn'];
    if (v === 'leg' && legLiftAt(t) > 0.05 && opening <= 0.05) status = 'LEG R1 LIFT';
    if (v === 'exploded') [status, kind] = t < T_ASM ? ['TEARDOWN', 'warn'] : s.explode > 0.04 ? ['REASSEMBLY', 'warn'] : ['STANDING', 'ok'];
    if (jumpState) [status, kind] = [jumpState, 'warn'];
    const ROW = {eyes: 0, head: 1, abdomen: 2, jump: 3, leg: 4};
    const sub = (i) => {
      if (ex) return ['warn', 'DETACHED'];
      if (ROW[v] === i && opening > 0.05) return ['warn', i === 4 ? 'DETACHED' : 'OPEN'];
      if (i === 3) return j.air ? ['warn', 'AIRBORNE'] : jumpState === 'CROUCH' ? ['warn', 'ARMED'] : ['ok', 'READY'];
      if (i === 4) return walking ? ['ok', 'STEPPING'] : ['ok', 'HOLDING'];
      if (i === 5) return s.open.head > 0.05 ? ['warn', 'ACTIVE'] : ['ok', 'FOLDED'];
      if (i === 0) return ['ok', 'TRACKING'];
      return ['ok', 'SEALED'];
    };
    const last = SCRIPT.filter((e) => e.t <= t).pop();
    const say = (e) => (e.act === 'exploded' ? 'EXPLODED ON' : e.act === 'assemble' ? 'EXPLODED OFF · REASSEMBLE' : e.act === 'hero' ? 'HERO · WALK' : e.act === 'jump' ? 'JUMP · ARMED' : `ISOLATE ${ASSEMBLY_LABEL[e.act]}`);
    const labels = labelAt(t, s);
    // the jump readouts: the height over the stance (negative in the crouch), the last flight's airtime, the launch
    // speed, the tuck
    const Jl = t >= J2.t0 ? J2 : J1;
    const air = j.air ? t - Jl.tl : t >= Jl.ta ? Jl.ta - Jl.tl : 0;
    const launch = (2 * Jl.dist) / (Jl.ta - Jl.tl) * (MM / 1000) + 0.0;
    const iris = irisAt(t);
    const trace = [];
    for (let i = 0; i <= 40; i++) trace.push(irisAt(t - 2 + (i / 40) * 2));
    const [vv] = gait.velAt(t);
    return {
      time: t,
      dur: DURATION,
      lift: 0.18 + 0.45 * b.rate + 0.4 * crouch + 0.35 * j.air + 0.15 * activity(t),
      status,
      statusKind: kind,
      freq: gait.rateAt(t) * (1 - j.air),
      speed: Math.abs(vv) * MM,
      steps,
      pattern: j.air ? 'BALLISTIC · TUCKED' : walking ? 'ALT TETRAPOD' : 'STANCE · 8 FEET',
      duty: walking && !j.air ? 0.54 : j.air ? 0 : 1,
      jumpH: j.dy * MM,
      jumpK: Math.max(0, Math.min(1, (j.dy + CROUCH) / (J2.h + CROUCH))),
      airtime: air,
      launch: t >= Jl.tl ? launch : 0,
      tuck: j.tuck,
      servos,
      legsFree: ex,
      legFreeEach: free,
      walking,
      iris,
      fstop: 1.4 / Math.sqrt(Math.max(0.05, iris)) ,
      irisTrace: trace,
      lensOpen: [iris * (0.96 + 0.04 * Math.sin(t * 3)), iris],
      opticsOpen: s.open.eyes > 0.05,
      opticsMode: s.open.eyes > 0.05 ? 'OPEN' : j.air || jumpState === 'CROUCH' ? 'LOCK' : walking ? 'TRACK' : 'SCAN',
      range: s.cam.d * MM,
      view: v === 'intro' ? 'hero' : v === 'exploded' ? null : v,
      display: {labels: labels.o > 0.5, exploded: t >= T_EXP && t < T_ASM, turntable: s.turn > 0 && t < TT[1], trace: walking},
      subs: [0, 1, 2, 3, 4, 5].map(sub),
      focus: jumpState ? 3 : ROW[v] ?? (v === 'exploded' ? 2 : -1),
      events: EVENTS,
      next: `${EVENTS.length} OPERATOR ACTIONS`,
      log: last ? `OPERATOR · ${say(last)}` : 'INBOUND · RUN-IN · 8 LEGS',
      mode: status,
      modeSub: j.air
        ? `${Math.round(j.dy * MM)} MM UP · TUCK ${Math.round(j.tuck * 100)}%`
        : status === 'CROUCH'
          ? `${Math.round(-j.dy * MM)} MM DOWN · KNEES LOADED`
          : status === 'RUN-IN' || status === 'WALK'
            ? `${(Math.abs(vv) * MM).toFixed(0)} MM/S · YAW ${((((b.yaw / D2R) % 360) + 360) % 360).toFixed(0)}°`
            : status === 'TEARDOWN' || status === 'REASSEMBLY'
              ? `TURNTABLE ${Math.round(s.turn)}° · ${Math.round(s.explode * 100)}% APART`
              : ACT[v] && opening > 0.05
                ? `${ASSEMBLY_LABEL[v]} · ${Math.round(opening * 100)}% APART`
                : `8 FEET DOWN · ${((0 - FLOOR_Y) * MM).toFixed(0)} MM CLEARANCE`,
      viewNote: `ISOLATE · ${v === 'intro' || v === 'hero' || v === 'jump' ? 'HERO' : v === 'exploded' ? 'ALL' : ASSEMBLY_LABEL[v]}`,
      labelSet: labels,
      legNames: LEG_NAMES,
    };
  };

  return {SCRIPT, DURATION, stateAt, telemetry, camAt, gait};
}

/** Labels in two columns at the viewport's edges, from a set of anchors (as the bee's makeLabels2). */
export function makeLabels(st, sc) {
  const p = new THREE.Vector3();
  return ({set, o}) => {
    if (o < 0.02) return [];
    const pts = [];
    for (const [key, name, sub] of set) {
      const A = sc.anchors[key];
      if (!A) continue;
      A.obj.updateWorldMatrix(true, false);
      const at = st.project(A.obj.localToWorld(p.copy(A.at)));
      if (at && at[0] > VIEWPORT.x0 + 30 && at[0] < VIEWPORT.x1 - 30 && at[1] > VIEWPORT.y0 + 40 && at[1] < VIEWPORT.y1 - 70) pts.push({name, sub, at});
    }
    const mid = (VIEWPORT.x0 + VIEWPORT.x1) / 2;
    const out = [];
    const stack = (col, x, w) => {
      let y = Math.max(VIEWPORT.y0 + 48, Math.min(col.length ? col[0].at[1] - 10 : 0, VIEWPORT.y1 - 110 - 34 * col.length));
      for (const c of col) {
        y = Math.max(y, Math.min(VIEWPORT.y1 - 110, c.at[1] - 10));
        out.push({name: c.name, sub: c.sub, at: c.at, label: [x, y], w, o});
        y += 34;
      }
    };
    stack(pts.filter((x) => x.at[0] < mid).sort((a, b) => a.at[1] - b.at[1]), VIEWPORT.x0 + 16, 168);
    stack(pts.filter((x) => x.at[0] >= mid).sort((a, b) => a.at[1] - b.at[1]), VIEWPORT.x1 - 160, 150);
    return out;
  };
}

// ------------------------------------------------------------ the operator's pointer, on the act buttons (the bee's)
const GUTTER_X = 1262;
export function makeCursor(ui, SCRIPT) {
  // Timeline actions without a visible button still run; the pointer skips them.
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[BUTTON[e.act]]})).filter((e) => e.spot);
  if (!EV.length) return () => ({x: -1, y: 0, press: false, ring: 0, ringX: 0, ringY: 0});
  const WP = [[0, GUTTER_X, EV[0].spot[1] + 60]];
  let [px, py, pt] = [GUTTER_X, EV[0].spot[1] + 60, 0];
  EV.forEach((e, n) => {
    const [x, y] = e.spot;
    const travel = Math.min(0.7, 0.3 + Math.hypot(x - px, y - py) / 900);
    const arrive = e.t - 0.1;
    if (arrive - travel - pt > 1.4) {
      const rest = [GUTTER_X, Math.max(170, Math.min(720, y + 40))];
      WP.push([pt + 0.7, ...rest]);
      WP.push([arrive - travel, ...rest]);
    } else WP.push([Math.max(pt + 0.01, arrive - travel), px, py]);
    WP.push([arrive, x, y], [e.t + 0.18, x, y]);
    [px, py, pt] = [x, y, e.t + 0.18];
    const next = EV[n + 1];
    if (!next || next.t - 0.1 - 0.7 - pt > 0.8) {
      [px, py, pt] = [GUTTER_X, y + 12, pt + 0.55];
      WP.push([pt, px, py]);
    }
  });
  WP.push([pt + 0.9, GUTTER_X, Math.min(720, py + 50)]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(22, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}
