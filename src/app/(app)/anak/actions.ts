"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wajibRole } from "@/lib/auth";
import { hariIniWIB } from "@/lib/format";
import { angka } from "@/lib/rekam";
import { umurBulanDesimal } from "@/lib/who";
import { CHECKPOINT, nilaiPerkembangan, pilihCheckpoint } from "@/lib/perkembangan";
import type { FormState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const GAGAL = "Belum tersimpan. Periksa koneksi internet, lalu coba lagi.";

async function kunjunganPada(supabase: ReturnType<typeof createClient>, patientId: string, tanggal: string): Promise<string | null> {
  const { data } = await supabase.from("encounters").select("id").eq("patient_id", patientId).eq("tanggal", tanggal).neq("status", "batal").order("created_at", { ascending: false }).limit(1);
  return (data as { id: string }[] | null)?.[0]?.id ?? null;
}

export async function simpanPertumbuhan(patientId: string, _p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!UUID.test(patientId)) return { error: "Pasien tidak dikenal." };
  const v = { tanggal: teks(fd, "tanggal"), bb: teks(fd, "bb"), tb: teks(fd, "tb"), cara_ukur: teks(fd, "cara_ukur"), lk: teks(fd, "lk"), pesan: teks(fd, "pesan_orang_tua") };
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("tanggal_lahir").eq("id", patientId).maybeSingle();
  if (!p) return { error: "Pasien tidak ditemukan.", values: v };

  const e: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.tanggal) || v.tanggal > hariIniWIB() || v.tanggal < p.tanggal_lahir) e.tanggal = "Tanggal pengukuran tidak masuk akal.";
  const num = (s: string, min: number, max: number, nama: string, k: string) => {
    if (!s) return null;
    const n = angka(s);
    if (n === null || Number.isNaN(n) || n < min || n > max) { e[k] = `${nama} harus ${min}–${max}.`; return null; }
    return n;
  };
  const bb = num(v.bb, 0.3, 250, "Berat badan", "bb");
  const tb = num(v.tb, 20, 250, "Panjang/tinggi badan", "tb");
  const lk = num(v.lk, 15, 80, "Lingkar kepala", "lk");
  if (bb === null && tb === null && lk === null && !Object.keys(e).length) e.bb = "Isi sedikitnya satu pengukuran.";
  if (tb !== null && !["berbaring", "berdiri"].includes(v.cara_ukur)) e.cara_ukur = "Pilih cara mengukur: berbaring atau berdiri.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };

  const { error } = await supabase.from("growth_records").upsert({
    patient_id: patientId, encounter_id: await kunjunganPada(supabase, patientId, v.tanggal), tanggal: v.tanggal,
    umur_bulan: umurBulanDesimal(p.tanggal_lahir, v.tanggal), bb, tb, cara_ukur: tb !== null ? v.cara_ukur : null,
    lingkar_kepala: lk, pesan_orang_tua: v.pesan ? v.pesan.slice(0, 600) : null,
  }, { onConflict: "patient_id,tanggal" });
  if (error) return { error: GAGAL, values: v };
  revalidatePath(`/anak/${patientId}`);
  redirect(`/anak/${patientId}?tersimpan=1`);
}

export async function hapusPertumbuhan(id: string, patientId: string): Promise<void> {
  await wajibRole("dokter");
  if (!UUID.test(id)) return;
  const supabase = createClient();
  await supabase.from("growth_records").delete().eq("id", id);
  revalidatePath(`/anak/${patientId}`);
}

export async function simpanPerkembangan(patientId: string, _p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!UUID.test(patientId)) return { error: "Pasien tidak dikenal." };
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("tanggal_lahir").eq("id", patientId).maybeSingle();
  if (!p) return { error: "Pasien tidak ditemukan." };

  const tanggal = hariIniWIB();
  const umur = umurBulanDesimal(p.tanggal_lahir, tanggal);
  const cp = pilihCheckpoint(umur);
  if (cp === null || !CHECKPOINT.includes(cp)) return { error: "Skrining tersedia untuk usia 2 bulan sampai kurang dari 6 tahun." };

  const { data: butir } = await supabase.from("developmental_milestones").select("domain, urutan").eq("checkpoint_bulan", cp);
  const ids = ((butir ?? []) as { domain: string; urutan: number }[]).map((b) => `${b.domain}-${b.urutan}`);
  if (ids.length === 0) return { error: "Butir skrining untuk usia ini belum tersedia." };

  const jawaban: Record<string, string> = {};
  for (const id of ids) { const j = teks(fd, `j_${id}`); jawaban[id] = ["ya", "tidak", "belum"].includes(j) ? j : "belum"; }
  const khawatir = !!fd.get("khawatir"), kemunduran = !!fd.get("kemunduran");
  const nilai = nilaiPerkembangan(jawaban, ids, khawatir, kemunduran);
  const rujukManual = !!fd.get("rujuk_manual");

  const { error } = await supabase.from("developmental_screenings").insert({
    patient_id: patientId, encounter_id: await kunjunganPada(supabase, patientId, tanggal), tanggal, umur_bulan: umur,
    checkpoint_bulan: cp, jawaban, khawatir, kemunduran, hasil: nilai.hasil,
    perlu_rujukan: nilai.hasil === "rujuk" || rujukManual, catatan: teks(fd, "catatan").slice(0, 600) || null,
  });
  if (error) return { error: GAGAL };
  revalidatePath(`/anak/${patientId}/tumbuh-kembang`);
  redirect(`/anak/${patientId}/tumbuh-kembang?tersimpan=1`);
}
