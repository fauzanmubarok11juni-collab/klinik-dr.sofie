// Semua tanggal/jam memakai zona WIB (Asia/Jakarta), apa pun zona server atau perangkat.
const ZONA = "Asia/Jakarta";

/** Tanggal hari ini di WIB, format YYYY-MM-DD. */
export function hariIniWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

export function jamWIB(): number {
  const j = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" }).format(new Date());
  return parseInt(j, 10);
}

/** Sebelum pukul 13.00 = Sesi Pagi, selebihnya Sesi Malam. */
export function sesiAktif(): "pagi" | "malam" {
  return jamWIB() < 13 ? "pagi" : "malam";
}

/** "+62 812-3456-7890" -> "081234567890" */
export function normalisasiHP(s: string): string {
  let d = (s || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

const adaFormatTanggal = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso);

export function formatTanggal(iso: string, panjang = false): string {
  if (!adaFormatTanggal(iso)) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", {
    timeZone: "UTC",
    weekday: panjang ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "06.15" dari cap waktu ISO. */
export function formatJam(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("id-ID", {
    timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
}

export function hitungUmur(lahir: string, acuan?: string) {
  const [y1, m1, d1] = lahir.split("-").map(Number);
  const [y2, m2, d2] = (acuan ?? hariIniWIB()).split("-").map(Number);
  let tahun = y2 - y1, bulan = m2 - m1, hari = d2 - d1;
  if (hari < 0) {
    bulan--;
    hari += new Date(Date.UTC(y2, m2 - 1, 0)).getUTCDate(); // jumlah hari bulan lalu
  }
  if (bulan < 0) { tahun--; bulan += 12; }
  return { tahun, bulan, hari };
}

/** Umur dalam bahasa awam: bayi dalam hari/bulan, anak dalam tahun+bulan, dewasa dalam tahun. */
export function teksUmur(lahir: string): string {
  if (!adaFormatTanggal(lahir)) return "";
  const { tahun, bulan, hari } = hitungUmur(lahir);
  if (tahun < 0) return "";
  if (tahun >= 18) return `${tahun} tahun`;
  if (tahun >= 2) return bulan ? `${tahun} tahun ${bulan} bulan` : `${tahun} tahun`;
  const totalBulan = tahun * 12 + bulan;
  return totalBulan >= 1 ? `${totalBulan} bulan` : `${hari} hari`;
}

export type KategoriPasien = "anak" | "umum" | "lansia";
export function kategoriPasien(lahir: string): KategoriPasien {
  if (!adaFormatTanggal(lahir)) return "umum";
  const { tahun } = hitungUmur(lahir);
  return tahun < 18 ? "anak" : tahun >= 60 ? "lansia" : "umum";
}

export const LABEL_JK: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

export function rupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
