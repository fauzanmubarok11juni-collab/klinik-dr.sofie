import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatJam, formatTanggal, hariIniWIB, kategoriPasien, teksUmur } from "@/lib/format";
import { jamSesiTeks, nomorWA, susunPesan } from "@/lib/pengingat";
import { batalkanKontrol } from "./actions";
import { TombolPengingat } from "./tombol-pengingat";

type Baris = {
  id: string; tanggal: string; catatan: string | null; pengingat_pada: string | null;
  patients: { nama: string; no_rm: string; tanggal_lahir: string; no_hp: string | null } | null;
  practice_sessions: { kode: "pagi" | "malam"; jam_mulai: string; jam_selesai: string } | null;
};

export default async function JadwalKontrol({ searchParams }: { searchParams: { baru?: string } }) {
  const hariIni = hariIniWIB();
  const tambah = (h: number) => { const d = new Date(hariIni + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + h); return d.toISOString().slice(0, 10); };
  const supabase = createClient();
  const [{ data }, klinik] = await Promise.all([
    supabase.from("control_schedules")
      .select("id, tanggal, catatan, pengingat_pada, patients(nama, no_rm, tanggal_lahir, no_hp), practice_sessions(kode, jam_mulai, jam_selesai)")
      .eq("status", "terjadwal").gte("tanggal", tambah(-30)).lte("tanggal", tambah(7)).order("tanggal").order("created_at"),
    ambilInfoKlinik(),
  ]);
  const semua = ((data ?? []) as unknown as Baris[]).filter((b) => b.patients && b.practice_sessions);

  const kelompok = [
    { judul: "Terlambat (belum datang)", baris: semua.filter((b) => b.tanggal < hariIni), merah: true },
    { judul: "Hari ini", baris: semua.filter((b) => b.tanggal === hariIni), merah: false },
    { judul: "7 hari ke depan", baris: semua.filter((b) => b.tanggal > hariIni), merah: false },
  ];

  const kartu = (b: Baris, terlambat: boolean) => {
    const p = b.patients!, s = b.practice_sessions!;
    const pesan = susunPesan(klinik.templatPengingat, {
      nama: p.nama, anak: kategoriPasien(p.tanggal_lahir) === "anak", tanggal: b.tanggal, sesi: s.kode,
      jamSesi: jamSesiTeks(s.jam_mulai, s.jam_selesai), catatan: b.catatan,
      klinik: klinik.nama, alamat: klinik.alamat, telepon: klinik.telepon,
    });
    const wa = nomorWA(p.no_hp);
    return (
      <li key={b.id} className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">{p.nama}</p>
            <p className="text-redup">{p.no_rm}, {teksUmur(p.tanggal_lahir)}, {p.no_hp ?? "tanpa No. HP"}</p>
            <p className={terlambat ? "font-bold text-bahaya" : ""}>{formatTanggal(b.tanggal, true)}, Sesi {s.kode === "pagi" ? "Pagi" : "Malam"}</p>
            {b.catatan && <p className="text-redup">Catatan: {b.catatan}</p>}
          </div>
          {b.pengingat_pada
            ? <span className="rounded-full border-2 border-berhasil px-3 py-0.5 text-sm font-bold text-berhasil">Sudah diingatkan {formatJam(b.pengingat_pada)}</span>
            : <span className="rounded-full border-2 border-peringatan px-3 py-0.5 text-sm font-bold text-peringatan">Belum diingatkan</span>}
        </div>
        <div className="mt-3"><TombolPengingat id={b.id} pesan={pesan} waHref={wa ? `https://wa.me/${wa}?text=${encodeURIComponent(pesan)}` : null} /></div>
        <form action={batalkanKontrol.bind(null, b.id)} className="mt-2">
          <Button type="submit" variant="senyap">Batalkan jadwal ini</Button>
        </form>
      </li>
    );
  };

  return (
    <>
      <PageHeader judul="Jadwal kontrol" deskripsi="Pasien yang dijadwalkan kontrol. Tekan Salin pesan pengingat, lalu tempel ke WhatsApp. Jadwal otomatis ditandai Sudah datang saat pasien didaftarkan." />
      {searchParams.baru && <div className="mb-4"><Banner>Jadwal kontrol tersimpan.</Banner></div>}
      <div className="space-y-8">
        {kelompok.map((k) => (
          <section key={k.judul} aria-labelledby={`h-${k.judul}`}>
            <h2 id={`h-${k.judul}`} className="mb-3 text-lg font-bold">{k.judul} ({k.baris.length})</h2>
            {k.baris.length === 0 ? <Card><p className="text-redup">Tidak ada.</p></Card> : <ul className="space-y-3">{k.baris.map((b) => kartu(b, k.merah))}</ul>}
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-redup">Jadwal terlambat ditampilkan sampai 30 hari ke belakang. Jadwal untuk pasien tertentu dibuat dari halaman pasien atau Kasir.</p>
    </>
  );
}
