import { describe, expect, it } from "vitest";
import { businessRules, clusterCards, type GeneratedCase, type RawCard } from "@/lib/ai/generate-cases";

/** Vector giả: 3 "chủ đề" trực giao + nhiễu nhỏ. */
function fixture() {
  const cards: RawCard[] = [];
  const vecs: number[][] = [];
  ["A", "B", "C"].forEach((topic, t) => {
    for (let i = 0; i < 8; i++) {
      cards.push({ id: `${topic}${i}`, front: "f", back: "b", tags: [] });
      const v = [0, 0, 0, 0].map((_, k) => (k === t ? 1 : 0) + ((i * 7 + k * 3) % 5) * 0.01);
      vecs.push(v);
    }
  });
  return { cards, vecs };
}

describe("clusterCards", () => {
  it("tách đúng 3 chủ đề", () => {
    const { cards, vecs } = fixture();
    const clusters = clusterCards(cards, vecs);
    expect(clusters).toHaveLength(3);
    for (const c of clusters) expect(new Set(c.map((x) => x.id[0])).size).toBe(1);
  });

  it("tôn trọng maxSize (18)", () => {
    const cards: RawCard[] = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, front: "", back: "", tags: [] }));
    const vecs = cards.map((_, i) => [1, i * 0.0001]);
    for (const c of clusterCards(cards, vecs)) expect(c.length).toBeLessThanOrEqual(18);
  });

  it("thẻ cùng tag lá được mồi chung cụm", () => {
    const { cards, vecs } = fixture();
    // A0 bị gắn tag của nhóm B => phải đi cùng B dù vector gần A
    cards[0].tags = ["TMH::B"];
    cards.filter((c) => c.id.startsWith("B")).forEach((c) => (c.tags = ["TMH::B"]));
    const clusters = clusterCards(cards, vecs);
    const withA0 = clusters.find((c) => c.some((x) => x.id === "A0"))!;
    expect(withA0.some((x) => x.id === "B1")).toBe(true);
  });
});

describe("businessRules", () => {
  const cluster: RawCard[] = ["c1", "c2", "c3"].map((id) => ({ id, front: "", back: "", tags: [] }));
  const v = { hr: 80, bp: "120/80", spo2: 98, rr: 16, temp: 37 };
  const step = (card_ids: string[], correct = [true, false, false, false]) => ({
    narrative: "", question: "", hp_penalty: 20, card_ids, vitals: v,
    options: (["a", "b", "c", "d"] as const).map((id, i) => ({ id, text: id, is_correct: correct[i], rationale: "" })),
  });
  const gc = (steps: ReturnType<typeof step>[], unused: string[] = []): GeneratedCase => ({
    title: "abc", topic: "t", difficulty: 2, opening: "", unused_card_ids: unused.map((id) => ({ id, reason: "x" })),
    patient: { name: "A", age: 1, sex: "Nam", history: "", vitals: v }, steps,
  });

  it("ca hợp lệ", () => {
    expect(businessRules(gc([step(["c1"]), step(["c2"]), step(["c3"])]), cluster)).toEqual([]);
  });
  it("bắt 2 đáp án đúng", () => {
    expect(businessRules(gc([step(["c1", "c2", "c3"], [true, true, false, false])]), cluster).join()).toMatch(/2 đáp án đúng/);
  });
  it("bắt card_id bịa", () => {
    expect(businessRules(gc([step(["c1", "c2", "c3", "zzz"])]), cluster).join()).toMatch(/zzz/);
  });
  it("bắt thẻ bị bỏ mà không giải thích", () => {
    expect(businessRules(gc([step(["c1", "c2"])]), cluster).join()).toMatch(/c3/);
    expect(businessRules(gc([step(["c1", "c2"])], ["c3"]), cluster)).toEqual([]);
  });
});
