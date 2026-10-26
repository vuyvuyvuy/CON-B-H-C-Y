"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/device";

const TEXT: Record<PushState, string> = {
  unsupported: "Trình duyệt này không hỗ trợ thông báo.",
  "needs-install": "iPhone/iPad: bấm Chia sẻ → “Thêm vào MH chính”, mở app từ icon rồi bật thông báo.",
  denied: "Bạn đã chặn thông báo. Mở Cài đặt trình duyệt để cho phép lại.",
  off: "Thông báo đang tắt. Không ai nhắc bạn bệnh nhân đang chết.",
  on: "Đã bật chửi trên thiết bị này.",
};

export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (!state) return null;
  const canToggle = state === "on" || state === "off";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-400">{TEXT[state]}</p>
      {canToggle && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setState(state === "on" ? await disablePush() : await enablePush());
            } finally {
              setBusy(false);
            }
          }}
          className={`mt-3 w-full rounded-lg py-2 font-semibold disabled:opacity-50 ${state === "on" ? "border border-zinc-700" : "bg-amber-500 text-black"}`}
        >
          {state === "on" ? "Tắt thông báo (hèn)" : "🔔 Bật thông báo cục súc"}
        </button>
      )}
    </div>
  );
}
