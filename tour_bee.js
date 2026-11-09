// The Vesper AX-6 tour cut 1:1 on the bee's (robobee-shared/tour_v2.js, robobee-sim2/timeline.json), the way the
// hummingbird's was (robohum-shared/tour_bee.js): the same beat times in the same order, the same push-ins and orbits,
// the same 330° explode turntable with the fast reassembly, distances scaled to the fish. The bee's banking fly-in is
// the fish swimming in with a bank and a roll, its tail sweeping and its jaw snapping once near the end of the 3 s; the
// bee's fly-off is a lunge (the jaw snaps and it shoots past the camera). The five assemblies map beat for beat:
// OPTICS = the eye (the bubble lifts, the lens rings unscrew out along the axis, the iris opens), WING = the near
// pectoral fin (it leaves its root and turns over in the air), LEG = the lure (the stalk comes apart link by link with
// a servo spinning in each joint, the cage blooms and the light flares), THORAX = the ribcage (the shields swing off
// and the drive rings slide out spinning 5× faster), ABDOMEN = the jaw (it drops away, the fang rows fly out along their
// rims and snap back).
// The camera rules on top: frame 0 is already the front three-quarter hero view of the still (the eye side and
// the open mouth toward the camera, the fish big and moving); every teardown is shot from that side within about ±35°
// and pushed in on the part; sides change only in the orbits, the turntable and the exit; the camera rides smooth
// splines and follows only the fish's path, never its sway. Labels show only while parts move.
// Script: the entry's timeline.json, {duration, script: [{t, act}]}; act is optics, wing, leg, thorax, abdomen,
// 'exploded', 'assemble' or 'hero' (the lunge). Everything is a pure function of film time t.
import * as THREE from 'three';
import {GAPE_LO} from './piranha.js';
import {VIEWPORT} from './console.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const D2R = Math.PI / 180;
// the bee's distances scaled to the fish (tail tip to lure bulb about 5.3 units against the bee's 3)
const S = 1.6;
// the tail's stroke: radians per second of its sweep while swimming (about 0.5 Hz, heavy), and the cruise level
const STROKE_W = 3.1;
export const STROKE_HZ = STROKE_W / (2 * Math.PI);
const CRUISE = 0.65;
// fish units to metres for the dive panel (the fish is a 1.6 m drone)
const M_PER = 0.3;
const DEPTH0 = 412.6;

export const ASSEMBLIES = ['hero', 'optics', 'wing', 'leg', 'thorax', 'abdomen'];
export const ASSEMBLY_LABEL = {hero: 'HERO', optics: 'OPTICS', wing: 'FIN', leg: 'TAIL', thorax: 'FLANK', abdomen: 'JAW'};
export const DISPLAY2 = ['labels', 'exploded', 'flare', 'turntable'];
export const DISPLAY2_LABEL = {labels: 'LABELS', exploded: 'EXPLODED', flare: 'COIL FLARE', turntable: 'TURNTABLE'};
const BUTTON = {optics: 'optics', wing: 'wing', leg: 'leg', thorax: 'thorax', abdomen: 'abdomen', exploded: 'exploded', assemble: 'exploded', hero: 'hero'};

// each act's own clock, the bee's (seconds after its click): when it opens, when it closes, whether the swim eases off
// (only the ribcage: the fish keeps its slow stroke through the others, its own motion between the beats)
const ACT = {
  optics: {open: [0.35, 1.5], close: [2.2, 2.65], stop: false},
  wing: {open: [0.45, 1.25], close: [2.35, 2.7], stop: false},
  leg: {open: [0.35, 1.45], close: [2.15, 2.55], stop: false},
  thorax: {open: [0.3, 1.4], close: [2.1, 2.6], stop: true},
  abdomen: {open: [0.3, 1.3], close: [2.0, 2.45], stop: false},
};
// the fin: the bee's full turn over 0.9-2.3 s; the lure's cage blooms behind the stalk and the light flares in it
const WING_FLIP = [0.9, 2.3];
const CAGE = {open: [0.75, 1.6], close: [2.05, 2.5]};
const FLARE = {open: [1.05, 1.5], close: [1.95, 2.4]};
// the jaw's snaps: the one at the end of the swim-in and the one that starts the lunge (start of the shut, seconds)
const SNAP_IN = 2.3;
const DEP = 1.0;

// ------------------------------------------------------------ cameras: [az, el, d, tx, ty, tz, sx, sy], u = seconds on
// az from +z (the fish's right flank, the near side) toward +x (its face): the still's hero view is az 30. The bee's
// angles map onto the hero side: every teardown sits between az -5 and 65. A = the world points of the parts at rest.
export function makeBeeCams(A) {
  const add = (p, d) => p.map((v, i) => v + d[i]);
  const mid = (a, b, k = 0.5) => a.map((v, i) => v + (b[i] - v) * k);
  // the fish's middle at rest (the bulb to the tail, the lure's top to the fins): every close-up aims between it and
  // its part, so the push-in lands on the part and the whole fish stays inside the viewport
  const C0 = [0.15, 0.3, 0.1];
  const lens = mid(C0, add(A.lens, A.eyeAxis.map((v) => v * 0.45)), 0.45).map((v, i) => (i === 1 ? C0[1] + 0.2 : v));
  const wing = mid(C0, add(A.finHub, [0.9, -0.35, 1.0]), 0.35).map((v, i) => (i === 1 ? 0.2 : v));
  const lure = add(mid(C0, A.lureMid, 0.3), [0.1, 0.06, 0]);
  const rib = mid(C0, A.core, 0.4).map((v, i) => (i === 1 ? C0[1] - 0.1 : i === 0 ? v + 0.25 : v));
  const jaw = mid(C0, A.jaw, 0.4).map((v, i) => (i === 1 ? -0.03 : v));
  // the piranha's close-up targets sit on the parts themselves
  const eye = mid(add(A.lens, A.eyeAxis.map((v) => v * 0.3)), C0, 0.15);
  const stalk = add(A.lureMid, [0.18, -0.05, 0.05]);
  const flank = add(A.core, [0, 0.05, 0.15]);
  const mouth = add(A.jaw, [-0.1, 0.25, 0]);
  // every close-up keeps pushing in through its whole act and keeps orbiting about 14°/s, so a hold never parks
  const push = (a, b, u) => lerp(a, b, ss(0, 2.5, u));
  // the explode: wide while it is apart, pushing in through the reassembly toward the hero distance
  const ASM = A.asm ?? 3.2;
  return {
    intro: (u) => {
      const k = ss(0, 3.0, u);
      return [lerp(2, 32, k), lerp(13, 8, k), lerp(11.2, 10.4, k), C0[0], C0[1] + 0.08, C0[2], 0, -24];
    },
    // 2026-11-06, the piranha's own cameras: the angler's ones parked the shot (az
    // 20-50, el 6-10, the same distance in every beat). Every beat now sits on its part from its own side and height
    // and pushes in while the part hangs open: the eye in macro from the face side, the tail stalk from behind, the
    // glass flank from above, the jaw from below, the explode passing low round the parts.
    optics: (u) => [72 - 8 * u, lerp(10, 18, ss(0, 2.5, u)), push(6.2, 5.0, u), ...eye, 0, -24],
    wing: (u) => [10 + 14 * u, 13, push(12.6, 11.1, u), ...wing, 0, -24],
    leg: (u) => [-42 + 9 * u, 14, push(8.0, 6.8, u), ...stalk, 0, -24],
    thorax: (u) => [4 + 8 * u, 40 - 3 * u, push(8.2, 6.9, u), ...flank, 0, -24],
    abdomen: (u) => [56 - 7 * u, -4 + 2 * u, push(8.8, 7.4, u), ...mouth, 0, -24],
    // the explode: while the parts fly the camera swings 38° toward the face and drops under them to look up, then
    // through the reassembly swings back against the turntable onto the hero side, rises and pushes in, so the whole
    // fish turns into the hero view as it snaps together
    exploded: (u) => {
      const go = ss(0.3, 2.8, u);
      const back = ss(ASM, ASM + 1.5, u);
      return [34 + 38 * go - 67 * back, lerp(16, 0, go) + 9 * back, lerp(lerp(16.8, 14.8, go), 11.0, ss(ASM + 0.1, ASM + 1.2, u)), 0.1, lerp(0.58, 0.3, ss(ASM, ASM + 1.0, u)) - 0.22 * Math.sin(Math.PI * ss(1.8, 3.0, u)), 0.0, 0, -24];
    },
    // the turntable stops at 330°, so the fish comes out of it turned -30°: the hero view after it sits 30° lower in
    // the world to land on the same side of the fish
    hero: (u) => [-2 + 12 * u, 8, 10.3, ...C0, 0, -24],
  };
}

export function makeBeeTour(TL, A) {
  const CAM2 = makeBeeCams(A);
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const EVENTS = SCRIPT.map((e) => e.t);
  const AT = {};
  for (const e of SCRIPT) (AT[e.act] ??= []).push(e.t);
  const at = (act) => AT[act] ?? [];
  const T_EXP = at('exploded')[0] ?? 999;
  const T_ASM = at('assemble')[0] ?? 999;
  const T_END = at('hero')[0] ?? 999;
  const T_LUNGE = T_END + DEP;
  const win = (act, W, t) => {
    let v = 0;
    for (const t0 of at(act)) v = Math.max(v, ss(t0 + W.open[0], t0 + W.open[1], t) * (1 - ss(t0 + W.close[0], t0 + W.close[1], t)));
    return v;
  };
  const openOf = (act, t) => win(act, ACT[act], t);
  // the full explode: out 0.2-1.8 s after EXPLODED, home 0-1.0 s after it goes off (fast, it snaps)
  const explodeAt = (t) => ss(T_EXP + 0.2, T_EXP + 1.8, t) * (1 - ss(T_ASM, T_ASM + 1.0, t));
  // the turntable: 330° from the explode to just after the fish is whole again, steady in the middle
  const TT = [T_EXP + 0.2, T_ASM + 1.5];
  const turnAt = (t) => {
    const [a, b] = TT;
    if (t <= a) return 0;
    const R = 0.6;
    const span = b - a;
    const v = 330 / (span - R);
    const x = Math.min(t, b) - a;
    if (x < R) return (v * x * x) / (2 * R);
    if (x < span - R) return v * (x - R / 2);
    const y = x - (span - R);
    return v * (span - 1.5 * R) + v * y - (v * y * y) / (2 * R);
  };
  const stopAt = (t) => {
    let v = 0;
    for (const act of Object.keys(ACT)) {
      if (!ACT[act].stop) continue;
      for (const t0 of at(act)) v = Math.max(v, ss(t0, t0 + 0.45, t) * (1 - ss(t0 + ACT[act].close[1], t0 + ACT[act].close[1] + 0.5, t)));
    }
    return Math.max(v, ss(T_EXP, T_EXP + 0.45, t) * (1 - ss(T_ASM + 0.9, T_ASM + 1.5, t)));
  };
  const activity = (t) => Math.max(...Object.keys(ACT).map((a) => openOf(a, t)), explodeAt(t));
  const DT = 1 / 240;
  const SPIN = [0];
  for (let i = 1; i * DT <= DURATION + 1; i++) SPIN.push(SPIN[i - 1] + (1 + 5 * activity((i - 0.5) * DT)) * DT);
  const look = (A2, t) => {
    const u = Math.max(0, Math.min(A2.length - 2, t / DT));
    const i = Math.floor(u);
    return A2[i] + (A2[i + 1] - A2[i]) * (u - i);
  };
  const spinAt = (t) => (t < 0 ? t : look(SPIN, t));

  // the swim stroke: heavy while it swims in, a cruise between the beats, held still while a part is off, the full
  // stroke again for the wind-up and the lunge
  const swimAt = (t) => Math.max(1 - ss(2.5, 3.6, t), CRUISE * (1 - 0.6 * stopAt(t) - 0.4 * Math.min(1, explodeAt(t) * 3)), ss(T_END + 0.1, T_END + 0.8, t));
  // the jaw: its gape in degrees, with the snap at the end of the swim-in, the wide wind-up before the lunge and the
  // snap that starts it
  const snap = (t, t0) => ss(t0, t0 + 0.12, t) * (1 - ss(t0 + 0.2, t0 + 0.55, t));
  const gapeAt = (t) => GAPE_LO + 9 * ss(T_END + 0.15, T_END + 0.85, t) * (1 - ss(T_LUNGE, T_LUNGE + 0.12, t)) - 22 * snap(t, SNAP_IN) - 24 * snap(t, T_LUNGE);

  // the swim: in from behind-left banking through a turn toward the camera, the cruise, the turntable, the wind-up and
  // the lunge past the camera. path is the smooth part the camera follows; the stroke's sway rides on top for the fish
  // alone.
  const flightAt = (t) => {
    const kIn = ss(-0.3, 2.6, t);
    const ex = explodeAt(t);
    const calm = 1 - Math.min(1, ex * 2.5);
    const sw = swimAt(t);
    const path = new THREE.Vector3(lerp(-1.3 * S, 0, kIn), lerp(0.4 * S, 0, kIn), lerp(-1.7 * S, 0, kIn));
    let yaw = lerp(-48, 0, kIn) + 12 * Math.sin(Math.PI * kIn);
    let roll = -22 * Math.sin(Math.PI * Math.min(1, kIn * 1.05)) + (2.2 * Math.sin(t * 1.3 + 1.1) + 3.2 * Math.sin(t * 0.85 + 0.4)) * calm;
    let pitch = 5 * Math.sin(Math.PI * kIn) + (1.6 * Math.sin(t * 1.9 + 0.6) + 2.4 * Math.sin(t * 1.2 + 2.0)) * calm;
    yaw += turnAt(t);
    // the wind-up: it draws back along its heading and turns its head a little toward the camera; the lunge turns it
    // back onto the hero line, so it shoots forward and toward the lens and passes the camera on the right
    const wind = ss(T_END + 0.1, T_END + 0.9, t);
    yaw -= 9 * wind;
    pitch += 4 * wind;
    {
      const h0 = new THREE.Vector3(Math.cos(yaw * D2R), 0, -Math.sin(yaw * D2R));
      path.addScaledVector(h0, -0.4 * wind * (1 - ss(T_LUNGE, T_LUNGE + 0.3, t)));
    }
    if (t > T_LUNGE) {
      const u = t - T_LUNGE;
      const k = ss(0, 0.8, u);
      yaw += 6 * k;
      roll += 16 * k;
      pitch -= 5 * k;
      const h = new THREE.Vector3(Math.cos(yaw * D2R), 0, -Math.sin(yaw * D2R));
      path.addScaledVector(h, 1.15 * S * u * u + 0.4 * S * u).add(new THREE.Vector3(0, 0.05 * S * u * u, 0));
    }
    // the stroke sways the head against the tail; the camera never sees it
    const sway = 3.4 * sw * Math.sin(t * STROKE_W + Math.PI) * calm;
    const pos = path.clone().add(new THREE.Vector3(0, 0.07 * S * Math.sin(t * 1.1) * calm, 0));
    return {pos, path, yaw: yaw + sway, roll, pitch, calm, swim: sw, heading: yaw};
  };
  // the lure lags the turns: each joint takes the turn the fish made a moment earlier
  const LAG = 0.085;
  const bendAt = (t) => {
    const out = [];
    let a = flightAt(t);
    for (let k = 0; k < 7; k++) {
      const b = flightAt(t - LAG * (k + 1));
      out.push([0.55 * D2R * (b.pitch - a.pitch), 0.55 * D2R * (b.yaw - a.yaw) + 0.25 * D2R * (b.roll - a.roll)]);
      a = b;
    }
    return out;
  };

  // the camera: each act's view, blended over 0.85 s with a short dolly out, tracking the fish's path
  const VIEWS = [{t: -1, key: 'intro'}, ...SCRIPT.map((e) => ({t: e.t, key: e.act === 'assemble' ? 'exploded' : e.act}))];
  const viewIdx = (t) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= t) i++;
    return i;
  };
  const camFn = (V, t) => CAM2[V.key](t - (V.key === 'intro' ? 0 : V.t));
  // the reassembly keeps the explode's camera running on the explode's clock, also while the next view blends in
  const runOf = (j) => {
    while (j > 0 && VIEWS[j].key === 'exploded' && VIEWS[j - 1].key === 'exploded') j--;
    return VIEWS[j];
  };
  const camAt = (t) => {
    const i = viewIdx(t);
    let o = camFn(runOf(i), t);
    if (i > 0 && runOf(i) === VIEWS[i]) {
      const k = ss(VIEWS[i].t, VIEWS[i].t + 0.85, t);
      if (k < 1) {
        const a = camFn(runOf(i - 1), t);
        const dAz = ((o[0] - a[0] + 540) % 360) - 180;
        const b = o.map((v, j) => lerp(a[j], v, k));
        b[0] = a[0] + dAz * k;
        b[2] += 0.9 * Math.sin(Math.PI * k);
        o = b;
      }
    }
    const f = flightAt(t);
    const track = 0.85 - 0.5 * ss(T_LUNGE, T_LUNGE + 1.0, t);
    return {az: o[0], el: o[1], d: o[2], tx: o[3] + f.path.x * track, ty: o[4] + f.path.y * track, tz: o[5] + f.path.z * track, sx: o[6], sy: o[7]};
  };
  const actAt = (t) => VIEWS[viewIdx(t)].key;

  const stateAt = (t) => {
    const ex = explodeAt(t);
    const f = flightAt(t);
    const open = Object.fromEntries(Object.keys(ACT).map((a) => [a, openOf(a, t)]));
    let finFlip = 0;
    for (const t0 of at('wing')) finFlip = Math.max(finFlip, ss(t0 + WING_FLIP[0], t0 + WING_FLIP[1], t));
    if (finFlip >= 1) finFlip = 0;
    const cage = win('leg', CAGE, t);
    // the light flares in the lure act, glows up through the explode and flashes on the wind-up
    const flare = Math.max(win('leg', FLARE, t), 0.55 * ss(T_END + 0.2, T_END + 0.8, t) * (1 - ss(T_LUNGE + 0.6, T_LUNGE + 1.4, t)));
    const view = actAt(t);
    return {
      t,
      spinT: spinAt(t),
      explode: ex,
      swim: f.swim,
      gape: gapeAt(t),
      eye: open.optics,
      fin: open.wing,
      finFlip,
      lure: open.leg,
      cage,
      flare,
      rib: open.thorax,
      drop: open.abdomen,
      open,
      flight: f,
      bend: bendAt(t),
      cam: camAt(t),
      view,
      guides: 0.45 + 0.55 * Math.min(1, ex * 2.5 + activity(t)),
      turn: turnAt(t),
    };
  };

  const LABELS = {
    optics: [['eyeGlass', 'EYE RING', 'LIT · UNDER THE BROW'], ['lensRing', 'LENS RINGS', '3 × THREADED'], ['iris', 'IRIS', '10 BLADES · OPENS 4×'], ['barrel', 'LENS BARREL', 'SLIDES OUT']],
    wing: [['fin', 'PECTORAL FIN', 'FROSTED FILM'], ['finHub', 'FIN ROOT', 'PIVOT DRUM']],
    leg: [['stalk', 'TAIL STALK', '4 SEGMENTS · TELESCOPING'], ['joint', 'SEGMENT SERVO', 'SPINNING FREE'], ['tailHub', 'TAIL HUB', 'BRACKET · 2 LOBES'], ['tail', 'TAIL FIN', '11 RAYS · FROSTED FILM']],
    thorax: [['flank', 'GLASS BARREL', 'CLEAR · LIFTS OFF'], ['rib', 'RIB BANDS', 'HINGED · SWING UP'], ['gear', 'DRIVE GEARS', '2 BIG · 5× SPEED'], ['coil', 'LIT COILS', '2 · GREEN']],
    abdomen: [['jaw', 'LOWER JAW', 'DROPS · UNDERBITE'], ['fang', 'LOWER FANGS', 'GLASS · 2 ROWS'], ['upfang', 'UPPER FANGS', 'GLASS · 2 ROWS']],
    exploded: [['lens', 'OPTIC HEAD', '2 × LENS'], ['tailHub', 'TAIL', '4 SEGMENTS'], ['gear', 'DRIVE GEARS', 'SPINNING FREE'], ['fin', 'PECTORAL FIN', 'FROSTED FILM'], ['jaw', 'LOWER JAW', 'GLASS FANGS']],
  };
  const labelAt = (t, s) => {
    const v = s.view;
    if (ACT[v]) {
      const t0 = at(v).filter((x) => x <= t).pop();
      const A2 = ACT[v];
      return {set: LABELS[v], o: ss(t0 + A2.open[0] + 0.1, t0 + A2.open[0] + 0.45, t) * (1 - ss(t0 + A2.close[0] - 0.25, t0 + A2.close[0], t))};
    }
    if (v === 'exploded') return {set: LABELS.exploded, o: ss(T_EXP + 0.4, T_EXP + 0.8, t) * (1 - ss(T_EXP + 2.3, T_EXP + 2.6, t))};
    return {set: [], o: 0};
  };

  // the tail's and the near pectoral's angles in degrees, as pose() draws them
  const tailDeg = (tt) => (0.14 * Math.sin(tt * 1.6) + 0.4 * swimAt(tt) * Math.sin(tt * STROKE_W)) / D2R;
  const finDeg = (tt) => ((0.12 + 0.2 * swimAt(tt)) * Math.sin(tt * 2.2)) / D2R;
  const telemetry = (t, s) => {
    const f = s.flight;
    const stroke = [];
    for (let i = 0; i <= 90; i++) {
      const tt = t - 4 + (i / 90) * 4;
      stroke.push([tailDeg(tt), finDeg(tt)]);
    }
    const ex = s.explode > 0.04;
    const sw = s.swim;
    // the servos: FIN R, FIN L, TAIL, JAW, TAIL STALK, DORSAL; a part that is off its mount reads DETACHED
    const free = [ex || s.fin > 0.08, ex, ex, ex || s.drop > 0.08, ex || s.lure > 0.08, ex];
    const gapeLoad = Math.abs(s.gape - GAPE_LO) / 24;
    const base = [0.3 + 0.4 * sw, 0.28 + 0.4 * sw, 0.22 + 0.62 * sw, 0.24 + 0.6 * gapeLoad, 0.3 + 0.08 * Math.abs(s.bend[3][1]) * 40, 0.2 + 0.2 * sw];
    const servos = base.map((b, i) => (free[i] ? 0 : Math.max(0, Math.min(1, b + 0.04 * Math.sin(t * 7 + i) + 0.1 * Math.abs(f.roll) / 30))));
    const v = s.view;
    const opening = ACT[v] ? s.open[v] : 0;
    const NAME = {optics: 'OPTICS OPEN', wing: 'FIN OFF', leg: 'TAIL OUT', thorax: 'FLANK OPEN', abdomen: 'JAW DROPPED'};
    let status = 'CRUISE';
    let kind = 'ok';
    if (t < 2.6) status = 'BANKING';
    if (ACT[v] && opening > 0.05) [status, kind] = [NAME[v], 'warn'];
    if (v === 'exploded') [status, kind] = t < T_ASM ? ['TEARDOWN', 'warn'] : s.explode > 0.04 ? ['REASSEMBLY', 'warn'] : ['CRUISE', 'ok'];
    if (t > T_END + 0.1 && t <= T_LUNGE) status = 'WIND-UP';
    if (t > T_LUNGE) [status, kind] = ['LUNGE', 'warn'];
    const ROW = {optics: 0, leg: 1, thorax: 2, wing: 3, abdomen: 4};
    const sub = (i) => {
      if (ex) return ['warn', 'DETACHED'];
      if (ROW[v] === i && opening > 0.05) return ['warn', i === 3 || i === 4 ? 'DETACHED' : 'OPEN'];
      if (i === 3) return sw > 0.05 ? ['ok', `${(STROKE_HZ * 60).toFixed(0)} SPM`] : ['idle', 'FEATHERED'];
      if (i === 2) return sw > 0.05 ? ['ok', 'RUNNING'] : ['idle', 'IDLE'];
      if (i === 1) return s.flare > 0.1 ? ['warn', 'FLARE'] : ['ok', 'LIT 18%'];
      return ['ok', ['TRACKING', '', '', '', 'ARMED', 'SEALED'][i]];
    };
    const last = SCRIPT.filter((e) => e.t <= t).pop();
    const say = (e) => (e.act === 'exploded' ? 'EXPLODED ON' : e.act === 'assemble' ? 'EXPLODED OFF · REASSEMBLE' : e.act === 'hero' ? 'HERO · RELEASE' : `ISOLATE ${ASSEMBLY_LABEL[e.act]}`);
    const lungeV = t > T_LUNGE ? (2.3 * S * (t - T_LUNGE) + 0.4 * S) * M_PER : 0;
    const speed = lungeV + M_PER * (0.9 * (1 - ss(1.5, 3.0, t)) + 0.35 * sw);
    const labels = labelAt(t, s);
    const amp = (0.14 + 0.4 * sw) / D2R;
    return {
      time: t,
      dur: DURATION,
      lift: Math.max(0, Math.min(1, 0.18 + 0.55 * sw + 0.25 * ss(T_LUNGE, T_LUNGE + 0.4, t) + 0.05 * Math.sin(t * STROKE_W))),
      status,
      statusKind: kind,
      freq: STROKE_HZ * Math.min(1, 0.4 + sw),
      amp,
      stroke,
      chartMax: 40,
      chartTicks: [-30, 30],
      chartSpan: '−4 S',
      playback: 1,
      blur: 1,
      shutter: 'TAIL · R PECTORAL',
      battery: 0.912 - 0.0021 * t,
      power: 41 + 120 * Math.pow(sw, 1.4) + 60 * activity(t) + 8 * Math.sin(t * STROKE_W),
      volt: 48.2,
      motorT: 22 + 0.35 * t,
      servos,
      legsFree: free.some((x) => x),
      legFreeEach: free,
      depth: DEPTH0 - M_PER * f.pos.y * 4,
      vs: -M_PER * 0.07 * S * 1.1 * Math.cos(t * 1.1) * f.calm,
      pitch: f.pitch,
      roll: f.roll,
      airspeed: speed,
      trim: s.explode > 0.04 ? 'FREE' : t > T_LUNGE ? 'STRIKE' : 'NEUTRAL',
      view: v === 'intro' ? 'hero' : v === 'exploded' ? null : v,
      display: {labels: labels.o > 0.5, exploded: t >= T_EXP && t < T_ASM, flare: s.flare > 0.2, turntable: s.turn > 0 && t < TT[1]},
      subs: [0, 1, 2, 3, 4, 5].map(sub),
      focus: ROW[v] ?? (v === 'exploded' ? 5 : -1),
      events: EVENTS,
      next: `${EVENTS.length} OPERATOR ACTIONS`,
      log: last ? `OPERATOR · ${say(last)}` : 'INBOUND · BANKING IN',
      mode: status,
      modeSub:
        status === 'BANKING'
          ? `BANK ${f.roll.toFixed(0)}° · INBOUND`
          : status === 'TEARDOWN' || status === 'REASSEMBLY'
            ? `TURNTABLE ${Math.round(s.turn)}° · ${Math.round(s.explode * 100)}% APART`
            : status === 'LUNGE'
              ? `STRIKE · ${speed.toFixed(1)} M/S`
              : status === 'WIND-UP'
                ? `JAW ${s.gape.toFixed(0)}° · MOUTH OPEN`
                : ACT[v] && opening > 0.05
                  ? `${ASSEMBLY_LABEL[v]} · ${Math.round(opening * 100)}% APART`
                  : `DEPTH ${(DEPTH0 - M_PER * f.pos.y * 4).toFixed(1)} M · STATION`,
      viewNote: `ISOLATE · ${v === 'intro' || v === 'hero' ? 'HERO' : v === 'exploded' ? 'ALL' : ASSEMBLY_LABEL[v]}`,
      labelSet: labels,
    };
  };

  return {SCRIPT, DURATION, stateAt, telemetry, camAt, flightAt};
}

/** Labels in two columns at the viewport's edges, from a set of anchors. */
export function makeLabels(st, fish) {
  const p = new THREE.Vector3();
  return ({set, o}) => {
    if (o < 0.02) return [];
    const pts = [];
    for (const [key, name, sub] of set) {
      const A = fish.anchors[key];
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

// ------------------------------------------------------------ the operator's pointer, on the act buttons
const GUTTER_X = 1262;
export function makeCursor(ui, SCRIPT) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[BUTTON[e.act]]}));
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
