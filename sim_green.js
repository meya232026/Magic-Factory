// SERRASAL PX-7, the robotic piranha's film on the green page (entry piranha-film), made 2026-11-06: the approved
// angler film's tour (tour_bee.js, the cut's beats as the hammerhead ran them) with the piranha's body (piranha.js,
// round 3 of its still). The beats: the eye, the tail stalk telescoping out, the glass flank opening over its gears, the
// jaw dropping with its glass fangs, the explode on a turntable and the lunge at the lens. The scene is mirrored across
// x (the fish and every camera, not the lights or the page) as its still was shot, head on the left, near side to the
// key. Green look and page from ../green; TL.film plays the scene's timeline faster for a demo.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {createConsole} from '../green/console.js';
import {makeCursor, makeLabels, nice, ORANGE_TO, PAPER_GREEN, retint, SHIFT} from '../green/look.js';
import {PAL} from './parts.js';
import {buildPiranha, FLOOR_Y} from './piranha.js';
import {createStage, PAPER} from './stage.js';
import {makeBeeTour} from './tour_bee.js';

const D2R = Math.PI / 180;

Object.assign(PAL, {orange: ORANGE_TO});
Object.assign(PAPER, PAPER_GREEN);

const ACTS = [['optics', 'Eye'], ['wing', 'Fin'], ['leg', 'Tail'], ['thorax', 'Glass flank'], ['abdomen', 'Jaw'], ['exploded', 'Teardown'], ['hero', 'Release']];
const PAGE = {
  name: 'Serrasal',
  code: 'PX-7',
  title: 'Robotic Piranha, Taken Apart',
  date: '2026-11-6',
  sub: {
    overview: ['2 rows of glass fangs', 'Glass flank, 2 drive gears'],
    optics: ['Lens under the brow', 'Iris: 10 blades'],
    wing: ['Pectoral fin, frosted', 'Root: pivot drum'],
    leg: ['Tail stalk, 4 segments', 'Telescopes on servos'],
    thorax: ['Glass barrel, 2 big gears', '2 lit coils'],
    abdomen: ['Jaw drops off the hinge', 'Glass fangs fly out'],
    exploded: ['Every part apart', 'Turntable 330°'],
    hero: ['Tail to full stroke', 'Lunge at the lens'],
  },
  cards: [{k: 'Tail beat', kind: 'wave', unit: 'Hz'}, {k: 'Thrust', kind: 'bar', unit: '%'}, {k: 'Servo load', kind: 'bars', n: 6}, {k: 'Battery', kind: 'bar', unit: '%'}],
};
const STATUS = {BANKING: 'Banking in', CRUISE: 'Cruising', 'OPTICS OPEN': 'Eye open', 'FIN OFF': 'Fin off', 'TAIL OUT': 'Tail out', 'FLANK OPEN': 'Flank open', 'JAW DROPPED': 'Jaw dropped', TEARDOWN: 'Teardown', REASSEMBLY: 'Reassembly', 'WIND-UP': 'Winding up', LUNGE: 'Lunging'};

export function makePiranhaGreen(TL) {
  const FILM = TL.film ?? TL.duration;
  // the angler's camera distances, scaled by TL.push; the eye shot pushes in by TL.opt
  const PUSH = TL.push ?? 1;
  const OPT = TL.opt ?? 0.9;
  const SPEED = TL.duration / FILM;
  // only the acts this cut runs get a pill and a line in the list (a demo names its set in TL.pills)
  const used = new Set(TL.pills ?? TL.script.map((e) => (e.act === 'assemble' ? 'exploded' : e.act)));
  const acts = ACTS.filter(([k]) => used.has(k));
  return async ({canvas, capture}) => {
    const app = document.getElementById('app');
    const st = createStage({canvas, floorY: FLOOR_Y, span: 3.8});
    const fish = buildPiranha();
    fish.pose({t: 0, idle: 0});
    fish.root.updateMatrixWorld(true);
    const at = (k) => fish.anchorAt(k).toArray();
    const mid = (...ps) => ps.reduce((a, p) => a.map((v, i) => v + p[i] / ps.length), [0, 0, 0]);
    const A = {
      lens: at('lens'),
      eyeAxis: new THREE.Vector3(1, 0, 0).transformDirection(fish.anchors.lens.obj.matrixWorld).toArray(),
      finHub: at('finHub'),
      lureMid: mid(at('stalk'), at('joint'), at('bulb')),
      core: at('core'),
      jaw: at('jaw'),
    };
    const T = makeBeeTour(TL, A);
    st.addBody(fish);
    retint(fish.root);
    fish.root.rotation.order = 'YXZ';
    fish.root.scale.x = -1;
    const m = -1;
    const ui = createConsole(app, {...PAGE, nav: [['overview', 'Overview'], ...acts], pills: acts});
    const cursorAt = makeCursor(ui, T.SCRIPT);
    const labels = makeLabels(st, fish.anchors);
    const fit = () => (app.style.transform = `scale(${Math.min(innerWidth / 1600, innerHeight / 900)})`);
    const resize = () => {
      fit();
      st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    };
    resize();
    window.PIRANHA = {st, fish, T, A};
    const sm = (x) => {
      const u = Math.min(1, Math.max(0, x));
      return u * u * u * (u * (u * 6 - 15) + 10);
    };
    const SCR = [...TL.script].sort((a, b) => a.t - b.t);
    const optWin = (t) => {
      let w = 0;
      SCR.forEach((e, i) => {
        if (e.act !== 'optics') return;
        const t1 = SCR[i + 1]?.t ?? TL.duration;
        w = Math.max(w, sm((t - e.t) / 0.85) * (1 - sm((t - t1) / 0.85)));
      });
      return w;
    };
    return {
      resize,
      render(tf) {
        // a demo plays the scene's timeline a little faster: TL.film seconds of film for TL.duration of scene
        const t = tf * SPEED;
        const s = T.stateAt(t);
        fish.pose({t, idle: 1, gape: s.gape, swim: s.swim, eye: s.eye, fin: s.fin, finFlip: s.finFlip, lure: s.lure, cage: s.cage, flare: s.flare, rib: s.rib, drop: s.drop, explode: s.explode, spinT: s.spinT, bend: s.bend});
        retint(fish.root);
        const f = s.flight;
        fish.root.position.set(m * f.pos.x, f.pos.y, f.pos.z);
        fish.root.rotation.set(f.roll * D2R, m * f.yaw * D2R, m * f.pitch * D2R);
        const c = s.cam;
        st.frame({...c, az: m * c.az * D2R, el: c.el * D2R, d: c.d * PUSH * (1 - (1 - OPT) * optWin(t)), tx: m * c.tx, sx: m * (c.sx ?? 0) + SHIFT[0], sy: (c.sy ?? 0) + SHIFT[1]}, {guides: s.guides});
        const tel = T.telemetry(t, s);
        const v = s.view;
        const lift = Math.min(1, tel.lift);
        ui.update({
          time: tf,
          dur: FILM,
          status: STATUS[tel.status] ?? nice(tel.status),
          cards: [{v: tel.freq.toFixed(1), wave: tel.stroke.map((p) => p[0] / 40)}, {v: Math.round(lift * 100), bar: lift}, {bars: tel.servos}, {v: Math.round(tel.battery * 100), bar: tel.battery}],
          apart: Math.round(Math.max(s.open?.[v] ?? 0, s.explode) * 100),
          view: v === 'intro' ? 'overview' : v,
          callouts: labels(tel.labelSet),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  };
}

export const runPiranhaGreen = (TL, title = 'piranha-film') =>
  runSim({duration: TL.film ?? TL.duration, fps: 60, theme: 'light', hud: {enabled: false, title, subtitle: ''}, director: {enabled: false}, watermark: ''}, makePiranhaGreen(TL));
