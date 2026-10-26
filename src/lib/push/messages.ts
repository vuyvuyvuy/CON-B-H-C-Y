/**
 * Template thông báo đẩy. Chọn theo ngữ cảnh: số thẻ đến hạn, ngày tới kỳ thi gần nhất,
 * bệnh nhân đang dở dang, mộ chưa thắp nhang, streak sắp đứt, và giờ trong ngày.
 */
export interface NagContext {
  dueCards: number;
  activeRunHp: number | null;
  nextExam: { title: string; days: number } | null;
  unredeemedGraves: number;
  streak: number;
  studiedToday: boolean;
  hourLocal: number;
  nagLevel: 0 | 1 | 2 | 3;
}

interface Template {
  id: string;
  minLevel: 0 | 1 | 2 | 3;
  when: (c: NagContext) => boolean;
  title: (c: NagContext) => string;
  body: (c: NagContext) => string;
  weight: number;
}

const TEMPLATES: Template[] = [
  {
    id: "dying_patient_night",
    minLevel: 2,
    when: (c) => c.activeRunHp !== null && c.hourLocal >= 21,
    title: () => "🚨 Code Blue",
    body: (c) => `Bệnh nhân đang hấp hối (HP ${c.activeRunHp}) chờ mài vào kê đơn, hay định đi ngủ luôn?`,
    weight: 5,
  },
  {
    id: "exam_close",
    minLevel: 1,
    when: (c) => !!c.nextExam && c.nextExam.days <= 7,
    title: (c) => `⏳ ${c.nextExam!.title}: còn ${c.nextExam!.days} ngày`,
    body: (c) =>
      c.nextExam!.days <= 2
        ? `${c.dueCards} thẻ chưa ôn. Giờ này mà còn lướt điện thoại thì chuẩn bị tinh thần học lại hè nha.`
        : `${c.dueCards} thẻ đang đợi. Thầy không đợi bạn đâu.`,
    weight: 4,
  },
  {
    id: "graveyard",
    minLevel: 1,
    when: (c) => c.unredeemedGraves > 0,
    title: () => "🕯️ Nghĩa trang gọi tên bạn",
    body: (c) => `${c.unredeemedGraves} linh hồn chưa siêu thoát vì bạn chưa ôn lại thẻ sai. Họ biết nhà bạn ở đâu.`,
    weight: 3,
  },
  {
    id: "streak_break",
    minLevel: 1,
    when: (c) => c.streak >= 3 && !c.studiedToday && c.hourLocal >= 20,
    title: () => "🔥 Streak sắp tắt thở",
    body: (c) => `Chuỗi ${c.streak} ngày sắp ngừng tim. Ép tim ngoài lồng ngực bằng 10 thẻ đi.`,
    weight: 4,
  },
  {
    id: "pile_up",
    minLevel: 2,
    when: (c) => c.dueCards >= 100,
    title: () => "📚 Thẻ chất đống",
    body: (c) => `${c.dueCards} thẻ quá hạn. Đây không còn là deck nữa, đây là bãi rác y tế.`,
    weight: 2,
  },
  {
    id: "gentle",
    minLevel: 0,
    when: (c) => c.dueCards > 0,
    title: () => "Đến giờ ôn bài",
    body: (c) => `Có ${c.dueCards} thẻ đến hạn. Làm vài ca nhé.`,
    weight: 1,
  },
];

export function pickNag(c: NagContext, rand: () => number = Math.random) {
  const eligible = TEMPLATES.filter((t) => c.nagLevel >= t.minLevel && t.when(c));
  if (!eligible.length) return null;
  // Ở nag_level 0 chỉ còn template "gentle"; level cao thì ưu tiên câu gắt (weight lớn)
  const total = eligible.reduce((s, t) => s + t.weight, 0);
  let r = rand() * total;
  const t = eligible.find((x) => (r -= x.weight) < 0) ?? eligible[0];
  return { template: t.id, title: t.title(c), body: t.body(c) };
}
