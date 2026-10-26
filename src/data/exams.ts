import type { Exam } from "@/lib/types";

/** Seed từ "LỊCH THI YVD 26-27" + mã học phần trong DMHP lớp Y Việt - Đức. Giờ VN (+07:00). */
export const SEED_EXAMS: Exam[] = [
  { id: "ls-tt", title: "LS Tâm Thần", subject_code: "THH0049", exam_at: "2026-10-09T07:00:00+07:00", is_done: true },
  { id: "tmh", title: "Tai Mũi Họng", subject_code: "TMH0054", exam_at: "2026-11-06T13:30:00+07:00", total_slides: 8, is_done: false },
  { id: "tt", title: "Tâm Thần", subject_code: "THH0049", exam_at: "2026-11-13T09:30:00+07:00", total_slides: 11, is_done: false },
  { id: "dl", title: "Da Liễu", subject_code: "DL0050", exam_at: "2026-11-20T09:30:00+07:00", total_slides: 15, is_done: false },
  { id: "mat", title: "Mắt", subject_code: "MAT0051", exam_at: "2026-11-27T09:30:00+07:00", total_slides: 11, is_done: false },
  { id: "gmhs", title: "Gây Mê Hồi Sức", subject_code: "GMHS0058", exam_at: "2026-12-11T13:30:00+07:00", is_done: false },
  { id: "spk", title: "Sản Phụ Khoa", subject_code: "SPK0052", exam_at: "2026-12-18T13:30:00+07:00", is_done: false },
  { id: "tk", title: "Thần Kinh", subject_code: "TK0055", exam_at: "2026-12-25T15:00:00+07:00", total_slides: 8, is_done: false },
  { id: "nhi", title: "Nhi Khoa", subject_code: "NHI0053", exam_at: "2027-01-07T13:30:00+07:00", is_done: false },
];
