import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { hariIniWIB, hitungUmur, sesiAktif, teksUmur } from "@/lib/format";
import type { SesiKode, StatusKunjungan } from "@/lib/types";

type Enc = { id: string; no_urut: number; status: StatusKunjungan; patients: { id: string; nama: string; no_rm: string; tanggal_lahir: string } | null; practice_sessions: { kode: SesiKode } | null };

export default async function DaftarLansia({ searchParams }: { searchParams: { sesi?: string } }) {
  await wajibRole("dokter");
  const sesi = searchParams.sesi ? bacaSesi(searchParams.sesi) : sesiAktif();
  const tanggal = hariIniWIB();
  const supabase = createClient();
  let q = supabase.from("encounters").select("id, no_urut, status, patients(id, nama, no_rm, tanggal_lahir), practice_sessions!inner(kode)").eq("tanggal", tanggal).neq("status", "batal").order("no_urut");
  if (sesi !== "semua") q = q.eq("practice_sessions.kode", sesi);
  const { data } = await q;
  const lansia = ((data ?? []) as unknown as Enc[]).filter((e) => e.patients && hitungUmur(e.patients.tanggal_lahir).tahun >= 60);

  return (
    <>
      <PageHeader judul="Klinik lansia" deskripsi="Pasien lansia (60 tahun ke atas) yang terdaftar hari ini: skrining geriatri, rekonsiliasi obat, dan ringkasan satu layar."
        aksi={<Link href="/pasien" className={gayaTombol({ variant: "sekunder" })}>Cari pasien lain</Link>} />
      <div className="mb-4"><SesiTabs aktif={sesi} basePath="/lansia" eksplisitSemua /></div>
      {lansia.length === 0 ? <Card><p className="font-bold">Belum ada pasien lansia terdaftar untuk pilihan ini.</p></Card> : (
        <ul className="space-y-3">
          {lansia.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-garis bg-permukaan p-4">
              <div><p className="text-lg font-bold">{e.patients!.nama}</p><p className="text-redup">{e.patients!.no_rm}, {teksUmur(e.patients!.tanggal_lahir)}</p></div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={e.status} />
                <Link href={`/lansia/${e.patients!.id}`} className={gayaTombol()}>Ringkasan geriatri</Link>
                <Link href={`/lansia/${e.patients!.id}/obat`} className={gayaTombol({ variant: "sekunder" })}>Rekonsiliasi obat</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
