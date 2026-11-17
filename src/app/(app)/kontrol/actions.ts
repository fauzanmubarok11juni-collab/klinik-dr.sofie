"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hariIniWIB } from "@/lib/format";
import type { FormState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function simpanKontrol(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const v = { patient_id: t("patient_id"), encounter_id: t("encounter_id"), tanggal: t("tanggal"), sesi: t("sesi"), catatan: t("catatan") };
  const e: Record<string, string> = {};
  if (!UUID.test(v.patient_id)) e.patient_id = "Pasien tidak dikenal.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.tanggal) || Number.isNaN(Date.parse(v.tanggal))) e.tanggal = "Pilih tanggal kontrol.";
  else if (v.tanggal < hariIniWIB()) e.tanggal = "Tanggal kontrol tidak boleh sebelum hari ini.";
  else if (new Date(v.tanggal + "T00:00:00Z").getUTCDay() === 0) e.tanggal = "Hari Minggu libur. Pilih Senin sampai Sabtu.";
  if (!["pagi", "malam"].includes(v.sesi)) e.sesi = "Pilih Sesi Pagi atau Sesi Malam.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };

  const supabase = createClient();
  const { data: s } = await supabase.from("practice_sessions").select("id").eq("kode", v.sesi).single();
  if (!s) return { error: "Sesi praktik tidak ditemukan.", values: v };
  const { error } = await supabase.from("control_schedules").insert({
    patient_id: v.patient_id, encounter_id: UUID.test(v.encounter_id) ? v.encounter_id : null,
    tanggal: v.tanggal, session_id: s.id, catatan: v.catatan ? v.catatan.slice(0, 300) : null,
  });
  if (error) return { error: "Jadwal belum tersimpan. Periksa koneksi internet, lalu coba lagi.", values: v };
  revalidatePath("/kontrol"); revalidatePath("/dashboard");
  redirect("/kontrol?baru=1");
}

export async function batalkanKontrol(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const supabase = createClient();
  await supabase.from("control_schedules").update({ status: "batal" }).eq("id", id).eq("status", "terjadwal");
  revalidatePath("/kontrol"); revalidatePath("/dashboard");
}

/** Dicatat saat staf menyalin pesan, agar terlihat siapa yang sudah diingatkan. */
export async function tandaiPengingat(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const supabase = createClient();
  await supabase.from("control_schedules").update({ pengingat_pada: new Date().toISOString() }).eq("id", id).eq("status", "terjadwal");
  revalidatePath("/kontrol");
}
