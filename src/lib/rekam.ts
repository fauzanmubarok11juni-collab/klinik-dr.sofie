// Tipe dan aturan rekam medis. Dipakai di layar (client) dan server, supaya aturannya sama.

export type Soap = { subjective: string; objective: string; assessment: string; plan: string; catatan: string };

export type Vital = {
  td_sistolik: string; td_diastolik: string; nadi: string; rr: string;
  suhu: string; spo2: string; bb: string; tb: string; lingkar_perut: string;
};
export type KunciVital = keyof Vital;

export type DxItem = { kode: string; nama: string; utama: boolean };
export type SvcItem = { service_id: string; nama: string; tarif: number; jumlah: number };
export type DataRekam = { soap: Soap; vitals: Vital; diagnoses: DxItem[]; services: SvcItem[] };

export type TemplateIsi = { subjective: string; objective: string; assessment: string; plan: string };
export type TemplateRow = { mode: "pagi" | "malam"; pribadi: boolean; isi: TemplateIsi };

export const SOAP_KOSONG: Soap = { subjective: "", objective: "", assessment: "", plan: "", catatan: "" };
export const VITAL_KOSONG: Vital = {
  td_sistolik: "", td_diastolik: "", nadi: "", rr: "", suhu: "", spo2: "", bb: "", tb: "", lingkar_perut: "",
};

export const MAKS_TEKS = 8000;
export const MAKS_DIAGNOSIS = 10;

// Batas "masuk akal" (sama dengan batasan di database). Bukan batas normal medis.
export const BATAS_VITAL: Record<KunciVital, { min: number; max: number; nama: string; bulat: boolean }> = {
  td_sistolik: { min: 40, max: 300, nama: "Tekanan darah atas", bulat: true },
  td_diastolik: { min: 20, max: 200, nama: "Tekanan darah bawah", bulat: true },
  nadi: { min: 20, max: 300, nama: "Nadi", bulat: true },
  rr: { min: 5, max: 100, nama: "Napas", bulat: true },
  suhu: { min: 30, max: 45, nama: "Suhu", bulat: false },
  spo2: { min: 50, max: 100, nama: "SpO2", bulat: true },
  bb: { min: 0.3, max: 400, nama: "Berat badan", bulat: false },
  tb: { min: 20, max: 250, nama: "Tinggi badan", bulat: false },
  lingkar_perut: { min: 10, max: 300, nama: "Lingkar perut", bulat: false },
};

/** "36,8" atau "36.8" -> 36.8.  Kosong -> null.  Bukan angka -> NaN. */
export function angka(s: string): number | null {
  const t = (s ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Pesan kesalahan per kolom (hanya untuk isian yang tidak masuk akal). */
export function cekVital(v: Vital): Partial<Record<KunciVital, string>> {
  const e: Partial<Record<KunciVital, string>> = {};
  (Object.keys(BATAS_VITAL) as KunciVital[]).forEach((k) => {
    const n = angka(v[k]);
    if (n === null) return;
    const b = BATAS_VITAL[k];
    if (Number.isNaN(n) || n < b.min || n > b.max) e[k] = `${b.nama} tampaknya salah (isi ${b.min}–${b.max}).`;
  });
  const s = angka(v.td_sistolik), d = angka(v.td_diastolik);
  if (s !== null && d !== null && !Number.isNaN(s) && !Number.isNaN(d) && d >= s && !e.td_diastolik) {
    e.td_diastolik = "Angka bawah harus lebih kecil dari angka atas.";
  }
  return e;
}

export function hitungBMI(bb: string, tb: string): number | null {
  const b = angka(bb), t = angka(tb);
  if (b === null || t === null || Number.isNaN(b) || Number.isNaN(t) || t <= 0 || b <= 0) return null;
  return Math.round((b / Math.pow(t / 100, 2)) * 10) / 10;
}

/** Kategori IMT dewasa menurut Kemenkes RI. Hanya untuk usia 18 tahun ke atas. */
export function kategoriBMI(bmi: number): string {
  if (bmi < 17) return "Kurus (berat)";
  if (bmi < 18.5) return "Kurus (ringan)";
  if (bmi <= 25) return "Normal";
  if (bmi <= 27) return "Gemuk (ringan)";
  return "Obesitas";
}

/** Tanda ringan agar dokter cepat melihat angka yang menyimpang. Hanya petunjuk, tidak memblokir apa pun. */
export function tandaVital(v: Vital, dewasa: boolean): Partial<Record<KunciVital, string>> {
  const t: Partial<Record<KunciVital, string>> = {};
  const n = (k: KunciVital) => { const x = angka(v[k]); return x === null || Number.isNaN(x) ? null : x; };
  const suhu = n("suhu"), spo2 = n("spo2"), sis = n("td_sistolik"), dia = n("td_diastolik"), nadi = n("nadi"), rr = n("rr");
  if (suhu !== null && suhu >= 37.5) t.suhu = "Demam";
  if (spo2 !== null && spo2 < 95) t.spo2 = "Rendah";
  if (dewasa) {
    if ((sis !== null && sis >= 140) || (dia !== null && dia >= 90)) t.td_sistolik = "Tinggi";
    if ((sis !== null && sis < 90) || (dia !== null && dia < 60)) t.td_sistolik = "Rendah";
    if (nadi !== null && (nadi < 60 || nadi > 100)) t.nadi = nadi < 60 ? "Lambat" : "Cepat";
    if (rr !== null && rr > 20) t.rr = "Cepat";
  }
  return t;
}

export function adaIsiSoap(s: Soap): boolean {
  return [s.subjective, s.objective, s.assessment, s.plan, s.catatan].some((x) => x.trim() !== "");
}

/** Awal bagian Subjective: keluhan dari pendaftaran + isi template. */
export function gabungKeluhan(keluhan: string | null, subjective: string): string {
  const k = (keluhan ?? "").trim();
  return k ? `Keluhan utama: ${k}\n${subjective}` : subjective;
}
