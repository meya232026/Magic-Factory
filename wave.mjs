#!/usr/bin/env node
// Sound check: waveform with every timeline beat drawn on top, plus loudness.
//
//   node wave.mjs cutaway-out/piranha-score.wav --timeline sims/piranha-film/timeline.json
//   node wave.mjs cutaway-out/piranha.mp4 --timeline sims/piranha-film/timeline.json   measure what you will post
//   without --timeline: waveform and loudness only, no beat lines
//   → <input>_wave.png next to the input
//
// Every hit in the waveform should sit on (or a hair after) a beat line. A beat is drawn at its share of the
// timeline's length, so a short version's lines fit its scene WAV, its stretched WAV and its final MP4 alike.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {FFMPEG, FFPROBE, needTool} from './paths.mjs';
import {moments, readTimeline} from './timeline.mjs';

const argv = process.argv.slice(2);
const ti = argv.indexOf('--timeline');
const timelinePath = ti === -1 ? null : path.resolve(argv.splice(ti, 2)[1] ?? '');
if (!argv[0] || !fs.existsSync(argv[0])) {
  console.error('usage: node wave.mjs <file.wav|file.mp4> [--timeline timeline.json]');
  process.exit(1);
}
const input = path.resolve(argv[0]);
needTool(FFMPEG, 'FFMPEG');
needTool(FFPROBE, 'FFPROBE');

const TARGET_LUFS = -14;
const MAX_TRUE_PEAK = -1;
const W = 1800;
const H = 280;

const probe = (args) => execFileSync(FFPROBE, ['-v', 'error', ...args, '-of', 'csv=p=0', input]).toString().trim();
if (!probe(['-select_streams', 'a', '-show_entries', 'stream=index'])) {
  console.error(`no audio track in ${input}`);
  process.exit(1);
}
const probed = Number(probe(['-show_entries', 'format=duration']));
let tl = {};
if (timelinePath) {
  try {
    tl = readTimeline(timelinePath);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
const span = tl.duration > 0 ? tl.duration : probed;
const beats = timelinePath ? moments(tl) : [];
if (timelinePath && Math.abs(span - probed) > 0.25 && !(tl.film > 0 && Math.abs(tl.film - probed) < 0.25)) {
  console.warn(`WARN the timeline runs ${span} s, the input ${probed.toFixed(2)} s: beat lines will not line up`);
}

const vline = (x, color) => `drawbox=x=${Math.min(W - 2, Math.max(0, Math.round(x)))}:y=0:w=2:h=ih:color=${color}:t=fill`;
// a faint line every second of the input, then a coral line per beat
const grid = Array.from({length: Math.floor(probed)}, (_, i) => vline(((i + 1) * W) / probed, 'white@0.12'));
const marks = beats.map((t) => vline((t / span) * W, '0xD97757@0.9'));
const lines = [...grid, ...marks].join(',');

const png = input.replace(/\.[^.]+$/, '') + '_wave.png';
execFileSync(FFMPEG, [
  '-loglevel', 'error', '-y', '-i', input,
  '-filter_complex',
  `color=c=0x141413:s=${W}x${H}:d=1[bg];` +
    `[0:a]aformat=channel_layouts=mono,showwavespic=s=${W}x${H}:scale=sqrt:colors=0x8A877F[w];` +
    `[bg][w]overlay=format=auto${lines ? ',' + lines : ''}`,
  '-frames:v', '1', png,
]);

const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', input, '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
  encoding: 'utf8',
});
const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary'));
const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
const peak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);

console.log(`waveform: ${png} (${beats.length} beats in coral, grid = 1s)`);
if (!Number.isFinite(lufs)) {
  console.warn('WARN could not measure loudness: does the input have an audio track?');
  process.exit(1);
}
console.log(`loudness: ${lufs} LUFS integrated (target ${TARGET_LUFS} ±1)`);
console.log(`true peak: ${peak} dBFS (keep ≤ ${MAX_TRUE_PEAK})`);
if (Math.abs(lufs - TARGET_LUFS) > 1) console.warn('WARN loudness off target: re-run the cue sheet, check TARGET_LUFS');
if (peak > MAX_TRUE_PEAK) console.warn('WARN true peak too hot: AAC encoding may clip, lower the master ceiling');
