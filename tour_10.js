// The Vespion VX-9 wasp's 10-second demo (entry wasp-demo), made 2026-11-06 for the article: the bee's 18-second
// film (robobee-shared/tour_18.js) carried onto the wasp (its tour_v2.js differences: the sting, the abdomen camera's
// target, the labels) and cut down to one assembly. What it runs:
// - the opening: the wasp dives in from high on the left, banking, and flares nose-up as it brakes;
// - one assembly, the WING: pulled out of its hinge and turned over in the air;
// - the explode in slow motion (0.4x while the parts leave), the camera passing low under them, a full 360 deg
//   turntable and a push-in for the reassembly;
// - the exit: the wasp turns a little toward the lens, noses up and climbs straight out of the top of the frame.
// The speed ramp is a warp of film time t into scene time tau (tauAt), so everything stays a pure function of t.
import * as THREE from 'three';
import {FLOOR_Y} from './tour.js';
import {AMP, ASSEMBLY_LABEL, FLAP_HZ} from './tour_v2.js';

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const bump = (a, b, c, d, t) => ss(a, b, t) * (1 - ss(c, d, t));
const MM = 80;
const S = 1.15;

// each act's own clock in scene seconds after its click, a beat every 2.2 s
export const ACT_R = {
  optics: {open: [0.25, 1.05], close: [1.55, 1.9], stop: false},
  wing: {open: [0.2, 0.75], close: [1.6, 1.95], stop: true},
  thorax: {open: [0.25, 1.0], close: [1.5, 1.9], stop: true},
  abdomen: {open: [0.25, 1.0], close: [1.55, 1.95], stop: true},
};
// the pulled wing turns over once while it hangs out of its hinge
export const WING_FLIP = [0.45, 1.45];
// the ramp in film seconds after the EXPLODED click: down to 0.4x as the parts start to leave, held while they drift
// apart, back up as the turntable takes over
export const RAMP = {a: [0.35, 0.55], b: [1.9, 2.1], low: 0.4};
// the climb starts this long after HERO (scene seconds)
export const DEP = 0.75;
// the hero camera, low on the front-right so the climb reads against the paper above
const HERO_AZ = 32;
const HERO_EL = 4;
const HERO_D = 7.8;

export function makeWarp(tRamp, dur) {
  const rate = (t) => 1 - (1 - RAMP.low) * bump(tRamp + RAMP.a[0], tRamp + RAMP.a[1], tRamp + RAMP.b[0], tRamp + RAMP.b[1], t);
  const DT = 1 / 480;
  const TAU = [0];
  for (let i = 1; i * DT <= dur + 2; i++) TAU.push(TAU[i - 1] + rate((i - 0.5) * DT) * DT);
  const tauAt = (t) => {
    if (t <= 0) return t;
    const u = Math.min(TAU.length - 2, t / DT);
    const i = Math.floor(u);
    return TAU[i] + (TAU[i + 1] - TAU[i]) * (u - i);
  };
  return {rate, tauAt};
}

export function make10Tour(TL) {
  const SCRIPT = [...TL.script].sort((a, b) => a.t - b.t);
  const DURATION = TL.duration;
  const EVENTS = SCRIPT.map((e) => e.t);
  const tfOf = (act) => (SCRIPT.find((e) => e.act === act) ?? {t: 999}).t;
  const tfExp = tfOf('exploded');
  const tfAsm = tfOf('assemble');
  const {rate, tauAt} = makeWarp(tfExp, DURATION);
  const AT = {};
  for (const e of SCRIPT) (AT[e.act] ??= []).push(tauAt(e.t));
  const at = (act) => AT[act] ?? [];
  const T_EXP = at('exploded')[0] ?? 999;
  const T_ASM = at('assemble')[0] ?? 999;
  const T_END = at('hero')[0] ?? 999;
  const T_FIRST = Math.min(...Object.keys(ACT_R).flatMap((a) => at(a)), 999);

  const openOf = (act, x) => {
    let v = 0;
    for (const t0 of at(act)) {
      const A2 = ACT_R[act];
      v = Math.max(v, bump(t0 + A2.open[0], t0 + A2.open[1], t0 + A2.close[0], t0 + A2.close[1], x));
    }
    return v;
  };
  const explodeAt = (x) => ss(T_EXP + 0.2, T_EXP + 1.5, x) * (1 - ss(T_ASM, T_ASM + 0.8, x));
  // the turntable: a full +360 deg from the explode to just after the bee is whole again
  const TT = [T_EXP + 0.2, T_ASM + 1.2];
  const turnAt = (x) => {
    const [a, b] = TT;
    if (x <= a) return 0;
    const R = 0.5;
    const span = b - a;
    const v = 360 / (span - R);
    const y0 = Math.min(x, b) - a;
    if (y0 < R) return (v * y0 * y0) / (2 * R);
    if (y0 < span - R) return v * (y0 - R / 2);
    const y = y0 - (span - R);
    return v * (span - 1.5 * R) + v * y - (v * y * y) / (2 * R);
  };
  // the wings park for the acts that need still wings and for the explode; when the next act parks them too they stay
  // parked across the cut instead of spinning up for a moment between
  const STOPS = [];
  SCRIPT.forEach((e, n) => {
    const A2 = ACT_R[e.act];
    if (!A2?.stop) return;
    const t0 = tauAt(e.t);
    const nx = SCRIPT[n + 1];
    const hold = nx && (ACT_R[nx.act]?.stop || nx.act === 'exploded') ? tauAt(nx.t) - t0 + 0.4 : A2.close[1];
    STOPS.push([t0, t0 + 0.35, t0 + hold, t0 + hold + 0.45]);
  });
  STOPS.push([T_EXP, T_EXP + 0.4, T_ASM + 0.7, T_ASM + 1.2]);
  const stopAt = (x) => Math.max(0, ...STOPS.map((w) => bump(w[0], w[1], w[2], w[3], x)));
  const activity = (x) => Math.max(...Object.keys(ACT_R).map((a) => openOf(a, x)), explodeAt(x));
  const DT = 1 / 240;
  const SPIN = [0];
  for (let i = 1; i * DT <= DURATION + 1; i++) SPIN.push(SPIN[i - 1] + (1 + 5 * activity((i - 0.5) * DT)) * DT);
  const look = (A2, x) => {
    const u = Math.max(0, Math.min(A2.length - 2, x / DT));
    const i = Math.floor(u);
    return A2[i] + (A2[i + 1] - A2[i]) * (u - i);
  };
  const spinAt = (x) => (x < 0 ? x : look(SPIN, x));

  // the bee: dives in from high on the left banking, flares nose-up and hovers through the teardowns, turns on the
  // explode turntable, turns a little toward the lens on HERO and climbs out of the top of the frame
  const flightAt = (x) => {
    const kIn = ss(-0.9, 1.6, x);
    const ex = explodeAt(x);
    const calm = 1 - Math.min(1, ex * 2.5);
    const path = new THREE.Vector3(lerp(-0.8 * S, 0, kIn), lerp(1.0 * S, 0, kIn), lerp(0.45 * S, 0, kIn));
    let yaw = lerp(-24, 0, kIn);
    let roll = 28 * Math.sin(Math.PI * Math.min(1, kIn * 1.05)) - 7 * Math.sin(2 * Math.PI * kIn) * kIn + 1.7 * Math.sin(x * 1.3 + 1.1) * calm;
    let pitch = -16 * (1 - kIn) + 10 * Math.sin(Math.PI * ss(0.55, 1.0, kIn)) + 1.4 * Math.sin(x * 1.9 + 0.6) * calm;
    yaw += turnAt(x);
    // HERO: the wasp turns a little toward the lens and lifts its nose, then climbs straight up out of the frame,
    // pitching up into the climb with one roll
    const kH = ss(T_END, T_END + 0.8, x);
    yaw -= 22 * kH;
    pitch += 8 * kH;
    roll += 10 * Math.sin(Math.PI * kH);
    if (x > T_END + DEP) {
      const u = x - T_END - DEP;
      const k = ss(0, 0.6, u);
      pitch += 24 * k;
      roll -= 12 * Math.sin(Math.PI * ss(0, 1.3, u));
      path.y += 0.7 * u + 1.8 * u * u;
      path.x += 0.3 * u * u;
    }
    const pos = path.clone().add(new THREE.Vector3(0, 0.05 * Math.sin(x * 2.6) * calm, 0));
    return {pos, path, yaw, roll, pitch, calm};
  };

  // ------------------------------------------------------------ cameras: [az, el, d, tx, ty, tz, sx, sy]
  // az from the right flank (0) toward the face (90); the hero side is about 20-40. The teardown targets and drift
  // rates are the second cut's.
  const macro = (act, u, depth = 0.12) => {
    const A2 = ACT_R[act];
    return 1 - depth * bump(A2.open[1] - 0.35, A2.open[1] + 0.1, A2.close[0] - 0.1, A2.close[1], u);
  };
  const push = (a, b, u, end = 1.9) => lerp(a, b, ss(0, end, u));
  const EXP_SPAN_F = tfAsm - tfExp;
  const CAM = {
    // the dive: the camera comes down from above with the bee, pushing in
    intro: (u) => {
      const k = ss(0, 2.0, u);
      return [lerp(46, 34, k), lerp(22, 10, k), lerp(7.9, 7.4, k), 0.0, -0.2, 0.25, -20, -14];
    },
    // the lens from the face side, so the barrel unscrews sideways across the frame
    optics: (u) => [90 - 9 * u, 6, push(4.9, 4.3, u) * macro('optics', u, 0.07), 1.22, 0.12, 0.45, 0, -14],
    // the wing from the hero side, rising with it as it leaves the hinge and turns over
    wing: (u) => {
      const k = ss(0, 1.9, u);
      return [38 + 9 * k, lerp(12, 22, k), push(8.8, 7.8, u), -0.5, 0.95, 1.25, 0, -14];
    },
    // the thorax from high over the near flank
    thorax: (u) => [6 + 10 * u, 34, push(6.9, 6.0, u) * macro('thorax', u), 0.0, 0.32, 0.05, 0, -14],
    // the abdomen from behind the near flank as it telescopes out
    abdomen: (u) => [-32 + 10 * u, 14, push(6.8, 5.9, u) * macro('abdomen', u, 0.08), -2.45, -0.95, 0.1, 0, -14],
    // the explode, on FILM time (u = film seconds since the click): while the ramp holds the parts at 0.4x the camera
    // keeps its own speed and swings round low under them looking up, then rises over the turntable and pushes in for
    // the reassembly
    exploded: (u) => {
      const arc = ss(0.45, 2.0, u);
      const rise = ss(1.9, 2.9, u);
      const near = ss(EXP_SPAN_F - 0.3, EXP_SPAN_F + 0.9, u);
      return [24 + 32 * arc - 14 * rise, lerp(10, -2, arc) + 20 * rise, lerp(11.4, 12.0, arc) - 3.6 * near, 0.0, lerp(-0.15, 0.05, arc) * (1 - rise) - 0.15 * rise, 0.0, -10, -14];
    },
    // HERO: low on the front-right, holding still while the wasp turns and climbs out
    hero: (u) => {
      const k = ss(0, 0.9, u);
      return [lerp(42, HERO_AZ, k), lerp(18, HERO_EL, k), lerp(8.4, HERO_D, k), 0.0, -0.15, 0.25, -14, -14];
    },
  };

  const VIEWS = [{t: -1, tf: -1, key: 'intro'}, ...SCRIPT.map((e) => ({t: tauAt(e.t), tf: e.t, key: e.act === 'assemble' ? 'exploded' : e.act}))];
  const viewIdx = (x) => {
    let i = 0;
    while (i < VIEWS.length - 1 && VIEWS[i + 1].t <= x) i++;
    return i;
  };
  // ASSEMBLE runs on the EXPLODED view's clock, so both read as one continuous shot (and HERO blends out of it)
  const resolve = (i) => (VIEWS[i].key === 'exploded' && i > 0 && VIEWS[i - 1].key === 'exploded' ? VIEWS[i - 1] : VIEWS[i]);
  const camFn = (V, x, t) => CAM[V.key](V.key === 'intro' ? x : V.key === 'exploded' ? t - V.tf : x - V.t);
  const camAt = (x, t) => {
    const i = viewIdx(x);
    let o = camFn(resolve(i), x, t);
    if (i > 0 && resolve(i) === VIEWS[i]) {
      const k = ss(VIEWS[i].t, VIEWS[i].t + 0.7, x);
      if (k < 1) {
        const a = camFn(resolve(i - 1), x, t);
        const dAz = ((o[0] - a[0] + 540) % 360) - 180;
        const b = o.map((v, j) => lerp(a[j], v, k));
        b[0] = a[0] + dAz * k;
        b[2] += 0.5 * Math.sin(Math.PI * k);
        o = b;
      }
    }
    const f = flightAt(x);
    // the camera follows the wasp's path, and on the climb lets go sideways and follows the rise a third of the way
    const kOut = ss(T_END + DEP - 0.2, T_END + DEP + 0.5, x);
    const kIn = 1 - ss(0.2, 1.9, x);
    const tr = (0.85 - 0.3 * kIn) * (1 - kOut);
    const trY = (0.85 - 0.35 * kIn) * (1 - 0.65 * kOut);
    return {az: o[0], el: o[1], d: o[2], tx: o[3] + f.path.x * tr, ty: o[4] + f.path.y * trY, tz: o[5] + f.path.z * tr, sx: o[6], sy: o[7]};
  };
  const actAt = (x) => VIEWS[viewIdx(x)].key;

  const stateAt = (t) => {
    const x = tauAt(t);
    const ex = explodeAt(x);
    const amp = AMP * (1 - stopAt(x));
    const f = flightAt(x);
    const open = Object.fromEntries(Object.keys(ACT_R).map((a) => [a, openOf(a, x)]));
    let wingFlip = 0;
    for (const t0 of at('wing')) wingFlip = Math.max(wingFlip, ss(t0 + WING_FLIP[0], t0 + WING_FLIP[1], x));
    if (wingFlip >= 1) wingFlip = 0;
    // the sting: out of its collar once the abdomen hangs open, back in before it closes
    let stingK = 0;
    for (const t0 of at('abdomen')) stingK = Math.max(stingK, ss(t0 + 0.75, t0 + 1.15, x) * (1 - ss(t0 + 1.4, t0 + 1.6, x)));
    return {
      t,
      tau: x,
      rate: rate(t),
      spinT: spinAt(x),
      explode: ex,
      amp,
      flap: Math.PI * 2 * FLAP_HZ * x,
      display: 1 - amp / AMP,
      blur: 1,
      sub: {thorax: open.thorax, abdomen: open.abdomen},
      eye: open.optics,
      wingOut: open.wing,
      wingFlip,
      stingK,
      legK: 0,
      open,
      flight: f,
      cam: camAt(x, t),
      view: actAt(x),
      guides: 0.45 + 0.55 * Math.min(1, ex * 2.5 + activity(x)),
      turn: turnAt(x),
    };
  };

  // labels: on while the act's parts are moving apart and while they hang open, gone before they close
  const LABELS = {
    optics: [['eyeGlass', 'OUTER GLASS', 'Ø 40 MM · AR COATED'], ['eyeInner', 'INNER ELEMENT', 'Ø 15 MM'], ['iris', 'IRIS', '10 BLADES · OPENS 3×'], ['barrel', 'LENS BARREL', 'THREADED · 4 RINGS']],
    wing: [['wing', 'WING MEMBRANE', 'FROSTED FILM · 0.1 MM'], ['hinge', 'WING HINGE', 'QUICK RELEASE'], ['hinge2', 'HINDWING HINGE', 'PHASE +40°']],
    thorax: [['plate', 'SADDLE PLATE', 'POLYMER SHELL'], ['gears', 'DRIVE GEAR STACK', '3 SPUR GEARS'], ['act', 'ACTUATOR RING', '11 PISTONS'], ['core', 'CONTROL BOARDS', 'FLIGHT CPU · IMU']],
    abdomen: [['waist', 'WAIST STALK', '5 BEADS · LIT RINGS'], ['s1', 'SHELL BAND', 'TELESCOPING'], ['capsule', 'BAND 4', 'RIVETED · 5 SEGMENTS'], ['sting', 'STINGER', 'GLASS · EXTENDS 30 MM']],
    exploded: [['lens', 'OPTIC HEAD', '2 × LENS'], ['collar', 'NECK BEARING', '10 SEGMENTS'], ['gears', 'DRIVE GEARS', 'SPINNING FREE'], ['capsule', 'ABDOMEN BANDS', '5 SEGMENTS'], ['hinge', 'WING HINGE', 'QUICK RELEASE']],
  };
  const labelAt = (x, s) => {
    const v = s.view;
    if (ACT_R[v]) {
      const t0 = at(v).filter((y) => y <= x).pop();
      const A2 = ACT_R[v];
      return {set: LABELS[v], o: bump(t0 + A2.open[0] + 0.1, t0 + A2.open[0] + 0.4, t0 + A2.close[0] - 0.25, t0 + A2.close[0], x)};
    }
    if (v === 'exploded') return {set: LABELS.exploded, o: bump(T_EXP + 0.4, T_EXP + 0.8, T_EXP + 1.6, T_EXP + 1.9, x)};
    return {set: [], o: 0};
  };

  const telemetry = (t, s) => {
    const x = s.tau;
    const f = s.flight;
    const stroke = [];
    for (let i = 0; i <= 90; i++) {
      const tt = x - 1.2 + (i / 90) * 1.2;
      const a = AMP * (1 - stopAt(tt));
      const ph = Math.PI * 2 * FLAP_HZ * tt;
      stroke.push([a * Math.sin(ph), a * Math.sin(ph + 0.7)]);
    }
    const ex = s.explode > 0.04;
    const acc = -Math.sin(x * 2.6);
    const free = [0, 1, 2, 3, 4, 5].map(() => ex);
    const servos = [0.44, 0.58, 0.49, 0.4, 0.53, 0.46].map((b, i) => (free[i] ? 0 : Math.max(0, Math.min(1, b * (1 + 0.32 * acc) + 0.12 * Math.abs(f.roll) / 30 + 0.03 * Math.sin(x * 7 + i)))));
    const v = s.view;
    const opening = ACT_R[v] ? s.open[v] : 0;
    const NAME = {optics: 'OPTICS OPEN', wing: 'WING OFF', thorax: 'THORAX OPEN', abdomen: 'ABDOMEN OPEN'};
    const dartU = x - T_END - DEP;
    const darting = dartU > 0;
    let status = 'HOVER';
    let kind = 'ok';
    if (x < T_FIRST) status = 'DIVING';
    if (ACT_R[v] && opening > 0.05) [status, kind] = [NAME[v], 'warn'];
    if (v === 'exploded') [status, kind] = s.rate < 0.9 ? ['SLOW-MO', 'warn'] : x < T_ASM ? ['TEARDOWN', 'warn'] : s.explode > 0.04 ? ['REASSEMBLY', 'warn'] : ['HOVER', 'ok'];
    if (darting) status = 'CLIMB-OUT';
    const ROW = {optics: 0, thorax: 2, wing: 3, leg: 4, abdomen: 5};
    const sub = (i) => {
      if (ex) return ['warn', 'DETACHED'];
      if (ROW[v] === i && opening > 0.05) return ['warn', i === 3 ? 'DETACHED' : 'OPEN'];
      if (i === 3) return s.amp > 1 ? ['ok', `${FLAP_HZ} HZ`] : ['idle', 'PARKED'];
      if (i === 2) return s.amp > 1 ? ['ok', 'RUNNING'] : ['idle', 'STOPPED'];
      return ['ok', ['TRACKING', 'LOCKED', '', '', 'HOLDING', 'SEALED'][i]];
    };
    const last = SCRIPT.filter((e) => e.t <= t).pop();
    const say = (e) => (e.act === 'exploded' ? 'EXPLODED ON' : e.act === 'assemble' ? 'EXPLODED OFF · REASSEMBLE' : e.act === 'hero' ? 'HERO · CLIMB-OUT' : `ISOLATE ${ASSEMBLY_LABEL[e.act]}`);
    const sp = darting ? 0.4 + 1.2 * (1.2 + 3 * dartU) : f.pos.length() > 0.05 ? 0.4 + 0.2 * Math.abs(Math.sin(x)) : 0.004;
    const labels = labelAt(x, s);
    return {
      time: t,
      dur: DURATION,
      lift: Math.max(0, (s.amp / AMP) * (0.68 + 0.02 * Math.sin(s.flap)) + 0.12 * Math.abs(f.roll) / 30),
      status,
      statusKind: kind,
      freq: FLAP_HZ * ss(0.5, 6, s.amp),
      amp: s.amp,
      stroke,
      playback: s.rate,
      blur: 1,
      battery: 0.842 - 0.0022 * t,
      power: 4.2 + 31 * Math.pow(s.amp / AMP, 1.5) * (1 + 0.04 * Math.sin(s.flap)) + 3 * Math.abs(f.roll) / 30 + (darting ? 9 * ss(0, 0.5, dartU) : 0),
      volt: 3.92 - 0.006 * 36,
      motorT: 34 + 0.35 * t,
      servos,
      legsFree: ex,
      legFreeEach: free,
      airborne: true,
      alt: (f.pos.y - FLOOR_Y) * MM,
      vs: x < T_FIRST ? -MM * S * (ss(-0.9, 1.6, x + 0.05) - ss(-0.9, 1.6, x - 0.05)) * 10 : MM * 0.05 * 2.6 * Math.cos(x * 2.6) * f.calm,
      pitch: f.pitch,
      roll: f.roll,
      airspeed: sp,
      view: v === 'intro' ? 'hero' : v === 'exploded' ? null : v,
      display: {labels: labels.o > 0.5, exploded: x >= T_EXP && x < T_ASM, blur: s.amp > 3, turntable: s.turn > 0.5 && x < TT[1]},
      subs: [0, 1, 2, 3, 4, 5].map(sub),
      focus: ROW[v] ?? (v === 'exploded' ? 1 : -1),
      events: EVENTS,
      next: `${EVENTS.length} OPERATOR ACTIONS`,
      log: last ? `OPERATOR · ${say(last)}` : 'INBOUND · DIVING · BANK LEFT',
      mode: status,
      modeSub:
        status === 'DIVING'
          ? `BANK ${f.roll.toFixed(0)}° · DIVING IN`
          : status === 'SLOW-MO'
            ? `PLAYBACK ${s.rate.toFixed(2)}× · ${Math.round(s.explode * 100)}% APART`
            : status === 'TEARDOWN' || status === 'REASSEMBLY'
              ? `TURNTABLE ${Math.round(s.turn)}° CW · ${Math.round(s.explode * 100)}% APART`
              : status === 'CLIMB-OUT'
                ? `CLIMBING · ${sp.toFixed(1)} M/S`
                : ACT_R[v]
                  ? `${ASSEMBLY_LABEL[v]} · ${Math.round(opening * 100)}% APART`
                  : `STATION KEEPING · ${((f.pos.y - FLOOR_Y) * MM).toFixed(0)} MM AGL`,
      viewNote: `ISOLATE · ${v === 'intro' || v === 'hero' ? 'HERO' : v === 'exploded' ? 'ALL' : ASSEMBLY_LABEL[v]}`,
      labelSet: labels,
    };
  };

  return {SCRIPT, DURATION, stateAt, telemetry, camAt, flightAt, tauAt};
}
