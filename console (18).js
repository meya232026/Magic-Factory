// The Mellis HB-7 console, laid out at 1600 x 900 after the Cessna console and the reference app recordings: the
// orange HB-7 badge and title with the sim status cells, the wing beat with its live stroke chart, power, the six leg
// servos, flight telemetry with an attitude ball, the views, the display toggles, the subsystem registry, the flight
// log with the operator's actions on its timeline, the flight-mode word in the viewport, the labels with leaders into
// the bee and the operator's pointer. Panels are light paper over the near-white studio; the bee's orange is the one
// accent. update(s) redraws every live part from the frame's state; the film and a live page share it.
export const C = {ink: '#24211d', mute: '#9a8f82', faint: '#e0d7ca', line: '#ece5da', panel: 'rgba(253,251,247,.95)', or: '#ff5a1f', green: '#2fa36b', track: '#efe8de'};
export const VIEWS = ['hero', 'front', 'side', 'wing', 'legs'];
export const VIEW_LABEL = {hero: 'HERO', front: 'FRONT', side: 'SIDE', wing: 'WING', legs: 'LEGS'};
export const DISPLAY = ['labels', 'xray', 'exploded', 'blur', 'orbit'];
export const DISPLAY_LABEL = {labels: 'LABELS', xray: 'X-RAY', exploded: 'EXPLODED', blur: 'MOTION BLUR', orbit: 'ORBIT'};
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
  ['OPTIC HEAD', '2 × 18 MM LENS · AMBER IR'],
  ['NECK BEARING', '10-SEGMENT COLLAR'],
  ['THORAX DRIVE', '3 GEARS · 11 ACTUATORS'],
  ['WING ROOTS', '4 HINGES · 7.5 HZ CRANK'],
  ['LEG SERVOS', '6 LEGS × 3 JOINTS'],
  ['ABDOMEN BANDS', '5 SEGMENTS · GLASS STING'],
];
const LEGS = ['L1', 'L2', 'L3', 'R1', 'R2', 'R3'];

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

  // ------------------------------------------------------------ header: badge, title, the lift bar, the status cells
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:88px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:24px" width="44" height="40" viewBox="0 0 44 40"><g fill="none" stroke="#fff" stroke-width="2.2"><path d="M22 3l9 5.2v10.4l-9 5.2-9-5.2V8.2z"/><path d="M13 14C7 6 1 9 2 14s7 5 11 2M31 14c6-8 12-5 11 0s-7 5-11 2"/><path d="M18 26l-3 10M26 26l3 10M22 24v12"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:80px;top:34px;color:#fff;font-size:16px;font-weight:600;letter-spacing:3px">VX-9</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:20px;letter-spacing:2.4px">ROBOTIC WASP · MICRO AIR VEHICLE</div>`);
  add(`<div style="position:absolute;left:181px;top:35px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Vespion VX-9 <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:74px;font-size:11.2px;letter-spacing:2.2px;color:#6d6357">FLAPPING-WING DRONE / FIELD SIMULATOR</div>`);
  add(`<div class="sm" style="position:absolute;left:700px;top:22px">LIFT LOAD</div>`);
  const liftPct = add(`<div class="mo" style="position:absolute;right:${1600 - 1040}px;top:21px;font-size:10px;font-weight:700"></div>`);
  const liftCells = [];
  for (let i = 0; i < 40; i++) liftCells.push(add(`<div style="position:absolute;left:${700 + i * 8.5}px;top:38px;width:6px;height:13px;border-radius:1px;background:${C.track}"></div>`));
  add(`<div class="sm" style="position:absolute;left:700px;top:57px;font-size:7.6px">IDLE</div>`);
  add(`<div class="sm" style="position:absolute;left:852px;top:57px;font-size:7.6px">HOVER</div>`);
  add(`<div class="sm" style="position:absolute;left:1010px;top:57px;font-size:7.6px">MAX</div>`);
  const cells = [
    ['SIM ID', 'HB7-0412'],
    ['RUNTIME', ''],
    ['STATUS', ''],
    ['OPERATOR', 'LAB 3 · R.K.'],
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

  // ------------------------------------------------------------ 01 wing beat
  panel(L.x, 108, L.w, 226, 'WING BEAT', '01');
  const fq = add(`<div style="position:absolute;left:38px;top:140px;font-size:34px;font-weight:700;letter-spacing:-1px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:39px;top:178px">STROKE FREQUENCY</div>`);
  const amp = add(`<div style="position:absolute;right:${1600 - 300}px;top:146px;font-size:22px;font-weight:700;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 300}px;top:178px">AMPLITUDE</div>`);
  const chart = add(`<svg style="position:absolute;left:38px;top:198px" width="262" height="96"></svg>`);
  hr(38, 302, 262);
  add(`<div class="sm" style="position:absolute;left:38px;top:312px">PLAYBACK</div>`);
  const pb = add(`<div class="v" style="position:absolute;left:104px;top:310px"></div>`);
  const shutter = add(`<div class="sm" style="position:absolute;right:${1600 - 300}px;top:312px"></div>`);

  // ------------------------------------------------------------ 02 power
  panel(L.x, 346, L.w, 148, 'POWER', '02');
  const batt = add(`<div style="position:absolute;left:38px;top:378px;font-size:28px;font-weight:700;letter-spacing:-.8px;line-height:1"></div>`);
  add(`<div class="sm" style="position:absolute;left:39px;top:410px">BATTERY</div>`);
  const battCells = [];
  for (let i = 0; i < 10; i++) battCells.push(add(`<div style="position:absolute;left:${150 + i * 15}px;top:383px;width:11px;height:20px;border-radius:2px;background:${C.track}"></div>`));
  hr(38, 428, 262);
  const pw = [['DRAW', 444], ['CELL', 444], ['MOTOR', 444]].map(([k], i) => {
    const x = 38 + i * 90;
    add(`<div class="sm" style="position:absolute;left:${x}px;top:440px">${k}</div>`);
    return add(`<div class="v" style="position:absolute;left:${x}px;top:458px;font-size:13px"></div>`);
  });

  // ------------------------------------------------------------ 03 leg servos
  panel(L.x, 506, L.w, 238, 'LEG SERVOS', '03');
  const legState = add(`<div class="chip" style="right:${1600 - 300}px;top:536px"></div>`);
  add(`<div class="sm" style="position:absolute;left:38px;top:540px">LOAD PER LEG · KNEE TORQUE</div>`);
  const servo = LEGS.map((n, i) => {
    const y = 566 + i * 27;
    add(`<div class="mo" style="position:absolute;left:38px;top:${y}px;font-size:10px;font-weight:700">${n}</div>`);
    add(`<div style="position:absolute;left:66px;top:${y + 4}px;width:178px;height:6px;background:${C.track};border-radius:3px"></div>`);
    const f = add(`<div style="position:absolute;left:66px;top:${y + 4}px;height:6px;background:${C.ink};border-radius:3px"></div>`);
    const v = add(`<div class="v" style="position:absolute;right:${1600 - 300}px;top:${y - 1}px"></div>`);
    return {f, v};
  });

  // ------------------------------------------------------------ 04 flight
  panel(R.x, 108, R.w, 196, 'FLIGHT', '04');
  const ball = add(`<svg style="position:absolute;left:1300px;top:142px" width="96" height="96"></svg>`);
  const fl = [['ALT AGL', 0], ['V/S', 1], ['PITCH', 2], ['ROLL', 3]].map(([k], i) => {
    const y = 142 + i * 24;
    add(`<div class="sm" style="position:absolute;left:1412px;top:${y + 2}px">${k}</div>`);
    return add(`<div class="v" style="position:absolute;right:${1600 - 1562}px;top:${y}px"></div>`);
  });
  hr(1300, 252, 262);
  add(`<div class="sm" style="position:absolute;left:1300px;top:264px">HOLD</div>`);
  const hold = add(`<div class="v" style="position:absolute;left:1350px;top:262px"></div>`);
  add(`<div class="sm" style="position:absolute;left:1440px;top:264px">AIRSPEED</div>`);
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
  panel(330, 760, 940, 98, 'FLIGHT LOG', '08');
  add(`<div class="bt" style="left:346px;top:796px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px">❚❚</div>`);
  const logMode = add(`<div class="mo" style="position:absolute;left:406px;width:780px;top:790px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  add(`<div class="sm" style="position:absolute;left:406px;top:791px">TAKE-OFF</div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1250}px;top:791px">LAND</div>`);
  const TLB = {x: 408, w: 840};
  add(`<div style="position:absolute;left:${TLB.x}px;top:818px;width:${TLB.w}px;height:3px;background:${C.track};border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TLB.x}px;top:818px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlTicks = add(`<div style="position:absolute;inset:0"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:812px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:406px;top:834px;font-size:9.6px;color:${C.mute};letter-spacing:1px"></div>`);
  const tlNext = add(`<div class="sm" style="position:absolute;right:${1600 - 1250}px;top:836px"></div>`);

  // ------------------------------------------------------------ viewport notes: model, the view, the flight mode
  add(`<div class="sm" style="position:absolute;left:346px;top:122px;letter-spacing:2px">MODEL VX-9 · REV A</div>`);
  const viewNote = add(`<div class="sm" style="position:absolute;right:${1600 - 1254}px;top:122px;letter-spacing:2px"></div>`);
  add(`<svg style="position:absolute;left:346px;top:140px" width="60" height="60"><path d="M0 60V0h60" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<svg style="position:absolute;left:1194px;top:680px" width="60" height="60"><path d="M60 0v60H0" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:346px;top:666px">FLIGHT MODE</div>`);
  const mode = add(`<div style="position:absolute;left:345px;top:680px;font-size:30px;font-weight:700;letter-spacing:-.4px;line-height:1;color:${C.or}"></div>`);
  const modeSub = add(`<div class="sm" style="position:absolute;left:346px;top:716px"></div>`);

  // ------------------------------------------------------------ footer
  add(`<div class="sm" style="position:absolute;left:27px;top:878px;letter-spacing:2.2px">FIELD SIMULATOR &nbsp;·&nbsp; PROCEDURAL MODEL &nbsp;·&nbsp; 6 LEGS · 4 WINGS · 2 OPTICS</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:878px;letter-spacing:2.2px">VESPION ROBOTICS · INTERCEPT LAB <span style="color:${C.or}">//////</span></div>`);

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
      const lift = Math.round(s.lift * 40);
      liftCells.forEach((c, i) => (c.style.background = i < lift ? (i > 30 ? C.or : C.ink) : C.track));
      liftPct.textContent = `${Math.round(s.lift * 100)}%`;
      cellV[1].textContent = `00:00:${String(Math.floor(s.time)).padStart(2, '0')}`;
      cellV[2].innerHTML = `<span style="color:${s.statusKind === 'ok' ? C.green : C.or}">●</span> ${s.status}`;
      // wing beat: the frequency, the amplitude, the stroke of the near forewing (orange) and hindwing (grey) over the
      // last 1.2 s, with the now marker on the right
      fq.innerHTML = `${s.freq.toFixed(1)}<span style="font-size:14px;font-weight:600;color:${C.mute}"> HZ</span>`;
      amp.textContent = `±${Math.round(s.amp)}°`;
      {
        const W = 262;
        const H = 96;
        const Y = (a) => H / 2 - (a / 40) * (H / 2 - 8);
        let g = `<line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="${C.faint}" stroke-width="1"/>`;
        for (const a of [-32, 32]) g += `<line x1="0" x2="${W}" y1="${Y(a)}" y2="${Y(a)}" stroke="${C.line}" stroke-width="1" stroke-dasharray="2 3"/><text x="${W - 2}" y="${Y(a) - 3}" text-anchor="end" font-size="7" fill="${C.mute}" font-family="JetBrains Mono">${a > 0 ? '+' : ''}${a}°</text>`;
        const path = (k) => s.stroke.map((p, i) => `${i ? 'L' : 'M'}${((i / (s.stroke.length - 1)) * (W - 10)).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
        g += `<path d="${path(1)}" fill="none" stroke="${C.mute}" stroke-width="1" opacity=".7"/><path d="${path(0)}" fill="none" stroke="${C.or}" stroke-width="1.6"/>`;
        const last = s.stroke[s.stroke.length - 1];
        g += `<line x1="${W - 10}" x2="${W - 10}" y1="4" y2="${H - 4}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${W - 10}" cy="${Y(last[0]).toFixed(1)}" r="3.4" fill="${C.or}"/>`;
        g += `<text x="0" y="${H - 1}" font-size="7" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">−1.2 S</text><text x="${W - 14}" y="${H - 1}" text-anchor="end" font-size="7" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">NOW</text>`;
        chart.innerHTML = g;
      }
      pb.textContent = `${s.playback.toFixed(1)}×`;
      shutter.textContent = s.blur > 0.5 ? 'SHUTTER 1/60' : 'HI-SPEED 1/2000';
      // power
      batt.innerHTML = `${Math.round(s.battery * 100)}<span style="font-size:13px;color:${C.mute}">%</span>`;
      const bc = Math.round(s.battery * 10);
      battCells.forEach((c, i) => (c.style.background = i < bc ? (i < 2 ? C.or : C.green) : C.track));
      pw[0].textContent = `${s.power.toFixed(1)} W`;
      pw[1].textContent = `${s.volt.toFixed(2)} V`;
      pw[2].textContent = `${s.motorT.toFixed(0)} °C`;
      // leg servos
      chipStyle(legState, s.legsFree ? 'warn' : 'ok', s.legsFree ? 'DETACHED' : 'HOLDING');
      servo.forEach((b, i) => {
        const v = s.servos[i];
        b.f.style.width = `${(v * 178).toFixed(1)}px`;
        const free = s.legFreeEach ? s.legFreeEach[i] : s.legsFree;
        b.f.style.background = v > 0.6 ? C.or : C.ink;
        b.v.textContent = free ? 'DETACHED' : `${Math.round(v * 100)}%`;
        b.v.style.color = free ? C.or : C.ink;
        b.v.style.fontSize = free ? '8.6px' : '11px';
      });
      // flight: the attitude ball (the horizon tilts with roll and slides with pitch) and the numbers
      {
        const r = 44;
        const off = s.pitch * 2.2;
        ball.innerHTML = `<defs><clipPath id="bc"><circle cx="48" cy="48" r="${r}"/></clipPath></defs><circle cx="48" cy="48" r="${r}" fill="#fbf8f3" stroke="${C.faint}"/><g clip-path="url(#bc)"><g transform="rotate(${(-s.roll).toFixed(2)} 48 48) translate(0 ${off.toFixed(2)})"><rect x="-20" y="48" width="136" height="70" fill="${C.track}"/><line x1="-20" x2="116" y1="48" y2="48" stroke="${C.ink}" stroke-width="1"/>${[-20, -10, 10, 20].map((p) => `<line x1="${48 - (Math.abs(p) > 10 ? 12 : 7)}" x2="${48 + (Math.abs(p) > 10 ? 12 : 7)}" y1="${48 - p * 2.2}" y2="${48 - p * 2.2}" stroke="${C.mute}" stroke-width=".8"/>`).join('')}</g></g><path d="M26 48h14l4 5 4-5h22" fill="none" stroke="${C.or}" stroke-width="2"/><circle cx="48" cy="48" r="2" fill="${C.or}"/>`;
        fl[0].textContent = s.airborne ? `${s.alt.toFixed(1)} MM` : '—';
        fl[1].textContent = s.airborne ? `${s.vs >= 0 ? '+' : '−'}${Math.abs(s.vs).toFixed(1)} MM/S` : '—';
        fl[2].textContent = `${s.pitch >= 0 ? '+' : '−'}${Math.abs(s.pitch).toFixed(2)}°`;
        fl[3].textContent = `${s.roll >= 0 ? '+' : '−'}${Math.abs(s.roll).toFixed(2)}°`;
        hold.textContent = s.airborne ? 'POSITION' : 'OFF';
        air.textContent = `${s.airspeed.toFixed(2)} M/S`;
      }
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
