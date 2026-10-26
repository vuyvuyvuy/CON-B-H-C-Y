import { ExamCountdown } from "@/components/ExamCountdown";
import { RankCard } from "@/components/RankCard";
import Link from "next/link";

// Demo stats; khi có Supabase thì lấy từ bảng profiles (realtime)
const DEMO_STATS = { total: 214, wrong: 61, killed: 4, saved: 9, streak: 6, due: 87, graves: 2 };

export default function DashboardPage() {
  const s = DEMO_STATS;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Bảng tử thần</h1>
        <p className="text-zinc-400">Y Việt – Đức · Năm học 2026–2027 · Học kỳ 1</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ExamCountdown />

        <aside className="space-y-4">
          <RankCard total={s.total} wrong={s.wrong} killed={s.killed} saved={s.saved} />

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Streak" value={`${s.streak}🔥`} hint="Đứt là về 0" />
            <Stat label="Thẻ đến hạn" value={s.due} hint="Đang đợi bạn" warn={s.due > 50} />
            <Stat label="Đã tiễn" value={`${s.killed}🪦`} hint="Linh hồn" warn />
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
