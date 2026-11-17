"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { MAKS_DIAGNOSIS, type DxItem } from "@/lib/rekam";
import { cariDiagnosis } from "../actions";

type Hasil = { kode: string; nama: string };

/**
 * Pencarian diagnosis ICD-10 dengan saran otomatis. Dipakai penuh dengan keyboard:
 * ketik -> panah bawah/atas -> Enter untuk memilih, Esc menutup.
 * Kotak kosong menampilkan diagnosis yang paling sering dipakai.
 */
export function PilihDiagnosis({ items, onChange }: { items: DxItem[]; onChange: (x: DxItem[]) => void }) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [memuat, setMemuat] = useState(false);
  const urutan = useRef(0);
  const penuh = items.length >= MAKS_DIAGNOSIS;

  useEffect(() => {
    if (!buka) return;
    const t = setTimeout(async () => {
      const saya = ++urutan.current;
      setMemuat(true);
      try {
        const r = await cariDiagnosis(q);
        if (saya === urutan.current) { setHasil(r); setAktif(0); }
      } finally {
        if (saya === urutan.current) setMemuat(false);
      }
    }, q ? 200 : 0);
    return () => clearTimeout(t);
  }, [q, buka]);

  function pilih(h: Hasil) {
    if (penuh || items.some((i) => i.kode === h.kode)) { setQ(""); setBuka(false); return; }
    onChange([...items, { kode: h.kode, nama: h.nama, utama: items.length === 0 }]);
    setQ(""); setBuka(false);
  }

  function hapus(kode: string) {
    const sisa = items.filter((i) => i.kode !== kode);
    if (sisa.length && !sisa.some((i) => i.utama)) sisa[0] = { ...sisa[0], utama: true };
    onChange(sisa);
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setBuka(true); setAktif((a) => Math.min(a + 1, Math.max(hasil.length - 1, 0))); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
    else if (ev.key === "Enter") { if (buka && hasil[aktif]) { ev.preventDefault(); pilih(hasil[aktif]); } }
    else if (ev.key === "Escape") { setBuka(false); }
  }

  const idList = `${uid}-daftar`;
  return (
    <div>
      <label htmlFor={`${uid}-cari`} className="mb-1.5 block font-bold">Cari diagnosis (ketik kode atau nama)</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-redup" />
        <input
          id={`${uid}-cari`} role="combobox" aria-expanded={buka} aria-controls={idList} aria-autocomplete="list"
          aria-activedescendant={buka && hasil[aktif] ? `${uid}-o-${aktif}` : undefined}
          value={q} autoComplete="off" disabled={penuh}
          onChange={(e) => { setQ(e.target.value); setBuka(true); }}
          onFocus={() => setBuka(true)}
          onBlur={() => setBuka(false)}
          onKeyDown={onKeyDown}
          placeholder={penuh ? `Maksimum ${MAKS_DIAGNOSIS} diagnosis` : "Contoh: hipertensi, I10, ispa"}
          className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan pl-10 pr-3 text-base text-tinta placeholder:text-redup focus:border-utama"
        />
        {buka && (
          <ul
            id={idList} role="listbox" aria-label="Saran diagnosis"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border-2 border-utama bg-permukaan shadow-lg"
          >
            {memuat && hasil.length === 0 && <li className="px-3 py-2 text-redup">Mencari…</li>}
            {!memuat && hasil.length === 0 && <li className="px-3 py-2 text-redup">{q ? "Tidak ada yang cocok." : "Mulai mengetik untuk mencari."}</li>}
            {!q && hasil.length > 0 && <li aria-hidden className="px-3 pt-2 text-sm font-bold text-redup">Sering dipakai</li>}
            {hasil.map((h, i) => {
              const dipilih = items.some((x) => x.kode === h.kode);
              return (
                <li
                  key={h.kode} id={`${uid}-o-${i}`} role="option" aria-selected={i === aktif}
                  onMouseDown={(e) => { e.preventDefault(); pilih(h); }}
                  onMouseEnter={() => setAktif(i)}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 ${i === aktif ? "bg-utama text-utama-teks" : ""} ${dipilih ? "opacity-50" : ""}`}
                >
                  <span className="w-14 shrink-0 font-bold">{h.kode}</span>
                  <span>{h.nama}{dipilih ? " (sudah dipilih)" : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 font-bold">Diagnosis kunjungan ini</legend>
        {items.length === 0 ? (
          <p className="text-redup">Belum ada diagnosis. Diagnosis pertama otomatis menjadi diagnosis utama.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((d) => (
              <li key={d.kode} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-garis bg-permukaan p-2 pl-3">
                <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="radio" name={`${uid}-utama`} checked={d.utama}
                    onChange={() => onChange(items.map((x) => ({ ...x, utama: x.kode === d.kode })))}
                    className="h-5 w-5 accent-[rgb(var(--utama))]"
                  />
                  <span>
                    <span className="font-bold">{d.kode}</span> {d.nama}
                    {d.utama && <span className="ml-2 rounded-full border-2 border-utama px-2 py-0.5 text-sm font-bold text-utama">Utama</span>}
                  </span>
                </label>
                <button
                  type="button" onClick={() => hapus(d.kode)} aria-label={`Hapus diagnosis ${d.nama}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-garis/60"
                >
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}
