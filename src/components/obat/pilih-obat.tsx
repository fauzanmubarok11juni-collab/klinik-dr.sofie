"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cariObat } from "@/app/(app)/obat/actions";
import { namaObat, type MedInfo } from "@/lib/obat";
import { rupiah } from "@/lib/format";

/** Pencarian obat dengan saran otomatis (keyboard: panah + Enter). Kotak kosong = obat yang sering dipakai. */
export function PilihObat({
  hanyaDijual, onPilih, onTulisSendiri, label, placeholder,
}: {
  hanyaDijual: boolean;
  onPilih: (m: MedInfo) => void;
  onTulisSendiri?: (nama: string) => void;
  label: string;
  placeholder?: string;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<MedInfo[]>([]);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [memuat, setMemuat] = useState(false);
  const urutan = useRef(0);

  const adaBebas = !!onTulisSendiri && q.trim().length >= 2;
  const total = hasil.length + (adaBebas ? 1 : 0);

  useEffect(() => {
    if (!buka) return;
    const t = setTimeout(async () => {
      const saya = ++urutan.current;
      setMemuat(true);
      try {
        const r = await cariObat(q, hanyaDijual);
        if (saya === urutan.current) { setHasil(r); setAktif(0); }
      } finally {
        if (saya === urutan.current) setMemuat(false);
      }
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [q, buka, hanyaDijual]);

  function pilihIndeks(i: number) {
    if (i < hasil.length) onPilih(hasil[i]);
    else if (onTulisSendiri) onTulisSendiri(q.trim());
    setQ(""); setBuka(false);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setBuka(true); setAktif((a) => Math.min(a + 1, Math.max(total - 1, 0))); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
    else if (ev.key === "Enter") { if (buka && total > 0) { ev.preventDefault(); pilihIndeks(aktif); } }
    else if (ev.key === "Escape") setBuka(false);
  }

  const idList = `${uid}-daftar`;
  return (
    <div>
      <label htmlFor={`${uid}-cari`} className="mb-1.5 block font-bold">{label}</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-redup" />
        <input
          id={`${uid}-cari`} role="combobox" aria-expanded={buka} aria-controls={idList} aria-autocomplete="list"
          aria-activedescendant={buka && total > 0 ? `${uid}-o-${aktif}` : undefined}
          value={q} autoComplete="off" placeholder={placeholder ?? "Ketik nama obat"}
          onChange={(e) => { setQ(e.target.value); setBuka(true); }}
          onFocus={() => setBuka(true)} onBlur={() => setBuka(false)} onKeyDown={onKeyDown}
          className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan pl-10 pr-3 text-base text-tinta placeholder:text-redup focus:border-utama"
        />
        {buka && (
          <ul id={idList} role="listbox" aria-label="Saran obat"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border-2 border-utama bg-permukaan shadow-lg">
            {memuat && total === 0 && <li className="px-3 py-2 text-redup">Mencari…</li>}
            {!memuat && total === 0 && <li className="px-3 py-2 text-redup">Tidak ada yang cocok.</li>}
            {!q && hasil.length > 0 && <li aria-hidden className="px-3 pt-2 text-sm font-bold text-redup">Sering dipakai</li>}
            {hasil.map((m, i) => (
              <li key={m.id} id={`${uid}-o-${i}`} role="option" aria-selected={i === aktif}
                onMouseDown={(e) => { e.preventDefault(); pilihIndeks(i); }} onMouseEnter={() => setAktif(i)}
                className={`flex min-h-[44px] cursor-pointer flex-wrap items-center justify-between gap-x-3 px-3 py-2 ${i === aktif ? "bg-utama text-utama-teks" : ""}`}>
                <span className="font-bold">{namaObat(m)}</span>
                {m.dijual && (
                  <span className="text-sm">
                    {m.stok_saat_ini <= 0 ? "Habis" : `Stok ${m.stok_saat_ini}`}, {rupiah(m.harga_jual)}
                  </span>
                )}
              </li>
            ))}
            {adaBebas && (
              <li id={`${uid}-o-${hasil.length}`} role="option" aria-selected={aktif === hasil.length}
                onMouseDown={(e) => { e.preventDefault(); pilihIndeks(hasil.length); }} onMouseEnter={() => setAktif(hasil.length)}
                className={`min-h-[44px] cursor-pointer border-t-2 border-garis px-3 py-2 ${aktif === hasil.length ? "bg-utama text-utama-teks" : ""}`}>
                Tulis sendiri (tidak ada di daftar): <span className="font-bold">{q.trim()}</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
