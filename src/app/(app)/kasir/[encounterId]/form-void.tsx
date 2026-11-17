"use client";

import { useFormState, useFormStatus } from "react-dom";
import { voidTagihan, type KasirState } from "../actions";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="bahaya" disabled={pending}>{pending ? "Membatalkan…" : "Batalkan tagihan ini"}</Button>;
}

export function FormVoid({ encounterId, invoiceId }: { encounterId: string; invoiceId: string }) {
  const [state, aksi] = useFormState<KasirState, FormData>(voidTagihan.bind(null, encounterId, invoiceId), {});
  return (
    <details className="rounded-xl border-2 border-garis bg-permukaan p-4">
      <summary className="min-h-[44px] cursor-pointer font-bold leading-[44px]">Batalkan tagihan (void)</summary>
      <form action={aksi} className="mt-3 space-y-4" noValidate>
        <p className="text-redup">Tagihan ditandai Batal dan tercatat di audit; data tidak dihapus. Setelah itu tagihan baru dapat dibuat untuk kunjungan ini. Stok obat yang sudah diserahkan tidak dikembalikan otomatis.</p>
        {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
        <Field label="Alasan pembatalan (wajib)" htmlFor="alasan"><Input id="alasan" name="alasan" autoComplete="off" /></Field>
        <Kirim />
      </form>
    </details>
  );
}
