// Gắn câu "bựa" (fun/<lesson>.txt, mỗi dòng "N| câu") vào trường fun của thẻ trong pack (ghi đè tại chỗ).
// node add-fun.js <pack.json> <lesson> <fun.txt> [<lesson> <fun.txt> ...]
// FIELD=meo node add-fun.js ... gắn vào trường meo (mẹo nhớ); dòng "N-M| câu" gắn cùng một câu cho thẻ N..M.
const fs = require('fs');
const [packF, ...rest] = process.argv.slice(2); const FIELD = process.env.FIELD || 'fun';
const pack = JSON.parse(fs.readFileSync(packF, 'utf8'));
for (let a = 0; a < rest.length; a += 2) {
  const lesson = rest[a], cards = pack.cards.filter((c) => c.lesson === lesson);
  let n = 0;
  for (const line of fs.readFileSync(rest[a + 1], 'utf8').split('\n')) {
    const m = line.match(/^(\d+)(?:-(\d+))?\|\s*(.+)$/); if (!m) continue;
    for (let k = +m[1]; k <= +(m[2] || m[1]); k++) { const c = cards[k - 1]; if (c) { c[FIELD] = m[3].trim(); n++; } }
  }
  console.log(`${lesson}: ${n}/${cards.length}`);
}
fs.writeFileSync(packF, JSON.stringify(pack));
