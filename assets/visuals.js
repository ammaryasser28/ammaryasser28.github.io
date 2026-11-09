/* Visuals for the notes site: original illustrations, icons and motion helpers. */
window.Visuals = (() => {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- hero: a small network where one packet is caught ---------- */
  function heroArt() {
    const nodes = [
      { id: 'a', x: 70, y: 70, label: 'Workstation' },
      { id: 'b', x: 70, y: 250, label: 'Laptop' },
      { id: 'c', x: 250, y: 160, label: 'Switch' },
      { id: 'd', x: 430, y: 70, label: 'DC01' },
      { id: 'e', x: 430, y: 250, label: 'Web server' },
    ];
    const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const links = [['a', 'c'], ['b', 'c'], ['c', 'd'], ['c', 'e']];
    const path = (p, q) => `M${at[p].x} ${at[p].y} L${at[q].x} ${at[q].y}`;
    const flows = [
      { d: `${path('a', 'c')} L${at.d.x} ${at.d.y}`, dur: 3.2, delay: 0, cls: 'ok' },
      { d: `${path('b', 'c')} L${at.e.x} ${at.e.y}`, dur: 3.6, delay: 1.1, cls: 'ok' },
      { d: `M${at.e.x} ${at.e.y} L${at.c.x} ${at.c.y} L${at.a.x} ${at.a.y}`, dur: 4, delay: 2, cls: 'ok' },
      { d: `${path('b', 'c')} L${at.d.x} ${at.d.y}`, dur: 2.6, delay: 0.6, cls: 'bad' },
    ];
    return `
    <svg class="hero-art" viewBox="0 0 500 320" role="img" aria-label="Network traffic flowing between hosts, with one suspicious logon flagged at the domain controller">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" class="grid-line"/></pattern>
      </defs>
      <rect width="500" height="320" rx="16" class="art-bg"/>
      <rect width="500" height="320" rx="16" fill="url(#grid)"/>
      ${links.map(([p, q]) => `<path d="${path(p, q)}" class="wire"/>`).join('')}
      ${flows.map((f, i) => `
        <path id="flow${i}" d="${f.d}" fill="none" stroke="none"/>
        <circle r="${f.cls === 'bad' ? 6 : 4.5}" class="packet ${f.cls}">
          <animateMotion dur="${f.dur}s" begin="${f.delay}s" repeatCount="indefinite" rotate="auto"><mpath href="#flow${i}"/></animateMotion>
        </circle>`).join('')}
      ${nodes.map((n) => `
        <g class="node${n.id === 'd' ? ' target' : ''}" transform="translate(${n.x} ${n.y})">
          ${n.id === 'd' ? '<circle r="34" class="ping"/><circle r="34" class="ping late"/>' : ''}
          <rect x="-26" y="-20" width="52" height="40" rx="8" class="box"/>
          <rect x="-16" y="-10" width="32" height="18" rx="2" class="screen"/>
          <text y="38" text-anchor="middle" class="label">${n.label}</text>
        </g>`).join('')}
      <g class="alert" transform="translate(300 18)">
        <rect width="186" height="38" rx="8"/>
        <circle cx="18" cy="19" r="5" class="dot"/>
        <text x="32" y="16" class="t1">Event 4625</text>
        <text x="32" y="30" class="t2">Failed logon detected on DC01</text>
      </g>
    </svg>`;
  }

  /* ---------- one illustration per course ---------- */
  function courseArt(slug) {
    const wrap = (inner, label) => `<svg class="course-art" viewBox="0 0 320 160" role="img" aria-label="${label}"><rect width="320" height="160" class="art-bg"/>${inner}</svg>`;
    if (slug === 'pre-security') {
      const names = ['Application', 'Presentation', 'Session', 'Transport', 'Network', 'Data Link', 'Physical'];
      const bars = names.map((n, i) => `<g transform="translate(70 ${14 + i * 19})"><rect width="180" height="15" rx="3" class="layer" style="--i:${i}"/><text x="8" y="11" class="tiny">${7 - i}  ${n}</text></g>`).join('');
      return wrap(`${bars}<circle r="5" class="packet ok"><animateMotion dur="3.5s" repeatCount="indefinite" path="M262 14 L262 146"/></circle><circle r="5" class="packet ok"><animateMotion dur="3.5s" begin="1.75s" repeatCount="indefinite" path="M58 146 L58 14"/></circle>`, 'The seven layers of the OSI model with packets moving through them');
    }
    if (slug === 'intro') {
      const cells = [];
      const glyphs = '7F3A9C0E51B8D24A6F03C9E7B15D82AF4C60E93B7D18A5F2';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) cells.push(`<text x="${18 + c * 18}" y="${30 + r * 21}" class="cipher" style="--d:${(r * 8 + c) % 7}">${glyphs[(r * 8 + c) % glyphs.length]}</text>`);
      return wrap(`${cells.join('')}
        <g transform="translate(225 80)">
          <rect x="-34" y="-8" width="68" height="54" rx="8" class="lock"/>
          <path d="M-20 -8 V-24 a20 20 0 0 1 40 0 V-8" class="shackle"/>
          <circle cy="14" r="7" class="keyhole"/><rect x="-2.5" y="16" width="5" height="14" rx="2" class="keyhole"/>
        </g>`, 'A padlock beside a grid of hexadecimal ciphertext');
    }
    if (slug === 'essentials') {
      const rings = [62, 48, 34, 20].map((r, i) => `<circle cx="215" cy="80" r="${r}" class="ring" style="--i:${i}"/>`).join('');
      return wrap(`${rings}<path d="M215 66 l11 5 v9 c0 8 -5 13 -11 16 c-6 -3 -11 -8 -11 -16 v-9z" class="shield"/>
        <g class="attack"><path d="M20 80 H130" class="arrow-line"/><path d="M130 80 l-9 -6 v12z" class="arrow-head"/></g>
        <text x="20" y="112" class="tiny">Defense in Depth</text>`, 'An attack arrow stopped by rings of layered defenses around a shield');
    }
    // sec450
    const bars = [18, 26, 20, 30, 24, 22, 92, 28, 21, 25, 19].map((h, i) => `<rect x="${40 + i * 22}" y="${132 - h}" width="14" height="${h}" rx="2" class="${h > 60 ? 'sbar spike' : 'sbar'}" style="--i:${i}"/>`).join('');
    return wrap(`<path d="M30 132 H300" class="axis"/>${bars}
      <g transform="translate(168 18)"><rect width="128" height="24" rx="6" class="alert-chip"/><circle cx="12" cy="12" r="4" class="dot"/><text x="22" y="16" class="tiny strong">Alert: spike at 02:14</text></g>
      <text x="30" y="24" class="tiny">SIEM: logon events / hour</text>`, 'A SIEM chart of logon events with one spike raising an alert');
  }

  /* ---------- wide banner at the top of every note ---------- */
  const BANNER = {
    'pre-security': ['Physical', 'Data Link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'],
    intro: ['Plaintext', 'AES-256', 'RSA', 'SHA-256', 'PKI', 'TLS 1.3', 'Ciphertext'],
    essentials: ['Recon', 'Weaponize', 'Deliver', 'Exploit', 'Install', 'C2', 'Actions'],
    sec450: ['4624', '4625', '4688', '7045', 'Sysmon 1', 'Sysmon 3', 'Alert'],
  };
  function noteBanner(slug) {
    const labels = BANNER[slug] || BANNER.essentials;
    const W = 1200, H = 120, y = 74, step = (W - 160) / (labels.length - 1);
    const xs = labels.map((_, i) => 80 + i * step);
    const hit = labels.length - 2;
    const line = `M${xs[0]} ${y} H${xs[xs.length - 1]}`;
    return `
    <svg class="note-banner" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="bgrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" class="grid-line"/></pattern>
        <linearGradient id="bfade" x1="0" x2="1"><stop offset="0" stop-color="var(--cobalt)" stop-opacity="0"/><stop offset=".5" stop-color="var(--cobalt)" stop-opacity=".9"/><stop offset="1" stop-color="var(--cobalt)" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" class="art-bg"/>
      <rect width="${W}" height="${H}" fill="url(#bgrid)"/>
      <path d="${line}" class="wire"/>
      <rect class="scan" x="-240" y="0" width="240" height="${H}" fill="url(#bfade)" opacity=".12"/>
      <path id="bflow" d="${line}" fill="none" stroke="none"/>
      ${[0, 1.4, 2.8].map((d) => `<circle r="4.5" class="packet ok"><animateMotion dur="4.2s" begin="${d}s" repeatCount="indefinite"><mpath href="#bflow"/></animateMotion></circle>`).join('')}
      <path id="bbad" d="M${xs[0]} ${y} H${xs[hit]}" fill="none" stroke="none"/>
      <circle r="6" class="packet bad"><animateMotion dur="3.6s" begin="1s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.7;1" calcMode="linear"><mpath href="#bbad"/></animateMotion></circle>
      ${labels.map((l, i) => `
        <g transform="translate(${xs[i]} ${y})"><g class="bnode${i === hit ? ' target' : ''}" style="--i:${i}">
          ${i === hit ? '<circle r="22" class="ping"/><circle r="22" class="ping late"/>' : ''}
          <circle r="11" class="bdot"/>
          <circle r="4" class="bcore"/>
          <text y="-22" text-anchor="middle" class="blabel">${l}</text>
        </g></g>`).join('')}
    </svg>`;
  }

  /* ---------- course map: the course's own illustration, built from its topics ---------- */
  function courseMap(slug, units) {
    const n = units.length;
    const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const head = (title, hint) => `<div class="cm-head"><span class="cm-live"></span><b>${title}</b><small>${hint}</small></div>`;
    const item = (u, i, cls, inner) => `<a class="cm-item ${cls}" href="#topic-${i}" data-t="${i}" style="--i:${i};--n:${n}">${inner}</a>`;
    if (slug === 'pre-security') {
      return `<div class="cmap cm-layers" aria-label="Course map">
        ${head('Course stack', `${n} layers, from the first to the last topic`)}
        <div class="cm-body"><span class="cm-packet" aria-hidden="true"></span><span class="cm-packet late" aria-hidden="true"></span>
          ${units.map((u, i) => item(u, i, 'cm-layer', `<span class="cm-no">L${i + 1}</span><span class="cm-name">${e(u.name)}</span><span class="cm-count">${u.count} notes</span>`)).join('')}
        </div></div>`;
    }
    if (slug === 'intro') {
      return `<div class="cmap cm-cipher" aria-label="Course map">
        ${head('Decrypted topics', `${n} blocks. Hover one to decrypt it again`)}
        <div class="cm-body">
          ${units.map((u, i) => item(u, i, 'cm-tile', `<svg class="cm-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="cm-name" data-text="${e(u.name)}">${e(u.name)}</span><span class="cm-count">${u.count} notes</span>`)).join('')}
        </div></div>`;
    }
    if (slug === 'essentials') {
      const R = (i) => 22 + (i + 1) * (88 / n);
      return `<div class="cmap cm-rings" aria-label="Course map">
        ${head('Defense in depth', `${n} layers of defense. Hover one to find its ring`)}
        <div class="cm-body">
          <svg class="cm-ringart" viewBox="-120 -120 240 240" aria-hidden="true">
            ${units.map((u, i) => `<circle r="${R(n - 1 - i).toFixed(1)}" class="cm-ring" data-t="${i}" style="--i:${i}"/>`).join('')}
            <path d="M0 -15 l12 5 v9 c0 9 -5 14 -12 17 c-7 -3 -12 -8 -12 -17 v-9z" class="cm-shield"/>
            <g class="cm-attack"><path d="M-118 0 H-112" class="cm-arrow"/><circle r="4" class="cm-hit"/></g>
          </svg>
          <ol class="cm-legend">${units.map((u, i) => `<li>${item(u, i, 'cm-ringitem', `<span class="cm-dot"></span><span class="cm-name">${e(u.name)}</span><span class="cm-count">${u.count}</span>`)}</li>`).join('')}</ol>
        </div></div>`;
    }
    const max = Math.max(...units.map((u) => u.count));
    return `<div class="cmap cm-siem" aria-label="Course map">
      ${head('Topic volume', `notes per topic, like events per source`)}
      <div class="cm-body"><span class="cm-scan" aria-hidden="true"></span>
        ${units.map((u, i) => item(u, i, `cm-row${u.count === max ? ' peak' : ''}`, `<span class="cm-name">${e(u.name)}</span><span class="cm-track"><i style="--w:${Math.round((u.count / max) * 100)}%"></i></span><span class="cm-count">${u.count}</span>`)).join('')}
      </div></div>`;
  }

  // intro map: each name decrypts from hex when it scrolls in, and again on hover
  function mapFx(root) {
    const names = [...root.querySelectorAll('.cm-cipher .cm-name')];
    if (!names.length || reduce()) return;
    const HEX = '0123456789ABCDEF';
    const run = (el) => {
      const txt = el.dataset.text; let f = 0; const total = 18;
      clearInterval(el._t);
      el._t = setInterval(() => {
        f += 1;
        const keep = Math.floor((f / total) * txt.length);
        el.textContent = txt.split('').map((c, i) => (i < keep || c === ' ' ? c : HEX[(Math.random() * 16) | 0])).join('');
        if (f >= total) { clearInterval(el._t); el.textContent = txt; }
      }, 40);
    };
    const ob = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { names.forEach((el, i) => setTimeout(() => run(el), i * 110)); ob.disconnect(); } }), { threshold: 0.3 });
    ob.observe(root.querySelector('.cm-cipher'));
    names.forEach((el) => el.closest('.cm-item').addEventListener('pointerenter', () => run(el)));
  }

  /* ---------- note header: the course's own animation, with this note's topic lit ---------- */
  function noteMap(slug, units, cur, k, href) {
    const n = units.length, u = units[cur] || units[0];
    const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const link = (i, cls, inner, style = '') => `<a class="nm-i ${cls}${i === cur ? ' cur' : ''}" href="${href(i)}" title="${e(units[i].name)}" style="--i:${i};--n:${n};${style}">${inner}</a>`;
    let art = '', kind = 'siem';
    if (slug === 'pre-security') {
      kind = 'layers';
      art = `<span class="nm-packet"></span><span class="nm-packet late"></span>${units.map((x, i) => link(i, 'nm-layer', `<span><b>L${i + 1}</b>${e(x.name)}</span>`)).join('')}`;
    } else if (slug === 'intro') {
      kind = 'cipher';
      const HEX = '7F3A9C0E51B8D24A6F03C9E7';
      art = units.map((x, i) => link(i, 'nm-tile', i === cur ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' : `<span>${HEX.substr((i * 2) % 22, 2)}</span>`)).join('');
    } else if (slug === 'essentials') {
      kind = 'rings';
      const R = (i) => 12 + (i + 1) * (40 / n);
      art = `<svg viewBox="-60 -60 120 120" aria-hidden="true">${units.map((x, i) => `<circle r="${R(n - 1 - i).toFixed(1)}" class="nm-ring${i === cur ? ' cur' : ''}" style="--i:${i}"><title>${e(x.name)}</title></circle>`).join('')}
        <path d="M0 -8 l7 3 v5 c0 5 -3 8 -7 10 c-4 -2 -7 -5 -7 -10 v-5z" class="nm-shield"/><g class="nm-attack"><path d="M-58 0 H-53" /><circle r="2.5"/></g></svg>
        <span class="nm-legend">${units.map((x, i) => link(i, 'nm-li', `<i></i>${e(x.name)}`)).join('')}</span>`;
    } else {
      const max = Math.max(...units.map((x) => x.count));
      art = `<span class="nm-scan"></span>${units.map((x, i) => link(i, 'nm-bar', `<span>${e(x.name.split(' - ')[0])}</span>`, `--h:${Math.max(30, Math.round((x.count / max) * 100))}%`)).join('')}`;
    }
    const dots = Array.from({ length: u.count }, (_, j) => `<i class="${j < k ? 'done' : j === k ? 'now' : ''}"></i>`).join('');
    return `<div class="note-map nm-${kind}" dir="ltr">
      <div class="nm-art" style="--cols:${n}">${art}</div>
      <div class="nm-info">
        <small>Topic ${cur + 1} of ${n}</small>
        <a class="nm-name" href="${href(cur)}">${e(u.name)}</a>
        <span class="nm-dots" aria-hidden="true">${dots}</span>
        <small>Note ${k + 1} of ${u.count} in this topic</small>
      </div>
    </div>`;
  }

  /* ---------- small line icons ---------- */
  const ICONS = {
    log: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    pyramid: '<path d="M12 3 21 20H3z"/><path d="M7.5 12h9M5.2 16h13.6"/>',
    chain: '<path d="M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 0 1 5.6 5.6l-1.2 1.2"/><path d="M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 0 1-5.6-5.6l1.2-1.2"/>',
    radar: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 18 6"/>',
    sink: '<path d="M4 6h16l-3 12H7z"/><path d="M12 2v8M9 7l3 3 3-3"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    siem: '<path d="M4 18V6M4 18h16"/><path d="M7 15l3-4 3 2 4-6"/>',
  };
  const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.log}</svg>`;

  /* monogram for the sidebar */
  const monogram = () => `
    <svg class="monogram" viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" rx="24" class="mono-bg"/>
      <path d="M48 16 l26 10 v20 c0 17 -11 28 -26 34 c-15 -6 -26 -17 -26 -34 v-20z" class="mono-shield"/>
      <text x="48" y="58" text-anchor="middle" class="mono-text">BY</text>
    </svg>`;

  /* ---------- motion ---------- */
  let io = null;
  function reveal(root) {
    const els = [...root.querySelectorAll('.reveal')];
    if (reduce() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e) => io.observe(e));
  }
  function countUp(root) {
    root.querySelectorAll('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      if (reduce()) { el.textContent = end.toLocaleString('en'); return; }
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(end * e).toLocaleString('en');
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  function tilt(root) {
    if (reduce() || matchMedia('(hover: none)').matches) return;
    root.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    });
  }

  /* reading progress + back to top, shared by every page */
  let chrome = null;
  function pageChrome() {
    if (chrome) return;
    const bar = document.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
    const top = document.createElement('button'); top.className = 'to-top'; top.type = 'button';
    top.setAttribute('aria-label', 'Back to top');
    top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    top.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }));
    document.body.append(bar, top);
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
      top.classList.toggle('show', scrollY > 700);
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    chrome = onScroll;
  }

  function enhance(root) {
    pageChrome();
    root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
    reveal(root); countUp(root); tilt(root);
    chrome && chrome();
  }

  /* ---------- interactive diagrams ---------- */
  const TB = {
    out: '<path d="M5 12h14"/>',
    in: '<path d="M12 5v14M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    full: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  };
  const tbBtn = (k, label) => `<button type="button" data-act="${k}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${TB[k]}</svg></button>`;

  function diagram(fig) {
    if (!fig || fig.dataset.ready) return;
    const svg = fig.querySelector('svg');
    if (!svg) return;
    fig.dataset.ready = '1';
    const vb = svg.viewBox.baseVal;
    const natW = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
    const natH = vb && vb.height ? vb.height : svg.getBoundingClientRect().height;
    svg.style.maxWidth = 'none'; svg.removeAttribute('height');

    // viewport + toolbar
    const port = document.createElement('div'); port.className = 'dg-port';
    const pre = svg.parentElement; pre.replaceWith(port); port.appendChild(svg);
    const bar = document.createElement('div'); bar.className = 'dg-bar';
    const nodeCount = svg.querySelectorAll('g.node').length;
    bar.innerHTML = `<span class="dg-title"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M6 9v3h12V9M12 12v3"/></svg>Diagram${nodeCount ? `<small>${nodeCount} boxes. Hover one to trace its links</small>` : ''}</span>
      <span class="dg-tools"><span class="dg-zoom">100%</span>${tbBtn('out', 'Zoom out')}${tbBtn('in', 'Zoom in')}${tbBtn('fit', 'Fit to width')}${tbBtn('full', 'Full screen')}</span>`;
    fig.prepend(bar);
    const zl = bar.querySelector('.dg-zoom');
    let scale = 1;
    const fitScale = () => Math.min(1, (port.clientWidth - 36) / natW);
    const apply = (s, keepCenter = true) => {
      const cx = port.scrollLeft + port.clientWidth / 2, cy = port.scrollTop + port.clientHeight / 2;
      const ratio = s / scale;
      scale = Math.max(0.2, Math.min(4, s));
      svg.style.width = `${Math.round(natW * scale)}px`;
      svg.style.height = `${Math.round(natH * scale)}px`;
      zl.textContent = `${Math.round(scale * 100)}%`;
      if (keepCenter) { port.scrollLeft = cx * ratio - port.clientWidth / 2; port.scrollTop = cy * ratio - port.clientHeight / 2; }
      fig.classList.toggle('pannable', port.scrollWidth > port.clientWidth + 2 || port.scrollHeight > port.clientHeight + 2);
    };
    // start at natural size, shrunk to fit the column when that keeps the text readable
    const startScale = () => { const f = fitScale(); return f >= 1 ? 1 : Math.max(f, 0.7); };
    apply(startScale(), false);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'in') apply(scale * 1.25);
      else if (act === 'out') apply(scale / 1.25);
      else if (act === 'fit') apply(fitScale(), false);
      else if (act === 'full') {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (fig.requestFullscreen) fig.requestFullscreen().then(() => setTimeout(() => apply(Math.min(2, (port.clientWidth - 40) / natW, (port.clientHeight - 40) / natH), false), 80)).catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fig.dataset.ready) apply(startScale(), false); });
    port.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); apply(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    // drag to pan
    let drag = null;
    port.addEventListener('pointerdown', (e) => {
      if (!fig.classList.contains('pannable') || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, l: port.scrollLeft, t: port.scrollTop }; port.setPointerCapture(e.pointerId); fig.classList.add('dragging');
    });
    port.addEventListener('pointermove', (e) => { if (!drag) return; port.scrollLeft = drag.l - (e.clientX - drag.x); port.scrollTop = drag.t - (e.clientY - drag.y); });
    const end = () => { drag = null; fig.classList.remove('dragging'); };
    port.addEventListener('pointerup', end); port.addEventListener('pointercancel', end);

    // graph: which edges touch which node
    const prefix = `${svg.id}-flowchart-`;
    const nodes = new Map();
    svg.querySelectorAll('g.node').forEach((g) => {
      if (!g.id.startsWith(prefix)) return;
      nodes.set(g.id.slice(prefix.length).replace(/-\d+$/, ''), g);
    });
    const edges = [...svg.querySelectorAll('path.flowchart-link, path[data-edge="true"]')];
    const links = edges.map((p) => {
      const raw = (p.dataset.id || p.id.replace(`${svg.id}-`, '')).replace(/^L_/, '').replace(/_\d+$/, '');
      const parts = raw.split('_');
      for (let k = 1; k < parts.length; k++) {
        const a = parts.slice(0, k).join('_'), b = parts.slice(k).join('_');
        if (nodes.has(a) && nodes.has(b)) return { p, a, b };
      }
      return { p, a: null, b: null };
    });

    // draw-in when the diagram scrolls into view
    if (!reduce() && 'IntersectionObserver' in window && edges.length) {
      fig.classList.add('pre-draw');
      edges.forEach((p, i) => { try { const L = p.getTotalLength(); p.style.setProperty('--len', L); p.style.setProperty('--i', i); } catch (e) { /* not measurable */ } });
      [...nodes.values()].forEach((g, i) => g.style.setProperty('--i', i));
      // start once a good part of the diagram is on screen (a tall one may never be 25% visible)
      const ob = new IntersectionObserver((en) => {
        if (en.some((x) => x.isIntersecting && (x.intersectionRatio >= 0.25 || x.intersectionRect.height >= innerHeight * 0.35))) { fig.classList.add('drawn'); ob.disconnect(); setTimeout(() => fig.classList.remove('pre-draw', 'drawn'), 2600); }
      }, { threshold: [0, 0.1, 0.25, 0.5] });
      ob.observe(fig);
    }

    // hover a node: light it, its neighbours and the edges between them
    if (nodes.size) {
      const clear = () => { fig.classList.remove('focus'); svg.querySelectorAll('.hl').forEach((x) => x.classList.remove('hl')); svg.querySelectorAll('.flow').forEach((x) => x.classList.remove('flow', 'rev')); };
      svg.addEventListener('pointerover', (e) => {
        const g = e.target.closest('g.node'); if (!g) return;
        const name = [...nodes].find(([, v]) => v === g)?.[0]; if (!name) return;
        clear(); fig.classList.add('focus'); g.classList.add('hl');
        links.forEach(({ p, a, b }) => {
          if (a === name || b === name) {
            p.classList.add('hl', 'flow'); if (b === name) p.classList.add('rev');
            nodes.get(a === name ? b : a)?.classList.add('hl');
          }
        });
      });
      svg.addEventListener('pointerleave', clear);
      svg.addEventListener('pointerout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('g.node')) { if (!e.target.closest('g.node')) return; clear(); } });
      fig.classList.add('interactive');
    }
  }

  return { heroArt, courseArt, noteBanner, noteMap, courseMap, mapFx, icon, monogram, enhance, diagram, reveal };
})();
