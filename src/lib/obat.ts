// Tipe dan aturan obat/resep. Dipakai di layar dan server agar hasilnya sama.
import { angka } from "@/lib/rekam";

export type Aturan = { kode: string; label: string; kali: number | null; kaliMaks?: number; topikal?: boolean };

// Bahasa awam, bukan singkatan medis.
export const ATURAN: Aturan[] = [
  { kode: "s1", label: "1× sehari setelah makan", kali: 1 },
  { kode: "s2", label: "2× sehari setelah makan", kali: 2 },
  { kode: "s3", label: "3× sehari setelah makan", kali: 3 },
  { kode: "b2", label: "2× sehari sebelum makan", kali: 2 },
  { kode: "b3", label: "3× sehari sebelum makan", kali: 3 },
  { kode: "p1", label: "1× sehari pada pagi hari", kali: 1 },
  { kode: "m1", label: "1× sehari pada malam hari", kali: 1 },
  { kode: "t1", label: "1× malam sebelum tidur", kali: 1 },
  { kode: "e4", label: "4× sehari", kali: 4 },
  { kode: "j12", label: "Setiap 12 jam", kali: 2 },
  { kode: "j8", label: "Setiap 8 jam", kali: 3 },
  { kode: "j6", label: "Setiap 6 jam", kali: 4 },
  { kode: "pn", label: "Bila perlu (demam atau nyeri), jarak minimal 6 jam", kali: null, kaliMaks: 4 },
  { kode: "ol2", label: "Dioleskan tipis 2× sehari", kali: 2, topikal: true },
  { kode: "ol3", label: "Dioleskan tipis 3× sehari", kali: 3, topikal: true },
  { kode: "lain", label: "Lainnya (tulis sendiri)", kali: null },
];
export const cariAturan = (kode: string) => ATURAN.find((a) => a.kode === kode);

export type MedInfo = {
  id: string; nama: string; kekuatan: string; sediaan: string; kekuatan_mg: number | null;
  satuan: string; satuan_dosis: string; harga_jual: number; stok_saat_ini: number; stok_minimum: number;
  tanggal_expired: string | null; dijual: boolean;
};

/** Satu baris obat pada resep atau penjualan. Semua isian berupa teks agar mudah diketik. */
export type ItemObat = {
  uid: string;
  medicine_id: string | null;     // kosong = obat di luar daftar (diketik manual)
  nama: string;
  sediaan: string;
  satuan: string;                 // satuan yang diserahkan: tablet, botol, tube
  satuan_dosis: string;           // satuan sekali pakai: tablet, ml, oles
  per_pakai: string;
  aturan_kode: string;
  aturan_bebas: string;
  lama_hari: string;
  jumlah: string;
  jumlah_manual: boolean;
  catatan: string;
  harga_satuan?: number;
  stok?: number;
  expired?: string | null;
};

export type ResepState = { catatan: string; items: ItemObat[] };

export type Peringatan = {
  jenis: "alergi" | "interaksi" | "dosis" | "lansia" | "duplikat" | "stok" | "info";
  merah: boolean;
  pesan: string;
};
export type ItemCek = {
  sumber: "resep" | "jual";
  medicine_id: string | null;
  per_pakai: number | null;
  kali: number | null;
  prn: boolean;
  jumlah: number | null;
};

let hitungUid = 0;
export const uidBaru = () => `u${Date.now().toString(36)}${(hitungUid++).toString(36)}`;

export const namaObat = (m: Pick<MedInfo, "nama" | "kekuatan" | "sediaan">) =>
  [m.nama, m.kekuatan, m.sediaan].filter(Boolean).join(" ");

export const fmtAngka = (n: number) => String(n).replace(".", ",");

export function barisBaru(m: MedInfo): ItemObat {
  const topikal = m.satuan_dosis === "oles";
  const b: ItemObat = {
    uid: uidBaru(), medicine_id: m.id,
    nama: [m.nama, m.kekuatan].filter(Boolean).join(" "), sediaan: m.sediaan,
    satuan: m.satuan, satuan_dosis: m.satuan_dosis,
    per_pakai: topikal ? "" : m.satuan_dosis === "ml" ? "5" : "1",
    aturan_kode: topikal ? "ol2" : "s3", aturan_bebas: "",
    lama_hari: topikal ? "7" : "3", jumlah: "1", jumlah_manual: false, catatan: "",
    harga_satuan: m.harga_jual, stok: m.stok_saat_ini, expired: m.tanggal_expired,
  };
  const j = hitungJumlah(b);
  if (j !== null) b.jumlah = String(j);
  return b;
}

export function barisBebas(nama: string): ItemObat {
  return {
    uid: uidBaru(), medicine_id: null, nama: nama.trim().slice(0, 200), sediaan: "", satuan: "tablet", satuan_dosis: "tablet",
    per_pakai: "1", aturan_kode: "s3", aturan_bebas: "", lama_hari: "3", jumlah: "10", jumlah_manual: true, catatan: "",
  };
}

/** Jumlah yang diserahkan, dihitung otomatis bila satuan serah = satuan sekali pakai (mis. tablet). */
export function hitungJumlah(i: ItemObat): number | null {
  const a = cariAturan(i.aturan_kode);
  if (!a) return null;
  if (a.topikal) return 1;
  if (a.kali === null || i.satuan !== i.satuan_dosis) return null;
  const per = angka(i.per_pakai), hari = angka(i.lama_hari);
  if (per === null || hari === null || Number.isNaN(per) || Number.isNaN(hari) || per <= 0 || hari <= 0) return null;
  return Math.max(1, Math.ceil(per * a.kali * hari - 1e-9));
}

/** "1 tablet, 3× sehari setelah makan" */
export function aturanTeks(i: ItemObat): string {
  const a = cariAturan(i.aturan_kode);
  if (!a) return i.aturan_bebas.trim();
  const label = a.kode === "lain" ? i.aturan_bebas.trim() : a.label;
  if (a.topikal) return label;
  const per = angka(i.per_pakai);
  const pakai = per !== null && !Number.isNaN(per) && per > 0 ? `${fmtAngka(per)} ${i.satuan_dosis}` : "";
  return [pakai, label].filter(Boolean).join(", ");
}

export function jumlahAngka(i: ItemObat): number | null {
  const n = angka(i.jumlah);
  return n === null || Number.isNaN(n) || n <= 0 ? null : Math.round(n);
}

export function keItemCek(i: ItemObat, sumber: "resep" | "jual"): ItemCek {
  const a = cariAturan(i.aturan_kode);
  const per = angka(i.per_pakai);
  return {
    sumber, medicine_id: i.medicine_id,
    per_pakai: per === null || Number.isNaN(per) ? null : per,
    kali: a ? (a.kali ?? a.kaliMaks ?? null) : null,
    prn: !!a && a.kali === null && a.kaliMaks !== undefined,
    jumlah: jumlahAngka(i),
  };
}

/** "2027-05-31" -> "05/2027" */
export const bulanTahun = (iso: string | null) => (iso && /^\d{4}-\d{2}/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
