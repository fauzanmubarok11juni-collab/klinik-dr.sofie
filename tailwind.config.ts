import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-tema="gelap"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      colors: {
        // Semua warna lewat variabel CSS supaya tema terang/gelap mudah.
        kertas: "rgb(var(--kertas) / <alpha-value>)",
        permukaan: "rgb(var(--permukaan) / <alpha-value>)",
        tinta: "rgb(var(--tinta) / <alpha-value>)",
        redup: "rgb(var(--redup) / <alpha-value>)",
        garis: "rgb(var(--garis) / <alpha-value>)",
        utama: "rgb(var(--utama) / <alpha-value>)",
        "utama-teks": "rgb(var(--utama-teks) / <alpha-value>)",
        peringatan: "rgb(var(--peringatan) / <alpha-value>)",
        bahaya: "rgb(var(--bahaya) / <alpha-value>)",
        berhasil: "rgb(var(--berhasil) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
export default config;
