"use client";

import { useEffect, useState } from "react";
import { flush, pending } from "@/lib/outbox";
import { registerDevice, getDeviceId } from "@/lib/device";
import { supabaseEnabled } from "@/lib/supabase/client";

/**
 * Chạy nền trên mọi trang: đăng ký thiết bị, xả outbox khi có mạng / khi quay lại app,
 * và hiện badge số thao tác chưa đồng bộ.
 */
export function SyncAgent() {
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!supabaseEnabled) return;
    const sync = async () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setQueued(await flush());
      else setQueued((await pending()).length);
    };
    registerDevice(getDeviceId() ? undefined : null).catch(() => {});
    sync();
    const onVisible = () => document.visibilityState === "visible" && sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("cbcc:queued", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("cbcc:queued", sync);
    };
  }, []);

  if (online && queued === 0) return null;
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-black shadow-lg">
      {online ? `Đang đồng bộ ${queued} thao tác…` : `Offline · ${queued} thao tác chờ đồng bộ`}
    </div>
  );
}
