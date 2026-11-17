"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

function Kirim({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : label}</Button>;
}

/** mode "reset": ganti kata sandi Asisten. mode "buat": buat akun Asisten baru. Butuh SUPABASE_SERVICE_ROLE_KEY. */
export function FormSandi({ mode, aksi }: { mode: "reset" | "buat"; aksi: (p: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, kirim] = useFormState<FormState, FormData>(aksi, {});
  const e = state.errors ?? {};
  return (
    <form action={kirim} className="space-y-3" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      {mode === "buat" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama Asisten" htmlFor="nama-baru" error={e.nama}><Input id="nama-baru" name="nama" defaultValue={state.values?.nama} autoComplete="off" /></Field>
          <Field label="Email" htmlFor="email-baru" error={e.email}><Input id="email-baru" name="email" type="email" defaultValue={state.values?.email} autoComplete="off" /></Field>
        </div>
      )}
      <Field label={mode === "reset" ? "Kata sandi baru (minimal 8 karakter)" : "Kata sandi awal (minimal 8 karakter)"} htmlFor={`sandi-${mode}`} error={e.sandi}>
        <Input id={`sandi-${mode}`} name="sandi" type="password" autoComplete="new-password" />
      </Field>
      <Kirim label={mode === "reset" ? "Ganti kata sandi" : "Buat akun Asisten"} />
    </form>
  );
}
