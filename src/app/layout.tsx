import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Con Bệnh Cấp Cứu",
  description: "Ôn Anki bằng cách cứu (hoặc giết) bệnh nhân.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Cấp Cứu" },
};

export const viewport: Viewport = { themeColor: "#09090b", width: "device-width", initialScale: 1, viewportFit: "cover" };

const NAV = [
  { href: "/dashboard", label: "Bảng tử thần" },
  { href: "/er", label: "Phòng cấp cứu" },
  { href: "/graveyard", label: "Nghĩa trang" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh ecg-grid">
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-3 text-sm">
            <span className="mr-3 font-mono font-bold text-red-500">✚ CẤP CỨU</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
