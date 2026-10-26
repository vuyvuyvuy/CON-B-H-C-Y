/**
 * GET /api/cron/nag — gọi mỗi 30 phút bởi Vercel Cron hoặc pg_cron + pg_net.
 * Header: Authorization: Bearer $CRON_SECRET
 */
import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pickNag, type NagContext } from "@/lib/push/messages";

export const runtime = "nodejs";

const MIN_GAP_MS = 3 * 3600_000; // tối đa 1 lần / 3 tiếng — cục súc nhưng không phải spam

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Không phải cron thì biến." }, { status: 401 });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const db = supabaseAdmin();
  const now = new Date();

  const { data: profiles } = await db.from("profiles").select("id, timezone, streak_current, last_study_date, nag_level, quiet_hours");
  let sent = 0;

  for (const p of profiles ?? []) {
    const hourLocal = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: p.timezone }).format(now));
    const quiet = /^\[(\d+),(\d+)\)$/.exec(p.quiet_hours ?? "");
    if (quiet && hourLocal >= +quiet[1] && hourLocal < +quiet[2]) continue;

    const { data: last } = await db.from("notification_log").select("sent_at").eq("user_id", p.id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last && now.getTime() - new Date(last.sent_at).getTime() < MIN_GAP_MS) continue;

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone }).format(now);
    const [due, run, exam, graves] = await Promise.all([
      db.from("card_srs").select("card_id", { count: "exact", head: true }).eq("user_id", p.id).lte("due_at", now.toISOString()).neq("state", "suspended"),
      db.from("case_runs").select("hp").eq("user_id", p.id).eq("status", "in_progress").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("exams").select("title, exam_at").eq("user_id", p.id).eq("is_done", false).gt("exam_at", now.toISOString()).order("exam_at").limit(1).maybeSingle(),
      db.from("tombstones").select("id", { count: "exact", head: true }).eq("user_id", p.id).is("redeemed_at", null),
    ]);

    const ctx: NagContext = {
      dueCards: due.count ?? 0,
      activeRunHp: run.data?.hp ?? null,
      nextExam: exam.data ? { title: exam.data.title, days: Math.ceil((new Date(exam.data.exam_at).getTime() - now.getTime()) / 86_400_000) } : null,
      unredeemedGraves: graves.count ?? 0,
      streak: p.streak_current,
      studiedToday: p.last_study_date === today,
      hourLocal,
      nagLevel: p.nag_level,
    };
    const nag = pickNag(ctx);
    if (!nag) continue;

    const { data: devices } = await db.from("devices").select("id, push_subscription").eq("user_id", p.id).not("push_subscription", "is", null);
    for (const d of devices ?? []) {
      try {
        await webpush.sendNotification(d.push_subscription, JSON.stringify({ title: nag.title, body: nag.body, url: "/er" }));
        await db.from("notification_log").insert({ user_id: p.id, device_id: d.id, template: nag.template, body: nag.body });
        sent++;
      } catch (e: any) {
        // 404/410: subscription chết (gỡ app, đổi máy) => dọn
        if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("devices").update({ push_subscription: null }).eq("id", d.id);
      }
    }
  }
  return NextResponse.json({ sent });
}
