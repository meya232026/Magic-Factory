// Reading a timeline.json, for every tool that needs its moments: capture --stills beats, sheet.mjs, wave.mjs,
// film.mjs and check.mjs.
//
// A timeline is {duration, script: [{t, act}, ...]} plus settings that are not moments: film (a short version plays
// `duration` seconds of scene in `film` seconds of film), push and opt (the piranha's camera distance factors), pills
// (the buttons a cut shows). Script times are scene seconds; in the page and in the video they land at
// t * film / duration.
import fs from 'node:fs';
import path from 'node:path';

/** Keys whose numbers are settings, not moments. */
export const SETTINGS = new Set(['fps', 'duration', 'film', 'push', 'opt', 'seed', 'speed']);

export function readTimeline(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`timeline not found: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`timeline is not valid JSON: ${file} (${e.message})`);
  }
}

/** Every moment in scene seconds, sorted, no repeats: each script entry's t, or for a timeline without a script every
 *  number in it that is not a setting. */
export function moments(tl) {
  const out = [];
  if (Array.isArray(tl.script)) {
    for (const e of tl.script) if (Number.isFinite(e?.t)) out.push(e.t);
  } else {
    const walk = (v, key) => {
      if (SETTINGS.has(key)) return;
      if (typeof v === 'number') out.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
    };
    walk(tl);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Film seconds per scene second: film / duration for a short version that plays its scene faster, else 1. */
export const filmRate = (tl) => (tl.film > 0 && tl.duration > 0 ? tl.film / tl.duration : 1);

/** Length of the rendered film in seconds. */
export const filmLength = (tl) => (tl.film > 0 ? tl.film : tl.duration);

/** The moments in film seconds: where they land in SIM.render(t), in the video and in its frames. */
export const filmMoments = (tl) => moments(tl).map((t) => +(t * filmRate(tl)).toFixed(4));

/** What is wrong with a timeline against the contract in SKILL.md, as a list of sentences (empty when it is fine). */
export function problems(tl) {
  const out = [];
  if (!tl || typeof tl !== 'object' || Array.isArray(tl)) return ['not a JSON object'];
  if (!(Number.isFinite(tl.duration) && tl.duration > 0)) out.push('duration must be a positive number of seconds');
  if ('film' in tl && !(Number.isFinite(tl.film) && tl.film > 0)) out.push('film must be a positive number of seconds');
  if (!Array.isArray(tl.script) || !tl.script.length) {
    out.push('script must be a non-empty list of {t, act}');
    return out;
  }
  let prev = -Infinity;
  tl.script.forEach((e, i) => {
    const at = `script[${i}]`;
    if (!e || !Number.isFinite(e.t)) return out.push(`${at}.t must be a number of seconds`);
    if (typeof e.act !== 'string' || !e.act) out.push(`${at}.act must be a name`);
    if (e.t < 0 || (Number.isFinite(tl.duration) && e.t >= tl.duration)) out.push(`${at}.t = ${e.t} is outside 0..duration`);
    if (e.t < prev) out.push(`${at}.t = ${e.t} comes before the beat above it: keep the script in time order`);
    prev = e.t;
  });
  return out;
}

/**
 * The cue sheet that scores an entry and the timeline it reads, by the examples' convention: <name>-shared/score_demo.py
 * for a demo with its own score (the wasp), else <name>-shared/score.py on the entry's own timeline. null when the
 * entry has no score.
 */
export function scoreFor(simsDir, entry) {
  const m = /^(.*)-(film|demo)$/.exec(entry);
  if (!m) return null;
  const shared = path.join(simsDir, `${m[1]}-shared`);
  const own = path.join(shared, `score_${m[2]}.py`);
  const cue = fs.existsSync(own) ? own : path.join(shared, 'score.py');
  const timeline = path.join(simsDir, entry, 'timeline.json');
  return fs.existsSync(cue) && fs.existsSync(timeline) ? {cue, timeline} : null;
}
