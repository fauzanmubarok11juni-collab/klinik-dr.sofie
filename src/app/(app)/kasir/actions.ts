"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type KasirState = { error?: string };

const PESAN_AMAN = ["Tagihan berubah", "Uang diterima", "sudah lunas", "dibatalkan", "Hanya Dokter", "Tulis alasan", "Pilih metode", "Tidak berwenang", "tidak ditemukan"];
const aman = (m: string | undefined, umum: string) => (PESAN_AMAN.some((k) => (m ?? "").includes(k)) ? (m as string) : umum);

/** Memilih jenis jasa konsultasi pada tagihan (tarif sudah ditetapkan Dokter di Pengaturan). */
export async function pilihKonsultasi(encounterId: string, jenis: string): Promise<void> {
  if (!UUID.test(encounterId) || !["konsultasi", "kontrol", "gratis"].includes(jenis)) return;
  const supabase = createClient();
  await supabase.rpc("sinkron_tagihan", { p_encounter: encounterId, p_jenis: jenis });
  revalidatePath(`/kasir/${encounterId}`);
}

export async function bayar(encounterId: string, _prev: KasirState, fd: FormData): Promise<KasirState> {
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const invoice = t("invoice_id");
  if (!UUID.test(encounterId) || !UUID.test(invoice)) return { error: "Tagihan tidak dikenal." };
  const total = Number(t("total_dilihat"));
  const metode = t("metode") || "tunai";
  const diterima = Number(t("diterima").replace(/\D/g, "")) || 0;

  const supabase = createClient();
  const { error } = await supabase.rpc("bayar_tagihan", {
    p_invoice: invoice, p_total_dilihat: total, p_metode: metode, p_diterima: diterima, p_catatan: t("catatan") || null,
  });
  if (error) return { error: aman(error.message, "Pembayaran belum tersimpan. Periksa koneksi internet, lalu coba lagi.") };
  revalidatePath("/kasir"); revalidatePath(`/kasir/${encounterId}`); revalidatePath("/dashboard");
  redirect(`/kasir/${encounterId}?lunas=1`);
}

export async function voidTagihan(encounterId: string, invoiceId: string, _prev: KasirState, fd: FormData): Promise<KasirState> {
  if (!UUID.test(encounterId) || !UUID.test(invoiceId)) return { error: "Tagihan tidak dikenal." };
  const supabase = createClient();
  const { error } = await supabase.rpc("void_tagihan", { p_invoice: invoiceId, p_alasan: String(fd.get("alasan") ?? "") });
  if (error) return { error: aman(error.message, "Pembatalan belum tersimpan. Periksa koneksi internet.") };
  revalidatePath("/kasir"); revalidatePath(`/kasir/${encounterId}`);
  redirect(`/kasir/${encounterId}?void=1`);
}
