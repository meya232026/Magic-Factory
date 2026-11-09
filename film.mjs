#!/usr/bin/env node
// One command from an entry to a finished, scored 1080p film, plus the review sheets:
//
//   node film.mjs piranha-film                 build, capture, score, mux, sheets
//   node film.mjs tarantula-demo               a short version: its scene's score is stretched to film length
//   node film.mjs ./my-object --score ./my-object/score.py
//
// Options: --size 1600x900 --dpr 2.4 (capture: 1600x900 CSS px at 2.4 = 4K, brought down to --width 1920 with
// lanczos) --crf 16 --score <cue sheet> --out <file.mp4> --no-build --no-sheets --clean (delete the 4K master and
// the WAVs once the film is muxed; kept by default so a new score needs no new capture).
//
// The steps are the ones in SKILL.md (build.mjs, capture.mjs, run_sfx.py, ffmpeg, sheet.mjs, wave.mjs), run in
// order with the numbers worked out from timeline.json: no typed atempo factor, no typed duration. Everything lands
// in ./cutaway-out: <entry>.mp4, <entry>_sheets/, <entry>_wave.png.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {FFMPEG, FFPROBE, OUT, PYTHON, ROOT, SIMS, needTool} from './paths.mjs';
import {filmLength, filmRate, problems, readTimeline, scoreFor} from './timeline.mjs';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const arg = argv[0];
if (!arg || arg.startsWith('--')) {
  console.error('usage: node film.mjs <entry|folder> [--size 1600x900] [--dpr 2.4] [--width 1920] [--crf 16] [--score cues.py] [--out f.mp4] [--no-build] [--no-sheets] [--clean]');
  process.exit(1);
}

// the entry: sims/<name>, or any folder with a main.js and a timeline.json
const dir = fs.existsSync(path.join(SIMS, arg, 'main.js')) ? path.join(SIMS, arg) : path.resolve(arg);
const entry = path.basename(dir);
const tlFile = path.join(dir, 'timeline.json');
if (!fs.existsSync(path.join(dir, 'main.js')) || !fs.existsSync(tlFile)) {
  console.error(`${dir} needs a main.js and a timeline.json`);
  process.exit(1);
}
let tl;
try {
  tl = readTimeline(tlFile);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const bad = problems(tl);
if (bad.length) {
  console.error(`${tlFile}:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}

// the cue sheet: --score, the examples' convention (<name>-shared/score.py), or a score.py next to the entry
const cue = opt('score') ? path.resolve(opt('score')) : (scoreFor(SIMS, entry)?.cue ?? [path.join(dir, 'score.py')].find((f) => fs.existsSync(f)));
if (cue && !fs.existsSync(cue)) {
  console.error(`no cue sheet at ${cue}`);
  process.exit(1);
}

needTool(FFMPEG, 'FFMPEG');
needTool(FFPROBE, 'FFPROBE');
if (cue) needTool(PYTHON, 'PYTHON', ['--version']);

const [W, H] = opt('size', '1600x900').split('x').map(Number);
const width = Number(opt('width', 1920));
if (!(W > 0 && H > 0 && width > 0 && Number(opt('dpr', 2.4)) > 0)) {
  console.error('--size is WxH in CSS pixels (1600x900), --width and --dpr positive numbers');
  process.exit(1);
}
const height = Math.round((width * H) / W / 2) * 2;
const file = (suffix) => path.join(OUT, `${entry}${suffix}`);
const master = file('-master.mp4');
const scene = file('-scene.wav');
const score = file('-score.wav');
const final = path.resolve(opt('out', file('.mp4')));
fs.mkdirSync(OUT, {recursive: true});
fs.mkdirSync(path.dirname(final), {recursive: true});

// a path as the user would type it from here
const show = (f) => {
  const r = path.relative(process.cwd(), f);
  return !r || r.startsWith('..') || path.isAbsolute(r) ? f : r;
};
let step = 0;
const run = (what, bin, args) => {
  console.log(`\n[${++step}] ${what}`);
  const r = spawnSync(bin, args, {stdio: 'inherit'});
  if (r.status !== 0) {
    console.error(`\n${what} failed${r.error ? `: ${r.error.message}` : ` (exit ${r.status})`}`);
    process.exit(1);
  }
};
const node = (script, args) => [process.execPath, [path.join(ROOT, script), ...args]];

if (!flag('no-build')) run(`build ${entry}`, ...node('sims/build.mjs', [dir]));
run(`capture ${W}x${H} at dpr ${opt('dpr', 2.4)}, ${filmLength(tl)} s at 60 fps`, ...node('sims/capture.mjs', [entry, '--size', `${W}x${H}`, '--dpr', String(opt('dpr', 2.4)), '--out', master]));

let audio = null;
if (cue) {
  const rate = filmRate(tl);
  run(`score ${show(cue)} on ${show(tlFile)}`, PYTHON, ['-I', path.join(ROOT, 'run_sfx.py'), cue, '--timeline', tlFile, '--out', rate === 1 ? score : scene]);
  if (rate !== 1) {
    // a short version plays duration seconds of scene in film seconds: the sound is scored on the scene and sped up alike
    const tempo = (tl.duration / tl.film).toFixed(6);
    run(`stretch the score to film time (atempo ${(+tempo).toFixed(3)})`, FFMPEG, ['-loglevel', 'error', '-y', '-i', scene, '-af', `atempo=${tempo}`, score]);
  }
  audio = score;
} else console.warn(`\nno cue sheet for ${entry} (pass --score): the film will be silent`);

run(
  `mux${audio ? ' the score and' : ''} bring the master down to ${width}x${height}`,
  FFMPEG,
  ['-loglevel', 'error', '-y', '-i', master, ...(audio ? ['-i', audio, '-map', '0:v', '-map', '1:a'] : ['-map', '0:v']),
    '-vf', `scale=${width}:${height}:flags=lanczos`, '-c:v', 'libx264', '-crf', String(opt('crf', 16)), '-pix_fmt', 'yuv420p',
    ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-movflags', '+faststart', final],
);

if (!flag('no-sheets')) {
  run('contact sheets, one tile per beat', ...node('sheet.mjs', ['--video', final, '--timeline', tlFile]));
  if (audio) run('waveform and loudness', ...node('wave.mjs', [final, '--timeline', tlFile]));
}
if (flag('clean')) for (const f of [master, scene, score]) fs.rmSync(f, {force: true});

const stem = final.replace(/\.[^.]+$/, '');
console.log(`\n→ ${final}`);
if (!flag('no-sheets')) console.log(`  review: ${stem}_sheets/${audio ? `  ${stem}_wave.png` : ''}`);
if (!flag('clean')) console.log(`  kept:   ${master}${audio ? `  ${score}` : ''} (--clean deletes them)`);
