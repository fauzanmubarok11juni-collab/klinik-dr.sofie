"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { imporLMS } from "./actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { HARAPAN } from "@/lib/who-impor";
import type { Indikator } from "@/lib/who";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Mengimpor…" : "Impor tabel"}</Button>;
}

export function FormWHO() {
  const [state, aksi] = useFormState<FormState, FormData>(imporLMS, {});
  const [ind, setInd] = useState<Indikator>("wfa");
  const [data, setData] = useState("");
  const [nama, setNama] = useState("");

  async function bacaBerkas(f: File | undefined) {
    if (!f) return;
    setNama(f.name);
    setData(await f.text());
  }
  const pilihan = Object.entries(HARAPAN) as [Indikator, (typeof HARAPAN)[Indikator]][];

  return (
    <form action={aksi} className="max-w-3xl space-y-5 rounded-xl border-2 border-garis bg-permukaan p-5" noValidate>
      <h2 className="text-lg font-bold">Impor tabel WHO</h2>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      {state.konfirmasi && <Banner>{state.konfirmasi}</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="indikator" className="mb-1.5 block font-bold">Indikator</label>
          <select id="indikator" name="indikator" value={ind} onChange={(e) => setInd(e.target.value as Indikator)}
            className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama">
            {pilihan.map(([k, h]) => <option key={k} value={k}>{h.label}</option>)}
          </select>
          <p className="mt-1 text-sm text-redup">{HARAPAN[ind].petunjuk}</p>
        </div>
        <div>
          <label htmlFor="sex" className="mb-1.5 block font-bold">Jenis kelamin tabel</label>
          <select id="sex" name="sex" defaultValue="L" className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama">
            <option value="L">Laki-laki</option><option value="P">Perempuan</option>
          </select>
          <p className="mt-1 text-sm text-redup">Impor tabel laki-laki dan perempuan secara terpisah.</p>
        </div>
      </div>
      <div>
        <label htmlFor="berkas" className="mb-1.5 block font-bold">Pilih berkas CSV (opsional)</label>
        <input id="berkas" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void bacaBerkas(e.target.files?.[0])}
          className="block min-h-[44px] w-full cursor-pointer rounded-lg border-2 border-garis bg-permukaan p-2 text-base" />
        {nama && <p className="mt-1 text-sm text-redup">Berkas dibaca: {nama}</p>}
      </div>
      <div>
        <label htmlFor="data" className="mb-1.5 block font-bold">Atau tempel isi tabel di sini</label>
        <Textarea id="data" name="data" rows={8} value={data} onChange={(e) => setData(e.target.value)}
          placeholder={"Month\tL\tM\tS\n0\t...\t...\t...\n1\t...\t...\t..."} />
        <p className="mt-1 text-sm text-redup">Di Excel: blok kolom dari Month (atau Length/Height) sampai S, salin (Ctrl+C), lalu tempel di sini (Ctrl+V). Judul kolom boleh ikut.</p>
      </div>
      <Kirim />
    </form>
  );
}
