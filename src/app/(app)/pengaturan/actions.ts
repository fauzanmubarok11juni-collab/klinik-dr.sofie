"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wajibRole } from "@/lib/auth";
import { adminTersedia, buatAdmin } from "@/lib/supabase/admin";
import { angkaAman } from "@/lib/obat-server";
import { DAFTAR_PENANDA } from "@/lib/pengingat";
import type { FormState } from "@/lib/types";
import { HARAPAN, parseLMS } from "@/lib/who-impor";
import type { Indikator } from "@/lib/who";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const GAGAL = "Belum tersimpan. Periksa koneksi internet, lalu coba lagi.";
const OK: FormState = { konfirmasi: "Tersimpan." };

async function simpanSettings(rows: { key: string; value: string | number }[]): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("settings").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "key" });
  return !error;
}

export async function simpanIdentitas(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const v = { nama_praktik: teks(fd, "nama_praktik"), alamat: teks(fd, "alamat"), telepon: teks(fd, "telepon"), sip_dokter: teks(fd, "sip_dokter"), nama_dokter: teks(fd, "nama_dokter"), kode_rm: teks(fd, "kode_rm").toUpperCase() };
  const e: Record<string, string> = {};
  if (!v.nama_praktik) e.nama_praktik = "Isi nama praktik.";
  if (!/^[A-Z0-9]{1,6}$/.test(v.kode_rm)) e.kode_rm = "Kode RM 1–6 huruf atau angka, tanpa spasi.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };
  const ok = await simpanSettings(Object.entries(v).map(([key, value]) => ({ key, value })));
  if (!ok) return { error: GAGAL, values: v };
  revalidatePath("/", "layout");
  return { ...OK, values: v };
}

export async function simpanTarifKonsultasi(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const v = { tarif_konsultasi: teks(fd, "tarif_konsultasi"), tarif_kontrol: teks(fd, "tarif_kontrol") };
  const a = angkaAman(v.tarif_konsultasi.replace(/\./g, "")), b = angkaAman(v.tarif_kontrol.replace(/\./g, ""));
  const e: Record<string, string> = {};
  if (a === null || a < 0) e.tarif_konsultasi = "Isi angka rupiah, 0 atau lebih.";
  if (b === null || b < 0) e.tarif_kontrol = "Isi angka rupiah, 0 atau lebih.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };
  const ok = await simpanSettings([{ key: "tarif_konsultasi", value: Math.round(a!) }, { key: "tarif_kontrol", value: Math.round(b!) }]);
  return ok ? { ...OK, values: v } : { error: GAGAL, values: v };
}

export async function simpanTindakan(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data } = await supabase.from("services").select("id, tarif, aktif");
  const lama = (data ?? []) as { id: string; tarif: number; aktif: boolean }[];
  const e: Record<string, string> = {};
  const ubah: { id: string; tarif: number; aktif: boolean }[] = [];
  for (const s of lama) {
    const tarif = angkaAman(teks(fd, `tarif_${s.id}`).replace(/\./g, ""));
    const aktif = !!fd.get(`aktif_${s.id}`);
    if (tarif === null || tarif < 0) { e[`tarif_${s.id}`] = "Isi angka rupiah."; continue; }
    if (Math.round(tarif) !== Number(s.tarif) || aktif !== s.aktif) ubah.push({ id: s.id, tarif: Math.round(tarif), aktif });
  }
  if (Object.keys(e).length) return { error: "Ada tarif yang belum berupa angka.", errors: e };
  for (const u of ubah) {
    const { error } = await supabase.from("services").update({ tarif: u.tarif, aktif: u.aktif }).eq("id", u.id);
    if (error) return { error: GAGAL };
  }
  const nama = teks(fd, "baru_nama");
  if (nama) {
    const tarif = angkaAman(teks(fd, "baru_tarif").replace(/\./g, "")) ?? 0;
    const { data: mx } = await supabase.from("services").select("urutan").order("urutan", { ascending: false }).limit(1);
    const urutan = ((mx as { urutan: number }[] | null)?.[0]?.urutan ?? 0) + 1;
    const { error } = await supabase.from("services").insert({ nama: nama.slice(0, 120), kategori: teks(fd, "baru_kategori") || null, tarif: Math.max(0, Math.round(tarif)), urutan });
    if (error) return { error: error.code === "23505" ? "Tindakan dengan nama itu sudah ada." : GAGAL };
  }
  revalidatePath("/pengaturan");
  return { konfirmasi: `Tersimpan.${ubah.length ? ` ${ubah.length} tindakan diperbarui.` : ""}${nama ? " Tindakan baru ditambahkan." : ""}` };
}

export async function simpanSesi(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const v: Record<string, string> = {};
  const e: Record<string, string> = {};
  const baris: { kode: string; mulai: string; selesai: string; aktif: boolean }[] = [];
  for (const kode of ["pagi", "malam"]) {
    const mulai = teks(fd, `mulai_${kode}`), selesai = teks(fd, `selesai_${kode}`);
    v[`mulai_${kode}`] = mulai; v[`selesai_${kode}`] = selesai; v[`aktif_${kode}`] = fd.get(`aktif_${kode}`) ? "1" : "";
    if (!/^\d{2}:\d{2}$/.test(mulai) || !/^\d{2}:\d{2}$/.test(selesai)) e[`mulai_${kode}`] = "Isi jam dengan benar.";
    else if (selesai <= mulai) e[`selesai_${kode}`] = "Jam selesai harus setelah jam mulai.";
    baris.push({ kode, mulai, selesai, aktif: !!fd.get(`aktif_${kode}`) });
  }
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };
  const supabase = createClient();
  for (const b of baris) {
    const { error } = await supabase.from("practice_sessions").update({ jam_mulai: b.mulai, jam_selesai: b.selesai, aktif: b.aktif }).eq("kode", b.kode);
    if (error) return { error: GAGAL, values: v };
  }
  revalidatePath("/", "layout");
  return { ...OK, values: v };
}

export async function simpanPesan(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const templat = String(fd.get("templat_pengingat") ?? "").replace(/\r/g, "").trim();
  if (templat.length < 10 || templat.length > 1000) return { error: "Pesan harus 10–1000 huruf.", values: { templat_pengingat: templat } };
  const tdkDikenal = (templat.match(/\{(\w+)\}/g) ?? []).map((x) => x.slice(1, -1)).filter((x) => !DAFTAR_PENANDA.includes(x));
  if (tdkDikenal.length) return { error: `Penanda tidak dikenal: {${tdkDikenal[0]}}. Pakai: ${DAFTAR_PENANDA.map((x) => `{${x}}`).join(", ")}`, values: { templat_pengingat: templat } };
  const ok = await simpanSettings([{ key: "templat_pengingat", value: templat }]);
  return ok ? { ...OK, values: { templat_pengingat: templat } } : { error: GAGAL, values: { templat_pengingat: templat } };
}

/* ---------------- Pengguna ---------------- */
const kembali = (p: string) => redirect(`/pengaturan?bagian=pengguna&${p}`);

export async function ubahNamaPengguna(id: string, fd: FormData): Promise<void> {
  await wajibRole("dokter");
  const nama = teks(fd, "nama").slice(0, 80);
  if (!UUID.test(id) || nama.length < 2) kembali("galat=Nama minimal 2 huruf.");
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ nama }).eq("id", id);
  kembali(error ? "galat=Nama belum tersimpan." : "ok=Nama tersimpan.");
}

export async function setAktifPengguna(id: string, aktif: boolean): Promise<void> {
  await wajibRole("dokter");
  if (!UUID.test(id)) kembali("galat=Pengguna tidak dikenal.");
  const supabase = createClient();
  const { data: t } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (!t || t.role !== "asisten") kembali("galat=Hanya akun Asisten yang dapat dinonaktifkan.");
  const { error } = await supabase.from("profiles").update({ aktif }).eq("id", id);
  kembali(error ? "galat=Belum tersimpan." : `ok=Akun Asisten ${aktif ? "diaktifkan" : "dinonaktifkan"}.`);
}

export async function resetKataSandi(id: string, _p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!adminTersedia()) return { error: "Fitur ini butuh SUPABASE_SERVICE_ROLE_KEY (lihat README)." };
  const sandi = String(fd.get("sandi") ?? "");
  if (!UUID.test(id)) return { error: "Pengguna tidak dikenal." };
  if (sandi.length < 8) return { error: "Kata sandi minimal 8 karakter." };
  const supabase = createClient();
  const { data: t } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (!t || t.role !== "asisten") return { error: "Hanya kata sandi akun Asisten yang dapat diatur di sini." };
  const { error } = await buatAdmin().auth.admin.updateUserById(id, { password: sandi });
  return error ? { error: "Kata sandi belum berubah. Coba lagi." } : { konfirmasi: "Kata sandi Asisten diganti. Sampaikan kepada yang bersangkutan." };
}

export async function buatAsisten(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  if (!adminTersedia()) return { error: "Fitur ini butuh SUPABASE_SERVICE_ROLE_KEY (lihat README)." };
  const email = teks(fd, "email").toLowerCase(), nama = teks(fd, "nama"), sandi = String(fd.get("sandi") ?? "");
  const e: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Email belum benar.";
  if (nama.length < 2) e.nama = "Isi nama (minimal 2 huruf).";
  if (sandi.length < 8) e.sandi = "Kata sandi minimal 8 karakter.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: { email, nama } };
  const supabase = createClient();
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "asisten");
  if ((count ?? 0) > 0) return { error: "Akun Asisten sudah ada. Sistem ini hanya untuk 2 akun." };
  const { error } = await buatAdmin().auth.admin.createUser({ email, password: sandi, email_confirm: true, user_metadata: { nama } });
  if (error) return { error: "Akun belum bisa dibuat. Periksa email (mungkin sudah dipakai).", values: { email, nama } };
  revalidatePath("/pengaturan");
  return { konfirmasi: "Akun Asisten dibuat. Sampaikan email dan kata sandi kepada yang bersangkutan." };
}

/* ---------------- Data WHO (L, M, S) ---------------- */
export async function imporLMS(_p: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const ind = teks(fd, "indikator") as Indikator, sex = teks(fd, "sex");
  const v = { indikator: ind, sex, data: String(fd.get("data") ?? "") };
  if (!(ind in HARAPAN)) return { error: "Pilih indikator.", values: v };
  if (!["L", "P"].includes(sex)) return { error: "Pilih jenis kelamin.", values: v };
  const hasil = parseLMS(v.data, ind);
  if (hasil.error) return { error: hasil.error, values: v };

  const supabase = createClient();
  const sumber = `WHO (impor ${new Date().toISOString().slice(0, 10)})`;
  const baris = hasil.baris.map((b) => ({ indikator: ind, sex, kunci: b.kunci, l: b.l, m: b.m, s: b.s, sumber }));
  for (let i = 0; i < baris.length; i += 400) {
    const { error } = await supabase.from("who_lms").upsert(baris.slice(i, i + 400), { onConflict: "indikator,sex,kunci" });
    if (error) return { error: "Impor terhenti di tengah jalan. Periksa koneksi internet lalu ulangi (data yang sudah masuk tidak rusak).", values: v };
  }
  revalidatePath("/pengaturan");
  const rentang = `${hasil.baris[0].kunci}–${hasil.baris[hasil.baris.length - 1].kunci}`;
  return { konfirmasi: `${hasil.baris.length} baris diimpor (${HARAPAN[ind].label}, ${sex === "L" ? "laki-laki" : "perempuan"}, rentang ${rentang}).${hasil.peringatan.length ? " Perhatian: " + hasil.peringatan.join(" ") : ""}` };
}
