import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { formatTanggal, hariIniWIB, rupiah, sesiAktif } from "@/lib/format";
import type { SesiKode, StatusKunjungan } from "@/lib/types";

type Enc = { id: string; no_urut: number; status: StatusKunjungan; patients: { nama: string } | null; practice_sessions: { kode: SesiKode } | null };

export default async function Kasir({ searchParams }: { searchParams: { sesi?: string } }) {
  const sesi = searchParams.sesi ? bacaSesi(searchParams.sesi) : sesiAktif();
  const tanggal = hariIniWIB();
  const supabase = createClient();

  let q = supabase.from("encounters").select("id, no_urut, status, patients(nama), practice_sessions!inner(kode)")
    .eq("tanggal", tanggal).neq("status", "batal").order("no_urut");
  if (sesi !== "semua") q = q.eq("practice_sessions.kode", sesi);
  const { data } = await q;
  const enc = ((data ?? []) as unknown as Enc[]).filter((e) => e.patients);
  const ids = enc.map((e) => e.id);

  const { data: inv } = ids.length
    ? await supabase.from("invoices").select("encounter_id, status, total, nomor").in("encounter_id", ids).neq("status", "void")
    : { data: [] };
  const tagihan = new Map<string, { status: string; total: number; nomor: string }>();
  for (const i of (inv ?? []) as { encounter_id: string; status: string; total: number; nomor: string }[]) tagihan.set(i.encounter_id, { status: i.status, total: Number(i.total), nomor: i.nomor });

  const belum = enc.filter((e) => tagihan.get(e.id)?.status !== "lunas").length;
  const totalLunas = Array.from(tagihan.values()).filter((t) => t.status === "lunas").reduce((a, t) => a + t.total, 0);

  return (
    <>
      <PageHeader
        judul="Kasir"
        deskripsi={`${formatTanggal(tanggal, true)}. Belum dibayar: ${belum} pasien. Diterima: ${rupiah(totalLunas)}.`}
        aksi={<Link href="/kasir/riwayat" className={gayaTombol({ variant: "sekunder" })}>Riwayat transaksi</Link>}
      />
      <div className="mb-4"><SesiTabs aktif={sesi} basePath="/kasir" eksplisitSemua /></div>

      {enc.length === 0 ? (
        <Card><p className="font-bold">Belum ada pasien terdaftar untuk pilihan ini.</p></Card>
      ) : (
        <ul className="space-y-3">
          {enc.map((e) => {
            const t = tagihan.get(e.id);
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-garis bg-permukaan p-4">
                <div>
                  <p className="text-lg font-bold">{e.patients!.nama}</p>
                  <p className="text-redup">
                    {sesi === "semua" ? `${e.practice_sessions?.kode === "pagi" ? "Pagi" : "Malam"} nomor ${e.no_urut}` : `Nomor ${e.no_urut}`}
                    {t ? `, ${t.nomor}, ${rupiah(t.total)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={e.status} />
                  <span className={`rounded-full border-2 px-3 py-0.5 text-sm font-bold ${t?.status === "lunas" ? "border-berhasil text-berhasil" : "border-peringatan text-peringatan"}`}>
                    {t?.status === "lunas" ? "Lunas" : t ? "Belum dibayar" : "Belum ditagih"}
                  </span>
                  <Link href={`/kasir/${e.id}`} className={gayaTombol({ variant: t?.status === "lunas" ? "sekunder" : "utama" })}>
                    {t?.status === "lunas" ? "Lihat / cetak kuitansi" : "Buka tagihan"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
