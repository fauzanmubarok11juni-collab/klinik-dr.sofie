import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { Tabel, Td, Th } from "@/components/ui/table";
import { formatTanggal, hariIniWIB, rupiah } from "@/lib/format";
import { bulanTahun } from "@/lib/obat";
import { muatStokBermasalah, type StokBermasalah } from "@/lib/obat-server";
import { FormStok } from "./form-stok";

type Med = { id: string; nama: string; kekuatan: string; sediaan: string; satuan: string; stok_saat_ini: number; stok_minimum: number; tanggal_expired: string | null; harga_jual: number };
type Mv = { id: string; tipe: string; jumlah: number; tanggal: string; catatan: string | null; stok_sesudah: number | null; medicines: { nama: string; kekuatan: string } | null };

export default async function StokObat() {
  const supabase = createClient();
  const hariIni = hariIniWIB();
  const [{ data: m }, { data: mv }, bermasalah] = await Promise.all([
    supabase.from("medicines").select("id, nama, kekuatan, sediaan, satuan, stok_saat_ini, stok_minimum, tanggal_expired, harga_jual").eq("dijual", true).eq("aktif", true).order("nama"),
    supabase.from("medicine_stock_movements").select("id, tipe, jumlah, tanggal, catatan, stok_sesudah, medicines(nama, kekuatan)").order("created_at", { ascending: false }).limit(15),
    muatStokBermasalah(supabase, hariIni),
  ]);
  const meds = (m ?? []) as Med[];
  const bad = new Map<string, StokBermasalah["status"]>();
  for (const b of bermasalah) bad.set(b.id, b.status);
  const label = { habis: "Habis", menipis: "Di bawah minimum", kedaluwarsa: "Kedaluwarsa", segera: "Segera kedaluwarsa" } as const;

  return (
    <>
      <PageHeader judul="Stok obat" deskripsi="Obat yang dijual di klinik. Stok berkurang otomatis saat penjualan dicatat." />
      {bermasalah.length > 0 && (
        <div className="mb-4"><Banner jenis="peringatan">{bermasalah.length} obat perlu perhatian (ditandai di tabel). Ini hanya peringatan; penjualan tidak diblokir.</Banner></div>
      )}
      <FormStok hariIni={hariIni} />

      <h2 className="mb-3 mt-8 text-lg font-bold">Daftar stok</h2>
      <Tabel>
        <caption className="sr-only">Daftar stok obat</caption>
        <thead><tr><Th>Obat</Th><Th>Stok</Th><Th>Minimum</Th><Th>Kedaluwarsa</Th><Th>Harga</Th><Th>Keterangan</Th></tr></thead>
        <tbody>
          {meds.map((x) => (
            <tr key={x.id}>
              <Td className="font-bold">{[x.nama, x.kekuatan, x.sediaan].filter(Boolean).join(" ")}</Td>
              <Td>{x.stok_saat_ini} {x.satuan}</Td>
              <Td>{x.stok_minimum}</Td>
              <Td>{bulanTahun(x.tanggal_expired)}</Td>
              <Td>{rupiah(Number(x.harga_jual))}</Td>
              <Td>{(bad.get(x.id) ?? []).map((s) => label[s]).join(", ") || "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Tabel>

      <h2 className="mb-3 mt-8 text-lg font-bold">Riwayat stok terbaru</h2>
      <Tabel>
        <caption className="sr-only">Riwayat stok masuk dan keluar</caption>
        <thead><tr><Th>Tanggal</Th><Th>Obat</Th><Th>Jenis</Th><Th>Jumlah</Th><Th>Stok sesudah</Th><Th>Catatan</Th></tr></thead>
        <tbody>
          {((mv ?? []) as unknown as Mv[]).map((r) => (
            <tr key={r.id}>
              <Td>{formatTanggal(r.tanggal)}</Td>
              <Td>{r.medicines ? `${r.medicines.nama} ${r.medicines.kekuatan}` : "—"}</Td>
              <Td>{r.tipe === "masuk" ? "Masuk" : "Keluar"}</Td>
              <Td>{r.jumlah}</Td>
              <Td>{r.stok_sesudah ?? "—"}</Td>
              <Td>{r.catatan ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Tabel>
    </>
  );
}
