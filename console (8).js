// The Theraphos TH-8 console (the Salticus JS-8's, renamed), copied from the scorpion's (roboscorp-shared/console.js, itself after the bee's): the
// orange JS-8 badge and title with the drive load and the sim status cells; the gait with a live step diagram of the
// eight legs; the jump with its arc gauge, airtime, launch and tuck; the eight leg servos; the optics with the iris,
// its trace and both main lenses' apertures; the
// assemblies the operator isolates, the display toggles, the subsystem registry; the operation log with the
// operator's actions on its timeline; the mode word in the viewport; labels with leaders into the spider and the
// operator's pointer. update(s) redraws every live part from the frame's state.
export const C = {ink: '#24211d', mute: '#9a8f82', faint: '#e0d7ca', line: '#ece5da', panel: 'rgba(253,251,247,.95)', or: '#ff5a1f', green: '#2fa36b', track: '#efe8de'};
export const VIEWS = ['hero', 'eyes', 'leg', 'abdomen', 'head', 'jump'];
export const VIEW_LABEL = {hero: 'HERO', eyes: 'OPTICS', leg: 'LEG R1', abdomen: 'ABDOMEN', head: 'HEAD', jump: 'JUMP'};
export const DISPLAY = ['labels', 'exploded', 'turntable', 'trace'];
export const DISPLAY_LABEL = {labels: 'LABELS', exploded: 'EXPLODED', turntable: 'TURNTABLE', trace: 'GAIT TRACE'};
// the viewport: the 3D shows between the side columns, above the flight log
export const VIEWPORT = {x0: 330, x1: 1270, y0: 108, y1: 744};
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(120,90,50,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.v{font:600 11px 'JetBrains Mono',monospace;color:${C.ink};white-space:nowrap}
.bt{position:absolute;height:23px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fffdf9;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink};white-space:nowrap;box-sizing:border-box}
.call{position:absolute;white-space:nowrap;padding:3px 6px 3px 5px;margin:-3px 0 0 -5px;background:rgba(253,251,247,.86);border-radius:3px}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.chip{position:absolute;height:15px;padding:0 6px;border-radius:3px;font:700 7.6px 'JetBrains Mono',monospace;letter-spacing:1.1px;display:flex;align-items:center;white-space:nowrap}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const SUBS = [
  ['OPTICS ARRAY', '2 MAIN + 6 SECONDARY LENSES'],
  ['HEAD SHELL', 'CARAPACE · EYE PLATE · FANGS'],
  ['ABDOMEN CORE', 'GLASS CAGE · GLOW COILS'],
  ['JUMP DRIVE', 'CROUCH · LAUNCH · TUCK'],
  ['LEG SERVOS', '8 LEGS × 4 JOINTS'],
  ['FANGS & PALPS', '2 GLOWING FANGS · 2 PEDIPALPS'],
];
const LEGS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];

// opts (all optional, the first film's console when absent): views / viewLabel / viewsTitle / viewRows for the view
// panel (the second film puts its assemblies there, in two rows), display / displayLabel for the toggles; the panels
// below move down to make room and the subsystem rows close up.
export function createConsole(app, opts = {}) {
  const views = opts.views ?? VIEWS;
  const viewLabel = opts.viewLabel ?? VIEW_LABEL;
  const display = opts.display ?? DISPLAY;
  const displayLabel = opts.displayLabel ?? DISPLAY_LABEL;
  const viewRows = opts.viewRows ?? 1;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const hr = (x, y, w) => add(`<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:1px;background:${C.line}"></div>`);
  const L = {x: 24, w: 290};
  const R = {x: 1286, w: 290};

  // ------------------------------------------------------------ header: badge, title, the drive load, the status cells
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:88px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:22px;top:22px" width="48" height="44" viewBox="0 0 48 44"><g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="24" cy="12" rx="8" ry="6"/><ellipse cx="24" cy="27" rx="10" ry="9"/><circle cx="21" cy="7" r="1.4"/><circle cx="27" cy="7" r="1.4"/><path d="M16 12l-8-5-5 9M32 12l8-5 5 9M15 15l-9 1-4 10M33 15l9 1 4 10M15 22l-8 6-2 10M33 22l8 6 2 10M17 31l-6 8M31 31l6 8"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:80px;top:34px;color:#fff;font-size:16px;font-weight:600;letter-spacing:3px">TH-8</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:20px;letter-spacing:2.4px">ROBOTIC TARANTULA · HEAVY HUNTER UNIT</div>`);
  add(`<div style="position:absolute;left:181px;top:35px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Theraphos TH-8 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:74px;font-size:11.2px;letter-spacing:2.2px;color:#6d6357">OCTOPOD HUNTER / FIELD SIMULATOR</div>`);
  add(`<div class="sm" style="position:absolute;left:700px;top:22px">DRIVE LOAD</div>`);
  const liftPct = add(`<div class="mo" style="position:absolute;right:${1600 - 1040}px;top:21px;font-size:10px;font-weight:700"></div>`);
  const liftCells = [];
  for (let i = 0; i < 40; i++) liftCells.push(add(`<div style="position:absolute;left:${700 + i * 8.5}px;top:38px;width:6px;height:13px;border-radius:1px;background:${C.track}"></div>`));
  add(`<div class="sm" style="position:absolute;left:700px;top:57px;font-size:7.6px">IDLE</div>`);
  add(`<div class="sm" style="position:absolute;left:846px;top:57px;font-size:7.6px">CRUISE</div>`);
  add(`<div class="sm" style="position:absolute;left:1010px;top:57px;font-size:7.6px">MAX</div>`);
  const cells = [
    ['SIM ID', 'TH8-1104'],
    ['RUNTIME', ''],
    ['STATUS', ''],
    ['OPERATOR', 'BAY 2 · M.V.'],
  ];
  const cellV = cells.map(([k, v], i) => {
    const x = 1086 + i * 118;
    if (i) add(`<div style="position:absolute;left:${x - 12}px;top:20px;width:1px;height:44px;background:${C.faint}"></div>`);
    add(`<div class="sm" style="position:absolute;left:${x}px;top:22px">${k}</div>`);
    return add(`<div class="mo" style="position:absolute;left:${x}px;top:40px;font-size:12px;font-weight:600;letter-spacing:.4px">${v}</div>`);
  });
  {
    let h = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 14; c++) h += `<path d="M${c * 25 + 4} ${r * 22}v8M${c * 25} ${r * 22 + 4}h8" stroke="${C.or}" stroke-width="1.1" opacity=".55"/>`;
    add(`<svg style="position:absolute;left:640px;top:84px" width="352" height="34">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 gait: the stride rate, the speed, the step diagram
  panel(L.x, 108, L.w, 226, 'GAIT', '01');
  const fq = add(`<div style="position:absolute;left:38px;top:140px;font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:39px;top:178px">STRIDE RATE</div>`);
  const amp = add(`<div style="position:absolute;right:${1600 - 300}px;top:146px;font-size:22px;font-weight:700;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 300}px;top:178px">MM/S</div>`);
  const chart = add(`<svg style="position:absolute;left:38px;top:196px" width="262" height="100"></svg>`);
  hr(38, 302, 262);
  add(`<div class="sm" style="position:absolute;left:38px;top:312px">PATTERN</div>`);
  const pb = add(`<div class="v" style="position:absolute;left:100px;top:310px"></div>`);
  const shutter = add(`<div class="sm" style="position:absolute;right:${1600 - 300}px;top:312px"></div>`);

  // ------------------------------------------------------------ 02 jump: the height, the arc gauge, the cells
  panel(L.x, 346, L.w, 148, 'JUMP', '02');
  const batt = add(`<div style="position:absolute;left:38px;top:378px;font-size:28px;font-weight:700;letter-spacing:-.8px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:39px;top:410px">HEIGHT OVER STANCE</div>`);
  const gauge = add(`<svg style="position:absolute;left:176px;top:366px" width="124" height="58"></svg>`);
  hr(38, 428, 262);
  const pw = ['AIRTIME', 'LAUNCH', 'TUCK'].map((k, i) => {
    const x = 38 + i * 90;
    add(`<div class="sm" style="position:absolute;left:${x}px;top:440px">${k}</div>`);
    return add(`<div class="v" style="position:absolute;left:${x}px;top:458px;font-size:13px"></div>`);
  });

  // ------------------------------------------------------------ 03 leg servos, eight rows
  panel(L.x, 506, L.w, 238, 'LEG SERVOS', '03');
  const legState = add(`<div class="chip" style="right:${1600 - 300}px;top:536px"></div>`);
  add(`<div class="sm" style="position:absolute;left:38px;top:540px">LOAD PER LEG · KNEE TORQUE</div>`);
  const servo = LEGS.map((n, i) => {
    const y = 562 + i * 21.5;
    add(`<div class="mo" style="position:absolute;left:38px;top:${y}px;font-size:10px;font-weight:700">${n}</div>`);
    add(`<div style="position:absolute;left:66px;top:${y + 4}px;width:170px;height:6px;background:${C.track};border-radius:3px"></div>`);
    const f = add(`<div style="position:absolute;left:66px;top:${y + 4}px;height:6px;background:${C.ink};border-radius:3px"></div>`);
    const v = add(`<div class="v" style="position:absolute;right:${1600 - 300}px;top:${y - 1}px"></div>`);
    return {f, v};
  });

  // ------------------------------------------------------------ 04 optics: the iris, a trace, both lenses
  panel(R.x, 108, R.w, 196, 'OPTICS', '04');
  const grip = add(`<div style="position:absolute;left:1300px;top:140px;font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:1301px;top:178px">IRIS · MAIN LENSES</div>`);
  const trace = add(`<svg style="position:absolute;left:1430px;top:136px" width="132" height="50"></svg>`);
  const fl = ['LENS L', 'LENS R'].map((k, i) => {
    const y = 200 + i * 24;
    add(`<div class="sm" style="position:absolute;left:1300px;top:${y + 2}px">${k}</div>`);
    add(`<div style="position:absolute;left:1356px;top:${y + 4}px;width:140px;height:6px;background:${C.track};border-radius:3px"></div>`);
    const f = add(`<div style="position:absolute;left:1356px;top:${y + 4}px;height:6px;background:${C.ink};border-radius:3px"></div>`);
    const v = add(`<div class="v" style="position:absolute;right:${1600 - 1562}px;top:${y}px"></div>`);
    return {f, v};
  });
  hr(1300, 252, 262);
  add(`<div class="sm" style="position:absolute;left:1300px;top:264px">MODE</div>`);
  const hold = add(`<div class="v" style="position:absolute;left:1346px;top:262px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1440px;top:264px">RANGE</div>`);
  const air = add(`<div class="v" style="position:absolute;right:${1600 - 1562}px;top:262px"></div>`);

  // ------------------------------------------------------------ 05 views, 06 display
  const btn = {};
  const btnRow = (keys, labels, x0, y, wmax = 262, pad = 22) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 7.1 + pad);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 30;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 6;
    }
  };
  const viewsH = 50 + 30 * viewRows;
  panel(R.x, 316, R.w, viewsH, opts.viewsTitle ?? 'VIEWS', '05');
  btnRow(views, viewLabel, 1300, 353, 262, 16);
  const dispY = 316 + viewsH + 12;
  panel(R.x, dispY, R.w, 110, 'DISPLAY', '06');
  btnRow(display, displayLabel, 1300, dispY + 37);
  const subY = dispY + 122;
  const subStep = Math.min(29, (744 - subY - 40) / 6);

  // ------------------------------------------------------------ 07 subsystems
  panel(R.x, subY, R.w, 744 - subY, 'SUBSYSTEMS', '07');
  const subs = SUBS.map(([n, d], i) => {
    const y = subY + 34 + i * subStep;
    const bar = add(`<div style="position:absolute;left:1296px;top:${y}px;width:2px;height:22px;background:transparent"></div>`);
    add(`<div class="mo" style="position:absolute;left:1304px;top:${y + 1}px;font-size:9px;color:${C.mute}">0${i + 1}</div>`);
    const name = add(`<div class="mo" style="position:absolute;left:1328px;top:${y}px;font-size:9.4px;font-weight:700;letter-spacing:1.2px">${n}</div>`);
    add(`<div class="sm" style="position:absolute;left:1328px;top:${y + 13}px;font-size:7.6px">${d}</div>`);
    const chip = add(`<div class="chip" style="right:${1600 - 1562}px;top:${y + 3}px"></div>`);
    return {bar, name, chip};
  });

  // ------------------------------------------------------------ 08 flight log
  panel(330, 760, 940, 98, 'OPERATION LOG', '08');
  add(`<div class="bt" style="left:346px;top:796px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px">❚❚</div>`);
  const logMode = add(`<div class="mo" style="position:absolute;left:406px;width:780px;top:790px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;left:406px;top:791px">DEPLOY</div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1250}px;top:791px">RECALL</div>`);
  const TLB = {x: 408, w: 840};
  add(`<div style="position:absolute;left:${TLB.x}px;top:818px;width:${TLB.w}px;height:3px;background:${C.track};border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TLB.x}px;top:818px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlTicks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:812px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:406px;top:834px;font-size:9.6px;color:${C.mute};letter-spacing:1px"></div>`);
  const tlNext = add(`<div class="sm" style="position:absolute;right:${1600 - 1250}px;top:836px"></div>`);

  // ------------------------------------------------------------ viewport notes: model, the view, the flight mode
  add(`<div class="sm" style="position:absolute;left:346px;top:122px;letter-spacing:2px">MODEL TH-8 · REV A</div>`);
  const viewNote = add(`<div class="sm" style="position:absolute;right:${1600 - 1254}px;top:122px;letter-spacing:2px"></div>`);
  add(`<svg style="position:absolute;left:346px;top:140px" width="60" height="60"><path d="M0 60V0h60" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<svg style="position:absolute;left:1194px;top:680px" width="60" height="60"><path d="M60 0v60H0" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:346px;top:666px">OPERATION MODE</div>`);
  const mode = add(`<div style="position:absolute;left:345px;top:680px;font-size:30px;font-weight:700;letter-spacing:-.4px;line-height:1;color:${C.or}"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:346px;top:716px"></div>`);

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:27px;top:878px;letter-spacing:2.2px">FIELD SIMULATOR &nbsp;·&nbsp; PROCEDURAL MODEL &nbsp;·&nbsp; 8 LEGS · 8 OPTICS · GLASS ABDOMEN</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:878px;letter-spacing:2.2px">THERAPHOS DYNAMICS · OPTICS LAB <span style="color:${C.or}">//////</span></div>`);

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
  const chipStyle = (n, kind, text) => {
    const k = {ok: [C.green, '#fff'], warn: [C.or, '#fff'], idle: [C.track, C.mute]}[kind];
    n.style.background = k[0];
    n.style.color = k[1];
    n.textContent = text;
  };
  let tickKey = '';

  return {
    spots,
    btn,
    root: ui,
    TLB,
    update(s) {
      // header
      const lift = Math.round(Math.min(1, s.lift) * 40);
      liftCells.forEach((c, i) => (c.style.background = i < lift ? (i > 30 ? C.or : C.ink) : C.track));
      liftPct.textContent = `${Math.round(s.lift * 100)}%`;
      cellV[1].textContent = `00:00:${String(Math.floor(s.time)).padStart(2, '0')}`;
      cellV[2].innerHTML = `<span style="color:${s.statusKind === 'ok' ? C.green : C.or}">●</span> ${s.status}`;
      // gait: the stride rate, the speed, the step diagram (a dark bar per leg while it stands, orange while it
      // swings, over the last 1.6 s with the now marker on the right)
      fq.innerHTML = `${s.freq.toFixed(1)}<span style="font-size:14px;font-weight:600;color:${C.mute}"> HZ</span>`;
      amp.textContent = `${Math.round(s.speed)}`;
      {
        const W = 262;
        const rows = s.steps.length;
        const rh = 11.2;
        let g = '';
        s.steps.forEach((row, r) => {
          const y = 4 + r * rh;
          g += `<text x="0" y="${y + 7.5}" font-size="7" fill="${C.mute}" font-family="JetBrains Mono">${LEGS[r]}</text>`;
          g += `<rect x="18" y="${y + 2}" width="${W - 30}" height="5" rx="1" fill="${C.track}"/>`;
          for (const [a, b, swing] of row) {
            const x0 = 18 + a * (W - 30);
            const x1 = 18 + b * (W - 30);
            if (x1 - x0 > 0.5) g += `<rect x="${x0.toFixed(1)}" y="${y + 2}" width="${(x1 - x0).toFixed(1)}" height="5" rx="1" fill="${swing ? C.or : C.ink}" opacity="${swing ? 1 : 0.85}"/>`;
          }
        });
        g += `<line x1="${W - 12}" x2="${W - 12}" y1="2" y2="${4 + rows * rh}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="2 2"/>`;
        g += `<text x="18" y="99" font-size="7" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">−1.6 S</text><text x="${W - 14}" y="99" text-anchor="end" font-size="7" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">NOW</text>`;
        chart.innerHTML = g;
      }
      pb.textContent = s.pattern;
      shutter.textContent = `DUTY ${Math.round(s.duty * 100)}%`;
      // jump: the height over the stance (negative in the crouch), a half-circle gauge from the crouch to the apex,
      // the airtime, the launch speed, the tuck
      batt.innerHTML = `${Math.round(s.jumpH)}<span style="font-size:13px;color:${C.mute}"> MM</span>`;
      {
        const cx = 62;
        const cy = 54;
        const r = 48;
        const pt = (a, rr) => [cx + Math.cos(Math.PI - a) * rr, cy - Math.sin(Math.PI - a) * rr];
        const arc = (a0, a1, rr) => {
          const [x0, y0] = pt(a0, rr);
          const [x1, y1] = pt(a1, rr);
          return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
        };
        const k = Math.max(0, Math.min(1, s.jumpK));
        let g = `<path d="${arc(0, Math.PI, r)}" fill="none" stroke="${C.track}" stroke-width="6"/>`;
        if (k > 0.005) g += `<path d="${arc(0, Math.PI * k, r)}" fill="none" stroke="${k > 0.7 ? C.or : C.ink}" stroke-width="6"/>`;
        for (let i = 0; i <= 6; i++) {
          const [x0, y0] = pt((i / 6) * Math.PI, r - 9);
          const [x1, y1] = pt((i / 6) * Math.PI, r - 13);
          g += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${C.mute}" stroke-width=".8"/>`;
        }
        const [nx, ny] = pt(Math.PI * k, r - 16);
        g += `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${C.or}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="3" fill="${C.or}"/>`;
        gauge.innerHTML = g;
      }
      pw[0].textContent = `${s.airtime.toFixed(2)} S`;
      pw[1].textContent = `${s.launch.toFixed(1)} M/S`;
      pw[2].textContent = `${Math.round(s.tuck * 100)}%`;
      pw[2].style.color = s.tuck > 0.05 ? C.or : C.ink;
      // leg servos
      chipStyle(legState, s.legsFree ? 'warn' : 'ok', s.legsFree ? 'DETACHED' : s.walking ? 'STEPPING' : 'HOLDING');
      servo.forEach((b, i) => {
        const v = s.servos[i];
        b.f.style.width = `${(v * 170).toFixed(1)}px`;
        const free = s.legFreeEach ? s.legFreeEach[i] : s.legsFree;
        b.f.style.background = v > 0.6 ? C.or : C.ink;
        b.v.textContent = free ? 'DETACHED' : `${Math.round(v * 100)}%`;
        b.v.style.color = free ? C.or : C.ink;
        b.v.style.fontSize = free ? '8.6px' : '11px';
      });
      // optics: the iris f-stop, its trace over the last 2 s, both main lenses' apertures, the mode, the range
      grip.innerHTML = `<span style="font-size:16px;font-weight:600;color:${C.mute}">F/</span>${s.fstop.toFixed(1)}`;
      {
        const W = 132;
        const H = 50;
        const Y = (v) => (H - 4 - v * (H - 10)).toFixed(1);
        const tr = s.irisTrace;
        const path = tr.map((v, i) => `${i ? 'L' : 'M'}${((i / (tr.length - 1)) * (W - 4)).toFixed(1)} ${Y(v)}`).join('');
        trace.innerHTML = `<line x1="0" x2="${W}" y1="${H - 4}" y2="${H - 4}" stroke="${C.faint}"/><path d="${path}" fill="none" stroke="${C.or}" stroke-width="1.5"/><circle cx="${W - 4}" cy="${Y(tr[tr.length - 1])}" r="2.6" fill="${C.or}"/>`;
      }
      fl.forEach((b, i) => {
        const v = s.lensOpen[i];
        b.f.style.width = `${(v * 140).toFixed(1)}px`;
        b.f.style.background = v > 0.6 ? C.or : C.ink;
        const off = s.opticsOpen;
        b.v.textContent = off ? 'OPEN' : `${Math.round(v * 100)}%`;
        b.v.style.color = off ? C.or : C.ink;
      });
      hold.textContent = s.opticsMode;
      air.textContent = `${Math.round(s.range)} MM`;
      // views, display
      const onBtn = (k, on) => {
        btn[k].style.background = on ? C.or : '#fffdf9';
        btn[k].style.color = on ? '#fff' : C.ink;
        btn[k].style.borderColor = on ? C.or : C.faint;
      };
      for (const k of views) onBtn(k, s.view === k);
      for (const k of display) onBtn(k, !!s.display[k]);
      // subsystems: a status chip each, the row the current view looks at marked
      subs.forEach((r, i) => {
        const [kind, text] = s.subs[i];
        chipStyle(r.chip, kind, text);
        r.bar.style.background = s.focus === i ? C.or : 'transparent';
        r.name.style.color = s.focus === i ? C.or : C.ink;
      });
      // flight log: the film's progress, a tick for every press, the mode
      const kx = TLB.x + (s.time / s.dur) * TLB.w;
      tlFill.style.width = `${(kx - TLB.x).toFixed(1)}px`;
      tlKnob.style.left = `${kx.toFixed(1)}px`;
      const key = s.events.length;
      if (key !== tickKey) {
        tickKey = key;
        tlTicks.innerHTML = s.events.map((e) => `<div style="position:absolute;left:${(TLB.x + (e / s.dur) * TLB.w - 1).toFixed(1)}px;top:813px;width:2px;height:13px;background:${C.ink};opacity:.35"></div>`).join('');
      }
      tlTime.textContent = `${clock(s.time)} / ${clock(s.dur)}`;
      tlNext.textContent = s.next;
      logMode.textContent = s.log;
      viewNote.textContent = s.viewNote ?? `VIEW · ${viewLabel[s.view]}${s.display.orbit ? ' · ORBIT' : ''}`;
      mode.textContent = s.mode;
      modeSub.textContent = s.modeSub;
      // labels: an orange square, the name, the note, a thin leader to the part
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
