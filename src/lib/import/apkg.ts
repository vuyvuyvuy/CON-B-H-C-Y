/**
 * Đọc file .apkg (zip chứa SQLite của Anki) => danh sách thẻ sạch.
 *
 *   collection.anki21b : Anki >= 2.1.50, nén zstd  -> yêu cầu user export "Support older Anki versions"
 *   collection.anki21  : Anki 2.1.x
 *   collection.anki2   : bản cũ (đôi khi chỉ là placeholder nếu có anki21)
 */
import { unzipSync } from "fflate";
import initSqlJs from "sql.js";
import { createHash } from "node:crypto";

export interface ParsedCard {
  ankiNoteId: number;
  ankiCardId: number;
  front: string;
  back: string;
  extra: string | null;
  tags: string[];
  contentHash: string;
}

export class ApkgError extends Error {}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<img[^>]*>/gi, "[hình]")
    .replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, "$1") // cloze -> đáp án
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseApkg(buf: Uint8Array): Promise<ParsedCard[]> {
  const files = unzipSync(buf);
  const db =
    files["collection.anki21"] ?? (files["collection.anki21b"] ? null : files["collection.anki2"]);
  if (!db) {
    throw new ApkgError(
      "File .apkg dùng định dạng mới (anki21b). Trong Anki: Export → tick 'Support older Anki versions' rồi thử lại.",
    );
  }

  const SQL = await initSqlJs();
  const sqlite = new SQL.Database(db);
  try {
    // 1 note có thể sinh nhiều card (Basic+reversed, cloze c1/c2...). Ta lấy card đầu tiên / note
    // vì AI làm việc ở mức "sự kiện kiến thức", không phải mức mặt thẻ.
    const rows = sqlite.exec(`
      select n.id, min(c.id), n.flds, n.tags
      from notes n join cards c on c.nid = n.id
      group by n.id
    `)[0]?.values ?? [];

    const seen = new Set<string>();
    const out: ParsedCard[] = [];
    for (const [nid, cid, flds, tags] of rows) {
      const fields = String(flds).split("\x1f").map(stripHtml);
      const front = fields[0] ?? "";
      const back = fields[1] || front; // cloze: field 1 thường là Extra
      if (!front) continue;
      const contentHash = createHash("sha1").update(front + "\x1f" + back).digest("hex");
      if (seen.has(contentHash)) continue;
      seen.add(contentHash);
      out.push({
        ankiNoteId: Number(nid),
        ankiCardId: Number(cid),
        front,
        back,
        extra: fields.slice(2).filter(Boolean).join("\n") || null,
        tags: String(tags).trim().split(/\s+/).filter(Boolean),
        contentHash,
      });
    }
    return out;
  } finally {
    sqlite.close();
  }
}
