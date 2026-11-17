// Pemuat tabel WHO dan penghitung hasil pertumbuhan anak (sisi server).
import type { createClient } from "@/lib/supabase/server";
import {
  META, indikatorBerlaku, interpolasi, klasifikasi, nilaiIndikator, tidakWajar, umurBulanDesimal, zScore, panjangTinggiTerkoreksi,
  type Indikator, type LMSRow, type Tingkat,
} from "@/lib/who";

type Klien = ReturnType<typeof createClient>;

export type Catatan = {
  id: string; tanggal: string; umur_bulan: number; bb: number | null; tb: number | null; cara_ukur: "berbaring" | "berdiri" | null;
  lingkar_kepala: number | null; pesan_orang_tua: string | null;
};
export type HasilIndikator = { y: number; kunci: number; z: number | null; label: string; tingkat: Tingkat; tidakWajar: boolean };
export type HasilCatatan = Catatan & { tbTerkoreksi: number | null; hasil: Partial<Record<Indikator, HasilIndikator>> };

export async function muatLMS(supabase: Klien, ind: Indikator, sex: string, dari: number, sampai: number): Promise<LMSRow[]> {
  const { data } = await supabase
    .from("who_lms").select("kunci, l, m, s")
    .eq("indikator", ind).eq("sex", sex).gte("kunci", dari).lte("kunci", sampai).order("kunci").limit(1000);
  return ((data ?? []) as { kunci: number; l: number; m: number; s: number }[]).map((r) => ({ kunci: Number(r.kunci), l: Number(r.l), m: Number(r.m), s: Number(r.s) }));
}

/** Menghitung Z-score dan status tiap indikator untuk semua catatan. `kurang` = indikator yang tabel WHO-nya belum diimpor. */
export async function hitungHasilAnak(
  supabase: Klien, sex: string, tanggalLahir: string, catatan: Catatan[]
): Promise<{ baris: HasilCatatan[]; kurang: Indikator[] }> {
  const umur = (c: Catatan) => (c.umur_bulan ?? umurBulanDesimal(tanggalLahir, c.tanggal));
  const pengukuran = (c: Catatan) => ({ bb: c.bb === null ? null : Number(c.bb), tb: c.tb === null ? null : Number(c.tb), lk: c.lingkar_kepala === null ? null : Number(c.lingkar_kepala), cara: c.cara_ukur, umurBulan: Number(umur(c)) });

  // Kunci yang dibutuhkan per indikator, lalu muat tabelnya sekali saja
  const butuh = new Map<Indikator, { min: number; max: number }>();
  for (const c of catatan) {
    const p = pengukuran(c);
    for (const ind of indikatorBerlaku(p.umurBulan)) {
      const v = nilaiIndikator(ind, p);
      if (!v) continue;
      const cur = butuh.get(ind);
      butuh.set(ind, { min: Math.min(cur?.min ?? v.kunci, v.kunci), max: Math.max(cur?.max ?? v.kunci, v.kunci) });
    }
  }
  const tabel = new Map<Indikator, LMSRow[]>();
  const kurang: Indikator[] = [];
  await Promise.all(Array.from(butuh.entries()).map(async ([ind, r]) => {
    const rows = await muatLMS(supabase, ind, sex, r.min - 2, r.max + 2);
    tabel.set(ind, rows);
    if (rows.length === 0) kurang.push(ind);
  }));

  const baris: HasilCatatan[] = catatan.map((c) => {
    const p = pengukuran(c);
    const hasil: HasilCatatan["hasil"] = {};
    for (const ind of indikatorBerlaku(p.umurBulan)) {
      const v = nilaiIndikator(ind, p);
      if (!v) continue;
      const lms = interpolasi(tabel.get(ind) ?? [], v.kunci);
      if (!lms) { hasil[ind] = { y: v.y, kunci: v.kunci, z: null, label: "Belum dapat dihitung (di luar tabel WHO)", tingkat: "info", tidakWajar: false }; continue; }
      const z = zScore(v.y, lms, META[ind].sesuaikan);
      const k = klasifikasi(ind, z, p.umurBulan);
      hasil[ind] = { y: v.y, kunci: v.kunci, z, label: k.label, tingkat: k.tingkat, tidakWajar: tidakWajar(ind, z) };
    }
    return { ...c, umur_bulan: p.umurBulan, tbTerkoreksi: p.tb === null ? null : panjangTinggiTerkoreksi(p.tb, p.umurBulan, p.cara), hasil };
  });
  return { baris, kurang };
}

export async function ringkasanWHO(supabase: Klien): Promise<{ indikator: Indikator; sex: string; jumlah: number; min_kunci: number; max_kunci: number }[]> {
  const { data } = await supabase.rpc("who_lms_ringkasan");
  return ((data ?? []) as { indikator: Indikator; sex: string; jumlah: number; min_kunci: number; max_kunci: number }[])
    .map((r) => ({ ...r, min_kunci: Number(r.min_kunci), max_kunci: Number(r.max_kunci) }));
}
