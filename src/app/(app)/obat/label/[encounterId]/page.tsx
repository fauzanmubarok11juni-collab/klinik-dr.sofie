import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { muatPenjualan } from "@/lib/obat-server";
import { aturanTeks, bulanTahun } from "@/lib/obat";
import { PageHeader } from "@/components/page-header";
import { TombolCetak } from "@/components/tombol-cetak";
import { Banner } from "@/components/ui/card";
import { formatTanggal, teksUmur } from "@/lib/format";

type Enc = { id: string; tanggal: string; patients: { nama: string; tanggal_lahir: string } | null };

export default async function CetakLabel({ params }: { params: { encounterId: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("encounters").select("id, tanggal, patients(nama, tanggal_lahir)").eq("id", params.encounterId).maybeSingle();
  const enc = data as unknown as Enc | null;
  if (!enc?.patients) notFound();
  const [jual, klinik] = await Promise.all([muatPenjualan(supabase, enc.id), ambilInfoKlinik()]);
  const p = enc.patients;

  return (
    <>
      <div className="no-print">
        <PageHeader judul="Cetak label obat" deskripsi="Satu label per obat yang dijual. Tempelkan pada kemasan." />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TombolCetak label="Cetak label" />
          <Link href="/obat" className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Kembali</Link>
        </div>
        {jual.length === 0 && <div className="mb-4"><Banner jenis="peringatan">Belum ada obat yang dijual pada kunjungan ini.</Banner></div>}
      </div>

      <div className="label-grid">
        {jual.map((it) => (
          <article key={it.uid} className="label-obat" aria-label={`Label ${it.nama}`}>
            <p className="label-klinik">{klinik.nama}</p>
            <p className="label-pasien">{p.nama} <span className="label-kecil">({teksUmur(p.tanggal_lahir)})</span></p>
            <p className="label-obat-nama">{it.nama} {it.sediaan}</p>
            <p className="label-aturan">{aturanTeks(it) || "Sesuai petunjuk dokter"}</p>
            <p className="label-kecil">
              {it.lama_hari ? `Selama ${it.lama_hari} hari. ` : ""}Jumlah: {it.jumlah} {it.satuan}.
              {it.expired ? ` Kedaluwarsa: ${bulanTahun(it.expired)}.` : ""}
            </p>
            <p className="label-kecil">{formatTanggal(enc.tanggal)}</p>
          </article>
        ))}
      </div>
    </>
  );
}
