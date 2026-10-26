import { describe, expect, it } from "vitest";
import { newCardSrs, ratingFromAnswer, schedule } from "@/lib/srs";
import type { CardSrs } from "@/lib/types";

const NOW = new Date("2026-10-26T12:00:00Z");
const MIN = 60_000;
const DAY = 86_400_000;
const dueIn = (s: CardSrs) => new Date(s.due_at).getTime() - NOW.getTime();

describe("ratingFromAnswer", () => {
  it("map quyết định -> rating", () => {
    expect(ratingFromAnswer(false, 1000)).toBe("again");
    expect(ratingFromAnswer(true, 3000)).toBe("easy");
    expect(ratingFromAnswer(true, 20_000)).toBe("good");
    expect(ratingFromAnswer(true, 60_000)).toBe("hard");
  });
});

describe("schedule", () => {
  it("thẻ mới + good -> learning bước 2 (10 phút)", () => {
    const s = schedule(newCardSrs("c", NOW), "good", NOW);
    expect(s.state).toBe("learning");
    expect(dueIn(s)).toBe(10 * MIN);
  });

  it("thẻ mới + easy -> review 4 ngày", () => {
    const s = schedule(newCardSrs("c", NOW), "easy", NOW);
    expect(s.state).toBe("review");
    expect(s.interval_days).toBe(4);
  });

  it("learning hết bước + good -> tốt nghiệp 1 ngày", () => {
    const s = schedule({ ...newCardSrs("c"), state: "learning", learning_step: 1 }, "good", NOW);
    expect(s.state).toBe("review");
    expect(dueIn(s)).toBe(DAY);
  });

  const review: CardSrs = { ...newCardSrs("c"), state: "review", interval_days: 10, ease: 2.5, reps: 5, due_at: NOW.toISOString() };

  it("review + again -> relearning, lapse, ease giảm, 10 phút", () => {
    const s = schedule(review, "again", NOW);
    expect(s.state).toBe("relearning");
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
    expect(s.interval_days).toBe(2);
    expect(dueIn(s)).toBe(10 * MIN);
  });

  it("review: easy > good > hard", () => {
    const h = schedule(review, "hard", NOW).interval_days;
    const g = schedule(review, "good", NOW).interval_days;
    const e = schedule(review, "easy", NOW).interval_days;
    expect(h).toBe(12);
    expect(g).toBe(25);
    expect(e).toBe(33);
    expect(e).toBeGreaterThan(g);
  });

  it("relearning + good -> về review với interval đã giảm", () => {
    const lapsed = schedule(review, "again", NOW);
    const s = schedule(lapsed, "good", NOW);
    expect(s.state).toBe("review");
    expect(s.interval_days).toBe(2);
  });

  it("không xếp lịch sau ngày thi", () => {
    const exam = new Date(Date.now() + 5 * DAY);
    const s = schedule({ ...review, interval_days: 60 }, "easy", new Date(), exam);
    expect(new Date(s.due_at).getTime()).toBeLessThanOrEqual(exam.getTime() - DAY);
  });

  it("không đổi object đầu vào", () => {
    const before = { ...review };
    schedule(review, "easy", NOW);
    expect(review).toEqual(before);
  });
});
