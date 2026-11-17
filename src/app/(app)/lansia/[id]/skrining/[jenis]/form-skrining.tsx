"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { simpanSkrining } from "../../../actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { WARNA_TINGKAT } from "@/components/nav-klinik";
import { INSTRUMEN, hitungSkrining, type JenisGeri } from "@/lib/geriatri";

function Kirim({ aktif }: { aktif: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending || !aktif}>{pending ? "Menyimpan…" : "Simpan hasil"}</Button>;
}

/** Formulir skrining. Skor dihitung langsung di layar sebagai pratinjau; skor resmi dihitung ulang di server saat disimpan. */
export function FormSkrining({ pasienId, kode, awal = {} }: { pasienId: string; kode: JenisGeri; awal?: Record<string, string> }) {
  const ins = INSTRUMEN[kode];
  const [state, aksi] = useFormState<FormState, FormData>(simpanSkrining.bind(null, pasienId, kode), {});
  const [jawab, setJawab] = useState<Record<string, string>>(awal);
  const h = hitungSkrining(kode, jawab);
  const terjawab = ins.butir.length - h.hilang.length;

  return (
    <form action={aksi} className="space-y-5" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      <p className="text-redup">{ins.deskripsi}</p>
      <ol className="space-y-5">
        {ins.butir.map((b, i) => (
          <li key={b.id} className="rounded-xl border-2 border-garis bg-permukaan p-4">
            <p id={`q-${b.id}`} className="mb-1 font-bold">{i + 1}. {b.tanya}</p>
            {b.bantuan && <p className="mb-2 text-sm text-redup">{b.bantuan}</p>}
            <div role="radiogroup" aria-labelledby={`q-${b.id}`} className="flex flex-wrap gap-2">
              {b.pilihan.map((p) => (
                <label key={p.nilai} className="cursor-pointer">
                  <input type="radio" name={`b_${b.id}`} value={p.nilai} checked={jawab[b.id] === p.nilai}
                    onChange={() => setJawab((j) => ({ ...j, [b.id]: p.nilai }))} className="peer sr-only" />
                  <span className="flex min-h-[44px] items-center rounded-lg border-2 border-garis bg-permukaan px-4 font-bold peer-checked:border-utama peer-checked:bg-utama peer-checked:text-utama-teks peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-utama">{p.label}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div aria-live="polite" className="sticky bottom-2 rounded-xl border-2 border-utama bg-permukaan p-4 shadow-lg">
        <p className="text-sm text-redup">{terjawab} dari {ins.butir.length} butir dijawab</p>
        <p className="text-xl font-bold">Skor {h.skor} dari {ins.maks}</p>
        {h.lengkap && <span className={`mt-1 inline-block rounded-full border-2 px-3 py-0.5 font-bold ${WARNA_TINGKAT[h.tafsir.tingkat]}`}>{h.tafsir.label}</span>}
        {h.lengkap && h.tafsir.saran && <p className="mt-1">{h.tafsir.saran}</p>}
      </div>

      <div>
        <label htmlFor="catatan" className="mb-1.5 block font-bold">Catatan (opsional)</label>
        <Textarea id="catatan" name="catatan" rows={2} />
      </div>
      <Kirim aktif={h.lengkap} />
    </form>
  );
}
