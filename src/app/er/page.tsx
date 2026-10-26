import Link from "next/link";
import { EmergencyCase } from "@/components/EmergencyCase";
import { DEMO_CASE } from "@/data/demo-case";
import { hasSupabase } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

interface QueueRow {
  case_id: string;
  title: string;
  topic: string;
  difficulty: number;
  deck_name: string;
  due_cards: number;
  total_cards: number;
  next_exam_at: string | null;
  active_run: string | null;
  deaths: number;
}

const SKULLS = ["", "☠", "☠☠", "☠☠☠"];

export default async function ERPage() {
  if (!hasSupabase) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-black tracking-tight">Phòng cấp cứu</h1>
        <p className="text-sm text-zinc-500">Chế độ DEMO — chấm điểm local, không lưu.</p>
        <EmergencyCase data={DEMO_CASE} />
      </div>
    );
  }

  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("case_queue", { p_limit: 30 });
  const queue = (data ?? []) as QueueRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Phòng cấp cứu</h1>
        <p className="text-zinc-400">Xếp theo: ca đang dở → nhiều thẻ đến hạn → môn sắp thi.</p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
          <p className="text-lg font-bold">Khoa vắng tanh.</p>
          <p className="text-zinc-400">Chưa có ca nào vì bạn chưa nạp thẻ. Lười tới mức bệnh nhân còn chưa kịp nhập viện.</p>
          <Link href="/import" className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 font-bold">Nạp file Anki / PDF</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {queue.map((c) => (
            <li key={c.case_id}>
              <Link
                prefetch={false} // mở trang = mở lượt chơi trên server; không để prefetch tạo lượt ma
                href={`/er/${c.case_id}`}
                className={`block h-full rounded-2xl border p-4 transition hover:bg-zinc-900 ${c.active_run ? "border-red-700 bg-red-950/30" : "border-zinc-800 bg-zinc-900/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">{c.topic}</p>
                  <span className="text-xs text-red-400">{SKULLS[c.difficulty]}</span>
                </div>
                <p className="mt-1 text-lg font-bold">{c.title}</p>
                <p className="text-sm text-zinc-500">{c.deck_name}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {c.active_run && <span className="rounded bg-red-600 px-2 py-0.5 font-bold">ĐANG CẤP CỨU</span>}
                  <span className={`rounded px-2 py-0.5 ${c.due_cards ? "bg-amber-900/60 text-amber-300" : "bg-zinc-800 text-zinc-400"}`}>
                    {c.due_cards}/{c.total_cards} thẻ đến hạn
                  </span>
                  {c.deaths > 0 && <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">🪦 ×{c.deaths}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
