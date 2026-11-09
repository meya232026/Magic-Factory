// Paths and browser flags for the kit. Everything resolves from this folder, so the skill runs wherever it is installed.
// Override any of them with an environment variable.

import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const SIMS = path.join(ROOT, 'sims');

export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';
export const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

// three, esbuild, fonts and playwright: `npm install` in this folder puts them here.
export const DEPS = process.env.CUTAWAY_DEPS || path.join(ROOT, 'node_modules');
// Unset: playwright uses the Chromium that `npx playwright install chromium` downloaded.
export const CHROMIUM = process.env.CHROMIUM || undefined;
// Real GPU WebGL instead of a software rasteriser. On Windows d3d11 plus --force_high_performance_gpu keeps ANGLE off
// an integrated GPU when a discrete one exists. capture.mjs prints the GPU it got on every run.
export const CHROMIUM_ARGS = [
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--force_high_performance_gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--hide-scrollbars',
];

// Builds and renders land in ./cutaway-out of the folder you run from.
export const OUT = path.resolve(process.env.CUTAWAY_OUT || 'cutaway-out');
export const DIST = path.join(OUT, 'dist');

/** A package from DEPS; a missing one stops with the command that installs it instead of a stack trace. */
export const fromDeps = (id) => {
  try {
    return createRequire(path.join(DEPS, 'x.js'))(id);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(`'${id}'`)) throw e;
    console.error(`cutaway: ${id} is not installed in ${DEPS}\nRun once:  cd "${ROOT}" && npm install && npx playwright install chromium`);
    process.exit(1);
  }
};
/** Resolves a package from DEPS without loading it, or null. */
export const hasDep = (id) => {
  try {
    return createRequire(path.join(DEPS, 'x.js')).resolve(id);
  } catch {
    return null;
  }
};
export const playwright = () => fromDeps('playwright');

/** Stops before any work starts when a command-line tool the step needs is missing: needTool(FFMPEG, 'FFMPEG'). */
export const needTool = (bin, env, args = ['-version']) => {
  const r = spawnSync(bin, args, {stdio: 'ignore'});
  if (r.error) {
    console.error(`cutaway: ${bin} not found (${r.error.code}). Install it, or set ${env} to its full path.`);
    process.exit(1);
  }
};
