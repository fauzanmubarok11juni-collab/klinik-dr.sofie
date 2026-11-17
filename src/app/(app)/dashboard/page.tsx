import Link from "next/link";
import { ambilProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { formatTanggal, hariIniWIB, rupiah } from "@/lib/format";
import { muatStokBermasalah, type StokBermasalah } from "@/lib/obat-server";

type SesiRow = { kode: "pagi" | "malam"; nama: string; jam_mulai: string; jam_selesai: string };
type HariRow = { kode: string; terdaftar: number; menunggu: number; diperiksa: number; selesai: number; pendapatan: number };
type BulanRow = { kode: string; kunjungan: number; pendapatan: number };
type Ring = {
  hari: HariRow[]; bulan: BulanRow[]; baru_lama: { baru: number; lama: number } | null;
  diagnosis: { kode: string; nama: string; jumlah: number }[]; harian: { tanggal: string; pagi: number; malam: number }[];
};

const jam = (t: string) => t.slice(0, 5).replace(":", ".");
const Bar = ({ persen, warna = "bg-utama" }: { persen: number; warna?: string }) => (
  <div aria-hidden className="h-3 w-full rounded bg-garis/60"><div className={`h-3 rounded ${warna}`} style={{ width: `${Math.max(2, Math.min(100, persen))}%` }} /></div>
);
const Angka = ({ judul, nilai }: { judul: string; nilai: string | number }) => (
  <div><dt className="text-sm text-redup">{judul}</dt><dd className="text-2xl font-bold">{nilai}</dd></div>
);

export default async function Dashboard({ searchParams }: { searchParams: { sesi?: string; akses?: string } }) {
  const profil = await ambilProfil();
  const dokter = profil.role === "dokter";
  const sesi = bacaSesi(searchParams.sesi);
  const hariIni = hariIniWIB();
  const tambah = (h: number) => { const d = new Date(hariIni + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + h); return d.toISOString().slice(0, 10); };
  const supabase = createClient();

  const [sesiR, kontrolR, stok, ringR, kunjR] = await Promise.all([
    supabase.from("practice_sessions").select("kode, nama, jam_mulai, jam_selesai").eq("aktif", true).order("jam_mulai"),
    supabase.from("control_schedules").select("tanggal").eq("status", "terjadwal").gte("tanggal", tambah(-30)).lte("tanggal", tambah(7)),
    muatStokBermasalah(supabase, hariIni),
    dokter ? supabase.rpc("ringkasan_dashboard", { p_hari: hariIni }) : Promise.resolve({ data: null }),
    dokter ? Promise.resolve({ data: null }) : supabase.from("encounters").select("status, practice_sessions!inner(kode)").eq("tanggal", hariIni),
  ]);

  const daftarSesi = ((sesiR.data ?? []) as SesiRow[]).filter((s) => sesi === "semua" || s.kode === sesi);
  const kontrol = (kontrolR.data ?? []) as { tanggal: string }[];
  const nTerlambat = kontrol.filter((k) => k.tanggal < hariIni).length;
  const nHariIni = kontrol.filter((k) => k.tanggal === hariIni).length;
  const nPekan = kontrol.filter((k) => k.tanggal > hariIni).length;
  const ring = ringR.data as Ring | null;

  // Ringkasan hari ini per sesi: Dokter dari fungsi laporan, Asisten dihitung langsung (tanpa data keuangan)
  const hariPer = (kode: string): HariRow => {
    if (ring) return ring.hari.find((h) => h.kode === kode) ?? { kode, terdaftar: 0, menunggu: 0, diperiksa: 0, selesai: 0, pendapatan: 0 };
    const r = ((kunjR.data ?? []) as unknown as { status: string; practice_sessions: { kode: string } | null }[]).filter((k) => k.practice_sessions?.kode === kode && k.status !== "batal");
    return { kode, terdaftar: r.length, menunggu: r.filter((k) => k.status === "menunggu").length, diperiksa: r.filter((k) => k.status === "diperiksa").length, selesai: r.filter((k) => k.status === "selesai").length, pendapatan: 0 };
  };

  const bulanTampil = ring ? ring.bulan.filter((b) => sesi === "semua" || b.kode === sesi) : [];
  const totalPendapatanBulan = bulanTampil.reduce((a, b) => a + Number(b.pendapatan), 0);
  const maksDx = Math.max(1, ...(ring?.diagnosis.map((d) => d.jumlah) ?? [1]));
  const maksHarian = Math.max(1, ...(ring?.harian.map((h) => (sesi === "pagi" ? h.pagi : sesi === "malam" ? h.malam : h.pagi + h.malam)) ?? [1]));

  return (
    <>
      <PageHeader
        judul={`Selamat datang, ${profil.nama}`}
        deskripsi={`${formatTanggal(hariIni, true)}. Ringkasan praktik.`}
        aksi={<Link href="/pasien" className={gayaTombol({ ukuran: "besar" })}>Daftarkan pasien</Link>}
      />
      <div className="mb-4"><SesiTabs aktif={sesi} basePath="/dashboard" /></div>
      {searchParams.akses === "ditolak" && <div className="mb-4"><Banner jenis="peringatan">Halaman itu khusus Dokter, jadi Anda dikembalikan ke Beranda.</Banner></div>}

      <h2 className="mb-3 text-lg font-bold">Hari ini</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {daftarSesi.map((s) => {
          const h = hariPer(s.kode);
          return (
            <Card key={s.kode}>
              <h3 className="text-xl font-bold">{s.nama}</h3>
              <p className="text-redup">Jam {jam(s.jam_mulai)} – {jam(s.jam_selesai)}</p>
              <dl className={`mt-4 grid gap-3 ${dokter ? "grid-cols-2" : "grid-cols-3"}`}>
                <Angka judul="Terdaftar" nilai={h.terdaftar} />
                <Angka judul="Menunggu" nilai={h.menunggu} />
                <Angka judul="Selesai" nilai={h.selesai} />
                {dokter && <Angka judul="Pendapatan" nilai={rupiah(Number(h.pendapatan))} />}
              </dl>
              <Link href={`/hari-ini?sesi=${s.kode}`} className={gayaTombol({ variant: "sekunder", className: "mt-4" })}>Lihat daftar pasien</Link>
            </Card>
          );
        })}
        {daftarSesi.length === 0 && <Card><p>Jadwal sesi belum terbaca. Pastikan SQL migrasi sudah dijalankan.</p></Card>}
      </div>

      {dokter && ring && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-bold">Bulan ini</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bulanTampil.map((b) => (
              <Card key={b.kode}>
                <h3 className="font-bold">Sesi {b.kode === "pagi" ? "Pagi" : "Malam"}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-3"><Angka judul="Kunjungan" nilai={b.kunjungan} /><Angka judul="Pendapatan" nilai={rupiah(Number(b.pendapatan))} /></dl>
              </Card>
            ))}
            <Card>
              <h3 className="font-bold">{sesi === "semua" ? "Gabungan" : "Pasien bulan ini"}</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {sesi === "semua" && <Angka judul="Pendapatan" nilai={rupiah(totalPendapatanBulan)} />}
                <Angka judul="Pasien baru" nilai={ring.baru_lama?.baru ?? 0} />
                <Angka judul="Pasien lama" nilai={ring.baru_lama?.lama ?? 0} />
              </dl>
              <p className="mt-2 text-sm text-redup">Pendapatan = tagihan lunas, menurut tanggal kunjungan. Pasien baru/lama tidak dipisah per sesi.</p>
            </Card>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold">10 diagnosis terbanyak bulan ini</h2>
              {ring.diagnosis.length === 0 ? <p className="mt-2 text-redup">Belum ada diagnosis tercatat bulan ini.</p> : (
                <ol className="mt-3 space-y-3">
                  {ring.diagnosis.map((d) => (
                    <li key={d.kode}>
                      <div className="flex justify-between gap-3"><span>{d.kode} {d.nama}</span><span className="font-bold">{d.jumlah}</span></div>
                      <Bar persen={(d.jumlah / maksDx) * 100} />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card>
              <h2 className="text-lg font-bold">Kunjungan 14 hari terakhir</h2>
              <ul className="mt-3 space-y-2">
                {ring.harian.map((h) => {
                  const n = sesi === "pagi" ? h.pagi : sesi === "malam" ? h.malam : h.pagi + h.malam;
                  return (
                    <li key={h.tanggal} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
                      <span className="text-sm">{formatTanggal(h.tanggal).replace(/ \d{4}$/, "")}</span>
                      <Bar persen={n === 0 ? 0 : (n / maksHarian) * 100} />
                      <span className="w-24 text-right text-sm">{sesi === "semua" ? `${h.pagi} pagi, ${h.malam} malam` : n}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Pasien kontrol</h2>
          <dl className="mt-3 grid grid-cols-3 gap-3"><Angka judul="Hari ini" nilai={nHariIni} /><Angka judul="7 hari ke depan" nilai={nPekan} /><Angka judul="Terlambat" nilai={nTerlambat} /></dl>
          <Link href="/kontrol" className={gayaTombol({ variant: "sekunder", className: "mt-4" })}>Buka jadwal kontrol</Link>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Stok obat kritis</h2>
          {stok.length === 0 ? <p className="mt-2 text-redup">Tidak ada yang perlu perhatian.</p> : (
            <ul className="mt-2 list-disc pl-5">{stok.slice(0, 5).map((m: StokBermasalah) => <li key={m.id}>{m.nama}: stok {m.stok}{m.status.includes("kedaluwarsa") ? ", sudah kedaluwarsa" : m.status.includes("segera") ? ", segera kedaluwarsa" : ""}</li>)}</ul>
          )}
          <Link href="/obat/stok" className={gayaTombol({ variant: "sekunder", className: "mt-4" })}>Buka stok obat{stok.length > 5 ? ` (${stok.length})` : ""}</Link>
        </Card>
      </div>
      <p className="mt-6 text-redup">Hari Minggu libur (waktu pemeliharaan dan backup).</p>
    </>
  );
}
