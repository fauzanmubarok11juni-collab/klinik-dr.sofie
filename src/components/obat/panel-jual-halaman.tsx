"use client";

import { useState } from "react";
import type { ItemObat } from "@/lib/obat";
import { PanelJual } from "./panel-jual";
import { PeringatanObat } from "./peringatan-obat";

export function PanelJualHalaman({ encounterId, awal, resepTetap }: { encounterId: string; awal: ItemObat[]; resepTetap: ItemObat[] }) {
  const [jual, setJual] = useState(awal);
  return (
    <div className="space-y-6">
      <PeringatanObat encounterId={encounterId} resep={resepTetap} jual={jual} />
      <PanelJual encounterId={encounterId} awal={awal} onItems={setJual} />
    </div>
  );
}
