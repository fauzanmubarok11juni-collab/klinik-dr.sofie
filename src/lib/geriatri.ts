// Lima instrumen skrining geriatri. Skor selalu dihitung ulang di server dari jawaban (tidak mempercayai skor dari layar).
export type JenisGeri = "morse" | "barthel" | "mna_sf" | "mini_cog" | "gds15";
export type Pilihan = { nilai: string; label: string; skor: number };
export type Butir = { id: string; tanya: string; pilihan: Pilihan[]; bantuan?: string };
export type Tafsir = { label: string; tingkat: "normal" | "perhatian" | "bahaya"; saran?: string };
export type Instrumen = { kode: JenisGeri; nama: string; singkat: string; deskripsi: string; maks: number; butir: Butir[]; tafsir: (skor: number) => Tafsir };

const yaTidak = (ya: number, tidak: number): Pilihan[] => [{ nilai: "tidak", label: "Tidak", skor: tidak }, { nilai: "ya", label: "Ya", skor: ya }];

const MORSE: Instrumen = {
  kode: "morse", nama: "Risiko jatuh (Morse Fall Scale)", singkat: "Morse", maks: 125,
  deskripsi: "Menilai risiko jatuh. Skor 0–125; makin tinggi makin berisiko.",
  butir: [
    { id: "riwayat", tanya: "Pernah jatuh dalam 3 bulan terakhir?", pilihan: yaTidak(25, 0) },
    { id: "diagnosis", tanya: "Memiliki lebih dari satu diagnosis medis?", pilihan: yaTidak(15, 0) },
    { id: "alat", tanya: "Alat bantu jalan", pilihan: [
      { nilai: "tidak", label: "Tidak memakai, dibantu perawat, atau tirah baring", skor: 0 },
      { nilai: "tongkat", label: "Tongkat, kruk, atau walker", skor: 15 },
      { nilai: "perabot", label: "Berpegangan pada perabot", skor: 30 }] },
    { id: "infus", tanya: "Terpasang infus atau terapi intravena?", pilihan: yaTidak(20, 0) },
    { id: "jalan", tanya: "Cara berjalan", pilihan: [
      { nilai: "normal", label: "Normal, tirah baring, atau tidak dapat berjalan", skor: 0 },
      { nilai: "lemah", label: "Lemah", skor: 10 },
      { nilai: "terganggu", label: "Terganggu (sulit bangkit, langkah tidak stabil)", skor: 20 }] },
    { id: "mental", tanya: "Status mental", pilihan: [
      { nilai: "sadar", label: "Menyadari kemampuan dirinya", skor: 0 },
      { nilai: "lupa", label: "Lupa atau melebihi kemampuan dirinya", skor: 15 }] },
  ],
  tafsir: (s) => s <= 24 ? { label: "Tidak berisiko jatuh", tingkat: "normal" }
    : s <= 50 ? { label: "Risiko jatuh rendah", tingkat: "perhatian", saran: "Edukasi pencegahan jatuh, periksa alas kaki dan penerangan rumah." }
    : { label: "Risiko jatuh tinggi", tingkat: "bahaya", saran: "Lakukan intervensi pencegahan jatuh, tinjau obat penyebab pusing atau kantuk, pertimbangkan alat bantu dan fisioterapi." },
};

const opsi = (daftar: [string, string, number][]): Pilihan[] => daftar.map(([nilai, label, skor]) => ({ nilai, label, skor }));
const BARTHEL: Instrumen = {
  kode: "barthel", nama: "Kemandirian aktivitas harian (Indeks Barthel)", singkat: "Barthel", maks: 100,
  deskripsi: "Menilai kemandirian 10 aktivitas sehari-hari. Skor 0–100; makin tinggi makin mandiri.",
  butir: [
    { id: "makan", tanya: "Makan", pilihan: opsi([["0", "Tidak mampu", 0], ["5", "Perlu bantuan (memotong, mengoles)", 5], ["10", "Mandiri", 10]]) },
    { id: "mandi", tanya: "Mandi", pilihan: opsi([["0", "Tergantung orang lain", 0], ["5", "Mandiri", 5]]) },
    { id: "rawat", tanya: "Perawatan diri (wajah, rambut, gigi, bercukur)", pilihan: opsi([["0", "Perlu bantuan", 0], ["5", "Mandiri", 5]]) },
    { id: "pakaian", tanya: "Berpakaian", pilihan: opsi([["0", "Tergantung orang lain", 0], ["5", "Perlu bantuan sebagian", 5], ["10", "Mandiri", 10]]) },
    { id: "bab", tanya: "Buang air besar", pilihan: opsi([["0", "Tidak terkendali", 0], ["5", "Kadang tidak terkendali", 5], ["10", "Terkendali", 10]]) },
    { id: "bak", tanya: "Buang air kecil", pilihan: opsi([["0", "Tidak terkendali atau memakai kateter", 0], ["5", "Kadang tidak terkendali", 5], ["10", "Terkendali", 10]]) },
    { id: "toilet", tanya: "Penggunaan toilet", pilihan: opsi([["0", "Tergantung orang lain", 0], ["5", "Perlu bantuan sebagian", 5], ["10", "Mandiri", 10]]) },
    { id: "pindah", tanya: "Berpindah (dari tempat tidur ke kursi dan sebaliknya)", pilihan: opsi([
      ["0", "Tidak mampu, tidak bisa duduk seimbang", 0], ["5", "Bantuan besar (1–2 orang), bisa duduk", 5], ["10", "Bantuan kecil (aba-aba atau sentuhan)", 10], ["15", "Mandiri", 15]]) },
    { id: "jalan", tanya: "Mobilitas di permukaan datar", pilihan: opsi([
      ["0", "Tidak bergerak atau kurang dari 50 meter", 0], ["5", "Mandiri dengan kursi roda lebih dari 50 meter", 5], ["10", "Berjalan dibantu satu orang lebih dari 50 meter", 10], ["15", "Mandiri (boleh dengan alat bantu) lebih dari 50 meter", 15]]) },
    { id: "tangga", tanya: "Naik turun tangga", pilihan: opsi([["0", "Tidak mampu", 0], ["5", "Perlu bantuan", 5], ["10", "Mandiri", 10]]) },
  ],
  tafsir: (s) => s === 100 ? { label: "Mandiri", tingkat: "normal" }
    : s >= 91 ? { label: "Ketergantungan ringan", tingkat: "perhatian" }
    : s >= 61 ? { label: "Ketergantungan sedang", tingkat: "perhatian", saran: "Pertimbangkan bantuan pendamping dan latihan kemandirian." }
    : s >= 21 ? { label: "Ketergantungan berat", tingkat: "bahaya", saran: "Perlu pendamping untuk sebagian besar aktivitas; pertimbangkan perawatan di rumah dan fisioterapi." }
    : { label: "Ketergantungan total", tingkat: "bahaya", saran: "Perlu bantuan penuh; diskusikan rencana perawatan dengan keluarga." },
};

const MNA: Instrumen = {
  kode: "mna_sf", nama: "Status gizi lansia (MNA-SF)", singkat: "MNA-SF", maks: 14,
  deskripsi: "Skrining gizi singkat (6 pertanyaan). Skor 0–14; di bawah 12 berarti perlu perhatian.",
  butir: [
    { id: "asupan", tanya: "Dalam 3 bulan terakhir, apakah asupan makan menurun karena hilang nafsu makan, masalah pencernaan, atau sulit mengunyah/menelan?", pilihan: opsi([["berat", "Menurun berat", 0], ["sedang", "Menurun sedang", 1], ["tidak", "Tidak menurun", 2]]) },
    { id: "berat", tanya: "Penurunan berat badan dalam 3 bulan terakhir", pilihan: opsi([["lebih3", "Lebih dari 3 kg", 0], ["taktahu", "Tidak tahu", 1], ["1-3", "1 sampai 3 kg", 2], ["tidak", "Tidak turun", 3]]) },
    { id: "mobilitas", tanya: "Mobilitas", pilihan: opsi([["tempat tidur", "Hanya di tempat tidur atau kursi", 0], ["rumah", "Dapat turun dari tempat tidur tetapi tidak keluar rumah", 1], ["keluar", "Dapat keluar rumah", 2]]) },
    { id: "stres", tanya: "Mengalami stres psikologis atau penyakit akut dalam 3 bulan terakhir?", pilihan: opsi([["ya", "Ya", 0], ["tidak", "Tidak", 2]]) },
    { id: "neuro", tanya: "Masalah neuropsikologis", pilihan: opsi([["berat", "Demensia atau depresi berat", 0], ["ringan", "Demensia ringan", 1], ["tidak", "Tidak ada masalah", 2]]) },
    { id: "imt", tanya: "Indeks massa tubuh (IMT)", bantuan: "Bila IMT tidak dapat dihitung, boleh memakai lingkar betis: di bawah 31 cm = 0, 31 cm atau lebih = 3.",
      pilihan: opsi([["<19", "IMT kurang dari 19 (atau lingkar betis < 31 cm)", 0], ["19-21", "IMT 19 sampai kurang dari 21", 1], ["21-23", "IMT 21 sampai kurang dari 23", 2], [">=23", "IMT 23 atau lebih (atau lingkar betis ≥ 31 cm)", 3]]) },
  ],
  tafsir: (s) => s >= 12 ? { label: "Status gizi normal", tingkat: "normal" }
    : s >= 8 ? { label: "Berisiko malnutrisi", tingkat: "perhatian", saran: "Evaluasi asupan makan, kesehatan gigi dan mulut, dan pertimbangkan konsultasi gizi." }
    : { label: "Malnutrisi", tingkat: "bahaya", saran: "Perlu penilaian gizi lengkap dan tata laksana gizi." },
};

const MINICOG: Instrumen = {
  kode: "mini_cog", nama: "Fungsi kognitif (Mini-Cog)", singkat: "Mini-Cog", maks: 5,
  deskripsi: "Ingat 3 kata (0–3 poin) ditambah menggambar jam (normal 2 poin, tidak normal 0). Skor kurang dari 3 = skrining positif.",
  butir: [
    { id: "kata", tanya: "Berapa dari 3 kata yang dapat diingat kembali setelah menggambar jam?", pilihan: opsi([["0", "0 kata", 0], ["1", "1 kata", 1], ["2", "2 kata", 2], ["3", "3 kata", 3]]) },
    { id: "jam", tanya: "Gambar jam (semua angka benar dan jarum menunjuk waktu yang diminta)", pilihan: opsi([["tidak normal", "Tidak normal", 0], ["normal", "Normal", 2]]) },
  ],
  tafsir: (s) => s >= 3 ? { label: "Skrining negatif (gangguan kognitif kecil kemungkinannya)", tingkat: "normal" }
    : { label: "Skrining positif (kemungkinan gangguan kognitif)", tingkat: "perhatian", saran: "Lakukan penilaian kognitif lebih lanjut dan singkirkan penyebab yang dapat diperbaiki (obat, depresi, gangguan metabolik)." },
};

// GDS-15: skor 1 diberikan bila jawabannya sesuai kolom "skorYa" (jawab Ya = 1) atau "tidak" (jawab Tidak = 1).
const gds = (id: string, tanya: string, skorBila: "ya" | "tidak"): Butir => ({
  id, tanya, pilihan: skorBila === "ya" ? yaTidak(1, 0) : yaTidak(0, 1),
});
const GDS: Instrumen = {
  kode: "gds15", nama: "Depresi lansia (GDS-15)", singkat: "GDS-15", maks: 15,
  deskripsi: "15 pertanyaan ya/tidak tentang perasaan dalam seminggu terakhir. Skor 5 atau lebih menandakan perlu evaluasi depresi.",
  butir: [
    gds("g1", "Apakah Anda pada dasarnya puas dengan kehidupan Anda?", "tidak"),
    gds("g2", "Apakah Anda sudah meninggalkan banyak kegiatan dan minat Anda?", "ya"),
    gds("g3", "Apakah Anda merasa hidup Anda kosong?", "ya"),
    gds("g4", "Apakah Anda sering merasa bosan?", "ya"),
    gds("g5", "Apakah suasana hati Anda baik hampir sepanjang waktu?", "tidak"),
    gds("g6", "Apakah Anda takut sesuatu yang buruk akan terjadi pada Anda?", "ya"),
    gds("g7", "Apakah Anda merasa bahagia hampir sepanjang waktu?", "tidak"),
    gds("g8", "Apakah Anda sering merasa tidak berdaya?", "ya"),
    gds("g9", "Apakah Anda lebih suka tinggal di rumah daripada keluar dan mencoba hal-hal baru?", "ya"),
    gds("g10", "Apakah Anda merasa lebih banyak masalah ingatan dibanding kebanyakan orang?", "ya"),
    gds("g11", "Apakah Anda merasa senang masih hidup sekarang?", "tidak"),
    gds("g12", "Apakah Anda merasa tidak berharga dengan keadaan Anda sekarang?", "ya"),
    gds("g13", "Apakah Anda merasa penuh tenaga?", "tidak"),
    gds("g14", "Apakah Anda merasa keadaan Anda tanpa harapan?", "ya"),
    gds("g15", "Apakah Anda merasa kebanyakan orang lebih baik keadaannya daripada Anda?", "ya"),
  ],
  tafsir: (s) => s <= 4 ? { label: "Normal", tingkat: "normal" }
    : s <= 8 ? { label: "Kemungkinan depresi ringan", tingkat: "perhatian", saran: "Skor 5 atau lebih perlu evaluasi lebih lanjut. Tanyakan tentang pikiran menyakiti diri bila ada kekhawatiran." }
    : s <= 11 ? { label: "Kemungkinan depresi sedang", tingkat: "bahaya", saran: "Perlu evaluasi dan tata laksana depresi. Tanyakan tentang pikiran menyakiti diri." }
    : { label: "Kemungkinan depresi berat", tingkat: "bahaya", saran: "Perlu evaluasi segera dan tata laksana depresi. Tanyakan tentang pikiran menyakiti diri." },
};

export const INSTRUMEN: Record<JenisGeri, Instrumen> = { morse: MORSE, barthel: BARTHEL, mna_sf: MNA, mini_cog: MINICOG, gds15: GDS };
export const URUT_GERI: JenisGeri[] = ["morse", "barthel", "mna_sf", "mini_cog", "gds15"];
export const adalahJenis = (x: string): x is JenisGeri => x in INSTRUMEN;

export function hitungSkrining(kode: JenisGeri, jawaban: Record<string, string>): { lengkap: boolean; skor: number; tafsir: Tafsir; hilang: string[] } {
  const ins = INSTRUMEN[kode];
  let skor = 0;
  const hilang: string[] = [];
  for (const b of ins.butir) {
    const p = b.pilihan.find((x) => x.nilai === jawaban[b.id]);
    if (!p) hilang.push(b.id); else skor += p.skor;
  }
  return { lengkap: hilang.length === 0, skor, tafsir: ins.tafsir(skor), hilang };
}

/** Pilihan IMT untuk MNA-SF dari IMT yang dihitung. */
export function pilihanImtMna(imt: number | null): string | undefined {
  if (imt === null || !Number.isFinite(imt)) return undefined;
  return imt < 19 ? "<19" : imt < 21 ? "19-21" : imt < 23 ? "21-23" : ">=23";
}
