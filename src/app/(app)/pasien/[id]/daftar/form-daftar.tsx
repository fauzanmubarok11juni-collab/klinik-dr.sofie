"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, PilihanRadio, Textarea } from "@/components/ui/field";

function Kirim({ children, name, value, variant = "utama" }: { children: React.ReactNode; name?: string; value?: string; variant?: "utama" | "sekunder" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name={name} value={value} variant={variant} ukuran="besar" disabled={pending}>
      {pending ? "Mendaftarkan…" : children}
    </Button>
  );
}

export function FormDaftar({
  aksi, sesiDefault, penjaminDefault, batalHref,
}: {
  aksi: (prev: FormState, fd: FormData) => Promise<FormState>;
  sesiDefault: "pagi" | "malam";
  penjaminDefault: string;
  batalHref: string;
}) {
  const [state, kirim] = useFormState<FormState, FormData>(aksi, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={kirim} className="max-w-2xl space-y-6" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && (
        <Banner jenis="peringatan">
          <p className="font-bold">{state.konfirmasi}</p>
          <p>Jika memang datang lagi (mis. kontrol kedua), tekan “Tetap daftarkan lagi”.</p>
        </Banner>
      )}

      <PilihanRadio
        legend="Sesi" name="sesi" defaultValue={v.sesi || sesiDefault} error={e.sesi}
        pilihan={[{ nilai: "pagi", label: "Pagi" }, { nilai: "malam", label: "Malam" }]}
      />
      <Field label="Keluhan utama" htmlFor="keluhan" hint="Cukup satu kalimat singkat. Boleh dikosongkan.">
        <Textarea id="keluhan" name="keluhan" rows={2} defaultValue={v.keluhan} autoFocus />
      </Field>
      <PilihanRadio
        legend="Penjamin" name="penjamin" defaultValue={v.penjamin || penjaminDefault} error={e.penjamin}
        pilihan={[{ nilai: "umum", label: "Umum" }, { nilai: "asuransi", label: "Asuransi" }]}
      />

      <div className="flex flex-wrap items-center gap-3">
        {state.konfirmasi ? (
          <Kirim name="paksa" value="1">Tetap daftarkan lagi</Kirim>
        ) : (
          <Kirim>Daftarkan</Kirim>
        )}
        <Link href={batalHref} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Batal</Link>
      </div>
    </form>
  );
}
