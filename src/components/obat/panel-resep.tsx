"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { barisBaru, barisBebas, uidBaru, type ItemObat, type ResepState } from "@/lib/obat";
import { BarisObat } from "./baris-obat";
import { PilihObat } from "./pilih-obat";

/** Resep untuk ditebus di apotek luar. Tersimpan otomatis bersama rekam medis. */
export function PanelResep({
  encounterId, resep, onChange, resepTerakhir,
}: { encounterId: string; resep: ResepState; onChange: (r: ResepState) => void; resepTerakhir: ItemObat[] | null }) {
  const tambah = (b: ItemObat) => {
    if (b.medicine_id && resep.items.some((x) => x.medicine_id === b.medicine_id)) return;
    onChange({ ...resep, items: [...resep.items, b] });
  };
  const salin = () => {
    if (!resepTerakhir) return;
    if (resep.items.length && !window.confirm("Resep yang sekarang akan diganti dengan resep kunjungan terakhir. Lanjutkan?")) return;
    onChange({ ...resep, items: resepTerakhir.map((i) => ({ ...i, uid: uidBaru() })) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Resep ke apotek luar</h2>
        <div className="flex flex-wrap gap-2">
          {resepTerakhir && <Button variant="sekunder" onClick={salin}>Salin resep kunjungan terakhir</Button>}
          <a href={`/obat/resep/${encounterId}`} target="_blank" rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-garis bg-permukaan px-4 font-bold hover:border-utama">
            <Printer aria-hidden className="h-5 w-5" /> Cetak resep
          </a>
        </div>
      </div>

      <PilihObat
        hanyaDijual={false} label="Tambah obat ke resep" placeholder="Ketik nama obat, mis. amoksisilin"
        onPilih={(m) => tambah(barisBaru(m))} onTulisSendiri={(n) => tambah(barisBebas(n))}
      />

      {resep.items.length === 0 ? (
        <p className="text-redup">Belum ada obat pada resep.</p>
      ) : (
        <ul className="space-y-3">
          {resep.items.map((it) => (
            <BarisObat key={it.uid} item={it} mode="resep"
              onUbah={(b) => onChange({ ...resep, items: resep.items.map((x) => (x.uid === it.uid ? b : x)) })}
              onHapus={() => onChange({ ...resep, items: resep.items.filter((x) => x.uid !== it.uid) })} />
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="catatan-resep" className="mb-1.5 block font-bold">Catatan pada resep (opsional)</label>
        <Textarea id="catatan-resep" rows={2} value={resep.catatan} onChange={(e) => onChange({ ...resep, catatan: e.target.value })} />
      </div>
    </div>
  );
}
