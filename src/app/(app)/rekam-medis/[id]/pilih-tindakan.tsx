"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { rupiah } from "@/lib/format";
import type { SvcItem } from "@/lib/rekam";

export type MasterTindakan = { id: string; nama: string; tarif: number; kategori: string | null };

export function PilihTindakan({
  master, items, onChange,
}: { master: MasterTindakan[]; items: SvcItem[]; onChange: (x: SvcItem[]) => void }) {
  const [saring, setSaring] = useState("");
  const tampil = master.filter((m) => m.nama.toLowerCase().includes(saring.trim().toLowerCase()));
  const total = items.reduce((a, i) => a + i.tarif * i.jumlah, 0);
  const ada = (id: string) => items.find((i) => i.service_id === id);

  const alih = (m: MasterTindakan) =>
    onChange(ada(m.id) ? items.filter((i) => i.service_id !== m.id) : [...items, { service_id: m.id, nama: m.nama, tarif: m.tarif, jumlah: 1 }]);
  const ubahJumlah = (id: string, d: number) =>
    onChange(items.map((i) => (i.service_id === id ? { ...i, jumlah: Math.min(99, Math.max(1, i.jumlah + d)) } : i)));

  return (
    <div>
      <label htmlFor="saring-tindakan" className="mb-1.5 block font-bold">Tindakan dan pemeriksaan penunjang</label>
      <input
        id="saring-tindakan" value={saring} onChange={(e) => setSaring(e.target.value)} autoComplete="off"
        placeholder="Saring daftar: ketik sebagian nama"
        className="mb-3 min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta placeholder:text-redup focus:border-utama"
      />
      {tampil.length === 0 ? (
        <p className="text-redup">Tidak ada tindakan yang cocok.</p>
      ) : (
        <ul className="divide-y divide-garis rounded-xl border-2 border-garis bg-permukaan">
          {tampil.map((m) => {
            const dipilih = ada(m.id);
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1">
                <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={!!dipilih} onChange={() => alih(m)} className="h-5 w-5 accent-[rgb(var(--utama))]" />
                  <span>{m.nama}</span>
                </label>
                {dipilih ? (
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label={`Kurangi jumlah ${m.nama}`} onClick={() => ubahJumlah(m.id, -1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-garis hover:border-utama"><Minus aria-hidden className="h-4 w-4" /></button>
                    <span aria-live="polite" className="w-8 text-center font-bold">{dipilih.jumlah}</span>
                    <button type="button" aria-label={`Tambah jumlah ${m.nama}`} onClick={() => ubahJumlah(m.id, 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-garis hover:border-utama"><Plus aria-hidden className="h-4 w-4" /></button>
                    <span className="ml-2 w-28 text-right font-bold">{rupiah(dipilih.tarif * dipilih.jumlah)}</span>
                  </span>
                ) : (
                  <span className="text-redup">{rupiah(m.tarif)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-lg font-bold">Total tindakan: {rupiah(total)}</p>
      <p className="text-sm text-redup">Jasa konsultasi dan obat dihitung terpisah di Kasir.</p>
    </div>
  );
}
