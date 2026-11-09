// Opens a built entry in headless Chromium in capture mode, for the review tools next to this file (cam_track,
// anchors_dump, probe_warm). Each example's sim_green.js puts one object on window with its stage st and tour T:
// SP (tarantula), PIRANHA (piranha), WASP (wasp). Pass its name, or leave it out and the tool finds it.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {CHROMIUM, CHROMIUM_ARGS, DIST, playwright} from '../../paths.mjs';

export const isNumber = (s) => s !== undefined && s !== '' && Number.isFinite(Number(s));

export function usage(text) {
  console.error(`usage: ${text}`);
  process.exit(1);
}

/** {browser, page, glob}: the entry's page, ready, and the name of its global. */
export async function openEntry(entry, glob) {
  const html = entry.endsWith('.html') ? path.resolve(entry) : path.join(DIST, `${path.basename(entry.replace(/[\\/]+$/, ''))}.html`);
  if (!fs.existsSync(html)) {
    console.error(`missing ${html}; run node sims/build.mjs ${entry}`);
    process.exit(1);
  }
  const {chromium} = playwright();
  const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
  const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.addInitScript(() => {
    window.__CAPTURE = true;
    window.__SIM_CONFIG = {};
  });
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => window.SIM && window.SIM.ready, null, {timeout: 60000});
  const found = await page.evaluate((want) => {
    const isSim = (v) => v && typeof v === 'object' && v.st && v.T && typeof v.T.stateAt === 'function';
    if (want) return {name: isSim(window[want]) ? want : null, all: []};
    const all = Object.keys(window).filter((k) => {
      try {
        return isSim(window[k]);
      } catch {
        return false;
      }
    });
    return {name: all[0] ?? null, all};
  }, glob ?? null);
  if (!found.name) {
    await browser.close();
    console.error(
      glob
        ? `window.${glob} in ${path.basename(html)} is not a sim global (an object with st and T.stateAt)`
        : `no sim global in ${path.basename(html)}: sim_green.js should set window.<NAME> = {st, T, ...}`,
    );
    process.exit(1);
  }
  if (found.all.length > 1) console.error(`several sim globals (${found.all.join(', ')}); using ${found.name}`);
  return {browser, page, glob: found.name};
}
