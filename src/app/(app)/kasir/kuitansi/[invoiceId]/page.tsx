import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { PageHeader } from "@/components/page-header";
import { TombolCetak } from "@/components/tombol-cetak";
import { formatJam, formatTanggal, rupiah } from "@/lib/format";

type Inv = {
  id: string; nomor: string; tanggal: string; status: string; total: number; encounter_id: string; void_alasan: string | null;
  patients: { nama: string; no_rm: string } | null;
};
type Item = { id: string; jenis: string; nama: string; jumlah: number; harga_satuan: number; subtotal: number };
type Pay = { metode: string; diterima: number; kembalian: number; dibayar_pada: string };
const LAB_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };

export default async function Kuitansi({ params }: { params: { invoiceId: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("invoices").select("id, nomor, tanggal, status, total, encounter_id, void_alasan, patients(nama, no_rm)").eq("id", params.invoiceId).maybeSingle();
  const inv = data as unknown as Inv | null;
  if (!inv?.patients) notFound();
  const [itemR, payR, klinik] = await Promise.all([
    supabase.from("invoice_items").select("id, jenis, nama, jumlah, harga_satuan, subtotal").eq("invoice_id", inv.id).order("urutan"),
    supabase.from("payments").select("metode, diterima, kembalian, dibayar_pada").eq("invoice_id", inv.id).maybeSingle(),
    ambilInfoKlinik(),
  ]);
  const items = (itemR.data ?? []) as Item[];
  const pay = payR.data as Pay | null;

  return (
    <>
      <div className="no-print">
        <PageHeader judul="Kuitansi" deskripsi="Pada jendela cetak, pilih kertas A5 atau A4 dengan skala 100%." />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TombolCetak label="Cetak kuitansi" />
          <Link href={`/kasir/${inv.encounter_id}`} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Kembali</Link>
        </div>
      </div>

      <article className="resep-cetak kuitansi" aria-label={`Kuitansi ${inv.nomor}`}>
        {inv.status === "void" && <p className="kuitansi-void">DIBATALKAN</p>}
        <header className="resep-kop">
          <p className="resep-klinik">{klinik.nama}</p>
          {klinik.alamat && <p>{klinik.alamat}</p>}
          {klinik.telepon && <p>Telp/WA: {klinik.telepon}</p>}
        </header>
        <p className="text-center text-lg font-bold">KUITANSI</p>
        <section className="resep-pasien">
          <p><span className="resep-label">Nomor</span> {inv.nomor}</p>
          <p><span className="resep-label">Tanggal</span> {formatTanggal(inv.tanggal)}</p>
          <p><span className="resep-label">Pasien</span> <b>{inv.patients.nama}</b> ({inv.patients.no_rm})</p>
        </section>

        <table className="kuitansi-tabel">
          <thead><tr><th>Rincian</th><th>Jml</th><th>Harga</th><th>Subtotal</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}><td>{it.nama}</td><td>{it.jumlah}</td><td>{rupiah(Number(it.harga_satuan))}</td><td>{rupiah(Number(it.subtotal))}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}><b>Total</b></td><td><b>{rupiah(Number(inv.total))}</b></td></tr></tfoot>
        </table>

        {pay && (
          <p className="mt-3">
            Dibayar dengan <b>{LAB_METODE[pay.metode]}</b> pada {formatTanggal(pay.dibayar_pada.slice(0, 10))} pukul {formatJam(pay.dibayar_pada)}.
            {pay.metode === "tunai" ? ` Diterima ${rupiah(Number(pay.diterima))}, kembalian ${rupiah(Number(pay.kembalian))}.` : ""}
          </p>
        )}
        {inv.status === "void" && <p className="mt-2">Alasan pembatalan: {inv.void_alasan}</p>}
        <p className="mt-6 text-center">Terima kasih. Semoga lekas sehat.</p>
      </article>
    </>
  );
}
