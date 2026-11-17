import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { muatResep } from "@/lib/obat-server";
import { aturanTeks } from "@/lib/obat";
import { PageHeader } from "@/components/page-header";
import { TombolCetak } from "@/components/tombol-cetak";
import { Banner } from "@/components/ui/card";
import { LABEL_JK, formatTanggal, teksUmur } from "@/lib/format";

type Enc = {
  id: string; tanggal: string;
  patients: { nama: string; no_rm: string; tanggal_lahir: string; jenis_kelamin: string; patient_allergies: { nama_alergi: string }[] } | null;
};

export default async function CetakResep({ params }: { params: { encounterId: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("encounters")
    .select("id, tanggal, patients(nama, no_rm, tanggal_lahir, jenis_kelamin, patient_allergies(nama_alergi))")
    .eq("id", params.encounterId).maybeSingle();
  const enc = data as unknown as Enc | null;
  if (!enc?.patients) notFound();
  const p = enc.patients;
  const [resep, klinik] = await Promise.all([muatResep(supabase, enc.id), ambilInfoKlinik()]);

  return (
    <>
      <div className="no-print">
        <PageHeader judul="Cetak resep" deskripsi="Pada jendela cetak, pilih kertas A4 atau A5 dengan skala 100%." />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TombolCetak label="Cetak resep" />
          <Link href="/obat" className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Kembali</Link>
        </div>
        {resep.items.length === 0 && <div className="mb-4"><Banner jenis="peringatan">Belum ada obat pada resep kunjungan ini.</Banner></div>}
      </div>

      <article className="resep-cetak" aria-label={`Resep ${p.nama}`}>
        <header className="resep-kop">
          <p className="resep-klinik">{klinik.nama}</p>
          {klinik.alamat && <p>{klinik.alamat}</p>}
          {klinik.telepon && <p>Telp/WA: {klinik.telepon}</p>}
          <p className="font-bold">{klinik.dokter}{klinik.sip ? `  •  SIP ${klinik.sip}` : ""}</p>
        </header>

        <section className="resep-pasien">
          <p><span className="resep-label">Tanggal</span> {formatTanggal(enc.tanggal)}</p>
          <p><span className="resep-label">Pasien</span> <b>{p.nama}</b> ({LABEL_JK[p.jenis_kelamin]}, {teksUmur(p.tanggal_lahir)})</p>
          <p><span className="resep-label">No. RM</span> {p.no_rm}</p>
          {p.patient_allergies.length > 0 && <p><span className="resep-label">Alergi</span> <b>{p.patient_allergies.map((a) => a.nama_alergi).join(", ")}</b></p>}
        </section>

        <section className="resep-isi">
          {resep.items.map((it, i) => (
            <div key={it.uid} className="resep-obat">
              <p className="resep-r"><span aria-hidden>R/</span> <b>{it.nama}</b> {it.sediaan} <span className="resep-jumlah">jumlah {it.jumlah} {it.satuan}</span></p>
              <p className="resep-aturan">
                {i + 1}. Aturan pakai: {aturanTeks(it) || "sesuai petunjuk dokter"}{it.lama_hari ? `, selama ${it.lama_hari} hari` : ""}
              </p>
              {it.catatan && <p className="resep-aturan">Catatan: {it.catatan}</p>}
            </div>
          ))}
          {resep.catatan && <p className="resep-catatan">Catatan dokter: {resep.catatan}</p>}
        </section>

        <footer className="resep-ttd">
          <p>Kota, {formatTanggal(enc.tanggal)}</p>
          <div className="resep-garis" />
          <p className="font-bold">{klinik.dokter || "Dokter"}</p>
        </footer>
      </article>
    </>
  );
}
