(() => {
  'use strict';

  const main = document.getElementById('main');
  const navEl = document.getElementById('nav');
  const RAW = 'https://raw.githubusercontent.com';
  const PHOTO = 'https://github.com/ammaryasser28.png?size=240';
  let DATA = null;
  let INDEX = [];
  let DIAGRAMS = 658; // replaced by the sum of each course repo's .site/meta.json, or the site's diagrams/meta.json
  const noteCache = new Map();
  const V = window.Visuals;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (path) => path.split('/').map(encodeURIComponent).join('/');
  const minutes = (w) => Math.max(1, Math.round(w / 200));
  const trackBy = (slug) => DATA.tracks.find((t) => t.slug === slug);
  // "You are here": a home button, then a pill for each level above this page, then the page itself.
  // Always left to right, also on an Arabic note. `extra` is anything to put at the far end.
  const trail = (parts, here = '', extra = '', cls = '') => `
      <nav class="trail ${cls}" aria-label="You are here" dir="ltr">
        <ol>
          <li><a class="tr-home" href="./" aria-label="Dashboard" title="Dashboard">${ic('home')}</a></li>
          ${parts.map((x) => `<li><a class="tr-chip${x.c ? ' tr-course' : ''}" href="${x.href}"${x.c ? ` data-c="${x.c}"` : ''}>${x.num ? `<span class="tr-num">${x.num}</span>` : ''}<span>${x.html || esc(x.label)}</span></a></li>`).join('')}
          ${here ? `<li class="tr-here" aria-current="page"><span>${here}</span></li>` : ''}
        </ol>${extra}
      </nav>`;
  const courseCrumb = (t) => ({ href: `?t=${t.slug}`, label: t.name, c: t.slug, num: DATA.tracks.indexOf(t) + 1 });
  const noteHref = (t, path) => `?t=${t.slug}&n=${encodeURIComponent(path)}`;
  const flatNotes = (t) => t.sections.flatMap((s) => s.notes.map((n) => ({ ...n, section: s.name })));
  // the exact commit GitHub reported on this visit, so an edit shows at once (the branch name is cached for minutes)
  const refOf = (t) => t.ref || DATA.branch;
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reading progress, kept in this browser ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('btn:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('btn:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const readSet = new Set(store.get('read', []));

  /* ---------- language: the original notes (Arabic with English terms) or English only ---------- */
  // The English version of each note lives in its course repo as .site/en/<note key>.md.
  // ?lang=en or ?lang=mix in a link picks the language for that visitor, like the button does.
  let LANG = store.get('lang', 'mix') === 'en' ? 'en' : 'mix';
  (() => { const q = new URLSearchParams(location.search).get('lang'); if (q === 'en' || q === 'mix') { LANG = q; store.set('lang', q); } })();
  const setLangUI = () => {
    document.documentElement.setAttribute('data-lang', LANG);
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  };
  setLangUI();
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lang === LANG) return;
    LANG = b.dataset.lang; store.set('lang', LANG); setLangUI();
    if (DATA) { const y = scrollY; route(true); if (!new URLSearchParams(location.search).get('n')) setTimeout(() => scrollTo(0, y), 0); }
  }));
  const key = (t, path) => `${t.slug}|${path}`;

  /* ---------- stars: notes, sections and diagrams a reader wants to come back to ---------- */
  // Saved in this browser, newest first. A section is remembered by its position in the note (j) and a
  // diagram by its number (d), never by its text, so a star made in one language shows in the other too.
  let STARS = store.get('stars', []);
  if (!Array.isArray(STARS)) STARS = [];
  const starKey = (e) => `${e.t}|${e.n}${e.kind === 'sec' ? `#${e.j}` : e.kind === 'dg' ? `@${e.d}` : ''}`;
  const isStar = (k) => STARS.some((e) => e.k === k);
  const noteStarred = (t, path) => isStar(`${t.slug}|${path}`);
  const STAR_SVG = '<svg class="star-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.4 5.9.7-4.4 4 1.2 5.9L12 16.7l-5.3 2.9 1.2-5.9-4.4-4 5.9-.7z"/></svg>';
  const STAR_WORD = { note: 'note', sec: 'section', dg: 'diagram' };
  const starBtn = (e, cls = '', text = false) => {
    const k = starKey(e), on = isStar(k);
    return `<button type="button" class="star ${cls}" data-star="${esc(k)}" data-star-e="${esc(JSON.stringify(e))}" aria-pressed="${on}" aria-label="Star this ${STAR_WORD[e.kind]}" title="${on ? 'Remove the star' : `Star this ${STAR_WORD[e.kind]} to find it again under Starred`}">${STAR_SVG}${text ? '<span class="s-off">Star</span><span class="s-on">Starred</span>' : ''}</button>`;
  };
  const starMark = (t, path) => (noteStarred(t, path) ? `<span class="star-mark" title="Starred">${STAR_SVG}</span>` : '');
  const starHref = (e) => { const t = trackBy(e.t); return `${noteHref(t, e.n)}${e.kind === 'sec' ? `#~s${e.j}` : e.kind === 'dg' ? `#diagram-${e.d}` : ''}`; };
  // the title of a starred section in the language being read, when the headings index has it
  const starTitle = (e) => {
    if (e.kind === 'note') return e.title;
    const cur = LANG === 'en' ? 'en' : 'mix';
    const lists = HEADS.get(`${e.t}|${e.n}`);
    if (e.lang !== cur && lists && lists[e.lang] && lists[cur]) {
      const i = lists[e.lang].indexOf(e.title);
      if (i >= 0 && lists[cur][i]) return lists[cur][i];
    }
    return e.title;
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-star]');
    if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    let e; try { e = JSON.parse(b.dataset.starE); } catch (err) { return; }
    const k = b.dataset.star, had = isStar(k);
    STARS = had ? STARS.filter((x) => x.k !== k) : [{ ...e, k, at: Date.now() }, ...STARS];
    store.set('stars', STARS);
    renderNav();
    const p = new URLSearchParams(location.search);
    if (p.has('starred') || (!p.get('t') && !p.has('courses') && !p.has('whoami'))) { const y = scrollY; route(true); scrollTo(0, y); return; }
    document.querySelectorAll('[data-star]').forEach((x) => {
      if (x.dataset.star !== k) return;
      x.setAttribute('aria-pressed', String(!had));
      x.title = had ? `Star this ${STAR_WORD[e.kind]} to find it again under Starred` : 'Remove the star';
      if (!had) { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); }
    });
  }, true);
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
  // The headings inside every note, from each course repo's .site/search.json (written by its workflow on
  // every push), so a search finds sections too. Loaded the first time someone searches.
  const HEADS = new Map();
  let headsLoading = null;
  function loadHeads() {
    if (headsLoading || !DATA) return headsLoading;
    const take = (j) => { Object.entries(j || {}).forEach(([k, v]) => { if (!HEADS.has(k)) HEADS.set(k, v); }); };
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    headsLoading = Promise.all(DATA.tracks.map((t) => get(`${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/.site/search.json`).then(take)))
      .then(() => get('diagrams/search.json').then(take));
    return headsLoading;
  }
  const headsOf = (t, path) => { const e = HEADS.get(key(t, path)); return (e && ((LANG === 'en' && e.en) || e.mix)) || []; };

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
    c_info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.2"/>',
    c_bulb: '<path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.6.5-1 1.200-1 2H9.500c0-.8-.4-1.500-1-2z"/>',
    c_flag: '<path d="M5 21V4M5 4h11l-1.500 4L16 12H5"/>',
    c_alert: '<path d="M12 4 21 19H3z"/><path d="M12 10v4M12 16.600v.2"/>',
    c_target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    c_key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2.500 2.500M14 9l2 2"/>',
    c_copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    c_list: '<path d="M9 6h11M9 12h11M9 18h11M4.500 6h.2M4.500 12h.2M4.500 18h.2"/>',
    term: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 3 2.5L7 15M12.5 15H17"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    cap: '<path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 12v4.5c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2V12M21.5 9.5V15"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    zoom: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M11 8.5v5M8.5 11h5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    tools: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z"/><path d="m4 4 4.5 4.5"/>',
  };
  const ic = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
  const avatar = (cls) => `<span class="avatar ${cls}"><img src="${PHOTO}" alt="Bn Yasser" loading="lazy" onerror="this.parentElement.classList.add('fallback');this.remove()"><span class="avatar-fb" aria-hidden="true">BY</span></span>`;

  /* ---------- shell: sidebar ---------- */
  // the Courses group in the sidebar: open on the Courses page and inside a course; a click on
  // "Courses" while already on that page folds or unfolds it (coursesFold), until the page changes
  let coursesFold = null;
  let coursesWasOpen = false;
  function renderNav() {
    if (!DATA) return;
    const p = new URLSearchParams(location.search);
    const cur = p.get('t'), curNote = p.get('n');
    const onCourses = p.has('courses') && !cur;
    const onMe = p.has('whoami') && !cur;
    const onStars = p.has('starred') && !cur;
    const onHome = !cur && !onCourses && !onMe && !onStars;
    if (!onCourses) coursesFold = null;
    const open = coursesFold === null ? (onCourses || !!cur) : !coursesFold;
    const animate = open && !coursesWasOpen;
    coursesWasOpen = open;
    navEl.innerHTML = `
      <div class="nav-top">
        <a class="brand" href="./" aria-label="Blue Team Notes, home">${V.monogram()}<span class="brand-text">Blue Team <b>Notes</b><small>by Bn Yasser</small></span></a>
        <button class="collapse" type="button" aria-label="Collapse the sidebar" title="Collapse the sidebar">${ic('chev')}</button>
      </div>
      <nav class="nav-scroll" aria-label="Site">
        <p class="nav-label">Main</p>
        <a class="nav-item${onHome ? ' active' : ''}" href="./">${ic('home')}<span>Dashboard</span></a>
        <a class="nav-item nav-stars${onStars ? ' active' : ''}" href="?starred">${ic('star')}<span>Starred</span>${STARS.length ? `<span class="nc-count">${STARS.length}</span>` : ''}</a>
        <button class="nav-item" type="button" data-focus-search>${ic('search')}<span>Search notes</span><kbd>/</kbd></button>
        <a class="nav-item nav-who${onMe ? ' active' : ''}" href="?whoami" title="About the author">${ic('term')}<span><code>whoami</code></span></a>
        <a class="nav-item nav-courses${onCourses ? ' active' : ''}" href="?courses" aria-expanded="${open}" aria-controls="nav-courses">${ic('layers')}<span>Courses</span><span class="nc-count">${DATA.tracks.length}</span>${ic('chev', 'i nc-chev')}</a>
        <div class="nav-group${open && !animate ? ' open' : ''}" id="nav-courses"><div class="ng-inner">
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
              <span class="dot">${ic('check', 'tick')}</span><span>${esc([...n.sub, n.title].join(' / '))}</span>${starMark(t, n.path)}</a>`).join('')}`).join('')}
          </div>` : ''}`;
        }).join('')}
        </div></div>
      </nav>`;
    navEl.querySelector('.collapse').addEventListener('click', () => {
      const c = document.body.classList.toggle('nav-collapsed');
      store.set('collapsed', c);
    });
    navEl.querySelector('[data-focus-search]').addEventListener('click', () => { closeNav(); document.getElementById('q').focus(); });
    const group = navEl.querySelector('.nav-group');
    const btn = navEl.querySelector('.nav-courses');
    // closed items can't be tabbed to
    const sync = () => { const o = group.classList.contains('open'); btn.setAttribute('aria-expanded', o); group.inert = !o; };
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => { group.classList.add('open'); sync(); }));
    sync();
    btn.addEventListener('click', (e) => {
      if (!onCourses) return; // the router opens the Courses page, and the group with it
      e.preventDefault(); e.stopPropagation();
      const o = group.classList.toggle('open');
      coursesFold = !o; coursesWasOpen = o; sync();
    });
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
  // opening a note at a section: diagrams above it keep changing size while they draw, so stay on the
  // section until the page settles (about 2.5 s), unless the reader scrolls first
  function settleHash(hash) {
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    const el = document.getElementById(id);
    if (!el) return;
    let stop = false;
    const evs = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    const cancel = () => { stop = true; };
    evs.forEach((ev) => addEventListener(ev, cancel, { passive: true, once: true }));
    const t0 = performance.now();
    const tick = () => {
      if (stop || !el.isConnected) return evs.forEach((ev) => removeEventListener(ev, cancel));
      el.scrollIntoView({ block: 'start' });
      if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else evs.forEach((ev) => removeEventListener(ev, cancel));
    };
    tick();
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

  function route(quiet) {
    if (!quiet) setTimeout(track, 0);
    const p = new URLSearchParams(location.search);
    const t = p.get('t') && trackBy(p.get('t'));
    const n = p.get('n');
    renderNav();
    if (t && n) return renderNote(t, n);
    if (t) return renderTrack(t);
    if (p.get('t')) return renderMissing();
    if (p.has('courses')) return renderCourses();
    if (p.has('whoami')) return renderWhoami();
    if (p.has('starred')) return renderStarred();
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

  const courseCards = () => `
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
        </ol>`;

  /* ---------- the Courses page ---------- */
  function renderCourses() {
    setTitle('Courses');
    const total = DATA.tracks.reduce((a, t) => a + t.count, 0);
    const hours = Math.round(DATA.tracks.reduce((a, t) => a + t.words, 0) / 200 / 60);
    const readTotal = DATA.tracks.reduce((a, t) => a + readCount(t), 0);
    const pct = Math.round((readTotal / total) * 100);
    main.innerHTML = `
    <div class="page courses-page">
${trail([], 'Courses')}
      <header class="cp-head reveal">
        <div class="cp-text">
          <h1>Courses</h1>
          <p>Four courses in reading order, from networking basics to SANS SEC450. Each one builds on the one before it.</p>
        </div>
        <div class="ch-stats cp-stats">
          <div><b data-count="${DATA.tracks.length}">${DATA.tracks.length}</b><span>Courses</span></div>
          <div><b data-count="${total}">${total}</b><span>Notes</span></div>
          <div><b data-count="${hours}">${hours}</b><span>Hours of reading</span></div>
          <div class="ring" style="--p:${pct}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="16" class="fg"/></svg><span><b>${pct}%</b><small>${readTotal}/${total} read</small></span></div>
        </div>
      </header>
      ${courseCards()}
    </div>`;
    V.enhance(main);
    scrollTo(0, 0);
  }

  /* ---------- starred ---------- */
  const STAR_KIND = { note: ['notes', 'Note'], sec: ['log', 'Section'], dg: ['diagram', 'Diagram'] };
  // rows for a list of stars; ones whose note no longer exists are left out
  const starList = (list) => `
        <ul class="star-list">${list.filter((e) => trackBy(e.t) && flatNotes(trackBy(e.t)).some((x) => x.path === e.n)).map((e, i) => {
          const t = trackBy(e.t), note = flatNotes(t).find((x) => x.path === e.n);
          const [icon, word] = STAR_KIND[e.kind] || STAR_KIND.note;
          const title = e.kind === 'dg' ? `Diagram: ${starTitle(e)}` : starTitle(e);
          return `
          <li class="reveal" style="--d:${i % 6}" data-c="${t.slug}">
            <a href="${starHref(e)}">
              <span class="sl-ico">${ic(icon)}</span>
              <span class="sl-text"><b dir="auto">${esc(title)}</b><small>${word} · ${esc(t.name)}${e.kind === 'note' ? (note.section ? ` / ${esc(note.section)}` : '') : ` / ${esc(note.title)}`}</small></span>
              <span class="sl-go" aria-hidden="true">${ic('chev')}</span>
            </a>
            ${starBtn(e, 'star-row')}
          </li>`; }).join('')}
        </ul>`;
  let starFilter = '';
  function renderStarred() {
    setTitle('Starred');
    if (!HEADS.size) loadHeads()?.then(() => { if (HEADS.size && new URLSearchParams(location.search).has('starred') && STARS.some((e) => e.kind !== 'note')) { const y = scrollY; renderStarred(); scrollTo(0, y); } });
    const live = STARS.filter((e) => trackBy(e.t) && flatNotes(trackBy(e.t)).some((x) => x.path === e.n));
    const count = (k) => live.filter((e) => e.kind === k).length;
    if (starFilter && !count(starFilter)) starFilter = '';
    const shown = live.filter((e) => !starFilter || e.kind === starFilter);
    main.innerHTML = `
    <div class="page stars-page">
${trail([], 'Starred')}
      <header class="cp-head reveal">
        <div class="cp-text">
          <h1>Starred</h1>
          <p>Everything you starred, in one place: whole notes, single sections and diagrams. Each one opens exactly where you left the star.</p>
        </div>
        <div class="ch-stats cp-stats">
          <div><b data-count="${count('note')}">${count('note')}</b><span>Notes</span></div>
          <div><b data-count="${count('sec')}">${count('sec')}</b><span>Sections</span></div>
          <div><b data-count="${count('dg')}">${count('dg')}</b><span>Diagrams</span></div>
        </div>
      </header>
      ${live.length ? `
      <div class="cert-tabs star-tabs reveal" role="group" aria-label="Show one kind of star">
        ${[['', 'All', live.length], ['note', 'Notes', count('note')], ['sec', 'Sections', count('sec')], ['dg', 'Diagrams', count('dg')]].filter(([k, , c]) => !k || c).map(([k, l, c]) => `<button type="button" data-kind="${k}" aria-pressed="${starFilter === k}">${l}<span>${c}</span></button>`).join('')}
      </div>
      ${DATA.tracks.filter((t) => shown.some((e) => e.t === t.slug)).map((t) => `
      <section class="star-group" data-c="${t.slug}">
        <h2 class="reveal"><a href="?t=${t.slug}">${esc(t.name)}</a><span>${shown.filter((e) => e.t === t.slug).length}</span></h2>
        ${starList(shown.filter((e) => e.t === t.slug))}
      </section>`).join('')}
      <p class="fine">Stars are saved in this browser only.</p>` : `
      <div class="star-empty reveal">
        <span class="se-star">${STAR_SVG}</span>
        <h2>Nothing starred yet</h2>
        <p>Star anything you want to come back to, before an interview or in the middle of an investigation.</p>
        <ul>
          <li>${ic('notes')}<span><b>A note:</b> the Star button under its title.</span></li>
          <li>${ic('log')}<span><b>A section:</b> the star beside its heading.</span></li>
          <li>${ic('diagram')}<span><b>A diagram:</b> the star in its toolbar.</span></li>
        </ul>
        <a class="btn primary" href="?courses">${ic('layers')}Browse the courses</a>
      </div>`}
    </div>`;
    V.enhance(main);
    main.querySelectorAll('.star-tabs button').forEach((b) => b.addEventListener('click', () => { starFilter = b.dataset.kind; const y = scrollY; renderStarred(); scrollTo(0, y); }));
    scrollTo(0, 0);
  }

  /* ---------- whoami: the author's profile ---------- */
  const ME = {
    name: 'Amr Yasser', role: 'SOC Analyst (Tier 1)', place: 'Cairo, Egypt',
    email: 'amry02077@gmail.com', phone: '+20 115 556 3245', tel: '+201155563245',
    linkedin: 'https://www.linkedin.com/in/bn-yasser-424bb4215/', github: 'https://github.com/ammaryasser28',
    cv: 'assets/Amr_Yasser_SOC_Analyst_CV.pdf',
    summary: 'SOC Analyst (Tier 1 / L1) with a Computer Science degree and a SOC-specialized Cybersecurity Diploma. Hands-on in security monitoring, alert triage, log analysis and incident investigation with Splunk SIEM, Wireshark, and Windows Security Event Logs.',
    about: [
      'I build detection and response labs mapped to MITRE ATT&CK, mentor Cybersecurity Diploma students, and administer Active Directory daily in an enterprise environment.',
      'I also write up everything I study and publish it here as Blue Team Notes, so the next analyst can learn it faster.',
    ],
    facts: [['Based in', 'Cairo, Egypt'], ['Focus', 'SOC, detection and response'], ['Languages', 'Arabic (native), English'], ['Degree', 'B.Sc. Computer Science'], ['Military service', 'Completed'], ['Open to', 'SOC Analyst L1 roles']],
    skills: [
      ['shield', 'Security Operations', ['SIEM (Splunk)', 'Security Monitoring', 'Alert Triage', 'False-Positive Analysis', 'Log Analysis', 'Incident Response', 'Incident Reporting', 'IOC Analysis', 'Threat Hunting', 'Threat Intelligence', 'Phishing & Email Analysis', 'SOAR & Automation', 'Basic Malware Analysis', 'Vulnerability Assessment']],
      ['layers', 'Frameworks', ['MITRE ATT&CK', 'Cyber Kill Chain', 'Pyramid of Pain', 'NIST Cybersecurity Framework', 'Zero Trust']],
      ['net', 'Network Security', ['Wireshark', 'TCP/IP', 'OSI Model', 'ARP / DHCP / DNS / HTTP Analysis', 'IDS/IPS', 'Firewalls (FortiGate)', 'VLANs', 'Port Security', 'DHCP Snooping', 'Dynamic ARP Inspection']],
      ['lock', 'Windows & Identity', ['Active Directory', 'Kerberos & NTLM', 'Windows Security Event Logs', 'Sysmon', 'PowerShell Logging', 'EDR Concepts', 'NTFS Permissions', 'Windows Hardening']],
      ['tools', 'Systems & Tools', ['Linux (Ubuntu, Kali)', 'Bash', 'Python (Basic Scripting)', 'Git', 'GitHub Actions', 'VMware', 'Cisco IOS', 'Cisco Packet Tracer', 'Yersinia', 'arpspoof']],
    ],
    jobs: [
      { t: 'Cybersecurity Mentor', kind: 'Part-time', org: 'Route Academy', when: 'Jul 2026 – Present', now: true, pts: [
        'Mentor Cybersecurity Diploma students (SOC track) and run weekly hands-on workshops covering the Introduction to Cybersecurity and Cybersecurity Essentials courses.',
        'Design hands-on SOC labs end to end (attack, detect, mitigate): lab environment, step-by-step tasks, explanation material, and graded assignments.',
        'Review and grade student incident reports, giving feedback on evidence, indicators of compromise, and recommended mitigations.'] },
      { t: 'IT Support Specialist', kind: '', org: 'NG University', when: 'Oct 2025 – Present', now: true, pts: [
        'Administer Active Directory user accounts, security groups, permissions, and password resets, following access control and least-privilege practices.',
        'Triage, document, and resolve user incidents and service requests through Zoho ServiceDesk Plus, escalating when needed.',
        'Configure Cisco switches (VLANs, Port Security) and manage endpoints with ManageEngine Desktop Central and ADManager Plus.'] },
      { t: 'Coding Instructor', kind: 'Part-time', org: 'iSchool', when: 'May 2026 – Jul 2026', pts: [
        'Delivered hands-on coding sessions and technical training to scholarship students, focusing on programming logic and foundational computer science concepts.'] },
    ],
    edu: [
      { t: 'Cybersecurity Diploma, SOC Specialization', org: 'Route Academy', when: 'Dec 2025 – Jul 2026', d: 'Introduction to Cybersecurity, Cybersecurity Essentials, Cybersecurity Attacks, and Incident Response (SIEM, threat hunting, incident handling).' },
      { t: 'B.Sc. Computer Science', org: 'Thebes Academy, Higher Institute for Computer Sciences', when: 'Sep 2020 – May 2024', d: '' },
    ],
    courses: [
      ['Security', ['SANS SEC450 (Blue Team Fundamentals)', 'CompTIA Security+', 'Fortinet FortiGate Firewall']],
      ['Networking & Systems', ['Cisco CCNA Routing & Switching', 'CompTIA Network+', 'CompTIA A+', 'Linux Admin I']],
    ],
    certs: [
      { id: 'thm-soc-level-1', t: 'SOC Level 1', sub: 'Learning Path', by: 'TryHackMe', when: 'Jul 2026', meta: '65 hours', cred: 'THM-WVSXPXHGHY', url: 'https://tryhackme.com/certificate/THM-WVSXPXHGHY' },
      { id: 'thm-cyber-security-101', t: 'Cyber Security 101', sub: 'Learning Path', by: 'TryHackMe', when: 'Jun 2026', meta: '45 hours', cred: 'THM-3DOLGSALWQ', url: 'https://tryhackme.com/certificate/THM-3DOLGSALWQ' },
      { id: 'thm-pre-security', t: 'Pre Security', sub: 'Learning Path', by: 'TryHackMe', when: 'May 2026', meta: '19 hours', cred: 'THM-IUBGPUWF9W', url: 'https://tryhackme.com/certificate/THM-IUBGPUWF9W' },
      { id: 'anthropic-claude-101', t: 'Claude 101', sub: 'Certificate of Completion', by: 'Anthropic', when: '', meta: '', cred: '', url: 'https://verify.skilljar.com/c/rjnazd22nb47' },
    ],
  };
  let whoTimer = 0;
  function renderWhoami() {
    document.title = 'Amr Yasser | SOC Analyst';
    const total = DATA.tracks.reduce((a, t) => a + t.count, 0);
    const issuers = [...new Set(ME.certs.map((c) => c.by))];
    const sec = (id, icon, title, sub, body, cls = '') => `
      <section class="who-sec ${cls}" id="${id}" aria-labelledby="${id}-h">
        <div class="who-head reveal"><span class="panel-ico">${ic(icon)}</span><div><h2 id="${id}-h">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>
        ${body}
      </section>`;
    const photo = `<span class="avatar xl"><img src="${PHOTO}" alt="${ME.name}" onerror="this.parentElement.classList.add('fallback');this.remove()"><span class="avatar-fb" aria-hidden="true">AY</span></span>`;
    main.innerHTML = `
    <div class="page who">
${trail([], '<code>whoami</code>')}

      <header class="who-hero reveal">
        <div class="profile-bg" aria-hidden="true"><span class="beam"></span><span class="beam b2"></span></div>
        <div class="who-id">
          ${photo}
          <div class="who-text">
            <p class="who-open"><i></i>Open to SOC Analyst roles</p>
            <h1>${ME.name}</h1>
            <p class="who-role">${ME.role}<span>${ic('pin')}${ME.place}</span></p>
            <p class="who-sum">${esc(ME.summary)}</p>
            <div class="actions">
              <a class="btn primary" href="${ME.cv}" download target="_blank" rel="noopener">${ic('download')}Download CV</a>
              <a class="btn" href="${ME.linkedin}" target="_blank" rel="noopener">${ic('linkedin')}LinkedIn</a>
              <a class="btn" href="${ME.github}" target="_blank" rel="noopener">${ic('github')}GitHub</a>
              <a class="btn icon-only" href="mailto:${ME.email}" aria-label="Send an email" title="Send an email">${ic('mail')}</a>
            </div>
          </div>
        </div>
        <div class="term" role="img" aria-label="Terminal: whoami prints amr_yasser, a SOC Analyst in Cairo, Egypt">
          <div class="term-bar"><i></i><i></i><i></i><span>amr@blue-team: ~</span></div>
          <div class="term-body" id="term" aria-hidden="true"></div>
        </div>
      </header>

      <nav class="who-nav reveal" aria-label="Sections of this page">
        ${[['about', 'About'], ['skills', 'Skills'], ['experience', 'Experience'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certifications'], ['contact', 'Contact']].map(([h, l]) => `<a href="#${h}">${l}</a>`).join('')}
      </nav>

      ${sec('about', 'user', 'About', '', `
        <div class="who-about">
          <div class="panel reveal who-bio">${ME.about.map((x) => `<p>${esc(x)}</p>`).join('')}
            <div class="who-nums">
              <div><b data-count="${total}">${total}</b><span>Notes published</span></div>
              <div><b data-count="${DIAGRAMS}">${DIAGRAMS}</b><span>Interactive diagrams</span></div>
              <div><b data-count="${ME.certs.length}">${ME.certs.length}</b><span>Certificates</span></div>
            </div>
          </div>
          <dl class="panel reveal who-facts" style="--d:1">${ME.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </div>`)}

      ${sec('skills', 'shield', 'Skills', 'What I work with, grouped the way a SOC uses it.', `
        <div class="who-skills">${ME.skills.map(([icon, name, list], i) => `
          <div class="panel reveal skill${i === 0 ? ' wide' : ''}" style="--d:${i % 3}">
            <h3>${ic(icon)}${esc(name)}</h3>
            <ul class="chips">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>`).join('')}
        </div>`)}

      ${sec('experience', 'brief', 'Experience', '', `
        <ol class="tl">${ME.jobs.map((j, i) => `
          <li class="reveal${j.now ? ' now' : ''}" style="--d:${i}">
            <div class="panel">
              <div class="tl-top"><h3>${esc(j.t)}${j.kind ? `<small>${j.kind}</small>` : ''}</h3><span class="tl-when">${j.when}</span></div>
              <p class="tl-org">${esc(j.org)}</p>
              <ul>${j.pts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            </div>
          </li>`).join('')}
        </ol>`)}

      ${sec('projects', 'diagram', 'Projects', '', `
        <div class="who-projects">
          <article class="panel reveal proj">
            <p class="proj-kind">Home lab · 2026</p>
            <h3>SOC Detection &amp; Response Lab Series</h3>
            <p>A home SOC lab on VMware (Kali Linux, Ubuntu, Windows 11) with isolated host-only networking, plus Cisco Packet Tracer. Every lab follows an Attack, Detect, Mitigate workflow and ends with an incident report mapped to MITRE ATT&amp;CK.</p>
            <ul class="proj-list">
              <li><b>Windows Security Monitoring:</b> investigated suspicious account creation and privileged group changes through Security Event IDs 4720, 4732 and 4726, and enforced least privilege with NTFS permissions.</li>
              <li><b>Man-in-the-Middle Attacks:</b> simulated ARP spoofing and DHCP starvation / rogue DHCP, detected them in Wireshark, and mitigated with Dynamic ARP Inspection and DHCP Snooping (T1557.002, T1557.003).</li>
              <li><b>PCAP Investigation:</b> analyzed a MAC flooding capture, identified CAM table overflow indicators, and contained the attack with switch Port Security.</li>
              <li><b>Network Traffic Analysis:</b> baselined ARP, ICMP, DHCP, DNS, HTTP and TCP traffic with Wireshark filters, and exposed cleartext credentials in HTTP versus HTTPS.</li>
            </ul>
            <ul class="chips sm">${['VMware', 'Wireshark', 'Windows Event Logs', 'Packet Tracer', 'MITRE ATT&CK'].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </article>
          <article class="panel reveal proj" style="--d:1">
            <p class="proj-kind">Personal project · 2026</p>
            <h3>Blue Team Notes</h3>
            <p>This site: a free learning platform for aspiring SOC analysts. ${total} study notes across ${DATA.tracks.length} courses, from Pre-Security to SANS SEC450, with ${DIAGRAMS} interactive diagrams, section-level search, and a full English version of every note.</p>
            <ul class="proj-list">
              <li><b>Automated publishing:</b> every push to a course repository rebuilds the search index and renders its diagrams with GitHub Actions, so new notes go live with no manual steps.</li>
              <li><b>Bilingual:</b> every note in Arabic with English terms, or English only.</li>
            </ul>
            <ul class="chips sm">${['JavaScript', 'GitHub Actions', 'GitHub Pages', 'Mermaid', 'Technical Writing'].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
            <a class="btn proj-go" href="?courses">${ic('layers')}Browse the courses</a>
          </article>
        </div>`)}

      ${sec('education', 'cap', 'Education &amp; Courses', '', `
        <div class="who-edu">
          <div class="edu-col">${ME.edu.map((e, i) => `
            <div class="panel reveal edu" style="--d:${i}">
              <div class="tl-top"><h3>${esc(e.t)}</h3><span class="tl-when">${e.when}</span></div>
              <p class="tl-org">${esc(e.org)}</p>${e.d ? `<p class="edu-d">${esc(e.d)}</p>` : ''}
            </div>`).join('')}
          </div>
          <div class="panel reveal who-courses" style="--d:1">
            <h3>Courses completed</h3>
            ${ME.courses.map(([g, list]) => `<p class="cg">${esc(g)}</p><ul class="chips">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
          </div>
        </div>`)}

      ${sec('certifications', 'award', 'Certifications', 'Select a certificate to view it full size.', `
        <div class="cert-tabs reveal" role="group" aria-label="Filter certificates by issuer">
          <button type="button" data-f="" aria-pressed="true">All<span>${ME.certs.length}</span></button>
          ${issuers.map((x) => `<button type="button" data-f="${esc(x)}" aria-pressed="false">${esc(x)}<span>${ME.certs.filter((c) => c.by === x).length}</span></button>`).join('')}
        </div>
        <ul class="certs">${ME.certs.map((c, i) => `
          <li class="reveal" style="--d:${i % 4}" data-by="${esc(c.by)}">
            <button type="button" class="cert" data-full="assets/certs/${c.id}.jpg" data-title="${esc(`${c.t}, ${c.by}`)}">
              <span class="cert-img"><img src="assets/certs/${c.id}-sm.jpg" alt="${esc(`${c.t} certificate from ${c.by}, awarded to Amr Yasser`)}" loading="lazy" width="720" height="${c.by === 'Anthropic' ? 556 : 510}"><span class="cert-zoom">${ic('zoom')}</span></span>
              <span class="cert-by">${esc(c.by)}</span>
              <strong>${esc(c.t)}</strong>
              <span class="cert-sub">${esc([c.sub, c.when, c.meta].filter(Boolean).join(' · '))}</span>
              ${c.cred ? `<span class="cert-id">ID ${c.cred}</span>` : ''}
            </button>
            ${c.url ? `<a class="cert-verify" href="${c.url}" target="_blank" rel="noopener">${ic('check')}Verify certificate<span class="sr-only"> for ${esc(c.t)}</span></a>` : ''}
          </li>`).join('')}
        </ul>
        <dialog class="lightbox" aria-label="Certificate"><button type="button" class="lb-close" aria-label="Close">${ic('close')}</button><img alt=""></dialog>`)}

      ${sec('contact', 'mail', 'Contact', 'The fastest way to reach me is email or LinkedIn.', `
        <div class="who-contact">
          <a class="panel reveal ct" href="mailto:${ME.email}"><span class="panel-ico">${ic('mail')}</span><span><small>Email</small><b>${ME.email}</b></span></a>
          <a class="panel reveal ct" style="--d:1" href="tel:${ME.tel}"><span class="panel-ico">${ic('phone')}</span><span><small>Phone</small><b>${ME.phone}</b></span></a>
          <a class="panel reveal ct" style="--d:2" href="${ME.linkedin}" target="_blank" rel="noopener"><span class="panel-ico">${ic('linkedin')}</span><span><small>LinkedIn</small><b>bn-yasser-424bb4215</b></span></a>
          <div class="panel reveal ct" style="--d:3"><span class="panel-ico">${ic('pin')}</span><span><small>Location</small><b>${ME.place}</b></span></div>
        </div>
        <div class="who-cta reveal">
          <p>Hiring for a SOC team, or have a question about the notes?</p>
          <div class="actions"><a class="btn primary" href="mailto:${ME.email}?subject=${encodeURIComponent('Hello Amr')}">${ic('mail')}Send a message</a><a class="btn" href="${ME.cv}" download target="_blank" rel="noopener">${ic('download')}Download CV</a></div>
        </div>`)}
    </div>`;
    V.enhance(main);

    // the terminal types its commands once, then stays
    clearTimeout(whoTimer);
    const term = document.getElementById('term');
    const lines = [['whoami', 'amr_yasser'], ['cat role.txt', 'SOC Analyst (Tier 1) · Cairo, Egypt'], ['ls skills/', 'siem/  log-analysis/  incident-response/\nactive-directory/  network-security/'], ['cat status.txt', 'open to SOC Analyst roles']];
    const prompt = '<span class="t-p">amr@blue-team</span><span class="t-c">:</span><span class="t-d">~</span><span class="t-c">$</span> ';
    const row = (cmd, out) => `<div class="t-row">${prompt}<span class="t-cmd">${esc(cmd)}</span></div>${out === null ? '' : `<div class="t-out">${esc(out)}</div>`}`;
    const done = () => { term.innerHTML = `${lines.map(([c, o]) => row(c, o)).join('')}<div class="t-row">${prompt}<span class="t-caret"></span></div>`; };
    if (reduceMotion()) done();
    else {
      let li = 0, ci = 0;
      const step = () => {
        if (!term.isConnected) return;
        if (li >= lines.length) return done();
        const [cmd] = lines[li];
        term.innerHTML = `${lines.slice(0, li).map(([c, o]) => row(c, o)).join('')}<div class="t-row">${prompt}<span class="t-cmd">${esc(cmd.slice(0, ci))}</span><span class="t-caret"></span></div>`;
        if (ci < cmd.length) { ci++; whoTimer = setTimeout(step, 55 + Math.random() * 60); }
        else { li++; ci = 0; whoTimer = setTimeout(step, 420); }
      };
      whoTimer = setTimeout(step, 500);
    }

    // certificates: filter by issuer, open full size
    const tabs = [...main.querySelectorAll('.cert-tabs button')];
    tabs.forEach((b) => b.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      main.querySelectorAll('.certs > li').forEach((li) => { li.hidden = !!b.dataset.f && li.dataset.by !== b.dataset.f; });
    }));
    const lb = main.querySelector('.lightbox'), lbImg = lb.querySelector('img');
    main.querySelectorAll('.cert').forEach((c) => c.addEventListener('click', () => {
      lbImg.src = c.dataset.full; lbImg.alt = `${c.dataset.title} certificate`;
      if (lb.showModal) lb.showModal(); else window.open(c.dataset.full, '_blank', 'noopener');
    }));
    lb.addEventListener('click', (e) => { if (e.target !== lbImg) lb.close(); });

    // the section links light up as their section comes on screen
    const links = [...main.querySelectorAll('.who-nav a')];
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => {
          const on = a.getAttribute('href') === `#${e.target.id}`;
          a.classList.toggle('on', on);
          if (on) { const nav = a.parentElement; nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' }); }
        });
      }), { rootMargin: '-30% 0px -60% 0px' });
      main.querySelectorAll('.who-sec').forEach((x) => io.observe(x));
    }
    if (location.hash) setTimeout(() => scrollToHash(location.hash), 80); else scrollTo(0, 0);
  }

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
            <p class="bio">${total} notes across four security courses, from networking basics to SANS SEC450, each with interactive diagrams and a full English version.</p>
            <div class="actions">
              <a class="btn primary" href="${noteHref(next.t, next.n.path)}">${ic('book')}${lastN ? 'Continue reading' : 'Start reading'}</a>
              <a class="btn btn-who" href="?whoami" title="About the author">${ic('term')}<code>whoami</code></a>
            </div>
          </div>
          <aside class="focus-box" aria-label="What the notes cover">
            <p class="focus-h">What I write about</p>
            <ul>${['SIEM and detection', 'Windows and Linux logs', 'Active Directory', 'MITRE ATT&CK', 'Network traffic', 'Incident response', 'Cryptography', 'Zero Trust'].map((f, k) => `<li style="--k:${k}">${esc(f)}</li>`).join('')}</ul>
          </aside>
        </div>
      </section>

      <section class="stat-row" aria-label="Site at a glance">
        ${[['notes', 'Notes', total], ['layers', 'Courses', DATA.tracks.length], ['diagram', 'Diagrams', DIAGRAMS], ['clock', 'Hours of reading', hours]].map(([i, l, v], k) => `
          <${i === 'layers' ? 'a href="?courses"' : 'div'} class="stat reveal" style="--d:${k}"><span class="stat-ico">${ic(i)}</span><span><small>${l}</small><b data-count="${v}">${v}</b></span>${i === 'layers' ? `<span class="stat-go">${ic('chev')}</span>` : ''}</${i === 'layers' ? 'a' : 'div'}>`).join('')}
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
          <div class="panel-head"><span class="panel-ico">${ic('check')}</span><div><h2>Your progress</h2><p>${readTotal ? `${readTotal} of ${total} notes read` : 'Notes you finish are ticked off here'}</p></div><a class="panel-link" href="?courses">All courses${ic('chev')}</a></div>
          <ul class="bars">${DATA.tracks.map((t) => { const d = readCount(t), pct = Math.round((d / t.count) * 100); return `
            <li><a href="?t=${t.slug}"><span class="bar-top"><span>${esc(t.name)}</span><span>${d}/${t.count}</span></span><span class="pbar"><i style="--w:${pct}%"></i></span></a></li>`; }).join('')}</ul>
          <p class="fine">Saved in this browser only.</p>
        </div>
      </section>

      ${STARS.length ? `
      <section class="block" id="stars" aria-labelledby="stars-h">
        <div class="section-head reveal"><h2 id="stars-h">Your stars</h2><a class="panel-link" href="?starred">All ${STARS.length} starred${ic('chev')}</a></div>
        ${starList(STARS.slice(0, 6))}
      </section>` : ''}

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
      if (!HEADS.size) loadHeads()?.then(() => { if (HEADS.size && document.activeElement === input && input.value.trim()) draw(); });
      // a note matches when every word is in its title, course, section or one of its headings;
      // title matches come first, and a heading match links straight to that section
      hits = INDEX.map((x) => {
        const hs = headsOf(x.track, x.note.path);
        const all = `${x.hay} ${hs.join(' ').toLowerCase()}`;
        if (!words.every((w) => all.includes(w))) return null;
        const inTitle = words.every((w) => x.hay.includes(w));
        let head = -1, best = 0;
        if (!inTitle) hs.forEach((h, i) => { const l = h.toLowerCase(), c = words.filter((w) => l.includes(w)).length; if (c > best) { best = c; head = i; } });
        let href = noteHref(x.track, x.note.path);
        if (head >= 0) { const s = slugger(); const ids = hs.map((h) => s(h)); href += `#${encodeURIComponent(ids[head])}`; }
        const score = (x.note.title.toLowerCase().includes(q) ? 4 : 0) + (inTitle ? 2 : 0) + (head >= 0 && hs[head].toLowerCase().includes(q) ? 1 : 0);
        return { ...x, hs, head, href, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
      sel = hits.length ? 0 : -1;
      list.innerHTML = hits.length
        ? hits.map((h, i) => `<li role="option" id="r${i}" aria-selected="${i === sel}"><a href="${h.href}">
            <span class="r-title"><span>${mark(h.note.title, words)}</span>${starMark(h.track, h.note.path)}${isRead(h.track, h.note.path) ? `<span class="r-read">${ic('check')}</span>` : ''}</span>
            ${h.head >= 0 ? `<span class="r-head">${mark(h.hs[h.head], words)}</span>` : ''}
            <small>${esc(h.track.name)} / ${esc(h.note.section)}</small></a></li>`).join('')
        : `<li class="none">No note matches "${esc(input.value.trim())}". Try a shorter word, like "DNS" or "hash".</li>`;
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
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); list.hidden = true; input.blur(); go(hits[sel].href); }
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
${trail([{ href: '?courses', label: 'Courses' }], esc(t.name))}
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
          ${t.status ? `<div class="ch-links"><span class="status">${esc(t.status)}</span></div>` : ''}
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
                <span class="c-title">${n.tagSub.length ? `<span class="tag">${esc(n.tagSub.join(' / '))}</span>` : ''}${esc(n.title)}${starMark(t, n.path)}</span>
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

  /* ---------- the lesson card: every note opens the same way ---------- */
  // goal, level, prerequisites and what you can do by the end. The note's own info table and
  // "Learning Objectives" section are used when it has them, otherwise data/lessons.json.
  let LESSONS = {};
  let lessonsP = null;
  const loadLessons = () => lessonsP || (lessonsP = fetch('data/lessons.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((d) => { LESSONS = d || {}; }).catch(() => {}));
  // note titles named in a prerequisite become links to those notes
  let TITLES = null;
  function linkTitles(html, t) {
    if (!TITLES) {
      const seen = new Map();
      // an "Overview" note goes by its folder's name ("OSI Model", "Transport Layer")
      DATA.tracks.forEach((tr) => flatNotes(tr).forEach((n) => {
        const k = /^overview$/i.test(n.title.trim()) && n.path.includes('/') ? n.path.split('/').slice(-2, -1)[0] : n.title.trim();
        seen.set(k, seen.has(k) ? null : { tr, n });
      }));
      TITLES = [...seen].filter(([k, v]) => v && k.length > 4).sort((a, b) => b[0].length - a[0].length);
    }
    const box = document.createElement('div'); box.innerHTML = html;
    const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), nodes = [];
    while (tw.nextNode()) if (!tw.currentNode.parentElement.closest('a')) nodes.push(tw.currentNode);
    nodes.forEach((nd) => {
      let txt = nd.nodeValue; const parts = [];
      for (;;) {
        let best = null;
        for (const [k, v] of TITLES) {
          const i = txt.indexOf(k);
          if (i < 0 || /\w/.test(txt[i - 1] || '') || /\w/.test(txt[i + k.length] || '')) continue;
          if (!best || i < best.i || (i === best.i && k.length > best.k.length)) best = { i, k, v };
        }
        if (!best) break;
        parts.push(document.createTextNode(txt.slice(0, best.i)));
        const a = document.createElement('a'); a.href = noteHref(best.v.tr, best.v.n.path); a.textContent = best.k; parts.push(a);
        txt = txt.slice(best.i + best.k.length);
      }
      if (!parts.length) return;
      parts.push(document.createTextNode(txt));
      nd.replaceWith(...parts);
    });
    return box.innerHTML;
  }
  function lessonCard(box, t, path) {
    const top = () => [...box.children].slice(0, 6);
    let level = '', prereq = '', goal = '', objs = null, jx = null;
    const tb = top().find((e) => e.tagName === 'TABLE');
    if (tb) {
      const hs = [...tb.querySelectorAll('th')].map((x) => x.textContent.trim().toLowerCase());
      const row = tb.querySelector('tbody tr');
      if (row && (hs.includes('level') || hs.includes('prerequisites'))) {
        const cell = (k) => (hs.indexOf(k) >= 0 && row.children[hs.indexOf(k)] ? row.children[hs.indexOf(k)].innerHTML.trim() : '');
        level = cell('level'); prereq = cell('prerequisites');
        tb.remove();
      }
    }
    let bq = top().find((e) => e.tagName === 'BLOCKQUOTE');
    if (bq && bq.children.length === 1 && bq.firstElementChild.tagName === 'BLOCKQUOTE') { const inner = bq.firstElementChild; bq.replaceWith(inner); bq = inner; }
    const p0 = bq && bq.firstElementChild, st = p0 && p0.firstChild;
    const LBL = /^[\s:：]*(الهدف من الـ ?Section( ده)?|goal of this section)?[\s:：]*/i;
    // a goal written as a plain paragraph ("الهدف من الـ Section ده: ...") counts too
    const gp = !goal && !(st && st.nodeName === 'STRONG') && top().find((e) => e.tagName === 'P' && /^\s*(الهدف من الـ ?Section|goal of this section)/i.test(e.textContent));
    if (gp) {
      if (gp.firstChild && gp.firstChild.nodeType === 3) gp.firstChild.nodeValue = gp.firstChild.nodeValue.replace(LBL, '');
      goal = `<p>${gp.innerHTML.trim()}</p>`;
      gp.remove();
    } else if (st && st.nodeName === 'STRONG' && /^\s*((the\s+)?goal|objective|الهدف)/i.test(st.textContent)) {
      st.remove();
      while (p0.firstChild && (p0.firstChild.nodeName === 'BR' || (p0.firstChild.nodeType === 3 && !p0.firstChild.nodeValue.replace(LBL, '')))) p0.firstChild.remove();
      if (p0.firstChild && p0.firstChild.nodeType === 3) p0.firstChild.nodeValue = p0.firstChild.nodeValue.replace(LBL, '');
      if (!p0.textContent.trim()) p0.remove();
      goal = bq.innerHTML.trim();
      bq.remove();
    }
    const lo = [...box.querySelectorAll('h2, h3')].find((h) => /^(learning objectives|أهداف التعلم)/i.test(h.textContent.trim()));
    if (lo) {
      jx = lo.dataset.j; objs = [];
      const stop = lo.tagName === 'H2' ? /^H[12]$/ : /^H[123]$/;
      let nx = lo.nextElementSibling;
      while (nx && !stop.test(nx.tagName)) {
        if (/^(UL|OL)$/.test(nx.tagName)) objs.push(...[...nx.children].map((li) => li.innerHTML.trim()));
        const k = nx; nx = nx.nextElementSibling; k.remove();
      }
      lo.remove();
    }
    const L = LESSONS[`${t.slug}|${path}`] || {};
    if (!level && L.level) level = esc(L.level);
    if (!prereq && L.prereq) prereq = esc(L.prereq);
    if (L.objectives) objs = L.objectives.map((x) => esc(x).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'));
    if (!goal && !level && !prereq && !(objs && objs.length)) return;
    while (box.firstElementChild && box.firstElementChild.tagName === 'HR') box.firstElementChild.remove();
    // a second big title at the top of the note repeats the page title, so it goes too
    const jxs = jx != null ? [jx] : [];
    if (box.firstElementChild && box.firstElementChild.tagName === 'H1') {
      const h = box.firstElementChild;
      if (h.dataset.j != null) jxs.push(h.dataset.j);
      h.remove();
      while (box.firstElementChild && box.firstElementChild.tagName === 'HR') box.firstElementChild.remove();
    }
    const ar = /[\u0600-\u06FF]/.test(goal);
    const lv = level.replace(/<[^>]+>/g, '').trim();
    const none = /^none\b/i.test(prereq.replace(/<[^>]+>/g, '').trim());
    const card = document.createElement('section');
    card.className = 'lesson';
    if (jxs.length) card.dataset.jx = jxs.join(' ');
    card.innerHTML = `
      ${goal ? `<div class="ls-goal" dir="${ar ? 'rtl' : 'ltr'}"${ar ? ' lang="ar"' : ''}>
        <p class="ls-label">${ic('c_target')}<span>${ar ? 'الهدف من الـ Section ده' : 'Goal of this section'}</span></p>
        <div class="ls-text">${goal}</div>
      </div>` : ''}
      ${level || prereq ? `<dl class="ls-facts" dir="ltr">
        ${level ? `<div class="ls-lv"><dt>Level</dt><dd><span class="ls-level ${/begin/i.test(lv) ? 'lv-b' : /adv/i.test(lv) ? 'lv-a' : 'lv-i'}"><i></i><i></i><i></i>${esc(lv)}</span></dd></div>` : ''}
        ${prereq ? `<div class="ls-pre"><dt>Prerequisites</dt><dd>${none ? 'None. You can start with this note.' : linkTitles(prereq, t)}</dd></div>` : ''}
      </dl>` : ''}
      ${objs && objs.length ? `<div class="ls-obj" dir="ltr">
        <p class="ls-label">${ic('check')}<span>By the end of this note, you will be able to</span></p>
        <ul>${objs.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>` : ''}`;
    box.prepend(card);
  }

  function prepare(html, t, path) {
    const box = document.createElement('div');
    box.innerHTML = html;
    const slug = slugger();
    const dirBase = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    // data-j is the heading's place among the note's headings (its table of contents aside): the same number
    // in the Arabic and the English version, which is how a starred section is found in either
    let hj = 0;
    box.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
      h.id = slug(h.textContent);
      if (!/^(table of contents|contents|الفهرس|المحتويات|فهرس المحتويات)$/i.test(h.textContent.trim())) h.dataset.j = hj++;
    });
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
    lessonCard(box, t, path);
    box.querySelectorAll('table').forEach((tb) => { const w = document.createElement('div'); w.className = 'table'; tb.replaceWith(w); w.appendChild(tb); });
    // a "**bold**" the Markdown parser left as text (it does that next to Arabic punctuation)
    {
      const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), todo = [];
      while (tw.nextNode()) { const nd = tw.currentNode; if (/\*\*[^*\n]+\*\*/.test(nd.nodeValue) && !nd.parentElement.closest('pre, code')) todo.push(nd); }
      todo.forEach((nd) => {
        const f = document.createDocumentFragment();
        nd.nodeValue.split(/\*\*([^*\n]+)\*\*/).forEach((part, k) => {
          if (!part) return;
          if (k % 2) { const b = document.createElement('strong'); b.textContent = part; f.appendChild(b); } else f.appendChild(document.createTextNode(part));
        });
        nd.replaceWith(f);
      });
    }
    // callouts: GitHub's [!NOTE] kind, and any quote that opens with a bold label ("Goal of this section:")
    const KIND = { NOTE: ['Note', 'c_info'], TIP: ['Tip', 'c_bulb'], IMPORTANT: ['Important', 'c_flag'], WARNING: ['Warning', 'c_alert'], CAUTION: ['Caution', 'c_alert'] };
    const callout = (bq, kind, label, icon) => {
      bq.classList.add('callout', kind);
      const tt = document.createElement('p'); tt.className = 'callout-title';
      tt.innerHTML = `${ic(icon)}<span dir="auto">${esc(label)}</span>`;
      bq.prepend(tt);
    };
    box.querySelectorAll('blockquote').forEach((bq) => {
      const p = bq.querySelector('p');
      if (!p) return;
      const m = p.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br>)?\s*/i);
      if (m) {
        const kind = m[1].toUpperCase();
        p.innerHTML = p.innerHTML.slice(m[0].length);
        if (!p.textContent.trim()) p.remove();
        callout(bq, kind.toLowerCase(), KIND[kind][0], KIND[kind][1]);
        return;
      }
      const st = p.firstChild;
      if (!st || st.nodeName !== 'STRONG' || p !== bq.firstElementChild) return;
      const raw = st.textContent.trim(), nx = st.nextSibling;
      const after = nx ? (nx.nodeType === 3 ? nx.nodeValue : nx.nodeName === 'BR' ? '\n' : 'x') : '\n';
      if (raw.length > 44 || !(/[:：]$/.test(raw) || /^\s*[:：]/.test(after) || /^\s*\n/.test(after))) return;
      const label = raw.replace(/\s*[:：]$/, '');
      const [kind, icon] = /^(the\s+)?goal|objective|الهدف/i.test(label) ? ['goal', 'c_target']
        : /warning|caution|danger|تحذير|خطر|انتبه/i.test(label) ? ['warning', 'c_alert']
        : /\btip\b|نصيحة|نصيحه/i.test(label) ? ['tip', 'c_bulb']
        : /^note|ملحوظة|ملحوظه|ملاحظة/i.test(label) ? ['note', 'c_info']
        : /important|مهم/i.test(label) ? ['important', 'c_flag']
        : /mitre/i.test(label) ? ['mitre', 'shield'] : ['key', 'c_key'];
      st.remove();
      while (p.firstChild && (p.firstChild.nodeName === 'BR' || (p.firstChild.nodeType === 3 && !p.firstChild.nodeValue.replace(/^[\s:：]+/, '')))) p.firstChild.remove();
      if (p.firstChild && p.firstChild.nodeType === 3) p.firstChild.nodeValue = p.firstChild.nodeValue.replace(/^[\s:：]+/, '');
      if (!p.textContent.trim()) p.remove();
      callout(bq, kind, label, icon);
    });
    // an analogy gets its own card: the heading and everything under it, up to the next heading
    box.querySelectorAll('h3, h4').forEach((h) => {
      if (!/^(ال)?تشبيه|analogy\s*$|^analogy/i.test(h.textContent.trim())) return;
      const card = document.createElement('aside'); card.className = 'analogy';
      h.before(card);
      let nx = h.nextSibling; card.appendChild(h);
      while (nx && !(nx.nodeType === 1 && /^(H[1-6]|HR)$/.test(nx.tagName))) { const mv = nx; nx = nx.nextSibling; card.appendChild(mv); }
      h.insertAdjacentHTML('afterbegin', ic('c_bulb'));
    });
    box.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
      const fig = document.createElement('figure');
      fig.className = 'diagram'; fig.setAttribute('dir', 'ltr');
      const src = document.createElement('pre');
      src.className = 'mermaid'; src.textContent = dgSource(code.textContent);
      fig.dataset.h = h36(src.textContent);
      fig.id = `diagram-${box.querySelectorAll('figure.diagram').length + 1}`;
      fig.appendChild(src);
      code.parentElement.replaceWith(fig);
    });
    box.querySelectorAll('pre').forEach((pre) => {
      pre.setAttribute('dir', 'ltr');
      if (pre.classList.contains('mermaid') || pre.closest('figure')) return;
      const code = pre.querySelector('code'), lang = code && (code.className.match(/language-([\w+#-]+)/) || [])[1];
      const w = document.createElement('div'); w.className = 'code'; w.setAttribute('dir', 'ltr');
      w.innerHTML = `<div class="code-head"><span>${esc(lang || 'code')}</span><button class="code-copy" type="button" data-copy>${ic('c_copy')}<span>Copy</span></button></div>`;
      pre.replaceWith(w); w.appendChild(pre);
    });
    box.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src && !/^(https?:|data:)/i.test(src)) {
        img.src = `${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/${enc(new URL(src, 'https://x/' + dirBase).pathname.slice(1).split('/').map(decodeURIComponent).join('/'))}`;
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
    // sections are numbered like in the note; a section's sub-headings show while you are reading it
    const groups = []; let k = 0;
    hs.forEach((h) => {
      if (h.tagName === 'H2') groups.push({ h, num: String(++k).padStart(2, '0'), subs: [] });
      else if (groups.length) groups[groups.length - 1].subs.push(h);
      else groups.push({ h, num: '', subs: [] });
    });
    const link = (h, cls, num) => `<a class="${cls}" href="#${encodeURIComponent(h.id)}">${num ? `<span class="tn">${num}</span>` : ''}<span class="tt">${esc(h.textContent.trim())}</span></a>`;
    return `
      <aside class="toc toc2" aria-label="On this page">
        <div class="toc-head">${ic('c_list')}<h2>On this page</h2><b class="toc-pct">0%</b></div>
        <ol dir="${box.getAttribute('dir') || 'ltr'}">${groups.map((g) => `<li class="tg">${link(g.h, 'l2', g.num)}${g.subs.length ? `<ol class="ts">${g.subs.map((x) => `<li>${link(x, 'l3')}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol>
      </aside>`;
  }

  // returns { text, en }: en is true when the English version was found and is the text
  async function fetchNote(t, path) {
    const k = `${LANG}:${t.repo}@${refOf(t)}/${path}`;
    if (noteCache.has(k)) return noteCache.get(k);
    if (LANG === 'en') {
      const r = await fetch(`${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/.site/en/${h36(`${t.slug}|${path}`)}.md`).catch(() => null);
      if (r && r.ok) { const got = { text: await r.text(), en: true }; noteCache.set(k, got); return got; }
    }
    const res = await fetch(`${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/${enc(path)}`);
    if (!res.ok) throw new Error(String(res.status));
    const got = { text: await res.text(), en: false };
    noteCache.set(k, got);
    return got;
  }

  let readWatch = null;
  let trailWatch = null, pinWatch = null;
  async function renderNote(t, path) {
    const all = flatNotes(t);
    const i = all.findIndex((n) => n.path === path);
    const n = all[i] || { title: path.split('/').pop().replace(/\.md$/i, ''), sub: [], section: '', words: 0 };
    setTitle(n.title);
    store.set('last', { t: t.slug, n: path });
    const gh = `https://github.com/${DATA.owner}/${t.repo}/blob/${DATA.branch}/${enc(path)}`;
    const read = isRead(t, path);
    const tops = topicsOf(t);
    const topIdx = tops.findIndex((x) => x.notes.some((m) => m.path === path));

    main.innerHTML = `
    <div class="reader3">
      <article class="note" data-c="${t.slug}">
        ${trail([courseCrumb(t), ...(topIdx >= 0 ? [{ href: `?t=${t.slug}#topic-${topIdx}`, label: tops[topIdx].name }] : [])], `<span dir="auto">${esc(n.title)}</span>`, `
        <span class="tr-pager">
          ${i > 0 ? `<a href="${noteHref(t, all[i - 1].path)}" aria-label="Previous note: ${esc(all[i - 1].title)}" title="Previous: ${esc(all[i - 1].title)}">${ic('chev')}</a>` : `<span class="off">${ic('chev')}</span>`}
          <b>${i + 1} / ${all.length}</b>
          ${i >= 0 && i < all.length - 1 ? `<a class="nx" href="${noteHref(t, all[i + 1].path)}" aria-label="Next note: ${esc(all[i + 1].title)}" title="Next: ${esc(all[i + 1].title)}">${ic('chev')}</a>` : `<span class="off nx">${ic('chev')}</span>`}
        </span>`, 'tr-note')}
        <header class="note-head">
          ${(() => {
            const tops = topicsOf(t);
            let ti = tops.findIndex((x) => x.notes.some((m) => m.path === path)); if (ti < 0) ti = 0;
            const k = Math.max(0, tops[ti].notes.findIndex((m) => m.path === path));
            return V.noteMap(t.slug, tops.map((x) => ({ name: x.name, count: x.notes.length })), ti, k, (j) => `?t=${t.slug}#topic-${j}`);
          })()}
          <h1>${esc(n.title)}</h1>
          <div class="meta">
            <span id="read-chip" class="read-chip${read ? ' done' : ''}">${read ? 'Read' : `${minutes(n.words || 200)} min read`}</span>
            ${starBtn({ kind: 'note', t: t.slug, n: path, title: n.title }, 'star-note', true)}
            <span>Note ${i + 1} of ${all.length}</span>
            <span id="lang-chip">${LANG === 'en' ? 'English' : 'Arabic, with English terms'}</span>
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
    // once the title has scrolled away, the bar that stays on top shows it
    if (trailWatch) trailWatch.disconnect();
    if (pinWatch) pinWatch.disconnect();
    {
      const b = main.querySelector('.tr-note');
      if (b && 'IntersectionObserver' in window) {
        const sent = document.createElement('i'); sent.className = 'tr-sent'; sent.setAttribute('aria-hidden', 'true'); b.before(sent);
        const off = Math.ceil(parseFloat(getComputedStyle(b).top) || 0) + 1;
        pinWatch = new IntersectionObserver(([e]) => b.classList.toggle('pinned', !e.isIntersecting && e.boundingClientRect.top < off + 8), { rootMargin: `-${off}px 0px 0px 0px` });
        pinWatch.observe(sent);
      }
    }
    const bar = main.querySelector('.tr-note'), h1 = main.querySelector('.note-head h1');
    if ('IntersectionObserver' in window && bar && h1) {
      trailWatch = new IntersectionObserver(([e]) => bar.classList.toggle('stuck', e.intersectionRatio < 1 && e.boundingClientRect.top < 160), { rootMargin: '-150px 0px 0px 0px', threshold: [0, 1] });
      trailWatch.observe(h1);
    }

    const prose = document.getElementById('prose');
    try {
      const [got] = await Promise.all([fetchNote(t, path), loadLessons()]);
      if (new URLSearchParams(location.search).get('n') !== path) return;
      const html = DOMPurify.sanitize(marked.parse(got.text, { gfm: true, headerIds: false, mangle: false }));
      const box = prepare(html, t, path);
      document.getElementById('lang-chip').textContent = got.en ? 'English' : 'Arabic, with English terms';
      if (LANG === 'en' && !got.en) box.insertAdjacentHTML('afterbegin', '<p class="en-missing">This note isn\'t translated yet, so it is shown in the original Arabic with English terms.</p>');
      const dir = noteDir(box);
      prose.setAttribute('dir', dir);
      prose.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
      prose.replaceChildren(...box.childNodes);
      main.querySelector('article.note').setAttribute('dir', dir);
      prose.querySelectorAll(':scope > h2, :scope > h3, :scope > .table, :scope > .diagram, :scope > blockquote, :scope > pre, :scope > ul, :scope > ol').forEach((el) => el.classList.add('reveal'));
      V.reveal(prose);
      // a line that has Arabic in it reads right to left, whatever word it starts with
      if (dir === 'rtl') prose.querySelectorAll('p, li, h2, h3, h4, td, th').forEach((el) => { if (!el.closest('.diagram') && /[\u0600-\u06FF]/.test(el.textContent)) el.classList.add('ar'); });
      document.getElementById('toc-slot').outerHTML = tocFrom(prose);
      { const tc = main.querySelector('.toc'); if (tc) tc.dataset.c = t.slug; }
      readProgress();
      spy();
      // a star on every section, and one waiting for each diagram's toolbar
      const noteLang = got.en ? 'en' : 'mix';
      let lastH = null, dn = 0;
      prose.querySelectorAll('h2, h3, h4, figure.diagram').forEach((el) => {
        if (el.tagName === 'FIGURE') {
          dn += 1;
          const title = lastH ? lastH.dataset.t : n.title;
          el.dataset.starE = JSON.stringify({ kind: 'dg', t: t.slug, n: path, d: dn, h: lastH ? +lastH.dataset.j : -1, title, lang: noteLang });
          return;
        }
        if (el.dataset.j === undefined) return;
        el.dataset.t = el.textContent.trim();
        lastH = el;
        el.insertAdjacentHTML('beforeend', starBtn({ kind: 'sec', t: t.slug, n: path, j: +el.dataset.j, h: +el.dataset.j, title: el.dataset.t, lang: noteLang }, 'star-h'));
      });
      drawDiagrams(prose, t, path);
      // "#~s12" is section 12 of this note in whichever language is showing
      const sm = /^#~s(\d+)$/.exec(location.hash);
      if (sm) {
        const h = prose.querySelector(`[data-j="${sm[1]}"]`) || prose.querySelector(`.lesson[data-jx~="${sm[1]}"]`);
        if (h) { if (!h.id) h.id = 'lesson'; history.replaceState({}, '', `${location.search}#${encodeURIComponent(h.id)}`); }
      }
      if (location.hash) settleHash(location.hash);
      // the note counts as read once its last part has been on screen
      if (readWatch) readWatch.disconnect();
      const pager = main.querySelector('.pager');
      if ('IntersectionObserver' in window && pager) {
        readWatch = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { markRead(t, path); readWatch.disconnect(); } });
        setTimeout(() => readWatch && readWatch.observe(pager), 1500);
      }
    } catch (err) {
      prose.innerHTML = `<div class="state"><h1>This note didn't load</h1>
        <p>The note couldn't be fetched. Check your connection and reload the page.</p></div>`;
    }
  }

  /* ---------- diagrams ---------- */
  // Diagrams are drawn ahead of time on GitHub (tools/prerender.mjs) and saved as SVG, one file per note and theme.
  // Anything not found there (a note edited since the last build) is drawn here with the exact same settings.
  const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.16.1/dist/mermaid.min.js';
  const ELK_URL = 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.2.3/dist/mermaid-layout-elk.esm.min.mjs';
  const h36 = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h.toString(36); };
  const dgSource = (txt) => txt.replace(/\r\n?/g, '\n').trim();
  const isDark = () => {
    const th = document.documentElement.getAttribute('data-theme');
    return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const FONT = '"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif';
  const SCALE = {
    light: ['#e8eefc', '#e3f4ee', '#f3ecfd', '#fdf0e4', '#e6f4f8', '#fbe9ee', '#eef3e3', '#f1edf8', '#e8f0f6', '#fbf3df', '#ecf1f8', '#f5ece6'],
    dark: ['#22325a', '#1d3d35', '#33285a', '#4a3320', '#1c3a46', '#4a2433', '#2f3d22', '#352d4a', '#22364a', '#4a3e1e', '#28334a', '#45302a'],
  };
  const THEME = {
    light: {
      background: 'transparent', fontFamily: FONT, fontSize: '15px',
      primaryColor: '#ffffff', primaryBorderColor: '#c3cee2', primaryTextColor: '#18212f',
      secondaryColor: '#eef2fa', secondaryBorderColor: '#c3cee2', secondaryTextColor: '#18212f',
      tertiaryColor: '#f5f7fc', tertiaryBorderColor: '#d5ddea', tertiaryTextColor: '#18212f',
      mainBkg: '#ffffff', nodeBorder: '#c3cee2', nodeTextColor: '#18212f', textColor: '#18212f', titleColor: '#18212f',
      lineColor: '#7d8aa3', clusterBkg: '#f4f7fc', clusterBorder: '#d3dceb', edgeLabelBackground: '#ffffff',
      noteBkgColor: '#fff7e0', noteBorderColor: '#e9c86b', noteTextColor: '#3d3218',
      actorBkg: '#ffffff', actorBorder: '#c3cee2', actorTextColor: '#18212f', actorLineColor: '#b3bfd4',
      signalColor: '#5f6c84', signalTextColor: '#18212f', labelBoxBkgColor: '#ffffff', labelBoxBorderColor: '#c3cee2',
      labelTextColor: '#18212f', loopTextColor: '#18212f', activationBkgColor: '#eef2fa', activationBorderColor: '#9fb0cc',
      sequenceNumberColor: '#ffffff',
    },
    dark: {
      background: 'transparent', fontFamily: FONT, fontSize: '15px', darkMode: true,
      primaryColor: '#1b2638', primaryBorderColor: '#3a4b68', primaryTextColor: '#e6ecf5',
      secondaryColor: '#222e44', secondaryBorderColor: '#3a4b68', secondaryTextColor: '#e6ecf5',
      tertiaryColor: '#151e2c', tertiaryBorderColor: '#2f3d55', tertiaryTextColor: '#e6ecf5',
      mainBkg: '#1b2638', nodeBorder: '#3a4b68', nodeTextColor: '#e6ecf5', textColor: '#e6ecf5', titleColor: '#e6ecf5',
      lineColor: '#7f8fab', clusterBkg: '#131b28', clusterBorder: '#2f3d55', edgeLabelBackground: '#131b28',
      noteBkgColor: '#2c2614', noteBorderColor: '#7a6327', noteTextColor: '#f3e6c0',
      actorBkg: '#1b2638', actorBorder: '#3a4b68', actorTextColor: '#e6ecf5', actorLineColor: '#3f5070',
      signalColor: '#a3b1c9', signalTextColor: '#e6ecf5', labelBoxBkgColor: '#1b2638', labelBoxBorderColor: '#3a4b68',
      labelTextColor: '#e6ecf5', loopTextColor: '#e6ecf5', activationBkgColor: '#222e44', activationBorderColor: '#4b5f82',
      sequenceNumberColor: '#0e1520',
    },
  };
  ['light', 'dark'].forEach((m) => SCALE[m].forEach((c, i) => {
    THEME[m][`cScale${i}`] = c;
    THEME[m][`cScaleLabel${i}`] = m === 'dark' ? '#e6ecf5' : '#18212f';
  }));
  const mmConfig = (mode) => ({
    startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: THEME[mode],
    fontFamily: FONT,
    flowchart: { htmlLabels: true, useMaxWidth: true, curve: 'basis', padding: 14, nodeSpacing: 46, rankSpacing: 58, diagramPadding: 12 },
    sequence: { useMaxWidth: true, mirrorActors: false, actorMargin: 64, boxMargin: 10, messageFontSize: 14, noteFontSize: 14, actorFontSize: 15 },
    mindmap: { useMaxWidth: true, padding: 14 },
  });

  let mermaidReady = null;
  function loadMermaid() {
    if (!mermaidReady) {
      mermaidReady = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = MERMAID_URL;
        // switch off the library's own auto-run straight away, before the page 'load' event can trigger it
        sc.onload = () => { try { window.mermaid.initialize({ startOnLoad: false }); } catch (e) { /* */ } resolve(window.mermaid); };
        sc.onerror = () => { mermaidReady = null; reject(new Error('mermaid')); };
        document.head.appendChild(sc);
      }).then(async (mm) => {
        try { const elk = await import(ELK_URL); mm.registerLayoutLoaders(elk.default); mm.__elk = true; } catch (e) { mm.__elk = false; }
        return mm;
      });
    }
    return mermaidReady;
  }
  let mmMode = '';
  const FONT_FACES = ['400 15px "IBM Plex Sans"', '500 15px "IBM Plex Sans"', '600 15px "IBM Plex Sans"', '400 15px "IBM Plex Sans Arabic"', '500 15px "IBM Plex Sans Arabic"'];
  async function readyMermaid() {
    // labels are measured while drawing, so the real fonts must be in place first
    try { if (document.fonts) await Promise.all(FONT_FACES.map((f) => document.fonts.load(f))); } catch (e) { /* fonts blocked */ }
    const mm = await loadMermaid();
    const mode = isDark() ? 'dark' : 'light';
    if (mode !== mmMode) {
      mm.initialize(mmConfig(mode));
      mmMode = mode;
    }
    return mm;
  }
  // Flowcharts are laid out twice, with the classic engine and with ELK, and the one that fits the reading column
  // better (narrower, so less zooming out) is kept. ELK must be clearly narrower to win; otherwise classic stays.
  const LR = /^(\s*(?:flowchart|graph)\s+)(LR|RL)\b/im;
  const FLOW = /^\s*(?:flowchart|graph)\b/im;
  let renderSeq = 0;
  const vbWidth = (svg) => { const m = svg.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) /); return m ? Number(m[1]) : Infinity; };
  async function mmRender(mm, src) {
    const id = () => `mmd-${(renderSeq += 1).toString(36)}-${Date.now().toString(36)}`;
    const classic = (await mm.render(id(), src)).svg;
    if (!mm.__elk || !FLOW.test(src) || /^\s*---/.test(src)) return classic;
    try {
      const elk = (await mm.render(id(), `---\nconfig:\n  layout: elk\n---\n${src}`)).svg;
      const pick = vbWidth(elk) < vbWidth(classic) * 0.85;
      if (pick && window.__harvest) window.__elkPicks = (window.__elkPicks || 0) + 1;
      return pick ? elk : classic;
    } catch (e) {
      document.querySelectorAll('body > [id^="dmmd-"]').forEach((x) => x.remove());
      return classic;
    }
  }
  async function drawLive(mm, src, width) {
    let svg = await mmRender(mm, src);
    // a long left-to-right chain is unreadable when squeezed; draw it top-to-bottom instead
    if (LR.test(src) && vbWidth(svg) > Math.max(width - 36, 600) * 1.3) svg = await mmRender(mm, src.replace(LR, '$1TB'));
    return svg;
  }

  const svgCache = new Map();
  const preCache = new Map();
  function prerendered(t, path) {
    const key = `${isDark() ? 'd' : 'l'}/${h36(`${t.slug}|${path}`)}`;
    if (window.__harvest) return Promise.resolve({});
    if (!preCache.has(key)) {
      // each course repo draws its own diagrams on every push (.site/diagrams in that repo); the
      // site's own copy covers anything older. Both are keyed by the diagram's source, so they merge.
      const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      preCache.set(key, Promise.all([get(`diagrams/${key}.json`), get(`${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/.site/diagrams/${key}.json`)])
        .then(([site, course]) => ({ ...site, ...course })));
    }
    return preCache.get(key);
  }
  function place(fig, svg) {
    const n = fig.querySelector('pre.mermaid');
    if (!n || !n.isConnected) return;
    n.innerHTML = svg;
    n.setAttribute('data-processed', 'true');
    fig.classList.remove('pending');
    V.diagram(fig);
    const tools = fig.querySelector('.dg-tools');
    if (tools && fig.dataset.starE && !tools.querySelector('.star')) {
      try { tools.insertAdjacentHTML('afterbegin', starBtn(JSON.parse(fig.dataset.starE), 'star-dg')); } catch (e) { /* no star for this one */ }
    }
  }
  async function drawDiagrams(root, t, path) {
    const figs = [...root.querySelectorAll('.diagram')].filter((f) => f.querySelector('pre.mermaid'));
    if (!figs.length) return;
    const token = (drawDiagrams.token = (drawDiagrams.token || 0) + 1);
    figs.forEach((f) => f.classList.add('pending'));
    const mode = isDark() ? 'd' : 'l';
    // 1. ready-made SVGs from the last build
    const pre = await prerendered(t, path);
    if (token !== drawDiagrams.token) return;
    const left = [];
    figs.forEach((f) => { const svg = pre[f.dataset.h] || svgCache.get(`${mode}|${f.dataset.h}`); if (svg) place(f, svg); else left.push(f); });
    if (!left.length) return;
    // 2. the rest are drawn here, closest to the screen first
    let mm;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      mm = await readyMermaid();
    } catch (e) {
      left.forEach((f) => { f.classList.remove('pending'); f.classList.add('as-code'); });
      return;
    }
    const mid = scrollY + innerHeight / 2;
    left.sort((x, y) => Math.abs(x.getBoundingClientRect().top + scrollY - mid) - Math.abs(y.getBoundingClientRect().top + scrollY - mid));
    for (const f of left) {
      if (token !== drawDiagrams.token || !f.isConnected) return;
      try {
        const src = f.querySelector('pre.mermaid').textContent;
        const svg = await drawLive(mm, src, f.clientWidth);
        svgCache.set(`${mode}|${f.dataset.h}`, svg);
        if (window.__harvest) window.__harvest.push({ h: f.dataset.h, svg });
        place(f, svg);
      } catch (e) {
        f.classList.remove('pending'); f.classList.add('as-code');
        if (window.__harvest) window.__harvest.push({ h: f.dataset.h, error: String(e && e.message || e) });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // how far down the note the reader is, shown in "On this page"
  function readProgress() {
    const pct = document.querySelector('.toc-pct');
    if (!pct) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    pct.textContent = `${Math.round(p * 100)}%`;
  }
  addEventListener('scroll', readProgress, { passive: true });
  addEventListener('resize', readProgress);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-copy]');
    if (!b || !navigator.clipboard) return;
    navigator.clipboard.writeText(b.closest('.code').querySelector('pre').textContent).then(() => {
      b.classList.add('done'); b.querySelector('span').textContent = 'Copied';
      setTimeout(() => { b.classList.remove('done'); b.querySelector('span').textContent = 'Copy'; }, 1600);
    }).catch(() => {});
  });

  // which heading the reader is under: the last one that has passed the bar on top
  let spyOn = null, spyTick = 0;
  function spy() {
    if (spyOn) { removeEventListener('scroll', spyOn); spyOn = null; }
    const links = [...document.querySelectorAll('.toc a')];
    if (!links.length) return;
    const byId = new Map(links.map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
    const heads = [...document.querySelectorAll('.prose h2, .prose h3')].filter((h) => byId.has(h.id));
    let cur = null;
    const pick = () => {
      spyTick = 0;
      let h = null;
      for (const x of heads) { if (x.getBoundingClientRect().top <= 150) h = x; else break; }
      const a = h ? byId.get(h.id) : null;
      if (a === cur) return;
      cur = a;
      links.forEach((l) => l.classList.remove('on'));
      const g = a && a.closest('.tg');
      document.querySelectorAll('.toc .tg.open').forEach((x) => { if (x !== g) x.classList.remove('open'); });
      if (!a) return;
      if (g) g.classList.add('open');
      a.classList.add('on');
      const box = a.closest('.toc'), r = a.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (r.top < br.top + 50 || r.bottom > br.bottom - 20) box.scrollTop += r.top - br.top - br.height / 2;
    };
    spyOn = () => { if (!spyTick) spyTick = requestAnimationFrame(pick); };
    addEventListener('scroll', spyOn, { passive: true });
    pick();
  }

  function renderMissing() {
    setTitle('Not found');
    main.innerHTML = `<div class="page"><div class="state"><h1>That course isn't here</h1>
      <p>The link may be from an older version of the site. <a href="?courses">See all four courses</a>.</p></div></div>`;
  }

  /* ---------- the notes index, read live from the course repos on GitHub ---------- */
  // Each course is rebuilt from its repo with the same rules as tools/manifest.py, so a note pushed
  // to GitHub shows up on the next visit, in its folder's topic and in alphabetical order, and a
  // deleted or renamed note disappears. If GitHub's API can't be reached (offline, rate limit),
  // data/manifest.json is used as it is; a workflow refreshes it a few minutes after every push.
  const API = 'https://api.github.com/repos';
  const SMALL = new Set(['and', 'of', 'the', 'a', 'vs', 'to', 'in', 'for', 'on']);
  const UPPER = { vpn: 'VPN', dlp: 'DLP', siem: 'SIEM', mdm: 'MDM', raid: 'RAID', lockbit: 'LockBit', ssh: 'SSH', dns: 'DNS' };
  function pretty(name, isFile = true) {
    if (isFile && name.toLowerCase().endsWith('.md')) name = name.slice(0, -3);
    name = name.trim();
    if (name.includes(' ')) return name;
    return name.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
      .map((w, i) => UPPER[w.toLowerCase()] || (i && SMALL.has(w.toLowerCase()) ? w : w.slice(0, 1).toUpperCase() + w.slice(1)))
      .join(' ');
  }
  // the order a folder walk gives: a folder's own files first, then its subfolders, each A to Z ignoring case
  const walkKey = (p) => { const a = p.split('/'); return a.map((x, i) => (i === a.length - 1 ? '0' : '1') + x); };
  function walkCmp(a, b) {
    const x = walkKey(a), y = walkKey(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const p = x[i].toLowerCase(), q = y[i].toLowerCase();
      if (p !== q) return p < q ? -1 : 1;
      if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return x.length - y.length;
  }
  function fromTree(t, tree) {
    const known = new Map(flatNotes(t).map((n) => [n.path, n.words]));
    const files = tree
      .filter((x) => x.type === 'blob' && /\.md$/i.test(x.path) && x.path.split('/').pop().toLowerCase() !== 'readme.md'
        && !x.path.split('/').slice(0, -1).some((d) => d.startsWith('.')))
      .sort((a, b) => walkCmp(a.path, b.path));
    const secs = new Map();
    const loose = [];
    files.forEach((f) => {
      const parts = f.path.split('/');
      const note = {
        path: f.path, title: pretty(parts[parts.length - 1]), sub: parts.slice(1, -1).map((p) => pretty(p, false)),
        words: known.has(f.path) ? known.get(f.path) : Math.max(1, Math.round((f.size || 0) / 6)),
      };
      if (parts.length === 1) { loose.push(note); return; }
      const k = pretty(parts[0], false);
      if (!secs.has(k)) secs.set(k, []);
      secs.get(k).push(note);
    });
    const sections = [...secs].map(([name, notes]) => ({ name, notes }));
    if (loose.length) sections.push({ name: 'More topics', notes: loose });
    const all = sections.flatMap((s) => s.notes);
    return { sections, count: all.length, words: all.reduce((a, n) => a + n.words, 0) };
  }
  async function liveTrack(t) {
    const r = await fetch(`${API}/${DATA.owner}/${t.repo}/commits/${DATA.branch}`, { headers: { Accept: 'application/vnd.github.sha' } });
    if (!r.ok) return false;
    const sha = (await r.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(sha)) return false;
    t.ref = sha;
    if (sha === t.sha) return false; // the manifest was built from this very commit
    const tr = await fetch(`${API}/${DATA.owner}/${t.repo}/git/trees/${sha}?recursive=1`);
    if (!tr.ok) return false;
    const tree = await tr.json();
    if (tree.truncated || !Array.isArray(tree.tree)) return false;
    const next = fromTree(t, tree.tree);
    if (!next.count) return false;
    const changed = JSON.stringify(next.sections) !== JSON.stringify(t.sections);
    Object.assign(t, next);
    return changed;
  }

  /* ---------- boot ---------- */
  fetch('data/manifest.json')
    .then((r) => r.json())
    .then(async (d) => {
      DATA = d;
      const live = Promise.allSettled(DATA.tracks.map(liveTrack));
      const meta = live.then(() => Promise.all(DATA.tracks.map((t) => fetch(`${RAW}/${DATA.owner}/${t.repo}/${refOf(t)}/.site/meta.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))))
        .then(async (ms) => {
          if (ms.every((m) => m && m.diagrams >= 0)) { DIAGRAMS = ms.reduce((a, m) => a + m.diagrams, 0); return; }
          const m = await fetch('diagrams/meta.json').then((r) => r.json()).catch(() => null);
          if (m && m.diagrams > 0) DIAGRAMS = m.diagrams;
        });
      // wait briefly so the first screen is already up to date; a slow API never holds the page
      const inTime = await Promise.race([Promise.all([live, meta]).then(() => true), new Promise((r) => setTimeout(() => r(false), 1500))]);
      buildIndex();
      route();
      if (inTime) return;
      const res = await live;
      if (!res.some((x) => x.status === 'fulfilled' && x.value)) return;
      buildIndex();
      renderNav();
      const p = new URLSearchParams(location.search);
      if (!p.get('n') && !location.hash) route(true); // a note being read is never redrawn under the reader
    })
    .catch(() => {
      main.innerHTML = `<div class="page"><div class="state"><h1>The notes index didn't load</h1>
        <p>Check your connection and reload the page.</p></div></div>`;
    });
})();
