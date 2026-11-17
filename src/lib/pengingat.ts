import { formatTanggal, jamWIB } from "@/lib/format";

export const TEMPLAT_BAWAAN =
  "{sapaan}, {panggilan}.\n" +
  "Kami dari {klinik} mengingatkan jadwal kontrol {tanggal}, {sesi} (jam {jam}).{catatan}\n" +
  "Alamat: {alamat}\n" +
  "Bila perlu mengubah jadwal, silakan hubungi {telepon}.\n" +
  "Terima kasih, semoga lekas sehat.";

export const DAFTAR_PENANDA = ["sapaan", "panggilan", "klinik", "tanggal", "sesi", "jam", "catatan", "alamat", "telepon"];

export function sapaan(jam: number): string {
  return jam < 11 ? "Selamat pagi" : jam < 15 ? "Selamat siang" : jam < 18 ? "Selamat sore" : "Selamat malam";
}

/** "0812-3456-7890" -> "6281234567890" (untuk tautan wa.me). Kosong bila bukan nomor yang masuk akal. */
export function nomorWA(hp: string | null | undefined): string | null {
  if (!hp) return null;
  let d = hp.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return /^62\d{8,13}$/.test(d) ? d : null;
}

export type DataPesan = {
  nama: string; anak: boolean; tanggal: string; sesi: "pagi" | "malam"; jamSesi: string; catatan: string | null;
  klinik: string; alamat: string; telepon: string;
};

/** Mengisi templat. Baris yang semua isiannya kosong (mis. alamat belum diisi) dibuang. */
export function susunPesan(templat: string, d: DataPesan, jam: number = jamWIB()): string {
  const nilai: Record<string, string> = {
    sapaan: sapaan(jam),
    panggilan: d.anak ? `Bapak/Ibu, orang tua dari ${d.nama}` : `Bapak/Ibu ${d.nama}`,
    klinik: d.klinik, tanggal: formatTanggal(d.tanggal, true), sesi: `Sesi ${d.sesi === "pagi" ? "Pagi" : "Malam"}`,
    jam: d.jamSesi, catatan: d.catatan?.trim() ? ` Catatan: ${d.catatan.trim()}` : "", alamat: d.alamat, telepon: d.telepon,
  };
  return templat
    .split("\n")
    .map((baris) => {
      const penanda = baris.match(/\{(\w+)\}/g);
      if (!penanda) return baris;
      if (penanda.every((p) => !(nilai[p.slice(1, -1)] ?? "").trim())) return null;
      return baris.replace(/\{(\w+)\}/g, (_, k: string) => nilai[k] ?? "");
    })
    .filter((b): b is string => b !== null)
    .join("\n")
    .trim();
}

export function jamSesiTeks(mulai: string, selesai: string): string {
  const f = (t: string) => t.slice(0, 5).replace(":", ".");
  return `${f(mulai)}–${f(selesai)}`;
}
