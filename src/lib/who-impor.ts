// Penguraian tabel WHO (L, M, S) yang disalin dari Excel atau diunggah sebagai CSV. Fungsi murni.
import type { Indikator } from "@/lib/who";

export type BarisLMS = { kunci: number; l: number; m: number; s: number };

const UMUR = ["month", "months", "bulan", "age", "umur"];
const TINGGI = ["length", "height", "panjang", "tinggi"];
const HARI = ["day", "days", "hari"];

export const HARAPAN: Record<Indikator, { label: string; kunci: "umur" | "tinggi"; min: number; max: number; petunjuk: string }> = {
  wfa: { label: "Berat badan menurut umur (BB/U)", kunci: "umur", min: 0, max: 120, petunjuk: "Impor tabel 0–5 tahun, lalu tabel 5–10 tahun." },
  hfa: { label: "Panjang/tinggi badan menurut umur (PB/U, TB/U)", kunci: "umur", min: 0, max: 228, petunjuk: "Impor tabel 0–5 tahun, lalu tabel 5–19 tahun." },
  wfl: { label: "Berat badan menurut panjang badan (BB/PB), 0–2 tahun", kunci: "tinggi", min: 45, max: 110, petunjuk: "Kolom kunci: Length (cm)." },
  wfh: { label: "Berat badan menurut tinggi badan (BB/TB), 2–5 tahun", kunci: "tinggi", min: 65, max: 120, petunjuk: "Kolom kunci: Height (cm)." },
  bmi: { label: "Indeks massa tubuh menurut umur (IMT/U)", kunci: "umur", min: 0, max: 228, petunjuk: "Impor tabel 0–5 tahun, lalu tabel 5–19 tahun." },
  hca: { label: "Lingkar kepala menurut umur (LK/U), 0–5 tahun", kunci: "umur", min: 0, max: 60, petunjuk: "Hanya sampai 5 tahun." },
};

export function parseLMS(teks: string, ind: Indikator): { baris: BarisLMS[]; error?: string; peringatan: string[] } {
  const peringatan: string[] = [];
  const garis = teks.replace(/\r/g, "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (garis.length === 0) return { baris: [], error: "Belum ada data. Tempel isi tabel atau pilih berkas CSV.", peringatan };

  const pemisah = garis.some((g) => g.includes("\t")) ? "\t" : garis.some((g) => g.includes(";")) ? ";" : ",";
  const pecah = (g: string) => g.split(pemisah).map((x) => x.trim().replace(/^"|"$/g, ""));
  const num = (x: string | undefined) => {
    if (x === undefined) return NaN;
    let t = x.replace(/\s/g, "");
    if (pemisah !== ",") t = t.replace(",", ".");
    return t === "" ? NaN : Number(t);
  };

  let mulai = 0, iKey = 0, iL = 1, iM = 2, iS = 3;
  let jenisKunci: "umur" | "tinggi" | null = null;
  let adaHeader = false;
  for (let i = 0; i < Math.min(garis.length, 15); i++) {
    const t = pecah(garis[i]).map((x) => x.toLowerCase());
    const l = t.indexOf("l"), m = t.indexOf("m"), s = t.indexOf("s");
    if (l >= 0 && m >= 0 && s >= 0) {
      adaHeader = true; mulai = i + 1; iL = l; iM = m; iS = s;
      const k = t.findIndex((x) => UMUR.includes(x) || TINGGI.includes(x) || HARI.includes(x));
      if (k < 0) return { baris: [], error: "Kolom kunci tidak ditemukan. Sertakan kolom Month (umur) atau Length/Height (cm) bersama kolom L, M, S.", peringatan };
      if (HARI.includes(t[k])) return { baris: [], error: "Tabel ini per HARI. Gunakan tabel per BULAN (kolom Month), bukan tabel per hari.", peringatan };
      iKey = k; jenisKunci = TINGGI.includes(t[k]) ? "tinggi" : "umur";
      break;
    }
  }

  const harap = HARAPAN[ind];
  if (jenisKunci && jenisKunci !== harap.kunci) {
    return { baris: [], error: `Kolom kunci tabel ini ${jenisKunci === "umur" ? "umur (Month)" : "panjang/tinggi (cm)"}, tetapi indikator yang dipilih memakai ${harap.kunci === "umur" ? "umur" : "panjang/tinggi badan"}. Periksa pilihan indikator.`, peringatan };
  }

  const peta = new Map<number, BarisLMS>();
  for (let i = mulai; i < garis.length; i++) {
    const t = pecah(garis[i]);
    const kunci = num(t[iKey]), l = num(t[iL]), m = num(t[iM]), s = num(t[iS]);
    if (![kunci, l, m, s].every(Number.isFinite) || m <= 0 || s <= 0) continue; // baris judul/keterangan dilewati
    peta.set(Math.round(kunci * 100) / 100, { kunci: Math.round(kunci * 100) / 100, l, m, s });
  }
  const baris = Array.from(peta.values()).sort((a, b) => a.kunci - b.kunci);
  if (baris.length < 10) return { baris: [], error: `Hanya ${baris.length} baris angka yang terbaca. Pastikan menyalin kolom ${harap.kunci === "umur" ? "Month" : "Length/Height"}, L, M, dan S.`, peringatan };

  const lo = baris[0].kunci, hi = baris[baris.length - 1].kunci;
  if (harap.kunci === "umur" && (lo < 0 || hi > 240)) return { baris: [], error: "Nilai kunci di luar rentang umur 0–240 bulan. Apakah ini tabel panjang/tinggi badan?", peringatan };
  if (harap.kunci === "tinggi" && (lo < 40 || hi > 135)) return { baris: [], error: "Nilai kunci di luar rentang panjang/tinggi 40–135 cm. Apakah ini tabel menurut umur?", peringatan };
  if (baris.some((b) => b.s < 0.01 || b.s > 0.5)) peringatan.push("Ada nilai S di luar kisaran umum (0,01–0,5). Periksa kolom yang disalin.");
  if (baris.some((b) => Math.abs(b.l) > 6)) peringatan.push("Ada nilai L di luar kisaran umum (−6 sampai 6). Periksa kolom yang disalin.");
  if (!adaHeader) peringatan.push("Judul kolom tidak ditemukan; kolom dianggap berurutan: kunci, L, M, S.");
  return { baris, peringatan };
}
