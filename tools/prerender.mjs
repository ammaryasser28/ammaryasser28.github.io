// Draws every Mermaid diagram of every note once, in both themes, and saves the SVGs as
// diagrams/<l|d>/<note key>.json. The site loads these instead of drawing in the visitor's browser.
// It opens the real site pages in a headless browser, so the result is identical to a live render.
// Run from the repository root:  node tools/prerender.mjs
// A course repo's workflow runs it for its own course only:  TRACK=<slug> OUT_DIR=<that repo>/.site node tools/prerender.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const ROOT = process.cwd();
const OUT = process.env.OUT_DIR ? path.join(path.resolve(process.env.OUT_DIR), 'diagrams') : path.join(ROOT, 'diagrams');
const META = process.env.OUT_DIR ? path.join(path.resolve(process.env.OUT_DIR), 'meta.json') : path.join(OUT, 'meta.json');
const TRACK = process.env.TRACK || null;
const PORT = 8899;
const LOCAL = process.env.LOCAL_LIBS ? JSON.parse(process.env.LOCAL_LIBS) : null; // only for offline testing
// the clones the manifest was just built from, so the diagrams match that exact commit (raw.githubusercontent.com caches for minutes)
const NOTES = process.env.NOTES_DIR || (LOCAL && LOCAL.notes) || null;
const h36 = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || p.startsWith('/diagrams/')) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

async function route(page) {
  await page.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (/goatcounter\.com$|(^|\.)zgo\.at$/.test(u.hostname)) return r.abort();
    if (u.hostname === 'api.github.com') return r.abort(); // only the manifest's notes are drawn; no re-render mid-capture
    if (NOTES && u.hostname === 'raw.githubusercontent.com') {
      const parts = u.pathname.split('/').slice(1).map(decodeURIComponent);
      const f = path.join(NOTES, parts[1].toLowerCase(), ...parts.slice(3));
      if (!f.startsWith(NOTES)) return r.fulfill({ status: 404, body: '' });
      return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'text/plain; charset=utf-8' }) : r.fulfill({ status: 404, body: '' });
    }
    if (LOCAL) {
      if (u.hostname === 'localhost') return r.continue();
      if (u.hostname === 'cdn.jsdelivr.net') {
        if (u.pathname.includes('@mermaid-js/layout-elk')) return r.fulfill({ path: path.join(LOCAL.elk, u.pathname.split('/dist/')[1]), contentType: 'text/javascript' });
        return r.fulfill({ path: LOCAL.lib[u.pathname.split('/').pop()], contentType: 'text/javascript' });
      }
      return r.abort();
    }
    return r.continue();
  });
}

async function harvest(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page.evaluate(async () => {
    const start = Date.now();
    while (Date.now() - start < 90000) {
      const prose = document.getElementById('prose');
      const failed = prose && prose.querySelector('.state h1');
      const loaded = prose && prose.childElementCount > 0 && !prose.querySelector('.skeleton, .loading');
      if (failed) return { fail: 'note did not load' };
      const figs = [...document.querySelectorAll('#prose .diagram')];
      if (loaded && (figs.length === 0 || figs.every((f) => f.dataset.ready || f.classList.contains('as-code')))) {
        return { count: figs.length, items: window.__harvest };
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return { fail: 'timeout' };
  });
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8'));
  const jobs = manifest.tracks.filter((t) => !TRACK || t.slug === TRACK).flatMap((t) => t.sections.flatMap((s) => s.notes.map((n) => ({ t: t.slug, p: n.path }))));
  if (!jobs.length) { console.log(`no notes for ${TRACK || 'any course'}`); process.exit(1); }
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch();
  const report = { built: new Date().toISOString(), course: TRACK || 'all', notes: jobs.length, diagrams: 0, files: 0, errors: [] };
  // English versions (.site/en/<key>.md in each course repo) whose diagrams differ from the original
  // are drawn too; both versions' SVGs go in the same file, since each is keyed by its source.
  const fence = /```mermaid[^\n]*\n([\s\S]*?)```/g;
  const blocks = (txt) => [...txt.matchAll(fence)].map((m) => m[1].trim()).join('\n---\n');
  const repoOf = Object.fromEntries(manifest.tracks.map((t) => [t.slug, t.repo]));
  const enJobs = NOTES ? jobs.filter((j) => {
    const base = path.join(NOTES, repoOf[j.t].toLowerCase());
    const en = path.join(base, '.site', 'en', `${h36(`${j.t}|${j.p}`)}.md`);
    try { return fs.existsSync(en) && blocks(fs.readFileSync(en, 'utf8')) !== blocks(fs.readFileSync(path.join(base, j.p), 'utf8')); } catch (e) { return false; }
  }) : [];
  report.english = enJobs.length;
  for (const mode of ['light', 'dark']) {
    const dir = path.join(OUT, mode[0]);
    fs.mkdirSync(dir, { recursive: true });
    const maps = new Map();
    for (const lang of ['mix', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: mode, deviceScaleFactor: 1 });
    await ctx.addInitScript(([m, l]) => { try { localStorage.setItem('theme', m); localStorage.setItem('btn:lang', JSON.stringify(l)); } catch (e) { /* */ } window.__harvest = []; }, [mode, lang]);
    const queue = [...(lang === 'en' ? enJobs : jobs)];
    const worker = async () => {
      const page = await ctx.newPage();
      await route(page);
      while (queue.length) {
        const j = queue.shift();
        const url = `http://localhost:${PORT}/?t=${j.t}&n=${encodeURIComponent(j.p)}`;
        let r = await harvest(page, url);
        if (r.fail) r = await harvest(page, url); // one retry for a slow network
        if (r.fail) { report.errors.push({ mode, lang, note: `${j.t}/${j.p}`, error: r.fail }); continue; }
        if (!r.count) continue;
        const map = {};
        for (const it of r.items) {
          if (it.svg) map[it.h] = it.svg;
          else report.errors.push({ mode, lang, note: `${j.t}/${j.p}`, diagram: it.h, error: it.error });
        }
        const missing = r.count - Object.keys(map).length;
        if (missing > 0 && !r.items.some((x) => x.error)) report.errors.push({ mode, lang, note: `${j.t}/${j.p}`, error: `${missing} diagram(s) not captured` });
        const file = `${h36(`${j.t}|${j.p}`)}.json`;
        maps.set(file, { ...(maps.get(file) || {}), ...map });
        if (mode === 'light' && lang === 'mix') report.diagrams += Object.keys(map).length;
      }
      await page.close();
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await ctx.close();
    }
    for (const [file, map] of maps) { fs.writeFileSync(path.join(dir, file), JSON.stringify(map)); report.files += 1; }
  }
  await browser.close();
  server.close();
  fs.writeFileSync(META, JSON.stringify(report, null, 2));
  console.log(`notes ${report.notes}, diagrams ${report.diagrams}, files ${report.files}, errors ${report.errors.length}`);
  report.errors.slice(0, 30).forEach((e) => console.log(JSON.stringify(e)));
  // a broken diagram in a note is reported but does not stop the build (the site shows it as code);
  // many notes failing to load means the network was down, so nothing is published
  const loadFails = report.errors.filter((e) => !e.diagram).length;
  process.exit(loadFails > 5 ? 1 : 0);
})();
