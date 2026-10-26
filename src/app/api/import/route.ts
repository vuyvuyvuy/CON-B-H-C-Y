/**
 * POST /api/import  (multipart: file=.apkg|.pdf, deckName, subjectId?)
 *
 * Trả về ngay jobId; phần nặng (embed + gen) chạy tiếp sau khi response đã gửi
 * (next/server `after`). Client subscribe realtime bảng import_jobs để xem tiến độ.
 * Production nên chuyển phần sau sang queue (Supabase Edge Function + pg_net / Inngest)
 * vì serverless có giới hạn thời gian.
 */
import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { parseApkg, ApkgError, type ParsedCard } from "@/lib/import/apkg";
import { pdfToCards } from "@/lib/import/pdf";
import { cardsToCases } from "@/lib/ai/generate-cases";
import { PROMPT_VERSION } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Đăng nhập đi rồi hẵng cứu người." }, { status: 401 });
  const userId = auth.user.id;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
  const isApkg = file.name.toLowerCase().endsWith(".apkg");
  const isPdf = file.name.toLowerCase().endsWith(".pdf");
  if (!isApkg && !isPdf) return NextResponse.json({ error: "Chỉ nhận .apkg hoặc .pdf" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File quá 50MB. Bỏ bớt media trong deck rồi export lại." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  await supabase.storage.from("imports").upload(path, bytes);

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .insert({
      user_id: userId,
      name: String(form.get("deckName") || file.name.replace(/\.\w+$/, "")),
      subject_id: form.get("subjectId") || null,
      source: isApkg ? "apkg" : "pdf",
      source_path: path,
    })
    .select()
    .single();
  if (deckErr) return NextResponse.json({ error: deckErr.message }, { status: 500 });

  const { data: job } = await supabase
    .from("import_jobs")
    .insert({ user_id: userId, deck_id: deck.id, status: "parsing" })
    .select()
    .single();

  after(async () => {
    const setJob = (patch: Record<string, unknown>) => supabase.from("import_jobs").update(patch).eq("id", job!.id);
    try {
      let parsed: ParsedCard[];
      let scannedPages: number[] = [];
      if (isPdf) {
        // PDF: trích text -> LLM sinh thẻ Q/A (front/back + tag) -> đi tiếp y như apkg
        await setJob({ status: "parsing", progress: 0.02 });
        const { data: subj } = deck.subject_id
          ? await supabase.from("subjects").select("name").eq("id", deck.subject_id).maybeSingle()
          : { data: null };
        ({ cards: parsed, scannedPages } = await pdfToCards(bytes, subj?.name ?? deck.name));
        if (!parsed.length) {
          throw new ApkgError(
            scannedPages.length
              ? `PDF toàn ảnh scan (${scannedPages.length} trang), không trích được chữ. Hãy dùng bản PDF có text.`
              : "Không tạo được thẻ nào từ PDF này.",
          );
        }
      } else {
        parsed = await parseApkg(bytes);
      }
      if (!parsed.length) throw new ApkgError("File không có thẻ nào.");

      const { data: inserted, error } = await supabase
        .from("cards")
        .upsert(
          parsed.map((c) => ({
            user_id: userId,
            deck_id: deck.id,
            anki_note_id: c.ankiNoteId || null,
            anki_card_id: c.ankiCardId || null,
            front: c.front,
            back: c.back,
            extra: c.extra,
            tags: c.tags,
            content_hash: c.contentHash,
          })),
          { onConflict: "deck_id,content_hash" },
        )
        .select("id, front, back, tags");
      if (error) throw error;
      await supabase.from("decks").update({ card_count: inserted.length }).eq("id", deck.id);

      const { cases, skipped, clusterCount } = await cardsToCases(inserted, async (status, progress) => {
        await setJob({ status, progress });
      });

      await setJob({ status: "validating", progress: 0.97 });
      for (const { case: gc, cardIds, auditIssues } of cases) {
        const { data: cc } = await supabase
          .from("clinical_cases")
          .insert({
            user_id: userId,
            deck_id: deck.id,
            job_id: job!.id,
            title: gc.title,
            topic: gc.topic,
            patient: gc.patient,
            opening: gc.opening,
            difficulty: gc.difficulty,
            // Giám khảo AI bắt lỗi => để draft cho user duyệt, không ném thẳng vào gameplay
            status: auditIssues.length ? "draft" : "published",
            model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
            prompt_version: PROMPT_VERSION,
          })
          .select("id")
          .single();
        await supabase.from("case_steps").insert(
          gc.steps.map((s, i) => ({ ...s, case_id: cc!.id, step_order: i })),
        );
        await supabase.from("case_cards").insert(cardIds.map((card_id) => ({ case_id: cc!.id, card_id })));
      }

      await setJob({
        status: "done",
        progress: 1,
        stats: { cards: inserted.length, clusters: clusterCount, cases: cases.length, skipped, scannedPages },
      });
    } catch (e) {
      console.error("import failed", e);
      await setJob({ status: "failed", error: e instanceof ApkgError ? e.message : "Lỗi hệ thống khi xử lý file. Thử lại sau." });
    }
  });

  return NextResponse.json({ jobId: job!.id, deckId: deck.id }, { status: 202 });
}
