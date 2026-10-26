/**
 * Kho câu chửi. Phân tầng theo mức độ nguy kịch SAU khi trừ HP,
 * để giọng điệu leo thang đúng lúc bệnh nhân tụt dốc.
 *
 * Placeholder: {patient} {hp} {penalty} {streak}
 */
export type Severity = "scratch" | "bleeding" | "critical" | "dead";

const INSULTS: Record<Severity, string[]> = {
  scratch: [
    "Ừ, sai nhẹ thôi. {patient} chỉ mất {penalty} máu. Chắc tại hôm qua thức khuya xem TikTok?",
    "Trật lất. Nhưng yên tâm, {patient} còn {hp} HP — đủ để sống sót qua thêm một lần bạn ngu nữa.",
    "Câu này slide có. Slide có. SLIDE. CÓ.",
    "Thầy giảng câu này rồi đó. Lúc đó bạn đang làm gì? À, ngủ.",
    "Sai mà tự tin ghê. Cái tự tin đó để dành đi thi vấn đáp.",
  ],
  bleeding: [
    "{patient} bắt đầu nhìn bạn bằng ánh mắt của người viết di chúc.",
    "HP còn {hp}. Người nhà bệnh nhân đang hỏi số điện thoại của luật sư.",
    "Điều dưỡng vừa lén gọi cho bác sĩ khác. Không phải bạn. Không bao giờ là bạn.",
    "Chúc mừng, bạn vừa phát minh ra một phác đồ mà Bộ Y tế chưa kịp cấm.",
    "Cái này mà ra đề thi là bạn rớt, còn ngoài đời là {patient} rớt — xuống lỗ.",
  ],
  critical: [
    "Monitor đang kêu bíp bíp. Đó không phải nhạc nền, đó là tiếng {patient} đang rời khỏi server.",
    "HP {hp}. Khoa giải phẫu bệnh đã chuẩn bị bàn. Cảm ơn bạn đã đóng góp tiêu bản.",
    "Bạn đang cách danh hiệu 'Sát thủ blouse trắng' đúng 1 click.",
    "{patient} đang thấy ánh sáng cuối đường hầm. Đó là đèn phẫu thuật — hoặc không.",
    "Người nhà đã bắt đầu đặt vòng hoa. Online. Ship hỏa tốc.",
  ],
  dead: [
    "{patient} đã đăng xuất khỏi cuộc đời. Lý do: bác sĩ điều trị là bạn.",
    "Giờ tử vong: ngay bây giờ. Nguyên nhân: kiến thức của bạn ngừng tuần hoàn trước.",
    "Thêm một bia mộ trong nghĩa trang. Vào thắp nhang đi, hồn {patient} chưa siêu thoát đâu.",
    "Ca này mà lên báo thì tiêu đề là: 'Sinh viên Y năm 4 và 150 thẻ Anki chưa ôn'.",
    "Flatline. Bạn có thể ngừng bóp bóng. Bạn cũng có thể ngừng giả vờ đã học bài.",
  ],
};

const PRAISE = [
  "Đúng. Đừng tưởng bở, đây là kiến thức tối thiểu.",
  "Chuẩn. {patient} sống thêm được một nhịp tim nữa nhờ bạn. Ghi công đi.",
  "Ok, lần này não bạn có online.",
  "Đúng rồi. Thấy chưa, học vào là biết liền.",
  "Hợp lý. Bệnh nhân chưa chết, chưa phải lúc ăn mừng.",
];

export function severityFor(hpAfter: number, maxHp: number): Severity {
  if (hpAfter <= 0) return "dead";
  const pct = hpAfter / maxHp;
  if (pct <= 0.25) return "critical";
  if (pct <= 0.6) return "bleeding";
  return "scratch";
}

function fill(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/**
 * Bốc ngẫu nhiên nhưng không lặp lại câu vừa dùng — chửi lặp là chửi dở.
 * `recent` là danh sách template đã dùng gần đây (component tự giữ).
 */
export function pickInsult(
  severity: Severity,
  vars: Record<string, string | number>,
  recent: string[] = [],
  rand: () => number = Math.random,
): { template: string; text: string } {
  const pool = INSULTS[severity];
  const fresh = pool.filter((t) => !recent.includes(t));
  const candidates = fresh.length ? fresh : pool;
  const template = candidates[Math.floor(rand() * candidates.length)];
  return { template, text: fill(template, vars) };
}

export function pickPraise(vars: Record<string, string | number>, rand: () => number = Math.random) {
  return fill(PRAISE[Math.floor(rand() * PRAISE.length)], vars);
}
