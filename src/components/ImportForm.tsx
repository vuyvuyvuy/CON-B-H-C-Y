"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Job {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  stats: { cards?: number; clusters?: number; cases?: number; skipped?: { topic: string; reason: string }[]; scannedPages?: number[] };
  decks?: { name: string } | null;
}

const STAGE: Record<string, string> = {
  queued: "Đang xếp hàng",
  parsing: "Đang mổ file",
  embedding: "Đang đọc hiểu thẻ",
  clustering: "Đang gom bệnh lý",
  generating: "Đang viết kịch bản ca",
  validating: "Giám khảo đang soi",
  done: "Xong",
  failed: "Thất bại",
};

export function ImportForm({ subjects, recentJobs }: { subjects: { id: string; code: string; name: string }[]; recentJobs: Job[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(recentJobs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theo dõi tiến độ realtime (import trên PC, xem tiến độ trên điện thoại cũng được)
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel("import_jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "import_jobs" }, (p) => {
        const row = p.new as Job;
        setJobs((js) => {
          const i = js.findIndex((j) => j.id === row.id);
          if (i < 0) return [row, ...js].slice(0, 5);
          const copy = [...js];
          copy[i] = { ...copy[i], ...row };
          return copy;
        });
        if (row.status === "done") router.refresh();
      })
      .subscribe();
    return () => void sb.removeChannel(ch);
  }, [router]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const res = await fetch("/api/import", { method: "POST", body: new FormData(form) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Upload thất bại");
    form.reset();
    const { jobId } = await res.json();
    setJobs((js) => (js.some((j) => j.id === jobId) ? js : [{ id: jobId, status: "parsing", progress: 0, error: null, stats: {} }, ...js]));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-sm text-zinc-400">File .apkg hoặc .pdf</span>
          <input name="file" type="file" required accept=".apkg,.pdf" className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-zinc-100" />
        </label>
        <label>
          <span className="text-sm text-zinc-400">Môn</span>
          <select name="subjectId" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
            <option value="">— Không gắn môn —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm text-zinc-400">Tên deck (tuỳ chọn)</span>
          <input name="deckName" placeholder="Mặc định = tên file" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2" />
        </label>
        <p className="text-xs text-zinc-500 sm:col-span-2">Gắn môn để lịch ôn không bị xếp sau ngày thi của môn đó.</p>
        <button disabled={busy} className="rounded-lg bg-red-600 py-2 font-bold hover:bg-red-500 disabled:opacity-50 sm:col-span-2">
          {busy ? "Đang tải lên…" : "Nhập viện hàng loạt"}
        </button>
        {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
      </form>

      {jobs.length > 0 && (
        <ul className="space-y-2">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{j.decks?.name ?? "File mới"}</span>
                <span className={j.status === "failed" ? "text-red-400" : j.status === "done" ? "text-emerald-400" : "text-zinc-400"}>
                  {STAGE[j.status] ?? j.status}
                </span>
              </div>
              {j.status !== "done" && j.status !== "failed" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-800">
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.round(j.progress * 100)}%` }} />
                </div>
              )}
              {j.status === "done" && (
                <p className="mt-1 text-xs text-zinc-400">
                  {j.stats.cards} thẻ → {j.stats.clusters} cụm → <b className="text-zinc-200">{j.stats.cases} ca</b>
                  {j.stats.skipped?.length ? ` · bỏ qua ${j.stats.skipped.length} cụm thiếu chất liệu` : ""}
                  {j.stats.scannedPages?.length ? ` · ${j.stats.scannedPages.length} trang scan không đọc được` : ""}
                </p>
              )}
              {j.error && <p className="mt-1 text-xs text-red-400">{j.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
