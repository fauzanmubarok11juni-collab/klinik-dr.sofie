"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tandaiPengingat } from "./actions";

/** Menyalin pesan pengingat siap tempel. Tidak ada pengiriman otomatis: staf menempelkannya sendiri ke WhatsApp. */
export function TombolPengingat({ id, pesan, waHref }: { id: string; pesan: string; waHref: string | null }) {
  const [hasil, setHasil] = useState<"diam" | "ok" | "gagal">("diam");

  async function salin() {
    try {
      await navigator.clipboard.writeText(pesan);
      setHasil("ok");
    } catch {
      // Cadangan untuk peramban yang menolak clipboard
      const ta = document.createElement("textarea");
      ta.value = pesan; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      setHasil(ok ? "ok" : "gagal");
      if (!ok) return;
    }
    void tandaiPengingat(id);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={salin}>
          {hasil === "ok" ? <Check aria-hidden className="h-5 w-5" /> : <Copy aria-hidden className="h-5 w-5" />}
          {hasil === "ok" ? "Pesan tersalin" : "Salin pesan pengingat"}
        </Button>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-garis bg-permukaan px-4 font-bold hover:border-utama">
            <MessageCircle aria-hidden className="h-5 w-5" /> Buka WhatsApp
          </a>
        )}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-redup">
        {hasil === "ok" ? "Sudah disalin. Tempel (paste) ke WhatsApp pasien." : hasil === "gagal" ? "Gagal menyalin. Tekan lama pada pesan di bawah, lalu pilih Salin." : ""}
      </p>
      <details>
        <summary className="min-h-[44px] cursor-pointer leading-[44px] underline">Lihat isi pesan</summary>
        <pre className="whitespace-pre-wrap rounded-lg border-2 border-garis bg-kertas p-3 font-sans text-base">{pesan}</pre>
      </details>
    </div>
  );
}
