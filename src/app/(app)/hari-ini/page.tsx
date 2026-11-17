import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ambilProfil } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { formatTanggal, hariIniWIB, sesiAktif } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KunjunganBaris, SesiKode, StatusKunjungan } from "@/lib/types";
import { DaftarHariIni } from "./daftar-hari-ini";

const FILTER = ["semua", "menunggu", "diperiksa", "selesai"] as const;
type Filter = (typeof FILTER)[number];

type Mentah = {
  id: string; no_urut: number; status: StatusKunjungan; keluhan_utama: string | null; waktu_daftar: string;
  patient_id: string;
  patients: { nama: string; tanggal_lahir: string; no_rm: string } | null;
  practice_sessions: { kode: SesiKode } | null;
};

export default async function PasienHariIni({
  searchParams,
}: { searchParams: { sesi?: string; status?: string; baru?: string; selesai?: string } }) {
  const profil = await ambilProfil();
  // Tanpa pilihan: tampilkan sesi yang sedang berjalan (pagi sebelum 13.00, selebihnya malam).
  const sesi = searchParams.sesi ? bacaSesi(searchParams.sesi) : sesiAktif();
  const filter: Filter = (FILTER as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as Filter) : "semua";
  const tanggal = hariIniWIB();

  const supabase = createClient();
  let q = supabase
    .from("encounters")
    .select("id, no_urut, status, keluhan_utama, waktu_daftar, patient_id, patients(nama, tanggal_lahir, no_rm), practice_sessions!inner(kode)")
    .eq("tanggal", tanggal)
    .order("no_urut");
  if (sesi !== "semua") q = q.eq("practice_sessions.kode", sesi);
  const { data, error } = await q;

  const semuaBaris: KunjunganBaris[] = ((data ?? []) as unknown as Mentah[])
    .filter((r) => r.patients && r.practice_sessions)
    .map((r) => ({
      id: r.id, no_urut: r.no_urut, status: r.status, keluhan_utama: r.keluhan_utama,
      waktu_daftar: r.waktu_daftar, patient_id: r.patient_id,
      nama: r.patients!.nama, tanggal_lahir: r.patients!.tanggal_lahir, no_rm: r.patients!.no_rm,
      sesi_kode: r.practice_sessions!.kode,
    }))
    .sort((a, b) => (a.sesi_kode === b.sesi_kode ? a.no_urut - b.no_urut : a.sesi_kode === "pagi" ? -1 : 1));

  const hitung = (s: StatusKunjungan) => semuaBaris.filter((r) => r.status === s).length;
  const jumlah: Record<Filter, number> = {
    semua: semuaBaris.length, menunggu: hitung("menunggu"), diperiksa: hitung("diperiksa"), selesai: hitung("selesai"),
  };
  const tampil = filter === "semua" ? semuaBaris : semuaBaris.filter((r) => r.status === filter);

  const hrefFilter = (f: Filter) => {
    const p = new URLSearchParams({ sesi });
    if (f !== "semua") p.set("status", f);
    return `/hari-ini?${p.toString()}`;
  };
  const labelFilter: Record<Filter, string> = { semua: "Semua", menunggu: "Menunggu", diperiksa: "Diperiksa", selesai: "Selesai" };

  return (
    <>
      <PageHeader
        judul="Pasien hari ini"
        deskripsi={formatTanggal(tanggal, true)}
        aksi={<Link href="/pasien" className={gayaTombol({ ukuran: "besar" })}>Daftarkan pasien</Link>}
      />

      {searchParams.selesai && (
        <div className="mb-4"><Banner>Pemeriksaan {searchParams.selesai} sudah selesai dan tersimpan.</Banner></div>
      )}
      {searchParams.baru && (
        <div className="mb-4"><Banner>{searchParams.baru} sudah masuk daftar hari ini.</Banner></div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SesiTabs aktif={sesi} basePath="/hari-ini" eksplisitSemua paramLain={filter === "semua" ? {} : { status: filter }} />
        <div role="group" aria-label="Saring menurut status" className="inline-flex flex-wrap gap-2">
          {FILTER.map((f) => (
            <Link
              key={f} href={hrefFilter(f)} aria-current={filter === f ? "true" : undefined}
              className={cn(
                "flex min-h-[44px] items-center rounded-lg border-2 px-4 font-bold",
                filter === f ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama"
              )}
            >
              {labelFilter[f]} ({jumlah[f]})
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <Banner jenis="bahaya">Daftar belum bisa dimuat. Periksa koneksi internet; halaman akan mencoba lagi otomatis.</Banner>
      ) : tampil.length === 0 ? (
        <Card>
          <p className="font-bold">
            {semuaBaris.length === 0 ? "Belum ada pasien terdaftar untuk pilihan ini." : "Tidak ada pasien dengan status ini."}
          </p>
          <Link href="/pasien" className={gayaTombol({ className: "mt-4" })}>Daftarkan pasien</Link>
        </Card>
      ) : (
        <DaftarHariIni rows={tampil} tampilSesi={sesi === "semua"} dokter={profil.role === "dokter"} />
      )}
    </>
  );
}
