"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";

export type Bidang = { nama: string; label: string; tipe?: "teks" | "angka" | "area"; hint?: string };

function Kirim({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : label}</Button>;
}

/** Formulir pengaturan sederhana: daftar kolom + satu tombol simpan. */
export function FormPengaturan({
  aksi, bidang, awal, tombol = "Simpan",
}: { aksi: (p: FormState, fd: FormData) => Promise<FormState>; bidang: Bidang[]; awal: Record<string, string>; tombol?: string }) {
  const [state, kirim] = useFormState<FormState, FormData>(aksi, {});
  const v = { ...awal, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  return (
    <form action={kirim} className="max-w-2xl space-y-5" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      {bidang.map((b) => (
        <Field key={b.nama} label={b.label} htmlFor={b.nama} hint={b.hint} error={e[b.nama]}>
          {b.tipe === "area"
            ? <Textarea id={b.nama} name={b.nama} rows={6} defaultValue={v[b.nama]} />
            : <Input id={b.nama} name={b.nama} inputMode={b.tipe === "angka" ? "numeric" : undefined} defaultValue={v[b.nama]} autoComplete="off" />}
        </Field>
      ))}
      <Kirim label={tombol} />
    </form>
  );
}
