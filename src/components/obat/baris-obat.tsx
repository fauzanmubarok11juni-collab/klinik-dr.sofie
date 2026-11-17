"use client";

import { Trash2 } from "lucide-react";
import { ATURAN, aturanTeks, bulanTahun, cariAturan, hitungJumlah, type ItemObat } from "@/lib/obat";
import { rupiah } from "@/lib/format";

const kotak = "min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama";

/** Satu obat: berapa per minum, aturan pakai (bahasa awam), lama, jumlah. Jumlah dihitung otomatis bila memungkinkan. */
export function BarisObat({
  item, mode, onUbah, onHapus, tanda,
}: {
  item: ItemObat;
  mode: "resep" | "jual";
  onUbah: (i: ItemObat) => void;
  onHapus: () => void;
  tanda?: string | null;
}) {
  const a = cariAturan(item.aturan_kode);

  function ubah(p: Partial<ItemObat>) {
    const baru = { ...item, ...p };
    if (!baru.jumlah_manual && !("jumlah" in p)) {
      const j = hitungJumlah(baru);
      if (j !== null) baru.jumlah = String(j);
    }
    onUbah(baru);
  }
  const id = (k: string) => `${item.uid}-${k}`;

  return (
    <li className="rounded-xl border-2 border-garis bg-permukaan p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{item.nama} {item.sediaan}</p>
          {item.medicine_id === null && <p className="text-sm text-redup">Obat di luar daftar (tidak ikut pemeriksaan interaksi)</p>}
          {mode === "jual" && item.harga_satuan !== undefined && (
            <p className="text-sm text-redup">
              {rupiah(item.harga_satuan)} per {item.satuan}, stok {item.stok ?? 0}
              {item.expired ? `, kedaluwarsa ${bulanTahun(item.expired)}` : ""}
              {" · "}subtotal <span className="font-bold text-tinta">{rupiah(item.harga_satuan * (Number(item.jumlah) || 0))}</span>
            </p>
          )}
          {tanda && <p className="text-sm font-bold text-bahaya">{tanda}</p>}
        </div>
        <button type="button" onClick={onHapus} aria-label={`Hapus ${item.nama}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-garis/60">
          <Trash2 aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr_6rem_8rem]">
        {a?.topikal ? <div className="hidden sm:block" /> : (
          <div>
            <label htmlFor={id("per")} className="mb-1 block text-sm font-bold">Per minum</label>
            <div className="flex items-center gap-1.5">
              <input id={id("per")} inputMode="decimal" autoComplete="off" value={item.per_pakai} onChange={(e) => ubah({ per_pakai: e.target.value })} className={kotak} />
              <span className="text-sm text-redup">{item.satuan_dosis}</span>
            </div>
          </div>
        )}
        <div>
          <label htmlFor={id("atur")} className="mb-1 block text-sm font-bold">Aturan pakai</label>
          <select id={id("atur")} value={item.aturan_kode} onChange={(e) => ubah({ aturan_kode: e.target.value })} className={kotak}>
            {ATURAN.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={id("hari")} className="mb-1 block text-sm font-bold">Lama (hari)</label>
          <input id={id("hari")} inputMode="numeric" autoComplete="off" value={item.lama_hari} onChange={(e) => ubah({ lama_hari: e.target.value })} className={kotak} />
        </div>
        <div>
          <label htmlFor={id("jml")} className="mb-1 block text-sm font-bold">Jumlah ({item.satuan})</label>
          <input id={id("jml")} inputMode="numeric" autoComplete="off" value={item.jumlah}
            onChange={(e) => ubah({ jumlah: e.target.value, jumlah_manual: true })} className={kotak} />
        </div>
      </div>

      {a?.kode === "lain" && (
        <div className="mt-3">
          <label htmlFor={id("bebas")} className="mb-1 block text-sm font-bold">Tulis aturan pakai</label>
          <input id={id("bebas")} autoComplete="off" value={item.aturan_bebas} onChange={(e) => ubah({ aturan_bebas: e.target.value })} className={kotak} />
        </div>
      )}
      {item.medicine_id === null && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("sed")} className="mb-1 block text-sm font-bold">Sediaan</label>
            <input id={id("sed")} autoComplete="off" value={item.sediaan} onChange={(e) => ubah({ sediaan: e.target.value })} className={kotak} placeholder="tablet, sirup..." />
          </div>
          <div>
            <label htmlFor={id("sat")} className="mb-1 block text-sm font-bold">Satuan</label>
            <input id={id("sat")} autoComplete="off" value={item.satuan}
              onChange={(e) => ubah({ satuan: e.target.value, satuan_dosis: e.target.value })} className={kotak} placeholder="tablet, botol..." />
          </div>
        </div>
      )}
      <p className="mt-2 text-sm text-redup">
        Tertulis di resep/label: <span className="font-bold text-tinta">{aturanTeks(item) || "—"}</span>
        {item.lama_hari ? `, selama ${item.lama_hari} hari` : ""}
        {!item.jumlah_manual && hitungJumlah(item) !== null ? " (jumlah dihitung otomatis)" : ""}
      </p>
    </li>
  );
}
