"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { bayar, type KasirState } from "../actions";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, PilihanRadio } from "@/components/ui/field";
import { rupiah } from "@/lib/format";

function Kirim({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" ukuran="besar" disabled={pending}>{pending ? "Menyimpan…" : label}</Button>;
}

export function FormBayar({ encounterId, invoiceId, total }: { encounterId: string; invoiceId: string; total: number }) {
  const [state, aksi] = useFormState<KasirState, FormData>(bayar.bind(null, encounterId), {});
  const [metode, setMetode] = useState("tunai");
  const [diterima, setDiterima] = useState("");
  const angka = Number(diterima.replace(/\D/g, "")) || 0;
  const kembalian = angka - total;
  const gratis = total === 0;

  // Saran uang diterima: pas, genapkan ke 50 ribu dan 100 ribu
  const saran = Array.from(new Set([total, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000])).filter((x) => x >= total && x > 0);

  return (
    <form action={aksi} className="space-y-5 rounded-xl border-2 border-garis bg-permukaan p-5" noValidate>
      <h2 className="text-lg font-bold">Pembayaran</h2>
      {state.error && <Banner jenis="bahaya">{state.error}</Banner>}
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="total_dilihat" value={total} />

      {gratis ? (
        <>
          <input type="hidden" name="metode" value="tunai" />
          <Banner>Total tagihan Rp0. Tekan tombol di bawah untuk menutup tagihan.</Banner>
        </>
      ) : (
        <>
          <div onChange={(e) => { const t = e.target as HTMLInputElement; if (t.name === "metode") setMetode(t.value); }}>
            <PilihanRadio legend="Metode bayar" name="metode" defaultValue="tunai"
              pilihan={[{ nilai: "tunai", label: "Tunai" }, { nilai: "transfer", label: "Transfer" }, { nilai: "qris", label: "QRIS" }]} />
          </div>
          {metode === "tunai" ? (
            <div className="space-y-2">
              <Field label="Uang diterima (Rp)" htmlFor="diterima" hint={angka > 0 ? (kembalian >= 0 ? `Kembalian: ${rupiah(kembalian)}` : `Kurang ${rupiah(-kembalian)}`) : "Ketik jumlah, atau pilih di bawah."}>
                <Input id="diterima" name="diterima" inputMode="numeric" autoComplete="off" value={diterima} onChange={(e) => setDiterima(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {saran.map((s, i) => (
                  <Button key={s} type="button" variant="sekunder" onClick={() => setDiterima(String(s))}>{i === 0 && s === total ? `Uang pas (${rupiah(s)})` : rupiah(s)}</Button>
                ))}
              </div>
            </div>
          ) : (
            <Banner>Catat setelah pembayaran {metode === "qris" ? "QRIS" : "transfer"} benar-benar masuk.</Banner>
          )}
          <Field label="Catatan (opsional)" htmlFor="catatan"><Input id="catatan" name="catatan" autoComplete="off" /></Field>
        </>
      )}
      <Kirim label={gratis ? "Tutup tagihan" : `Terima pembayaran ${rupiah(total)}`} />
    </form>
  );
}
