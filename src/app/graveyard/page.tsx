import { hasSupabase } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { Graveyard, type Grave } from "@/components/Graveyard";

const DEMO_GRAVES: Grave[] = [
  {
    id: "demo-1", name: "Bà Lan, 67t", cause: "Sốc phản vệ", epitaph: "Ra đi lúc 23:41 24/10. Hung thủ: chính bạn.", diedAt: "2026-10-24T23:41:00+07:00", redeemed: false,
    cards: [
      { id: "d1", front: "Thuốc đầu tay trong sốc phản vệ?", back: "Adrenalin tiêm bắp (mặt trước ngoài đùi).", lit: true },
      { id: "d2", front: "Liều Adrenalin TB cho người lớn trong sốc phản vệ?", back: "0,5 mg (0,5 ml dung dịch 1 mg/ml), nhắc lại sau 5 phút nếu cần.", lit: false },
    ],
  },
  {
    id: "demo-2", name: "Ông Ba, 72t", cause: "Đột quỵ thiếu máu não", epitaph: "Ra đi lúc 22:03 19/10. Hung thủ: chính bạn.", diedAt: "2026-10-19T22:03:00+07:00", redeemed: true,
    cards: [{ id: "d3", front: "Cửa sổ tiêu sợi huyết TM với alteplase?", back: "Trong vòng 4,5 giờ từ lúc khởi phát.", lit: true }],
  },
];

export default async function GraveyardPage() {
  let graves = DEMO_GRAVES;

  if (hasSupabase) {
    const supabase = await supabaseServer();
    const { data: rows } = await supabase
      .from("tombstones")
      .select("id, epitaph, cause_card_ids, died_at, redeemed_at, clinical_cases(topic, patient), incense_offerings(card_id)")
      .order("redeemed_at", { ascending: true, nullsFirst: true })
      .order("died_at", { ascending: false })
      .limit(60);
    const ids = [...new Set((rows ?? []).flatMap((r) => r.cause_card_ids as string[]))];
    const { data: cards } = ids.length ? await supabase.from("cards").select("id, front, back").in("id", ids) : { data: [] };
    const byId = new Map((cards ?? []).map((c) => [c.id, c]));

    graves = (rows ?? []).map((r: any) => {
      const lit = new Set((r.incense_offerings ?? []).map((o: { card_id: string }) => o.card_id));
      return {
        id: r.id,
        name: `${r.clinical_cases?.patient?.name ?? "Vô danh"}, ${r.clinical_cases?.patient?.age ?? "?"}t`,
        cause: r.clinical_cases?.topic ?? "",
        epitaph: r.epitaph,
        diedAt: r.died_at,
        redeemed: !!r.redeemed_at,
        cards: (r.cause_card_ids as string[]).filter((id) => byId.has(id)).map((id) => ({ ...byId.get(id)!, lit: lit.has(id) })),
      };
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Nghĩa trang</h1>
        <p className="text-zinc-400">Mỗi nén nhang = ôn lại 1 thẻ đã làm sai và nhớ được (≥ GOOD). Thắp đủ thì hồn siêu thoát.</p>
      </div>
      <Graveyard graves={graves} demo={!hasSupabase} />
    </div>
  );
}
