// THERAPHOS TH-8, the approved tarantula film re-shot on the green page (entry tarantula-film). Everything that
// moves comes from tour.js unchanged (the run-in, the gait, both jumps, every assembly, every camera, the timing); what
// is new is only the look: green for orange on the spider and its glows, white paper with mint haze, and the green page
// from ../green in place of the old console, the subject shifted by SHIFT into its 3D window.
import {runSim} from '../kit/runtime.js';
import {createConsole} from '../green/console.js';
import {makeCursor, makeLabels, nice, ORANGE_TO, PAPER_GREEN, retint, SHIFT} from '../green/look.js';
import {PAL} from './parts.js';
import {buildSpider, FLOOR_Y} from './spider.js';
import {createStage, PAPER} from './stage.js';
import {makeTour, REACH} from './tour.js';

const D2R = Math.PI / 180;

Object.assign(PAL, {orange: ORANGE_TO});
Object.assign(PAPER, PAPER_GREEN);

const ACTS = [['eyes', 'Optics'], ['leg', 'Front leg'], ['abdomen', 'Abdomen'], ['head', 'Head'], ['exploded', 'Teardown'], ['hero', 'Release'], ['jump', 'Jump']];
const PAGE = {
  name: 'Theraphos',
  code: 'TH-8',
  title: 'Robotic Tarantula, Taken Apart',
  date: '2026-11-6',
  nav: [['overview', 'Overview'], ...ACTS],
  pills: ACTS,
  sub: {
    overview: ['8 legs · 32 joints', '2 main + 6 side optics'],
    eyes: ['Main optic Ø 46 mm', 'Iris: 10 blades, f/1.4'],
    leg: ['Coxa servo, yaw ±45°', 'Tibia piston, 60 mm'],
    abdomen: ['Glass cage, 5 bands', '20 lit coils'],
    head: ['Brow plate lifts 40 mm', 'Fangs flare 40°'],
    exploded: ['Every part apart', 'Turntable 360°'],
    hero: ['Back on 8 feet', 'Crouch armed'],
    jump: ['Jump at the lens', 'Legs tucked'],
  },
  cards: [{k: 'Gait', kind: 'wave', unit: 'Hz'}, {k: 'Body load', kind: 'bar', unit: '%'}, {k: 'Leg servos', kind: 'bars', n: 8}, {k: 'Battery', kind: 'bar', unit: '%'}],
};
const TEXT = {'MAIN OPTIC R': ['Main optic'], 'SIDE OPTIC': ['Side optics'], 'GLOW COILS': ['Lit coils'], 'KNEE RING': ['Knee ring', 'lit ring, 2.4 N·m'], 'CLAW TIP': ['Claw tip', 'lit, 14 mm']};
const STATUS = {'RUN-IN': 'Running in', WALK: 'Walking', STANDING: 'Standing', CROUCH: 'Crouching', AIRBORNE: 'Airborne', LANDING: 'Landing', TEARDOWN: 'Teardown', REASSEMBLY: 'Reassembly', 'OPTICS OPEN': 'Optics open', 'LEG R1 APART': 'Front leg apart', 'LEG R1 LIFT': 'Front leg up', 'ABDOMEN OPEN': 'Abdomen open', 'HEAD OPEN': 'Head open'};

export function makeTarantulaGreen(TL) {
  const FILM = TL.film ?? TL.duration;
  const SPEED = TL.duration / FILM;
  const T = makeTour(TL);
  return async ({canvas, capture}) => {
    const app = document.getElementById('app');
    const st = createStage({canvas, floorY: FLOOR_Y, guides: {centre: [-0.3, 0.1, 0], scale: 1.3}});
    const sp = buildSpider();
    st.addBee(sp);
    retint(sp.root);
    sp.root.rotation.order = 'YXZ';
    const ui = createConsole(app, PAGE);
    const cursorAt = makeCursor(ui, T.SCRIPT);
    const labels = makeLabels(st, sp.anchors, TEXT);
    const fit = () => (app.style.transform = `scale(${Math.min(innerWidth / 1600, innerHeight / 900)})`);
    const resize = () => {
      fit();
      st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    };
    resize();
    window.SP = {st, sp, T};
    return {
      resize,
      render(tf) {
        // a demo plays the scene's timeline a little faster: TL.film seconds of film for TL.duration of scene
        const t = tf * SPEED;
        const s = T.stateAt(t);
        const b = s.body;
        sp.root.position.set(b.x, b.y, b.z);
        sp.root.rotation.set(b.roll, b.yaw + s.turn * D2R, b.pitch);
        sp.root.updateMatrixWorld(true);
        sp.pose({explode: s.explode, spinT: s.spinT, spinA: s.spinA, t, sub: s.sub, feet: s.feet, tuck: s.tuck, palp: s.palp, reach: REACH});
        retint(sp.root);
        const c = s.cam;
        st.frame({...c, az: c.az * D2R, el: c.el * D2R, sx: (c.sx ?? 0) + SHIFT[0], sy: (c.sy ?? 0) + SHIFT[1]}, {guides: s.guides});
        const tel = T.telemetry(t, s);
        const v = s.view;
        const amp = tel.walking ? 0.85 : 0.12;
        const wave = [];
        for (let i = 0; i <= 90; i++) wave.push(amp * Math.sin(2 * Math.PI * Math.max(0.6, tel.freq) * (t - 1.2 + (i / 90) * 1.2)));
        const lift = Math.min(1, tel.lift);
        const bat = 0.861 - 0.0022 * t;
        ui.update({
          time: tf,
          dur: FILM,
          status: STATUS[tel.status] ?? nice(tel.status),
          cards: [{v: tel.freq.toFixed(1), wave}, {v: Math.round(lift * 100), bar: lift}, {bars: tel.servos}, {v: Math.round(bat * 100), bar: bat}],
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

export const runTarantulaGreen = (TL, title = 'tarantula-film') =>
  runSim({duration: TL.film ?? TL.duration, fps: 60, theme: 'light', hud: {enabled: false, title, subtitle: ''}, director: {enabled: false}, watermark: ''}, makeTarantulaGreen(TL));
