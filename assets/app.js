(() => {
  'use strict';

  const main = document.getElementById('main');
  const navEl = document.getElementById('nav');
  const RAW = 'https://raw.githubusercontent.com';
  const PHOTO = 'https://github.com/ammaryasser28.png?size=240';
  let DATA = null;
  let INDEX = [];
  const noteCache = new Map();
  const V = window.Visuals;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (path) => path.split('/').map(encodeURIComponent).join('/');
  const minutes = (w) => Math.max(1, Math.round(w / 200));
  const trackBy = (slug) => DATA.tracks.find((t) => t.slug === slug);
  const noteHref = (t, path) => `?t=${t.slug}&n=${encodeURIComponent(path)}`;
  const flatNotes = (t) => t.sections.flatMap((s) => s.notes.map((n) => ({ ...n, section: s.name })));
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reading progress, kept in this browser ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('btn:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('btn:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const readSet = new Set(store.get('read', []));
  const key = (t, path) => `${t.slug}|${path}`;
  const isRead = (t, path) => readSet.has(key(t, path));
  const readCount = (t) => flatNotes(t).filter((n) => isRead(t, n.path)).length;
  function markRead(t, path) {
    if (isRead(t, path)) return;
    readSet.add(key(t, path));
    store.set('read', [...readSet]);
    renderNav();
    const chip = document.getElementById('read-chip');
    if (chip) { chip.textContent = 'Read'; chip.classList.add('done', 'pop'); }
  }

  function buildIndex() {
    INDEX = DATA.tracks.flatMap((t) => flatNotes(t).map((n) => ({
      track: t, note: n, hay: [n.title, n.section, ...n.sub, t.name].join(' ').toLowerCase(),
    })));
  }

  /* ---------- icons ---------- */
  const I = {
    home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    linkedin: '<path d="M4 9h3v11H4zM5.5 4.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM10 9h3v1.6c.6-1 1.7-1.8 3.3-1.8 3 0 3.7 2 3.7 4.6V20h-3v-5.8c0-1.4-.3-2.6-1.8-2.6s-2.2 1.1-2.2 2.6V20h-3z"/>',
    mail: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    chev: '<path d="m15 6-6 6 6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    diagram: '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M6 9v3h12V9M12 12v3"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V4M4 13h4M16 13h4M5 8l3 2M19 8l-3 2M5 19l3-2M19 19l-3-2"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    net: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    log: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    shield: '<path d="M12 3 19 6v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  };
  const ic = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
  const avatar = (cls) => `<span class="avatar ${cls}"><img src="${PHOTO}" alt="Bn Yasser" loading="lazy" onerror="this.parentElement.classList.add('fallback');this.remove()"><span class="avatar-fb" aria-hidden="true">BY</span></span>`;

  /* ---------- shell: sidebar ---------- */
  function renderNav() {
    if (!DATA) return;
    const p = new URLSearchParams(location.search);
    const cur = p.get('t'), curNote = p.get('n');
    const onHome = !cur;
    navEl.innerHTML = `
      <div class="nav-top">
        <a class="brand" href="./">${V.monogram()}<span class="brand-text">Blue Team Notes<small>by Bn Yasser</small></span></a>
        <button class="collapse" type="button" aria-label="Collapse the sidebar" title="Collapse the sidebar">${ic('chev')}</button>
      </div>
      <nav class="nav-scroll" aria-label="Site">
        <p class="nav-label">Main</p>
        <a class="nav-item${onHome ? ' active' : ''}" href="./">${ic('home')}<span>Dashboard</span></a>
        <a class="nav-item" href="./#picks">${ic('star')}<span>Start here</span></a>
        <button class="nav-item" type="button" data-focus-search>${ic('search')}<span>Search notes</span><kbd>/</kbd></button>
        <p class="nav-label">Courses</p>
        ${DATA.tracks.map((t, i) => {
          const done = readCount(t), pct = Math.round((done / t.count) * 100);
          const open = t.slug === cur;
          return `
          <a class="nav-item course-item${open ? ' active' : ''}" data-c="${t.slug}" href="?t=${t.slug}" title="${esc(t.name)}">
            <span class="num">${i + 1}</span>
            <span class="ci-text"><span>${esc(t.name)}</span><span class="mini-bar"><i style="width:${pct}%"></i></span></span>
            <span class="ci-count">${done}/${t.count}</span>
          </a>
          ${open ? `<div class="tree">${t.sections.map((s) => `
            <p class="tree-sec">${esc(s.name)}</p>
            ${s.notes.map((n) => `<a class="tree-item${n.path === curNote ? ' current' : ''}${isRead(t, n.path) ? ' read' : ''}" href="${noteHref(t, n.path)}">
              <span class="dot">${ic('check', 'tick')}</span><span>${esc([...n.sub, n.title].join(' / '))}</span></a>`).join('')}`).join('')}
          </div>` : ''}`;
        }).join('')}
        <p class="nav-label">Explore</p>
        <a class="nav-item" href="https://github.com/ammaryasser28" rel="noopener" target="_blank">${ic('github')}<span>GitHub</span></a>
        <a class="nav-item" href="https://www.linkedin.com/in/bn-yasser-424bb4215/" rel="noopener" target="_blank">${ic('linkedin')}<span>LinkedIn</span></a>
      </nav>
      <a class="nav-me" href="./#about">${avatar('sm')}<span><b>Bn Yasser</b><small>SOC Analyst</small></span></a>`;
    navEl.querySelector('.collapse').addEventListener('click', () => {
      const c = document.body.classList.toggle('nav-collapsed');
      store.set('collapsed', c);
    });
    navEl.querySelector('[data-focus-search]').addEventListener('click', () => { closeNav(); document.getElementById('q').focus(); });
    const curItem = navEl.querySelector('.tree-item.current');
    if (curItem) curItem.scrollIntoView({ block: 'center' });
  }
  if (store.get('collapsed', false)) document.body.classList.add('nav-collapsed');
  const closeNav = () => document.body.classList.remove('nav-open');
  document.getElementById('menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.getElementById('scrim').addEventListener('click', closeNav);

  /* ---------- theme ---------- */
  document.querySelector('.theme').addEventListener('click', () => {
    const root = document.documentElement;
    const curT = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = curT === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    if (DATA && new URLSearchParams(location.search).get('n') && document.querySelector('.diagram')) {
      const y = scrollY; route(); setTimeout(() => scrollTo(0, y), 60);
    }
  });

  /* ---------- routing ---------- */
  function go(href) { history.pushState({}, '', new URL(href, location.href)); route(); }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    e.preventDefault();
    closeNav();
    if (url.search === location.search && url.hash) { scrollToHash(url.hash); history.replaceState({}, '', url); return; }
    go(url.href);
  });
  addEventListener('popstate', () => route());

  function scrollToHash(hash) {
    if (!hash) return;
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    if (el && el.classList.contains('topic')) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  // visit counter (GoatCounter): one hit per page, also for in-site navigation
  let tracked = '';
  function track() {
    const path = location.pathname + location.search;
    if (path === tracked) return;
    const send = () => {
      const gc = window.goatcounter;
      if (!gc || !gc.count) return false;
      tracked = path;
      try { gc.count({ path, title: document.title }); } catch (e) { /* blocked or offline */ }
      return true;
    };
    if (!send()) { let n = 0; const t = setInterval(() => { if (send() || ++n > 20) clearInterval(t); }, 500); }
  }

  function route() {
    setTimeout(track, 0);
    const p = new URLSearchParams(location.search);
    const t = p.get('t') && trackBy(p.get('t'));
    const n = p.get('n');
    renderNav();
    if (t && n) return renderNote(t, n);
    if (t) return renderTrack(t);
    if (p.get('t')) return renderMissing();
    renderHome();
  }
  function setTitle(s) { document.title = s ? `${s} | Bn Yasser` : 'Bn Yasser | Blue Team Notes'; }

  /* ---------- home ---------- */
  const PICKS = [
    { t: 'sec450', n: '450.3 - Understanding Hosts, Logs, and Files/Interpreting Important Events.md', icon: 'log', hook: 'The Windows and Linux events an analyst reads every shift: 4624, 4625, 4688, 7045 and Kerberos.' },
    { t: 'essentials', n: 'Security Framework/MITRE ATT&CK Framework.md', icon: 'grid', hook: 'Tactics, techniques and procedures, and how the matrix describes a real intrusion.' },
    { t: 'essentials', n: 'Pyramid of Pain.md', icon: 'pyramid', hook: 'Why blocking a hash barely slows an attacker down, and blocking their behaviour does.' },
    { t: 'essentials', n: 'Security Framework/Cyber Kill Chain.md', icon: 'chain', hook: 'The seven phases of an attack and where a SOC can break the chain.' },
    { t: 'sec450', n: '450.1 - Blue Team Tools and Operation /SIEM and Automation.md', icon: 'siem', hook: 'What a SIEM collects, how correlation turns events into alerts, and where automation helps.' },
    { t: 'essentials', n: 'Log-Analysis-and-Digital-Forensics/impossible-travel-and-vpn-detection.md', icon: 'globe', hook: 'One account logging in from two countries an hour apart, and how to rule out the VPN.' },
    { t: 'intro', n: 'DNS/DNS Sinkhole.md', icon: 'sink', hook: 'Redirecting malicious domains to a safe address so infected hosts reveal themselves.' },
    { t: 'essentials', n: 'SOC Analyst Fundamentals.md', icon: 'radar', hook: 'The tiers, the alert queue and the daily work of a SOC analyst.' },
  ];
  const pickList = () => PICKS.map((p) => ({ ...p, track: trackBy(p.t) }))
    .filter((p) => p.track && flatNotes(p.track).some((x) => x.path === p.n))
    .map((p) => ({ ...p, note: flatNotes(p.track).find((x) => x.path === p.n) }));

  function renderHome() {
    setTitle('');
    const total = DATA.tracks.reduce((a, t) => a + t.count, 0);
    const hours = Math.round(DATA.tracks.reduce((a, t) => a + t.words, 0) / 200 / 60);
    const readTotal = DATA.tracks.reduce((a, t) => a + readCount(t), 0);
    const picks = pickList();
    const last = store.get('last', null);
    const lastT = last && trackBy(last.t);
    const lastN = lastT && flatNotes(lastT).find((n) => n.path === last.n);
    const next = lastN ? { t: lastT, n: lastN } : { t: picks[0].track, n: picks[0].note };

    main.innerHTML = `
    <div class="page home3">
      <section class="welcome profile reveal" id="about">
        <div class="profile-bg" aria-hidden="true"><span class="beam"></span><span class="beam b2"></span></div>
        <div class="welcome-me">
          ${avatar('xl')}
          <div class="welcome-text">
            <p class="hello">Welcome, I'm</p>
            <h1>Bn Yasser</h1>
            <p class="role">SOC Analyst</p>
            <p class="tagline">Documenting everything I learn in blue team, so others can learn it faster.</p>
            <p class="bio">${total} notes from four security courses, from networking basics to SANS SEC450. I build hands-on SOC labs and write up everything I study, so it can be read again before an investigation or an interview.</p>
            <div class="actions">
              <a class="btn primary" href="${noteHref(next.t, next.n.path)}">${ic('book')}${lastN ? 'Continue reading' : 'Start reading'}</a>
              <a class="btn" href="https://github.com/ammaryasser28" target="_blank" rel="noopener">${ic('github')}GitHub</a>
              <a class="btn" href="https://www.linkedin.com/in/bn-yasser-424bb4215/" target="_blank" rel="noopener">${ic('linkedin')}LinkedIn</a>
              <a class="btn icon-only" href="mailto:amry02077@gmail.com" aria-label="Send an email">${ic('mail')}</a>
            </div>
          </div>
          <aside class="focus" aria-label="What the notes cover">
            <p class="focus-h">What I write about</p>
            <ul>${['SIEM and detection', 'Windows and Linux logs', 'Active Directory', 'MITRE ATT&CK', 'Network traffic', 'Incident response', 'Cryptography', 'Zero Trust'].map((f, k) => `<li style="--k:${k}">${esc(f)}</li>`).join('')}</ul>
          </aside>
        </div>
      </section>

      <section class="stat-row" aria-label="Site at a glance">
        ${[['notes', 'Notes', total], ['layers', 'Courses', DATA.tracks.length], ['diagram', 'Diagrams', 658], ['clock', 'Hours of reading', hours]].map(([i, l, v], k) => `
          <div class="stat reveal" style="--d:${k}"><span class="stat-ico">${ic(i)}</span><span><small>${l}</small><b data-count="${v}">${v}</b></span></div>`).join('')}
      </section>

      <section class="duo">
        <div class="panel reveal continue">
          <div class="panel-head"><span class="panel-ico">${ic('book')}</span><div><h2>${lastN ? 'Continue where you stopped' : 'Where to begin'}</h2><p>${lastN ? 'Your last note in this browser' : 'The note most analysts reach for first'}</p></div></div>
          <a class="continue-card" data-c="${next.t.slug}" href="${noteHref(next.t, next.n.path)}">
            <span class="cc-art">${V.courseArt(next.t.slug)}</span>
            <span class="cc-text"><small>${esc(next.t.name)} / ${esc(next.n.section)}</small><b>${esc(next.n.title)}</b><span>${minutes(next.n.words)} min read</span></span>
            <span class="cc-go">${ic('chev')}</span>
          </a>
          ${(() => { const all = flatNotes(next.t); const k = all.findIndex((x) => x.path === next.n.path); const up = all.slice(k + 1, k + 4); return up.length ? `
          <p class="up-h">Up next in ${esc(next.t.name)}</p>
          <ol class="up-next" data-c="${next.t.slug}">${up.map((u, j) => `<li><a href="${noteHref(next.t, u.path)}"${isRead(next.t, u.path) ? ' class="read"' : ''}><span class="idx">${String(k + j + 2).padStart(2, '0')}</span><span class="c-title">${esc(u.title)}</span><small>${minutes(u.words || 200)} min</small></a></li>`).join('')}</ol>` : ''; })()}
        </div>
        <div class="panel reveal progress-panel" style="--d:1">
          <div class="panel-head"><span class="panel-ico">${ic('check')}</span><div><h2>Your progress</h2><p>${readTotal ? `${readTotal} of ${total} notes read` : 'Notes you finish are ticked off here'}</p></div></div>
          <ul class="bars">${DATA.tracks.map((t) => { const d = readCount(t), pct = Math.round((d / t.count) * 100); return `
            <li><a href="?t=${t.slug}"><span class="bar-top"><span>${esc(t.name)}</span><span>${d}/${t.count}</span></span><span class="pbar"><i style="--w:${pct}%"></i></span></a></li>`; }).join('')}</ul>
          <p class="fine">Saved in this browser only.</p>
        </div>
      </section>

      <section class="block" id="picks" aria-labelledby="picks-h">
        <div class="section-head reveal"><h2 id="picks-h">Start here</h2><p>Eight notes worth reading first.</p></div>
        <div class="picks">
          ${picks.map((p, i) => `
            <a class="pick tilt reveal${isRead(p.track, p.n) ? ' is-read' : ''}" data-c="${p.track.slug}" style="--d:${i % 4}" href="${noteHref(p.track, p.n)}">
              <span class="pick-ico">${V.icon(p.icon)}</span>
              <span class="pick-course">${esc(p.track.name)}</span>
              <strong>${esc(p.note.title)}</strong>
              <span class="pick-hook">${esc(p.hook)}</span>
              <span class="pick-time">${isRead(p.track, p.n) ? `${ic('check')}Read` : `${minutes(p.note.words)} min read`}</span>
            </a>`).join('')}
        </div>
      </section>

      <section class="block" id="courses" aria-labelledby="courses-h">
        <div class="section-head reveal"><h2 id="courses-h">Courses, in reading order</h2><p>Each one builds on the one before it.</p></div>
        <ol class="courses">
          ${DATA.tracks.map((t, i) => { const d = readCount(t); return `
            <li class="reveal" style="--d:${i}"><a class="course tilt" data-c="${t.slug}" href="?t=${t.slug}">
              <div class="course-visual">${V.courseArt(t.slug)}<span class="course-step">${i + 1}</span></div>
              <div class="course-body">
                <h3>${esc(t.name)}</h3>
                <span class="ar" dir="rtl" lang="ar">${esc(t.ar)}</span>
                <p>${esc(t.blurb)}</p>
                <span class="pbar thin"><i style="--w:${Math.round((d / t.count) * 100)}%"></i></span>
                <div class="course-meta"><span><b>${d}</b> of ${t.count} read</span><span>About ${Math.round(t.words / 200 / 60)} hours</span>${t.status ? '<span class="status">In progress</span>' : ''}</div>
              </div>
            </a></li>`; }).join('')}
        </ol>
      </section>
    </div>`;
    V.enhance(main);
    if (location.hash) setTimeout(() => scrollToHash(location.hash), 50); else scrollTo(0, 0);
  }

  /* ---------- search (top bar, every page) ---------- */
  (function wireSearch() {
    const input = document.getElementById('q');
    const list = document.getElementById('results');
    let hits = [], sel = -1;
    const mark = (text, words) => {
      let out = esc(text);
      words.forEach((w) => {
        if (!w) return;
        const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;')})`, 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    };
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      if (!q || !DATA) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      const words = q.split(/\s+/);
      hits = INDEX.filter((x) => words.every((w) => x.hay.includes(w)))
        .sort((a, b) => (b.note.title.toLowerCase().includes(q) - a.note.title.toLowerCase().includes(q))).slice(0, 10);
      sel = hits.length ? 0 : -1;
      list.innerHTML = hits.length
        ? hits.map((h, i) => `<li role="option" id="r${i}" aria-selected="${i === sel}"><a href="${noteHref(h.track, h.note.path)}">
            <span class="r-title">${mark(h.note.title, words)}${isRead(h.track, h.note.path) ? `<span class="r-read">${ic('check')}</span>` : ''}</span>
            <small>${esc(h.track.name)} / ${esc(h.note.section)}</small></a></li>`).join('')
        : `<li class="none">No note title matches "${esc(input.value.trim())}". Try a shorter word, like "DNS" or "hash".</li>`;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-activedescendant', sel >= 0 ? 'r0' : '');
    };
    const move = (d) => {
      if (!hits.length) return;
      sel = (sel + d + hits.length) % hits.length;
      [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === sel));
      input.setAttribute('aria-activedescendant', `r${sel}`);
    };
    input.addEventListener('input', draw);
    input.addEventListener('focus', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); list.hidden = true; input.blur(); go(noteHref(hits[sel].track, hits[sel].note.path)); }
      else if (e.key === 'Escape') { input.value = ''; draw(); input.blur(); }
    });
    list.addEventListener('click', () => { list.hidden = true; input.value = ''; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.top-search')) list.hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  })();

  /* ---------- course page ---------- */
  const TOPIC_ICONS = [
    [/crypt|encrypt|hash|pki|certif/i, 'lock'], [/attack|exploit|threat|enemy|malware/i, 'bug'],
    [/web|http|owasp|dns/i, 'globe'], [/firewall|ids|ips/i, 'shield'], [/network|protocol|tcp|osi|traffic/i, 'net'],
    [/operating|linux|windows|host|endpoint|os\b/i, 'monitor'], [/log|event|siem|forensic|file/i, 'log'],
    [/framework|mitre|kill|defen|control|security/i, 'shield'],
  ];
  const topicIcon = (name) => (TOPIC_ICONS.find(([re]) => re.test(name)) || [0, 'layers'])[1];
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}` : `${m} min`).trim();
  const SHOW = 6;
  // a course with only a couple of big folders is split one level deeper, so each topic stays readable
  function topicsOf(t) {
    if (t.sections.length >= 4 || t.sections.every((s) => s.notes.length <= 12)) return t.sections.map((s) => ({ name: s.name, notes: s.notes.map((n) => ({ ...n, tagSub: n.sub })) }));
    const out = [];
    t.sections.forEach((s) => {
      const groups = new Map();
      s.notes.forEach((n) => {
        const k = n.sub[0] || s.name;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push({ ...n, tagSub: n.sub.slice(1) });
      });
      groups.forEach((notes, name) => out.push({ name, notes }));
    });
    return out;
  }

  function renderTrack(t) {
    setTitle(t.name);
    const d = readCount(t);
    const pct = Math.round((d / t.count) * 100);
    const secMin = (s) => s.notes.reduce((a, n) => a + minutes(n.words || 200), 0);
    const topics = topicsOf(t);
    main.innerHTML = `
    <div class="page course-page" data-c="${t.slug}">
      <p class="crumbs"><a href="./">Dashboard</a> / Courses</p>
      <header class="course-hero reveal">
        <div class="ch-text">
          <h1>${esc(t.name)}</h1>
          <p class="ar" dir="rtl" lang="ar">${esc(t.ar)}</p>
          <p class="blurb">${esc(t.blurb)}</p>
          <div class="ch-stats">
            <div><b data-count="${t.count}">${t.count}</b><span>Notes</span></div>
            <div><b data-count="${topics.length}">${topics.length}</b><span>Topics</span></div>
            <div><b data-count="${Math.round(t.words / 200 / 60)}">${Math.round(t.words / 200 / 60)}</b><span>Hours of reading</span></div>
            <div class="ring" style="--p:${pct}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="16" class="fg"/></svg><span><b>${pct}%</b><small>${d}/${t.count} read</small></span></div>
          </div>
          <div class="ch-links">
            ${t.status ? `<span class="status">${esc(t.status)}</span>` : ''}
            <a href="https://github.com/${DATA.owner}/${t.repo}" rel="noopener" target="_blank">${ic('github')}View the repository</a>
          </div>
        </div>
        ${V.courseMap(t.slug, topics.map((s) => ({ name: s.name, count: s.notes.length })))}
      </header>

      <div class="topic-bar">
        <nav class="topic-chips" aria-label="Topics in this course">
          ${topics.map((s, i) => `<a href="#topic-${i}">${ic(topicIcon(s.name))}<span>${esc(s.name)}</span><small>${s.notes.length}</small></a>`).join('')}
        </nav>
        <label class="topic-filter">${ic('search')}<input type="search" id="tfilter" placeholder="Filter ${t.count} notes" autocomplete="off" spellcheck="false" aria-label="Filter the notes in this course"></label>
      </div>
      <p class="filter-empty" id="tempty" hidden>No note in this course matches that. Try the search at the top for all courses.</p>

      <div class="topics">
        ${topics.map((s, i) => {
          const done = s.notes.filter((n) => isRead(t, n.path)).length;
          return `
          <section class="topic reveal" id="topic-${i}" style="--d:${i % 2}">
            <header class="topic-head">
              <span class="topic-ico">${ic(topicIcon(s.name))}</span>
              <div class="topic-title"><h2>${esc(s.name)}</h2><p>${s.notes.length} notes · ${fmtMin(secMin(s))}</p></div>
              <div class="topic-prog"><span>${done}/${s.notes.length}</span><span class="pbar thin"><i style="--w:${Math.round((done / s.notes.length) * 100)}%"></i></span></div>
            </header>
            <ol class="topic-list">${s.notes.map((n, k) => `
              <li${k >= SHOW ? ' class="more" hidden' : ''}><a href="${noteHref(t, n.path)}" class="${isRead(t, n.path) ? 'read' : ''}" data-hay="${esc([n.title, ...n.sub, s.name].join(' ').toLowerCase())}">
                <span class="idx">${isRead(t, n.path) ? ic('check', 'tick') : String(k + 1).padStart(2, '0')}</span>
                <span class="c-title">${n.tagSub.length ? `<span class="tag">${esc(n.tagSub.join(' / '))}</span>` : ''}${esc(n.title)}</span>
                <small>${minutes(n.words || 200)} min</small>
                <span class="go" aria-hidden="true">${ic('chev')}</span>
              </a></li>`).join('')}
            </ol>
            ${s.notes.length > SHOW ? `<button class="topic-more" type="button" aria-expanded="false">Show ${s.notes.length - SHOW} more</button>` : ''}
          </section>`;
        }).join('')}
      </div>
    </div>`;
    V.enhance(main);
    V.mapFx(main);
    if (location.hash) setTimeout(() => scrollToHash(location.hash), 60); else scrollTo(0, 0);

    // the map and the cards light each other up
    const pair = (i, on) => {
      main.querySelector(`#topic-${i}`)?.classList.toggle('hot', on);
      main.querySelectorAll(`.cmap [data-t="${i}"]`).forEach((el) => el.classList.toggle('hot', on));
    };
    main.querySelectorAll('.cmap [data-t]').forEach((el) => {
      el.addEventListener('pointerenter', () => pair(el.dataset.t, true));
      el.addEventListener('pointerleave', () => pair(el.dataset.t, false));
      el.addEventListener('focus', () => pair(el.dataset.t, true));
      el.addEventListener('blur', () => pair(el.dataset.t, false));
    });
    main.querySelectorAll('.topic').forEach((sec, i) => {
      sec.addEventListener('pointerenter', () => pair(i, true));
      sec.addEventListener('pointerleave', () => pair(i, false));
    });

    main.querySelectorAll('.topic-more').forEach((btn) => btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.closest('.topic').querySelectorAll('li.more').forEach((li) => { li.hidden = !open; });
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show less' : `Show ${btn.closest('.topic').querySelectorAll('li.more').length} more`;
    }));
    const f = document.getElementById('tfilter');
    f.addEventListener('input', () => {
      const q = f.value.trim().toLowerCase();
      let any = false;
      main.querySelectorAll('.topic').forEach((sec) => {
        let hits = 0;
        sec.querySelectorAll('li').forEach((li) => {
          const ok = !q || li.firstElementChild.dataset.hay.includes(q);
          li.hidden = q ? !ok : li.classList.contains('more') && sec.querySelector('.topic-more')?.getAttribute('aria-expanded') !== 'true';
          if (ok) hits += 1;
        });
        sec.hidden = !!q && !hits;
        sec.classList.toggle('filtering', !!q);
        if (hits) any = true;
      });
      document.getElementById('tempty').hidden = any;
    });
  }

  /* ---------- note page ---------- */
  function slugger() {
    const seen = new Map();
    return (text) => {
      const s = text.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
      const c = seen.get(s);
      seen.set(s, c === undefined ? 0 : c + 1);
      return c === undefined ? s : `${s}-${c + 1}`;
    };
  }

  function prepare(html, t, path) {
    const box = document.createElement('div');
    box.innerHTML = html;
    const slug = slugger();
    const dirBase = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    box.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => { h.id = slug(h.textContent); });
    box.querySelectorAll('h2,h3').forEach((h) => {
      if (/^(table of contents|contents|الفهرس|المحتويات|فهرس المحتويات)$/i.test(h.textContent.trim())) {
        let next = h.nextElementSibling;
        while (next && /^(UL|OL|P|HR)$/.test(next.tagName) && (next.tagName !== 'P' || next.querySelector('a[href^="#"]'))) {
          const kill = next; next = next.nextElementSibling; kill.remove();
          if (kill.tagName === 'UL' || kill.tagName === 'OL') break;
        }
        h.remove();
      }
    });
    box.querySelectorAll('table').forEach((tb) => { const w = document.createElement('div'); w.className = 'table'; tb.replaceWith(w); w.appendChild(tb); });
    const LABEL = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };
    box.querySelectorAll('blockquote').forEach((bq) => {
      const p = bq.querySelector('p');
      if (!p) return;
      const m = p.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br>)?\s*/i);
      if (!m) return;
      const kind = m[1].toUpperCase();
      p.innerHTML = p.innerHTML.slice(m[0].length);
      if (!p.textContent.trim()) p.remove();
      bq.classList.add('callout', kind.toLowerCase());
      const tt = document.createElement('p'); tt.className = 'callout-title'; tt.textContent = LABEL[kind];
      bq.prepend(tt);
    });
    box.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
      const fig = document.createElement('figure');
      fig.className = 'diagram'; fig.setAttribute('dir', 'ltr');
      const src = document.createElement('pre');
      src.className = 'mermaid'; src.textContent = code.textContent;
      fig.appendChild(src);
      code.parentElement.replaceWith(fig);
    });
    box.querySelectorAll('pre').forEach((pre) => pre.setAttribute('dir', 'ltr'));
    box.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src && !/^(https?:|data:)/i.test(src)) {
        img.src = `${RAW}/${DATA.owner}/${t.repo}/${DATA.branch}/${enc(new URL(src, 'https://x/' + dirBase).pathname.slice(1).split('/').map(decodeURIComponent).join('/'))}`;
      }
      img.loading = 'lazy';
    });
    box.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return; }
      if (href.startsWith('#')) return;
      if (/\.md(#.*)?$/i.test(href)) {
        const [file, hash] = href.split('#');
        const resolved = decodeURIComponent(new URL(file, 'https://x/' + enc(dirBase)).pathname.slice(1));
        a.setAttribute('href', noteHref(t, resolved) + (hash ? '#' + hash : ''));
      }
    });
    const first = box.firstElementChild;
    if (first && first.tagName === 'H1') first.remove();
    return box;
  }

  function noteDir(box) {
    const clone = box.cloneNode(true);
    clone.querySelectorAll('pre, code').forEach((c) => c.remove());
    const txt = clone.textContent;
    const ar = (txt.match(/[\u0600-\u06FF]/g) || []).length;
    const lat = (txt.match(/[A-Za-z]/g) || []).length;
    return ar > lat * 0.35 ? 'rtl' : 'ltr';
  }

  function tocFrom(box) {
    const hs = [...box.querySelectorAll('h2, h3')];
    if (hs.length < 3) return '<div></div>';
    return `
      <aside class="toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol dir="${box.getAttribute('dir') || 'ltr'}">${hs.map((h) => `<li><a class="${h.tagName === 'H3' ? 'l3' : ''}" href="#${encodeURIComponent(h.id)}">${esc(h.textContent)}</a></li>`).join('')}</ol>
      </aside>`;
  }

  async function fetchNote(t, path) {
    const k = `${t.repo}/${path}`;
    if (noteCache.has(k)) return noteCache.get(k);
    const res = await fetch(`${RAW}/${DATA.owner}/${t.repo}/${DATA.branch}/${enc(path)}`);
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    noteCache.set(k, text);
    return text;
  }

  let readWatch = null;
  async function renderNote(t, path) {
    const all = flatNotes(t);
    const i = all.findIndex((n) => n.path === path);
    const n = all[i] || { title: path.split('/').pop().replace(/\.md$/i, ''), sub: [], section: '', words: 0 };
    setTitle(n.title);
    store.set('last', { t: t.slug, n: path });
    const gh = `https://github.com/${DATA.owner}/${t.repo}/blob/${DATA.branch}/${enc(path)}`;
    const read = isRead(t, path);

    main.innerHTML = `
    <div class="reader3">
      <article class="note" data-c="${t.slug}">
        <header class="note-head">
          ${(() => {
            const tops = topicsOf(t);
            let ti = tops.findIndex((x) => x.notes.some((m) => m.path === path)); if (ti < 0) ti = 0;
            const k = Math.max(0, tops[ti].notes.findIndex((m) => m.path === path));
            return V.noteMap(t.slug, tops.map((x) => ({ name: x.name, count: x.notes.length })), ti, k, (j) => `?t=${t.slug}#topic-${j}`);
          })()}
          <p class="crumbs"><a href="./">Dashboard</a> / <a href="?t=${t.slug}">${esc(t.name)}</a>${n.section ? ` / ${esc(n.section)}` : ''}</p>
          <h1>${esc(n.title)}</h1>
          <div class="meta">
            <span id="read-chip" class="read-chip${read ? ' done' : ''}">${read ? 'Read' : `${minutes(n.words || 200)} min read`}</span>
            <span>Note ${i + 1} of ${all.length}</span>
            <span>Arabic, with English terms</span>
            <a href="${gh}" rel="noopener" target="_blank">Open on GitHub</a>
          </div>
        </header>
        <div class="prose" id="prose"><div class="skeleton" role="status" aria-label="Loading the note"><i></i><i></i><i></i><i></i></div></div>
        <nav class="pager" aria-label="Previous and next note">
          ${i > 0 ? `<a class="prev" href="${noteHref(t, all[i - 1].path)}"><small>Previous</small>${esc(all[i - 1].title)}</a>` : '<span></span>'}
          ${i >= 0 && i < all.length - 1 ? `<a class="next" href="${noteHref(t, all[i + 1].path)}"><small>Next</small>${esc(all[i + 1].title)}</a>` : ''}
        </nav>
      </article>
      <div id="toc-slot"></div>
    </div>`;
    V.enhance(main);
    if (!location.hash) scrollTo(0, 0);

    const prose = document.getElementById('prose');
    try {
      const md = await fetchNote(t, path);
      if (new URLSearchParams(location.search).get('n') !== path) return;
      const html = DOMPurify.sanitize(marked.parse(md, { gfm: true, headerIds: false, mangle: false }));
      const box = prepare(html, t, path);
      const dir = noteDir(box);
      prose.setAttribute('dir', dir);
      prose.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
      prose.replaceChildren(...box.childNodes);
      main.querySelector('article.note').setAttribute('dir', dir);
      prose.querySelectorAll(':scope > h2, :scope > h3, :scope > .table, :scope > .diagram, :scope > blockquote, :scope > pre, :scope > ul, :scope > ol').forEach((el) => el.classList.add('reveal'));
      V.reveal(prose);
      document.getElementById('toc-slot').outerHTML = tocFrom(prose);
      spy();
      drawDiagrams(prose);
      if (location.hash) scrollToHash(location.hash);
      // the note counts as read once its last part has been on screen
      if (readWatch) readWatch.disconnect();
      const pager = main.querySelector('.pager');
      if ('IntersectionObserver' in window && pager) {
        readWatch = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { markRead(t, path); readWatch.disconnect(); } });
        setTimeout(() => readWatch && readWatch.observe(pager), 1500);
      }
    } catch (err) {
      prose.innerHTML = `<div class="state"><h1>This note didn't load</h1>
        <p>GitHub didn't return the file. Check your connection and reload the page, or <a href="${gh}" rel="noopener">read it on GitHub</a>.</p></div>`;
    }
  }

  /* ---------- diagrams ---------- */
  let mermaidReady = null;
  const isDark = () => {
    const th = document.documentElement.getAttribute('data-theme');
    return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  function loadMermaid() {
    if (!mermaidReady) {
      mermaidReady = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js';
        sc.onload = () => resolve(window.mermaid);
        sc.onerror = () => { mermaidReady = null; reject(new Error('mermaid')); };
        document.head.appendChild(sc);
      });
    }
    return mermaidReady;
  }
  // rendered diagrams are kept per source and theme, so going back to a note is instant
  const svgCache = new Map();
  let mmTheme = '';
  async function renderOne(mm, n, seq) {
    const fig = n.closest('.diagram');
    const src = n.textContent;
    const key = `${isDark() ? 'd' : 'l'}|${fig.clientWidth > 700 ? 'w' : 'n'}|${src}`;
    let svg = svgCache.get(key);
    if (!svg) {
      ({ svg } = await mm.render(`mmd-${Date.now().toString(36)}-${seq}`, src));
      // a long left-to-right chain becomes unreadable when squeezed; draw it top-to-bottom instead
      const LR = /^(\s*(?:flowchart|graph)\s+)(LR|RL)\b/im;
      const m = svg.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) /);
      if (LR.test(src) && m && Number(m[1]) > (fig.clientWidth - 36) * 1.3) ({ svg } = await mm.render(`mmd-${Date.now().toString(36)}-${seq}b`, src.replace(LR, '$1TB')));
      svgCache.set(key, svg);
    }
    if (!n.isConnected) return;
    n.innerHTML = svg;
    n.setAttribute('data-processed', 'true');
    fig.classList.remove('pending');
    V.diagram(fig);
  }
  async function drawDiagrams(root) {
    const nodes = [...root.querySelectorAll('pre.mermaid')];
    if (!nodes.length) return;
    nodes.forEach((n) => n.closest('.diagram')?.classList.add('pending'));
    let mm;
    try {
      mm = await loadMermaid();
      if (warmP) await warmP;
      const theme = isDark() ? 'dark' : 'neutral';
      if (theme !== mmTheme) {
        mm.initialize({
          startOnLoad: false, securityLevel: 'strict', theme,
          fontFamily: '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif',
          flowchart: { htmlLabels: true, useMaxWidth: true },
        });
        mmTheme = theme;
      }
    } catch (e) {
      nodes.forEach((n) => n.closest('.diagram')?.classList.remove('pending'));
      nodes.forEach((n) => n.closest('.diagram')?.classList.add('as-code'));
      return;
    }
    // draw the diagrams closest to what is on screen first, then the rest one by one in the background
    const mid = scrollY + innerHeight / 2;
    const order = nodes.map((n) => ({ n, d: Math.abs(n.getBoundingClientRect().top + scrollY - mid) })).sort((x, y) => x.d - y.d).map((x) => x.n);
    const token = (drawDiagrams.token = (drawDiagrams.token || 0) + 1);
    let seq = 0;
    for (const n of order) {
      if (token !== drawDiagrams.token || !n.isConnected) return;
      try { await renderOne(mm, n, seq++); } catch (e) { const f = n.closest('.diagram'); f?.classList.remove('pending'); f?.classList.add('as-code'); }
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // fetch the diagram library while the reader is idle, so the first diagram page opens fast
  let warmP = null;
  const warmMermaid = () => {
    if (mmTheme || warmP) return;
    warmP = loadMermaid().then((mm) => {
      if (mmTheme) return null;
      const theme = isDark() ? 'dark' : 'neutral';
      mm.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif', flowchart: { htmlLabels: true, useMaxWidth: true } });
      mmTheme = theme;
      return mm.render('mmd-warm', 'flowchart TB\n  A[warm] --> B[up]');
    }).catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => setTimeout(warmMermaid, 1200), { timeout: 4000 }); else setTimeout(warmMermaid, 2500);

  let observer = null;
  function spy() {
    if (observer) observer.disconnect();
    const links = [...document.querySelectorAll('.toc a')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map(links.map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('on'));
          const a = byId.get(en.target.id);
          if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest' }); }
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    document.querySelectorAll('.prose h2, .prose h3').forEach((h) => observer.observe(h));
  }

  function renderMissing() {
    setTitle('Not found');
    main.innerHTML = `<div class="page"><div class="state"><h1>That course isn't here</h1>
      <p>The link may be from an older version of the site. <a href="./">Go to the dashboard</a> to see all four courses.</p></div></div>`;
  }

  /* ---------- notes added on GitHub after this index was built ---------- */
  async function syncFromGitHub() {
    const results = await Promise.allSettled(DATA.tracks.map(async (t) => {
      const res = await fetch(`https://api.github.com/repos/${DATA.owner}/${t.repo}/git/trees/${DATA.branch}?recursive=1`);
      if (!res.ok) return false;
      const tree = await res.json();
      const known = new Set(flatNotes(t).map((n) => n.path));
      const fresh = (tree.tree || []).filter((x) => x.type === 'blob' && /\.md$/i.test(x.path) && !/(^|\/)readme\.md$/i.test(x.path) && !known.has(x.path));
      if (!fresh.length) return false;
      fresh.forEach((f) => {
        const parts = f.path.split('/');
        const title = parts.pop().replace(/\.md$/i, '');
        const top = parts.length ? parts[0] : null;
        let sec = top ? t.sections.find((s) => s.notes.some((x) => x.path.split('/')[0] === top)) : t.sections.find((s) => s.name === 'More topics');
        if (!sec) { sec = { name: top ? top.replace(/-/g, ' ') : 'More topics', notes: [] }; t.sections.push(sec); }
        sec.notes.push({ path: f.path, title, sub: parts.slice(1), words: 0 });
      });
      t.count = flatNotes(t).length;
      return true;
    }));
    if (results.some((r) => r.status === 'fulfilled' && r.value)) { buildIndex(); renderNav(); }
  }

  /* ---------- boot ---------- */
  fetch('data/manifest.json')
    .then((r) => r.json())
    .then((d) => { DATA = d; buildIndex(); route(); syncFromGitHub().catch(() => { /* the index is enough */ }); })
    .catch(() => {
      main.innerHTML = `<div class="page"><div class="state"><h1>The notes index didn't load</h1>
        <p>Reload the page. If it keeps happening, the notes are all on <a href="https://github.com/ammaryasser28">GitHub</a>.</p></div></div>`;
    });
})();
