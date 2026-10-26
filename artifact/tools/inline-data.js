// Nhúng dữ liệu môn (pack thẻ, ca tình huống, bài soạn) vào trang để publish: trên claude.ai trang không đọc được file đi kèm.
// node inline-data.js <page.html> <outDir chứa packs/index.json> <media-map.json|-> <out.html>
// media-map.json: { "tên-hình.png": "URL trong kho ảnh của artifact" }
const fs = require('fs'); const path = require('path');
const [page, dir, mediaF, out] = process.argv.slice(2);
const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const idx = rd('packs/index.json');
const data = { media: mediaF && mediaF !== '-' ? JSON.parse(fs.readFileSync(mediaF, 'utf8')) : {}, packs: [] };
for (const p of idx.packs) {
  const notes = {};
  for (const [lesson, f] of Object.entries(p.notes || {})) notes[lesson] = rd(f).pages;
  data.packs.push({ code: p.code, cards: p.file ? rd(p.file).cards : [], cases: p.cases ? rd(p.cases) : null, notes });
}
const json = JSON.stringify(data).replace(/</g, '\\u003c');   // không để "</script>" lọt vào
const html = fs.readFileSync(page, 'utf8');
const tag = `<script type="application/json" id="pt-data">${json}</script>\n`;
const at = html.indexOf('<script>');
if (at < 0) throw new Error('không thấy <script> trong trang');
fs.writeFileSync(out, html.slice(0, at) + tag + html.slice(at));
console.log(`${out}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB, ${data.packs.length} môn, ${Object.keys(data.media).length} hình`);
