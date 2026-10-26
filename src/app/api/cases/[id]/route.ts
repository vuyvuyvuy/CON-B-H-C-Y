/**
 * PATCH /api/cases/:id  { status: "published" | "archived" }  — duyệt ca nháp do AI gen
 * DELETE /api/cases/:id                                       — xoá ca (thẻ vẫn giữ)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const Patch = z.object({ status: z.enum(["published", "archived"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = Patch.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const supabase = await supabaseServer();
  const { error } = await supabase.from("clinical_cases").update({ status: body.data.status }).eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { error } = await supabase.from("clinical_cases").delete().eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
