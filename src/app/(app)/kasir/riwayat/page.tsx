import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { Tabel, Td, Th } from "@/components/ui/table";
import { formatTanggal, hariIniWIB, rupiah } from "@/lib/format";

type Baris = { id: string; nomor: string; tanggal: string; status: string; total: number; patients: { nama: string } | null; payments: { metode: string }[] | { metode: string } | null };
const TGL = /^\d{4}-\d{2}-\d{2}$/;
const LAB_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };

export default async function RiwayatKasir({ searchParams }: { searchParams: { dari?: string; sampai?: string } }) {
  const hariIni = hariIniWIB();
  const awalDefault = new Date(hariIni + "T00:00:00Z"); awalDefault.setUTCDate(awalDefault.getUTCDate() - 6);
  const dari = searchParams.dari && TGL.test(searchParams.dari) ? searchParams.dari : awalDefault.toISOString().slice(0, 10);
  const sampai = searchParams.sampai && TGL.test(searchParams.sampai) ? searchParams.sampai : hariIni;

  const supabase = createClient();
  const { data } = await supabase
    .from("invoices").select("id, nomor, tanggal, status, total, patients(nama), payments(metode)")
    .gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: false }).order("nomor", { ascending: false }).limit(200);
  const baris = (data ?? []) as unknown as Baris[];
  const lunas = baris.filter((b) => b.status === "lunas");
  const total = lunas.reduce((a, b) => a + Number(b.total), 0);
  const metode = (b: Baris) => { const p = Array.isArray(b.payments) ? b.payments[0] : b.payments; return p ? LAB_METODE[p.metode] : "—"; };
  const lab = { lunas: "Lunas", terbuka: "Belum dibayar", void: "Dibatalkan" } as Record<string, string>;

  return (
    <>
      <PageHeader judul="Riwayat transaksi" deskripsi="Semua tagihan pada rentang tanggal. Laporan lengkap ada di menu Laporan (Dokter)."
        aksi={<Link href="/kasir" className={gayaTombol({ variant: "sekunder" })}>Kembali ke kasir</Link>} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div><label htmlFor="dari" className="mb-1 block font-bold">Dari</label>
          <input id="dari" type="date" name="dari" defaultValue={dari} className="min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta" /></div>
        <div><label htmlFor="sampai" className="mb-1 block font-bold">Sampai</label>
          <input id="sampai" type="date" name="sampai" defaultValue={sampai} className="min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta" /></div>
        <button type="submit" className="min-h-[44px] rounded-lg bg-utama px-5 font-bold text-utama-teks">Tampilkan</button>
      </form>

      <div className="mb-4"><Banner>{lunas.length} tagihan lunas, total diterima <b>{rupiah(total)}</b> ({formatTanggal(dari)} s.d. {formatTanggal(sampai)}).</Banner></div>

      <Tabel>
        <caption className="sr-only">Riwayat transaksi</caption>
        <thead><tr><Th>Tanggal</Th><Th>Nomor</Th><Th>Pasien</Th><Th>Metode</Th><Th>Total</Th><Th>Status</Th><Th><span className="sr-only">Buka</span></Th></tr></thead>
        <tbody>
          {baris.length === 0 && <tr><Td colSpan={7} className="text-redup">Tidak ada transaksi pada rentang ini.</Td></tr>}
          {baris.map((b) => (
            <tr key={b.id} className={b.status === "void" ? "opacity-60" : ""}>
              <Td>{formatTanggal(b.tanggal)}</Td><Td>{b.nomor}</Td><Td className="font-bold">{b.patients?.nama ?? "—"}</Td>
              <Td>{metode(b)}</Td><Td>{rupiah(Number(b.total))}</Td><Td>{lab[b.status]}</Td>
              <Td><Link className="font-bold underline" href={b.status === "lunas" || b.status === "void" ? `/kasir/kuitansi/${b.id}` : "/kasir"}>{b.status === "terbuka" ? "Ke kasir" : "Kuitansi"}</Link></Td>
            </tr>
          ))}
        </tbody>
      </Tabel>
      {baris.length === 200 && <p className="mt-3 text-sm text-redup">Menampilkan 200 terbaru. Persempit rentang tanggal.</p>}
    </>
  );
}
