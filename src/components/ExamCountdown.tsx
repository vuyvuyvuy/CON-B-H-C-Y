"use client";

import { useEffect, useMemo, useState } from "react";
import type { Exam } from "@/lib/types";
import { SEED_EXAMS } from "@/data/exams";
import { supabaseBrowser, supabaseEnabled } from "@/lib/supabase/client";

const TZ = "Asia/Ho_Chi_Minh";
const DAY = 86_400_000;

/** Số ngày lịch còn lại theo giờ VN — khớp cột "Số ngày còn lại" trong Google Sheet. */
export function calendarDaysUntil(iso: string, now: Date) {
  const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
  return Math.round((Date.parse(ymd(new Date(iso))) - Date.parse(ymd(now))) / DAY);
}

function verdict(days: number): { text: string; tone: string } {
  if (days < 0) return { text: "Đã thi. Kết quả thế nào thì lòng bạn tự biết.", tone: "text-zinc-500" };
  if (days === 0) return { text: "HÔM NAY. Cầu nguyện đi, học không kịp nữa đâu.", tone: "text-fuchsia-400" };
  if (days <= 3) return { text: "Vùng tử thần. Ngủ là xa xỉ phẩm.", tone: "text-red-500" };
  if (days <= 7) return { text: "Một tuần. Đủ để học... nếu bạn bỏ điện thoại xuống.", tone: "text-orange-400" };
  if (days <= 14) return { text: "Còn kịp. Câu này năm nào cũng có người nói, rồi rớt.", tone: "text-yellow-400" };
  return { text: "Còn xa. Đó chính xác là điều sinh viên rớt môn nghĩ.", tone: "text-emerald-400" };
}

function useExams(): Exam[] {
  const [exams, setExams] = useState<Exam[]>(SEED_EXAMS);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sb = supabaseBrowser();
    const load = () =>
      sb.from("exams").select("id, title, exam_at, total_slides, slides_done, is_done").order("exam_at")
        .then(({ data }) => data?.length && setExams(data as Exam[]));
    load();
    // Tick "đã thi" trên iPad => điện thoại cập nhật ngay
    const ch = sb.channel("exams").on("postgres_changes", { event: "*", schema: "public", table: "exams" }, load).subscribe();
    return () => void sb.removeChannel(ch);
  }, []);

  return exams;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null); // null khi SSR => tránh hydration mismatch
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function ExamCountdown() {
  const exams = useExams();
  const now = useNow();

  const { next, upcoming, past } = useMemo(() => {
    const t = now?.getTime() ?? 0;
    const upcoming = exams.filter((e) => !e.is_done && Date.parse(e.exam_at) > t).sort((a, b) => Date.parse(a.exam_at) - Date.parse(b.exam_at));
    const past = exams.filter((e) => e.is_done || Date.parse(e.exam_at) <= t);
    return { next: upcoming[0], upcoming: upcoming.slice(1), past };
  }, [exams, now]);

  if (!now) return <div className="h-64 animate-pulse rounded-2xl bg-zinc-900" />;

  return (
    <section className="space-y-4">
      {next && <HeroCountdown exam={next} now={now} />}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <h3 className="border-b border-zinc-800 px-4 py-3 font-mono text-xs uppercase tracking-widest text-zinc-500">Hàng chờ hành quyết</h3>
        <ul className="divide-y divide-zinc-800">
          {upcoming.map((e) => {
            const d = calendarDaysUntil(e.exam_at, now);
            const v = verdict(d);
            // Thanh "áp lực": 30 ngày trở lên = trống, càng gần càng đầy
            const pressure = Math.min(100, Math.max(4, ((30 - d) / 30) * 100));
            return (
              <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.title}</p>
                  <p className="text-xs text-zinc-500">{fmtDate(e.exam_at)}{e.total_slides ? ` · ${e.total_slides} slide` : ""}</p>
                </div>
                <p className={`text-right font-mono text-2xl font-bold tabular-nums ${v.tone}`}>
                  {d}<span className="ml-1 text-xs font-normal text-zinc-500">ngày</span>
                </p>
                <div className="col-span-2 h-1 overflow-hidden rounded bg-zinc-800">
                  <div className={`h-full ${d <= 7 ? "bg-red-500" : d <= 14 ? "bg-orange-400" : "bg-emerald-500"}`} style={{ width: `${pressure}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {past.length > 0 && (
        <p className="text-xs text-zinc-600">
          Đã qua: {past.map((e) => e.title).join(", ")}. Không ai nhắc lại điểm của bạn đâu. Trừ app này.
        </p>
      )}
    </section>
  );
}

function HeroCountdown({ exam, now }: { exam: Exam; now: Date }) {
  const ms = Date.parse(exam.exam_at) - now.getTime();
  const parts = [
    { v: Math.floor(ms / DAY), l: "ngày" },
    { v: Math.floor((ms % DAY) / 3_600_000), l: "giờ" },
    { v: Math.floor((ms % 3_600_000) / 60_000), l: "phút" },
    { v: Math.floor((ms % 60_000) / 1000), l: "giây" },
  ];
  const days = calendarDaysUntil(exam.exam_at, now);
  const v = verdict(days);
  const slidesLeft = (exam.total_slides ?? 0) - (exam.slides_done ?? 0);
  const perDay = slidesLeft > 0 && days > 0 ? Math.ceil(slidesLeft / days) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-900/60 bg-gradient-to-br from-red-950/70 via-zinc-950 to-zinc-950 p-5 sm:p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-red-400">Án tử gần nhất</p>
      <h2 className="mt-1 text-2xl font-black sm:text-3xl">{exam.title}</h2>
      <p className="text-sm text-zinc-400">{fmtDate(exam.exam_at)}</p>

      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {parts.map((p) => (
          <div key={p.l} className="rounded-xl bg-black/50 py-3 text-center ring-1 ring-red-900/50">
            <div className="font-mono text-3xl font-bold tabular-nums text-red-500 sm:text-5xl">{String(p.v).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 sm:text-xs">{p.l}</div>
          </div>
        ))}
      </div>

      <p className={`mt-4 font-medium ${v.tone}`}>{v.text}</p>
      {perDay && (
        <p className="mt-1 text-sm text-zinc-400">
          Còn <b className="text-zinc-100">{slidesLeft}</b> slide ⇒ tối thiểu <b className="text-zinc-100">{perDay} slide/ngày</b>. Không có ngày nghỉ.
        </p>
      )}
    </div>
  );
}
