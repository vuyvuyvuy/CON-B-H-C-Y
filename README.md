# ✚ Con Bệnh Cấp Cứu

Ôn Anki bằng cách cứu bệnh nhân. Chọn sai thì bệnh nhân mất máu, thẻ bị đánh `AGAIN`, và app chửi bạn.
Chọn sai đủ nhiều thì bệnh nhân ra nghĩa trang, và bạn phải "thắp nhang" (ôn lại thẻ sai) để chuộc lỗi.

```bash
npm install
npm run dev          # http://localhost:3000 — không cần .env, chạy chế độ DEMO
```

Có Supabase: chạy `supabase/migrations/0001_init.sql`, tạo bucket Storage `imports`, điền `.env.local` theo `.env.example`.

## Bản đồ code

| Đường dẫn | Nội dung |
|---|---|
| `supabase/migrations/0001_init.sql` | Schema: deck, card, SRS, ca lâm sàng, nghĩa trang, log sync, RLS, Realtime, RPC `submit_case_answer` |
| `docs/ARCHITECTURE.md` | Kiến trúc, sơ đồ luồng AI, cơ chế sync đa thiết bị |
| `src/lib/ai/prompts.ts` | Prompt ngầm + JSON schema gen ca |
| `src/lib/ai/generate-cases.ts` | Embed → gom cụm → gen → validate → audit |
| `src/lib/import/apkg.ts` | Đọc `.apkg` |
| `src/lib/srs.ts` | SM-2 + map quyết định lâm sàng → Again/Hard/Good/Easy |
| `src/lib/insults.ts` | Kho câu chửi theo mức độ nguy kịch, random không lặp |
| `src/lib/ranks.ts` | Danh hiệu: Lang băm, Sát thủ blouse trắng… |
| `src/lib/push/messages.ts` | Template push notification cục súc |
| `src/components/ExamCountdown.tsx` | Đếm ngược lịch thi (seed từ lịch YVD 26–27) |
| `src/components/EmergencyCase.tsx` | Màn hình ca cấp cứu: monitor, HP, chửi |
| `src/app/api/*` | Import, chấm đáp án, cron nhắc học |
