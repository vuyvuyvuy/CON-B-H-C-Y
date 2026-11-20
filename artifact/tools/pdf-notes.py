# Bài soạn PDF -> (1) ảnh webp từng trang để xem nguyên bản trong app, (2) chữ từng trang để thẻ Anki dò ra số trang.
# python3 pdf-notes.py <bai.pdf> <CODE> <lesson> "<tên bài>" <outDir>
#   -> <outDir>/img/<CODE>_<lesson>_pNNN.webp  và  <outDir>/notes/<CODE>__<lesson>.json
#   notes JSON: {lesson, title, pages: [chữ trang 1..N], pno: [1..N], imgs: [tên file ảnh]}
#   Sau khi tải ảnh lên kho asset của artifact: python3 pdf-notes.py --urls <notes.json> <map.json> (map: tên file -> url)
import sys, os, re, json, subprocess, glob
from PIL import Image
if sys.argv[1] == '--urls':
    nf, mf = sys.argv[2:4]; n = json.load(open(nf)); m = json.load(open(mf))
    n['imgs'] = [m.get(os.path.basename(x), x) for x in n['imgs']]
    json.dump(n, open(nf, 'w'), ensure_ascii=False); sys.exit(print(nf, sum(1 for x in n['imgs'] if x.startswith(('http', '/'))), 'url'))
pdf, code, lesson, title, out = sys.argv[1:6]
os.makedirs(f'{out}/img', exist_ok=True); os.makedirs(f'{out}/notes', exist_ok=True)
np_ = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
tmp = f'{out}/img/_{code}_{lesson}'
subprocess.run(['pdftoppm', '-r', '110', '-png', pdf, tmp], check=True)
pages, imgs = [], []; anki = False   # trang thuộc phần "Thẻ Anki" in trong bài soạn: giữ ảnh, bỏ chữ để thẻ không dò nhầm vào đó
for p, png in enumerate(sorted(glob.glob(tmp + '-*.png')), 1):
    name = f'{code}_{lesson}_p{p:03d}.webp'
    im = Image.open(png).convert('RGB'); im.save(f'{out}/img/{name}', 'WEBP', quality=55, method=6); os.remove(png)
    t = subprocess.run(['pdftotext', '-layout', '-f', str(p), '-l', str(p), pdf, '-'], capture_output=True, text=True).stdout
    if re.search(r'^\s*Phần \d+\s*[–-]\s*Thẻ Anki', t, re.M | re.I): anki = True
    if anki and re.search(r'^\s*Phần \d+\s*[–-]\s*(Trắc nghiệm|Tình huống)', t, re.M | re.I): anki = False
    pages.append('' if anki else re.sub(r'\n{3,}', '\n\n', t).strip()); imgs.append(name)
json.dump(dict(lesson=lesson, title=title, pages=pages, pno=list(range(1, np_ + 1)), imgs=imgs), open(f'{out}/notes/{code}__{lesson}.json', 'w'), ensure_ascii=False)
kb = sum(os.path.getsize(f'{out}/img/{x}') for x in imgs) // 1024
print(f'{code}/{lesson}: {np_} trang, ảnh {kb} KB')
