// Pemuat data obat di sisi server (dipakai halaman dan aksi). Bukan "use server".
import type { createClient } from "@/lib/supabase/server";
import { angka } from "@/lib/rekam";
import { hitungJumlah, uidBaru, type ItemObat } from "@/lib/obat";

type Klien = ReturnType<typeof createClient>;
const teks = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

type BarisItem = {
  id: string; medicine_id: string | null; nama: string; sediaan: string | null; satuan: string | null; satuan_dosis: string | null;
  per_pakai: number | null; aturan_kode: string | null; aturan_bebas: string | null; lama_hari: number | null;
  jumlah: number; catatan: string | null;
};

function dariBarisResep(r: BarisItem, salin = false): ItemObat {
  const b: ItemObat = {
    uid: salin ? uidBaru() : r.id, medicine_id: r.medicine_id, nama: r.nama, sediaan: r.sediaan ?? "",
    satuan: r.satuan ?? "tablet", satuan_dosis: r.satuan_dosis ?? r.satuan ?? "tablet",
    per_pakai: teks(r.per_pakai), aturan_kode: r.aturan_kode ?? "lain", aturan_bebas: r.aturan_bebas ?? "",
    lama_hari: teks(r.lama_hari), jumlah: String(r.jumlah), jumlah_manual: true, catatan: r.catatan ?? "",
  };
  b.jumlah_manual = hitungJumlah(b) !== r.jumlah;
  return b;
}

const KOLOM_ITEM = "id, medicine_id, nama, sediaan, satuan, satuan_dosis, per_pakai, aturan_kode, aturan_bebas, lama_hari, jumlah, catatan";

export async function muatResep(supabase: Klien, encounterId: string): Promise<{ catatan: string; items: ItemObat[] }> {
  const { data: rx } = await supabase.from("prescriptions").select("id, catatan").eq("encounter_id", encounterId).maybeSingle();
  if (!rx) return { catatan: "", items: [] };
  const { data } = await supabase.from("prescription_items").select(KOLOM_ITEM).eq("prescription_id", rx.id).order("urutan");
  return { catatan: rx.catatan ?? "", items: ((data ?? []) as BarisItem[]).map((r) => dariBarisResep(r)) };
}

/** Resep kunjungan terakhir pasien (untuk "Salin resep terakhir" pada pasien kontrol). */
export async function muatResepTerakhir(supabase: Klien, patientId: string, kecuali: string): Promise<ItemObat[] | null> {
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("id, encounters!inner(patient_id, tanggal)")
    .eq("encounters.patient_id", patientId).neq("encounter_id", kecuali)
    .order("created_at", { ascending: false }).limit(1);
  const id = (rx as { id: string }[] | null)?.[0]?.id;
  if (!id) return null;
  const { data } = await supabase.from("prescription_items").select(KOLOM_ITEM).eq("prescription_id", id).order("urutan");
  const items = ((data ?? []) as BarisItem[]).map((r) => dariBarisResep(r, true));
  return items.length ? items : null;
}

type BarisJual = {
  medicine_id: string; nama: string; harga_satuan: number; jumlah: number; per_pakai: number | null;
  aturan_kode: string | null; aturan_bebas: string | null; lama_hari: number | null; id: string;
  medicines: { sediaan: string; satuan: string; satuan_dosis: string; stok_saat_ini: number; tanggal_expired: string | null } | null;
};

export async function muatPenjualan(supabase: Klien, encounterId: string): Promise<ItemObat[]> {
  const { data } = await supabase
    .from("medicine_sales")
    .select("id, medicine_id, nama, harga_satuan, jumlah, per_pakai, aturan_kode, aturan_bebas, lama_hari, medicines(sediaan, satuan, satuan_dosis, stok_saat_ini, tanggal_expired)")
    .eq("encounter_id", encounterId).order("created_at");
  return ((data ?? []) as unknown as BarisJual[]).map((r) => {
    const b: ItemObat = {
      uid: r.id, medicine_id: r.medicine_id, nama: r.nama, sediaan: r.medicines?.sediaan ?? "",
      satuan: r.medicines?.satuan ?? "tablet", satuan_dosis: r.medicines?.satuan_dosis ?? "tablet",
      per_pakai: teks(r.per_pakai), aturan_kode: r.aturan_kode ?? "lain", aturan_bebas: r.aturan_bebas ?? "",
      lama_hari: teks(r.lama_hari), jumlah: String(r.jumlah), jumlah_manual: true, catatan: "",
      harga_satuan: Number(r.harga_satuan), stok: r.medicines?.stok_saat_ini, expired: r.medicines?.tanggal_expired ?? null,
    };
    b.jumlah_manual = hitungJumlah(b) !== r.jumlah;
    return b;
  });
}

export type StokBermasalah = { id: string; nama: string; stok: number; minimum: number; expired: string | null; status: ("habis" | "menipis" | "kedaluwarsa" | "segera")[] };

/** Obat dijual yang stoknya di bawah minimum atau kedaluwarsanya kurang dari 30 hari. Hanya peringatan, tidak memblokir. */
export async function muatStokBermasalah(supabase: Klien, hariIni: string): Promise<StokBermasalah[]> {
  const { data } = await supabase
    .from("medicines")
    .select("id, nama, kekuatan, sediaan, stok_saat_ini, stok_minimum, tanggal_expired")
    .eq("dijual", true).eq("aktif", true).order("nama");
  const batas = new Date(hariIni + "T00:00:00Z");
  batas.setUTCDate(batas.getUTCDate() + 30);
  const sampai = batas.toISOString().slice(0, 10);
  const hasil: StokBermasalah[] = [];
  for (const m of (data ?? []) as { id: string; nama: string; kekuatan: string; sediaan: string; stok_saat_ini: number; stok_minimum: number; tanggal_expired: string | null }[]) {
    const status: StokBermasalah["status"] = [];
    if (m.stok_saat_ini === 0) status.push("habis");
    else if (m.stok_saat_ini < m.stok_minimum) status.push("menipis");
    if (m.tanggal_expired && m.tanggal_expired <= hariIni) status.push("kedaluwarsa");
    else if (m.tanggal_expired && m.tanggal_expired <= sampai) status.push("segera");
    if (status.length && !(status.length === 1 && status[0] === "habis" && m.stok_minimum === 0)) {
      hasil.push({ id: m.id, nama: [m.nama, m.kekuatan, m.sediaan].filter(Boolean).join(" "), stok: m.stok_saat_ini, minimum: m.stok_minimum, expired: m.tanggal_expired, status });
    }
  }
  return hasil;
}

export const angkaAman = (s: string): number | null => {
  const n = angka(s);
  return n === null || Number.isNaN(n) ? null : n;
};
