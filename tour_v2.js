// The VX-9 wasp's tour: the bee's (robobee-shared/tour_v2.js) 1:1, the stinger sliding out at the end of the abdomen act.
// The HB-7 simulator tour, second cut: the bee itself does something big every 2-3 s. It flies in and banks through a
// turn, then the operator opens one assembly after another, each with the camera pushed in on it: the lens unscrews
// along its axis and the iris opens, a wing pulls out of its hinge and turns over in the air, a leg comes apart
// segment by segment with its servos spinning, the thorax shells lift off over spinning gears, the abdomen telescopes
// apart; then the whole bee explodes on a 330° turntable with its parts spinning, snaps back together while it still
// turns, spins its wings up and banks away out of frame. Labels show only while parts move.
// Script: the entry's timeline.json, {duration, script: [{t, act}]}; act is an assembly (optics, wing, leg, thorax,
// abdomen), 'exploded', 'assemble' or 'hero' (the departure). Everything is a pure function of film time t.
import * as THREE from 'three';
import {VIEWPORT} from './console.js';
import {FLOOR_Y} from './tour.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const D2R = Math.PI / 180;
const MM = 80;
export const FLAP_HZ = 7.5;
export const AMP = 32;
export const REACH = 0.62;

export const ASSEMBLIES = ['hero', 'optics', 'wing', 'leg', 'thorax', 'abdomen'];
export const ASSEMBLY_LABEL = {hero: 'HERO', optics: 'OPTICS', wing: 'WING', leg: 'LEG L2', thorax: 'THORAX', abdomen: 'ABDOMEN'};
export const DISPLAY2 = ['labels', 'exploded', 'blur', 'turntable'];
export const DISPLAY2_LABEL = {labels: 'LABELS', exploded: 'EXPLODED', blur: 'MOTION BLUR', turntable: 'TURNTABLE'};
// the button each act presses
const BUTTON = {optics: 'optics', wing: 'wing', leg: 'leg', thorax: 'thorax', abdomen: 'abdomen', exploded: 'exploded', assemble: 'exploded', hero: 'hero'};

// each act's own clock (seconds after its click): when it opens, when it closes, whether the wings stop for it
const ACT = {
  optics: {open: [0.35, 1.5], close: [2.2, 2.65], stop: false},
  wing: {open: [0.45, 1.25], close: [2.35, 2.7], stop: true},
  leg: {open: [0.35, 1.45], close: [2.15, 2.55], stop: false},
  thorax: {open: [0.3, 1.4], close: [2.1, 2.6], stop: true},
  abdomen: {open: [0.3, 1.3], close: [2.0, 2.45], stop: true},
};

// ------------------------------------------------------------ cameras: [az, el, d, tx, ty, tz, sx, sy], u = seconds on
export const CAM2 = {
  intro: (u) => {
    const k = ss(0, 3.0, u);
    return [lerp(150, 34, k), lerp(15, 9, k), lerp(8.6, 7.3, k), 0.0, -0.25, 0.25, -30, -14];
  },
  optics: (u) => [88 - 8 * u, 6, lerp(4.9, 4.2, ss(0, 1.6, u)), 1.22, 0.12, 0.45, 0, -14],
  wing: (u) => [40 + 6 * u, 18, lerp(8.6, 7.6, ss(0, 1.6, u)), -0.5, 0.95, 1.25, 0, -14],
  leg: (u) => [14 + 9 * u, 6, lerp(6.6, 5.8, ss(0, 1.6, u)), 0.1, -0.8, 0.45, 0, -14],
  thorax: (u) => [8 + 10 * u, 34, lerp(6.8, 6.0, ss(0, 1.6, u)), 0.0, 0.32, 0.05, 0, -14],
  abdomen: (u) => [-30 + 9 * u, 14, lerp(6.6, 5.8, ss(0, 1.6, u)), -2.45, -0.95, 0.1, 0, -14],
  exploded: (u) => [34 + 5 * u, 18, 11.6, 0.0, -0.15, 0.0, -20, -14],
  hero: (u) => [18 + 14 * u, 9, 6.8, 0.0, -0.22, 0.25, -30, -14],
};

export function makeTour2(TL) {
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const EVENTS = SCRIPT.map((e) => e.t);
  const AT = {};
  for (const e of SCRIPT) (AT[e.act] ??= []).push(e.t);
  const at = (act) => AT[act] ?? [];
  const T_EXP = at('exploded')[0] ?? 999;
  const T_ASM = at('assemble')[0] ?? 999;
  const T_END = at('hero')[0] ?? 999;
  // an assembly's opening, 0..1, from its act's clock
  const openOf = (act, t) => {
    let v = 0;
    for (const t0 of at(act)) {
      const A = ACT[act];
      v = Math.max(v, ss(t0 + A.open[0], t0 + A.open[1], t) * (1 - ss(t0 + A.close[0], t0 + A.close[1], t)));
    }
    return v;
  };
  // the full explode: out 0.2-1.8 s after EXPLODED, home 0-1.0 s after it goes off (fast, it snaps)
  const explodeAt = (t) => ss(T_EXP + 0.2, T_EXP + 1.8, t) * (1 - ss(T_ASM, T_ASM + 1.0, t));
  // the turntable: 330° from the explode to just after the bee is whole again, steady in the middle
  const TT = [T_EXP + 0.2, T_ASM + 1.5];
  const turnAt = (t) => {
    const [a, b] = TT;
    if (t <= a) return 0;
    const R = 0.6;
    const span = b - a;
    const v = 330 / (span - R);
    const x = Math.min(t, b) - a;
    // a trapezoid of speed: ramp up over R, steady, ramp down over R
    if (x < R) return (v * x * x) / (2 * R);
    if (x < span - R) return v * (x - R / 2);
    const y = x - (span - R);
    return v * (span - 1.5 * R) + v * y - (v * y * y) / (2 * R);
  };
  // the wings stop for the acts that need still wings and for the explode, and spin back up after
  const stopAt = (t) => {
    let v = 0;
    for (const act of Object.keys(ACT)) {
      if (!ACT[act].stop) continue;
      for (const t0 of at(act)) v = Math.max(v, ss(t0, t0 + 0.45, t) * (1 - ss(t0 + ACT[act].close[1], t0 + ACT[act].close[1] + 0.5, t)));
    }
    return Math.max(v, ss(T_EXP, T_EXP + 0.45, t) * (1 - ss(T_ASM + 0.9, T_ASM + 1.5, t)));
  };
  // the busy clock the gears and loose parts turn on: they run five times faster while something is open
  const activity = (t) => Math.max(...Object.keys(ACT).map((a) => openOf(a, t)), explodeAt(t));
  const DT = 1 / 240;
  const SPIN = [0];
  for (let i = 1; i * DT <= DURATION + 1; i++) SPIN.push(SPIN[i - 1] + (1 + 5 * activity((i - 0.5) * DT)) * DT);
  const look = (A, t) => {
    const u = Math.max(0, Math.min(A.length - 2, t / DT));
    const i = Math.floor(u);
    return A[i] + (A[i + 1] - A[i]) * (u - i);
  };
  const spinAt = (t) => (t < 0 ? t : look(SPIN, t));

  // the flight: in from behind-left banking through a turn, the hover, the turntable, the departure banking away
  const flightAt = (t) => {
    const kIn = ss(-0.3, 2.6, t);
    const ex = explodeAt(t);
    const calm = 1 - Math.min(1, ex * 2.5);
    const pos = new THREE.Vector3(lerp(-2.6, 0, kIn), lerp(0.6, 0, kIn) + 0.05 * Math.sin(t * 2.6) * calm, lerp(-3.2, 0, kIn));
    let yaw = lerp(-80, 0, kIn) + 14 * Math.sin(Math.PI * kIn);
    let roll = 30 * Math.sin(Math.PI * Math.min(1, kIn * 1.05)) + 1.7 * Math.sin(t * 1.3 + 1.1) * calm;
    let pitch = -6 * Math.sin(Math.PI * kIn) + 1.4 * Math.sin(t * 1.9 + 0.6) * calm;
    yaw += turnAt(t);
    if (t > T_END + 1.0) {
      const u = t - T_END - 1.0;
      const k = ss(0, 1.0, u);
      yaw += 38 * k;
      roll -= 30 * k;
      pitch += 8 * k;
      const h = new THREE.Vector3(Math.cos(yaw * D2R), 0, -Math.sin(yaw * D2R));
      pos.addScaledVector(h, 1.6 * u * u).add(new THREE.Vector3(0, 0.45 * u * u, 0));
    }
    return {pos, yaw, roll, pitch, calm};
  };

  // the camera: each act's view, blended over 0.8 s with a short dolly out, tracking the bee as it flies
  const VIEWS = [{t: -1, key: 'intro'}, ...SCRIPT.map((e) => ({t: e.t, key: e.act === 'assemble' ? 'exploded' : e.act}))];
  const viewIdx = (t) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= t) i++;
    return i;
  };
  const camFn = (V, t) => CAM2[V.key](t - (V.key === 'intro' ? 0 : V.t));
  const camAt = (t) => {
    const i = viewIdx(t);
    let o = camFn(VIEWS[i], t);
    // the reassembly keeps the explode's camera running from where it was
    if (VIEWS[i].key === 'exploded' && i > 0 && VIEWS[i - 1].key === 'exploded') o = camFn(VIEWS[i - 1], t);
    else if (i > 0) {
      const k = ss(VIEWS[i].t, VIEWS[i].t + 0.85, t);
      if (k < 1) {
        const a = camFn(VIEWS[i - 1], t);
        const dAz = ((o[0] - a[0] + 540) % 360) - 180;
        const b = o.map((v, j) => lerp(a[j], v, k));
        b[0] = a[0] + dAz * k;
        b[2] += 0.7 * Math.sin(Math.PI * k);
        o = b;
      }
    }
    // the camera follows the bee in, and lets it go on the way out
    const f = flightAt(t);
    const track = 0.85 - 0.5 * ss(T_END + 1.0, T_END + 2.0, t);
    return {az: o[0], el: o[1], d: o[2], tx: o[3] + f.pos.x * track, ty: o[4] + f.pos.y * track, tz: o[5] + f.pos.z * track, sx: o[6], sy: o[7]};
  };
  const actAt = (t) => {
    const i = viewIdx(t);
    return VIEWS[i].key;
  };

  const stateAt = (t) => {
    const ex = explodeAt(t);
    const amp = AMP * (1 - stopAt(t));
    const f = flightAt(t);
    const open = Object.fromEntries(Object.keys(ACT).map((a) => [a, openOf(a, t)]));
    // the wing's own clock: out, one full turn over, back in fast
    let wingOut = 0;
    let wingFlip = 0;
    for (const t0 of at('wing')) {
      const A = ACT.wing;
      wingOut = Math.max(wingOut, ss(t0 + A.open[0], t0 + A.open[1], t) * (1 - ss(t0 + A.close[0], t0 + A.close[1], t)));
      wingFlip = Math.max(wingFlip, ss(t0 + 0.9, t0 + 2.3, t));
    }
    if (wingFlip >= 1) wingFlip = 0;
    // the sting: out of its collar once the abdomen hangs open, back in before it closes
    let stingK = 0;
    for (const t0 of at('abdomen')) stingK = Math.max(stingK, ss(t0 + 1.05, t0 + 1.55, t) * (1 - ss(t0 + 1.9, t0 + 2.2, t)));
    const view = actAt(t);
    return {
      t,
      spinT: spinAt(t),
      explode: ex,
      amp,
      flap: Math.PI * 2 * FLAP_HZ * t,
      display: 1 - amp / AMP,
      blur: 1,
      sub: {thorax: open.thorax, abdomen: open.abdomen},
      eye: open.optics,
      wingOut,
      wingFlip,
      legK: open.leg,
      stingK,
      open,
      flight: f,
      cam: camAt(t),
      view,
      guides: 0.45 + 0.55 * Math.min(1, ex * 2.5 + activity(t)),
      turn: turnAt(t),
    };
  };

  // labels: on while the act's parts are moving apart and while they hang open, gone before they close
  const LABELS = {
    optics: [['eyeGlass', 'OUTER GLASS', 'Ø 40 MM · AR COATED'], ['eyeInner', 'INNER ELEMENT', 'Ø 15 MM'], ['iris', 'IRIS', '10 BLADES · OPENS 3×'], ['barrel', 'LENS BARREL', 'THREADED · 4 RINGS']],
    wing: [['wing', 'WING MEMBRANE', 'FROSTED FILM · 0.1 MM'], ['hinge', 'WING HINGE', 'QUICK RELEASE'], ['hinge2', 'HINDWING HINGE', 'PHASE +40°']],
    leg: [['hip2', 'HIP SERVO', 'YAW + LIFT'], ['knee2', 'KNEE SERVO', '0.4 N·M'], ['foot', 'FOOT CLAW', 'TWIN HOOKS']],
    thorax: [['plate', 'SADDLE PLATE', 'POLYMER SHELL'], ['gears', 'DRIVE GEAR STACK', '3 SPUR GEARS'], ['act', 'ACTUATOR RING', '11 PISTONS'], ['core', 'CONTROL BOARDS', 'FLIGHT CPU · IMU']],
    abdomen: [['waist', 'WAIST STALK', '5 BEADS · LIT RINGS'], ['s1', 'SHELL BAND', 'TELESCOPING'], ['capsule', 'BAND 4', 'RIVETED · 5 SEGMENTS'], ['sting', 'STINGER', 'GLASS · EXTENDS 30 MM']],
    exploded: [['lens', 'OPTIC HEAD', '2 × LENS'], ['collar', 'NECK BEARING', '10 SEGMENTS'], ['gears', 'DRIVE GEARS', 'SPINNING FREE'], ['capsule', 'ABDOMEN BANDS', '5 SEGMENTS'], ['hinge', 'WING HINGE', 'QUICK RELEASE']],
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

  const telemetry = (t, s) => {
    const f = s.flight;
    const stroke = [];
    for (let i = 0; i <= 90; i++) {
      const tt = t - 1.2 + (i / 90) * 1.2;
      const a = AMP * (1 - stopAt(tt));
      const ph = Math.PI * 2 * FLAP_HZ * tt;
      stroke.push([a * Math.sin(ph), a * Math.sin(ph + 0.7)]);
    }
    const ex = s.explode > 0.04;
    const acc = -Math.sin(t * 2.6);
    const free = [0, 1, 2, 3, 4, 5].map((i) => ex || (i === 1 && s.legK > 0.08));
    const servos = [0.44, 0.58, 0.49, 0.4, 0.53, 0.46].map((b, i) => (free[i] ? 0 : Math.max(0, Math.min(1, b * (1 + 0.32 * acc) + 0.12 * Math.abs(f.roll) / 30 + 0.03 * Math.sin(t * 7 + i)))));
    const v = s.view;
    const opening = ACT[v] ? s.open[v] : 0;
    const NAME = {optics: 'OPTICS OPEN', wing: 'WING OFF', leg: 'LEG L2 OPEN', thorax: 'THORAX OPEN', abdomen: 'ABDOMEN OPEN'};
    let status = 'HOVER';
    let kind = 'ok';
    if (t < 2.6) status = 'BANKING';
    if (ACT[v] && (opening > 0.05 || (v === 'wing' && s.wingOut > 0.05))) [status, kind] = [NAME[v], 'warn'];
    if (v === 'exploded') [status, kind] = t < T_ASM ? ['TEARDOWN', 'warn'] : s.explode > 0.04 ? ['REASSEMBLY', 'warn'] : ['HOVER', 'ok'];
    if (t > T_END + 1.0) status = 'DEPARTING';
    const ROW = {optics: 0, thorax: 2, wing: 3, leg: 4, abdomen: 5};
    const sub = (i) => {
      if (ex) return ['warn', 'DETACHED'];
      if (ROW[v] === i && (opening > 0.05 || (v === 'wing' && s.wingOut > 0.05))) return ['warn', i === 3 ? 'DETACHED' : 'OPEN'];
      if (i === 3) return s.amp > 1 ? ['ok', `${FLAP_HZ} HZ`] : ['idle', 'PARKED'];
      if (i === 2) return s.amp > 1 ? ['ok', 'RUNNING'] : ['idle', 'STOPPED'];
      return ['ok', ['TRACKING', 'LOCKED', '', '', 'HOLDING', 'SEALED'][i]];
    };
    const last = SCRIPT.filter((e) => e.t <= t).pop();
    const say = (e) => (e.act === 'exploded' ? 'EXPLODED ON' : e.act === 'assemble' ? 'EXPLODED OFF · REASSEMBLE' : e.act === 'hero' ? 'HERO · RELEASE' : `ISOLATE ${ASSEMBLY_LABEL[e.act]}`);
    const sp = f.pos.length() > 0.05 ? 0.4 + 0.2 * Math.abs(Math.sin(t)) : 0.004;
    const labels = labelAt(t, s);
    return {
      time: t,
      dur: DURATION,
      lift: Math.max(0, (s.amp / AMP) * (0.68 + 0.02 * Math.sin(s.flap)) + 0.12 * Math.abs(f.roll) / 30),
      status,
      statusKind: kind,
      freq: FLAP_HZ * ss(0.5, 6, s.amp),
      amp: s.amp,
      stroke,
      playback: 1,
      blur: 1,
      battery: 0.842 - 0.0022 * t,
      power: 4.2 + 31 * Math.pow(s.amp / AMP, 1.5) * (1 + 0.04 * Math.sin(s.flap)) + 3 * Math.abs(f.roll) / 30,
      volt: 3.92 - 0.006 * 36,
      motorT: 34 + 0.35 * t,
      servos,
      legsFree: ex,
      legFreeEach: free,
      airborne: true,
      alt: (f.pos.y - FLOOR_Y) * MM,
      vs: MM * 0.05 * 2.6 * Math.cos(t * 2.6) * f.calm,
      pitch: f.pitch,
      roll: f.roll,
      airspeed: sp,
      view: v === 'intro' ? 'hero' : v === 'exploded' ? null : v,
      display: {labels: labels.o > 0.5, exploded: t >= T_EXP && t < T_ASM, blur: s.amp > 3, turntable: s.turn > 0 && t < TT[1]},
      subs: [0, 1, 2, 3, 4, 5].map(sub),
      focus: ROW[v] ?? (v === 'exploded' ? 1 : -1),
      events: EVENTS,
      next: `${EVENTS.length} OPERATOR ACTIONS`,
      log: last ? `OPERATOR · ${say(last)}` : 'INBOUND · BANKING LEFT',
      mode: status,
      modeSub:
        status === 'BANKING'
          ? `ROLL ${f.roll.toFixed(0)}° · INBOUND`
          : status === 'TEARDOWN' || status === 'REASSEMBLY'
            ? `TURNTABLE ${Math.round(s.turn)}° · ${Math.round(s.explode * 100)}% APART`
            : status === 'DEPARTING'
              ? `BANK ${f.roll.toFixed(0)}° · RELEASED`
              : ACT[v]
                ? `${ASSEMBLY_LABEL[v]} · ${Math.round(Math.max(opening, s.wingOut) * 100)}% APART`
                : `STATION KEEPING · ${((f.pos.y - FLOOR_Y) * MM).toFixed(0)} MM AGL`,
      viewNote: `ISOLATE · ${v === 'intro' || v === 'hero' ? 'HERO' : v === 'exploded' ? 'ALL' : ASSEMBLY_LABEL[v]}`,
      labelSet: labels,
    };
  };

  return {SCRIPT, DURATION, stateAt, telemetry, camAt};
}

/** Labels in two columns at the viewport's edges, as the first cut, from a set of anchors. */
export function makeLabels2(st, bee) {
  const p = new THREE.Vector3();
  return ({set, o}) => {
    if (o < 0.02) return [];
    const pts = [];
    for (const [key, name, sub] of set) {
      const A = bee.anchors[key];
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
export function makeCursor2(ui, SCRIPT) {
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
