"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wajibRole } from "@/lib/auth";
import { hariIniWIB } from "@/lib/format";
import { adalahJenis, hitungSkrining } from "@/lib/geriatri";
import type { FormState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const GAGAL = "Belum tersimpan. Periksa koneksi internet, lalu coba lagi.";

/** Skor dihitung ulang di server dari jawaban; skor dari layar tidak dipercaya. */
export async function simpanSkrining(patientId: string, kode: string, _p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!UUID.test(patientId) || !adalahJenis(kode)) return { error: "Data tidak dikenal." };
  const jawaban: Record<string, string> = {};
  fd.forEach((v, k) => { if (k.startsWith("b_")) jawaban[k.slice(2)] = String(v); });
  const h = hitungSkrining(kode, jawaban);
  if (!h.lengkap) return { error: `Masih ada ${h.hilang.length} butir yang belum dijawab.` };

  const supabase = createClient();
  const tanggal = hariIniWIB();
  const { data: enc } = await supabase.from("encounters").select("id").eq("patient_id", patientId).eq("tanggal", tanggal).neq("status", "batal").order("created_at", { ascending: false }).limit(1);
  const { error } = await supabase.from("geriatric_screenings").insert({
    patient_id: patientId, encounter_id: (enc as { id: string }[] | null)?.[0]?.id ?? null, tanggal, jenis: kode,
    skor: h.skor, interpretasi: h.tafsir.label, jawaban, catatan: teks(fd, "catatan").slice(0, 600) || null,
  });
  if (error) return { error: GAGAL };
  revalidatePath(`/lansia/${patientId}`);
  redirect(`/lansia/${patientId}?tersimpan=${kode}`);
}

export async function tambahObatLuar(patientId: string, _p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!UUID.test(patientId)) return { error: "Pasien tidak dikenal." };
  const nama = teks(fd, "nama").slice(0, 200), mid = teks(fd, "medicine_id");
  if (nama.length < 2) return { error: "Pilih atau tulis nama obat terlebih dahulu." };
  const supabase = createClient();
  const { error } = await supabase.from("patient_external_meds").insert({
    patient_id: patientId, medicine_id: UUID.test(mid) ? mid : null, nama,
    aturan: teks(fd, "aturan").slice(0, 200) || null, sumber: teks(fd, "sumber").slice(0, 100) || null,
  });
  if (error) return { error: GAGAL };
  revalidatePath(`/lansia/${patientId}/obat`); revalidatePath(`/lansia/${patientId}`);
  return { konfirmasi: `${nama} ditambahkan.` };
}

export async function setAktifObatLuar(id: string, patientId: string, aktif: boolean): Promise<void> {
  await wajibRole("dokter");
  if (!UUID.test(id)) return;
  const supabase = createClient();
  await supabase.from("patient_external_meds").update({ aktif }).eq("id", id);
  revalidatePath(`/lansia/${patientId}/obat`); revalidatePath(`/lansia/${patientId}`);
}

export async function hapusObatLuar(id: string, patientId: string): Promise<void> {
  await wajibRole("dokter");
  if (!UUID.test(id)) return;
  const supabase = createClient();
  await supabase.from("patient_external_meds").delete().eq("id", id);
  revalidatePath(`/lansia/${patientId}/obat`); revalidatePath(`/lansia/${patientId}`);
}
