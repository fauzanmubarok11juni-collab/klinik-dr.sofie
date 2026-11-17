"use client";

import { useFormState, useFormStatus } from "react-dom";
import { masuk, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function TombolMasuk() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" ukuran="besar" className="w-full" disabled={pending}>
      {pending ? "Sedang masuk…" : "Masuk"}
    </Button>
  );
}

export function FormMasuk() {
  const [state, aksi] = useFormState<LoginState, FormData>(masuk, {});
  return (
    <form action={aksi} className="space-y-5" noValidate>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" autoFocus required />
      </Field>
      <Field label="Kata sandi" htmlFor="password" error={state.error}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <TombolMasuk />
    </form>
  );
}
