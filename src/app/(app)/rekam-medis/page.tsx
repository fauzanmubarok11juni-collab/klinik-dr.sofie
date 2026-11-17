import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { formatTanggal, hariIniWIB, sesiAktif, teksUmur } from "@/lib/format";
import type { SesiKode, StatusKunjungan } from "@/lib/types";

type Baris = {
  id: string; no_urut: number; status: StatusKunjungan; keluhan_utama: string | null;
  patients: { nama: string; tanggal_lahir: string; no_rm: string } | null;
  practice_sessions: { kode: SesiKode } | null;
};
const URUT: Record<StatusKunjungan, number> = { diperiksa: 0, menunggu: 1, selesai: 2, batal: 3 };

export default async function DaftarRekamMedis({ searchParams }: { searchParams: { sesi?: string } }) {
  await wajibRole("dokter");
  const sesi = searchParams.sesi ? bacaSesi(searchParams.sesi) : sesiAktif();
  const tanggal = hariIniWIB();

  const supabase = createClient();
  let q = supabase
    .from("encounters")
    .select("id, no_urut, status, keluhan_utama, patients(nama, tanggal_lahir, no_rm), practice_sessions!inner(kode)")
    .eq("tanggal", tanggal)
    .neq("status", "batal");
  if (sesi !== "semua") q = q.eq("practice_sessions.kode", sesi);
  const { data } = await q;

  const baris = ((data ?? []) as unknown as Baris[])
    .filter((b) => b.patients)
    .sort((a, b) => URUT[a.status] - URUT[b.status] || a.no_urut - b.no_urut);

  return (
    <>
      <PageHeader
        judul="Rekam medis"
        deskripsi={`${formatTanggal(tanggal, true)}. Pilih pasien untuk diperiksa, atau cari pasien lain.`}
        aksi={<Link href="/pasien" className={gayaTombol({ variant: "sekunder" })}>Cari pasien lain</Link>}
      />
      <div className="mb-4"><SesiTabs aktif={sesi} basePath="/rekam-medis" eksplisitSemua /></div>

      {baris.length === 0 ? (
        <Card><p className="font-bold">Belum ada pasien terdaftar untuk pilihan ini.</p></Card>
      ) : (
        <ul className="space-y-3">
          {baris.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-garis bg-permukaan p-4">
              <div className="min-w-0">
                <p className="text-lg font-bold">{b.patients!.nama}</p>
                <p className="text-redup">
                  {b.patients!.no_rm}, {teksUmur(b.patients!.tanggal_lahir)}
                  {b.keluhan_utama ? `, ${b.keluhan_utama}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={b.status} />
                <Link href={`/rekam-medis/${b.id}`} className={gayaTombol({ variant: b.status === "selesai" ? "sekunder" : "utama" })}>
                  {b.status === "menunggu" ? "Mulai periksa" : b.status === "diperiksa" ? "Lanjutkan" : "Lihat"}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
