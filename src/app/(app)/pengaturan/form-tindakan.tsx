"use client";

import { useFormState, useFormStatus } from "react-dom";
import { simpanTindakan } from "./actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Input } from "@/components/ui/field";

export type Tindakan = { id: string; nama: string; kategori: string | null; tarif: number; aktif: boolean };

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan tarif tindakan"}</Button>;
}

export function FormTindakan({ daftar }: { daftar: Tindakan[] }) {
  const [state, kirim] = useFormState<FormState, FormData>(simpanTindakan, {});
  const e = state.errors ?? {};
  return (
    <form action={kirim} className="space-y-5" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      <p className="text-redup">Tarif baru berlaku untuk kunjungan berikutnya. Tagihan yang sudah dibuat tidak berubah. Tindakan yang tidak dipakai lagi cukup dinonaktifkan.</p>
      <ul className="divide-y divide-garis rounded-xl border-2 border-garis bg-permukaan">
        {daftar.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <label htmlFor={`aktif_${s.id}`} className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3">
              <input id={`aktif_${s.id}`} type="checkbox" name={`aktif_${s.id}`} defaultChecked={s.aktif} className="h-5 w-5 accent-[rgb(var(--utama))]" />
              <span><span className="font-bold">{s.nama}</span>{s.kategori ? <span className="text-sm text-redup"> ({s.kategori})</span> : null}</span>
            </label>
            <div className="w-40">
              <label htmlFor={`tarif_${s.id}`} className="sr-only">Tarif {s.nama} (Rp)</label>
              <Input id={`tarif_${s.id}`} name={`tarif_${s.id}`} inputMode="numeric" defaultValue={String(Math.round(Number(s.tarif)))} aria-invalid={!!e[`tarif_${s.id}`]} />
            </div>
          </li>
        ))}
      </ul>
      <fieldset className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <legend className="px-1 font-bold">Tambah tindakan baru (opsional)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="baru_nama" className="mb-1 block text-sm font-bold">Nama</label><Input id="baru_nama" name="baru_nama" autoComplete="off" /></div>
          <div><label htmlFor="baru_kategori" className="mb-1 block text-sm font-bold">Kategori</label><Input id="baru_kategori" name="baru_kategori" autoComplete="off" /></div>
          <div><label htmlFor="baru_tarif" className="mb-1 block text-sm font-bold">Tarif (Rp)</label><Input id="baru_tarif" name="baru_tarif" inputMode="numeric" autoComplete="off" /></div>
        </div>
      </fieldset>
      <Kirim />
    </form>
  );
}
