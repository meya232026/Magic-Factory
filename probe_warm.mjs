// Lists the warm colours left on a green film's creature at film time t: materials, lights, vertex and instance
// colours. An empty {} means the green look took everywhere.
//
//   node sims/green/probe_warm.mjs <entry> <t> [global]
import {isNumber, openEntry, usage} from './open.mjs';

const [entry, t, glob] = process.argv.slice(2);
if (!entry || !isNumber(t)) usage('node sims/green/probe_warm.mjs <entry> <t> [global]');

const {browser, page, glob: g} = await openEntry(entry, glob);
const res = await page.evaluate(
  ([t, glob]) => {
    window.SIM.render(Number(t));
    const out = {};
    const warm = (c) => {
      if (!c?.isColor) return false;
      const k = Math.max(1e-6, c.r, c.g, c.b);
      const r = c.r / k, g = c.g / k, b = c.b / k;
      return r > 0.9 && b < 0.6 && g < 0.85 && r - b > 0.3;
    };
    const hex = (c) => [c.r, c.g, c.b].map((v) => v.toFixed(2)).join(',');
    const G = window[glob];
    const scene = G.st?.scene ?? null;
    // the creature: the value next to st and T with a three.js root (sp, fish, bee)
    const body = Object.entries(G).find(([k, v]) => k !== 'st' && k !== 'T' && v && typeof v === 'object' && v.root?.isObject3D)?.[1];
    const roots = [body?.root].filter(Boolean);
    if (scene) roots.push(scene);
    for (const [ri, r] of roots.entries()) r.traverse((o) => {
      if (o.isLight && warm(o.color)) out[`${ri} light ${o.type} ${hex(o.color)}`] = (out[`${ri} light ${o.type} ${hex(o.color)}`] ?? 0) + 1;
      for (const m of [].concat(o.material || [])) for (const key of ['color', 'emissive', 'attenuationColor', 'sheenColor', 'specularColor']) if (warm(m[key])) { const id = `${ri} ${m.type} ${key} ${hex(m[key])} map:${!!m.map} emap:${!!m.emissiveMap} vc:${!!m.vertexColors}`; out[id] = (out[id] ?? 0) + 1; }
      for (const [nm, at] of [['vertex', o.geometry?.attributes?.color], ['instance', o.instanceColor]]) {
        if (!at) continue;
        let n = 0;
        const c = {isColor: true, r: 0, g: 0, b: 0};
        for (let i = 0; i < at.count; i++) {
          c.r = at.getX(i); c.g = at.getY(i); c.b = at.getZ(i);
          if (warm(c)) n++;
        }
        if (n) out[`${ri} ${nm} colours warm: ${n} of ${at.count}`] = (out[`${ri} ${nm} colours warm: ${n} of ${at.count}`] ?? 0) + 1;
      }
    });
    return {out, roots: roots.length};
  },
  [t, g],
);
await browser.close();
console.log(JSON.stringify(res.out, null, 1));
const n = Object.keys(res.out).length;
console.error(n ? `${n} warm colour group(s) at t=${t} (0 = the creature, 1 = the whole scene)` : `no warm colour left at t=${t}`);
