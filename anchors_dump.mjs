// Prints the parts' anchor points, where the close-up cameras aim, as one line of JSON {name: [x, y, z]}.
//
//   node sims/green/anchors_dump.mjs <entry> [global]        the entry's anchor table A if it keeps one (the piranha:
//                                                            the parts at rest), else every named anchor at t = 0
//   node sims/green/anchors_dump.mjs <entry> [global] <t>    every named anchor in world space at film time t, where
//                                                            a part really is when its beat opens it
import {isNumber, openEntry, usage} from './open.mjs';

const [entry, ...rest] = process.argv.slice(2);
if (!entry) usage('node sims/green/anchors_dump.mjs <entry> [global] [t]');
const t = rest.find(isNumber);
const glob = rest.find((a) => !isNumber(a));

const {browser, page, glob: g} = await openEntry(entry, glob);
const res = await page.evaluate(
  ([g, t]) => {
    const G = window[g];
    const r2 = (v) => +v.toFixed(2);
    if (G.A && t === null) return {from: `${g}.A`, points: Object.fromEntries(Object.entries(G.A).map(([k, v]) => [k, v.map(r2)]))};
    const tf = t ?? 0;
    window.SIM.render(tf);
    // the body is the value next to st and T that carries the named anchors (sp, fish, bee)
    const body = Object.entries(G).find(([k, v]) => k !== 'st' && k !== 'T' && v && typeof v === 'object' && v.anchors && v.root)?.[1];
    if (!body) return null;
    const points = {};
    for (const [k, a] of Object.entries(body.anchors)) {
      let w;
      if (typeof a === 'function') w = a();
      else if (a?.obj && a.at) {
        a.obj.updateWorldMatrix(true, false);
        w = a.obj.localToWorld(a.at.clone());
      } else continue;
      points[k] = [w.x, w.y, w.z].map(r2);
    }
    return {from: `the named anchors at t=${tf}`, points};
  },
  [g, t === undefined ? null : Number(t)],
);
await browser.close();
if (!res) {
  console.error(`window.${g} has no anchor table A and no body with anchors`);
  process.exit(1);
}
console.error(`${Object.keys(res.points).length} points: ${res.from}`);
console.log(JSON.stringify(res.points));
