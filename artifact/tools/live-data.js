// Làm việc với khối dữ liệu nhúng <script id="pt-data"> của bản Phòng Trực đang chạy.
// Bản publish chứa dữ liệu TẤT CẢ các môn; thư mục build cũ không còn, nên mỗi lần nạp thêm môn phải
// lấy dữ liệu từ bản đang chạy, thay/thêm môn mới, rồi nhúng lại vào phong-truc.html.
//
//   node live-data.js extract <index.html tải về> <data.json>
//       tách pt-data của bản đang chạy ra file JSON {media, packs}
//   node live-data.js add <data.json> <outDir> [media-map.json]
//       thay/thêm các môn trong <outDir>/packs/index.json (đầu ra của build-pack.js / build-cases.js / pdf-notes.py)
//       vào data.json; media-map.json (tên hình -> URL hoặc data URI) gộp vào data.media
//   node live-data.js drop <data.json> <CODE> [...]
//       bỏ môn đã thi xong khỏi trang để trang không vượt 16 MB (trạng thái ôn trong kho vẫn giữ)
//   node live-data.js inline <phong-truc.html> <data.json> <out.html>
//       nhúng data.json vào trang (giống inline-data.js) để publish
//   node live-data.js stat <data.json>
const fs = require('fs'); const path = require('path');
const [cmd, ...a] = process.argv.slice(2);
const rdJ = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const TAG = /<script type="application\/json" id="pt-data">([\s\S]*?)<\/script>\n?/;
const stat = (d) => {
  for (const p of d.packs) console.log(`${p.code}: ${p.cards.length} thẻ, ${p.cases ? p.cases.lessons.reduce((s, l) => s + l.cases.length, 0) : 0} ca, bài soạn ${Object.keys(p.notes || {}).join(',') || '-'}`);
  console.log(`media ${Object.keys(d.media).length}, ${(JSON.stringify(d).length / 1048576).toFixed(2)} MB`);
};
if (cmd === 'extract') {
  const m = TAG.exec(fs.readFileSync(a[0], 'utf8')); if (!m) throw new Error('không thấy pt-data');
  fs.writeFileSync(a[1], m[1].replace(/\\u003c/g, '<')); stat(rdJ(a[1]));
} else if (cmd === 'add') {
  const [dataF, dir, mediaF] = a; const d = rdJ(dataF);
  const rd = (f) => rdJ(path.join(dir, f));
  for (const p of rd('packs/index.json').packs) {
    const notes = {}, pdf = {};
    for (const [lesson, f] of Object.entries(p.notes || {})) { const n = rd(f); notes[lesson] = n.pages; if (n.imgs) pdf[lesson] = { imgs: n.imgs, pno: n.pno }; }
    const np = { code: p.code, cards: p.file ? rd(p.file).cards : [], cases: p.cases ? rd(p.cases) : null, notes, pdf };
    const i = d.packs.findIndex((x) => x.code === p.code);
    if (i >= 0) d.packs[i] = np; else d.packs.push(np);
    console.log(`${i >= 0 ? 'thay' : 'thêm'} ${p.code}`);
  }
  if (mediaF) Object.assign(d.media, rdJ(mediaF));
  fs.writeFileSync(dataF, JSON.stringify(d)); stat(d);
} else if (cmd === 'drop') {
  const d = rdJ(a[0]); d.packs = d.packs.filter((p) => !a.slice(1).includes(p.code));
  fs.writeFileSync(a[0], JSON.stringify(d)); stat(d);
} else if (cmd === 'inline') {
  const [page, dataF, out] = a;
  const json = fs.readFileSync(dataF, 'utf8').replace(/</g, '\\u003c');
  let html = fs.readFileSync(page, 'utf8').replace(TAG, '');
  const at = html.indexOf('<script>'); if (at < 0) throw new Error('không thấy <script> trong trang');
  fs.writeFileSync(out, html.slice(0, at) + `<script type="application/json" id="pt-data">${json}</script>\n` + html.slice(at));
  const mb = fs.statSync(out).size / 1048576;
  console.log(`${out}: ${mb.toFixed(2)} MB${mb > 15.5 ? '  ⚠ sát giới hạn 16 MB: drop môn đã thi hoặc nén hình' : ''}`);
} else if (cmd === 'stat') stat(rdJ(a[0]));
else console.log('lệnh: extract | add | drop | inline | stat');
