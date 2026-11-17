import type { createClient } from "@/lib/supabase/server";
import { formatTanggal } from "@/lib/format";

type Klien = ReturnType<typeof createClient>;

export type JenisLaporan = "kunjungan" | "pendapatan" | "diagnosis" | "obat" | "kontrol";
export const JENIS_LAPORAN: { kode: JenisLaporan; label: string }[] = [
  { kode: "kunjungan", label: "Kunjungan" },
  { kode: "pendapatan", label: "Pendapatan" },
  { kode: "diagnosis", label: "Diagnosis" },
  { kode: "obat", label: "Obat terjual" },
  { kode: "kontrol", label: "Pasien kontrol" },
];

export type Tipe = "teks" | "angka" | "rp" | "tanggal";
export type Laporan = {
  judul: string; kolom: string[]; tipe: Tipe[]; baris: (string | number)[][]; total?: (string | number | null)[];
  catatan?: string;
};

const TGL = /^\d{4}-\d{2}-\d{2}$/;
const hari = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
const LAB_SESI: Record<string, string> = { pagi: "Pagi", malam: "Malam" };
const LAB_METODE: Record<string, string> = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS" };
const LAB_STATUS: Record<string, string> = { terjadwal: "Terjadwal", datang: "Sudah datang", batal: "Dibatalkan" };
const jumlah = (b: (string | number)[][], i: number) => b.reduce((a, r) => a + Number(r[i] ?? 0), 0);

export function rentangSah(dari: string, sampai: string): string | null {
  if (!TGL.test(dari) || !TGL.test(sampai)) return "Isi tanggal dengan benar.";
  if (dari > sampai) return "Tanggal awal tidak boleh setelah tanggal akhir.";
  if (hari(dari, sampai) > 366) return "Rentang maksimum 1 tahun.";
  return null;
}

export async function ambilLaporan(
  supabase: Klien, jenis: JenisLaporan, dari: string, sampai: string
): Promise<{ laporan?: Laporan; error?: string }> {
  const salah = rentangSah(dari, sampai);
  if (salah) return { error: salah };
  const rentang = `${formatTanggal(dari)} s.d. ${formatTanggal(sampai)}`;
  const gagal = { error: "Laporan belum bisa dimuat. Periksa koneksi internet, lalu coba lagi." };

  if (jenis === "kunjungan") {
    const { data, error } = await supabase.rpc("laporan_kunjungan", { p_dari: dari, p_sampai: sampai });
    if (error) return gagal;
    const r = ((data ?? []) as { tanggal: string; pagi: number; malam: number; selesai: number; batal: number; pasien_baru: number }[])
      .map((x) => [x.tanggal, x.pagi, x.malam, x.pagi + x.malam, x.selesai, x.batal, x.pasien_baru]);
    return { laporan: {
      judul: `Laporan kunjungan, ${rentang}`,
      kolom: ["Tanggal", "Sesi Pagi", "Sesi Malam", "Total", "Selesai", "Batal", "Pasien baru"],
      tipe: ["tanggal", "angka", "angka", "angka", "angka", "angka", "angka"], baris: r,
      total: ["Jumlah", jumlah(r, 1), jumlah(r, 2), jumlah(r, 3), jumlah(r, 4), jumlah(r, 5), jumlah(r, 6)],
      catatan: "Total tidak menghitung kunjungan yang dibatalkan. Pasien baru = kunjungan pertama pasien tersebut.",
    } };
  }

  if (jenis === "pendapatan") {
    if (hari(dari, sampai) > 92) return { error: "Laporan pendapatan maksimum 3 bulan per tampilan." };
    const { data, error } = await supabase.rpc("laporan_pendapatan", { p_dari: dari, p_sampai: sampai });
    if (error) return gagal;
    const r = ((data ?? []) as { tanggal: string; sesi: string; metode: string; transaksi: number; konsultasi: number; tindakan: number; obat: number; total: number }[])
      .map((x) => [x.tanggal, LAB_SESI[x.sesi] ?? x.sesi, LAB_METODE[x.metode] ?? x.metode, x.transaksi, Number(x.konsultasi), Number(x.tindakan), Number(x.obat), Number(x.total)]);
    return { laporan: {
      judul: `Laporan pendapatan, ${rentang}`,
      kolom: ["Tanggal", "Sesi", "Metode", "Transaksi", "Konsultasi", "Tindakan", "Obat", "Total"],
      tipe: ["tanggal", "teks", "teks", "angka", "rp", "rp", "rp", "rp"], baris: r,
      total: ["Jumlah", null, null, jumlah(r, 3), jumlah(r, 4), jumlah(r, 5), jumlah(r, 6), jumlah(r, 7)],
      catatan: "Hanya tagihan LUNAS (yang dibatalkan tidak dihitung). Dihitung menurut tanggal kunjungan.",
    } };
  }

  if (jenis === "diagnosis") {
    const { data, error } = await supabase.rpc("laporan_diagnosis", { p_dari: dari, p_sampai: sampai, p_limit: 50 });
    if (error) return gagal;
    const r = ((data ?? []) as { kode: string; nama: string; jumlah: number; sebagai_utama: number }[]).map((x) => [x.kode, x.nama, x.jumlah, x.sebagai_utama]);
    return { laporan: {
      judul: `Diagnosis terbanyak, ${rentang}`, kolom: ["Kode", "Diagnosis", "Jumlah", "Sebagai utama"],
      tipe: ["teks", "teks", "angka", "angka"], baris: r, catatan: "50 diagnosis teratas. Kunjungan yang dibatalkan tidak dihitung.",
    } };
  }

  if (jenis === "obat") {
    const { data, error } = await supabase.rpc("laporan_obat", { p_dari: dari, p_sampai: sampai });
    if (error) return gagal;
    const r = ((data ?? []) as { nama: string; jumlah: number; nilai: number; stok_sekarang: number }[]).map((x) => [x.nama, x.jumlah, Number(x.nilai), x.stok_sekarang]);
    return { laporan: {
      judul: `Pemakaian obat yang dijual di klinik, ${rentang}`, kolom: ["Obat", "Jumlah terjual", "Nilai penjualan", "Stok sekarang"],
      tipe: ["teks", "angka", "rp", "angka"], baris: r, total: ["Jumlah", null, jumlah(r, 2), null],
    } };
  }

  // kontrol
  if (hari(dari, sampai) > 92) return { error: "Laporan kontrol maksimum 3 bulan per tampilan." };
  const { data, error } = await supabase
    .from("control_schedules")
    .select("tanggal, status, catatan, patients(nama, no_rm), practice_sessions(kode)")
    .gte("tanggal", dari).lte("tanggal", sampai).order("tanggal").limit(900);
  if (error) return gagal;
  const r = ((data ?? []) as unknown as { tanggal: string; status: string; catatan: string | null; patients: { nama: string; no_rm: string } | null; practice_sessions: { kode: string } | null }[])
    .map((x) => [x.tanggal, x.patients?.nama ?? "—", x.patients?.no_rm ?? "—", LAB_SESI[x.practice_sessions?.kode ?? ""] ?? "—", LAB_STATUS[x.status] ?? x.status, x.catatan ?? ""]);
  return { laporan: {
    judul: `Jadwal kontrol pasien, ${rentang}`, kolom: ["Tanggal kontrol", "Pasien", "No. RM", "Sesi", "Status", "Catatan"],
    tipe: ["tanggal", "teks", "teks", "teks", "teks", "teks"], baris: r,
  } };
}

export function nilaiSel(v: string | number | null, t: Tipe): string {
  if (v === null || v === undefined || v === "") return "";
  if (t === "tanggal") return formatTanggal(String(v));
  if (t === "rp") return "Rp" + Math.round(Number(v)).toLocaleString("id-ID");
  if (t === "angka") return Number(v).toLocaleString("id-ID");
  return String(v);
}
