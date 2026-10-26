import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Bấm link trong email (thay vì gõ mã) => đổi code lấy session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/dashboard", url.origin));
}
