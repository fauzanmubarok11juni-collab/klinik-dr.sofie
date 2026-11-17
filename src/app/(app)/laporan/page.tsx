import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { TombolCetak } from "@/components/tombol-cetak";
import { hariIniWIB } from "@/lib/format";
import { JENIS_LAPORAN, ambilLaporan, nilaiSel, type JenisLaporan } from "@/lib/laporan";
import { cn } from "@/lib/utils";

const TGL = /^\d{4}-\d{2}-\d{2}$/;
const tambahHari = (iso: string, h: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + h); return d.toISOString().slice(0, 10); };

export default async function Laporan({ searchParams }: { searchParams: { jenis?: string; dari?: string; sampai?: string } }) {
  await wajibRole("dokter");
  const hariIni = hariIniWIB();
  const awalBulan = hariIni.slice(0, 8) + "01";
  const akhirBulanLalu = tambahHari(awalBulan, -1);
  const awalBulanLalu = akhirBulanLalu.slice(0, 8) + "01";

  const jenis = (JENIS_LAPORAN.find((j) => j.kode === searchParams.jenis)?.kode ?? "kunjungan") as JenisLaporan;
  const dari = searchParams.dari && TGL.test(searchParams.dari) ? searchParams.dari : awalBulan;
  const sampai = searchParams.sampai && TGL.test(searchParams.sampai) ? searchParams.sampai : hariIni;

  const supabase = createClient();
  const { laporan, error } = await ambilLaporan(supabase, jenis, dari, sampai);

  const href = (j: JenisLaporan, d = dari, s = sampai) => `/laporan?jenis=${j}&dari=${d}&sampai=${s}`;
  const preset = [
    { l: "Hari ini", d: hariIni, s: hariIni },
    { l: "7 hari terakhir", d: tambahHari(hariIni, -6), s: hariIni },
    { l: "Bulan ini", d: awalBulan, s: hariIni },
    { l: "Bulan lalu", d: awalBulanLalu, s: akhirBulanLalu },
  ];

  return (
    <>
      <div className="no-print">
        <PageHeader judul="Laporan" deskripsi="Pilih jenis dan rentang tanggal. Ekspor CSV untuk Excel, atau cetak untuk menyimpan sebagai PDF." />
        <div role="group" aria-label="Jenis laporan" className="mb-4 flex flex-wrap gap-2">
          {JENIS_LAPORAN.map((j) => (
            <Link key={j.kode} href={href(j.kode)} aria-current={jenis === j.kode ? "true" : undefined}
              className={cn("flex min-h-[44px] items-center rounded-lg border-2 px-4 font-bold", jenis === j.kode ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama")}>
              {j.label}
            </Link>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Rentang cepat">
          {preset.map((p) => (
            <Link key={p.l} href={href(jenis, p.d, p.s)} className={cn("flex min-h-[44px] items-center rounded-lg border-2 px-4", p.d === dari && p.s === sampai ? "border-utama font-bold" : "border-garis hover:border-utama")}>{p.l}</Link>
          ))}
        </div>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="jenis" value={jenis} />
          <div><label htmlFor="dari" className="mb-1 block font-bold">Dari</label>
            <input id="dari" type="date" name="dari" defaultValue={dari} className="min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta" /></div>
          <div><label htmlFor="sampai" className="mb-1 block font-bold">Sampai</label>
            <input id="sampai" type="date" name="sampai" defaultValue={sampai} className="min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta" /></div>
          <button type="submit" className="min-h-[44px] rounded-lg bg-utama px-5 font-bold text-utama-teks">Tampilkan</button>
        </form>
      </div>

      {error && <Banner jenis="peringatan">{error}</Banner>}

      {laporan && (
        <section aria-label={laporan.judul}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{laporan.judul}</h2>
            <div className="no-print flex flex-wrap gap-2">
              <a href={`/laporan/export?jenis=${jenis}&dari=${dari}&sampai=${sampai}`} download className={gayaTombol({ variant: "sekunder" })}>Ekspor CSV</a>
              <TombolCetak label="Cetak / simpan PDF" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-garis bg-permukaan">
            <table className="w-full text-left">
              <caption className="sr-only">{laporan.judul}</caption>
              <thead>
                <tr>{laporan.kolom.map((k, i) => (
                  <th key={k} scope="col" className={cn("border-b-2 border-garis px-3 py-2 font-bold", laporan.tipe[i] === "angka" || laporan.tipe[i] === "rp" ? "text-right" : "")}>{k}</th>
                ))}</tr>
              </thead>
              <tbody>
                {laporan.baris.length === 0 && <tr><td colSpan={laporan.kolom.length} className="px-3 py-4 text-redup">Tidak ada data pada rentang ini.</td></tr>}
                {laporan.baris.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => (
                    <td key={j} className={cn("border-b border-garis px-3 py-2", laporan.tipe[j] === "angka" || laporan.tipe[j] === "rp" ? "text-right tabular-nums" : "")}>{nilaiSel(c, laporan.tipe[j])}</td>
                  ))}</tr>
                ))}
              </tbody>
              {laporan.total && (
                <tfoot>
                  <tr>{laporan.total.map((c, j) => (
                    <td key={j} className={cn("border-t-2 border-garis px-3 py-2 font-bold", laporan.tipe[j] === "angka" || laporan.tipe[j] === "rp" ? "text-right tabular-nums" : "")}>{nilaiSel(c, laporan.tipe[j])}</td>
                  ))}</tr>
                </tfoot>
              )}
            </table>
          </div>
          {laporan.catatan && <p className="mt-3 text-sm text-redup">{laporan.catatan}</p>}
        </section>
      )}
    </>
  );
}
