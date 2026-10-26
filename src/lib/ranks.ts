/**
 * Danh hiệu châm biếm. Xếp theo tỷ lệ sai, có xét thêm số bệnh nhân đã tiễn
 * để người sai ít nhưng giết nhiều không thoát tội.
 */
export interface Rank {
  code: string;
  title: string;
  subtitle: string;
  color: string; // tailwind text color
}

const RANKS: (Rank & { maxWrongRate: number })[] = [
  { code: "truong_khoa", maxWrongRate: 0.05, title: "Trưởng khoa tương lai", subtitle: "Tạm thời chưa giết ai. Tạm thời.", color: "text-emerald-400" },
  { code: "noi_tru", maxWrongRate: 0.15, title: "Bác sĩ nội trú biết điều", subtitle: "Thỉnh thoảng sai, nhưng biết xấu hổ.", color: "text-lime-400" },
  { code: "thuc_tap_sinh", maxWrongRate: 0.25, title: "Thực tập sinh lơ ngơ", subtitle: "Cầm ống nghe như cầm tai nghe AirPods.", color: "text-yellow-400" },
  { code: "lang_bam", maxWrongRate: 0.4, title: "Lang băm", subtitle: "Kê đơn theo cảm hứng, chẩn đoán theo horoscope.", color: "text-orange-400" },
  { code: "sat_thu", maxWrongRate: 0.6, title: "Sát thủ blouse trắng", subtitle: "Nghĩa trang phải mở rộng thêm khu B.", color: "text-red-500" },
  { code: "than_chet", maxWrongRate: 1, title: "Thần Chết có chứng chỉ hành nghề", subtitle: "Bệnh viện đang cân nhắc trả lương cho bạn để ĐỪNG đi làm.", color: "text-fuchsia-500" },
];

export const ROOKIE: Rank = {
  code: "mam_non",
  title: "Sinh viên cầm ống nghe ngược",
  subtitle: "Chưa đủ 20 câu để bị phán xét. Tận hưởng đi.",
  color: "text-zinc-400",
};

export function rankFor(stats: { total: number; wrong: number; killed: number; saved: number }): Rank {
  if (stats.total < 20) return ROOKIE;
  const wrongRate = stats.wrong / stats.total;
  let idx = RANKS.findIndex((r) => wrongRate <= r.maxWrongRate);
  // Tử vong nhiều hơn xuất viện => tụt 1 bậc, bất kể tỷ lệ đẹp cỡ nào
  if (stats.killed > stats.saved && idx < RANKS.length - 1) idx += 1;
  const { maxWrongRate: _, ...rank } = RANKS[idx];
  return rank;
}
