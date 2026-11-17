// Skrining tumbuh kembang sederhana: butir per usia (tabel developmental_milestones) dan penilaiannya.
export const CHECKPOINT = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];
export const DOMAIN_LABEL: Record<string, string> = { motorik: "Motorik (gerak)", bahasa: "Bahasa dan komunikasi", sosial: "Sosial dan emosi" };
export type Jawab = "ya" | "tidak" | "belum";
export type Hasil = "sesuai" | "meragukan" | "rujuk";

/** Butir yang dipakai = checkpoint terbesar yang tidak melebihi umur anak. Kosong bila di luar 2–71 bulan. */
export function pilihCheckpoint(umurBulan: number): number | null {
  if (umurBulan < 2 || umurBulan >= 72) return null;
  return [...CHECKPOINT].reverse().find((c) => c <= umurBulan) ?? null;
}

export function nilaiPerkembangan(
  jawaban: Record<string, string>, ids: string[], khawatir: boolean, kemunduran: boolean
): { hasil: Hasil; tidak: number; belum: number; tidakPerDomain: Record<string, number> } {
  const tidakPerDomain: Record<string, number> = {};
  let tidak = 0, belum = 0;
  for (const id of ids) {
    const j = jawaban[id] ?? "belum";
    const domain = id.split("-")[0];
    if (j === "tidak") { tidak++; tidakPerDomain[domain] = (tidakPerDomain[domain] ?? 0) + 1; }
    else if (j !== "ya") belum++;
  }
  const dua = Object.values(tidakPerDomain).some((n) => n >= 2);
  let hasil: Hasil = "sesuai";
  if (tidak === 1 || belum >= 2 || khawatir) hasil = "meragukan";
  if (dua || tidak >= 2 || kemunduran || (khawatir && tidak >= 1)) hasil = "rujuk";
  return { hasil, tidak, belum, tidakPerDomain };
}

export const TAFSIR: Record<Hasil, { label: string; saran: string }> = {
  sesuai: { label: "Perkembangan sesuai usia", saran: "Lanjutkan stimulasi sesuai usia. Ulangi skrining pada usia pemeriksaan berikutnya." },
  meragukan: { label: "Meragukan", saran: "Ulangi skrining 2 sampai 4 minggu lagi, berikan stimulasi sesuai usia, dan pertimbangkan penilaian lanjutan bila kemampuan tetap belum tercapai." },
  rujuk: { label: "Perlu rujukan", saran: "Pertimbangkan rujukan untuk penilaian tumbuh kembang lebih lanjut (mis. dokter anak atau klinik tumbuh kembang)." },
};
export const CATATAN_SKRINING = "Skrining sederhana, bukan diagnosis. Butir disusun dari tonggak perkembangan umum, bukan pengganti KPSP atau Denver II.";
