"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BATAS_VITAL, MAKS_DIAGNOSIS, MAKS_TEKS, angka, cekVital,
  type DataRekam, type KunciVital, type TemplateIsi,
} from "@/lib/rekam";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HasilSimpan = { ok: boolean; error?: string; updatedAt?: string; peringatan?: string[] };

const potong = (s: unknown) => String(s ?? "").slice(0, MAKS_TEKS);

/**
 * Simpan seluruh rekam medis (SOAP + vital + diagnosis + tindakan) dalam satu langkah.
 * Autosave (selesai=false): isian vital yang tidak masuk akal TIDAK disimpan tetapi tidak menggagalkan penyimpanan SOAP.
 * Simpan & Selesai (selesai=true): isian vital yang tidak masuk akal ditolak.
 */
export async function simpanRekamMedis(encounterId: string, data: DataRekam, selesai: boolean): Promise<HasilSimpan> {
  if (!UUID.test(encounterId)) return { ok: false, error: "Kunjungan tidak dikenal." };

  const errVital = cekVital(data.vitals);
  const salah = Object.keys(errVital) as KunciVital[];
  if (selesai && salah.length) return { ok: false, error: errVital[salah[0]] };

  const vitals: Record<string, number | null> = {};
  (Object.keys(BATAS_VITAL) as KunciVital[]).forEach((k) => {
    const n = angka(data.vitals[k]);
    vitals[k] = n === null || Number.isNaN(n) || salah.includes(k) ? null : BATAS_VITAL[k].bulat ? Math.round(n) : n;
  });

  // Diagnosis: tanpa duplikat, maksimum 10, tepat satu diagnosis utama.
  const lihat = new Set<string>();
  const dx = (data.diagnoses ?? [])
    .filter((d) => d && typeof d.kode === "string" && !lihat.has(d.kode) && lihat.add(d.kode))
    .slice(0, MAKS_DIAGNOSIS)
    .map((d) => ({ kode: d.kode, utama: !!d.utama }));
  if (dx.length) {
    const pertama = dx.findIndex((d) => d.utama);
    dx.forEach((d, i) => { d.utama = i === (pertama === -1 ? 0 : pertama); });
  }

  const lihatSvc = new Set<string>();
  const svc = (data.services ?? [])
    .filter((s) => s && UUID.test(s.service_id) && !lihatSvc.has(s.service_id) && lihatSvc.add(s.service_id))
    .slice(0, 30)
    .map((s) => ({ service_id: s.service_id, jumlah: Math.min(99, Math.max(1, Math.round(Number(s.jumlah) || 1))) }));

  const payload = {
    soap: {
      subjective: potong(data.soap?.subjective), objective: potong(data.soap?.objective),
      assessment: potong(data.soap?.assessment), plan: potong(data.soap?.plan), catatan: potong(data.soap?.catatan),
    },
    vitals,
    diagnoses: dx,
    services: svc,
  };

  const supabase = createClient();
  const { data: updatedAt, error } = await supabase.rpc("simpan_rekam_medis", {
    p_encounter: encounterId, p_data: payload, p_selesai: selesai,
  });

  if (error) {
    const m = error.message ?? "";
    if (m.includes("Hanya Dokter")) return { ok: false, error: "Hanya Dokter yang boleh mengisi rekam medis." };
    if (m.includes("dibatalkan")) return { ok: false, error: "Kunjungan ini sudah dibatalkan." };
    return { ok: false, error: "Belum tersimpan. Periksa koneksi internet." };
  }
  return {
    ok: true,
    updatedAt: typeof updatedAt === "string" ? updatedAt : new Date().toISOString(),
    peringatan: salah.map((k) => BATAS_VITAL[k].nama),
  };
}

export async function cariDiagnosis(q: string): Promise<{ kode: string; nama: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cari_diagnosis", { p_q: String(q ?? "").slice(0, 60), p_limit: 8 });
  if (error || !Array.isArray(data)) return [];
  return data as { kode: string; nama: string }[];
}

const KATEGORI = ["umum", "anak", "lansia"];
const MODE = ["pagi", "malam"];

/** Satu template pribadi per kombinasi kategori + mode. Menyimpan lagi = menimpa. */
export async function simpanTemplatePribadi(
  kategori: string, mode: string, isi: TemplateIsi
): Promise<{ ok: boolean; error?: string }> {
  if (!KATEGORI.includes(kategori) || !MODE.includes(mode)) return { ok: false, error: "Pilihan tidak dikenal." };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi habis. Silakan masuk lagi." };

  const bersih: TemplateIsi = {
    subjective: potong(isi.subjective), objective: potong(isi.objective),
    assessment: potong(isi.assessment), plan: potong(isi.plan),
  };
  await supabase.from("soap_templates").delete().eq("pemilik", user.id).eq("kategori", kategori).eq("mode", mode);
  const { error } = await supabase.from("soap_templates").insert({
    kategori, mode, nama: "Template saya", isi: bersih, pemilik: user.id,
  });
  return error ? { ok: false, error: "Template belum tersimpan." } : { ok: true };
}

export async function hapusTemplatePribadi(kategori: string, mode: string): Promise<{ ok: boolean }> {
  if (!KATEGORI.includes(kategori) || !MODE.includes(mode)) return { ok: false };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("soap_templates").delete().eq("pemilik", user.id).eq("kategori", kategori).eq("mode", mode);
  return { ok: !error };
}
