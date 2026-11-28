# CLAUDE.md — Con Bệnh Cấp Cứu / Phòng Trực

## Quy tắc phiên làm việc

- Làm trên nhánh **`claude/medical-srs-app`**. Không tạo nhánh mới.
- Mỗi lần nhập tài liệu xong: ghi một dòng vào `docs/IMPORT_LOG.md`, commit, `git push -u origin claude/medical-srs-app`.
- Tài liệu học (thẻ, bài soạn, đề) là dữ liệu cá nhân: **không commit nội dung vào repo**. Repo chỉ giữ code trang,
  script trong `artifact/tools/` và nhật ký nhập (số lượng, tên đề; không chép câu hỏi).
- Viết tiếng Việt với Vy (người dùng). Khi Vy gửi slide và nhờ soạn bài / làm thẻ Anki thì dùng skill
  `soan-bai-lam-sang`; skill đó ra bài soạn PDF + `.apkg`, rồi mới nhập vào app theo quy trình dưới.

## App thật là Artifact, không phải bản Next.js

App Vy dùng hằng ngày là **Phòng Trực**: `artifact/phong-truc.html`, publish tại
https://claude.ai/artifact/Dcb23dMtWcJ8sTwkMoz4Z8 (riêng tư, capabilities `db` + `assets` + `sample`).
Thư mục `src/`, `supabase/` là bản web cũ, không đụng khi nhập tài liệu.

Dữ liệu nằm ở hai chỗ:

| Loại | Nằm ở đâu | Ghi bằng |
|---|---|---|
| Môn, danh sách bài, lịch thi | kho db `subjects/<CODE>` | `ArtifactData` |
| Đề cũ (câu thi các năm) | kho db `subjects/<CODE>/questions/<id>` (đủ nội dung) | `ArtifactData` batch |
| Trắc nghiệm LT tự soạn | kho db, như đề cũ nhưng id bắt đầu `lt_` | `ArtifactData` batch |
| Thẻ Anki, bài soạn (chữ từng trang), ca tình huống, hình | nhúng trong trang ở `<script id="pt-data">` | build + publish lại trang |
| Ảnh trang PDF bài soạn | asset `/_blob/<id>` + db `pgimg/<id>` `{d: data URI}` + file `pg/<id>.webp` | Artifact asset + `ArtifactData` |
| Trạng thái ôn của mọi câu/thẻ (card, seen, wrong…) | db `subjects/<CODE>/questions/<id>` | trang tự ghi — **không bao giờ ghi đè** |

Thẻ Anki chỉ có trạng thái trong db (doc chỉ có `b`, `card`, `seen`…); nội dung nằm trong pack nhúng. Vì vậy
**id thẻ/câu phải giữ nguyên giữa các lần build**, đổi id là mất tiến độ ôn của Vy.

Môn hiện có (mã → tên): TMH0054 Tai Mũi Họng, THH0049 Tâm thần, DL0050 Da liễu LS, DL0050LT Da liễu LT, MAT Mắt,
TKLS Nội Thần kinh LS, TK0055 Thần kinh LT, GMHS0058 GMHS, SPK0052 Sản, NHI0053 Nhi, và các môn HK2 chưa có bài.
Đọc `subjects` trong db để biết danh sách mới nhất trước khi nhập.

## Bước 0 — luôn làm trước khi nhập

1. Đọc trang đang chạy: `Artifact` action `read` url ở trên (bắt buộc trước khi publish lại).
2. Tải `index.html` đang chạy (`Artifact` read, `path: "index.html"`) rồi tách dữ liệu nhúng:
   `node artifact/tools/live-data.js extract <index.html tải về> <scratch>/data.json`
   (bản build gốc không còn; data.json này là nguồn duy nhất của thẻ/bài soạn/ca các môn đang có).
3. Đọc `subjects/<CODE>` (lấy `lessons`, `version`) và liệt kê `subjects/<CODE>/questions` (`out_dir`) để
   biết id nào đã có, tránh trùng.

## A. Nhập đề cũ (PDF/ảnh/text đề thi các năm)

1. Tách từng câu: `stem`, `options` `[{k:"A",t:"…"}]` giữ đúng chữ cái đề, `answer` một chữ cái.
   Đề có đáp án/bảng đáp án thì dùng; không có thì tự giải theo sách VN và đặt `aiAnswer: true`.
   Không gộp, không bỏ, không bịa câu; chỉ sửa lỗi OCR hiển nhiên. Không đưa "Câu 3." vào stem.
2. Mỗi câu ghi thêm:
   - `id`: `dc_<môn viết thường>_c<số>` nối tiếp số lớn nhất đang có (vd `dc_mat_c1640`); đề TMH cũ dùng `e<đề>_n<câu>`.
   - `lesson`: id bài có sẵn trong `subjects/<CODE>.lessons`. Không khớp bài nào thì thêm bài mới vào `lessons`
     (id ngắn, tên kiểu giáo trình) — sửa doc môn bằng `update` kèm `if_version`.
   - `source`: tên đề, ví dụ `"RHM2023 · Đề cuối kì Mắt (18/12/2025)"`; cùng một đề thì cùng một chuỗi
     (trang gom theo `source` để "làm lại nguyên đề").
   - `year`: ngày thi dạng số `YYYYMMDD` (không rõ ngày thì `YYYYMM00`). `n`: số thứ tự câu trong đề.
   - `explanation`: 1–3 câu vì sao đúng, bám đáp án bộ môn.
   - `rep` (tuỳ chọn): danh sách `source` của các đề từng ra câu này hoặc biến thể của nó, gồm cả đề hiện tại.
     Câu trùng với câu đã có trong kho thì **không tạo câu mới**: thêm đề mới vào `rep` của câu cũ (`update` + `if_version`).
   - `img` (tuỳ chọn): hình của câu, tải lên asset rồi ghi `"/_blob/<id>"`; thêm data URI vào `data.media`
     với khoá `"/_blob/<id>"` và publish lại trang (app iPad/iPhone không tải được `/_blob`).
3. Ghi vào kho:
   `node artifact/tools/q-batch.js <CODE> <questions.json> <scratch>/qb` → mỗi `batch_NNN.json` là mảng
   `writes` (≤50 câu, dùng `file_path`) — truyền vào `ArtifactData` action `batch`. Script tự thêm `b = bucket(id)`
   (thiếu `b` thì trang không thấy câu) và `createdAt`.
4. Báo lại Vy: số câu theo bài, số câu AI giải, số câu trùng đã gộp vào `rep`.

## B. Nhập trắc nghiệm LT tự soạn

Như A, khác ở: `id` = `lt_<môn>_<bài>_<a|b|c><n>` (vd `lt_mat_mat3_b4`; tiền tố `lt_` là thứ tách nó khỏi Đề cũ),
`source: "Trắc nghiệm LT · tự soạn"`, `year` = ngày soạn `YYYYMMDD`. 4 lựa chọn, đáp án đúng không dài hơn hẳn
các lựa chọn sai.

## C. Nhập bộ thẻ Anki + bài soạn (+ ca tình huống) cho một môn

Đầu vào: `.apkg` (thường do skill `soan-bai-lam-sang` tạo) và bài soạn PDF từng bài.
Mọi file tải về/giải nén để trong thư mục riêng của scratchpad.

1. Môn + bài: tạo/cập nhật `subjects/<CODE>` với `{name, order, semester, exams:[{title, at:"…+07:00", done:false}],
   lessons:[{id, name}]}`. Id bài khớp với id dùng trong pack (vd `mat1`, `tkls_b5`).
2. Đọc `.apkg`: `node artifact/tools/dump-apkg.js <x.apkg> <scratch>/notes.json` (in deck id, tag),
   hình: `node artifact/tools/extract-media.js <x.apkg> <scratch>/media`.
3. Pack thẻ: `node artifact/tools/build-pack.js <notes.json> <pdfDir> <outDir> <cfg.json>` với
   cfg `{code, source:"Anki · <Môn> › …", lessons:[[id, tên, file pdf, deck id]], prio3:"regex tag", prio1:"regex tag"}`.
   Id thẻ = `"a" + note id` của Anki, nên build lại từ cùng `.apkg` thì giữ nguyên id.
   (Các pack MAT/TKLS/TK0055 hiện tại dùng id kiểu `mat1_001`; khi build lại môn đã có phải giữ đúng id cũ —
   so với `data.json` trước khi thay.)
4. Câu bựa + mẹo: mỗi thẻ có `fun` (câu dễ thuộc, `**đậm**` = keyword) và `meo` (mẹo nhớ). Viết file
   `fun/<lesson>.txt` dạng `N| câu`, kiểm tra `node artifact/tools/check-fun.js <pack> <lesson> <fun.txt>`
   (không được rơi số hay keyword đỏ), gắn bằng `add-fun.js`. `meo` gắn tương tự vào trường `meo`.
5. Ca tình huống mỗi bài: file `{lesson, cases:[{title, setting, qs:[{stem, opts:[đúng, sai, sai, sai], why, covers:[số thẻ]}]}]}`,
   kiểm tra `check-cases.js` (phủ hết thẻ ★★★/★★), build `build-cases.js <pack> <outDir> <files…>`.
6. Bài soạn có ảnh trang: `DPI=110 python3 artifact/tools/pdf-notes.py <bai.pdf> <CODE> <lesson> "<tên>" <outDir>`
   → tải ảnh `img/*.webp` lên asset (`Artifact` publish `asset: true`, `file_paths`) → map tên→`/_blob/<id>` →
   `pdf-notes.py --urls <notes.json> <map.json>`; với mỗi ảnh ghi db `pgimg/<id>` `{d: "data:image/webp;base64,…"}`
   và đưa file vào `files` của lần publish dưới tên `pg/<id>.webp`.
7. Hình thẻ: `media-map.json` `{ "tên.jpg": "data:image/…;base64,…" }` (data URI, vì app di động không tải `/_blob`).
8. Gộp và nhúng:
   ```
   node artifact/tools/live-data.js add    <scratch>/data.json <outDir> <media-map.json>
   node artifact/tools/live-data.js inline artifact/phong-truc.html <scratch>/data.json <scratch>/out.html
   ```
   Trang phải ≤ 16 MB. Sát giới hạn thì `live-data.js drop <data.json> <CODE>` bỏ môn đã thi xong
   (trạng thái ôn vẫn nằm trong db) hoặc giảm DPI/chất lượng ảnh.
9. Publish: `Artifact` publish `url` = link ở trên, `file_path` = `out.html` (+ `files` cho `pg/*.webp` mới).
   Không truyền `capabilities` (giữ nguyên). Mở trang kiểm tra môn mới hiện đủ bài, thẻ, ca.

## Sửa code trang

Sửa `artifact/phong-truc.html` trong repo (đây là bản gốc, không có pt-data), rồi làm lại bước C.8–C.9 với
`data.json` tách từ bản đang chạy để dữ liệu không mất. Commit thay đổi code.

## Kiểm tra nhanh sau khi nhập

- `node artifact/tools/live-data.js stat <data.json>`: số thẻ/ca/bài soạn từng môn.
- `ArtifactData` list `subjects/<CODE>/questions` với `out_dir`: đếm câu mới, xem vài doc có đủ `b`, `lesson`, `source`.

## Khu M2 AMBOSS (tách hẳn khỏi Phòng Trực)

Artifact riêng **M2 Lernplan**: `artifact/m2-amboss.html`, publish tại https://claude.ai/artifact/57MNiEaRFALmsUUzJRL1Ap
(riêng tư, capabilities `db` + `sample` + `downloads`). Không đụng Phòng Trực khi sửa khu này, và ngược lại.

Kho db riêng:
- `cfg/plan` {start, rest, perDay, target?, kqTotal, cpc}; `days/<YYYYMMDD>` {min, kq, kmin, amin, rv, rvms, nv, nw, ch, tk, r0}
- `kap/<id>` tiến độ chương (+ `nc`/`nd` số thẻ đang ôn/chờ duyệt); `txt/<id>-<k>` bài AMBOSS Vy dán; `easy/<id>` bài dễ hiểu; `mk/<id>` đánh dấu
- `cards/<ch>` {ch, due, list} thẻ Anki theo chương (`<ch>~2` doc phụ khi đầy; `_d<Tag>` thẻ chung của Tag; `_fall`; `_apkg-<n>` ngoài lộ trình); `img/<khoá>` hình thẻ dùng chung, mỗi hình 1 lần (data URI, 600px ≤~30KB), `imgidx/main` danh sách khoá; `voc/<id>` từ vựng Bước 1 của chương (học trước khi đọc, gạch chân trong bài); `dict/<từ>`; `chat/<id>`
- Nhập Ankiphil: gắn Tag theo tag `$Lernpläne::100-Tage::NNN`, chọn chương trong Tag theo tên (xem `bestInDay`)

Prompt: quy tắc soạn thẻ kiến thức ở `artifact/m2/prompts/the-kien-thuc.md` (nhúng lúc build); bài dễ hiểu `EASY_PROMPT` trong trang.
SRS: FSRS-5 tham số mặc định (`schedule` trong trang; `cfg.ret` mức nhớ mong muốn), bước học 1′/10′; nhật ký ôn ở `rl/<YYYYMMDD>` {l:[[id, nút, ngày cách, giờ, ms]]} để sau tối ưu tham số. Thẻ "!Hammer" ra trước. Thẻ kiến thức/apkg chỉ vào hàng ôn khi chương "Đọc xong".

Build: `python3 -I artifact/m2/tools/lernplan.py <M2_Lernplan.pdf> artifact/m2-amboss.html <scratch>/m2-out.html`
rồi `Artifact` publish `url` ở trên (đọc trang trước), không truyền `capabilities` nếu không đổi.
Id chương `t<Tag>_<số>` phải giữ nguyên (tiến độ đọc nằm trong db theo id). Danh sách chương AMBOSS không commit.
