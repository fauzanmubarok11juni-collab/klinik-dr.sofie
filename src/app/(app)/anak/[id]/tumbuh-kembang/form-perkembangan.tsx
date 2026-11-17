"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { simpanPerkembangan } from "../../actions";
import type { FormState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { CATATAN_SKRINING, DOMAIN_LABEL, TAFSIR, nilaiPerkembangan } from "@/lib/perkembangan";

export type ButirForm = { id: string; domain: string; pertanyaan: string };

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan hasil skrining"}</Button>;
}

const PILIHAN = [{ n: "ya", l: "Ya" }, { n: "tidak", l: "Tidak" }, { n: "belum", l: "Belum tahu" }] as const;

export function FormPerkembangan({ pasienId, butir, checkpoint }: { pasienId: string; butir: ButirForm[]; checkpoint: number }) {
  const [state, aksi] = useFormState<FormState, FormData>(simpanPerkembangan.bind(null, pasienId), {});
  const [jawab, setJawab] = useState<Record<string, string>>({});
  const [khawatir, setKhawatir] = useState(false);
  const [mundur, setMundur] = useState(false);
  const ids = butir.map((b) => b.id);
  const nilai = nilaiPerkembangan(jawab, ids, khawatir, mundur);
  const terjawab = ids.filter((i) => jawab[i]).length;
  const domain = Array.from(new Set(butir.map((b) => b.domain)));

  return (
    <form action={aksi} className="space-y-6" noValidate>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      <p className="text-redup">Butir untuk usia sekitar <b>{checkpoint} bulan</b>: kemampuan yang umumnya sudah dimiliki anak seusia ini. Tanyakan kepada orang tua, atau amati langsung.</p>

      {domain.map((d) => (
        <fieldset key={d} className="rounded-xl border-2 border-garis bg-permukaan p-4">
          <legend className="px-1 text-lg font-bold">{DOMAIN_LABEL[d] ?? d}</legend>
          <ul className="space-y-4">
            {butir.filter((b) => b.domain === d).map((b) => (
              <li key={b.id}>
                <p id={`q-${b.id}`} className="mb-2">{b.pertanyaan}</p>
                <div role="radiogroup" aria-labelledby={`q-${b.id}`} className="flex flex-wrap gap-2">
                  {PILIHAN.map((p) => (
                    <label key={p.n} className="cursor-pointer">
                      <input type="radio" name={`j_${b.id}`} value={p.n} checked={jawab[b.id] === p.n}
                        onChange={() => setJawab((j) => ({ ...j, [b.id]: p.n }))} className="peer sr-only" />
                      <span className="flex min-h-[44px] items-center rounded-lg border-2 border-garis bg-permukaan px-5 font-bold peer-checked:border-utama peer-checked:bg-utama peer-checked:text-utama-teks peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-utama">{p.l}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      <fieldset className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <legend className="px-1 font-bold">Penanda lain</legend>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" name="khawatir" checked={khawatir} onChange={(e) => setKhawatir(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--utama))]" />
          <span>Orang tua khawatir tentang perkembangan anak</span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input type="checkbox" name="kemunduran" checked={mundur} onChange={(e) => setMundur(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--utama))]" />
          <span>Anak kehilangan kemampuan yang sebelumnya sudah dimiliki (kemunduran)</span>
        </label>
      </fieldset>

      <div aria-live="polite" className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <p className="text-sm text-redup">{terjawab} dari {ids.length} butir dijawab</p>
        <p className="mt-1 text-lg font-bold">Hasil sementara: {TAFSIR[nilai.hasil].label}</p>
        <p>{TAFSIR[nilai.hasil].saran}</p>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3">
          <input key={nilai.hasil} type="checkbox" name="rujuk_manual" defaultChecked={nilai.hasil === "rujuk"} className="h-5 w-5 accent-[rgb(var(--utama))]" />
          <span className="font-bold">Tandai perlu rujukan</span>
        </label>
      </div>

      <div>
        <label htmlFor="catatan" className="mb-1.5 block font-bold">Catatan (opsional)</label>
        <Textarea id="catatan" name="catatan" rows={2} />
      </div>
      <p className="text-sm text-redup">{CATATAN_SKRINING}</p>
      <Kirim />
    </form>
  );
}
