"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Nghe Supabase Realtime trên các bảng; có thay đổi (từ máy khác hoặc chính máy này)
 * thì render lại server component. Gộp nhiều sự kiện liên tiếp thành 1 lần refresh.
 */
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const key = tables.join(","); // mảng prop mới mỗi lần refresh; so theo nội dung để khỏi subscribe lại
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel(`live:${key}`);
    for (const table of key.split(",")) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 400);
      });
    }
    ch.subscribe();
    return () => {
      clearTimeout(timer.current);
      sb.removeChannel(ch);
    };
  }, [router, key]);

  return null;
}
