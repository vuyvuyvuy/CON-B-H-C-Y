# ✚ Con Bệnh Cấp Cứu

Ôn Anki bằng cách cứu bệnh nhân. Chọn sai thì bệnh nhân mất máu, thẻ bị đánh `AGAIN`, và app chửi bạn.
Bệnh nhân chết thì vào nghĩa trang, bạn phải "thắp nhang" (ôn lại thẻ sai) để chuộc lỗi.

## Chạy thử (không cần cấu hình)

```bash
npm install
npm run dev          # http://localhost:3000 — chế độ DEMO: dữ liệu mẫu, chấm điểm local
```

## Chạy thật (đồng bộ điện thoại / iPad / PC)

1. **Supabase**: tạo project → SQL Editor → chạy lần lượt `supabase/migrations/0001_init.sql`, `0002_gameplay.sql`.
   Authentication → Providers → Email: bật. Authentication → Email Templates → Magic Link: thêm `{{ .Token }}` để email có mã 6 số.
2. **Khoá**: `cp .env.example .env.local` rồi điền:
   - Supabase URL / anon key / service role key (Project Settings → API)
   - `OPENAI_API_KEY`
   - VAPID: `npx web-push generate-vapid-keys`
   - `CRON_SECRET`: chuỗi ngẫu nhiên bất kỳ
3. **Deploy** lên Vercel (khai báo cùng biến môi trường). Cron nhắc học:
   - Vercel Pro: `vercel.json` đã cấu hình 30 phút/lần.
   - Vercel Hobby: chạy `supabase/cron.sql` để Supabase gọi thay.
4. Trên iPhone/iPad: mở web bằng Safari → Chia sẻ → **Thêm vào MH chính** → mở từ icon → Dashboard → "Bật thông báo cục súc".

Đăng ký xong là có sẵn 15 học phần + 9 lịch thi Y Việt – Đức 2026–2027. Vào **Nạp thẻ** để thả file `.apkg` / `.pdf`.

## Kiểm thử

```bash
npm test             # unit test: SRS, câu chửi, danh hiệu, gom cụm, đọc .apkg
npm run typecheck
npm run test:db      # chạy migration + smoke test trên Postgres local có pgvector (DB_URL=...)
```

## Bản đồ code

| Đường dẫn | Nội dung |
|---|---|
| `supabase/migrations/` | Schema, RLS, Realtime, RPC chấm đáp án / mở lượt / thắp nhang / hàng đợi ca, seed lịch thi |
| `supabase/tests/` | Giả lập Supabase + smoke test toàn bộ vòng chơi |
| `docs/ARCHITECTURE.md` | Kiến trúc, sơ đồ luồng AI, cơ chế sync đa thiết bị |
| `src/lib/ai/` | Prompt ngầm, pipeline embed → gom cụm → gen → validate → audit |
| `src/lib/import/` | Đọc `.apkg` (anki2/anki21/anki21b), PDF → thẻ |
| `src/lib/srs.ts` | SM-2 + map quyết định lâm sàng → Again/Hard/Good/Easy |
| `src/lib/insults.ts`, `ranks.ts`, `push/messages.ts` | Câu chửi, danh hiệu, thông báo |
| `src/lib/outbox.ts`, `device.ts` | Hàng đợi offline, danh tính thiết bị, Web Push |
| `src/components/` | Countdown, ca cấp cứu, nghĩa trang, import… |
| `src/app/api/` | Import, chấm đáp án, thắp nhang, duyệt ca, thiết bị, cron |

## Bản Artifact cá nhân (không cần đăng nhập, không cần deploy)

`artifact/phong-truc.html` là bản một trang chạy thẳng trên claude.ai: https://claude.ai/artifact/Dcb23dMtWcJ8sTwkMoz4Z8
Dữ liệu (môn, bài, câu đề cũ, thẻ ôn, nghĩa trang) lưu trong kho của Artifact, chỉ chủ sở hữu đọc/ghi.
`artifact/seed.json` là dữ liệu nạp ban đầu (15 môn và lịch thi; chưa có bài và câu nào — thêm khi nạp đề).
