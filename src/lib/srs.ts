/**
 * SRS kiểu SM-2 (giống Anki cổ điển) + ánh xạ "quyết định lâm sàng" -> rating.
 *
 *   Chọn đúng, nhanh (< fastMs)       -> easy   (đẩy lịch ra xa nhất)
 *   Chọn đúng                         -> good
 *   Chọn đúng nhưng chậm (> slowMs)   -> hard   (đúng nhưng run tay)
 *   Chọn sai                          -> again  (lapse, quay về relearning, bệnh nhân mất máu)
 */
import type { CardSrs, SrsRating } from "./types";

const DAY = 86_400_000;
const MIN = 60_000;

export const SRS_CONFIG = {
  learningStepsMin: [1, 10], // phút
  relearningStepsMin: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  lapseNewIntervalFactor: 0.2,
  maxIntervalDays: 365,
  fastMs: 8_000,
  slowMs: 45_000,
};

export function ratingFromAnswer(correct: boolean, elapsedMs: number): SrsRating {
  if (!correct) return "again";
  if (elapsedMs <= SRS_CONFIG.fastMs) return "easy";
  if (elapsedMs >= SRS_CONFIG.slowMs) return "hard";
  return "good";
}

export function newCardSrs(cardId: string, now = new Date()): CardSrs {
  return {
    card_id: cardId,
    state: "new",
    due_at: now.toISOString(),
    interval_days: 0,
    ease: SRS_CONFIG.startingEase,
    reps: 0,
    lapses: 0,
    learning_step: 0,
    last_reviewed_at: null,
  };
}

/** Không bao giờ để ngày ôn vượt quá ngày thi — ôn sau ngày thi thì ôn làm gì. */
function clampToExam(dueMs: number, examAt?: Date | null): number {
  if (!examAt) return dueMs;
  const dayBefore = examAt.getTime() - DAY;
  return dayBefore > Date.now() ? Math.min(dueMs, dayBefore) : dueMs;
}

export function schedule(
  prev: CardSrs,
  rating: SrsRating,
  now = new Date(),
  examAt?: Date | null,
): CardSrs {
  const c = SRS_CONFIG;
  const s: CardSrs = { ...prev, reps: prev.reps + 1, last_reviewed_at: now.toISOString() };
  const t = now.getTime();
  const at = (ms: number) => new Date(clampToExam(ms, examAt)).toISOString();

  const inLearning = prev.state === "new" || prev.state === "learning" || prev.state === "relearning";

  if (inLearning) {
    const steps = prev.state === "relearning" ? c.relearningStepsMin : c.learningStepsMin;
    if (rating === "again") {
      s.state = prev.state === "relearning" ? "relearning" : "learning";
      s.learning_step = 0;
      s.due_at = at(t + steps[0] * MIN);
      return s;
    }
    if (rating === "easy") {
      s.state = "review";
      s.learning_step = 0;
      s.interval_days = prev.state === "relearning" ? Math.max(1, prev.interval_days) : c.easyIntervalDays;
      s.due_at = at(t + s.interval_days * DAY);
      return s;
    }
    const next = prev.learning_step + (rating === "good" ? 1 : 0);
    if (next < steps.length) {
      s.state = prev.state === "new" ? "learning" : prev.state;
      s.learning_step = next;
      s.due_at = at(t + steps[next] * MIN);
      return s;
    }
    s.state = "review";
    s.learning_step = 0;
    s.interval_days = prev.state === "relearning" ? Math.max(1, prev.interval_days) : c.graduatingIntervalDays;
    s.due_at = at(t + s.interval_days * DAY);
    return s;
  }

  // state === review
  if (rating === "again") {
    s.state = "relearning";
    s.lapses = prev.lapses + 1;
    s.ease = Math.max(c.minEase, prev.ease - 0.2);
    s.interval_days = Math.max(1, prev.interval_days * c.lapseNewIntervalFactor);
    s.learning_step = 0;
    s.due_at = at(t + c.relearningStepsMin[0] * MIN);
    return s;
  }

  const overdueDays = Math.max(0, (t - new Date(prev.due_at).getTime()) / DAY);
  let ivl: number;
  if (rating === "hard") {
    s.ease = Math.max(c.minEase, prev.ease - 0.15);
    ivl = prev.interval_days * c.hardFactor;
  } else if (rating === "good") {
    ivl = (prev.interval_days + overdueDays / 2) * prev.ease;
  } else {
    s.ease = prev.ease + 0.15;
    ivl = (prev.interval_days + overdueDays) * prev.ease * c.easyBonus;
  }
  s.interval_days = Math.min(c.maxIntervalDays, Math.max(prev.interval_days + 1, Math.round(ivl)));
  s.due_at = at(t + s.interval_days * DAY);
  return s;
}
