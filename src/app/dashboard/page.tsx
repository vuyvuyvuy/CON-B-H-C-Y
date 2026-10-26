import Link from "next/link";
import { ExamCountdown } from "@/components/ExamCountdown";
import { RankCard } from "@/components/RankCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PushToggle } from "@/components/PushToggle";
import { hasSupabase } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { SEED_EXAMS } from "@/data/exams";
import type { Exam } from "@/lib/types";

const DEMO = { total: 214, wrong: 61, killed: 4, saved: 9, streak: 6, best: 9, due: 87, graves: 2, name: "Demo" };

async function load() {
  if (!hasSupabase) return { s: DEMO, exams: SEED_EXAMS };
  const supabase = await supabaseServer();
  const now = new Date().toISOString();
  const [{ data: p }, due, graves, { data: exams }] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("card_srs").select("card_id", { count: "exact", head: true }).lte("due_at", now).neq("state", "suspended"),
    supabase.from("tombstones").select("id", { count: "exact", head: true }).is("redeemed_at", null),
    supabase.from("exams").select("id, title, exam_at, total_slides, slides_done, is_done").order("exam_at"),
  ]);
  return {
    s: {
      total: p?.total_answers ?? 0,
      wrong: p?.wrong_answers ?? 0,
      killed: p?.patients_killed ?? 0,
      saved: p?.patients_saved ?? 0,
      // streak đã đứt nhưng chưa ai cập nhật (chưa học hôm nay lẫn hôm qua)
      streak: isAlive(p?.last_study_date, p?.timezone) ? p?.streak_current ?? 0 : 0,
      best: p?.streak_best ?? 0,
      due: due.count ?? 0,
      graves: graves.count ?? 0,
      name: p?.display_name ?? "",
    },
    exams: (exams ?? []) as Exam[],
  };
}

function isAlive(last?: string | null, tz = "Asia/Ho_Chi_Minh") {
  if (!last) return false;
  const today = Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()));
  return today - Date.parse(last) <= 86_400_000;
}

export default async function DashboardPage() {
  const { s, exams } = await load();
  return (
    <div className="space-y-6">
      {hasSupabase && <LiveRefresh tables={["profiles", "card_srs", "tombstones"]} />}
      <div>
        <h1 className="text-3xl font-black tracking-tight">Bảng tử thần</h1>
        <p className="text-zinc-400">{s.name ? `${s.name} · ` : ""}Y Việt – Đức · Năm học 2026–2027</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ExamCountdown initial={exams} />

        <aside className="space-y-4">
          <RankCard total={s.total} wrong={s.wrong} killed={s.killed} saved={s.saved} />

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Streak" value={`${s.streak}🔥`} hint={`Kỷ lục ${s.best} · đứt là về 0`} />
            <Stat label="Thẻ đến hạn" value={s.due} hint="Đang đợi bạn" warn={s.due > 50} />
            <Stat label="Đã tiễn" value={`${s.killed}🪦`} hint="Linh hồn" warn={s.killed > 0} />
            <Stat label="Xuất viện" value={s.saved} hint="May mắn" />
          </div>

          <Link href="/er" className="block rounded-2xl bg-red-600 px-4 py-4 text-center text-lg font-black uppercase tracking-wide hover:bg-red-500">
            🚑 Nhận ca mới
          </Link>
          {s.graves > 0 && (
            <Link href="/graveyard" className="block rounded-2xl border border-zinc-700 px-4 py-3 text-center text-sm text-zinc-300 hover:bg-zinc-900">
              🕯️ {s.graves} ngôi mộ chưa được thắp nhang
            </Link>
          )}
          {hasSupabase && <PushToggle />}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string | number; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`font-mono text-2xl font-bold ${warn ? "text-red-400" : ""}`}>{value}</p>
      <p className="text-[11px] text-zinc-600">{hint}</p>
    </div>
  );
}
