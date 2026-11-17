// Perhitungan Z-score standar pertumbuhan WHO (metode LMS) dan klasifikasi status gizi (Permenkes No. 2 Tahun 2020).
// Tabel L, M, S TIDAK disertakan di sini: diimpor dari tabel resmi WHO lewat Pengaturan > Data WHO.

export type Indikator = "wfa" | "hfa" | "wfl" | "wfh" | "bmi" | "hca";
export type LMS = { l: number; m: number; s: number };
export type LMSRow = LMS & { kunci: number };
export type Tingkat = "normal" | "perhatian" | "bahaya" | "info";

export const META: Record<Indikator, { label: string; singkat: string; satuan: string; sumbuX: "umur" | "tinggi"; sesuaikan: boolean; wajar: [number, number] }> = {
  wfa: { label: "Berat badan menurut umur", singkat: "BB/U", satuan: "kg", sumbuX: "umur", sesuaikan: true, wajar: [-6, 5] },
  hfa: { label: "Panjang/tinggi badan menurut umur", singkat: "PB/U atau TB/U", satuan: "cm", sumbuX: "umur", sesuaikan: false, wajar: [-6, 6] },
  wfl: { label: "Berat badan menurut panjang badan", singkat: "BB/PB", satuan: "kg", sumbuX: "tinggi", sesuaikan: true, wajar: [-5, 5] },
  wfh: { label: "Berat badan menurut tinggi badan", singkat: "BB/TB", satuan: "kg", sumbuX: "tinggi", sesuaikan: true, wajar: [-5, 5] },
  bmi: { label: "Indeks massa tubuh menurut umur", singkat: "IMT/U", satuan: "kg/m²", sumbuX: "umur", sesuaikan: true, wajar: [-5, 5] },
  hca: { label: "Lingkar kepala menurut umur", singkat: "LK/U", satuan: "cm", sumbuX: "umur", sesuaikan: false, wajar: [-5, 5] },
};
export const URUT_INDIKATOR: Indikator[] = ["wfa", "hfa", "wfl", "wfh", "bmi", "hca"];

/** Umur dalam bulan desimal (hari / 30,4375). */
export function umurBulanDesimal(lahir: string, tanggal: string): number {
  const hari = (Date.parse(tanggal + "T00:00:00Z") - Date.parse(lahir + "T00:00:00Z")) / 86400000;
  return Math.max(0, Math.round((hari / 30.4375) * 100) / 100);
}

export function teksUmurBulan(bulan: number): string {
  const b = Math.floor(bulan + 1e-9);
  if (b < 24) return `${b} bulan`;
  const th = Math.floor(b / 12), sisa = b % 12;
  return sisa ? `${th} tahun ${sisa} bulan` : `${th} tahun`;
}

/** WHO: di bawah 24 bulan diukur berbaring (panjang), 24 bulan ke atas berdiri (tinggi). Selisih konvensi 0,7 cm. */
export function panjangTinggiTerkoreksi(tb: number, umurBulan: number, cara: "berbaring" | "berdiri" | null): number {
  if (cara === "berdiri" && umurBulan < 24) return tb + 0.7;
  if (cara === "berbaring" && umurBulan >= 24) return tb - 0.7;
  return tb;
}

/** Indikator yang berlaku untuk umur tertentu (WHO 2006 untuk 0–5 tahun, WHO 2007 untuk 5–19 tahun). */
export function indikatorBerlaku(umurBulan: number): Indikator[] {
  if (umurBulan <= 60) return ["wfa", "hfa", umurBulan < 24 ? "wfl" : "wfh", "bmi", "hca"];
  const r: Indikator[] = [];
  if (umurBulan <= 120) r.push("wfa");
  if (umurBulan <= 228) r.push("hfa", "bmi");
  return r;
}

export type Pengukuran = { bb: number | null; tb: number | null; lk: number | null; cara: "berbaring" | "berdiri" | null; umurBulan: number };

/** Nilai yang diukur (y) dan kuncinya pada tabel (umur atau panjang/tinggi) untuk satu indikator. */
export function nilaiIndikator(ind: Indikator, p: Pengukuran): { y: number; kunci: number } | null {
  const tbk = p.tb !== null ? panjangTinggiTerkoreksi(p.tb, p.umurBulan, p.cara) : null;
  switch (ind) {
    case "wfa": return p.bb !== null ? { y: p.bb, kunci: p.umurBulan } : null;
    case "hfa": return tbk !== null ? { y: tbk, kunci: p.umurBulan } : null;
    case "wfl": case "wfh": return p.bb !== null && tbk !== null ? { y: p.bb, kunci: tbk } : null;
    case "bmi": return p.bb !== null && tbk !== null ? { y: p.bb / Math.pow(tbk / 100, 2), kunci: p.umurBulan } : null;
    case "hca": return p.lk !== null ? { y: p.lk, kunci: p.umurBulan } : null;
  }
}

/** Interpolasi linear L, M, S antar baris tabel. Null bila di luar rentang tabel. */
export function interpolasi(rows: LMSRow[], k: number): LMS | null {
  if (rows.length === 0) return null;
  if (k < rows[0].kunci - 1e-9 || k > rows[rows.length - 1].kunci + 1e-9) return null;
  let i = 0;
  while (i < rows.length - 1 && rows[i + 1].kunci <= k) i++;
  const lo = rows[i], hi = rows[Math.min(i + 1, rows.length - 1)];
  if (hi.kunci === lo.kunci || k <= lo.kunci) return { l: lo.l, m: lo.m, s: lo.s };
  const t = (k - lo.kunci) / (hi.kunci - lo.kunci);
  return { l: lo.l + t * (hi.l - lo.l), m: lo.m + t * (hi.m - lo.m), s: lo.s + t * (hi.s - lo.s) };
}

/** Nilai y pada Z-score tertentu: y = M(1 + L·S·z)^(1/L). */
export function nilaiPadaZ(z: number, p: LMS): number {
  return p.l === 0 ? p.m * Math.exp(p.s * z) : p.m * Math.pow(1 + p.l * p.s * z, 1 / p.l);
}

/**
 * Z-score metode LMS. Bila `sesuaikan` (BB/U, BB/PB, BB/TB, IMT/U), nilai di luar ±3 SD dihitung dengan
 * koreksi WHO (perluasan linear dari ±2 SD ke ±3 SD).
 */
export function zScore(y: number, p: LMS, sesuaikan: boolean): number {
  const z = p.l === 0 ? Math.log(y / p.m) / p.s : (Math.pow(y / p.m, p.l) - 1) / (p.l * p.s);
  if (!sesuaikan || Math.abs(z) <= 3) return z;
  if (z > 3) { const sd3 = nilaiPadaZ(3, p), sd2 = nilaiPadaZ(2, p); return 3 + (y - sd3) / (sd3 - sd2); }
  const sd3n = nilaiPadaZ(-3, p), sd2n = nilaiPadaZ(-2, p);
  return -3 + (y - sd3n) / (sd2n - sd3n);
}

export const tidakWajar = (ind: Indikator, z: number) => z < META[ind].wajar[0] || z > META[ind].wajar[1];

/** Kategori status gizi dan pertumbuhan menurut Permenkes No. 2 Tahun 2020 (lingkar kepala: batas ±2 SD WHO). */
export function klasifikasi(ind: Indikator, z: number, umurBulan: number): { label: string; tingkat: Tingkat } {
  switch (ind) {
    case "wfa":
      if (z < -3) return { label: "Berat badan sangat kurang", tingkat: "bahaya" };
      if (z < -2) return { label: "Berat badan kurang", tingkat: "perhatian" };
      if (z <= 1) return { label: "Berat badan normal", tingkat: "normal" };
      return { label: "Risiko berat badan lebih", tingkat: "perhatian" };
    case "hfa":
      if (z < -3) return { label: "Sangat pendek (stunting berat)", tingkat: "bahaya" };
      if (z < -2) return { label: "Pendek (stunting)", tingkat: "perhatian" };
      if (z <= 3) return { label: "Tinggi badan normal", tingkat: "normal" };
      return { label: "Tinggi", tingkat: "info" };
    case "wfl": case "wfh":
      return gizi(z, true);
    case "bmi":
      return gizi(z, umurBulan <= 60);
    case "hca":
      if (z < -2) return { label: "Lingkar kepala kecil (di bawah -2 SD)", tingkat: "perhatian" };
      if (z > 2) return { label: "Lingkar kepala besar (di atas +2 SD)", tingkat: "perhatian" };
      return { label: "Lingkar kepala normal", tingkat: "normal" };
  }
}

// Balita (0–60 bulan): gizi lebih bertingkat. Usia 5–18 tahun: gizi lebih dan obesitas.
function gizi(z: number, balita: boolean): { label: string; tingkat: Tingkat } {
  if (z < -3) return { label: "Gizi buruk", tingkat: "bahaya" };
  if (z < -2) return { label: "Gizi kurang", tingkat: "perhatian" };
  if (z <= 1) return { label: "Gizi baik (normal)", tingkat: "normal" };
  if (balita) {
    if (z <= 2) return { label: "Berisiko gizi lebih", tingkat: "perhatian" };
    if (z <= 3) return { label: "Gizi lebih", tingkat: "perhatian" };
    return { label: "Obesitas", tingkat: "bahaya" };
  }
  if (z <= 2) return { label: "Gizi lebih", tingkat: "perhatian" };
  return { label: "Obesitas", tingkat: "bahaya" };
}

export const fmtZ = (z: number) => `${z < 0 ? "−" : z > 0 ? "+" : ""}${Math.abs(z).toFixed(1).replace(".", ",")} SD`;

/** Kurva SD (−3, −2, 0, +2, +3) dari baris tabel LMS. */
export const GARIS_Z = [-3, -2, 0, 2, 3] as const;
export function kurvaDariTabel(rows: LMSRow[]) {
  return GARIS_Z.map((z) => ({ z, titik: rows.map((r) => ({ x: r.kunci, y: nilaiPadaZ(z, r) })) }));
}
