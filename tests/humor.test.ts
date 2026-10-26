import { describe, expect, it } from "vitest";
import { pickInsult, pickPraise, severityFor } from "@/lib/insults";
import { rankFor, ROOKIE } from "@/lib/ranks";
import { pickNag, type NagContext } from "@/lib/push/messages";
import { calendarDaysUntil } from "@/components/ExamCountdown";

describe("insults", () => {
  it("phân tầng theo HP còn lại", () => {
    expect(severityFor(80, 100)).toBe("scratch");
    expect(severityFor(50, 100)).toBe("bleeding");
    expect(severityFor(20, 100)).toBe("critical");
    expect(severityFor(0, 100)).toBe("dead");
  });

  it("điền placeholder, không còn {..}", () => {
    for (let i = 0; i < 30; i++) {
      const { text } = pickInsult("critical", { patient: "Anh Tuấn", hp: 10, penalty: 30 });
      expect(text).not.toMatch(/\{\w+\}/);
    }
    expect(pickPraise({ patient: "X" })).not.toMatch(/\{\w+\}/);
  });

  it("không lặp câu vừa dùng", () => {
    let recent: string[] = [];
    for (let i = 0; i < 50; i++) {
      const { template } = pickInsult("bleeding", { patient: "A", hp: 1, penalty: 1 }, recent);
      expect(recent).not.toContain(template);
      recent = [template, ...recent].slice(0, 4);
    }
  });
});

describe("ranks", () => {
  it("dưới 20 câu = tân binh", () => expect(rankFor({ total: 5, wrong: 5, killed: 0, saved: 0 })).toEqual(ROOKIE));
  it("theo tỷ lệ sai", () => {
    expect(rankFor({ total: 100, wrong: 3, killed: 0, saved: 5 }).code).toBe("truong_khoa");
    expect(rankFor({ total: 100, wrong: 22, killed: 0, saved: 5 }).code).toBe("thuc_tap_sinh");
    expect(rankFor({ total: 100, wrong: 35, killed: 0, saved: 5 }).code).toBe("lang_bam");
    expect(rankFor({ total: 100, wrong: 55, killed: 0, saved: 5 }).code).toBe("sat_thu");
    expect(rankFor({ total: 100, wrong: 90, killed: 0, saved: 5 }).code).toBe("than_chet");
  });
  it("giết nhiều hơn cứu => tụt 1 bậc", () => {
    expect(rankFor({ total: 100, wrong: 3, killed: 3, saved: 1 }).code).toBe("noi_tru");
  });
});

describe("push", () => {
  const base: NagContext = { dueCards: 10, activeRunHp: 40, nextExam: { title: "TMH", days: 2 }, unredeemedGraves: 1, streak: 5, studiedToday: false, hourLocal: 22, nagLevel: 3 };
  it("nag_level 0 chỉ còn câu hiền", () => {
    for (let i = 0; i < 20; i++) expect(pickNag({ ...base, nagLevel: 0 })?.template).toBe("gentle");
  });
  it("câu Code Blue đúng như đề bài", () => {
    const n = pickNag({ ...base, nextExam: null, unredeemedGraves: 0, streak: 0 }, () => 0);
    expect(n?.body).toBe("Bệnh nhân đang hấp hối (HP 40) chờ mài vào kê đơn, hay định đi ngủ luôn?");
  });
  it("không có gì để nhắc => null", () => {
    expect(pickNag({ ...base, dueCards: 0, activeRunHp: null, nextExam: null, unredeemedGraves: 0, streak: 0 })).toBeNull();
  });
});

describe("countdown", () => {
  it("khớp cột 'Số ngày còn lại' của Google Sheet (26/10/2026)", () => {
    const now = new Date("2026-10-26T18:48:00+07:00");
    expect(calendarDaysUntil("2026-11-06T13:30:00+07:00", now)).toBe(11);
    expect(calendarDaysUntil("2026-11-13T09:30:00+07:00", now)).toBe(18);
    expect(calendarDaysUntil("2027-01-07T13:30:00+07:00", now)).toBe(73);
    expect(calendarDaysUntil("2026-10-09T07:00:00+07:00", now)).toBe(-17);
  });
});
