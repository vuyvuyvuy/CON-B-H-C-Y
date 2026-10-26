"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postOrQueue } from "@/lib/outbox";
import { getDeviceId } from "@/lib/device";
import type { SrsRating } from "@/lib/types";

export interface Grave {
  id: string;
  name: string;
  cause: string;
  epitaph: string;
  diedAt: string;
  redeemed: boolean;
  cards: { id: string; front: string; back: string; lit: boolean }[];
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso));

export function Graveyard({ graves: initial, demo }: { graves: Grave[]; demo: boolean }) {
  const [graves, setGraves] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);

  if (!graves.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
        <p className="text-4xl">🌱</p>
        <p className="mt-2 font-bold">Nghĩa trang còn trống.</p>
        <p className="text-zinc-400">Chưa ai chết dưới tay bạn. Chắc tại bạn chưa chơi ca nào.</p>
      </div>
    );
  }

  const markLit = (graveId: string, cardId: string) =>
    setGraves((gs) =>
      gs.map((g) => {
        if (g.id !== graveId) return g;
        const cards = g.cards.map((c) => (c.id === cardId ? { ...c, lit: true } : c));
        return { ...g, cards, redeemed: cards.every((c) => c.lit) };
      }),
    );

  const active = graves.find((g) => g.id === open);

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {graves.map((g) => {
          const lit = g.cards.filter((c) => c.lit).length;
          return (
            <li key={g.id} className={`rounded-b-lg rounded-t-[2rem] border p-4 ${g.redeemed ? "border-zinc-800 bg-zinc-900/30 opacity-60" : "border-zinc-700 bg-zinc-900"}`}>
              <p className="text-center text-3xl">{g.redeemed ? "🕊️" : "🪦"}</p>
              <p className="mt-1 text-center font-bold">{g.name}</p>
              <p className="text-center text-sm text-zinc-400">{g.cause}</p>
              <p className="mt-1 text-center text-xs italic text-zinc-500">“{g.epitaph}”</p>
              <p className="mt-1 text-center font-mono text-xs text-zinc-600">Mất lúc {fmt(g.diedAt)}</p>
              <p className="mt-3 text-center text-lg tracking-widest">
                {"🕯️".repeat(lit)}
                <span className="opacity-20">{"🕯️".repeat(g.cards.length - lit)}</span>
              </p>
              {!g.redeemed && (
                <button onClick={() => setOpen(g.id)} className="mt-3 w-full rounded-lg bg-amber-600 py-2 font-semibold text-black hover:bg-amber-500">
                  Thắp nhang ({g.cards.length - lit} thẻ)
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {active && <IncenseSession grave={active} demo={demo} onLit={(cid) => markLit(active.id, cid)} onClose={() => setOpen(null)} />}
    </>
  );
}

const RATINGS: { r: SrsRating; label: string; cls: string }[] = [
  { r: "again", label: "Quên sạch", cls: "bg-red-700" },
  { r: "hard", label: "Lờ mờ", cls: "bg-orange-700" },
  { r: "good", label: "Nhớ", cls: "bg-emerald-700" },
  { r: "easy", label: "Dễ ợt", cls: "bg-sky-700" },
];

/** Ôn từng thẻ chưa thắp. Quên => thẻ quay lại cuối hàng, phải ôn tới khi nhớ. */
function IncenseSession({ grave, demo, onLit, onClose }: { grave: Grave; demo: boolean; onLit: (cardId: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [queue, setQueue] = useState(() => grave.cards.filter((c) => !c.lit));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = queue[0];

  const rate = async (r: SrsRating) => {
    setBusy(true);
    if (!demo) {
      const res = await postOrQueue(`/api/graveyard/${grave.id}/incense`, {
        opId: crypto.randomUUID(), cardId: card.id, rating: r, reviewedAt: new Date().toISOString(), deviceId: getDeviceId(),
      });
      if (!res) window.dispatchEvent(new Event("cbcc:queued"));
    }
    if (r === "good" || r === "easy") {
      onLit(card.id);
      setQueue((q) => q.slice(1));
    } else {
      setQueue((q) => [...q.slice(1), q[0]]);
    }
    setShown(false);
    setBusy(false);
  };

  const close = () => {
    onClose();
    if (!demo) router.refresh();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/80 p-4 sm:items-center" onClick={close}>
      <div className="w-full max-w-lg rounded-2xl border border-amber-800 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-500">Thắp nhang cho {grave.name}</p>
          <button onClick={close} className="text-zinc-500 hover:text-white" aria-label="Đóng">✕</button>
        </div>
        {card ? (
          <>
            <p className="mt-4 text-lg font-semibold">{card.front}</p>
            {shown ? (
              <>
                <p className="mt-3 whitespace-pre-line rounded-lg bg-zinc-900 p-3 text-zinc-200">{card.back}</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {RATINGS.map((x) => (
                    <button key={x.r} disabled={busy} onClick={() => rate(x.r)} className={`rounded-lg py-2 text-sm font-semibold ${x.cls} disabled:opacity-50`}>
                      {x.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button onClick={() => setShown(true)} className="mt-4 w-full rounded-lg bg-zinc-100 py-2 font-semibold text-zinc-900">Lật thẻ</button>
            )}
            <p className="mt-3 text-center text-xs text-zinc-500">Còn {queue.length} thẻ</p>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="text-4xl">🕊️</p>
            <p className="mt-2 font-bold">Siêu thoát rồi.</p>
            <p className="text-zinc-400">Lần sau học trước khi cầm dao kéo nhé.</p>
            <button onClick={close} className="mt-4 rounded-lg bg-zinc-100 px-4 py-2 font-semibold text-zinc-900">Rời nghĩa trang</button>
          </div>
        )}
      </div>
    </div>
  );
}
