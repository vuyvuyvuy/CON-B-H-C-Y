import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { zipSync } from "fflate";
import { zstdCompressSync } from "node:zlib";
import { parseApkg, stripHtml, ApkgError } from "@/lib/import/apkg";

async function makeCollection() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`create table notes (id integer primary key, flds text, tags text);
          create table cards (id integer primary key, nid integer, did integer);`);
  const notes: [number, string, string][] = [
    [1, "Dấu hiệu X-quang của viêm thanh thiệt?\x1fDấu <b>ngón tay cái</b>", " TMH::ThanhQuan::ViemThanhThiet "],
    [2, "{{c1::Ceftriaxone}} là kháng sinh kinh nghiệm\x1f", "TMH"],
    [3, "Dấu hiệu X-quang của viêm thanh thiệt?\x1fDấu <b>ngón tay cái</b>", ""], // trùng nội dung
    [4, "\x1fmặt trước rỗng", ""],
  ];
  for (const [id, f, t] of notes) db.run("insert into notes values (?,?,?)", [id, f, t]);
  db.run("insert into cards values (10,1,1),(11,1,1),(20,2,1),(30,3,1),(40,4,1)");
  const bytes = db.export();
  db.close();
  return bytes;
}

describe("stripHtml", () => {
  it("bỏ tag, đổi br, cloze -> đáp án", () => {
    expect(stripHtml("A<br>B &amp; <i>C</i>")).toBe("A\nB & C");
    expect(stripHtml("{{c1::Adrenalin::thuốc gì?}} tiêm bắp")).toBe("Adrenalin tiêm bắp");
  });
});

describe("parseApkg", () => {
  it("đọc collection.anki21 (+ dedupe, bỏ thẻ rỗng, 1 thẻ/note)", async () => {
    const apkg = zipSync({ "collection.anki21": await makeCollection(), media: new TextEncoder().encode("{}") });
    const cards = await parseApkg(apkg);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ ankiNoteId: 1, ankiCardId: 10, back: "Dấu ngón tay cái", tags: ["TMH::ThanhQuan::ViemThanhThiet"] });
    expect(cards[1].front).toBe("Ceftriaxone là kháng sinh kinh nghiệm");
    expect(cards[1].back).toBe(cards[1].front); // cloze không có back => dùng front
  });

  it("đọc collection.anki21b (zstd), bỏ qua anki2 placeholder", async () => {
    const SQL = await initSqlJs();
    const placeholder = new SQL.Database();
    placeholder.run("create table notes (id integer, flds text, tags text); create table cards (id integer, nid integer, did integer);");
    placeholder.run("insert into notes values (99, 'Please update to the latest Anki version\x1f', ''); insert into cards values (99, 99, 1);");
    const apkg = zipSync({
      "collection.anki2": placeholder.export(),
      "collection.anki21b": new Uint8Array(zstdCompressSync(await makeCollection())),
    });
    const cards = await parseApkg(apkg);
    expect(cards.map((c) => c.ankiNoteId)).toEqual([1, 2]);
  });

  it("file không phải zip => ApkgError", async () => {
    await expect(parseApkg(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(ApkgError);
  });
});
