#!/usr/bin/env node
// Checks the skill without a GPU in a few seconds; CI runs it on every push.
//   - every sims/*/timeline.json against the contract: a duration, film if any, beats {t, act} in time order inside it
//   - every entry bundles: each import found, each name it uses exported (in memory, nothing is written)
//   - every Python file compiles, every cue sheet loads with its score(mix, tl) and finds its timeline
//
//   node check.mjs            (npm run check)
//   node check.mjs --sound    also scores every entry into cutaway-out/check/ and checks the loudness (~15 s each)
//
// Without three in node_modules the bundles cover the skill's own imports only, and the check says so.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {DEPS, OUT, PYTHON, ROOT, SIMS, fromDeps, hasDep} from './paths.mjs';
import {problems, readTimeline, scoreFor} from './timeline.mjs';

const SOUND = process.argv.includes('--sound');
let failed = 0;
let warned = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  failed++;
  console.log(`  FAIL  ${msg}`);
};
const warn = (msg) => {
  warned++;
  console.log(`  warn  ${msg}`);
};

const entries = fs
  .readdirSync(SIMS)
  .filter((d) => fs.existsSync(path.join(SIMS, d, 'main.js')))
  .sort();

console.log('timelines');
for (const e of entries) {
  const file = path.join(SIMS, e, 'timeline.json');
  if (!fs.existsSync(file)) {
    warn(`${e}: no timeline.json`);
    continue;
  }
  try {
    const ps = problems(readTimeline(file));
    if (ps.length) ps.forEach((p) => bad(`${e}/timeline.json: ${p}`));
    else ok(`${e}/timeline.json`);
  } catch (err) {
    bad(err.message);
  }
}

console.log('bundles');
const esbuild = fromDeps('esbuild');
const withThree = !!hasDep('three');
if (!withThree) warn(`three is not in ${DEPS}: checking the skill's own imports only (npm install for the full check)`);
const kit = {
  name: 'cutaway-kit',
  setup(b) {
    b.onResolve({filter: /^cutaway-kit\//}, (a) => ({path: path.join(SIMS, 'kit', a.path.slice('cutaway-kit/'.length))}));
  },
};
for (const e of entries) {
  try {
    const r = await esbuild.build({
      entryPoints: [path.join(SIMS, e, 'main.js')],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      minify: true,
      nodePaths: [DEPS],
      plugins: [kit],
      loader: {'.glb': 'base64', '.woff2': 'base64'},
      external: withThree ? [] : ['three', 'three/*'],
      logLevel: 'silent',
    });
    ok(`${e}  ${(r.outputFiles[0].text.length / 1024).toFixed(0)} KB${withThree ? '' : ' without three'}`);
  } catch (err) {
    bad(`${e}: ${err.errors?.map((x) => `${x.text} (${x.location?.file}:${x.location?.line})`).join('; ') || err.message}`);
  }
}

console.log('python');
// -B: no bytecode left behind (-I ignores PYTHONDONTWRITEBYTECODE); no TL / OUT from the shell steering the cue sheets
const pyEnv = {...process.env, PYTHONDONTWRITEBYTECODE: '1'};
delete pyEnv.TL;
delete pyEnv.OUT;
if (spawnSync(PYTHON, ['--version']).error) warn(`${PYTHON} not found: skipped (set PYTHON)`);
else {
  const pyFiles = [];
  const walk = (d) => {
    for (const x of fs.readdirSync(d, {withFileTypes: true})) {
      if (x.isDirectory()) {
        if (!['.git', 'node_modules', '__pycache__', path.basename(OUT)].includes(x.name)) walk(path.join(d, x.name));
      } else if (x.name.endsWith('.py')) pyFiles.push(path.join(d, x.name));
    }
  };
  walk(ROOT);
  // compile in memory: nothing lands in __pycache__
  const compiled = spawnSync(PYTHON, ['-I', '-B', '-c', "import sys\nfor f in sys.argv[1:]:\n    compile(open(f, encoding='utf8').read(), f, 'exec')", ...pyFiles], {encoding: 'utf8', env: pyEnv});
  if (compiled.status === 0) ok(`${pyFiles.length} files compile`);
  else bad(compiled.stderr.trim().split(/\r?\n/).slice(-3).join(' | '));

  const cues = [...new Set(entries.map((e) => scoreFor(SIMS, e)?.cue).filter(Boolean))];
  const loader = [
    'import os, sys',
    'sys.path.insert(0, sys.argv[1])',
    'from sfx.__main__ import load_cues',
    'for cue in sys.argv[2:]:',
    '    m = load_cues(cue)',
    '    tl = os.path.join(os.path.dirname(os.path.abspath(cue)), getattr(m, "TIMELINE", "timeline.json"))',
    '    print(cue, "ok" if os.path.isfile(tl) else "missing timeline " + tl, sep="\\t")',
  ].join('\n');
  const loaded = spawnSync(PYTHON, ['-I', '-B', '-c', loader, ROOT, ...cues], {encoding: 'utf8', env: pyEnv});
  if (loaded.status !== 0) bad(`cue sheets: ${loaded.stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`);
  else
    for (const line of loaded.stdout.trim().split(/\r?\n/)) {
      const [cue, status] = line.split('\t');
      (status === 'ok' ? ok : bad)(`${path.relative(ROOT, cue)} ${status === 'ok' ? 'loads' : status}`);
    }

  if (SOUND) {
    console.log('sound');
    for (const e of entries) {
      const s = scoreFor(SIMS, e);
      if (!s) continue;
      const out = path.join(OUT, 'check', `${e}.wav`);
      const r = spawnSync(PYTHON, ['-I', '-B', path.join(ROOT, 'run_sfx.py'), s.cue, '--timeline', s.timeline, '--out', out], {encoding: 'utf8', env: pyEnv});
      const last = (r.stdout || '').trim().split(/\r?\n/).pop();
      if (r.status !== 0) {
        bad(`${e}: ${(r.stderr || '').trim().split(/\r?\n/).pop()}`);
        continue;
      }
      const m = /(-?[\d.]+) LUFS, true peak (-?[\d.]+) dBFS/.exec(last);
      if (m && Math.abs(Number(m[1]) + 14) <= 1 && Number(m[2]) <= -1) ok(`${e}: ${m[1]} LUFS, true peak ${m[2]} dBFS`);
      else warn(`${e}: ${last}`);
    }
  }
}

console.log(failed ? `\n${failed} problem(s)` : `\nall good${warned ? `, ${warned} warning(s)` : ''}`);
process.exit(failed ? 1 : 0);
