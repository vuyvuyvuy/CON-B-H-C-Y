/**
 * Pipeline: ~150 thẻ Anki rời rạc -> N ca cấp cứu.
 *
 *   embed  ->  cluster (cosine, gợi ý bằng tag)  ->  label + loại outlier (LLM)
 *          ->  gen case (Structured Outputs)  ->  validate (zod + luật nghiệp vụ)
 *          ->  audit (LLM giám khảo)  ->  ghi DB
 *
 * Chạy server-side (route handler / background job), KHÔNG chạy trên client.
 */
import OpenAI from "openai";
import { z } from "zod";
import {
  CASE_AUDIT_SYSTEM,
  CASE_GEN_SYSTEM,
  CASE_JSON_SCHEMA,
  CLUSTER_LABEL_SYSTEM,
  buildCasePrompt,
} from "./prompts";

export interface RawCard {
  id: string;
  front: string;
  back: string;
  tags: string[];
}

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

const CLUSTER = {
  minSize: 6, // ít hơn => không đủ chất liệu cho 1 ca, gộp vào cụm gần nhất
  maxSize: 18, // nhiều hơn => tách, 1 ca 4–7 bước không ôm nổi
  joinThreshold: 0.78, // cosine similarity tối thiểu để gộp
};

// ---------------------------------------------------------------------------
// 1. Embedding
// ---------------------------------------------------------------------------
export async function embedCards(openai: OpenAI, cards: RawCard[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < cards.length; i += 100) {
    const batch = cards.slice(i, i + 100);
    const res = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: batch.map((c) => `${c.tags.join(" ")}\n${c.front}\n${c.back}`.slice(0, 4000)),
    });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));
const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b) || 1);
const mean = (vs: number[][]) => vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);

// ---------------------------------------------------------------------------
// 2. Gom cụm: agglomerative theo centroid. 150 thẻ => O(n^2) vẫn tức thì.
//    Thẻ cùng tag lá (vd "TMH::ThanhQuan::ViemThanhThiet") được "mồi" chung cụm.
// ---------------------------------------------------------------------------
export function clusterCards(cards: RawCard[], vectors: number[][]): RawCard[][] {
  type C = { members: number[]; centroid: number[] };
  const byLeafTag = new Map<string, number[]>();
  cards.forEach((c, i) => {
    const leaf = c.tags.find((t) => t.includes("::"))?.split("::").pop() ?? `__solo_${i}`;
    byLeafTag.set(leaf, [...(byLeafTag.get(leaf) ?? []), i]);
  });
  let clusters: C[] = [...byLeafTag.values()].map((m) => ({ members: m, centroid: mean(m.map((i) => vectors[i])) }));

  // Gộp cặp gần nhất cho tới khi không còn cặp nào đủ giống (và không vượt maxSize)
  for (;;) {
    let best: [number, number, number] | null = null;
    for (let a = 0; a < clusters.length; a++)
      for (let b = a + 1; b < clusters.length; b++) {
        if (clusters[a].members.length + clusters[b].members.length > CLUSTER.maxSize) continue;
        const s = cosine(clusters[a].centroid, clusters[b].centroid);
        if (s >= CLUSTER.joinThreshold && (!best || s > best[2])) best = [a, b, s];
      }
    if (!best) break;
    const [a, b] = best;
    const members = [...clusters[a].members, ...clusters[b].members];
    clusters = clusters.filter((_, i) => i !== a && i !== b);
    clusters.push({ members, centroid: mean(members.map((i) => vectors[i])) });
  }

  // Cụm quá nhỏ: nhét vào cụm lớn gần nhất còn chỗ, nếu không thì giữ làm "thẻ mồ côi"
  const big = clusters.filter((c) => c.members.length >= CLUSTER.minSize);
  const small = clusters.filter((c) => c.members.length < CLUSTER.minSize);
  const orphans: number[] = [];
  for (const s of small) {
    const target = big
      .filter((b) => b.members.length + s.members.length <= CLUSTER.maxSize)
      .sort((x, y) => cosine(y.centroid, s.centroid) - cosine(x.centroid, s.centroid))[0];
    if (target && cosine(target.centroid, s.centroid) > CLUSTER.joinThreshold - 0.1) target.members.push(...s.members);
    else orphans.push(...s.members);
  }
  // Thẻ mồ côi gom thành 1 cụm "tổng hợp" nếu đủ, không thì vẫn được ôn dạng flashcard thường
  if (orphans.length >= CLUSTER.minSize) big.push({ members: orphans, centroid: [] });
  return big.map((c) => c.members.map((i) => cards[i]));
}

// ---------------------------------------------------------------------------
// 3. Đặt tên chủ đề + đá outlier
// ---------------------------------------------------------------------------
const LabelSchema = z.object({ topic: z.string(), outlier_ids: z.array(z.string()), viable: z.boolean() });

async function labelCluster(openai: OpenAI, cluster: RawCard[]) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLUSTER_LABEL_SYSTEM + '\nSchema: {"topic": string, "outlier_ids": string[], "viable": boolean}' },
      { role: "user", content: cluster.map((c) => `[${c.id}] ${c.front} => ${c.back}`).join("\n") },
    ],
  });
  return LabelSchema.parse(JSON.parse(res.choices[0].message.content ?? "{}"));
}

// ---------------------------------------------------------------------------
// 4. Gen + validate
// ---------------------------------------------------------------------------
const Vitals = z.object({ hr: z.number(), bp: z.string(), spo2: z.number(), rr: z.number(), temp: z.number() });
export const GeneratedCase = z.object({
  title: z.string().min(3),
  topic: z.string(),
  difficulty: z.number().int().min(1).max(3),
  patient: z.object({ name: z.string(), age: z.number(), sex: z.enum(["Nam", "Nữ"]), history: z.string(), vitals: Vitals }),
  opening: z.string(),
  steps: z
    .array(
      z.object({
        narrative: z.string(),
        question: z.string(),
        hp_penalty: z.number().int().min(10).max(50),
        card_ids: z.array(z.string()).min(1),
        vitals: Vitals,
        options: z
          .array(z.object({ id: z.enum(["a", "b", "c", "d"]), text: z.string(), is_correct: z.boolean(), rationale: z.string() }))
          .length(4),
      }),
    )
    .min(3)
    .max(8),
  unused_card_ids: z.array(z.object({ id: z.string(), reason: z.string() })),
});
export type GeneratedCase = z.infer<typeof GeneratedCase>;

/** Luật nghiệp vụ mà JSON schema không diễn đạt được. Trả về danh sách lỗi (rỗng = ok). */
export function businessRules(gc: GeneratedCase, cluster: RawCard[]): string[] {
  const ids = new Set(cluster.map((c) => c.id));
  const errs: string[] = [];
  const used = new Set<string>();
  gc.steps.forEach((s, i) => {
    const correct = s.options.filter((o) => o.is_correct).length;
    if (correct !== 1) errs.push(`Bước ${i}: có ${correct} đáp án đúng, cần đúng 1.`);
    if (new Set(s.options.map((o) => o.id)).size !== 4) errs.push(`Bước ${i}: id lựa chọn bị trùng.`);
    for (const id of s.card_ids) {
      if (!ids.has(id)) errs.push(`Bước ${i}: card_id "${id}" không tồn tại (bịa id).`);
      used.add(id);
    }
  });
  const unused = new Set(gc.unused_card_ids.map((u) => u.id));
  const coverage = used.size / cluster.length;
  const unaccounted = cluster.filter((c) => !used.has(c.id) && !unused.has(c.id)).map((c) => c.id);
  if (coverage < 0.6) errs.push(`Chỉ dùng ${Math.round(coverage * 100)}% số thẻ; cần >= 60%.`);
  if (unaccounted.length) errs.push(`Thẻ không được dùng cũng không được giải thích: ${unaccounted.join(", ")}`);
  return errs;
}

async function generateOne(openai: OpenAI, topic: string, cluster: RawCard[], maxAttempts = 2) {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: CASE_GEN_SYSTEM },
    { role: "user", content: buildCasePrompt(topic, cluster) },
  ];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7, // narrative cần chút sáng tạo; kiến thức bị khoá bởi luật + validate
      response_format: { type: "json_schema", json_schema: CASE_JSON_SCHEMA as unknown as OpenAI.ResponseFormatJSONSchema["json_schema"] },
      messages,
    });
    const raw = res.choices[0].message.content ?? "";
    const parsed = GeneratedCase.safeParse(JSON.parse(raw));
    const errs = parsed.success ? businessRules(parsed.data, cluster) : parsed.error.issues.map((i) => i.message);
    if (!errs.length && parsed.success) return parsed.data;
    // Self-repair: gửi lỗi lại cho model sửa
    messages.push({ role: "assistant", content: raw }, { role: "user", content: `Sửa các lỗi sau và trả lại JSON đầy đủ:\n- ${errs.join("\n- ")}` });
  }
  return null;
}

async function audit(openai: OpenAI, gc: GeneratedCase, cluster: RawCard[]) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CASE_AUDIT_SYSTEM },
      { role: "user", content: JSON.stringify({ cards: cluster.map(({ id, front, back }) => ({ id, front, back })), case: gc }) },
    ],
  });
  return z.object({ ok: z.boolean(), issues: z.array(z.object({ step_index: z.number(), problem: z.string() })) })
    .parse(JSON.parse(res.choices[0].message.content ?? "{}"));
}

// ---------------------------------------------------------------------------
// 5. Orchestrator
// ---------------------------------------------------------------------------
export async function cardsToCases(
  cards: RawCard[],
  onProgress?: (stage: string, progress: number) => Promise<void> | void,
) {
  const openai = new OpenAI();
  await onProgress?.("embedding", 0.1);
  const vectors = await embedCards(openai, cards);

  await onProgress?.("clustering", 0.3);
  const clusters = clusterCards(cards, vectors);

  const results: { case: GeneratedCase; cardIds: string[]; auditIssues: string[] }[] = [];
  const skipped: { topic: string; reason: string }[] = [];

  // Chạy song song có giới hạn để không ăn rate limit
  const CONCURRENCY = 3;
  let done = 0;
  const queue = [...clusters];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let cluster = queue.shift(); cluster; cluster = queue.shift()) {
        const label = await labelCluster(openai, cluster);
        const clean = cluster.filter((c) => !label.outlier_ids.includes(c.id));
        if (!label.viable || clean.length < CLUSTER.minSize) {
          skipped.push({ topic: label.topic, reason: "Không đủ chất liệu cho ca cấp cứu" });
        } else {
          const gc = await generateOne(openai, label.topic, clean);
          if (!gc) skipped.push({ topic: label.topic, reason: "Gen thất bại sau khi tự sửa" });
          else {
            const a = await audit(openai, gc, clean);
            results.push({ case: gc, cardIds: clean.map((c) => c.id), auditIssues: a.issues.map((i) => `Bước ${i.step_index}: ${i.problem}`) });
          }
        }
        done++;
        await onProgress?.("generating", 0.3 + 0.65 * (done / clusters.length));
      }
    }),
  );

  return { cases: results, skipped, clusterCount: clusters.length };
}
