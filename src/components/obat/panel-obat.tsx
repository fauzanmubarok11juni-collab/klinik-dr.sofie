"use client";

import { useState } from "react";
import type { ItemObat, ResepState } from "@/lib/obat";
import { PanelJual } from "./panel-jual";
import { PanelResep } from "./panel-resep";
import { PeringatanObat } from "./peringatan-obat";

/** Isi tab "Obat" pada layar pemeriksaan: peringatan + resep ke apotek luar + penjualan di klinik. */
export function PanelObat({
  encounterId, resep, onResep, jualAwal, resepTerakhir, onJumlahPeringatan,
}: {
  encounterId: string; resep: ResepState; onResep: (r: ResepState) => void;
  jualAwal: ItemObat[]; resepTerakhir: ItemObat[] | null; onJumlahPeringatan?: (n: number) => void;
}) {
  const [jual, setJual] = useState<ItemObat[]>(jualAwal);
  return (
    <div className="space-y-8">
      <PeringatanObat encounterId={encounterId} resep={resep.items} jual={jual} onJumlah={onJumlahPeringatan} />
      <PanelResep encounterId={encounterId} resep={resep} onChange={onResep} resepTerakhir={resepTerakhir} />
      <hr className="border-garis" />
      <PanelJual encounterId={encounterId} awal={jualAwal} onItems={setJual} />
    </div>
  );
}
