// Fungsi murni untuk menganalisis daftar obat (rekonsiliasi). Memakai tabel interaksi dan Beers yang sama dengan resep.
export type MedAnalisis = { kunciId: string; nama: string; zat: string[]; golongan: string | null; sumber: "klinik" | "luar" };
export type AturanInteraksi = { kunci_a: string; kunci_b: string; tingkat: "berat" | "sedang" | "ringan"; keterangan: string };

const rendah = (s: string) => s.toLowerCase().trim();
export const kunciObat = (m: MedAnalisis) => new Set<string>([...m.zat, m.golongan ?? ""].map(rendah).filter(Boolean));
const BOBOT = { berat: 0, sedang: 1, ringan: 2 } as const;
const GOLONGAN_ABAIKAN = ["vitamin", "suplemen zinc", "antasida"];

export function interaksiTerberat(a: MedAnalisis, b: MedAnalisis, aturan: AturanInteraksi[]): AturanInteraksi | null {
  const KA = kunciObat(a), KB = kunciObat(b);
  let t: AturanInteraksi | null = null;
  for (const r of aturan) {
    const cocok = (KA.has(r.kunci_a) && KB.has(r.kunci_b)) || (KA.has(r.kunci_b) && KB.has(r.kunci_a));
    if (cocok && (!t || BOBOT[r.tingkat] < BOBOT[t.tingkat])) t = r;
  }
  return t;
}

export type HasilAnalisis = { jenis: "polifarmasi" | "interaksi" | "duplikasi" | "lansia"; merah: boolean; pesan: string };

export function analisisObat(
  obat: MedAnalisis[], umur: number, aturan: AturanInteraksi[], beers: { kunci: string; saran: string }[]
): HasilAnalisis[] {
  const hasil: HasilAnalisis[] = [];
  if (obat.length > 5) {
    hasil.push({ jenis: "polifarmasi", merah: false, pesan: `Polifarmasi: ${obat.length} obat aktif (lebih dari 5). Tinjau apakah semuanya masih diperlukan, dan cari duplikasi atau obat yang bisa dihentikan.` });
  }
  const interaksi: { b: number; pesan: string }[] = [];
  for (let i = 0; i < obat.length; i++) {
    for (let j = i + 1; j < obat.length; j++) {
      const A = obat[i], B = obat[j];
      const r = interaksiTerberat(A, B, aturan);
      if (r) { interaksi.push({ b: BOBOT[r.tingkat], pesan: `Interaksi ${r.tingkat}: ${A.nama} + ${B.nama}. ${r.keterangan}` }); continue; }
      const zatSama = A.zat.filter((z) => B.zat.includes(z));
      if (zatSama.length) { hasil.push({ jenis: "duplikasi", merah: false, pesan: `${A.nama} dan ${B.nama} sama-sama mengandung ${zatSama.join(", ")}.` }); continue; }
      if (A.golongan && A.golongan === B.golongan && !GOLONGAN_ABAIKAN.includes(rendah(A.golongan))) {
        hasil.push({ jenis: "duplikasi", merah: false, pesan: `Duplikasi golongan (${A.golongan}): ${A.nama} dan ${B.nama}. Pastikan memang disengaja.` });
      }
    }
  }
  interaksi.sort((x, y) => x.b - y.b).forEach((x) => hasil.push({ jenis: "interaksi", merah: false, pesan: x.pesan }));
  if (umur >= 60) {
    for (const m of obat) {
      const K = kunciObat(m);
      const kena = beers.filter((b) => K.has(rendah(b.kunci)));
      if (kena.length) hasil.push({ jenis: "lansia", merah: false, pesan: `${m.nama}. ${kena[0].saran} (kriteria Beers ringkas)` });
    }
  }
  return hasil;
}
