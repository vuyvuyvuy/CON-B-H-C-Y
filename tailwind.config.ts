import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
      keyframes: {
        flatline: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-6px)" },
          "40%,80%": { transform: "translateX(6px)" },
        },
      },
      animation: { flatline: "flatline 1s ease-in-out infinite", shake: "shake 0.4s ease-in-out" },
    },
  },
  plugins: [],
} satisfies Config;
