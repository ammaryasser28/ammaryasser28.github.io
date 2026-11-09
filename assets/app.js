(() => {
  'use strict';

  const main = document.getElementById('main');
  const RAW = 'https://raw.githubusercontent.com';
  let DATA = null;           // manifest
  let INDEX = [];            // flat list of notes for search
  const noteCache = new Map();

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = (path) => path.split('/').map(encodeURIComponent).join('/');
  const minutes = (w) => Math.max(1, Math.round(w / 200));
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  const trackBy = (slug) => DATA.tracks.find((t) => t.slug === slug);
  const noteHref = (t, path) => `?t=${t.slug}&n=${encodeURIComponent(path)}`;
  const flatNotes = (t) => t.sections.flatMap((s) => s.notes.map((n) => ({ ...n, section: s.name })));

  function buildIndex() {
    INDEX = DATA.tracks.flatMap((t) => flatNotes(t).map((n) => ({
      track: t, note: n,
      hay: [n.title, n.section, ...n.sub, t.name].join(' ').toLowerCase(),
    })));
  }

  /* ---------- theme ---------- */
  document.querySelector('.theme').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* storage unavailable */ }
    if (DATA && new URLSearchParams(location.search).get('n') && document.querySelector('.diagram')) {
      const y = scrollY; route(); setTimeout(() => scrollTo(0, y), 50);
    }
  });

  /* ---------- routing ---------- */
  function go(href, push = true) {
    const url = new URL(href, location.href);
    if (push) history.pushState({}, '', url);
    route();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    // same page: in-page anchor
    if (url.search === location.search && url.hash) {
      e.preventDefault();
      scrollToHash(url.hash);
      history.replaceState({}, '', url);
      return;
    }
    e.preventDefault();
    go(url.href);
  });
  addEventListener('popstate', () => route());

  function scrollToHash(hash) {
    if (!hash) return;
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
    const el = document.getElementById(id) || document.getElementById(id.toLowerCase());
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function route() {
    const p = new URLSearchParams(location.search);
    const t = p.get('t') && trackBy(p.get('t'));
    const n = p.get('n');
    if (t && n) return renderNote(t, n);
    if (t) return renderTrack(t);
    if (p.get('t')) return renderMissing();
    renderHome();
  }

  function setTitle(s) { document.title = s ? `${s} | Amr Yasser` : 'Amr Yasser | Blue Team Notes'; }

  /* ---------- home ---------- */
  function renderHome() {
    setTitle('');
    const total = DATA.tracks.reduce((a, t) => a + t.count, 0);
    main.innerHTML = `
    <div class="wrap">
      <section class="hero">
        <div class="hero-lines">
          <h1>Blue team notes, explained in Arabic.</h1>
          <p class="ar" dir="rtl" lang="ar">ملاحظات البلو تيم، مشروحة بالعربي.</p>
        </div>
        <div class="hero-sub">
          <p><strong>${total} notes from four security courses</strong>, from networking basics to SANS SEC450, written by Amr Yasser while training as a SOC analyst.</p>
          <p>The explanations are in Egyptian Arabic. Every term, command and Event ID stays in English, so the notes read the way the work is done.</p>
        </div>
        ${searchBox()}
      </section>

      <div class="section-head" id="courses">
        <h2>Read them in order</h2>
        <p>Each course builds on the one before it.</p>
      </div>
      <ol class="path">
        ${DATA.tracks.map((t, i) => `
          <li><a href="?t=${t.slug}">
            <span class="step" aria-hidden="true">${i + 1}</span>
            <div>
              <h3>${esc(t.name)}</h3>
              <span class="ar" dir="rtl" lang="ar">${esc(t.ar)}</span>
              <p class="blurb">${esc(t.blurb)}</p>
              ${t.status ? `<span class="status">${esc(t.status)}</span>` : ''}
            </div>
            <div class="count"><b>${t.count}</b><span>notes</span></div>
          </a></li>`).join('')}
      </ol>

      <section class="about" id="about">
        <div>
          <h2>About</h2>
          <p>I'm Amr Yasser, a SOC analyst and a cybersecurity mentor at Route Academy, where I design hands-on lab workshops for diploma students.</p>
          <p>These notes cover the courses I studied on the way to the SOC: each topic rewritten in my own words, organised so it can be revised quickly before an investigation or an interview.</p>
        </div>
        <ul>
          <li><a href="https://www.linkedin.com/in/bn-yasser-424bb4215/" rel="noopener">LinkedIn</a><span>Experience and contact</span></li>
          <li><a href="https://github.com/ammaryasser28" rel="noopener">GitHub</a><span>Source of every note</span></li>
          <li><a href="mailto:amry02077@gmail.com">amry02077@gmail.com</a><span>Email</span></li>
        </ul>
      </section>
    </div>`;
    wireSearch();
    if (location.hash) scrollToHash(location.hash); else scrollTo(0, 0);
  }

  /* ---------- search ---------- */
  function searchBox() {
    return `
      <div class="search" role="search">
        <label for="q">Find a note by topic</label>
        <input id="q" type="search" autocomplete="off" spellcheck="false"
          placeholder="Try Kerberos, DNS tunneling, or Event ID"
          role="combobox" aria-expanded="false" aria-controls="results" aria-autocomplete="list">
        <kbd aria-hidden="true">/</kbd>
        <ul class="results" id="results" role="listbox" hidden></ul>
      </div>`;
  }

  function wireSearch() {
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
      if (!q) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      const words = q.split(/\s+/);
      hits = INDEX.filter((x) => words.every((w) => x.hay.includes(w)))
        .sort((a, b) => (b.note.title.toLowerCase().includes(q) - a.note.title.toLowerCase().includes(q)))
        .slice(0, 12);
      sel = hits.length ? 0 : -1;
      list.innerHTML = hits.length
        ? hits.map((h, i) => `<li role="option" id="r${i}" aria-selected="${i === sel}">
            <a href="${noteHref(h.track, h.note.path)}">${mark(h.note.title, words)}
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
      list.children[sel].scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); go(noteHref(hits[sel].track, hits[sel].note.path)); }
      else if (e.key === 'Escape') { input.value = ''; draw(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) list.hidden = true; });
  }
  document.addEventListener('keydown', (e) => {
    const q = document.getElementById('q');
    if (e.key === '/' && q && document.activeElement !== q && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); q.focus();
    }
  });

  /* ---------- course ---------- */
  function renderTrack(t) {
    setTitle(t.name);
    main.innerHTML = `
    <div class="wrap">
      <p class="crumbs"><a href="./">Home</a> / Courses</p>
      <header class="course-head">
        <h1>${esc(t.name)}<span class="ar" dir="rtl" lang="ar">${esc(t.ar)}</span></h1>
        <p>${esc(t.blurb)}</p>
        <div class="meta">
          <span>${t.count} notes</span>
          <span>About ${Math.round(t.words / 200 / 60)} hours of reading</span>
          ${t.status ? `<span>${esc(t.status)}</span>` : ''}
          <a href="https://github.com/${DATA.owner}/${t.repo}" rel="noopener">View the repository</a>
        </div>
      </header>
      <div class="chapters">
        ${t.sections.map((s) => `
          <section class="chapter">
            <h2>${esc(s.name)}</h2>
            <ol>${s.notes.map((n) => `
              <li><a href="${noteHref(t, n.path)}"><span>${n.sub.length ? `<span class="sub">${esc(n.sub.join(' / '))} / </span>` : ''}${esc(n.title)}</span>
              ${n.words ? `<small>${minutes(n.words)} min</small>` : ''}</a></li>`).join('')}
            </ol>
          </section>`).join('')}
      </div>
    </div>`;
    scrollTo(0, 0);
  }

  /* ---------- note ---------- */
  function sideNav(t, current) {
    return `
      <aside class="side" id="side">
        <button class="side-toggle" type="button" aria-expanded="false" aria-controls="side-nav">${esc(t.name)}: all ${t.count} notes</button>
        <nav id="side-nav" aria-label="${esc(t.name)} notes">
          <a class="course-link" href="?t=${t.slug}">${esc(t.name)}<small>${t.count} notes</small></a>
          ${t.sections.map((s) => `
            <h2>${esc(s.name)}</h2>
            <ol>${s.notes.map((n) => `<li><a href="${noteHref(t, n.path)}"${n.path === current ? ' aria-current="page"' : ''}>${esc([...n.sub, n.title].join(' / '))}</a></li>`).join('')}</ol>`).join('')}
        </nav>
      </aside>`;
  }

  function slugger() {
    const seen = new Map();
    return (text) => {
      let s = text.trim().toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
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
    // drop the note's own hand-written table of contents: the page builds one from the headings
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
    box.querySelectorAll('table').forEach((tb) => {
      const wrap = document.createElement('div'); wrap.className = 'table';
      tb.replaceWith(wrap); wrap.appendChild(tb);
    });
    // GitHub alert syntax: > [!NOTE], > [!TIP], > [!WARNING] ...
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
      const t = document.createElement('p'); t.className = 'callout-title'; t.textContent = LABEL[kind];
      bq.prepend(t);
    });
    box.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
      const fig = document.createElement('div');
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
    // the page header already shows the title
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
    if (hs.length < 3) return '';
    return `
      <aside class="toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol dir="${box.getAttribute('dir') || 'ltr'}">${hs.map((h) => `<li><a class="${h.tagName === 'H3' ? 'l3' : ''}" href="#${encodeURIComponent(h.id)}">${esc(h.textContent)}</a></li>`).join('')}</ol>
      </aside>`;
  }

  async function fetchNote(t, path) {
    const key = `${t.repo}/${path}`;
    if (noteCache.has(key)) return noteCache.get(key);
    const res = await fetch(`${RAW}/${DATA.owner}/${t.repo}/${DATA.branch}/${enc(path)}`);
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    noteCache.set(key, text);
    return text;
  }

  async function renderNote(t, path) {
    const all = flatNotes(t);
    const i = all.findIndex((n) => n.path === path);
    const n = all[i] || { title: path.split('/').pop().replace(/\.md$/i, ''), sub: [], section: '', words: 0 };
    setTitle(n.title);
    const gh = `https://github.com/${DATA.owner}/${t.repo}/blob/${DATA.branch}/${enc(path)}`;

    main.innerHTML = `
    <div class="reader">
      ${sideNav(t, path)}
      <article>
        <header class="note-head">
          <p class="crumbs"><a href="./">Home</a> / <a href="?t=${t.slug}">${esc(t.name)}</a>${n.section ? ` / ${esc(n.section)}` : ''}</p>
          <h1>${esc(n.title)}</h1>
          <div class="meta">
            ${n.words ? `<span>${minutes(n.words)} min read</span>` : ''}
            <span>Arabic, with English terms</span>
            <a href="${gh}" rel="noopener">Open on GitHub</a>
          </div>
        </header>
        <div class="prose" id="prose"><div class="state"><div class="loading" role="status" aria-label="Loading the note"></div></div></div>
        <nav class="pager" aria-label="Previous and next note">
          ${i > 0 ? `<a class="prev" href="${noteHref(t, all[i - 1].path)}"><small>Previous</small>${esc(all[i - 1].title)}</a>` : ''}
          ${i >= 0 && i < all.length - 1 ? `<a class="next" href="${noteHref(t, all[i + 1].path)}"><small>Next</small>${esc(all[i + 1].title)}</a>` : ''}
        </nav>
      </article>
      <div id="toc-slot"></div>
    </div>`;

    const side = document.getElementById('side');
    side.querySelector('.side-toggle').addEventListener('click', (e) => {
      const open = side.classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', open);
    });
    const cur = side.querySelector('[aria-current="page"]');
    if (cur && innerWidth > 820) cur.scrollIntoView({ block: 'center' });
    if (!location.hash) scrollTo(0, 0);

    const prose = document.getElementById('prose');
    try {
      const md = await fetchNote(t, path);
      if (new URLSearchParams(location.search).get('n') !== path) return; // navigated away
      const html = DOMPurify.sanitize(marked.parse(md, { gfm: true, headerIds: false, mangle: false }));
      const box = prepare(html, t, path);
      const dir = noteDir(box);
      prose.setAttribute('dir', dir);
      prose.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
      prose.replaceChildren(...box.childNodes);
      const tocSlot = document.getElementById('toc-slot');
      tocSlot.outerHTML = tocFrom(prose) || '<div></div>';
      spy();
      drawDiagrams(prose);
      if (location.hash) scrollToHash(location.hash);
    } catch (err) {
      prose.innerHTML = `<div class="state"><h1>This note didn't load</h1>
        <p>GitHub didn't return the file. Check your connection and reload the page, or <a href="${gh}" rel="noopener">read it on GitHub</a>.</p></div>`;
    }
  }

  /* ---------- diagrams (Mermaid, loaded only when a note has one) ---------- */
  let mermaidReady = null;
  const isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
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
  async function drawDiagrams(root) {
    const nodes = [...root.querySelectorAll('pre.mermaid')];
    if (!nodes.length) return;
    try {
      const mm = await loadMermaid();
      mm.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'neutral',
        fontFamily: '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif',
        flowchart: { htmlLabels: true, useMaxWidth: true },
      });
      for (const n of nodes) {
        if (!n.isConnected) return;
        try { await mm.run({ nodes: [n] }); }
        catch (e) { n.classList.add('failed'); n.closest('.diagram')?.classList.add('as-code'); }
        const svg = n.querySelector('svg'); const vb = svg && svg.viewBox.baseVal; if (vb && vb.width) { svg.style.maxWidth = 'none'; svg.style.width = Math.round(vb.width) + 'px'; }
      }
    } catch (e) {
      nodes.forEach((n) => n.closest('.diagram')?.classList.add('as-code'));
    }
  }

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
          if (a) a.classList.add('on');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    document.querySelectorAll('.prose h2, .prose h3').forEach((h) => observer.observe(h));
  }

  function renderMissing() {
    setTitle('Not found');
    main.innerHTML = `<div class="wrap"><div class="state"><h1>That course isn't here</h1>
      <p>The link may be from an older version of the site. <a href="./">Go to the home page</a> to see all four courses.</p></div></div>`;
  }

  /* ---------- live sync: pick up notes added to GitHub after this site was built ---------- */
  async function syncFromGitHub() {
    const results = await Promise.allSettled(DATA.tracks.map(async (t) => {
      const res = await fetch(`https://api.github.com/repos/${DATA.owner}/${t.repo}/git/trees/${DATA.branch}?recursive=1`);
      if (!res.ok) return false;
      const tree = await res.json();
      const known = new Set(flatNotes(t).map((n) => n.path));
      const fresh = (tree.tree || []).filter((x) => x.type === 'blob' && /\.md$/i.test(x.path) &&
        !/(^|\/)readme\.md$/i.test(x.path) && !known.has(x.path));
      if (!fresh.length) return false;
      fresh.forEach((f) => {
        const parts = f.path.split('/');
        const title = parts.pop().replace(/\.md$/i, '');
        const secName = parts.length ? parts[0] : 'More topics';
        let sec = t.sections.find((s) => s.name === secName);
        if (!sec) { sec = { name: secName, notes: [] }; t.sections.push(sec); }
        sec.notes.push({ path: f.path, title, sub: parts.slice(1), words: 0 });
      });
      t.count = flatNotes(t).length;
      return true;
    }));
    if (results.some((r) => r.status === 'fulfilled' && r.value)) {
      buildIndex();
      const p = new URLSearchParams(location.search);
      if (!p.get('n') && document.activeElement?.id !== 'q') route();
    }
  }

  /* ---------- boot ---------- */
  fetch('data/manifest.json')
    .then((r) => r.json())
    .then((d) => {
      DATA = d; buildIndex(); route();
      syncFromGitHub().catch(() => { /* manifest is enough */ });
    })
    .catch(() => {
      main.innerHTML = `<div class="wrap"><div class="state"><h1>The notes index didn't load</h1>
        <p>Reload the page. If it keeps happening, the notes are all on <a href="https://github.com/ammaryasser28">GitHub</a>.</p></div></div>`;
    });
})();
