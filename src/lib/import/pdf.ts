/**
 * PDF slide bài giảng -> thẻ Q/A (front/back/tags) -> đi tiếp pipeline như .apkg.
 *
 * Trang có text: trích text bằng unpdf (pdf.js bản serverless).
 * Trang scan (gần như không có text): gom lại báo cho user — OCR ảnh slide cần render
 * canvas phía client; xem docs/ARCHITECTURE.md §6.
 */
import OpenAI from "openai";
import { z } from "zod";
import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { PDF_TO_CARDS_SYSTEM } from "@/lib/ai/prompts";
import type { ParsedCard } from "./apkg";

const MIN_CHARS_PER_PAGE = 40;
const PAGES_PER_CHUNK = 6; // ~6 slide/lần gọi: đủ ngữ cảnh, không quá dài

export interface PdfResult {
  cards: ParsedCard[];
  scannedPages: number[]; // trang không trích được text
}

const CardsOut = z.object({
  cards: z.array(z.object({ front: z.string().min(3), back: z.string().min(1), tags: z.array(z.string()), page: z.number() })),
});

export async function extractPdfPages(buf: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t) => t.replace(/[ \t]+/g, " ").trim());
}

export async function pdfToCards(buf: Uint8Array, subjectHint: string): Promise<PdfResult> {
  const pages = await extractPdfPages(buf);
  const scannedPages: number[] = [];
  const usable: { page: number; text: string }[] = [];
  pages.forEach((text, i) => (text.length < MIN_CHARS_PER_PAGE ? scannedPages.push(i + 1) : usable.push({ page: i + 1, text })));

  const openai = new OpenAI();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const cards: ParsedCard[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < usable.length; i += PAGES_PER_CHUNK) {
    const chunk = usable.slice(i, i + PAGES_PER_CHUNK);
    const res = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PDF_TO_CARDS_SYSTEM },
        {
          role: "user",
          content: `Môn: ${subjectHint}\n\n` + chunk.map((p) => `=== TRANG ${p.page} ===\n${p.text}`).join("\n\n"),
        },
      ],
    });
    const parsed = CardsOut.safeParse(JSON.parse(res.choices[0].message.content ?? "{}"));
    if (!parsed.success) continue; // 1 chunk hỏng không làm hỏng cả file
    for (const c of parsed.data.cards) {
      const contentHash = createHash("sha1").update(c.front + "\x1f" + c.back).digest("hex");
      if (seen.has(contentHash)) continue;
      seen.add(contentHash);
      cards.push({
        ankiNoteId: 0,
        ankiCardId: 0,
        front: c.front,
        back: c.back,
        extra: `PDF trang ${c.page}`,
        tags: c.tags,
        contentHash,
      });
    }
  }
  return { cards, scannedPages };
}
