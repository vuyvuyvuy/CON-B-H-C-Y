"use client";

import { useState } from "react";
import { supabaseBrowser, supabaseEnabled } from "@/lib/supabase/client";

/**
 * Đăng nhập bằng mã OTP qua email: gõ mã 6 số thay vì bấm link — PWA trên iOS mở link
 * trong Safari chứ không phải trong app, nên link magic sẽ đăng nhập nhầm chỗ.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabaseEnabled) {
    return <p className="text-zinc-400">Chế độ DEMO: chưa cấu hình Supabase nên không cần đăng nhập.</p>;
  }

  const next = () => new URLSearchParams(location.search).get("next") || "/dashboard";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next())}` },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setSent(true);
    setMsg("Đã gửi mã 6 số vào email. Bệnh nhân đang chờ, nhanh lên.");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) return setMsg("Sai mã. Đến cái mã 6 số còn nhập sai thì kê đơn kiểu gì?");
    location.href = next();
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <div>
        <h1 className="text-3xl font-black">Trình diện</h1>
        <p className="text-zinc-400">Đăng nhập để đồng bộ tiến độ giữa điện thoại, iPad và PC.</p>
      </div>
      <form onSubmit={sent ? verify : send} className="space-y-3">
        <input
          type="email"
          required
          disabled={sent}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@sinhvien.edu.vn"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 disabled:opacity-60"
        />
        {sent && (
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="Mã 6 số"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono tracking-widest"
          />
        )}
        <button disabled={busy} className="w-full rounded-lg bg-red-600 py-2 font-bold hover:bg-red-500 disabled:opacity-50">
          {sent ? "Vào ca trực" : "Gửi mã"}
        </button>
      </form>
      {msg && <p className="text-sm text-zinc-400">{msg}</p>}
    </div>
  );
}
