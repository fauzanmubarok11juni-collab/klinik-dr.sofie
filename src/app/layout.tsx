import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import { SettingsProvider, SKRIP_TEMA } from "@/lib/settings";
import "./globals.css";

// Atkinson Hyperlegible dirancang agar mudah dibaca, termasuk oleh lansia dan penderita gangguan penglihatan.
const font = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Praktik dr.sop",
  description: "Sistem informasi praktik dokter mandiri (rawat jalan)",
  robots: { index: false, follow: false }, // internal, jangan masuk mesin pencari
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e5e5a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={font.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="font-sans">
        <a
          href="#isi"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-utama focus:px-4 focus:py-3 focus:text-utama-teks"
        >
          Lompat ke isi halaman
        </a>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
