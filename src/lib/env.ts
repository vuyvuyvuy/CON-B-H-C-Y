/** Không có Supabase env => app chạy chế độ DEMO (dữ liệu mẫu, chấm điểm local). */
export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
