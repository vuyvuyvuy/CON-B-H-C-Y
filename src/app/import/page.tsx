import { hasSupabase } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { ImportForm } from "@/components/ImportForm";
import { DraftCases, type Draft } from "@/components/DraftCases";

export default async function ImportPage() {
  if (!hasSupabase) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">Nạp thẻ</h1>
        <p className="text-zinc-400">Chế độ DEMO: cần cấu hình Supabase + OpenAI (xem README) để import .apkg / .pdf.</p>
      </div>
    );
  }
  const supabase = await supabaseServer();
  const [{ data: subjects }, { data: drafts }, { data: jobs }] = await Promise.all([
    supabase.from("subjects").select("id, code, name, semester").order("semester").order("name"),
    supabase.from("clinical_cases").select("id, title, topic, created_at, decks(name), case_steps(count)").eq("status", "draft").order("created_at", { ascending: false }),
    supabase.from("import_jobs").select("id, status, progress, stats, error, created_at, decks(name)").order("created_at", { ascending: false }).limit(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Nạp thẻ</h1>
        <p className="text-zinc-400">
          Thả file Anki (.apkg) hoặc slide bài giảng (.pdf). AI gom các thẻ cùng bệnh lý thành ca cấp cứu.
          ~150 thẻ ≈ 10–15 ca, mất vài phút.
        </p>
      </div>
      <ImportForm subjects={subjects ?? []} recentJobs={(jobs ?? []) as any} />
      <DraftCases drafts={(drafts ?? []).map((d: any) => ({
        id: d.id, title: d.title, topic: d.topic, deck: d.decks?.name ?? "", steps: d.case_steps?.[0]?.count ?? 0,
      })) as Draft[]} />
    </div>
  );
}
