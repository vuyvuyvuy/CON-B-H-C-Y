"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClinicalCase, CaseOption, Vitals } from "@/lib/types";
import { pickInsult, pickPraise, severityFor, type Severity } from "@/lib/insults";
import { ratingFromAnswer } from "@/lib/srs";
import type { SrsRating } from "@/lib/types";

export interface AnswerResult {
  correct: boolean;
  hpDelta: number;
  rating: SrsRating;
}

interface Props {
  data: ClinicalCase;
  /**
   * Gửi đáp án lên server (POST /api/runs/:id/answer). Nếu bỏ trống => chấm local (chế độ demo).
   * Component luôn tự sinh opId để server dedupe khi mạng chập chờn.
   */
  submit?: (args: { opId: string; stepId: string; optionId: string; elapsedMs: number; reviewedAt: string }) => Promise<AnswerResult>;
  onFinish?: (outcome: "discharged" | "dead", wrongCardIds: string[]) => void;
}

type Feedback = { kind: "praise" | "insult"; text: string; severity?: Severity; option: CaseOption; rating: SrsRating };

const RATING_LABEL: Record<SrsRating, string> = {
  again: "AGAIN · ôn lại ngay",
  hard: "HARD · đúng mà run",
  good: "GOOD · đẩy lịch xa",
  easy: "EASY · đẩy lịch rất xa",
};

export function EmergencyCase({ data, submit, onFinish }: Props) {
  const [hp, setHp] = useState(data.max_hp);
  const [stepIdx, setStepIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [status, setStatus] = useState<"playing" | "discharged" | "dead">("playing");
  const [hit, setHit] = useState(0); // đổi key => chạy lại animation rung
  const [busy, setBusy] = useState(false);
  const recentInsults = useRef<string[]>([]);
  const wrongCards = useRef<Set<string>>(new Set());
  const stepStartedAt = useRef(Date.now());

  const step = data.steps[stepIdx];
  const vitals: Vitals = data.steps.slice(0, stepIdx + 1).reverse().find((s) => s.vitals)?.vitals ?? data.patient.vitals;
  const hpPct = Math.max(0, (hp / data.max_hp) * 100);

  useEffect(() => {
    stepStartedAt.current = Date.now();
  }, [stepIdx]);

  const choose = useCallback(
    async (opt: CaseOption) => {
      if (picked || busy || status !== "playing") return;
      setBusy(true);
      setPicked(opt.id);
      const elapsedMs = Date.now() - stepStartedAt.current;

      let result: AnswerResult;
      try {
        result = submit
          ? await submit({ opId: crypto.randomUUID(), stepId: step.id, optionId: opt.id, elapsedMs, reviewedAt: new Date().toISOString() })
          : { correct: opt.is_correct, hpDelta: opt.is_correct ? 0 : -step.hp_penalty, rating: ratingFromAnswer(opt.is_correct, elapsedMs) };
      } catch {
        // Mất mạng: vẫn chấm local để không phá nhịp chơi; outbox sẽ đồng bộ sau
        result = { correct: opt.is_correct, hpDelta: opt.is_correct ? 0 : -step.hp_penalty, rating: ratingFromAnswer(opt.is_correct, elapsedMs) };
      }

      const hpAfter = Math.max(0, hp + result.hpDelta);
      const vars = { patient: data.patient.name, hp: hpAfter, penalty: -result.hpDelta };

      if (result.correct) {
        setFeedback({ kind: "praise", text: pickPraise(vars), option: opt, rating: result.rating });
      } else {
        step.card_ids.forEach((id) => wrongCards.current.add(id));
        const severity = severityFor(hpAfter, data.max_hp);
        const { template, text } = pickInsult(severity, vars, recentInsults.current);
        recentInsults.current = [template, ...recentInsults.current].slice(0, 4);
        setFeedback({ kind: "insult", text, severity, option: opt, rating: result.rating });
        setHp(hpAfter);
        setHit((h) => h + 1);
        if (navigator.vibrate) navigator.vibrate(severity === "dead" ? [300, 100, 600] : 120);
      }

      if (hpAfter <= 0) {
        setStatus("dead");
        onFinish?.("dead", [...wrongCards.current]);
      }
      setBusy(false);
    },
    [picked, busy, status, submit, step, hp, data, onFinish],
  );

  const next = () => {
    if (stepIdx + 1 >= data.steps.length) {
      setStatus("discharged");
      onFinish?.("discharged", [...wrongCards.current]);
      return;
    }
    setStepIdx((i) => i + 1);
    setPicked(null);
    setFeedback(null);
  };

  const restart = () => {
    setHp(data.max_hp);
    setStepIdx(0);
    setPicked(null);
    setFeedback(null);
    setStatus("playing");
    wrongCards.current.clear();
  };

  return (
    <div key={hit} className={`space-y-4 ${hit && feedback?.kind === "insult" ? "animate-shake" : ""}`}>
      {/* ---------- Monitor ---------- */}
      <div className={`rounded-2xl border p-4 ${status === "dead" ? "border-red-700 bg-red-950/40" : "border-zinc-800 bg-black/70"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">{data.topic}</p>
            <h2 className="text-xl font-black">{data.title}</h2>
            <p className="text-sm text-zinc-400">
              {data.patient.name} · {data.patient.sex}, {data.patient.age} tuổi
            </p>
          </div>
          <p className="font-mono text-sm text-zinc-500">
            Bước {Math.min(stepIdx + 1, data.steps.length)}/{data.steps.length}
          </p>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span className="text-zinc-400">HP BỆNH NHÂN</span>
            <span className={hpPct <= 25 ? "text-red-500" : hpPct <= 60 ? "text-orange-400" : "text-emerald-400"}>
              {hp}/{data.max_hp}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all duration-700 ${hpPct <= 25 ? "animate-flatline bg-red-600" : hpPct <= 60 ? "bg-orange-500" : "bg-emerald-500"}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-5 gap-2 font-mono">
          <Vital label="HR" value={status === "dead" ? "0" : vitals.hr} warn={vitals.hr > 120 || vitals.hr < 50} color="text-emerald-400" />
          <Vital label="BP" value={status === "dead" ? "--/--" : vitals.bp} color="text-red-400" />
          <Vital label="SpO₂" value={status === "dead" ? "--" : `${vitals.spo2}%`} warn={vitals.spo2 < 92} color="text-sky-400" />
          <Vital label="RR" value={status === "dead" ? "0" : vitals.rr} warn={vitals.rr > 28} color="text-yellow-300" />
          <Vital label="T°" value={vitals.temp.toFixed(1)} warn={vitals.temp >= 39} color="text-orange-300" />
        </dl>
      </div>

      {/* ---------- Kết thúc ---------- */}
      {status === "dead" && (
        <EndCard
          tone="dead"
          title="🪦 Bệnh nhân đã đăng xuất"
          body={`${feedback?.text ?? ""} Bia mộ đã được dựng. ${wrongCards.current.size} thẻ Anki bị đánh dấu AGAIN — vào Nghĩa trang thắp nhang (ôn lại) để chuộc lỗi.`}
          onRestart={restart}
        />
      )}
      {status === "discharged" && (
        <EndCard
          tone="ok"
          title="🏥 Xuất viện"
          body={
            hp === data.max_hp
              ? "Không mất giọt máu nào. Đáng ngờ. Bạn có tra Google không đó?"
              : `${data.patient.name} sống sót với ${hp} HP. Có di chứng, nhưng sống. Tạm chấp nhận.`
          }
          onRestart={restart}
        />
      )}

      {/* ---------- Bước hiện tại ---------- */}
      {status === "playing" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
          {stepIdx === 0 && <p className="mb-3 whitespace-pre-line leading-relaxed text-zinc-300">{data.opening}</p>}
          <p className="leading-relaxed text-zinc-200">{step.narrative}</p>
          <p className="mt-4 text-lg font-bold">{step.question}</p>

          <div className="mt-4 grid gap-2">
            {step.options.map((o) => {
              const state = !picked ? "idle" : o.is_correct ? "right" : o.id === picked ? "wrong" : "dim";
              return (
                <button
                  key={o.id}
                  disabled={!!picked}
                  onClick={() => choose(o)}
                  className={[
                    "flex gap-3 rounded-xl border px-4 py-3 text-left transition",
                    state === "idle" && "border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800 active:scale-[0.99]",
                    state === "right" && "border-emerald-600 bg-emerald-950/50",
                    state === "wrong" && "border-red-600 bg-red-950/60",
                    state === "dim" && "border-zinc-800 opacity-40",
                  ].filter(Boolean).join(" ")}
                >
                  <span className="font-mono font-bold uppercase text-zinc-500">{o.id}</span>
                  <span>
                    {o.text}
                    {picked && (state === "right" || state === "wrong") && (
                      <span className="mt-1 block text-sm text-zinc-400">{o.rationale}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`mt-4 rounded-xl p-4 ${feedback.kind === "praise" ? "bg-emerald-950/40 ring-1 ring-emerald-800" : "bg-red-950/50 ring-1 ring-red-800"}`}>
              <p className={`font-semibold ${feedback.kind === "praise" ? "text-emerald-300" : "text-red-300"}`}>
                {feedback.kind === "insult" && `−${step.hp_penalty} HP · `}
                {feedback.text}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                SRS: {step.card_ids.length} thẻ → {RATING_LABEL[feedback.rating]}
              </p>
              <button onClick={next} className="mt-3 rounded-lg bg-zinc-100 px-4 py-2 font-semibold text-zinc-900 hover:bg-white">
                {stepIdx + 1 >= data.steps.length ? "Kết thúc ca" : "Tiếp tục →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Vital({ label, value, color, warn }: { label: string; value: string | number; color: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-900 px-2 py-2 text-center">
      <dt className="text-[10px] text-zinc-500">{label}</dt>
      <dd className={`text-base font-bold tabular-nums sm:text-xl ${color} ${warn ? "animate-flatline" : ""}`}>{value}</dd>
    </div>
  );
}

function EndCard({ tone, title, body, onRestart }: { tone: "dead" | "ok"; title: string; body: string; onRestart: () => void }) {
  return (
    <div className={`rounded-2xl p-5 ${tone === "dead" ? "bg-red-950/60 ring-1 ring-red-800" : "bg-emerald-950/40 ring-1 ring-emerald-800"}`}>
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-2 text-zinc-300">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onRestart} className="rounded-lg bg-zinc-100 px-4 py-2 font-semibold text-zinc-900">Làm lại ca này</button>
        {tone === "dead" && (
          <a href="/graveyard" className="rounded-lg border border-zinc-600 px-4 py-2 font-semibold">🕯️ Ra nghĩa trang</a>
        )}
      </div>
    </div>
  );
}
