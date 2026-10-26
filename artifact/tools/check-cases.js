// Kiểm tra độ phủ + hợp lệ cho file tình huống của 1 bài
const fs = require('fs');
const [packF, caseF] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(packF, 'utf8'));
const C = JSON.parse(fs.readFileSync(caseF, 'utf8'));
const cards = pack.cards.filter((c) => c.lesson === C.lesson);
const covered = new Set(); const errs = []; let nq = 0;
C.cases.forEach((cs, i) => cs.qs.forEach((q, j) => {
  nq++;
  if (q.opts.length !== 4) errs.push(`c${i + 1}q${j + 1}: ${q.opts.length} lựa chọn`);
  const L = q.opts.map((o) => o.length); if (L[0] > 1.35 * Math.max(...L.slice(1))) errs.push(`c${i + 1}q${j + 1}: đáp án đúng dài hơn hẳn (${L.join('/')})`);
  for (const n of q.covers) { if (!cards[n - 1]) errs.push(`c${i + 1}q${j + 1}: thẻ #${n} không tồn tại`); covered.add(n); }
}));
const by = { 3: [0, 0], 2: [0, 0], 1: [0, 0] }; const miss = [];
cards.forEach((c, i) => { by[c.prio][1]++; if (covered.has(i + 1)) by[c.prio][0]++; else if (c.prio >= 2) miss.push(`#${i + 1} [${c.prio}] ${c.stem.slice(0, 70)}`); });
const words = C.cases.map((c) => c.setting.split(/\s+/).length);
console.log(`${C.lesson}: ${C.cases.length} ca, ${nq} câu; phủ ★★★ ${by[3][0]}/${by[3][1]}, ★★ ${by[2][0]}/${by[2][1]}, ★ ${by[1][0]}/${by[1][1]}; số từ mở đầu ${words.join(',')}`);
if (errs.length) console.log('LỖI:\n' + errs.join('\n'));
if (miss.length) console.log('CHƯA PHỦ:\n' + miss.join('\n'));
