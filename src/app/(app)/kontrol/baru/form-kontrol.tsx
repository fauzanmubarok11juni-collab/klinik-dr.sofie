"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { simpanKontrol } from "../actions";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, PilihanRadio } from "@/components/ui/field";
import { formatTanggal } from "@/lib/format";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan jadwal kontrol"}</Button>;
}

const PRESET = [{ l: "1 minggu", h: 7 }, { l: "2 minggu", h: 14 }, { l: "1 bulan", h: 30 }, { l: "2 bulan", h: 60 }, { l: "3 bulan", h: 90 }];

function tambahHari(iso: string, h: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + h);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // Minggu libur -> Senin
  return d.toISOString().slice(0, 10);
}

export function FormKontrol({
  pasienId, kunjunganId, sesiDefault, hariIni, batalHref,
}: { pasienId: string; kunjunganId: string; sesiDefault: "pagi" | "malam"; hariIni: string; batalHref: string }) {
  const [state, aksi] = useFormState<FormState, FormData>(simpanKontrol, {});
  const [tgl, setTgl] = useState(state.values?.tanggal ?? "");
  const e = state.errors ?? {};
  const minggu = tgl && new Date(tgl + "T00:00:00Z").getUTCDay() === 0;

  return (
    <form action={aksi} className="max-w-2xl space-y-6" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      <input type="hidden" name="patient_id" value={pasienId} />
      <input type="hidden" name="encounter_id" value={kunjunganId} />

      <div>
        <p className="mb-2 font-bold">Kontrol lagi dalam</p>
        <div className="flex flex-wrap gap-2">
          {PRESET.map((p) => (
            <Button key={p.h} type="button" variant={tgl === tambahHari(hariIni, p.h) ? "utama" : "sekunder"} onClick={() => setTgl(tambahHari(hariIni, p.h))}>{p.l}</Button>
          ))}
        </div>
      </div>

      <Field label="Tanggal kontrol" htmlFor="tanggal" error={e.tanggal}
        hint={tgl ? (minggu ? "Hari Minggu libur. Pilih tanggal lain." : formatTanggal(tgl, true)) : "Pilih salah satu tombol di atas, atau ketik tanggal."}>
        <Input id="tanggal" name="tanggal" type="date" min={hariIni} value={tgl} onChange={(ev) => setTgl(ev.target.value)} />
      </Field>

      <PilihanRadio legend="Sesi" name="sesi" defaultValue={state.values?.sesi || sesiDefault} error={e.sesi}
        pilihan={[{ nilai: "pagi", label: "Pagi (06.00–08.00)" }, { nilai: "malam", label: "Malam (18.00–22.00)" }]} />

      <Field label="Catatan (opsional)" htmlFor="catatan" hint="Contoh: puasa 8 jam sebelum periksa, bawa hasil lab.">
        <Input id="catatan" name="catatan" defaultValue={state.values?.catatan} autoComplete="off" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Kirim />
        <Link href={batalHref} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Batal</Link>
      </div>
    </form>
  );
}
