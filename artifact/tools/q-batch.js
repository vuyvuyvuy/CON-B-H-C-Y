// Câu đề cũ / trắc nghiệm LT (JSON array) -> các file batch ≤50 câu để ghi vào kho bằng ArtifactData action "batch".
// node q-batch.js <CODE> <questions.json> <outDir>
// Mỗi câu: {id, stem, options:[{k,t}], answer, explanation, lesson, source, year, n, rep?, img?, aiAnswer?}
// Thêm b = bucket(id) (trang cần trường này để truy vấn) và createdAt; báo lỗi nếu thiếu trường bắt buộc.
// Ra: <outDir>/docs/<id>.json (nội dung từng câu) và <outDir>/batch_001.json ... mỗi file là mảng writes
//     [{op:"set", collection, doc_id, file_path}] — dán nguyên mảng vào tham số `writes` của ArtifactData batch.
// Câu đã có trong kho thì batch bị từ chối (thiếu if_version): đó là chủ ý, không ghi đè trạng thái ôn.
const fs = require('fs'); const path = require('path');
const [CODE, qF, outDir] = process.argv.slice(2);
const bucket = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 8; };   // y hệt phong-truc.html
const qs = JSON.parse(fs.readFileSync(qF, 'utf8'));
const errs = []; const seen = new Set(); const now = Date.now();
const writes = qs.map((q, i) => {
  const { id, ...data } = q;
  if (!id || !/^[A-Za-z0-9_\-]+$/.test(id)) errs.push(`#${i + 1}: id "${id}" không hợp lệ`);
  if (seen.has(id)) errs.push(`#${i + 1}: trùng id ${id}`); seen.add(id);
  if (!q.stem) errs.push(`${id}: thiếu stem`);
  if (!q.lesson) errs.push(`${id}: thiếu lesson`);
  if (q.options?.length) {
    if (!q.options.some((o) => o.k === q.answer)) errs.push(`${id}: đáp án ${q.answer} không có trong lựa chọn`);
  } else if (!q.answer) errs.push(`${id}: thiếu đáp án`);
  if (q.year && !/^\d{8}$/.test(String(q.year))) errs.push(`${id}: year phải là YYYYMMDD`);
  data.b = bucket(id); data.createdAt ??= now + i;
  return { op: 'set', collection: `subjects/${CODE}/questions`, doc_id: id, data };
});
if (errs.length) { console.log('LỖI:\n' + errs.join('\n')); process.exit(1); }
const docs = path.resolve(outDir, 'docs'); fs.mkdirSync(docs, { recursive: true });
let n = 0;
for (let i = 0; i < writes.length; i += 50) {
  const chunk = writes.slice(i, i + 50).map(({ data, ...w }) => {
    const f = path.join(docs, `${w.doc_id}.json`); fs.writeFileSync(f, JSON.stringify(data));
    return { ...w, file_path: f };
  });
  fs.writeFileSync(path.join(outDir, `batch_${String(++n).padStart(3, '0')}.json`), JSON.stringify(chunk));
}
console.log(`${writes.length} câu -> ${n} batch trong ${outDir}`);
