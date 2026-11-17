"use client";

import { useFormState, useFormStatus } from "react-dom";
import { simpanPertumbuhan } from "../actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, PilihanRadio, Textarea } from "@/components/ui/field";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan pengukuran"}</Button>;
}

export function FormPertumbuhan({
  pasienId, awal, hariIni, bawahDuaTahun, adaHariIni, dariVital,
}: { pasienId: string; awal: Record<string, string>; hariIni: string; bawahDuaTahun: boolean; adaHariIni: boolean; dariVital: boolean }) {
  const [state, aksi] = useFormState<FormState, FormData>(simpanPertumbuhan.bind(null, pasienId), {});
  const v = { ...awal, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  return (
    <form action={aksi} className="space-y-5 rounded-xl border-2 border-garis bg-permukaan p-5" noValidate>
      <h2 className="text-lg font-bold">Catat pengukuran</h2>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {adaHariIni && <Banner jenis="peringatan">Sudah ada pengukuran tanggal ini. Menyimpan akan menggantinya.</Banner>}
      {dariVital && <Banner>Berat dan tinggi badan diambil dari tanda vital kunjungan hari ini. Periksa lagi sebelum menyimpan.</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal pengukuran" htmlFor="tanggal" error={e.tanggal}><Input id="tanggal" name="tanggal" type="date" max={hariIni} defaultValue={v.tanggal} /></Field>
        <Field label="Berat badan (kg)" htmlFor="bb" error={e.bb}><Input id="bb" name="bb" inputMode="decimal" defaultValue={v.bb} autoComplete="off" autoFocus /></Field>
        <Field label="Panjang/tinggi badan (cm)" htmlFor="tb" error={e.tb}><Input id="tb" name="tb" inputMode="decimal" defaultValue={v.tb} autoComplete="off" /></Field>
        <Field label="Lingkar kepala (cm)" htmlFor="lk" error={e.lk} hint="Dipakai untuk anak sampai 5 tahun."><Input id="lk" name="lk" inputMode="decimal" defaultValue={v.lk} autoComplete="off" /></Field>
      </div>
      <PilihanRadio legend="Cara mengukur panjang/tinggi" name="cara_ukur" defaultValue={v.cara_ukur || (bawahDuaTahun ? "berbaring" : "berdiri")} error={e.cara_ukur}
        pilihan={[{ nilai: "berbaring", label: "Berbaring (panjang)" }, { nilai: "berdiri", label: "Berdiri (tinggi)" }]} />
      <p className="text-sm text-redup">Standar WHO: di bawah 24 bulan diukur berbaring, 24 bulan ke atas berdiri. Bila caranya berbeda, nilai dikoreksi 0,7 cm secara otomatis.</p>
      <Field label="Pesan untuk orang tua (dicetak pada ringkasan)" htmlFor="pesan_orang_tua" hint="Opsional. Contoh: lanjutkan ASI/MPASI, kontrol berat badan bulan depan.">
        <Textarea id="pesan_orang_tua" name="pesan_orang_tua" rows={2} defaultValue={v.pesan} />
      </Field>
      <Kirim />
    </form>
  );
}
