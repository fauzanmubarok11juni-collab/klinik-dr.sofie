"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

/** Satu kotak untuk nama / NIK / No. HP / No. RM. Hasil muncul otomatis saat mengetik. */
export function KotakCari({ awal }: { awal: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [nilai, setNilai] = useState(awal);
  const [mencari, mulai] = useTransition();
  const pertama = useRef(true);

  useEffect(() => {
    if (pertama.current) { pertama.current = false; return; }
    const t = setTimeout(() => {
      mulai(() => router.replace(nilai.trim() ? `${pathname}?q=${encodeURIComponent(nilai.trim())}` : pathname));
    }, 300);
    return () => clearTimeout(t);
  }, [nilai, pathname, router]);

  return (
    <div>
      <label htmlFor="cari" className="mb-1.5 block font-bold">Cari pasien</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-redup" />
        <input
          id="cari" type="search" value={nilai} autoFocus autoComplete="off"
          onChange={(ev) => setNilai(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter") ev.preventDefault(); }}
          placeholder="Ketik nama, NIK, No. HP, atau No. RM"
          className="min-h-[56px] w-full rounded-lg border-2 border-garis bg-permukaan pl-11 pr-3 text-lg text-tinta placeholder:text-redup focus:border-utama"
        />
      </div>
      <p role="status" aria-live="polite" className="mt-1.5 min-h-[1.5rem] text-sm text-redup">
        {mencari ? "Mencari…" : ""}
      </p>
    </div>
  );
}
