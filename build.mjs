#!/usr/bin/env node
// Bundles every sims/<name>/main.js into one self-contained HTML file:
// cutaway-out/dist/<name>.html (three.js, fonts, CSS inlined). Opens from file://,
// works offline, can be published as-is.
//
//   node sims/build.mjs                 every example in sims/
//   node sims/build.mjs piranha-film    one example
//   node sims/build.mjs ./my-machine    your own sim: any folder with a main.js. Import the kit as
//                                       'cutaway-kit/runtime.js', 'cutaway-kit/util.js' and so on.
//
// An entry may carry build.json with {"swap": {"heavy.glb": "light.glb"}}: every import of a file named heavy.glb is
// served from light.glb in the same folder (a site page with lighter models than its film). {"external": {...}} does
// the same but leaves the model out of the page: the import becomes the string "url:light.glb", the file is copied
// next to the page and listed in <name>.assets.json (the site build copies those too). The page stays small enough
// for link crawlers (X reads the share card from it). {"files": [...]} copies more files from node_modules next to the
// page the same way (decoders a loader fetches at runtime).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEPS, DIST, ROOT, fromDeps} from '../paths.mjs';
import {problems, readTimeline} from '../timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES = fs.readdirSync(HERE).filter((d) => fs.existsSync(path.join(HERE, d, 'main.js')));
const names = process.argv.slice(2).length ? process.argv.slice(2) : ENTRIES;
// every entry is found before anything is loaded, so a typo fails at once with the list of entries
const dirs = names.map((arg) => {
  const dir = fs.existsSync(path.join(HERE, arg, 'main.js')) ? path.join(HERE, arg) : path.resolve(arg);
  if (!fs.existsSync(path.join(dir, 'main.js'))) {
    console.error(`no main.js in ${dir}\nentries here: ${ENTRIES.join(', ')}; or pass a folder with a main.js`);
    process.exit(1);
  }
  return dir;
});

const esbuild = fromDeps('esbuild');
fs.mkdirSync(DIST, {recursive: true});

// a font file from DEPS as base64; a missing one means the install is incomplete
const dep64 = (rel) => {
  try {
    return fs.readFileSync(path.join(DEPS, rel)).toString('base64');
  } catch {
    console.error(`cutaway: ${rel} is missing from ${DEPS}\nRun once:  cd "${ROOT}" && npm install`);
    process.exit(1);
  }
};
const font = (weight) => {
  const b64 = dep64(`@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${weight}-normal.woff2`);
  return `@font-face{font-family:'JetBrains Mono';font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const inter = dep64('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const FONTS = [400, 600, 700].map(font).join('\n') +
  `\n@font-face{font-family:'Inter';font-weight:100 900;font-style:normal;font-display:block;src:url(data:font/woff2;base64,${inter}) format('woff2');}`;
const KIT_CSS = fs.readFileSync(path.join(HERE, 'kit/style.css'), 'utf8');

// `cutaway-kit/x.js` resolves to sims/kit/x.js, so a sim outside this folder can use the kit.
const kitPlugin = {
  name: 'cutaway-kit',
  setup(b) {
    b.onResolve({filter: /^cutaway-kit\//}, (args) => ({path: path.join(HERE, 'kit', args.path.slice('cutaway-kit/'.length))}));
  },
};

for (const dir of dirs) {
  const name = path.basename(dir);
  const t0 = Date.now();
  // a broken timeline still builds, but says so: the page, the score and the review tools all read it
  const tlFile = path.join(dir, 'timeline.json');
  if (fs.existsSync(tlFile)) {
    try {
      for (const p of problems(readTimeline(tlFile))) console.warn(`warning: ${name}/timeline.json: ${p}`);
    } catch (e) {
      console.warn(`warning: ${e.message}`);
    }
  }
  const cfgFile = path.join(dir, 'build.json');
  const bcfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
  const swap = bcfg.swap || {};
  const external = bcfg.external || {};
  const assets = [];
  const plugins = Object.keys(external).length
    ? [
        {
          name: 'external',
          setup(b) {
            b.onResolve({filter: /\.glb$/}, (args) => {
              const base = path.basename(args.path);
              if (!external[base]) return undefined;
              const src = path.join(args.resolveDir, path.dirname(args.path), external[base]);
              if (!assets.includes(src)) assets.push(src);
              return {path: external[base], namespace: 'ext'};
            });
            b.onLoad({filter: /.*/, namespace: 'ext'}, (args) => ({contents: `export default ${JSON.stringify('url:' + args.path)};`, loader: 'js'}));
          },
        },
      ]
    : Object.keys(swap).length
    ? [
        {
          name: 'swap',
          setup(b) {
            b.onResolve({filter: /\.glb$/}, (args) => {
              const base = path.basename(args.path);
              if (!swap[base]) return undefined;
              return {path: path.join(args.resolveDir, path.dirname(args.path), swap[base])};
            });
          },
        },
      ]
    : [];
  const res = await esbuild.build({
    plugins: [kitPlugin, ...plugins],
    entryPoints: [path.join(dir, 'main.js')],
    bundle: true,
    nodePaths: [DEPS],
    format: 'esm',
    minify: !process.env.SIMS_DEBUG,
    write: false,
    target: 'es2022',
    legalComments: 'none',
    loader: {'.glb': 'base64', '.woff2': 'base64'},
    logLevel: 'warning',
  });
  // the bundle sits inside <script>: any closing tag in it, in any case, would end the script early
  const js = res.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1');
  const css = fs.existsSync(path.join(dir, 'style.css')) ? fs.readFileSync(path.join(dir, 'style.css'), 'utf8') : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${name}</title>
<style>
${FONTS}
${KIT_CSS}
${css}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">
${js}
</script>
</body>
</html>
`;
  const out = path.join(DIST, `${name}.html`);
  fs.writeFileSync(out, html);
  const listFile = path.join(DIST, `${name}.assets.json`);
  assets.push(...(bcfg.files || []).map((f) => path.join(DEPS, f)));
  if (assets.length) {
    for (const a of assets) fs.copyFileSync(a, path.join(DIST, path.basename(a)));
    fs.writeFileSync(listFile, JSON.stringify(assets.map((a) => path.basename(a))));
  } else if (fs.existsSync(listFile)) fs.rmSync(listFile);
  console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`);
}
