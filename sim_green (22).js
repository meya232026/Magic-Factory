// VESPION VX-9, the approved wasp film re-shot on the green page (entry wasp-film). Everything that moves comes
// from this folder's tour_v2.js unchanged (the wasp, its flight, every assembly, every camera, the timing); what is new
// is only the look: green for orange on the wasp, white paper with mint haze, and the green page from ../green instead
// of the old console. The subject shifts by green/look.js SHIFT so it sits in the green page's 3D window.
import {runSim} from '../kit/runtime.js';
import {createConsole} from '../green/console.js';
import {makeCursor, makeLabels, ORANGE_TO, PAPER_GREEN, retint, SHIFT} from '../green/look.js';
import {buildBee} from './bee.js';
import {PAL} from './parts.js';
import {createStage, PAPER} from './stage.js';
import {FLOOR_Y} from './tour.js';
import {makeTour2, REACH} from './tour_v2.js';

const D2R = Math.PI / 180;

Object.assign(PAL, {orange: ORANGE_TO});
Object.assign(PAPER, PAPER_GREEN);

const PAGE = {
  name: 'Vespion',
  code: 'VX-9',
  title: 'Robotic Wasp, Taken Apart',
  date: '2026-11-6',
  nav: [['overview', 'Overview'], ['optics', 'Optics'], ['wing', 'Wings'], ['leg', 'Legs'], ['thorax', 'Thorax'], ['abdomen', 'Abdomen'], ['exploded', 'Teardown'], ['hero', 'Release']],
  pills: [['optics', 'Optics'], ['wing', 'Wings'], ['leg', 'Legs'], ['thorax', 'Thorax'], ['abdomen', 'Abdomen'], ['exploded', 'Teardown'], ['hero', 'Release']],
  sub: {
    overview: ['Wingspan 2 × 180 mm', '6 legs · 2 camera eyes'],
    optics: ['Iris: 10 blades', 'Glass Ø 40 mm'],
    wing: ['Frosted film, 0.1 mm', 'Hinge: quick release'],
    leg: ['2 servos per leg', 'Foot: twin hooks'],
    thorax: ['3 spur gears', 'Flight CPU + IMU'],
    abdomen: ['5 telescoping bands', 'Glass stinger'],
    exploded: ['Every part apart', 'Turntable 330°'],
    hero: ['Wings to 7.5 Hz', 'Banking out'],
  },
};
// tour_v2's capital labels in the page's voice
const TEXT = {
  'OUTER GLASS': ['Front glass', 'Ø 40 mm, AR coated'],
  'INNER ELEMENT': ['Inner element', 'Ø 15 mm'],
  IRIS: ['Iris', '10 blades, opens 3×'],
  'LENS BARREL': ['Lens barrel', 'threaded, 4 rings'],
  'WING MEMBRANE': ['Wing film', '0.1 mm, frosted'],
  'WING HINGE': ['Wing hinge', 'quick release'],
  'HINDWING HINGE': ['Hindwing hinge', 'phase +40°'],
  'HIP SERVO': ['Hip servo', 'yaw + lift'],
  'KNEE SERVO': ['Knee servo', '0.4 N·m'],
  'FOOT CLAW': ['Foot claw', 'twin hooks'],
  'SADDLE PLATE': ['Saddle plate', 'polymer shell'],
  'DRIVE GEAR STACK': ['Drive gears', '3 spur gears'],
  'ACTUATOR RING': ['Actuator ring', '11 pistons'],
  'CONTROL BOARDS': ['Flight boards', 'CPU + IMU'],
  'WAIST STALK': ['Waist stalk', '5 lit beads'],
  'SHELL BAND': ['Shell band', 'telescoping'],
  'BAND 4': ['Band 4', '5 riveted segments'],
  STINGER: ['Stinger', 'glass, extends 30 mm'],
  'OPTIC HEAD': ['Optic head', '2 lenses'],
  'NECK BEARING': ['Neck bearing', '10 segments'],
  'DRIVE GEARS': ['Drive gears', 'spinning free'],
  'ABDOMEN BANDS': ['Abdomen bands', '5 segments'],
};
const STATUS = {DIVING: 'Diving in', 'SLOW-MO': 'Slow motion', 'CLIMB-OUT': 'Climbing out', BANKING: 'Banking in', HOVER: 'Hovering', TEARDOWN: 'Teardown', REASSEMBLY: 'Reassembly', DEPARTING: 'Departing', 'OPTICS OPEN': 'Optics open', 'WING OFF': 'Wing off', 'LEG L2 OPEN': 'Leg open', 'THORAX OPEN': 'Thorax open', 'ABDOMEN OPEN': 'Abdomen open'};

export function makeWaspGreen(TL, {tour = makeTour2} = {}) {
  const T = tour(TL);
  return async ({canvas, capture}) => {
    const app = document.getElementById('app');
    const st = createStage({canvas, floorY: FLOOR_Y});
    const bee = buildBee();
    st.addBee(bee);
    retint(bee.root);
    bee.root.rotation.order = 'YXZ';
    const ui = createConsole(app, PAGE);
    const cursorAt = makeCursor(ui, T.SCRIPT);
    const labels = makeLabels(st, bee.anchors, TEXT);
    const fit = () => {
      const k = Math.min(innerWidth / 1600, innerHeight / 900);
      app.style.transform = `scale(${k})`;
    };
    const resize = () => {
      fit();
      st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    };
    resize();
    window.WASP = {st, bee, T};
    return {
      resize,
      render(t) {
        const s = T.stateAt(t);
        bee.pose({explode: s.explode, flap: s.flap, flapAmp: s.amp, display: s.display, t: s.spinT, spinT: s.spinT, blur: 1, reach: REACH, sub: s.sub, eye: s.eye, wingOut: s.wingOut, wingFlip: s.wingFlip, legK: s.legK, stingK: s.stingK});
        retint(bee.root);
        const f = s.flight;
        bee.root.position.copy(f.pos);
        bee.root.rotation.set(f.roll * D2R, f.yaw * D2R, f.pitch * D2R);
        const c = s.cam;
        st.frame({...c, az: c.az * D2R, el: c.el * D2R, sx: c.sx + SHIFT[0], sy: c.sy + SHIFT[1]}, {guides: s.guides});
        const tel = T.telemetry(t, s);
        const v = s.view;
        const opening = Math.max(s.open?.[v] ?? 0, v === 'wing' ? s.wingOut : 0);
        ui.update({
          time: t,
          dur: TL.duration,
          status: STATUS[tel.status] ?? tel.status,
          freq: tel.freq,
          stroke: tel.stroke.map((p) => p[0]),
          lift: tel.lift,
          battery: tel.battery,
          servos: tel.servos,
          apart: Math.round(Math.max(opening, s.explode) * 100),
          view: v === 'intro' ? 'overview' : v,
          callouts: labels(tel.labelSet),
          cursor: cursorAt(t),
        });
        return {};
      },
    };
  };
}

export const runWaspGreen = (TL, title = 'wasp-film', opts = {}) =>
  runSim({duration: TL.duration, fps: 60, theme: 'light', hud: {enabled: false, title, subtitle: ''}, director: {enabled: false}, watermark: ''}, makeWaspGreen(TL, opts));
