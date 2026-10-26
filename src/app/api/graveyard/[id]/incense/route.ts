/**
 * POST /api/graveyard/:tombstoneId/incense
 * body: { opId, cardId, rating, reviewedAt, deviceId }
 * Ôn lại 1 thẻ gây chết. rating >= good => 1 nén nhang.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { newCardSrs, schedule } from "@/lib/srs";
import type { CardSrs } from "@/lib/types";

const Body = z.object({
  opId: z.string().uuid(),
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
  reviewedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().uuid().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const supabase = await supabaseServer();
  const { data: srs } = await supabase.from("card_srs").select("*").eq("card_id", b.cardId).maybeSingle();
  const now = new Date(b.reviewedAt);
  const next = schedule((srs as CardSrs | null) ?? newCardSrs(b.cardId, now), b.rating, now);

  const { data, error } = await supabase.rpc("light_incense", {
    p_tombstone_id: id,
    p_card_id: b.cardId,
    p_rating: b.rating,
    p_op_id: b.opId,
    p_reviewed_at: b.reviewedAt,
    p_srs: next,
    p_device_id: b.deviceId,
  });
  if (error) {
    const status = /NOT_FOUND|NOT_IN_GRAVE/.test(error.message) ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ tombstone: data });
}
