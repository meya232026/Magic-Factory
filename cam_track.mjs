// Prints a film's camera every 0.5 s of film time: the view, azimuth and elevation in degrees, distance. If az, el and
// d barely move from one beat to the next, the film looks parked. A short version that plays its scene faster is
// walked to its end, with times in film seconds like capture --still.
//
//   node sims/green/cam_track.mjs <entry> [global] [step]
//
// The camera is the tour's (T.stateAt), before a sim's own touches such as the piranha's mirror and push-in.
import {isNumber, openEntry, usage} from './open.mjs';

const [entry, ...rest] = process.argv.slice(2);
if (!entry) usage('node sims/green/cam_track.mjs <entry> [global] [step]');
const step = Number(rest.find(isNumber) ?? 0.5);
const glob = rest.find((a) => !isNumber(a));
if (!(step > 0)) usage('step must be a number of seconds above 0');

const {browser, page, glob: g} = await openEntry(entry, glob);
const rows = await page.evaluate(
  ([g, step]) => {
    const T = window[g].T;
    const film = window.SIM.duration;
    // scene seconds per film second: above 1 when a short version plays its scene faster
    const rate = (T.DURATION ?? film) / film;
    const out = [];
    for (let i = 0; i * step <= film + 1e-6; i++) {
      const tf = i * step;
      const s = T.stateAt(tf * rate);
      const c = s.cam;
      out.push(`${tf.toFixed(1).padStart(5)}  ${String(s.view).padEnd(9)} az ${c.az.toFixed(0).padStart(4)}  el ${c.el.toFixed(0).padStart(3)}  d ${c.d.toFixed(1)}`);
    }
    return out;
  },
  [g, step],
);
console.log(rows.join('\n'));
await browser.close();
