// The HB-7 simulator tour: everything the console film needs from one script (the entry's timeline.json, {duration,
// script: [{t, view | display, cam?}]}) as pure functions of film time t. The display toggles and their eased weights,
// the motion they drive (the motor winding down before the explode, the reassembly, the wings spinning up, the
// high-speed camera slowing playback to 0.2× when MOTION BLUR goes off), the cameras for the five views, the telemetry
// the console shows (all read off the same motion, so the numbers agree with the picture), the labels and the
// operator's pointer. The film (sim.js) and a later live page share it, the way cessna-shared/live.js reuses film.js.
import * as THREE from 'three';
import {DISPLAY, VIEWPORT} from './console.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

export const FLAP_HZ = 7.5;
export const AMP = 32;
export const REACH = 0.6;
// bee units to millimetres (the body is 3 units, a 240 mm drone) and the floor under it
const MM = 80;
export const FLOOR_Y = -1.85;

// ------------------------------------------------------------ cameras (u = seconds since the view came on)
// [az, el, d, tx, ty, tz, sx, sy]; the viewport sits a little above the canvas centre, hence sy
export const VIEW_FN = {
  'hero:intro': (u) => {
    // from frame 0: an orbit round the front quarter and a push-in, the whole bee big the whole way
    const k = ss(-0.6, 3.6, u);
    return [lerp(82, 30, k), lerp(4, 11, k), lerp(9.4, 6.8, k), 0.1, -0.24, 0.25, -30, -14];
  },
  hero: (u) => [32 + 2.2 * u, 10, 7.6, -0.1, -0.28, 0.3, -40, -14],
  'hero:end': (u) => [24 + 2.6 * u, 8, 7.3, -0.05, -0.26, 0.28, -30, -14],
  front: (u) => [86 + 2 * u, 12, 7.8, 0.35, -0.28, 0.0, 0, -14],
  side: (u) => [3 + 2 * u, 7, 8.8, -0.2, -0.3, 0.0, 0, -14],
  // the near forewing from ahead and above: it spans the viewport, its face shows and its stroke sweeps up and down
  wing: (u) => [70 - 1.2 * u, 36, 6.6, 0.05, 0.22, 1.0, 0, -14],
  legs: (u) => [40 + 2 * u, 5, 6.8, 0.3, -0.62, 0.3, 0, -14],
};
const EASE = {labels: 0.5, xray: 0.8, exploded: 1.8, blur: 0.6, orbit: 1.4};
const button = (key) => key.split(':')[0];

/** Everything from one tour. */
export function makeTour(TL) {
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const EVENTS = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);
  const displayAt = (t) => {
    const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
    for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
    return out;
  };
  const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -99;
  const eased = (key, t) => {
    const on = displayAt(t)[key];
    const k = ss(lastFlip(key, t), lastFlip(key, t) + EASE[key], t);
    return on ? k : 1 - k;
  };
  // the motor and the teardown: EXPLODED on winds the beat down over 0.7 s, then the parts travel out over 1.8 s;
  // off brings them home over 1.8 s, then the beat spins back up over 0.7 s
  const motion = (t) => {
    const on = displayAt(t).exploded;
    const t0 = lastFlip('exploded', t);
    if (on) return {explode: ss(t0 + 0.5, t0 + 2.3, t), amp: AMP * (1 - ss(t0, t0 + 0.7, t))};
    if (t0 < -90) return {explode: 0, amp: AMP};
    return {explode: 1 - ss(t0, t0 + 1.8, t), amp: AMP * ss(t0 + 1.7, t0 + 2.4, t)};
  };
  // playback: 1× with the motion blur on, 0.2× (a high-speed capture) with it off; the bee's own clock integrates it,
  // and so does the energy the wings draw
  const rate = (t) => 1 - 0.8 * (1 - eased('blur', t));
  const DT = 1 / 240;
  const SIM = [0];
  const FLY = [0];
  for (let i = 1; i * DT <= DURATION + 1; i++) {
    const t = (i - 0.5) * DT;
    SIM.push(SIM[i - 1] + rate(t) * DT);
    FLY.push(FLY[i - 1] + (motion(t).amp / AMP) * rate(t) * DT);
  }
  const look = (A, t) => {
    const u = Math.max(0, Math.min(A.length - 2, t / DT));
    const i = Math.floor(u);
    return A[i] + (A[i + 1] - A[i]) * (u - i);
  };
  // before the film starts the bee was already flying at 1×
  const simT = (t) => (t < 0 ? t : look(SIM, t));
  const flyT = (t) => (t < 0 ? 0 : look(FLY, t));

  // cameras: each view blends from the one before over 1.6 s; the explode pulls the camera back so the parts stay in
  // the viewport; the orbit's turn rate ramps in
  const VIEWS = SCRIPT.filter((e) => e.view).map((e) => ({t: e.t, key: e.cam ? `${e.view}:${e.cam}` : e.view}));
  // the orbit: on, it ramps into a steady 16°/s; off, it keeps the turn made so far and coasts to a stop
  const orbitTurn = (t) => {
    const f = lastFlip('orbit', t);
    if (f < -90) return 0;
    const R = EASE.orbit;
    const turned = (x) => 16 * (x < R ? (x * x) / (2 * R) : x - R / 2);
    if (displayAt(t).orbit) return turned(t - f);
    const on = SCRIPT.filter((e) => e.display === 'orbit' && e.t < f).pop();
    if (!on) return 0;
    const c = Math.min(t - f, R);
    return turned(f - on.t) + 16 * c * (1 - c / (2 * R));
  };
  const viewIdx = (t) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= t) i++;
    return i;
  };
  const blendCam = (a, b, k) => {
    const o = b.map((v, i) => lerp(a[i], v, k));
    const dAz = ((b[0] - a[0] + 540) % 360) - 180;
    o[0] = a[0] + dAz * k;
    const swing = Math.min(1, Math.abs(dAz) / 90);
    // every move dollies out a little on the way, so between two close views the bee never passes cut by the panels
    o[2] += Math.max(0, Math.max(a[2], b[2]) + 0.5 * swing + 1.4 - o[2]) * Math.sin(Math.PI * k);
    return o;
  };
  const camAt = (t) => {
    const i = viewIdx(t);
    const V = VIEWS[i];
    let o = VIEW_FN[V.key](t - V.t);
    if (i > 0) {
      const k = ss(V.t, V.t + 1.6, t);
      if (k < 1) o = blendCam(VIEW_FN[VIEWS[i - 1].key](t - VIEWS[i - 1].t), o, k);
    }
    const ex = motion(t).explode;
    o = [...o];
    o[2] *= 1 + 0.62 * ex;
    o[4] += 0.15 * ex;
    o[1] += 6 * ex;
    // the orbit's turn; once it is off, the next view blends it away
    let az = orbitTurn(t);
    if (!displayAt(t).orbit && V.t > lastFlip('orbit', t)) az *= 1 - ss(V.t, V.t + 1.6, t);
    o[0] += az;
    return {az: o[0], el: o[1], d: o[2], tx: o[3], ty: o[4], tz: o[5], sx: o[6], sy: o[7]};
  };
  const viewAt = (t) => {
    const V = VIEWS[viewIdx(t)];
    return [V.t, button(V.key)];
  };
  // labels wait 0.9 s into a view before they come in; on a view change the old ones fade out over 0.3 s
  const labelGate = (t) => {
    const i = viewIdx(t);
    const V = VIEWS[i];
    const g = ss(V.t + 0.9, V.t + 1.5, t);
    const prev = i > 0 ? ss(VIEWS[i - 1].t + 0.9, VIEWS[i - 1].t + 1.5, V.t) * (1 - ss(V.t, V.t + 0.3, t)) : 0;
    return Math.min(1, g + prev);
  };

  /** The bee's state at film time t: pose parameters, hover, x-ray, guides, camera. */
  const stateAt = (t) => {
    const m = motion(t);
    const T = simT(t);
    const calm = 1 - Math.min(1, m.explode * 2.5);
    return {
      t,
      simT: T,
      explode: m.explode,
      amp: m.amp,
      flap: Math.PI * 2 * FLAP_HZ * T,
      display: 1 - m.amp / AMP,
      blur: eased('blur', t),
      rate: rate(t),
      xray: eased('xray', t),
      hover: {y: 0.05 * Math.sin(T * 2.6) * calm, pitch: 0.025 * Math.sin(T * 1.9 + 0.6) * calm, roll: 0.03 * Math.sin(T * 1.3 + 1.1) * calm, calm},
      guides: 0.45 + 0.55 * Math.max(Math.min(1, m.explode * 2.5), eased('xray', t)),
      cam: camAt(t),
      view: viewAt(t)[1],
      displays: displayAt(t),
      labels: eased('labels', t) * labelGate(t),
    };
  };

  /** What the console shows at t, read off the same motion as the picture. */
  const telemetry = (t, s) => {
    const T = s.simT;
    const D = s.displays;
    // the stroke angle of the near forewing and hindwing over the last 1.2 s of film time
    const stroke = [];
    for (let i = 0; i <= 90; i++) {
      const tt = t - 1.2 + (i / 90) * 1.2;
      const a = motion(tt).amp;
      const ph = Math.PI * 2 * FLAP_HZ * simT(tt);
      stroke.push([a * Math.sin(ph), a * Math.sin(ph + 0.7)]);
    }
    const beat = ss(0.5, 6, s.amp);
    const fly = flyT(t);
    const power = 4.2 + 31 * Math.pow(s.amp / AMP, 1.5) * (1 + 0.04 * Math.sin(s.flap)) + 1.1 * s.hover.calm;
    const ex = s.explode > 0.04;
    // leg loads follow the hover: the legs take more as the bee decelerates at the bottom of each bob
    const acc = -Math.sin(T * 2.6);
    const servos = [0.44, 0.58, 0.49, 0.4, 0.53, 0.46].map((b, i) => (ex ? 0 : Math.max(0, Math.min(1, b * (1 + 0.32 * acc * (i % 3 === 1 ? 1.2 : 1)) + 0.03 * Math.sin(T * 7 + i)))));
    const reassembling = !D.exploded && s.explode > 0.04;
    const [status, statusKind] = D.exploded ? ['TEARDOWN', 'warn'] : reassembling ? ['REASSEMBLY', 'warn'] : s.blur < 0.5 ? ['HI-SPEED', 'warn'] : ['HOVER', 'ok'];
    const modeSub = D.exploded
      ? `EXPLODED VIEW · ${Math.round(s.explode * 100)}% · 128 PARTS`
      : reassembling
        ? 'PARTS SEATING · MOTOR ARMED'
        : s.blur < 0.5
          ? 'CAPTURE 2000 FPS · 0.2× PLAYBACK'
          : `STATION KEEPING · ${((s.hover.y - FLOOR_Y) * MM).toFixed(0)} MM AGL`;
    const last = SCRIPT.filter((e) => e.t > 0 && e.t <= t).pop();
    const say = (e) => (e.view ? `VIEW → ${button(e.view).toUpperCase()}` : `${e.display === 'blur' ? 'MOTION BLUR' : e.display === 'xray' ? 'X-RAY' : e.display.toUpperCase()} ${displayAt(e.t + 0.001)[e.display] ? 'ON' : 'OFF'}`);
    const sub = (i) => {
      if (ex && i !== 3) return ['warn', 'DETACHED'];
      if (i === 0) return ['ok', 'TRACKING'];
      if (i === 1) return ['ok', 'LOCKED'];
      if (i === 2) return s.xray > 0.5 ? ['warn', 'EXPOSED'] : s.amp > 1 ? ['ok', 'RUNNING'] : ['idle', 'STOPPED'];
      if (i === 3) return ex ? ['warn', 'DETACHED'] : s.blur < 0.5 ? ['warn', 'HI-SPEED'] : s.amp > 1 ? ['ok', `${FLAP_HZ} HZ`] : ['idle', 'PARKED'];
      if (i === 4) return ['ok', 'HOLDING'];
      return s.xray > 0.5 ? ['warn', 'EXPOSED'] : ['ok', 'SEALED'];
    };
    const focus = s.view === 'wing' ? 3 : s.view === 'legs' ? 4 : s.view === 'front' ? 0 : s.xray > 0.5 ? 2 : -1;
    return {
      time: t,
      dur: DURATION,
      lift: Math.max(0, (s.amp / AMP) * (0.68 + 0.02 * Math.sin(s.flap))),
      status,
      statusKind,
      freq: FLAP_HZ * beat,
      amp: s.amp,
      stroke,
      playback: s.rate,
      blur: s.blur,
      battery: 0.842 - 0.0024 * fly,
      power,
      volt: 3.92 - 0.006 * power,
      motorT: 34 + 7 * Math.min(1, fly / 20) + 0.08 * power,
      servos,
      legsFree: ex,
      airborne: !ex,
      alt: (s.hover.y - FLOOR_Y) * MM,
      vs: MM * 0.05 * 2.6 * Math.cos(T * 2.6) * s.hover.calm * s.rate,
      pitch: (s.hover.pitch * 180) / Math.PI,
      roll: (s.hover.roll * 180) / Math.PI,
      airspeed: Math.abs(MM * 0.05 * 2.6 * Math.cos(T * 2.6) * s.hover.calm * s.rate) / 1000 + 0.004 * s.hover.calm,
      view: s.view,
      display: D,
      subs: [0, 1, 2, 3, 4, 5].map(sub),
      focus,
      events: EVENTS,
      next: `${EVENTS.length} OPERATOR ACTIONS`,
      log: last ? `OPERATOR · ${say(last)}` : 'AUTO-HOVER · STATION KEEPING',
      mode: status,
      modeSub,
    };
  };

  return {SCRIPT, DURATION, EVENTS, displayAt, eased, motion, simT, camAt, viewAt, stateAt, telemetry};
}

// ------------------------------------------------------------ labels
const V3 = THREE.Vector3;
const GENERAL = [
  ['lens', 'OPTIC LENS', '18 MM · AMBER IR PUPIL'],
  ['antenna', 'ANTENNA', 'AIRFLOW + SCENT SENSOR'],
  ['collar', 'NECK BEARING', '10-SEGMENT COLLAR'],
  ['hinge', 'WING HINGE', '7.5 HZ CRANK · ±32°'],
  ['gears', 'DRIVE GEAR STACK', '3 SPUR GEARS'],
  ['core', 'CONTROL BOARDS', 'FLIGHT CPU · IMU'],
  ['pad', 'SHOULDER PAD', 'POLYMER SHELL'],
  ['knee2', 'LEG SERVO', 'KNEE · 0.4 N·M'],
  ['capsule', 'ABDOMEN CAPSULE', 'GEAR TRAIN · SPRING'],
  ['sting', 'POLLEN PROBE', 'RETRACTABLE TIP'],
];
const LEGSET = [
  ['hip1', 'HIP SERVO', 'YAW + LIFT'],
  ['knee1', 'KNEE SERVO L1', '0.4 N·M'],
  ['knee2', 'KNEE SERVO L2', '0.4 N·M'],
  ['knee3', 'KNEE SERVO L3', '0.4 N·M'],
  ['foot', 'FOOT WHEEL', 'GRIP PAD'],
  ['pad', 'SHOULDER PAD', 'POLYMER SHELL'],
  ['core', 'CONTROL BOARDS', 'SERVO DRIVERS'],
];
const WINGSET = [
  ['hinge', 'WING HINGE', '7.5 HZ CRANK · ±32°'],
  ['wing', 'WING MEMBRANE', 'FROSTED FILM · 0.1 MM'],
  ['hinge2', 'HINDWING HINGE', 'PHASE +40°'],
  ['antenna', 'ANTENNA', 'AIRFLOW + SCENT SENSOR'],
  ['gears', 'DRIVE GEAR STACK', '3 SPUR GEARS'],
];
/** Labels for a view, in two columns at the viewport's edges, stacked by height so no two touch. */
export function makeLabels(st, bee) {
  const p = new V3();
  return (view, o) => {
    if (o < 0.02) return [];
    const set = view === 'legs' ? LEGSET : view === 'wing' ? WINGSET : GENERAL;
    const pts = [];
    for (const [key, name, sub] of set) {
      const A = bee.anchors[key];
      if (!A) continue;
      A.obj.updateWorldMatrix(true, false);
      const at = st.project(A.obj.localToWorld(p.copy(A.at)));
      if (at && at[0] > VIEWPORT.x0 + 30 && at[0] < VIEWPORT.x1 - 30 && at[1] > VIEWPORT.y0 + 40 && at[1] < VIEWPORT.y1 - 70) pts.push({name, sub, at});
    }
    const mid = (VIEWPORT.x0 + VIEWPORT.x1) / 2;
    const Lc = pts.filter((x) => x.at[0] < mid).sort((a, b) => a.at[1] - b.at[1]);
    const Rc = pts.filter((x) => x.at[0] >= mid).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = VIEWPORT.y0 + 48;
      // start low enough that the column ends above the flight-mode word
      y = Math.max(y, Math.min(col.length ? col[0].at[1] - 10 : y, VIEWPORT.y1 - 110 - 34 * col.length));
      for (const c of col) {
        y = Math.max(y, Math.min(VIEWPORT.y1 - 110, c.at[1] - 10));
        out.push({name: c.name, sub: c.sub, at: c.at, label: [x, y], w, o});
        y += 34;
      }
    };
    stack(Lc, VIEWPORT.x0 + 16, 168);
    stack(Rc, VIEWPORT.x1 - 160, 150);
    return out;
  };
}

// ------------------------------------------------------------ the operator's pointer (after cessna-shared/film_v2.js)
// It reaches each button 0.1 s before the press, leaves 0.2 s after, travels in an eased bow, and between distant
// presses waits in the gutter left of the right-hand panels, never over the bee.
const GUTTER_X = 1262;
export function makeCursor(ui, SCRIPT) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => ({t: e.t, spot: ui.spots[e.view ?? e.display]}));
  const first = EV[0].spot;
  const WP = [[0, GUTTER_X, first[1] + 60]];
  let [px, py, pt] = [GUTTER_X, first[1] + 60, 0];
  EV.forEach((e, n) => {
    const [x, y] = e.spot;
    const travel = Math.min(0.75, 0.32 + Math.hypot(x - px, y - py) / 900);
    const arrive = e.t - 0.1;
    if (arrive - travel - pt > 1.6) {
      const rest = [GUTTER_X, Math.max(170, Math.min(720, y + 40))];
      WP.push([pt + 0.75, ...rest]);
      WP.push([arrive - travel, ...rest]);
    } else WP.push([Math.max(pt + 0.01, arrive - travel), px, py]);
    WP.push([arrive, x, y], [e.t + 0.2, x, y]);
    [px, py, pt] = [x, y, e.t + 0.2];
    const next = EV[n + 1];
    if (!next || next.t - 0.1 - 0.75 - pt > 0.9) {
      [px, py, pt] = [GUTTER_X, y + 12, pt + 0.6];
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
