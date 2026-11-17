"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan obat"}</Button>;
}

export function FormObat({
  mode, aksi, awal = {},
}: { mode: "baru" | "edit"; aksi: (p: FormState, fd: FormData) => Promise<FormState>; awal?: Record<string, string> }) {
  const [state, kirim] = useFormState<FormState, FormData>(aksi, {});
  const v = { ...awal, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  const [dijual, setDijual] = useState(v.dijual === "1");

  return (
    <form action={kirim} className="space-y-6" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama obat" htmlFor="nama" error={e.nama} hint="Nama generik, tanpa kekuatan. Contoh: Amoksisilin">
          <Input id="nama" name="nama" defaultValue={v.nama} autoComplete="off" autoFocus />
        </Field>
        <Field label="Kekuatan" htmlFor="kekuatan" hint="Contoh: 500 mg, atau 125 mg/5 mL">
          <Input id="kekuatan" name="kekuatan" defaultValue={v.kekuatan} autoComplete="off" />
        </Field>
        <Field label="Sediaan" htmlFor="sediaan" error={e.sediaan} hint="tablet, kapsul, sirup, krim...">
          <Input id="sediaan" name="sediaan" defaultValue={v.sediaan} autoComplete="off" />
        </Field>
        <Field label="Satuan yang diserahkan" htmlFor="satuan" error={e.satuan} hint="tablet, kapsul, botol, tube...">
          <Input id="satuan" name="satuan" defaultValue={v.satuan} autoComplete="off" />
        </Field>
        <Field label="Satuan sekali pakai" htmlFor="satuan_dosis" error={e.satuan_dosis} hint="tablet, kapsul, ml, atau oles (salep/krim)">
          <Input id="satuan_dosis" name="satuan_dosis" defaultValue={v.satuan_dosis} autoComplete="off" />
        </Field>
        <Field label="Kekuatan zat aktif (mg) per satuan sekali pakai" htmlFor="kekuatan_mg" error={e.kekuatan_mg}
          hint="Untuk pemeriksaan dosis. Sirup 120 mg/5 mL = 24 (mg per ml). Kosongkan bila kombinasi.">
          <Input id="kekuatan_mg" name="kekuatan_mg" inputMode="decimal" defaultValue={v.kekuatan_mg} autoComplete="off" />
        </Field>
        <Field label="Zat aktif" htmlFor="zat_aktif" hint="Huruf kecil, pisahkan dengan koma. Dipakai untuk interaksi dan alergi.">
          <Input id="zat_aktif" name="zat_aktif" defaultValue={v.zat_aktif} autoComplete="off" />
        </Field>
        <Field label="Golongan" htmlFor="golongan" hint="Contoh: nsaid, penisilin, statin. Dipakai untuk interaksi.">
          <Input id="golongan" name="golongan" defaultValue={v.golongan} autoComplete="off" />
        </Field>
      </div>

      <fieldset className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <legend className="px-1 font-bold">Penjualan di klinik</legend>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" name="dijual" defaultChecked={v.dijual === "1"} onChange={(ev) => setDijual(ev.target.checked)} className="h-5 w-5 accent-[rgb(var(--utama))]" />
          <span className="font-bold">Obat ini disediakan dan dijual di klinik</span>
        </label>
        {dijual && (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field label="Harga jual per satuan (Rp)" htmlFor="harga_jual" error={e.harga_jual}>
              <Input id="harga_jual" name="harga_jual" inputMode="decimal" defaultValue={v.harga_jual} autoComplete="off" />
            </Field>
            <Field label="Stok minimum" htmlFor="stok_minimum" error={e.stok_minimum} hint="Peringatan muncul bila stok di bawah angka ini.">
              <Input id="stok_minimum" name="stok_minimum" inputMode="numeric" defaultValue={v.stok_minimum} autoComplete="off" />
            </Field>
            <Field label="Tanggal kedaluwarsa" htmlFor="tanggal_expired" error={e.tanggal_expired}>
              <Input id="tanggal_expired" name="tanggal_expired" type="date" defaultValue={v.tanggal_expired} />
            </Field>
            {mode === "baru" ? (
              <Field label="Stok awal" htmlFor="stok_awal" error={e.stok_awal} hint="Setelah ini, stok diubah lewat halaman Stok obat.">
                <Input id="stok_awal" name="stok_awal" inputMode="numeric" defaultValue={v.stok_awal} autoComplete="off" />
              </Field>
            ) : (
              <p className="self-end text-redup">Stok diubah lewat halaman Stok obat agar tercatat riwayatnya.</p>
            )}
          </div>
        )}
      </fieldset>

      {mode === "edit" && (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" name="aktif" defaultChecked={v.aktif !== ""} className="h-5 w-5 accent-[rgb(var(--utama))]" />
          <span>Obat masih dipakai (hilangkan centang untuk menyembunyikan dari pencarian)</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Kirim />
        <Link href="/obat/daftar" className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Batal</Link>
      </div>
    </form>
  );
}
