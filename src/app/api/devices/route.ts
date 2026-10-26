/**
 * POST /api/devices  { id?, kind, label, pushSubscription? }
 * Đăng ký / cập nhật thiết bị hiện tại. id lưu ở localStorage của thiết bị.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({
  id: z.string().uuid().nullish(),
  kind: z.enum(["phone", "tablet", "desktop", "unknown"]),
  label: z.string().max(80),
  pushSubscription: z
    .object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) })
    .passthrough()
    .nullish(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const row = {
    user_id: auth.user.id,
    kind: b.kind,
    label: b.label,
    last_seen_at: new Date().toISOString(),
    ...(b.pushSubscription !== undefined && { push_subscription: b.pushSubscription }),
  };
  // id cũ không còn (xoá DB, đổi tài khoản) => tạo mới
  const q = b.id
    ? supabase.from("devices").upsert({ id: b.id, ...row }).select("id").single()
    : supabase.from("devices").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
