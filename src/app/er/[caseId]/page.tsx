import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import type { ClinicalCase } from "@/lib/types";
import { CaseRunner } from "@/components/CaseRunner";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  if (!hasSupabase) notFound();
  const { caseId } = await params;
  const supabase = await supabaseServer();

  const [{ data: c }, { data: steps }] = await Promise.all([
    supabase.from("clinical_cases").select("id, title, topic, patient, opening, max_hp").eq("id", caseId).maybeSingle(),
    supabase.from("case_steps").select("id, step_order, narrative, question, options, hp_penalty, card_ids, vitals").eq("case_id", caseId).order("step_order"),
  ]);
  if (!c || !steps?.length) notFound();

  // Có lượt đang dở (kể cả bắt đầu trên máy khác) => chơi tiếp; không thì mở lượt mới
  const { data: run, error } = await supabase.rpc("start_run", { p_case_id: caseId });
  if (error || !run) notFound();

  const data = { ...c, steps } as unknown as ClinicalCase;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black tracking-tight">Phòng cấp cứu</h1>
      <CaseRunner key={run.id} data={data} runId={run.id} hp={run.hp} step={run.current_step} />
    </div>
  );
}
