"use client";

import { useRouter } from "next/navigation";
import { EmergencyCase, RunConflictError, type AnswerResult } from "./EmergencyCase";
import { postOrQueue } from "@/lib/outbox";
import { getDeviceId } from "@/lib/device";
import { ratingFromAnswer } from "@/lib/srs";
import type { ClinicalCase } from "@/lib/types";

/** Nối EmergencyCase với server: gửi đáp án, offline thì xếp outbox và chấm local. */
export function CaseRunner({ data, runId, hp, step }: { data: ClinicalCase; runId: string; hp: number; step: number }) {
  const router = useRouter();

  const submit = async (a: { opId: string; stepId: string; optionId: string; elapsedMs: number; reviewedAt: string }): Promise<AnswerResult> => {
    const s = data.steps.find((x) => x.id === a.stepId)!;
    const opt = s.options.find((o) => o.id === a.optionId)!;
    const local: AnswerResult = { correct: opt.is_correct, hpDelta: opt.is_correct ? 0 : -s.hp_penalty, rating: ratingFromAnswer(opt.is_correct, a.elapsedMs) };

    const res = await postOrQueue(`/api/runs/${runId}/answer`, { ...a, deviceId: getDeviceId() });
    if (!res) {
      window.dispatchEvent(new Event("cbcc:queued"));
      return local; // offline: chơi tiếp, server áp dụng sau theo đúng thứ tự
    }
    if (res.status === 409) throw new RunConflictError();
    if (!res.ok) throw new Error(await res.text());
    const body = await res.json();
    if (body.duplicate) return local;
    return { correct: body.correct, hpDelta: body.hp_delta, rating: body.rating };
  };

  return (
    <EmergencyCase
      data={data}
      initialHp={hp}
      initialStep={step}
      submit={submit}
      onRestart={() => router.refresh()} // server mở lượt mới vì lượt cũ đã kết thúc
      onConflict={() => setTimeout(() => router.refresh(), 1200)}
    />
  );
}
