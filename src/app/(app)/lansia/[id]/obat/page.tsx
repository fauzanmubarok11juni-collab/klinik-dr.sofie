import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { Button, gayaTombol } from "@/components/ui/button";
import { NavKlinik } from "@/components/nav-klinik";
import { formatTanggal, hitungUmur, teksUmur } from "@/lib/format";
import { analisisRekonsiliasi, muatObatAktif } from "@/lib/rekonsiliasi";
import { hapusObatLuar, setAktifObatLuar } from "../../actions";
import { FormObatLuar } from "./form-obat-luar";

const JUDUL = { polifarmasi: "Polifarmasi", interaksi: "Interaksi obat", duplikasi: "Duplikasi", lansia: "Lansia" } as const;

export default async function RekonsiliasiObat({ params }: { params: { id: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("id, nama, no_rm, tanggal_lahir").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const [obat, nonaktifR] = await Promise.all([
    muatObatAktif(supabase, p.id),
    supabase.from("patient_external_meds").select("id, nama, aturan, sumber").eq("patient_id", p.id).eq("aktif", false).order("updated_at", { ascending: false }).limit(10),
  ]);
  const peringatan = await analisisRekonsiliasi(supabase, obat, hitungUmur(p.tanggal_lahir).tahun);
  const klinik = obat.filter((o) => o.sumber === "klinik");
  const luar = obat.filter((o) => o.sumber === "luar");
  const nonaktif = (nonaktifR.data ?? []) as { id: string; nama: string; aturan: string | null; sumber: string | null }[];

  return (
    <>
      <PageHeader judul={`Rekonsiliasi obat: ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}. Semua obat yang sedang dipakai, dari klinik maupun dari luar.`}
        aksi={<Link href={`/lansia/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Kembali ke ringkasan</Link>} />
      <NavKlinik label="Bagian klinik lansia" items={[{ href: `/lansia/${p.id}`, label: "Ringkasan", aktif: false }, { href: `/lansia/${p.id}/obat`, label: "Rekonsiliasi obat", aktif: true }]} />

      <div className="mb-6 space-y-2">
        <Banner jenis={obat.length > 5 ? "peringatan" : "info"}><span className="font-bold">{obat.length} obat aktif</span>{obat.length > 5 ? " (lebih dari 5: polifarmasi)" : ""}</Banner>
        {peringatan.map((a, i) => <Banner key={i} jenis="peringatan"><span className="font-bold">{JUDUL[a.jenis]}: </span>{a.pesan}</Banner>)}
        {peringatan.length === 0 && obat.length > 0 && <p className="text-redup">Tidak ditemukan interaksi atau duplikasi pada daftar ini.</p>}
        <p className="text-sm text-redup">Peringatan hanya panduan ringkas dari tabel interaksi dan kriteria Beers di sistem; bukan pengganti penilaian dokter. Obat yang ditulis manual tidak diperiksa.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-bold">Dari resep atau penjualan klinik ({klinik.length})</h2>
            <p className="text-sm text-redup">Otomatis, selama masa pemakaian (lama hari) belum habis.</p>
            {klinik.length === 0 ? <p className="mt-2 text-redup">Tidak ada.</p> : (
              <ul className="mt-2 space-y-1">{klinik.map((o) => <li key={o.kunci}><span className="font-bold">{o.nama}</span>{o.aturan ? `: ${o.aturan}` : ""} <span className="text-sm text-redup">(sampai {o.sampai ? formatTanggal(o.sampai) : "—"})</span></li>)}</ul>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Dari luar klinik ({luar.length})</h2>
            {luar.length === 0 ? <p className="mt-2 text-redup">Belum ada.</p> : (
              <ul className="mt-2 divide-y divide-garis">
                {luar.map((o) => (
                  <li key={o.kunci} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-bold">{o.nama}</span>{o.aturan ? `: ${o.aturan}` : ""}{o.asal ? <span className="text-sm text-redup"> ({o.asal})</span> : null}{!o.medicine_id ? <span className="block text-sm text-peringatan">Tidak ikut pemeriksaan interaksi</span> : null}</span>
                    <span className="flex gap-1">
                      <form action={setAktifObatLuar.bind(null, o.extId as string, p.id, false)}><Button type="submit" variant="sekunder">Sudah berhenti</Button></form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {nonaktif.length > 0 && (
              <details className="mt-3">
                <summary className="min-h-[44px] cursor-pointer leading-[44px] underline">Obat luar yang sudah berhenti ({nonaktif.length})</summary>
                <ul className="mt-2 divide-y divide-garis">
                  {nonaktif.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{o.nama}{o.aturan ? `: ${o.aturan}` : ""}</span>
                      <span className="flex gap-1">
                        <form action={setAktifObatLuar.bind(null, o.id, p.id, true)}><Button type="submit" variant="sekunder">Aktifkan lagi</Button></form>
                        <form action={hapusObatLuar.bind(null, o.id, p.id)}><Button type="submit" variant="senyap">Hapus</Button></form>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        </div>
        <FormObatLuar pasienId={p.id} />
      </div>
    </>
  );
}
