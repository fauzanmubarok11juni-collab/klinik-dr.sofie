"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { wajibRole } from "@/lib/auth";
import { fmtAngka, aturanTeks, jumlahAngka, cariAturan, type ItemCek, type ItemObat, type MedInfo, type Peringatan, type ResepState } from "@/lib/obat";
import { muatPenjualan, angkaAman } from "@/lib/obat-server";
import { hariIniWIB, hitungUmur } from "@/lib/format";
import type { FormState } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TGL = /^\d{4}-\d{2}-\d{2}$/;

export async function cariObat(q: string, hanyaDijual: boolean): Promise<MedInfo[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cari_obat", { p_q: String(q ?? "").slice(0, 60), p_hanya_dijual: !!hanyaDijual, p_limit: 8 });
  if (error || !Array.isArray(data)) return [];
  return (data as MedInfo[]).map((m) => ({ ...m, harga_jual: Number(m.harga_jual), kekuatan_mg: m.kekuatan_mg === null ? null : Number(m.kekuatan_mg) }));
}

const PESAN_AMAN = ["sudah lunas", "Stok tidak cukup", "hari ini", "dibatalkan", "tidak dijual", "Tidak berwenang", "Hanya Dokter", "Tulis alasan", "Jumlah harus"];
function pesanGalat(m: string | undefined, umum: string) {
  const s = m ?? "";
  return PESAN_AMAN.some((k) => s.includes(k)) ? s : umum;
}

/* ---------------- Resep (Dokter) ---------------- */
export async function simpanResepKunjungan(encounterId: string, resep: ResepState): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(encounterId)) return { ok: false, error: "Kunjungan tidak dikenal." };
  const items = (resep?.items ?? []).filter((i) => i && String(i.nama ?? "").trim() !== "").slice(0, 25).map((i) => ({
    medicine_id: i.medicine_id && UUID.test(i.medicine_id) ? i.medicine_id : null,
    nama: String(i.nama).trim().slice(0, 200),
    sediaan: String(i.sediaan ?? "").slice(0, 100),
    satuan: String(i.satuan ?? "tablet").slice(0, 30) || "tablet",
    satuan_dosis: String(i.satuan_dosis ?? "").slice(0, 30),
    per_pakai: angkaAman(i.per_pakai),
    aturan_kode: cariAturan(i.aturan_kode) ? i.aturan_kode : "lain",
    aturan_bebas: String(i.aturan_bebas ?? "").slice(0, 200),
    aturan_teks: aturanTeks(i),
    lama_hari: (() => { const n = angkaAman(i.lama_hari); return n === null ? null : Math.min(365, Math.max(1, Math.round(n))); })(),
    jumlah: Math.min(9999, Math.max(1, jumlahAngka(i) ?? 1)),
    catatan: String(i.catatan ?? "").slice(0, 300),
  }));
  const supabase = createClient();
  const { error } = await supabase.rpc("simpan_resep", {
    p_encounter: encounterId, p_data: { catatan: String(resep?.catatan ?? "").slice(0, 2000), items },
  });
  if (error) return { ok: false, error: pesanGalat(error.message, "Resep belum tersimpan. Periksa koneksi internet.") };
  return { ok: true };
}

/* ---------------- Penjualan (Dokter & Asisten), per baris ---------------- */
type HasilJual = { ok: boolean; error?: string; baris?: ItemObat[] };

export async function setPenjualan(encounterId: string, item: ItemObat): Promise<HasilJual> {
  if (!UUID.test(encounterId) || !item.medicine_id || !UUID.test(item.medicine_id)) return { ok: false, error: "Obat tidak dikenal." };
  const jumlah = jumlahAngka(item);
  if (jumlah === null) return { ok: false, error: "Isi jumlah obat yang dijual." };
  const lama = angkaAman(item.lama_hari);
  const supabase = createClient();
  const { error } = await supabase.rpc("set_penjualan_obat", {
    p_encounter: encounterId, p_medicine: item.medicine_id, p_jumlah: Math.min(9999, jumlah),
    p_per_pakai: angkaAman(item.per_pakai),
    p_aturan_kode: cariAturan(item.aturan_kode) ? item.aturan_kode : "lain",
    p_aturan_bebas: String(item.aturan_bebas ?? "").slice(0, 200),
    p_aturan_teks: aturanTeks(item),
    p_lama_hari: lama === null ? null : Math.min(365, Math.max(1, Math.round(lama))),
  });
  if (error) {
    return { ok: false, error: pesanGalat(error.message, "Penjualan belum tersimpan. Periksa koneksi internet."), baris: await muatPenjualan(supabase, encounterId) };
  }
  revalidatePath("/obat");
  return { ok: true, baris: await muatPenjualan(supabase, encounterId) };
}

export async function hapusPenjualan(encounterId: string, medicineId: string): Promise<HasilJual> {
  if (!UUID.test(encounterId) || !UUID.test(medicineId)) return { ok: false, error: "Data tidak dikenal." };
  const supabase = createClient();
  const { error } = await supabase.rpc("set_penjualan_obat", {
    p_encounter: encounterId, p_medicine: medicineId, p_jumlah: 0, p_per_pakai: null,
    p_aturan_kode: null, p_aturan_bebas: null, p_aturan_teks: "", p_lama_hari: null,
  });
  if (error) return { ok: false, error: pesanGalat(error.message, "Belum terhapus. Periksa koneksi internet."), baris: await muatPenjualan(supabase, encounterId) };
  revalidatePath("/obat");
  return { ok: true, baris: await muatPenjualan(supabase, encounterId) };
}

export async function muatUlangPenjualan(encounterId: string): Promise<ItemObat[]> {
  if (!UUID.test(encounterId)) return [];
  return muatPenjualan(createClient(), encounterId);
}

/* ---------------- Stok ---------------- */
export type StokState = { ok?: boolean; error?: string; pesan?: string };

export async function catatStok(_prev: StokState, fd: FormData): Promise<StokState> {
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const id = t("medicine_id"), tipe = t("tipe"), jumlah = Number(t("jumlah"));
  if (!UUID.test(id)) return { error: "Pilih obatnya terlebih dahulu." };
  if (!["masuk", "keluar"].includes(tipe)) return { error: "Pilih stok masuk atau stok keluar." };
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 100000) return { error: "Jumlah harus angka bulat lebih dari 0." };
  const tanggal = t("tanggal"), expired = t("expired");
  if (tanggal && !TGL.test(tanggal)) return { error: "Tanggal belum benar." };
  if (expired && !TGL.test(expired)) return { error: "Tanggal kedaluwarsa belum benar." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("catat_stok", {
    p_medicine: id, p_tipe: tipe, p_jumlah: jumlah, p_tanggal: tanggal || null,
    p_catatan: t("catatan") || null, p_expired: tipe === "masuk" && expired ? expired : null,
  });
  if (error) return { error: pesanGalat(error.message, "Stok belum tersimpan. Periksa koneksi internet.") };
  revalidatePath("/obat/stok");
  revalidatePath("/obat");
  return { ok: true, pesan: `Stok tersimpan. Stok sekarang ${data}.` };
}

/* ---------------- Daftar obat (Dokter) ---------------- */
export async function simpanObatMaster(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await wajibRole("dokter");
  const t = (k: string) => String(fd.get(k) ?? "").trim();
  const v: Record<string, string> = {
    nama: t("nama"), kekuatan: t("kekuatan"), sediaan: t("sediaan"), kekuatan_mg: t("kekuatan_mg"), satuan: t("satuan"),
    satuan_dosis: t("satuan_dosis"), zat_aktif: t("zat_aktif"), golongan: t("golongan"), harga_jual: t("harga_jual"),
    stok_minimum: t("stok_minimum"), tanggal_expired: t("tanggal_expired"), stok_awal: t("stok_awal"),
    dijual: fd.get("dijual") ? "1" : "", aktif: id === null || fd.get("aktif") ? "1" : "",
  };
  const e: Record<string, string> = {};
  if (!v.nama) e.nama = "Isi nama obat.";
  if (!v.sediaan) e.sediaan = "Isi jenis sediaan (tablet, kapsul, sirup, krim...).";
  if (!v.satuan) e.satuan = "Isi satuan yang diserahkan (tablet, botol, tube...).";
  if (!v.satuan_dosis) e.satuan_dosis = "Isi satuan sekali pakai (tablet, ml, oles...).";
  const mg = v.kekuatan_mg ? angkaAman(v.kekuatan_mg) : null;
  if (v.kekuatan_mg && (mg === null || mg <= 0)) e.kekuatan_mg = "Isi angka mg, atau kosongkan.";
  const harga = v.harga_jual ? angkaAman(v.harga_jual) : 0;
  if (harga === null || harga < 0) e.harga_jual = "Harga harus angka.";
  const min = v.stok_minimum ? Number(v.stok_minimum) : 0;
  if (!Number.isInteger(min) || min < 0) e.stok_minimum = "Isi angka bulat.";
  if (v.tanggal_expired && !TGL.test(v.tanggal_expired)) e.tanggal_expired = "Tanggal belum benar.";
  const awal = v.stok_awal ? Number(v.stok_awal) : 0;
  if (!Number.isInteger(awal) || awal < 0) e.stok_awal = "Isi angka bulat.";
  if (Object.keys(e).length) return { error: "Masih ada isian yang perlu diperbaiki.", errors: e, values: v };

  const baris = {
    nama: v.nama, kekuatan: v.kekuatan, sediaan: v.sediaan, kekuatan_mg: mg, satuan: v.satuan, satuan_dosis: v.satuan_dosis,
    zat_aktif: v.zat_aktif.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean),
    golongan: v.golongan ? v.golongan.toLowerCase() : null,
    dijual: !!v.dijual, harga_jual: harga ?? 0, stok_minimum: min,
    tanggal_expired: v.tanggal_expired || null, aktif: !!v.aktif,
  };
  const supabase = createClient();
  if (id === null) {
    const { data, error } = await supabase.from("medicines").insert(baris).select("id").single();
    if (error || !data) {
      if (error?.code === "23505") return { error: "Obat dengan nama, kekuatan, dan sediaan yang sama sudah ada.", errors: { nama: "Sudah ada." }, values: v };
      return { error: "Obat belum tersimpan. Periksa koneksi internet.", values: v };
    }
    if (baris.dijual && awal > 0) {
      await supabase.rpc("catat_stok", { p_medicine: data.id, p_tipe: "masuk", p_jumlah: awal, p_tanggal: null, p_catatan: "Stok awal", p_expired: null });
    }
  } else {
    const { error } = await supabase.from("medicines").update(baris).eq("id", id);
    if (error) {
      if (error.code === "23505") return { error: "Obat dengan nama, kekuatan, dan sediaan yang sama sudah ada.", errors: { nama: "Sudah ada." }, values: v };
      return { error: "Perubahan belum tersimpan. Periksa koneksi internet.", values: v };
    }
  }
  redirect("/obat/daftar?tersimpan=1");
}

/* ---------------- Peringatan keamanan obat ---------------- */
type MedDb = {
  id: string; nama: string; kekuatan: string; kekuatan_mg: number | null; zat_aktif: string[]; golongan: string | null;
  stok_saat_ini: number; tanggal_expired: string | null;
};
const rendah = (s: string) => s.toLowerCase().trim();
const kunciMed = (m: MedDb) => new Set<string>([...(m.zat_aktif ?? []), m.golongan ?? ""].map(rendah).filter(Boolean));
const tampil = (m: MedDb) => [m.nama, m.kekuatan].filter(Boolean).join(" ");
const BOBOT = { berat: 0, sedang: 1, ringan: 2 } as const;

// Penulisan lain yang sering dipakai untuk alergi -> kata kunci pada daftar obat
const ALIAS: [string, string[]][] = [
  ["amoxicillin", ["amoksisilin", "penisilin"]], ["amoxicilin", ["amoksisilin", "penisilin"]], ["amoksilin", ["amoksisilin", "penisilin"]],
  ["penicillin", ["penisilin"]], ["sulfa", ["sulfonamida", "kotrimoksazol"]], ["bactrim", ["kotrimoksazol"]],
  ["cephalosporin", ["sefalosporin"]], ["aspirin", ["asetosal"]], ["parasetamol", ["paracetamol"]],
  ["anti inflamasi", ["nsaid"]], ["antiinflamasi", ["nsaid"]], ["ciprofloxacin", ["siprofloksasin", "kuinolon"]],
  ["quinolone", ["kuinolon"]], ["makrolid", ["makrolida"]], ["macrolide", ["makrolida"]],
];

export async function cekPeringatan(encounterId: string, items: ItemCek[]): Promise<Peringatan[]> {
  if (!UUID.test(encounterId) || !Array.isArray(items)) return [];
  const sah = items.filter((i) => i && (i.medicine_id === null || UUID.test(i.medicine_id))).slice(0, 40);
  const idsSekarang = Array.from(new Set(sah.map((i) => i.medicine_id).filter((x): x is string => !!x)));
  if (idsSekarang.length === 0) return [];

  const supabase = createClient();
  const { data: encRaw } = await supabase
    .from("encounters")
    .select("id, patient_id, patients(tanggal_lahir, patient_allergies(nama_alergi))")
    .eq("id", encounterId).maybeSingle();
  const enc = encRaw as unknown as { patient_id: string; patients: { tanggal_lahir: string; patient_allergies: { nama_alergi: string }[] } | null } | null;
  if (!enc?.patients) return [];

  const { data: aktifRaw } = await supabase.rpc("obat_aktif_pasien", { p_patient: enc.patient_id, p_kecuali: encounterId });
  const aktif = ((aktifRaw ?? []) as { medicine_id: string | null; nama: string }[]).filter((a) => a.medicine_id && !idsSekarang.includes(a.medicine_id));
  const idsAktif = Array.from(new Set(aktif.map((a) => a.medicine_id as string)));
  // Obat dari luar klinik (dicatat di Klinik Lansia). Hanya Dokter yang bisa membacanya; untuk Asisten hasilnya kosong.
  const { data: extRaw } = await supabase.from("patient_external_meds").select("medicine_id, nama").eq("patient_id", enc.patient_id).eq("aktif", true);
  const ext = (extRaw ?? []) as { medicine_id: string | null; nama: string }[];
  for (const e of ext) if (e.medicine_id && !idsSekarang.includes(e.medicine_id) && !idsAktif.includes(e.medicine_id)) idsAktif.push(e.medicine_id);

  const [medR, vitR, interR, doseR, beersR, jualR] = await Promise.all([
    supabase.from("medicines").select("id, nama, kekuatan, kekuatan_mg, zat_aktif, golongan, stok_saat_ini, tanggal_expired").in("id", [...idsSekarang, ...idsAktif]),
    supabase.from("vitals").select("bb").eq("encounter_id", encounterId).maybeSingle(),
    supabase.from("drug_interactions").select("kunci_a, kunci_b, tingkat, keterangan"),
    supabase.from("drug_dose_rules").select("zat_aktif, anak_min_mg_kg_hari, anak_maks_mg_kg_hari, dewasa_maks_mg_hari, catatan"),
    supabase.from("drug_geriatric_alerts").select("kunci, saran"),
    supabase.from("medicine_sales").select("medicine_id, jumlah").eq("encounter_id", encounterId),
  ]);

  const meds = new Map<string, MedDb>(((medR.data ?? []) as MedDb[]).map((m) => [m.id, { ...m, kekuatan_mg: m.kekuatan_mg === null ? null : Number(m.kekuatan_mg) }]));
  const inter = (interR.data ?? []) as { kunci_a: string; kunci_b: string; tingkat: "berat" | "sedang" | "ringan"; keterangan: string }[];
  const dosis = new Map(((doseR.data ?? []) as { zat_aktif: string; anak_min_mg_kg_hari: number | null; anak_maks_mg_kg_hari: number | null; dewasa_maks_mg_hari: number | null; catatan: string | null }[]).map((r) => [r.zat_aktif, r]));
  const beers = (beersR.data ?? []) as { kunci: string; saran: string }[];
  const sudahTerjual = new Map<string, number>();
  for (const j of (jualR.data ?? []) as { medicine_id: string; jumlah: number }[]) sudahTerjual.set(j.medicine_id, j.jumlah);
  const bb = (vitR.data as { bb: number | null } | null)?.bb ?? null;
  const umur = hitungUmur(enc.patients.tanggal_lahir).tahun;
  const hariIni = hariIniWIB();
  const hasil: Peringatan[] = [];

  const sekarang = idsSekarang.map((id) => meds.get(id)).filter((m): m is MedDb => !!m);

  // 1) Alergi
  for (const al of enc.patients.patient_allergies ?? []) {
    const a = rendah(al.nama_alergi);
    if (!a) continue;
    const alias = ALIAS.filter(([k]) => a.includes(k)).flatMap(([, v]) => v);
    for (const m of sekarang) {
      const token = [rendah(m.nama), ...kunciMed(m)];
      const cocok = token.find((t) => t && (a.includes(t) || (a.length >= 4 && t.includes(a)) || alias.includes(t)));
      if (cocok) hasil.push({ jenis: "alergi", merah: true, pesan: `Pasien tercatat alergi “${al.nama_alergi}”. ${tampil(m)} termasuk ${cocok}.` });
    }
  }

  // 2) Stok & kedaluwarsa (hanya obat yang dijual)
  const batas = new Date(hariIni + "T00:00:00Z"); batas.setUTCDate(batas.getUTCDate() + 30);
  const sampai30 = batas.toISOString().slice(0, 10);
  for (const it of sah.filter((i) => i.sumber === "jual" && i.medicine_id)) {
    const m = meds.get(it.medicine_id!); if (!m) continue;
    const tersedia = m.stok_saat_ini + (sudahTerjual.get(m.id) ?? 0);
    if (it.jumlah !== null && it.jumlah > tersedia) hasil.push({ jenis: "stok", merah: true, pesan: `Stok ${tampil(m)} hanya ${tersedia}, kurang dari jumlah yang dijual (${it.jumlah}).` });
    if (m.tanggal_expired && m.tanggal_expired <= hariIni) hasil.push({ jenis: "stok", merah: true, pesan: `${tampil(m)} sudah kedaluwarsa (${m.tanggal_expired}).` });
    else if (m.tanggal_expired && m.tanggal_expired <= sampai30) hasil.push({ jenis: "stok", merah: false, pesan: `${tampil(m)} akan kedaluwarsa pada ${m.tanggal_expired}.` });
  }

  // 3) Interaksi (antar obat sekarang, dan dengan obat yang masih dipakai dari kunjungan lain)
  const daftar: { m: MedDb; dariLain: boolean }[] = [
    ...sekarang.map((m) => ({ m, dariLain: false })),
    ...idsAktif.map((id) => meds.get(id)).filter((m): m is MedDb => !!m).map((m) => ({ m, dariLain: true })),
  ];
  const interaksi: { b: number; teks: string }[] = [];
  for (let i = 0; i < daftar.length; i++) {
    for (let j = i + 1; j < daftar.length; j++) {
      if (daftar[i].dariLain && daftar[j].dariLain) continue;
      const A = daftar[i].m, B = daftar[j].m;
      if (A.id === B.id) continue;
      const KA = kunciMed(A), KB = kunciMed(B);
      let terbaik: (typeof inter)[number] | null = null;
      for (const r of inter) {
        const cocok = (KA.has(r.kunci_a) && KB.has(r.kunci_b)) || (KA.has(r.kunci_b) && KB.has(r.kunci_a));
        if (cocok && (!terbaik || BOBOT[r.tingkat] < BOBOT[terbaik.tingkat])) terbaik = r;
      }
      if (terbaik) {
        const lain = daftar[i].dariLain ? A : daftar[j].dariLain ? B : null;
        interaksi.push({
          b: BOBOT[terbaik.tingkat],
          teks: `Interaksi ${terbaik.tingkat}: ${tampil(A)} + ${tampil(B)}${lain ? ` (${tampil(lain)} masih dipakai dari kunjungan sebelumnya)` : ""}. ${terbaik.keterangan}`,
        });
      }
    }
  }
  interaksi.sort((x, y) => x.b - y.b).slice(0, 10).forEach((x) => hasil.push({ jenis: "interaksi", merah: false, pesan: x.teks }));

  // 4) Obat sama dipakai dua kali / zat sama pada dua obat
  const jenisSumber = new Map<string, Set<string>>();
  for (const it of sah) if (it.medicine_id) jenisSumber.set(it.medicine_id, (jenisSumber.get(it.medicine_id) ?? new Set()).add(it.sumber));
  for (const [id, s] of Array.from(jenisSumber)) {
    const m = meds.get(id);
    if (m && s.size > 1) hasil.push({ jenis: "duplikat", merah: false, pesan: `${tampil(m)} tercatat di resep sekaligus dijual di klinik.` });
  }
  for (let i = 0; i < sekarang.length; i++) for (let j = i + 1; j < sekarang.length; j++) {
    const sama = (sekarang[i].zat_aktif ?? []).filter((z) => (sekarang[j].zat_aktif ?? []).includes(z));
    if (sama.length) hasil.push({ jenis: "duplikat", merah: false, pesan: `${tampil(sekarang[i])} dan ${tampil(sekarang[j])} sama-sama mengandung ${sama.join(", ")}.` });
  }

  // 5) Dosis
  let butuhBB = false;
  for (const it of sah) {
    const m = it.medicine_id ? meds.get(it.medicine_id) : undefined;
    if (!m || m.kekuatan_mg === null || (m.zat_aktif ?? []).length !== 1 || it.per_pakai === null || it.kali === null || it.per_pakai <= 0) continue;
    const rule = dosis.get(rendah(m.zat_aktif[0]));
    if (!rule) continue;
    const mgHari = it.per_pakai * m.kekuatan_mg * it.kali;
    const ket = it.prn ? ` (dihitung ${it.kali}× sehari)` : "";
    if (umur < 18) {
      if (rule.anak_maks_mg_kg_hari !== null && rule.anak_min_mg_kg_hari !== null) {
        if (bb === null || bb <= 0) { butuhBB = true; continue; }
        const perKg = mgHari / bb;
        const rentang = `${fmtAngka(Number(rule.anak_min_mg_kg_hari))}–${fmtAngka(Number(rule.anak_maks_mg_kg_hari))} mg/kg/hari`;
        if (perKg > Number(rule.anak_maks_mg_kg_hari)) hasil.push({ jenis: "dosis", merah: false, pesan: `Dosis ${tampil(m)} sekitar ${fmtAngka(Math.round(perKg * 10) / 10)} mg/kg/hari${ket}, melebihi batas biasa untuk anak (${rentang}).${rule.catatan ? " " + rule.catatan : ""}` });
        else if (perKg < Number(rule.anak_min_mg_kg_hari)) hasil.push({ jenis: "dosis", merah: false, pesan: `Dosis ${tampil(m)} sekitar ${fmtAngka(Math.round(perKg * 10) / 10)} mg/kg/hari${ket}, di bawah rentang biasa untuk anak (${rentang}).${rule.catatan ? " " + rule.catatan : ""}` });
      } else if (rule.dewasa_maks_mg_hari !== null && mgHari > Number(rule.dewasa_maks_mg_hari)) {
        hasil.push({ jenis: "dosis", merah: false, pesan: `Dosis ${tampil(m)} ${fmtAngka(Math.round(mgHari))} mg/hari${ket} melebihi batas maksimum dewasa, apalagi untuk anak.` });
      }
    } else if (rule.dewasa_maks_mg_hari !== null && mgHari > Number(rule.dewasa_maks_mg_hari)) {
      hasil.push({ jenis: "dosis", merah: false, pesan: `Dosis harian ${tampil(m)} ${fmtAngka(Math.round(mgHari))} mg${ket} melebihi batas umum ${fmtAngka(Number(rule.dewasa_maks_mg_hari))} mg/hari.` });
    }
  }
  if (butuhBB) hasil.push({ jenis: "info", merah: false, pesan: "Isi berat badan di tab Objective agar dosis anak bisa diperiksa per kg." });

  // 6) Lansia (kriteria Beers ringkas; berlaku bagi usia 60 tahun ke atas)
  if (umur >= 60) {
    for (const m of sekarang) {
      const K = kunciMed(m);
      const kena = beers.filter((b) => K.has(rendah(b.kunci)));
      if (kena.length) hasil.push({ jenis: "lansia", merah: false, pesan: `Lansia: ${tampil(m)}. ${kena[0].saran} (kriteria Beers ringkas)` });
    }
  }

  // 7) Polifarmasi (lansia): obat aktif lebih dari 5 bila resep ini ditambahkan
  if (umur >= 60) {
    const total = new Set([...idsSekarang, ...idsAktif]).size + ext.filter((e) => !e.medicine_id).length;
    if (total > 5) hasil.push({ jenis: "info", merah: false, pesan: `Polifarmasi: ${total} obat aktif bila resep ini ditambahkan (lebih dari 5). Tinjau apakah semuanya masih diperlukan.` });
  }

  const urut = { alergi: 0, stok: 1, interaksi: 2, dosis: 3, duplikat: 4, lansia: 5, info: 6 } as const;
  return hasil.sort((a, b) => Number(b.merah) - Number(a.merah) || urut[a.jenis] - urut[b.jenis]).slice(0, 15);
}
