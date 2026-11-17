// Rekonsiliasi obat lansia: gabungan obat aktif dari resep/penjualan klinik dan obat dari luar klinik (sisi server).
import type { createClient } from "@/lib/supabase/server";
import { analisisObat, type AturanInteraksi, type HasilAnalisis, type MedAnalisis } from "@/lib/obat-analisis";

type Klien = ReturnType<typeof createClient>;

export type ObatAktif = { kunci: string; medicine_id: string | null; nama: string; aturan: string; sumber: "klinik" | "luar"; sampai: string | null; extId?: string; asal?: string | null };

export async function muatObatAktif(supabase: Klien, patientId: string): Promise<ObatAktif[]> {
  const [aktifR, extR] = await Promise.all([
    supabase.rpc("obat_aktif_pasien", { p_patient: patientId, p_kecuali: null }),
    supabase.from("patient_external_meds").select("id, medicine_id, nama, aturan, sumber").eq("patient_id", patientId).eq("aktif", true).order("created_at"),
  ]);
  const hasil = new Map<string, ObatAktif>();
  for (const r of (aktifR.data ?? []) as { medicine_id: string | null; nama: string; aturan: string; sampai: string }[]) {
    const kunci = r.medicine_id ?? `n:${r.nama.toLowerCase()}`;
    const ada = hasil.get(kunci);
    if (!ada || (ada.sampai ?? "") < r.sampai) hasil.set(kunci, { kunci, medicine_id: r.medicine_id, nama: r.nama, aturan: r.aturan, sumber: "klinik", sampai: r.sampai });
  }
  for (const r of (extR.data ?? []) as { id: string; medicine_id: string | null; nama: string; aturan: string | null; sumber: string | null }[]) {
    const kunci = r.medicine_id ? `${r.medicine_id}` : `n:${r.nama.toLowerCase()}`;
    // Obat yang sama di klinik dan luar dihitung satu, tetapi ditandai ganda
    const k2 = hasil.has(kunci) ? `luar:${r.id}` : kunci;
    hasil.set(k2, { kunci: k2, medicine_id: r.medicine_id, nama: r.nama, aturan: r.aturan ?? "", sumber: "luar", sampai: null, extId: r.id, asal: r.sumber });
  }
  return Array.from(hasil.values());
}

export async function analisisRekonsiliasi(supabase: Klien, obat: ObatAktif[], umur: number): Promise<HasilAnalisis[]> {
  const ids = Array.from(new Set(obat.map((o) => o.medicine_id).filter((x): x is string => !!x)));
  const [medR, interR, beersR] = await Promise.all([
    ids.length ? supabase.from("medicines").select("id, nama, kekuatan, zat_aktif, golongan").in("id", ids) : Promise.resolve({ data: [] }),
    supabase.from("drug_interactions").select("kunci_a, kunci_b, tingkat, keterangan"),
    supabase.from("drug_geriatric_alerts").select("kunci, saran"),
  ]);
  const meds = new Map<string, { zat_aktif: string[]; golongan: string | null }>();
  for (const m of (medR.data ?? []) as { id: string; zat_aktif: string[]; golongan: string | null }[]) meds.set(m.id, m);
  const daftar: MedAnalisis[] = obat.map((o) => {
    const m = o.medicine_id ? meds.get(o.medicine_id) : undefined;
    return { kunciId: o.kunci, nama: o.nama, zat: m?.zat_aktif ?? [], golongan: m?.golongan ?? null, sumber: o.sumber };
  });
  return analisisObat(daftar, umur, (interR.data ?? []) as AturanInteraksi[], (beersR.data ?? []) as { kunci: string; saran: string }[]);
}
