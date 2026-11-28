// Bộ .apkg do skill soan-bai-lam-sang tạo (1 file / bài, mặt sau <div class="ans">…<span class="note">…<span class="pri">…)
// -> pack thẻ cho Phòng Trực, cùng định dạng các pack MAT/TKLS (id <lesson>_<NNN>, thứ tự theo note id).
// node build-anki-pack.js <cfg.json> <outDir>
// cfg: { code, name, lessons: [[lessonId, "tên bài", "notes.json từ dump-apkg.js"]], prio3: "HAY_THI", prio1: "IT_THI" }
// Ra: <outDir>/packs/<CODE>.json và mục môn trong <outDir>/packs/index.json (giữ notes/cases đã có).
const fs = require('fs'); const path = require('path');
const [cfgF, outDir] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(cfgF, 'utf8'));
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const plain = (h) => decode(h.replace(/<br\s*\/?>|<\/div>/g, '\n').replace(/<img[^>]*>/g, '[hình]').replace(/<[^>]+>/g, '')).replace(/\n{2,}/g, '\n').trim();
const tidy = (h) => h.replace(/<(?![a-zA-Z\/!])/g, '&lt;')   // "< 1%" viết trần trong Anki
  .replace(/<span class="pri">[\s\S]*?<\/span>/g, '')
  .replace(/<span class="note">([\s\S]*?)<\/span>/g, '<div class="note">$1</div>')
  .replace(/<img src="([\w.\-]+)"\s*\/?>/g, '<img src="media/$1">')
  .replace(/(<br>\s*)+(?=<div|<img|$)/g, '').replace(/(<\/div>|>)\s*(<br>\s*)+/g, '$1').trim();
const cards = []; const missing = new Set();
for (const [lesson, title, nf] of C.lessons) {
  const notes = JSON.parse(fs.readFileSync(nf, 'utf8')).sort((a, b) => a.id - b.id);
  notes.forEach((n, i) => {
    const front = tidy(n.f[0]), back = tidy(n.f[1] || '');
    for (const m of (front + back).matchAll(/media\/([\w.\-]+)/g)) missing.add(m[1]);
    const prio = new RegExp(`(^| )${C.prio3}( |$)`).test(n.tags) ? 3 : new RegExp(`(^| )${C.prio1}( |$)`).test(n.tags) ? 1 : 2;
    cards.push({ id: `${lesson}_${String(i + 1).padStart(3, '0')}`, kind: 'anki', lesson, front, back,
      stem: plain(front), answer: plain(back) || '(xem hình)', prio, slide: null, topic: null,
      source: `Anki · ${C.name} › ${title}`, n: i + 1 });
  });
}
fs.mkdirSync(path.join(outDir, 'packs'), { recursive: true });
fs.writeFileSync(path.join(outDir, `packs/${C.code}.json`), JSON.stringify({ code: C.code, version: 1, cards }));
const idxF = path.join(outDir, 'packs/index.json');
const idx = fs.existsSync(idxF) ? JSON.parse(fs.readFileSync(idxF, 'utf8')) : { packs: [] };
const prev = idx.packs.find((p) => p.code === C.code);
idx.packs = idx.packs.filter((p) => p.code !== C.code).concat([{ ...(prev || {}), code: C.code, file: `packs/${C.code}.json`, count: cards.length }]);
fs.writeFileSync(idxF, JSON.stringify(idx, null, 1));
const by = {}; for (const c of cards) (by[c.lesson] ||= [0, 0, 0, 0])[c.prio]++;
console.log(`${C.code}: ${cards.length} thẻ`, JSON.stringify(by), `hình: ${[...missing].join(' ')}`);
