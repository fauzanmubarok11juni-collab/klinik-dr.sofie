"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { tambahObatLuar } from "../../actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PilihObat } from "@/components/obat/pilih-obat";
import { namaObat } from "@/lib/obat";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Tambahkan"}</Button>;
}

export function FormObatLuar({ pasienId }: { pasienId: string }) {
  const [state, aksi] = useFormState<FormState, FormData>(tambahObatLuar.bind(null, pasienId), {});
  const [pilih, setPilih] = useState<{ id: string | null; nama: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.konfirmasi) { form.current?.reset(); setPilih(null); } }, [state]);

  return (
    <form ref={form} action={aksi} className="space-y-4 rounded-xl border-2 border-garis bg-permukaan p-5" noValidate>
      <h2 className="text-lg font-bold">Tambah obat dari luar klinik</h2>
      <p className="text-redup">Obat yang dibawa pasien atau diresepkan tempat lain. Pilih dari daftar agar ikut diperiksa interaksinya; obat yang diketik manual tidak ikut diperiksa.</p>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      {pilih ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-utama p-3">
          <span className="font-bold">{pilih.nama}{pilih.id ? "" : " (ditulis manual)"}</span>
          <Button type="button" variant="sekunder" onClick={() => setPilih(null)}>Ganti obat</Button>
        </div>
      ) : (
        <PilihObat hanyaDijual={false} label="Nama obat" placeholder="Ketik nama obat"
          onPilih={(m) => setPilih({ id: m.id, nama: namaObat(m) })} onTulisSendiri={(n) => setPilih({ id: null, nama: n })} />
      )}
      <input type="hidden" name="nama" value={pilih?.nama ?? ""} />
      <input type="hidden" name="medicine_id" value={pilih?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aturan pakai" htmlFor="aturan" hint="Contoh: 1 tablet pagi hari"><Input id="aturan" name="aturan" autoComplete="off" /></Field>
        <Field label="Asal obat" htmlFor="sumber" hint="Contoh: RS X, apotek, dibeli sendiri"><Input id="sumber" name="sumber" autoComplete="off" /></Field>
      </div>
      <Kirim />
    </form>
  );
}
