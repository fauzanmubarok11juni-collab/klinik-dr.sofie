"use client";

import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/card";
import { cekPeringatan } from "@/app/(app)/obat/actions";
import { keItemCek, type ItemCek, type ItemObat, type Peringatan } from "@/lib/obat";

const JUDUL: Record<Peringatan["jenis"], string> = {
  alergi: "Alergi", interaksi: "Interaksi obat", dosis: "Dosis", lansia: "Lansia", duplikat: "Duplikasi", stok: "Stok", info: "Catatan",
};

/** Peringatan alergi, interaksi, dosis, lansia, dan stok. Hanya mengingatkan, tidak pernah memblokir penyimpanan. */
export function PeringatanObat({
  encounterId, resep, jual, onJumlah,
}: { encounterId: string; resep: ItemObat[]; jual: ItemObat[]; onJumlah?: (n: number) => void }) {
  const [daftar, setDaftar] = useState<Peringatan[]>([]);
  const urutan = useRef(0);
  const kunci = JSON.stringify([...resep.map((i) => keItemCek(i, "resep")), ...jual.map((i) => keItemCek(i, "jual"))]);

  useEffect(() => {
    const items = JSON.parse(kunci) as ItemCek[];
    if (items.length === 0) { setDaftar([]); return; }
    const t = setTimeout(async () => {
      const saya = ++urutan.current;
      try {
        const r = await cekPeringatan(encounterId, items);
        if (saya === urutan.current) setDaftar(r);
      } catch { /* abaikan: peringatan tidak boleh mengganggu pekerjaan */ }
    }, 700);
    return () => clearTimeout(t);
  }, [kunci, encounterId]);

  useEffect(() => { onJumlah?.(daftar.length); }, [daftar.length, onJumlah]);

  if (daftar.length === 0) return <div aria-live="polite" className="sr-only">Tidak ada peringatan obat.</div>;
  return (
    <div aria-live="polite" className="space-y-2">
      <h2 className="font-bold">Peringatan obat ({daftar.length})</h2>
      {daftar.map((p, i) => (
        <Banner key={i} jenis={p.merah ? "bahaya" : "peringatan"}>
          <span className="font-bold">{JUDUL[p.jenis]}: </span>{p.pesan}
        </Banner>
      ))}
      <p className="text-sm text-redup">Peringatan hanya panduan ringkas, bukan pengganti penilaian dokter. Obat yang ditulis manual tidak ikut diperiksa.</p>
    </div>
  );
}
