import Link from "next/link";
import { notFound } from "next/navigation";
import { ambilProfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { Button, gayaTombol } from "@/components/ui/button";
import { Tabel, Td, Th } from "@/components/ui/table";
import { formatTanggal, hariIniWIB, rupiah, teksUmur } from "@/lib/format";
import { pilihKonsultasi } from "../actions";
import { FormBayar } from "./form-bayar";
import { FormVoid } from "./form-void";

type Enc = {
  id: string; tanggal: string; status: string; penjamin: string; patient_id: string;
  patients: { nama: string; no_rm: string; tanggal_lahir: string } | null;
  practice_sessions: { nama: string } | null;
};
type Inv = { id: string; nomor: string; status: "terbuka" | "lunas" | "void"; total: number; jenis_konsultasi: string; void_alasan: string | null };
type Item = { id: string; jenis: string; nama: string; jumlah: number; harga_satuan: number; subtotal: number };
type Pay = { metode: string; diterima: number; kembalian: number; dibayar_pada: string };

const LAB_JENIS: Record<string, string> = { konsultasi: "Konsultasi", tindakan: "Tindakan", obat: "Obat" };
const LAB_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };
const TIER: { kode: string; label: string }[] = [
  { kode: "konsultasi", label: "Konsultasi" }, { kode: "kontrol", label: "Kontrol" }, { kode: "gratis", label: "Tanpa biaya konsultasi" },
];

export default async function KasirDetail({
  params, searchParams,
}: { params: { encounterId: string }; searchParams: { lunas?: string; void?: string } }) {
  const profil = await ambilProfil();
  const supabase = createClient();

  const { data: encRaw } = await supabase
    .from("encounters")
    .select("id, tanggal, status, penjamin, patient_id, patients(nama, no_rm, tanggal_lahir), practice_sessions(nama)")
    .eq("id", params.encounterId).maybeSingle();
  const enc = encRaw as unknown as Enc | null;
  if (!enc?.patients) notFound();
  const p = enc.patients;

  if (enc.status === "batal") {
    return (<><PageHeader judul={p.nama} deskripsi="Kunjungan ini dibatalkan." /><Banner jenis="peringatan">Kunjungan dibatalkan, jadi tidak ada tagihan.</Banner></>);
  }

  const { data: invId, error: errSinkron } = await supabase.rpc("sinkron_tagihan", { p_encounter: enc.id, p_jenis: null });
  if (errSinkron || !invId) {
    return (<><PageHeader judul={`Kasir: ${p.nama}`} /><Banner jenis="bahaya">Tagihan belum bisa dibuat. Periksa koneksi internet, lalu muat ulang halaman.</Banner></>);
  }

  const hariIni = hariIniWIB();
  const [invR, itemR, payR, kontrolR] = await Promise.all([
    supabase.from("invoices").select("id, nomor, status, total, jenis_konsultasi, void_alasan").eq("id", invId).single(),
    supabase.from("invoice_items").select("id, jenis, nama, jumlah, harga_satuan, subtotal").eq("invoice_id", invId).order("urutan"),
    supabase.from("payments").select("metode, diterima, kembalian, dibayar_pada").eq("invoice_id", invId).maybeSingle(),
    supabase.from("control_schedules").select("tanggal, practice_sessions(nama)").eq("patient_id", enc.patient_id).eq("status", "terjadwal").gte("tanggal", hariIni).order("tanggal").limit(1),
  ]);
  const inv = invR.data as Inv | null;
  if (!inv) return <Banner jenis="bahaya">Tagihan tidak terbaca.</Banner>;
  const items = (itemR.data ?? []) as Item[];
  const pay = payR.data as Pay | null;
  const kontrol = (kontrolR.data as unknown as { tanggal: string; practice_sessions: { nama: string } | null }[] | null)?.[0];
  const total = Number(inv.total);
  const dokter = profil.role === "dokter";

  return (
    <>
      <PageHeader
        judul={`Kasir: ${p.nama}`}
        deskripsi={`No. RM ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}. ${enc.practice_sessions?.nama}, ${formatTanggal(enc.tanggal)}. Penjamin: ${enc.penjamin === "asuransi" ? "Asuransi" : "Umum"}.`}
        aksi={<Link href="/kasir" className={gayaTombol({ variant: "sekunder" })}>Kembali ke daftar</Link>}
      />

      <div className="space-y-4">
        {searchParams.lunas && <Banner>Pembayaran diterima. Tagihan lunas.</Banner>}
        {searchParams.void && <Banner jenis="peringatan">Tagihan dibatalkan. Anda dapat membuat tagihan baru dengan membuka halaman ini lagi.</Banner>}

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold">{inv.nomor}</span>
          <span className={`rounded-full border-2 px-3 py-0.5 text-sm font-bold ${inv.status === "lunas" ? "border-berhasil text-berhasil" : inv.status === "void" ? "border-bahaya text-bahaya" : "border-peringatan text-peringatan"}`}>
            {inv.status === "lunas" ? "Lunas" : inv.status === "void" ? "Dibatalkan" : "Belum dibayar"}
          </span>
        </div>

        {inv.status === "terbuka" && (
          <div role="group" aria-label="Jenis jasa konsultasi" className="flex flex-wrap items-center gap-2">
            <span className="font-bold">Jasa:</span>
            {TIER.map((t) => (
              <form key={t.kode} action={pilihKonsultasi.bind(null, enc.id, t.kode)}>
                <Button type="submit" variant={inv.jenis_konsultasi === t.kode ? "utama" : "sekunder"} aria-pressed={inv.jenis_konsultasi === t.kode}>{t.label}</Button>
              </form>
            ))}
          </div>
        )}

        <Tabel>
          <caption className="sr-only">Rincian tagihan</caption>
          <thead><tr><Th>Rincian</Th><Th>Jenis</Th><Th>Jumlah</Th><Th>Harga</Th><Th>Subtotal</Th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><Td colSpan={5} className="text-redup">Belum ada rincian biaya.</Td></tr>}
            {items.map((it) => (
              <tr key={it.id}>
                <Td className="font-bold">{it.nama}</Td><Td>{LAB_JENIS[it.jenis]}</Td><Td>{it.jumlah}</Td>
                <Td>{rupiah(Number(it.harga_satuan))}</Td><Td>{rupiah(Number(it.subtotal))}</Td>
              </tr>
            ))}
            <tr><Td colSpan={4} className="text-right text-lg font-bold">Total</Td><Td className="text-lg font-bold">{rupiah(total)}</Td></tr>
          </tbody>
        </Tabel>

        {inv.status === "terbuka" && <FormBayar encounterId={enc.id} invoiceId={inv.id} total={total} />}

        {inv.status === "lunas" && pay && (
          <Card>
            <p className="font-bold">Dibayar dengan {LAB_METODE[pay.metode]}</p>
            {pay.metode === "tunai" && <p className="text-redup">Uang diterima {rupiah(Number(pay.diterima))}, kembalian {rupiah(Number(pay.kembalian))}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/kasir/kuitansi/${inv.id}`} className={gayaTombol({ ukuran: "besar" })}>Cetak kuitansi</Link>
            </div>
          </Card>
        )}
        {inv.status === "void" && <Banner jenis="peringatan">Dibatalkan. Alasan: {inv.void_alasan}</Banner>}

        <Card>
          <h2 className="text-lg font-bold">Jadwal kontrol</h2>
          {kontrol ? <p className="mt-1">Sudah terjadwal: <b>{formatTanggal(kontrol.tanggal, true)}</b>, {kontrol.practice_sessions?.nama}</p> : <p className="mt-1 text-redup">Belum ada jadwal kontrol berikutnya.</p>}
          <Link href={`/kontrol/baru?pasien=${enc.patient_id}&kunjungan=${enc.id}`} className={gayaTombol({ variant: "sekunder", className: "mt-3" })}>
            {kontrol ? "Tambah jadwal lain" : "Atur jadwal kontrol"}
          </Link>
        </Card>

        {dokter && (inv.status === "lunas" || inv.status === "terbuka") && <FormVoid encounterId={enc.id} invoiceId={inv.id} />}
        {!dokter && inv.status === "lunas" && <p className="text-sm text-redup">Untuk membatalkan tagihan yang sudah lunas, hubungi Dokter.</p>}
      </div>
    </>
  );
}
