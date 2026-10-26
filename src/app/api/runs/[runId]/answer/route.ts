/**
 * POST /api/runs/:runId/answer
 * body: { opId, stepId, optionId, elapsedMs, reviewedAt, deviceId }
 *
 * opId do client sinh (crypto.randomUUID) và lưu trong outbox IndexedDB khi offline,
 * nên gửi lại bao nhiêu lần cũng chỉ được tính 1 lần.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { newCardSrs, ratingFromAnswer, schedule } from "@/lib/srs";
import type { CardSrs } from "@/lib/types";

const Body = z.object({
  opId: z.string().uuid(),
  stepId: z.string().uuid(),
  optionId: z.enum(["a", "b", "c", "d"]),
  elapsedMs: z.number().int().nonnegative(),
  reviewedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().uuid().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const b = body.data;

  const supabase = await supabaseServer();
  const { data: step } = await supabase.from("case_steps").select("options, card_ids, case_id").eq("id", b.stepId).single();
  if (!step) return NextResponse.json({ error: "Không thấy bước này" }, { status: 404 });

  const correct = (step.options as { id: string; is_correct: boolean }[]).some((o) => o.id === b.optionId && o.is_correct);
  const rating = ratingFromAnswer(correct, b.elapsedMs);

  // Kỳ thi gần nhất của môn chứa deck này => SRS không xếp lịch sau ngày thi
  const { data: exam } = await supabase
    .from("clinical_cases")
    .select("decks!inner(subject_id, subjects(exams(exam_at, is_done)))")
    .eq("id", step.case_id)
    .maybeSingle();
  const examAt = ((exam as any)?.decks?.subjects?.exams ?? [])
    .filter((e: { is_done: boolean; exam_at: string }) => !e.is_done && new Date(e.exam_at) > new Date())
    .map((e: { exam_at: string }) => new Date(e.exam_at))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0] ?? null;

  const { data: current } = await supabase.from("card_srs").select("*").in("card_id", step.card_ids);
  const byId = new Map((current ?? []).map((r: CardSrs) => [r.card_id, r]));
  const now = new Date(b.reviewedAt);
  const srs = (step.card_ids as string[]).map((id) => ({
    ...schedule(byId.get(id) ?? newCardSrs(id, now), rating, now, examAt),
    rating,
  }));

  const { data, error } = await supabase.rpc("submit_case_answer", {
    p_op_id: b.opId,
    p_run_id: runId,
    p_step_id: b.stepId,
    p_option_id: b.optionId,
    p_device_id: b.deviceId,
    p_elapsed_ms: b.elapsedMs,
    p_reviewed_at: b.reviewedAt,
    p_srs: srs,
  });
  if (error) {
    const status = /RUN_NOT_ACTIVE|STEP_OUT_OF_ORDER/.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ...data, rating });
}
