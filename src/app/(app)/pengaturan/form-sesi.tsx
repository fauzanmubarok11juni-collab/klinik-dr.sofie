"use client";

import { useFormState, useFormStatus } from "react-dom";
import { simpanSesi } from "./actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan jadwal sesi"}</Button>;
}

export type SesiAwal = { kode: "pagi" | "malam"; nama: string; mulai: string; selesai: string; aktif: boolean };

export function FormSesi({ sesi }: { sesi: SesiAwal[] }) {
  const [state, kirim] = useFormState<FormState, FormData>(simpanSesi, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={kirim} className="max-w-2xl space-y-5" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      <p className="text-redup">Praktik berlangsung Senin sampai Sabtu. Hari Minggu libur (pemeliharaan dan backup).</p>
      {sesi.map((s) => (
        <fieldset key={s.kode} className="rounded-xl border-2 border-garis bg-permukaan p-4">
          <legend className="px-1 text-lg font-bold">{s.nama}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jam mulai" htmlFor={`mulai_${s.kode}`} error={e[`mulai_${s.kode}`]}>
              <Input id={`mulai_${s.kode}`} name={`mulai_${s.kode}`} type="time" defaultValue={v[`mulai_${s.kode}`] ?? s.mulai} />
            </Field>
            <Field label="Jam selesai" htmlFor={`selesai_${s.kode}`} error={e[`selesai_${s.kode}`]}>
              <Input id={`selesai_${s.kode}`} name={`selesai_${s.kode}`} type="time" defaultValue={v[`selesai_${s.kode}`] ?? s.selesai} />
            </Field>
          </div>
          <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3">
            <input type="checkbox" name={`aktif_${s.kode}`} defaultChecked={state.values ? v[`aktif_${s.kode}`] === "1" : s.aktif} className="h-5 w-5 accent-[rgb(var(--utama))]" />
            <span>Sesi ini dipakai</span>
          </label>
        </fieldset>
      ))}
      <Kirim />
    </form>
  );
}
