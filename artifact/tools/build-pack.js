// Gói Anki + bài soạn -> pack tĩnh cho Artifact Phòng Trực
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const [notesJson, pdfDir, outDir] = process.argv.slice(2);
const CODE = 'TMH0054';
const LESSONS = [
  ['tmh1', 'Viêm mũi xoang cấp và mạn', 'ed38e6ab-1._VMX_cap_man_giang_tung_slide.pdf', 1792290905111],
  ['tmh2', 'Giải phẫu – sinh lý nghe và thăng bằng', '46039ef8-Bai2_GiaiPhau_SinhLy_Nghe_ThangBang.pdf', 1793016649274],
  ['tmh3', 'Ung thư vòm – ung thư thanh quản', 'b7850577-3._UngThuVom_UngThuThanhQuan_BaiSoan.pdf', 1792345669659],
  ['tmh4', 'Chấn thương Tai Mũi Họng', '9f512861-4._Chan_thuong_TMH_bai_soan.pdf', 1792397315254],
  ['tmh5', 'Viêm amidan – viêm VA', '686ff41d-5._Bai_soan_Viem_Amidan_Viem_VA.pdf', 1792553117676],
  ['tmh6', 'Dị vật đường ăn – đường thở', '0984d503-6._Di_vat_duong_an_duong_tho.pdf', 1792677133465],
  ['tmh7', 'Viêm tai giữa cấp và mạn', '2b70861c-7._Viem_tai_giua_cap_va_man.pdf', 1792820708958],
];
const deckToLesson = Object.fromEntries(LESSONS.map(([id, , , did]) => [did, id]));

// ---------- HTML -> cây ----------
const VOID = new Set(['br', 'img', 'hr', 'wbr']);
function parse(html) {
  const root = { tag: '#root', attrs: '', kids: [] }; const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|[^<]+|</g; let m;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok.startsWith('<!--')) continue;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      if (tok.startsWith('</')) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
      const node = { tag, attrs: m[2] || '', kids: [] };
      stack.at(-1).kids.push(node);
      if (!VOID.has(tag) && !/\/\s*$/.test(m[2] || '')) stack.push(node);
    } else stack.at(-1).kids.push({ text: tok });
  }
  return root;
}
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const escT = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = (n) => n.text !== undefined ? decode(n.text) : n.tag === 'br' ? '\n' : n.kids.map(textOf).join('');
const attr = (n, a) => (new RegExp(`${a}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(n.attrs) || [])[2] ?? (new RegExp(`${a}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(n.attrs) || [])[3];
function colorOf(style) {
  const m = /(?:^|;)\s*color\s*:\s*#([0-9a-f]{3,6})/i.exec(style || ''); if (!m) return null;
  let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const BADGE = /(RẤT HAY THI|HAY THI|CẦN NHỚ|NÊN BIẾT|NÊN NHỚ|ÍT RA THI|ĐỌC QUA)/;
const PRIO = { 'RẤT HAY THI': 3, 'HAY THI': 3, 'CẦN NHỚ': 2, 'NÊN BIẾT': 2, 'NÊN NHỚ': 2, 'ÍT RA THI': 1, 'ĐỌC QUA': 1 };
const SLIDE = /Slide\s+([A-Z]?\d+)/;

function convert(html, meta) {
  const tree = parse(html);
  const out = (n) => {
    if (n.text !== undefined) return escT(decode(n.text));
    const t = n.tag; const style = attr(n, 'style') || ''; const cls = attr(n, 'class') || '';
    const txt = textOf(n).trim();
    // nhãn ưu tiên + số slide: rút ra làm dữ liệu, bỏ khỏi nội dung
    if (txt.length < 60 && (BADGE.test(txt) || /^([^·•]*·\s*)?Slide\s+[A-Z]?\d+$/.test(txt) || /\bpri\b/.test(cls))) {
      const b = BADGE.exec(txt); if (b) meta.badge = Math.max(meta.badge || 0, PRIO[b[1]]);
      const s = SLIDE.exec(txt); if (s) meta.slide = s[1];
      const topic = /^(?:.*?(?:HAY THI|CẦN NHỚ|NÊN BIẾT|NÊN NHỚ|ÍT RA THI|ĐỌC QUA))?\s*([^·•]+?)\s*·\s*Slide/.exec(txt); if (topic && !BADGE.test(topic[1])) meta.topic = topic[1].replace(/^[^\p{L}]+/u, '').trim();
      return '';
    }
    const inner = () => n.kids.map(out).join('');
    if (t === 'img') { const src = attr(n, 'src'); return src && /^[\w.\-]+$/.test(src) ? `<img src="media/${src}" alt="">` : ''; }
    if (t === 'br') return '<br>';
    if (/border-left|background/.test(style) && txt.length > 0 || /\bnote\b/.test(cls)) return `<blockquote>${inner()}</blockquote>`;
    const c = colorOf(style);
    if (c) {
      const [r, g, b] = c;
      if (r > 150 && g < 170 && b < 100) return `<mark>${inner()}</mark>`;               // đỏ / cam: ý chính
      if (b > 150 && r < 100) return `<b>${inner()}</b>`;                                  // xanh: nhấn phụ
      if (Math.abs(r - g) < 30 && Math.abs(g - b) < 40 && r > 90) return `<small>${inner()}</small>`; // xám: ghi chú
    }
    if (['b', 'strong', 'i', 'em', 'u', 'sub', 'sup', 'ul', 'ol', 'li', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'small'].includes(t)) {
      const tag = t === 'strong' ? 'b' : t === 'em' ? 'i' : t;
      const body = inner(); return body.trim() ? `<${tag}>${body}</${tag}>` : '';
    }
    if (t === 'div' || t === 'p') { const body = inner(); return body.trim() ? `<div>${body}</div>` : ''; }
    return inner();
  };
  let h = tree.kids.map(out).join('');
  h = h.replace(/<b>(\s*<mark>[\s\S]*?<\/mark>\s*)<\/b>/g, '$1')
       .replace(/^(\s|<br>)+/, '').replace(/(\s|<br>)+$/, '').replace(/(<br>\s*){3,}/g, '<br><br>');
  return h;
}
const plain = (h) => decode(h.replace(/<br>|<\/div>|<\/li>|<\/blockquote>/g, '\n').replace(/<img[^>]*>/g, '[hình]').replace(/<[^>]+>/g, '')).replace(/\n{2,}/g, '\n').trim();

function prioFromTags(tags) {
  if (/(^| )(hay_thi|HighYield|TMH::UuTien::3sao|TMH::DiVat::HighYield)( |$)/.test(tags)) return 3;
  if (/(^| )(it_ra_thi|LowYield|TMH::UuTien::1sao)( |$)/.test(tags)) return 1;
  return 2;
}

// ---------- thẻ ----------
const notes = JSON.parse(fs.readFileSync(notesJson, 'utf8'));
const cards = []; const order = {};
for (const n of notes) {
  const lesson = deckToLesson[n.did]; if (!lesson) continue;
  const meta = {};
  const front = convert(n.f[0], meta); const back = convert(n.f[1] || '', meta);
  if (!plain(front)) continue;
  order[lesson] = (order[lesson] || 0) + 1;
  cards.push({
    id: 'a' + n.id, kind: 'anki', lesson, front, back,
    stem: plain(front), answer: plain(back) || '(xem hình)',
    prio: meta.badge || prioFromTags(n.tags), slide: meta.slide || null, topic: meta.topic || null,
    source: 'Anki · NĂM 4 › 1. TMH', n: order[lesson],
  });
}
// ---------- bài soạn: chữ theo từng trang ----------
fs.mkdirSync(path.join(outDir, 'packs'), { recursive: true }); fs.mkdirSync(path.join(outDir, 'notes'), { recursive: true });
const noteFiles = {};
for (const [id, name, file] of LESSONS) {
  const pdf = path.join(pdfDir, file);
  const pages = +/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf]).toString())[1];
  const arr = [];
  for (let p = 1; p <= pages; p++) arr.push(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), pdf, '-']).toString().replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
  const f = `notes/${CODE}__${id}.json`;
  fs.writeFileSync(path.join(outDir, f), JSON.stringify({ lesson: id, title: name, pages: arr }));
  noteFiles[id] = f;
}
fs.writeFileSync(path.join(outDir, `packs/${CODE}.json`), JSON.stringify({ code: CODE, version: 1, cards }));
fs.writeFileSync(path.join(outDir, 'packs/index.json'), JSON.stringify({ packs: [{ code: CODE, file: `packs/${CODE}.json`, count: cards.length, notes: noteFiles }] }, null, 1));
const by = {}; for (const c of cards) by[c.lesson] = (by[c.lesson] || [0, 0, 0, 0]), by[c.lesson][c.prio]++;
console.log('cards', cards.length, JSON.stringify(by), 'slides', cards.filter((c) => c.slide).length, 'imgs', cards.filter((c) => /<img/.test(c.front + c.back)).length);
console.log(JSON.stringify(LESSONS.map(([id, name]) => ({ id, name }))));
