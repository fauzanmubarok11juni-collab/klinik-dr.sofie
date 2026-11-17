"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hariIniWIB, normalisasiHP } from "@/lib/format";
import type { FormState, PasienRingkas, StatusKunjungan } from "@/lib/types";

type Klien = ReturnType<typeof createClient>;

const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const KOLOM = [
  "nama", "tanggal_lahir", "jenis_kelamin", "no_hp", "alamat", "penjamin", "keluhan", "sesi",
  "nik", "alergi", "riwayat", "kontak_nama", "kontak_hubungan", "kontak_hp", "mode",
] as const;

function bacaForm(fd: FormData) {
  const v: Record<string, string> = {};
  for (const k of KOLOM) v[k] = teks(fd, k);
  v.nama = v.nama.replace(/\s+/g, " ");
  v.nik = v.nik.replace(/\s/g, "");
  if (!v.penjamin) v.penjamin = "umum";
  return v;
}

function daftarDariTeks(s: string): string[] {
  const unik = new Set(
    s.split(/[,;\n]/).map((x) => x.trim().slice(0, 100)).filter(Boolean)
  );
  return Array.from(unik).slice(0, 20);
}

function validasi(v: Record<string, string>, perluSesi: boolean) {
  const e: Record<string, string> = {};
  if (v.nama.length < 2) e.nama = "Tulis nama pasien (minimal 2 huruf).";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.tanggal_lahir)) {
    e.tanggal_lahir = "Isi tanggal lahir.";
  } else if (
    Number.isNaN(Date.parse(v.tanggal_lahir)) ||
    v.tanggal_lahir > hariIniWIB() ||
    v.tanggal_lahir < "1900-01-01"
  ) {
    e.tanggal_lahir = "Tanggal lahir tidak masuk akal. Periksa kembali.";
  }

  if (!["L", "P"].includes(v.jenis_kelamin)) e.jenis_kelamin = "Pilih laki-laki atau perempuan.";
  if (!["umum", "asuransi"].includes(v.penjamin)) e.penjamin = "Pilih penjamin.";
  if (v.no_hp && !/^\d{8,15}$/.test(normalisasiHP(v.no_hp))) e.no_hp = "Nomor HP belum benar. Contoh: 081234567890";
  if (v.nik && !/^\d{16}$/.test(v.nik)) e.nik = "NIK harus 16 angka.";
  if (v.kontak_hp && !/^\d{8,15}$/.test(normalisasiHP(v.kontak_hp))) e.kontak_hp = "Nomor HP kontak belum benar.";
  if (perluSesi && !["pagi", "malam"].includes(v.sesi)) e.sesi = "Pilih Sesi Pagi atau Sesi Malam.";
  return e;
}

const PESAN_GAGAL = "Data belum tersimpan. Periksa koneksi internet, lalu coba lagi.";

async function buatKunjungan(
  supabase: Klien, patientId: string, sesi: string, keluhan: string, penjamin: string
): Promise<string | null> {
  const { data: s } = await supabase.from("practice_sessions").select("id").eq("kode", sesi).single();
  if (!s) return "Sesi praktik tidak ditemukan.";
  const { error } = await supabase.from("encounters").insert({
    patient_id: patientId,
    session_id: s.id,
    keluhan_utama: keluhan || null,
    penjamin,
  });
  return error ? "Pendaftaran hari ini belum berhasil." : null;
}

/** Pasien baru: simpan (dan, bila diminta, langsung daftarkan hari ini). */
export async function simpanPasienBaru(_prev: FormState, fd: FormData): Promise<FormState> {
  const v = bacaForm(fd);
  const daftar = v.mode.startsWith("daftar");
  const abaikan = v.mode.endsWith("_abaikan");
  const values = { ...v, mode: v.mode.replace("_abaikan", "") };

  const errors = validasi(v, daftar);
  if (Object.keys(errors).length) {
    return { error: "Masih ada isian yang perlu diperbaiki.", errors, values };
  }

  const supabase = createClient();

  if (!abaikan) {
    const { data: dup } = await supabase.rpc("cari_duplikat", { p_nama: v.nama, p_tgl: v.tanggal_lahir });
    if (dup && (dup as PasienRingkas[]).length) return { duplikat: dup as PasienRingkas[], values };
  }

  const { data: pasien, error } = await supabase
    .from("patients")
    .insert({
      nama: v.nama,
      tanggal_lahir: v.tanggal_lahir,
      jenis_kelamin: v.jenis_kelamin,
      no_hp: normalisasiHP(v.no_hp) || null,
      alamat: v.alamat || null,
      nik: v.nik || null,
      penjamin: v.penjamin,
    })
    .select("id")
    .single();

  if (error || !pasien) {
    if (error?.code === "23505") return { errors: { nik: "NIK ini sudah terdaftar atas pasien lain." }, error: "NIK sudah dipakai.", values };
    return { error: PESAN_GAGAL, values };
  }

  // Data pendamping (opsional). Kegagalan di sini tidak membatalkan pasien yang sudah tersimpan.
  let infoGagal = false;
  const alergi = daftarDariTeks(v.alergi);
  if (alergi.length) {
    const { error: e1 } = await supabase.from("patient_allergies").insert(alergi.map((nama_alergi) => ({ patient_id: pasien.id, nama_alergi })));
    if (e1) infoGagal = true;
  }
  const riwayat = daftarDariTeks(v.riwayat);
  if (riwayat.length) {
    const { error: e2 } = await supabase.from("patient_conditions").insert(riwayat.map((nama_kondisi) => ({ patient_id: pasien.id, nama_kondisi })));
    if (e2) infoGagal = true;
  }
  if (v.kontak_nama) {
    const { error: e3 } = await supabase.from("patient_contacts").insert({
      patient_id: pasien.id,
      nama: v.kontak_nama,
      hubungan: v.kontak_hubungan || null,
      no_hp: normalisasiHP(v.kontak_hp) || null,
    });
    if (e3) infoGagal = true;
  }

  if (daftar) {
    const gagal = await buatKunjungan(supabase, pasien.id, v.sesi, v.keluhan, v.penjamin);
    if (gagal) redirect(`/pasien/${pasien.id}/daftar?gagal=1`);
    if (infoGagal) redirect(`/pasien/${pasien.id}?cek=1`);
    redirect(`/hari-ini?sesi=${v.sesi}&baru=${encodeURIComponent(v.nama)}`);
  }
  redirect(infoGagal ? `/pasien/${pasien.id}?cek=1` : `/pasien/${pasien.id}?tersimpan=1`);
}

/** Ubah data diri + kontak darurat. Alergi & riwayat dikelola di halaman pasien. */
export async function simpanEditPasien(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const v = bacaForm(fd);
  const errors = validasi(v, false);
  if (Object.keys(errors).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors, values: v };

  const supabase = createClient();
  const { error } = await supabase
    .from("patients")
    .update({
      nama: v.nama,
      tanggal_lahir: v.tanggal_lahir,
      jenis_kelamin: v.jenis_kelamin,
      no_hp: normalisasiHP(v.no_hp) || null,
      alamat: v.alamat || null,
      nik: v.nik || null,
      penjamin: v.penjamin,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { errors: { nik: "NIK ini sudah terdaftar atas pasien lain." }, error: "NIK sudah dipakai.", values: v };
    return { error: PESAN_GAGAL, values: v };
  }

  // Kontak darurat: ubah bila sudah ada, tambah bila belum. (Penghapusan hanya hak Dokter.)
  if (v.kontak_nama) {
    const isi = { nama: v.kontak_nama, hubungan: v.kontak_hubungan || null, no_hp: normalisasiHP(v.kontak_hp) || null };
    const { data: ada } = await supabase.from("patient_contacts").select("id").eq("patient_id", id).limit(1);
    if (ada && ada.length) await supabase.from("patient_contacts").update(isi).eq("id", ada[0].id);
    else await supabase.from("patient_contacts").insert({ patient_id: id, ...isi });
  }

  redirect(`/pasien/${id}?tersimpan=1`);
}

/** Daftarkan pasien lama untuk hari ini. */
export async function daftarkanKunjungan(patientId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const sesi = teks(fd, "sesi");
  const keluhan = teks(fd, "keluhan");
  const penjamin = teks(fd, "penjamin") || "umum";
  const paksa = fd.get("paksa") === "1";
  const values = { sesi, keluhan, penjamin };

  if (!["pagi", "malam"].includes(sesi)) return { errors: { sesi: "Pilih Sesi Pagi atau Sesi Malam." }, values };
  if (!["umum", "asuransi"].includes(penjamin)) return { errors: { penjamin: "Pilih penjamin." }, values };

  const supabase = createClient();

  if (!paksa) {
    const { data: ada } = await supabase
      .from("encounters")
      .select("id, practice_sessions!inner(kode)")
      .eq("patient_id", patientId)
      .eq("tanggal", hariIniWIB())
      .eq("practice_sessions.kode", sesi)
      .neq("status", "batal");
    if (ada && ada.length) {
      return { konfirmasi: "Pasien ini sudah terdaftar di sesi tersebut hari ini.", values };
    }
  }

  const gagal = await buatKunjungan(supabase, patientId, sesi, keluhan, penjamin);
  if (gagal) return { error: gagal + " Periksa koneksi internet, lalu coba lagi.", values };

  const { data: p } = await supabase.from("patients").select("nama").eq("id", patientId).single();
  redirect(`/hari-ini?sesi=${sesi}&baru=${encodeURIComponent(p?.nama ?? "Pasien")}`);
}

const STATUS_SAH: StatusKunjungan[] = ["menunggu", "diperiksa", "selesai", "batal"];

export async function ubahStatus(id: string, status: StatusKunjungan): Promise<{ ok: boolean; error?: string }> {
  if (!STATUS_SAH.includes(status)) return { ok: false, error: "Status tidak dikenal." };
  const supabase = createClient();
  const { data, error } = await supabase.from("encounters").update({ status }).eq("id", id).select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Status belum berubah. Periksa koneksi internet, lalu coba lagi." };
  }
  revalidatePath("/hari-ini");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------- Alergi & riwayat penyakit: siapa pun boleh menambah, hanya Dokter boleh menghapus (RLS) ----------
export async function tambahAlergi(patientId: string, fd: FormData): Promise<void> {
  const daftar = daftarDariTeks(teks(fd, "isi"));
  if (daftar.length) {
    const supabase = createClient();
    await supabase.from("patient_allergies").insert(daftar.map((nama_alergi) => ({ patient_id: patientId, nama_alergi })));
  }
  revalidatePath(`/pasien/${patientId}`);
}

export async function tambahRiwayat(patientId: string, fd: FormData): Promise<void> {
  const daftar = daftarDariTeks(teks(fd, "isi"));
  if (daftar.length) {
    const supabase = createClient();
    await supabase.from("patient_conditions").insert(daftar.map((nama_kondisi) => ({ patient_id: patientId, nama_kondisi })));
  }
  revalidatePath(`/pasien/${patientId}`);
}

export async function hapusAlergi(alergiId: string, patientId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("patient_allergies").delete().eq("id", alergiId);
  revalidatePath(`/pasien/${patientId}`);
}

export async function hapusRiwayat(kondisiId: string, patientId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("patient_conditions").delete().eq("id", kondisiId);
  revalidatePath(`/pasien/${patientId}`);
}
