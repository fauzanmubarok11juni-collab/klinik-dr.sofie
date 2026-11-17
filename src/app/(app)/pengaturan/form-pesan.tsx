"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { simpanPesan } from "./actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { DAFTAR_PENANDA, susunPesan } from "@/lib/pengingat";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan pesan"}</Button>;
}

export function FormPesan({ awal, klinik }: { awal: string; klinik: { nama: string; alamat: string; telepon: string } }) {
  const [state, kirim] = useFormState<FormState, FormData>(simpanPesan, {});
  const [teks, setTeks] = useState(awal);
  const contoh = susunPesan(teks, {
    nama: "Budi Santoso", anak: false, tanggal: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), sesi: "pagi",
    jamSesi: "06.00–08.00", catatan: "Puasa 8 jam sebelum periksa.", klinik: klinik.nama, alamat: klinik.alamat, telepon: klinik.telepon,
  });
  return (
    <form action={kirim} className="max-w-2xl space-y-5" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      <div>
        <label htmlFor="templat_pengingat" className="mb-1.5 block font-bold">Isi pesan pengingat kontrol</label>
        <Textarea id="templat_pengingat" name="templat_pengingat" rows={7} value={teks} onChange={(e) => setTeks(e.target.value)} />
        <p className="mt-1 text-sm text-redup">Penanda yang bisa dipakai: {DAFTAR_PENANDA.map((p) => `{${p}}`).join(" ")}. Baris yang isinya kosong (mis. alamat belum diisi) otomatis tidak ditampilkan.</p>
      </div>
      <div>
        <p className="mb-1.5 font-bold">Contoh hasil</p>
        <pre className="whitespace-pre-wrap rounded-lg border-2 border-garis bg-kertas p-3 font-sans text-base">{contoh}</pre>
      </div>
      <Kirim />
    </form>
  );
}
