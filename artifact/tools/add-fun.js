// Gắn câu "bựa" (fun/<lesson>.txt, mỗi dòng "N| câu") vào trường fun của thẻ trong pack (ghi đè tại chỗ).
// node add-fun.js <pack.json> <lesson> <fun.txt> [<lesson> <fun.txt> ...]
const fs = require('fs');
const [packF, ...rest] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(packF, 'utf8'));
for (let a = 0; a < rest.length; a += 2) {
  const lesson = rest[a], cards = pack.cards.filter((c) => c.lesson === lesson);
  let n = 0;
  for (const line of fs.readFileSync(rest[a + 1], 'utf8').split('\n')) {
    const m = line.match(/^(\d+)\|\s*(.+)$/); const c = m && cards[+m[1] - 1];
    if (c) { c.fun = m[2].trim(); n++; }
  }
  console.log(`${lesson}: ${n}/${cards.length}`);
}
fs.writeFileSync(packF, JSON.stringify(pack));
