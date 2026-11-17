"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { catatStok, type StokState } from "../actions";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, PilihanRadio } from "@/components/ui/field";
import { PilihObat } from "@/components/obat/pilih-obat";
import { namaObat, type MedInfo } from "@/lib/obat";

function Kirim() {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : "Simpan stok"}</Button>;
}

export function FormStok({ hariIni }: { hariIni: string }) {
  const [state, aksi] = useFormState<StokState, FormData>(catatStok, {});
  const [obat, setObat] = useState<MedInfo | null>(null);
  const [tipe, setTipe] = useState("masuk");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => { if (state.ok) { form.current?.reset(); setObat(null); setTipe("masuk"); } }, [state]);

  return (
    <form ref={form} action={aksi} className="space-y-5 rounded-xl border-2 border-garis bg-permukaan p-5" noValidate>
      <h2 className="text-lg font-bold">Catat stok</h2>
      {state.ok && <Banner>{state.pesan}</Banner>}
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}

      {obat ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-utama p-3">
          <span><span className="font-bold">{namaObat(obat)}</span><br /><span className="text-redup">Stok sekarang {obat.stok_saat_ini}</span></span>
          <Button type="button" variant="sekunder" onClick={() => setObat(null)}>Ganti obat</Button>
        </div>
      ) : (
        <PilihObat hanyaDijual label="Pilih obat" onPilih={setObat} />
      )}
      <input type="hidden" name="medicine_id" value={obat?.id ?? ""} />

      <div onChange={(e) => { const t = e.target as HTMLInputElement; if (t.name === "tipe") setTipe(t.value); }}>
        <PilihanRadio legend="Jenis" name="tipe" defaultValue="masuk"
          pilihan={[{ nilai: "masuk", label: "Stok masuk" }, { nilai: "keluar", label: "Kurangi stok (rusak, kedaluwarsa, koreksi)" }]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jumlah" htmlFor="jumlah"><Input id="jumlah" name="jumlah" inputMode="numeric" autoComplete="off" /></Field>
        <Field label="Tanggal" htmlFor="tanggal"><Input id="tanggal" name="tanggal" type="date" defaultValue={hariIni} /></Field>
        {tipe === "masuk" && (
          <Field label="Tanggal kedaluwarsa" htmlFor="expired"
            hint={obat?.tanggal_expired ? `Sekarang tercatat ${obat.tanggal_expired}. Isi hanya bila ingin mengganti.` : "Satu tanggal per obat (yang terdekat). Boleh dikosongkan."}>
            <Input id="expired" name="expired" type="date" />
          </Field>
        )}
        <Field label={tipe === "masuk" ? "Catatan (opsional)" : "Alasan (wajib)"} htmlFor="catatan"
          hint={tipe === "masuk" ? "Contoh: beli dari apotek X" : "Contoh: kemasan rusak"}>
          <Input id="catatan" name="catatan" autoComplete="off" />
        </Field>
      </div>
      <Kirim />
    </form>
  );
}
