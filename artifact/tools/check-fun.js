// Kiểm tra câu "bựa" của từng thẻ: không được làm rơi con số hay keyword đỏ (<mark>) của thẻ gốc.
// node check-fun.js <pack.json> <lesson> <fun.txt>   (fun.txt: mỗi dòng "N| câu bựa", N = thứ tự thẻ trong bài)
const fs = require('fs');
const [packF, lesson, funF] = process.argv.slice(2);
const cards = JSON.parse(fs.readFileSync(packF, 'utf8')).cards.filter((c) => c.lesson === lesson);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[*_]/g, '').replace(/\s+/g, ' ');
const strip = (h) => h.split(/💡|📝/)[0].replace(/<blockquote[\s\S]*?<\/blockquote>/g, ' ').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const fun = {};
for (const line of fs.readFileSync(funF, 'utf8').split('\n')) { const m = line.match(/^(\d+)\|\s*(.+)$/); if (m) fun[m[1]] = m[2].trim(); }
const errs = []; let n = 0;
cards.forEach((c, i) => {
  const t = fun[i + 1]; if (!t) { errs.push(`${i + 1}: THIẾU`); return; }
  n++;
  const f = norm(t);
  const main = strip(c.back);
  for (const num of main.match(/\d+(?:[.,]\d+)?/g) || []) if (!f.includes(norm(num))) errs.push(`${i + 1}: thiếu số ${num}`);
  for (const m of c.back.matchAll(/<mark>([\s\S]*?)<\/mark>/g)) {
    if (/⚠/.test(m[1])) continue;   // ghi chú bẫy, không phải keyword
    const k = norm(strip(m[1])).replace(/[^a-z0-9 ]/g, ' ').trim();
    for (const w of k.split(' ').filter((w) => w.length > 2 && !/^\d/.test(w))) if (!f.includes(w)) { errs.push(`${i + 1}: thiếu keyword "${w}" (${strip(m[1]).trim()})`); break; }
  }
  if (t.length > 480) errs.push(`${i + 1}: dài ${t.length}`);
});
console.log(`${lesson}: ${n}/${cards.length} thẻ có câu bựa`);
if (errs.length) console.log(errs.join('\n'));
