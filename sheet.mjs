#!/usr/bin/env node
// Contact sheets from any rendered video: the review loop's eyes, and the way to
// read a clip before writing timecodes about it.
//
//   node sheet.mjs --video f.mp4 --timeline timeline.json   every beat, settled (+0.3s)
//   node sheet.mjs --video f.mp4 2.3 4.5 6.9                exact timestamps
//   node sheet.mjs --video f.mp4 --every 1                  one frame per second
//   node sheet.mjs --video f.mp4 --from 3 --to 5 --every 0.2   scrub a transition
//
// Options: --offset 0.3  --cols 4  --rows 2  --size 540  --name beats
// Sheets land next to the video in <video>_sheets/. Every tile is labelled t= in video seconds; a short version's
// beats (timeline with "film") are moved to film time first. The label font is found per system; set CUTAWAY_FONT to
// a .ttf to choose one.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {FFMPEG, FFPROBE, needTool} from './paths.mjs';
import {filmMoments, readTimeline} from './timeline.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};

const videoArg = opt('video', null);
const timelinePath = opt('timeline', null);
const offset = Number(opt('offset', '0.3'));
const every = opt('every', null);
const from = Number(opt('from', '0'));
const to = opt('to', null);
const cols = Number(opt('cols', '4'));
const rows = Number(opt('rows', '2'));
const size = Number(opt('size', '540'));
let name = opt('name', null);

if (!videoArg || !fs.existsSync(videoArg) || !fs.statSync(videoArg).isFile()) {
  console.error(videoArg ? `no video at ${videoArg}` : 'pass --video <file.mp4>');
  process.exit(1);
}
const video = path.resolve(videoArg);
needTool(FFMPEG, 'FFMPEG');
needTool(FFPROBE, 'FFPROBE');

const probe = (args) =>
  execFileSync(FFPROBE, ['-v', 'error', ...args, '-of', 'csv=p=0', video]).toString().trim();
const duration = Number(probe(['-show_entries', 'format=duration']));

const beats = () => {
  if (!timelinePath) {
    console.error('pass timestamps, --every, or --timeline <file.json>');
    process.exit(1);
  }
  try {
    return filmMoments(readTimeline(timelinePath)).map((t) => t + offset);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
};

let times;
if (argv.length) {
  times = argv.map(Number);
  if (times.some((t) => !Number.isFinite(t))) {
    console.error(`timestamps must be seconds, got: ${argv.join(' ')}`);
    process.exit(1);
  }
  name ??= 'picked';
} else if (every) {
  const end = to === null ? duration : Number(to);
  const step = Number(every);
  if (!(step > 0)) {
    console.error(`--every needs a step in seconds above 0, got ${every}`);
    process.exit(1);
  }
  times = [];
  for (let i = 0; from + i * step <= end + 1e-6; i++) times.push(Number((from + i * step).toFixed(3)));
  name ??= `every${every}`;
} else {
  times = beats();
  name ??= 'beats';
}

// ffmpeg returns no frame for a seek this close to the end of the file, so keep 50 ms off it
const eps = 0.05;
times = [...new Set(times.map((t) => Math.min(Math.max(t, 0), duration - eps).toFixed(2)))]
  .map(Number)
  .sort((a, b) => a - b);

const base = video.replace(/\.[^.]+$/, '') + '_sheets';
const dir = path.join(base, name);
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(dir, {recursive: true});
// sheets left by an earlier, longer run of the same name would read as part of this one
const stale = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+\\.png$`);
for (const f of fs.readdirSync(base)) if (stale.test(f)) fs.rmSync(path.join(base, f));

const ffmpeg = (args) => execFileSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], {stdio: 'pipe'});

// A monospace font for the t= labels: CUTAWAY_FONT, else the first of these that exists, else fontconfig's monospace.
const FONTS = {
  win32: ['C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/cour.ttf'],
  darwin: ['/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf', '/System/Library/Fonts/Supplemental/Courier New.ttf'],
  linux: [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/TTF/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    '/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf',
  ],
};
const fontFile = process.env.CUTAWAY_FONT || (FONTS[process.platform] ?? FONTS.linux).find((f) => fs.existsSync(f));
// the filter parser needs a drive letter's colon escaped: C\:/Windows/Fonts/consola.ttf
const fontOpt = fontFile ? `fontfile='${fontFile.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : 'font=monospace';

let labels = true;
times.forEach((t, i) => {
  const file = path.join(dir, `${String(i).padStart(3, '0')}.png`);
  const scale = `scale=${size}:-2`;
  const label = `drawtext=${fontOpt}:text='t=${t.toFixed(2)}':x=10:y=10:fontsize=${Math.round(
    size / 24,
  )}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`;
  const grab = (vf) => ffmpeg(['-ss', String(t), '-i', video, '-frames:v', '1', '-vf', vf, file]);
  if (labels) {
    try {
      grab(`${scale},${label}`);
      return;
    } catch {
      labels = false;
      console.warn('drawtext could not draw the labels (no font, or no libfreetype in this ffmpeg build); sheets will have no timestamps. Set CUTAWAY_FONT to a .ttf to try another font.');
    }
  }
  grab(scale);
});

const perSheet = cols * rows;
const sheets = [];
for (let s = 0; s * perSheet < times.length; s++) {
  const out = path.join(base, `${name}-${s + 1}.png`);
  ffmpeg([
    '-framerate', '1',
    '-start_number', String(s * perSheet),
    '-i', path.join(dir, '%03d.png'),
    '-vf', `tile=${cols}x${rows}:padding=6:color=0x333333`,
    '-frames:v', '1',
    out,
  ]);
  sheets.push(out);
}

console.log(`${times.length} frames from ${video} → ${sheets.length} sheet(s):`);
sheets.forEach((s) => console.log(`  ${s}`));
