import { rankFor } from "@/lib/ranks";

export function RankCard(stats: { total: number; wrong: number; killed: number; saved: number }) {
  const rank = rankFor(stats);
  const rate = stats.total ? Math.round((stats.wrong / stats.total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Danh hiệu hiện tại</p>
      <p className={`mt-1 text-xl font-black ${rank.color}`}>{rank.title}</p>
      <p className="text-sm text-zinc-400">{rank.subtitle}</p>
      <p className="mt-3 font-mono text-xs text-zinc-500">
        Tỷ lệ sai {rate}% · {stats.wrong}/{stats.total} câu
      </p>
    </div>
  );
}
