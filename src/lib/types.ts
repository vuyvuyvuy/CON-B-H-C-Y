export type SrsState = "new" | "learning" | "review" | "relearning" | "suspended";
export type SrsRating = "again" | "hard" | "good" | "easy";

export interface CardSrs {
  card_id: string;
  state: SrsState;
  due_at: string; // ISO
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
  learning_step: number;
  last_reviewed_at: string | null;
}

export interface Exam {
  id: string;
  title: string;
  subject_code?: string;
  exam_at: string; // ISO, có offset +07:00
  total_slides?: number | null;
  slides_done?: number;
  is_done: boolean;
}

export interface CaseOption {
  id: string;
  text: string;
  is_correct: boolean;
  rationale: string;
}

export interface CaseStep {
  id: string;
  step_order: number;
  narrative: string;
  question: string;
  options: CaseOption[];
  hp_penalty: number;
  card_ids: string[];
  /** Vitals sau bước này — để monitor nhảy số cho kịch tính */
  vitals?: Vitals;
}

export interface Vitals {
  hr: number;
  bp: string;
  spo2: number;
  rr: number;
  temp: number;
}

export interface ClinicalCase {
  id: string;
  title: string;
  topic: string;
  patient: { name: string; age: number; sex: "Nam" | "Nữ"; history: string; vitals: Vitals };
  opening: string;
  max_hp: number;
  steps: CaseStep[];
}
