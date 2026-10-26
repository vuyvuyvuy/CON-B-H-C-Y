// File tình huống từng bài (cases/<lesson>.json) -> gói tình huống tĩnh cho Artifact Phòng Trực
// node build-cases.js <pack.json> <outDir> <tmh1.json> <tmh2.json> ...
// Mỗi câu trong file nguồn: opts[0] là đáp án đúng, covers là số thứ tự thẻ (1-based) trong bài.
// Ra: <outDir>/cases/<CODE>.json và thêm trường "cases" vào <outDir>/packs/index.json.
const fs = require('fs'); const path = require('path');
const [packF, outDir, ...caseFiles] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(packF, 'utf8'));
const CODE = pack.code || path.basename(packF, '.json');

// Trộn đáp án cố định theo id để lần build sau vẫn cùng thứ tự (không xáo trộn trạng thái ôn).
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
function shuffled(arr, seed) {
  const a = arr.map((x, i) => [x, i]); let h = hash(seed);
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const lessons = [];
let nq = 0;
for (const f of caseFiles) {
  const C = JSON.parse(fs.readFileSync(f, 'utf8'));
  const cards = pack.cards.filter((c) => c.lesson === C.lesson);
  const cases = C.cases.map((cs, i) => {
    const cid = `c_${C.lesson}_${i + 1}`;
    return {
      id: cid, title: cs.title, setting: cs.setting,
      qs: cs.qs.map((q, j) => {
        const id = `${cid}_${j + 1}`;
        const order = shuffled(q.opts, id);
        const options = order.map(([t], k) => ({ k: 'ABCD'[k], t }));
        const answer = 'ABCD'[order.findIndex(([, i0]) => i0 === 0)];
        const covers = (q.covers || []).map((n) => cards[n - 1]?.id).filter(Boolean);
        nq++;
        return { id, stem: q.stem, options, answer, why: q.why, covers };
      }),
    };
  });
  lessons.push({ lesson: C.lesson, cases });
}
fs.mkdirSync(path.join(outDir, 'cases'), { recursive: true });
const rel = `cases/${CODE}.json`;
fs.writeFileSync(path.join(outDir, rel), JSON.stringify({ code: CODE, lessons }));
const idxF = path.join(outDir, 'packs', 'index.json');
const idx = JSON.parse(fs.readFileSync(idxF, 'utf8'));
const p = idx.packs.find((x) => x.code === CODE);
if (p) p.cases = rel; else idx.packs.push({ code: CODE, cases: rel });
fs.writeFileSync(idxF, JSON.stringify(idx, null, 1));
console.log(`${CODE}: ${lessons.length} bài, ${lessons.reduce((s, l) => s + l.cases.length, 0)} ca, ${nq} câu -> ${rel}`);
