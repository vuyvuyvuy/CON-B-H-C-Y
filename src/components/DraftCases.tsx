"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Draft {
  id: string;
  title: string;
  topic: string;
  deck: string;
  steps: number;
}

/** Ca bị "giám khảo AI" bắt lỗi nằm ở đây chờ người duyệt — không tự vào gameplay. */
export function DraftCases({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!drafts.length) return null;

  const act = async (id: string, method: "PATCH" | "DELETE") => {
    setBusy(id);
    await fetch(`/api/cases/${id}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(method === "PATCH" && { body: JSON.stringify({ status: "published" }) }),
    });
    setBusy(null);
    router.refresh();
  };

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">Ca nháp cần duyệt ({drafts.length})</h2>
      <p className="text-sm text-zinc-400">Giám khảo AI nghi có lỗi kiến thức (2 đáp án đúng, số liệu không có trong thẻ…). Chơi thử rồi quyết định.</p>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
            <div>
              <p className="font-semibold">{d.title}</p>
              <p className="text-xs text-zinc-500">{d.topic} · {d.deck} · {d.steps} bước</p>
            </div>
            <div className="flex gap-2">
              <a href={`/er/${d.id}`} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm">Chơi thử</a>
              <button disabled={busy === d.id} onClick={() => act(d.id, "PATCH")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Duyệt</button>
              <button disabled={busy === d.id} onClick={() => act(d.id, "DELETE")} className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Xoá</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
