// The green page around a creature, in the look of a model-launch blog (first made for longcat/wasp, Vespera-07): white
// paper with mint haze in the top corners, a wordmark, a centred title with a green rule and a row of pill buttons the
// operator's cursor presses, a section list on the left that follows the act, white metric cards on the right, labels
// as soft cards with leader lines. Shared by every creature's green film; what changes per creature (name, title, the
// acts and their notes) comes in as options. 1600 x 900 layout px. update(s) redraws every live part from one frame.
export const VIEWPORT = {x0: 250, x1: 1320, y0: 236, y1: 836};
export const REST = [1250, 272];
export const GREEN = '#16b364';

const CSS = `
#app{width:1600px!important;height:900px!important;inset:auto!important;left:0;top:0;transform-origin:0 0;background:#fff}
.vp{position:absolute;inset:0;pointer-events:none;font-family:'Inter',system-ui,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased}
.vp *{box-sizing:border-box}
.vp .haze{position:absolute;inset:0;mix-blend-mode:multiply;background:
  radial-gradient(520px 360px at 60px -40px, rgba(22,179,100,.16), rgba(22,179,100,0) 70%),
  radial-gradient(620px 420px at 1600px 20px, rgba(22,179,100,.14), rgba(22,179,100,0) 70%)}
.vp .dots{position:absolute;right:0;top:0;width:420px;height:300px;opacity:.5;mix-blend-mode:multiply;
  background-image:radial-gradient(rgba(22,179,100,.35) 1px, transparent 1.4px);background-size:9px 9px;
  -webkit-mask-image:radial-gradient(360px 240px at 100% 0%, #000, transparent 75%);mask-image:radial-gradient(360px 240px at 100% 0%, #000, transparent 75%)}
.vp .logo{position:absolute;left:46px;top:22px;display:flex;align-items:center;gap:10px;font:800 23px/1 'Inter',sans-serif;letter-spacing:-.3px}
.vp .logo i{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#22c55e,#0e9f55);position:relative;display:block}
.vp .logo i:after{content:'';position:absolute;left:8px;top:8px;width:14px;height:14px;border:3px solid #fff;border-radius:50%;border-right-color:transparent}
.vp .lang{position:absolute;right:46px;top:20px;height:32px;padding:0 14px;border:1px solid #e2e8f0;border-radius:16px;display:flex;align-items:center;gap:8px;font:600 13px/1 'Inter',sans-serif;background:#fff}
.vp .lang b{width:8px;height:8px;border-radius:50%;background:${GREEN};display:block;box-shadow:0 0 0 4px rgba(22,179,100,.15)}
.vp .head{position:absolute;left:0;right:0;top:52px;text-align:center}
.vp .head .ver{font:800 22px/1 'Inter',sans-serif;letter-spacing:-.3px}
.vp .head .ver em{font-style:normal;color:${GREEN}}
.vp .head h1{margin:10px 0 0;font:800 36px/1.05 'Inter',sans-serif;letter-spacing:-.8px}
.vp .head .rule{width:84px;height:4px;border-radius:3px;margin:12px auto 0;background:linear-gradient(90deg,rgba(22,179,100,0),${GREEN} 30%,${GREEN} 70%,rgba(22,179,100,0))}
.vp .head .date{margin-top:9px;font:500 13px/1 'Inter',sans-serif;color:#64748b}
.vp .pills{position:absolute;left:0;right:0;top:180px;display:flex;justify-content:center;gap:10px}
.vp .pill{height:34px;padding:0 15px;border:1px solid #e2e8f0;border-radius:17px;background:#fff;display:flex;align-items:center;gap:8px;font:600 13px/1 'Inter',sans-serif;color:#334155;transition:none}
.vp .pill i{width:15px;height:15px;border-radius:50%;border:1.6px solid #94a3b8;display:block;position:relative}
.vp .pill i:after{content:'';position:absolute;left:4px;top:3px;border-left:5px solid #94a3b8;border-top:3.5px solid transparent;border-bottom:3.5px solid transparent}
.vp .pill.on{border-color:${GREEN};background:#effbf4;color:#0b7a43}
.vp .pill.on i{border-color:${GREEN}}
.vp .pill.on i:after{border-left-color:${GREEN}}
.vp .pill.press{transform:scale(.95)}
.vp .nav{position:absolute;left:58px;top:300px;width:190px;border-left:1.5px solid #e2e8f0;padding-left:0}
.vp .nav div{position:relative;padding:7px 0 7px 18px;font:500 15px/1.2 'Inter',sans-serif;color:#94a3b8}
.vp .nav div.on{color:#0f172a;font-weight:700}
.vp .nav div.on:before{content:'';position:absolute;left:-2px;top:7px;bottom:7px;width:3px;border-radius:2px;background:#0f172a}
.vp .nav div.sub{padding:4px 0 4px 30px;font:500 12.5px/1.2 'Inter',sans-serif;color:#64748b}
.vp .cards{position:absolute;left:1340px;top:290px;width:220px;display:flex;flex-direction:column;gap:12px}
.vp .card{background:rgba(255,255,255,.92);border:1px solid #e8edf3;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 6px 18px rgba(15,23,42,.05)}
.vp .card .k{font:600 11px/1 'Inter',sans-serif;letter-spacing:.6px;text-transform:uppercase;color:#64748b}
.vp .card .v{margin-top:8px;font:800 28px/1 'Inter',sans-serif;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.vp .card .v small{font-size:14px;font-weight:600;color:#64748b;margin-left:4px}
.vp .card svg{display:block;margin-top:8px}
.vp .bar{height:6px;border-radius:3px;background:#edf2f7;margin-top:10px;overflow:hidden}
.vp .bar b{display:block;height:100%;background:${GREEN};border-radius:3px}
.vp .servos{display:flex;gap:6px;align-items:flex-end;height:46px;margin-top:10px}
.vp .servos b{flex:1;background:${GREEN};border-radius:3px 3px 1px 1px;opacity:.9}
.vp .foot{position:absolute;left:262px;right:280px;top:852px;display:flex;align-items:center;gap:14px}
.vp .foot .st{height:28px;padding:0 12px;border-radius:14px;background:#effbf4;color:#0b7a43;font:600 12.5px/28px 'Inter',sans-serif;white-space:nowrap;display:flex;align-items:center;gap:7px}
.vp .foot .st b{width:7px;height:7px;border-radius:50%;background:${GREEN};display:block}
.vp .foot .track{flex:1;height:3px;border-radius:2px;background:#e2e8f0;position:relative}
.vp .foot .track b{position:absolute;left:0;top:0;bottom:0;background:${GREEN};border-radius:2px}
.vp .foot .tm{font:600 12.5px/1 'Inter',sans-serif;color:#64748b;font-variant-numeric:tabular-nums}
.vp svg.lines{position:absolute;left:0;top:0;width:1600px;height:900px;overflow:visible}
.vp .lab{position:absolute;padding:8px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 14px rgba(15,23,42,.08);white-space:nowrap}
.vp .lab b{display:block;font:700 13.5px/1.15 'Inter',sans-serif;color:#0f172a}
.vp .lab span{display:block;margin-top:3px;font:500 11.5px/1.1 'Inter',sans-serif;color:#64748b}
.vp .cur{position:absolute;left:0;top:0;width:26px;height:26px}
.vp .ring{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:2px solid ${GREEN}}
`;

export function createConsole(app, opts) {
  const {name, code, title, date} = opts;
  // the 4 cards: a value with a trace ('wave'), a value with a bar ('bar') or a row of load bars ('bars'); a plain
  // title string keeps the flying creatures' set (wingbeat, lift, servo load, battery)
  const KIND = ['wave', 'bar', 'bars', 'bar'];
  const UNIT = ['Hz', '%', '', '%'];
  const CARDS = (opts.cards ?? ['Wingbeat', 'Lift', 'Servo load', 'Battery']).map((c, i) => (typeof c === 'string' ? {k: c, kind: KIND[i], unit: UNIT[i], n: 6} : {n: 6, unit: '', ...c}));
  const cardHtml = (c, i) =>
    c.kind === 'wave'
      ? `<div class="card"><div class="k">${c.k}</div><div class="v" data-c="${i}">0<small>${c.unit}</small></div><svg width="188" height="38" viewBox="0 0 188 38"><path data-w="${i}" fill="none" stroke="${GREEN}" stroke-width="2" stroke-linejoin="round"/></svg></div>`
      : c.kind === 'bars'
        ? `<div class="card"><div class="k">${c.k}</div><div class="servos" data-s="${i}">${'<b></b>'.repeat(c.n)}</div></div>`
        : `<div class="card"><div class="k">${c.k}</div><div class="v" data-c="${i}">0<small>${c.unit}</small></div><div class="bar"><b data-b="${i}"></b></div></div>`;
  const NAV = opts.nav;
  const SUB = opts.sub;
  const PILLS = opts.pills;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  const root = document.createElement('div');
  root.className = 'vp';
  root.innerHTML = `
    <div class="haze"></div><div class="dots"></div>
    <div class="logo"><i></i>${name}</div>
    <div class="lang"><b></b>Live sim</div>
    <div class="head"><div class="ver">${name} <em>${code}</em></div><h1>${title}</h1><div class="rule"></div><div class="date">${date}</div></div>
    <div class="pills">${PILLS.map(([k, t]) => `<div class="pill" data-p="${k}"><i></i>${t}</div>`).join('')}</div>
    <div class="nav"></div>
    <div class="cards">${CARDS.map(cardHtml).join('')}
    </div>
    <div class="foot"><div class="st"><b></b><span data-v="status">Banking in</span></div><div class="track"><b data-v="prog"></b></div><div class="tm" data-v="time">00:00.0</div></div>
    <svg class="lines"></svg>
    <div class="labs"></div>
    <div class="ring" style="opacity:0"></div>
    <svg class="cur" viewBox="0 0 26 26" style="display:none"><path d="M3 2 L3 22 L8.5 17 L12.5 25 L16 23.4 L12 15.5 L19 15.5 Z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  app.appendChild(root);
  const $ = (q) => root.querySelector(q);
  const V = Object.fromEntries([...root.querySelectorAll('[data-v]')].map((e) => [e.dataset.v, e]));
  const pills = Object.fromEntries([...root.querySelectorAll('[data-p]')].map((e) => [e.dataset.p, e]));
  const cardV = CARDS.map((c, i) => root.querySelector(`[data-c="${i}"]`));
  const cardW = CARDS.map((c, i) => root.querySelector(`[data-w="${i}"]`));
  const cardB = CARDS.map((c, i) => root.querySelector(`[data-b="${i}"]`));
  const cardS = CARDS.map((c, i) => [...root.querySelectorAll(`[data-s="${i}"] b`)]);
  const nav = $('.nav');
  const lines = $('svg.lines');
  const labs = $('.labs');
  const cur = $('.cur');
  const ring = $('.ring');
  const spots = Object.fromEntries(Object.entries(pills).map(([k, e]) => [k, [e.offsetLeft + e.parentElement.offsetLeft + e.offsetWidth * 0.42, e.offsetTop + e.parentElement.offsetTop + e.offsetHeight * 0.58]]));
  let lastNav = '';
  const pool = [];
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');

  return {
    root,
    spots,
    pills,
    update(s) {
      // pills and the section list follow the act
      for (const [k, e] of Object.entries(pills)) e.classList.toggle('on', k === s.view);
      if (s.view !== lastNav) {
        lastNav = s.view;
        nav.innerHTML = NAV.map(([k, t]) => (k === s.view ? `<div class="on">${t}</div>${(SUB[k] ?? []).map((x) => `<div class="sub">${x}</div>`).join('')}` : `<div>${t}</div>`)).join('');
      }
      // cards: s.cards [{v, wave (-1..1) | bar (0..1) | bars (0..1 each)}], or the flying creatures' fields
      const cards = s.cards ?? [
        {v: s.freq.toFixed(1), wave: s.stroke.map((a) => a / 32)},
        {v: Math.round(Math.min(1, s.lift) * 100), bar: Math.min(1, s.lift)},
        {bars: s.servos},
        {v: Math.round(s.battery * 100), bar: s.battery},
      ];
      cards.forEach((c, i) => {
        if (cardV[i]) cardV[i].innerHTML = `${c.v}<small>${CARDS[i].unit}</small>`;
        if (cardW[i] && c.wave) cardW[i].setAttribute('d', `M${c.wave.map((a, j) => `${((j / (c.wave.length - 1)) * 188).toFixed(1)},${(19 - Math.max(-1, Math.min(1, a)) * 15).toFixed(1)}`).join(' L')}`);
        if (cardB[i]) cardB[i].style.width = `${Math.round(Math.max(0, Math.min(1, c.bar ?? 0)) * 100)}%`;
        cardS[i].forEach((e, j) => (e.style.height = `${Math.round(8 + 38 * Math.max(0, Math.min(1, c.bars?.[j] ?? 0)))}px`));
      });
      V.status.textContent = s.status + (s.apart > 2 && s.status !== 'Hovering' ? ` · ${s.apart}% apart` : '');
      V.prog.style.width = `${Math.min(100, (s.time / s.dur) * 100)}%`;
      V.time.textContent = `00:${pad(s.time)}.${Math.floor((s.time % 1) * 10)}`;
      // labels
      let path = '';
      (s.callouts || []).forEach((c, i) => {
        let el = pool[i];
        if (!el) {
          el = document.createElement('div');
          el.className = 'lab';
          labs.appendChild(el);
          pool[i] = el;
        }
        el.style.display = 'block';
        el.style.opacity = String(c.o);
        el.innerHTML = `<b>${c.name}</b><span>${c.sub}</span>`;
        const w = el.offsetWidth;
        const left = c.w === 'l' ? c.label[0] : c.label[0] - w;
        el.style.left = `${left}px`;
        el.style.top = `${c.label[1]}px`;
        const ex = c.w === 'l' ? left + w : left;
        const ey = c.label[1] + 21;
        const k = Math.min(1, c.o * 1.2);
        const ax = ex + (c.at[0] - ex) * k;
        const ay = ey + (c.at[1] - ey) * k;
        path += `<path d="M${ex} ${ey} L${(ex + ax) / 2} ${ey} L${ax} ${ay}" stroke="rgba(100,116,139,${0.8 * c.o})" stroke-width="1.3" fill="none"/><circle cx="${c.at[0]}" cy="${c.at[1]}" r="${4.5 * k}" fill="${GREEN}" fill-opacity="${c.o}" stroke="#fff" stroke-width="1.5"/>`;
      });
      for (let i = (s.callouts || []).length; i < pool.length; i++) pool[i].style.display = 'none';
      lines.innerHTML = path;
      // cursor
      const c = s.cursor;
      if (c) {
        cur.style.display = 'block';
        cur.style.transform = `translate(${c.x - 3}px, ${c.y - 2}px) scale(${c.press ? 0.86 : 1})`;
        ring.style.opacity = String(c.ring * 0.9);
        ring.style.left = `${c.ringX}px`;
        ring.style.top = `${c.ringY}px`;
        ring.style.transform = `scale(${0.45 + (1 - c.ring) * 0.9})`;
        for (const [k, e] of Object.entries(pills)) e.classList.toggle('press', c.press && Math.hypot(spots[k][0] - c.x, spots[k][1] - c.y) < 40);
      } else cur.style.display = 'none';
    },
  };
}
