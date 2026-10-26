const DEMO_GRAVES = [
  { id: "1", name: "Bà Lan, 67t", cause: "Sốc phản vệ — quên Adrenalin tiêm bắp", died: "24/10 23:41", lit: 1, need: 4 },
  { id: "2", name: "Bé Na, 4t", cause: "Viêm thanh khí phế quản — cho nằm ngửa khám họng", died: "25/10 01:12", lit: 0, need: 3 },
  { id: "3", name: "Ông Ba, 72t", cause: "Đột quỵ — tiêu sợi huyết ngoài cửa sổ", died: "19/10 22:03", lit: 5, need: 5 },
];

export default function GraveyardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Nghĩa trang</h1>
        <p className="text-zinc-400">Mỗi nén nhang = ôn lại 1 thẻ đã làm sai (trả lời ≥ GOOD). Thắp đủ thì hồn siêu thoát.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {DEMO_GRAVES.map((g) => {
          const redeemed = g.lit >= g.need;
          return (
            <li key={g.id} className={`rounded-t-[2rem] rounded-b-lg border p-4 ${redeemed ? "border-zinc-800 bg-zinc-900/30 opacity-60" : "border-zinc-700 bg-zinc-900"}`}>
              <p className="text-center text-3xl">{redeemed ? "🕊️" : "🪦"}</p>
              <p className="mt-1 text-center font-bold">{g.name}</p>
              <p className="text-center text-sm text-zinc-400">{g.cause}</p>
              <p className="mt-1 text-center font-mono text-xs text-zinc-600">Mất lúc {g.died}</p>
              <p className="mt-3 text-center text-lg tracking-widest">
                {"🕯️".repeat(g.lit)}
                <span className="opacity-20">{"🕯️".repeat(Math.max(0, g.need - g.lit))}</span>
              </p>
              {!redeemed && (
                <button className="mt-3 w-full rounded-lg bg-amber-600 py-2 font-semibold text-black hover:bg-amber-500">
                  Thắp nhang ({g.need - g.lit} thẻ)
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
