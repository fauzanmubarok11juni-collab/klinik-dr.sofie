import Link from "next/link";
import { ambilProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SesiTabs, bacaSesi } from "@/components/sesi-tabs";
import { formatTanggal, hariIniWIB, rupiah, sesiAktif } from "@/lib/format";
import { muatStokBermasalah, type StokBermasalah } from "@/lib/obat-server";
import type { SesiKode, StatusKunjungan } from "@/lib/types";

type Enc = { id: string; no_urut: number; status: StatusKunjungan; patients: { nama: string } | null; practice_sessions: { kode: SesiKode } | null };

export default async function ObatDanResep({ searchParams }: { searchParams: { sesi?: string } }) {
  const profil = await ambilProfil();
  const sesi = searchParams.sesi ? bacaSesi(searchParams.sesi) : sesiAktif();
  const tanggal = hariIniWIB();
  const supabase = createClient();

  let q = supabase
    .from("encounters")
    .select("id, no_urut, status, patients(nama), practice_sessions!inner(kode)")
    .eq("tanggal", tanggal).neq("status", "batal").order("no_urut");
  if (sesi !== "semua") q = q.eq("practice_sessions.kode", sesi);
  const [{ data }, bermasalah] = await Promise.all([q, muatStokBermasalah(supabase, tanggal)]);
  const enc = ((data ?? []) as unknown as Enc[]).filter((e) => e.patients);
  const ids = enc.map((e) => e.id);

  const [rx, jual] = ids.length
    ? await Promise.all([
        supabase.from("prescription_items").select("encounter_id").in("encounter_id", ids),
        supabase.from("medicine_sales").select("encounter_id, subtotal").in("encounter_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const jmlResep = new Map<string, number>();
  for (const r of (rx.data ?? []) as { encounter_id: string }[]) jmlResep.set(r.encounter_id, (jmlResep.get(r.encounter_id) ?? 0) + 1);
  const totalJual = new Map<string, number>();
  const jmlJual = new Map<string, number>();
  for (const r of (jual.data ?? []) as { encounter_id: string; subtotal: number }[]) {
    totalJual.set(r.encounter_id, (totalJual.get(r.encounter_id) ?? 0) + Number(r.subtotal));
    jmlJual.set(r.encounter_id, (jmlJual.get(r.encounter_id) ?? 0) + 1);
  }

  const teksStatus = (s: StokBermasalah["status"][number]) =>
    ({ habis: "stok habis", menipis: "stok di bawah minimum", kedaluwarsa: "sudah kedaluwarsa", segera: "kedaluwarsa kurang dari 30 hari" })[s];

  return (
    <>
      <PageHeader
        judul="Obat dan resep"
        deskripsi={`${formatTanggal(tanggal, true)}. Catat penjualan obat klinik dan cetak resep atau label.`}
        aksi={
          <div className="flex flex-wrap gap-2">
            <Link href="/obat/stok" className={gayaTombol({ variant: "sekunder" })}>Stok obat</Link>
            {profil.role === "dokter" && <Link href="/obat/daftar" className={gayaTombol({ variant: "sekunder" })}>Daftar obat</Link>}
          </div>
        }
      />

      {bermasalah.length > 0 && (
        <div className="mb-4 space-y-2">
          <Banner jenis="peringatan">
            <p className="font-bold">Perhatian stok obat ({bermasalah.length})</p>
            <ul className="mt-1 list-disc pl-5">
              {bermasalah.slice(0, 6).map((m: StokBermasalah) => (
                <li key={m.id}>{m.nama}: {m.status.map(teksStatus).join(", ")} (stok {m.stok})</li>
              ))}
            </ul>
            <Link href="/obat/stok" className="mt-2 inline-block font-bold underline">Buka stok obat</Link>
          </Banner>
        </div>
      )}

      <div className="mb-4"><SesiTabs aktif={sesi} basePath="/obat" eksplisitSemua /></div>

      {enc.length === 0 ? (
        <Card><p className="font-bold">Belum ada pasien terdaftar untuk pilihan ini.</p></Card>
      ) : (
        <ul className="space-y-3" id="pasien-hari-ini">
          {enc.map((e) => (
            <li key={e.id} className="rounded-xl border-2 border-garis bg-permukaan p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold">{e.patients!.nama}</p>
                  <p className="text-redup">
                    {sesi === "semua" ? `${e.practice_sessions?.kode === "pagi" ? "Pagi" : "Malam"} nomor ${e.no_urut}, ` : `Nomor ${e.no_urut}, `}
                    resep: {jmlResep.get(e.id) ? `${jmlResep.get(e.id)} obat` : "belum ada"}, penjualan: {jmlJual.get(e.id) ? rupiah(totalJual.get(e.id) ?? 0) : "belum ada"}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/obat/jual/${e.id}`} className={gayaTombol()}>Catat penjualan obat</Link>
                {!!jmlResep.get(e.id) && <Link href={`/obat/resep/${e.id}`} className={gayaTombol({ variant: "sekunder" })}>Cetak resep</Link>}
                {!!jmlJual.get(e.id) && <Link href={`/obat/label/${e.id}`} className={gayaTombol({ variant: "sekunder" })}>Cetak label obat</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
