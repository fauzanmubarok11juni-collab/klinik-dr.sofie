import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { muatResepTerakhir } from "@/lib/obat-server";
import { aturanTeks } from "@/lib/obat";
import { PageHeader } from "@/components/page-header";
import { TombolCetak } from "@/components/tombol-cetak";
import { Banner } from "@/components/ui/card";
import { GrafikPertumbuhan } from "@/components/grafik-pertumbuhan";
import { NavKlinik } from "@/components/nav-klinik";
import { LABEL_JK, formatTanggal, hariIniWIB, teksUmur } from "@/lib/format";
import { META, URUT_INDIKATOR, fmtZ, indikatorBerlaku, kurvaDariTabel, teksUmurBulan, umurBulanDesimal, type Indikator } from "@/lib/who";
import { hitungHasilAnak, muatLMS, type Catatan } from "@/lib/anak-server";
import { TAFSIR, type Hasil } from "@/lib/perkembangan";

export default async function CetakRingkasanAnak({ params }: { params: { id: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("id, nama, no_rm, tanggal_lahir, jenis_kelamin").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const hariIni = hariIniWIB();
  const umurNow = umurBulanDesimal(p.tanggal_lahir, hariIni);

  const [recR, scrR, kontrolR, resep, klinik] = await Promise.all([
    supabase.from("growth_records").select("id, tanggal, umur_bulan, bb, tb, cara_ukur, lingkar_kepala, pesan_orang_tua").eq("patient_id", p.id).order("tanggal"),
    supabase.from("developmental_screenings").select("tanggal, hasil, perlu_rujukan").eq("patient_id", p.id).order("tanggal", { ascending: false }).limit(1),
    supabase.from("control_schedules").select("tanggal, practice_sessions(nama)").eq("patient_id", p.id).eq("status", "terjadwal").gte("tanggal", hariIni).order("tanggal").limit(1),
    muatResepTerakhir(supabase, p.id, "00000000-0000-0000-0000-000000000000"),
    ambilInfoKlinik(),
  ]);
  const catatan = (recR.data ?? []) as Catatan[];
  const { baris } = await hitungHasilAnak(supabase, p.jenis_kelamin, p.tanggal_lahir, catatan);
  const terakhir = baris[baris.length - 1];
  const scr = (scrR.data as { tanggal: string; hasil: Hasil; perlu_rujukan: boolean }[] | null)?.[0];
  const kontrol = (kontrolR.data as unknown as { tanggal: string; practice_sessions: { nama: string } | null }[] | null)?.[0];

  // Dua grafik utama untuk orang tua: BB/U dan PB/U atau TB/U
  const berlaku = indikatorBerlaku(umurNow);
  const grafikInd = (["wfa", "hfa"] as Indikator[]).filter((i) => berlaku.includes(i));
  const grafik = await Promise.all(grafikInd.map(async (ind) => {
    const [a, b] = umurNow <= 60 ? [0, 60] : [60, ind === "wfa" ? 120 : 228];
    const rows = await muatLMS(supabase, ind, p.jenis_kelamin, a, b);
    return { ind, rows, kurva: kurvaDariTabel(rows), titik: baris.flatMap((r) => { const h = r.hasil[ind]; return h ? [{ x: h.kunci, y: h.y }] : []; }) };
  }));

  const sehat = (t: string) => ({ normal: "Baik", perhatian: "Perlu perhatian", bahaya: "Perlu penanganan", info: "" }[t] ?? "");

  return (
    <>
      <div className="no-print">
        <PageHeader judul={`Ringkasan untuk orang tua: ${p.nama}`} deskripsi="Cetak untuk diberikan kepada orang tua. Pada jendela cetak, pilih kertas A4 dengan skala 100%." />
        <NavKlinik label="Bagian klinik anak" items={[
          { href: `/anak/${p.id}`, label: "Pertumbuhan", aktif: false },
          { href: `/anak/${p.id}/tumbuh-kembang`, label: "Tumbuh kembang", aktif: false },
          { href: `/anak/${p.id}/cetak`, label: "Cetak ringkasan orang tua", aktif: true },
        ]} />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TombolCetak label="Cetak ringkasan" />
          <Link href={`/anak/${p.id}`} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Kembali</Link>
        </div>
        {!terakhir && <div className="mb-4"><Banner jenis="peringatan">Belum ada pengukuran. Catat dulu di halaman Pertumbuhan.</Banner></div>}
      </div>

      <article className="resep-cetak" style={{ maxWidth: "190mm" }} aria-label={`Ringkasan ${p.nama}`}>
        <header className="resep-kop">
          <p className="resep-klinik">{klinik.nama}</p>
          {klinik.alamat && <p>{klinik.alamat}</p>}
          {klinik.telepon && <p>Telp/WA: {klinik.telepon}</p>}
        </header>
        <p className="text-center text-lg font-bold">Ringkasan Kesehatan Anak</p>
        <section className="resep-pasien">
          <p><span className="resep-label">Nama</span> <b>{p.nama}</b> ({LABEL_JK[p.jenis_kelamin]}, {teksUmur(p.tanggal_lahir)})</p>
          <p><span className="resep-label">Tanggal</span> {formatTanggal(hariIni)}</p>
        </section>

        {terakhir && (
          <section className="mt-4" style={{ breakInside: "avoid" }}>
            <h2 className="text-base font-bold">Hasil pertumbuhan ({formatTanggal(terakhir.tanggal)}, usia {teksUmurBulan(terakhir.umur_bulan)})</h2>
            <p>Berat badan <b>{terakhir.bb ?? "—"} kg</b>{terakhir.tb !== null ? <>, {terakhir.cara_ukur === "berbaring" ? "panjang" : "tinggi"} badan <b>{terakhir.tb} cm</b></> : null}{terakhir.lingkar_kepala !== null ? <>, lingkar kepala <b>{terakhir.lingkar_kepala} cm</b></> : null}.</p>
            <ul className="mt-2 list-disc pl-6">
              {URUT_INDIKATOR.filter((i) => terakhir.hasil[i] && terakhir.hasil[i]!.z !== null).map((i) => (
                <li key={i}>{META[i].label}: <b>{terakhir.hasil[i]!.label}</b> {sehat(terakhir.hasil[i]!.tingkat) ? `(${sehat(terakhir.hasil[i]!.tingkat)})` : ""} <span className="text-sm">({fmtZ(terakhir.hasil[i]!.z as number)})</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4 grid gap-3" style={{ breakInside: "avoid" }}>
          {grafik.filter((g) => g.rows.length > 0).map((g) => (
            <GrafikPertumbuhan key={g.ind} judul={`${META[g.ind].label}`} labelX="Umur (bulan)" labelY={`${META[g.ind].satuan}`}
              kurva={g.kurva} titik={g.titik} xMin={g.rows[0].kunci} xMax={g.rows[g.rows.length - 1].kunci} ringkasan="Perkembangan terhadap kurva WHO." />
          ))}
        </section>

        {terakhir?.pesan_orang_tua && (<section className="mt-4"><h2 className="text-base font-bold">Pesan dokter</h2><p>{terakhir.pesan_orang_tua}</p></section>)}

        {scr && (
          <section className="mt-4">
            <h2 className="text-base font-bold">Tumbuh kembang ({formatTanggal(scr.tanggal)})</h2>
            <p>{TAFSIR[scr.hasil].label}. {TAFSIR[scr.hasil].saran}{scr.perlu_rujukan ? " Anak disarankan menjalani pemeriksaan lanjutan." : ""}</p>
          </section>
        )}

        {resep && resep.length > 0 && (
          <section className="mt-4" style={{ breakInside: "avoid" }}>
            <h2 className="text-base font-bold">Obat dari kunjungan terakhir</h2>
            <ul className="list-disc pl-6">
              {resep.map((o) => (<li key={o.uid}><b>{o.nama}</b> {o.sediaan}: {aturanTeks(o)}{o.lama_hari ? `, selama ${o.lama_hari} hari` : ""}. <span className="text-sm">Jumlah {o.jumlah} {o.satuan}.</span></li>))}
            </ul>
          </section>
        )}

        {kontrol && (<section className="mt-4"><h2 className="text-base font-bold">Kontrol berikutnya</h2><p>{formatTanggal(kontrol.tanggal, true)}, {kontrol.practice_sessions?.nama}.</p></section>)}

        <p className="mt-6 text-sm">Ringkasan ini bukan pengganti pemeriksaan dokter. Bila anak tampak sakit, sulit makan atau minum, atau ada hal yang mengkhawatirkan, segera hubungi {klinik.telepon || "praktik"}.</p>
        <footer className="resep-ttd"><div className="resep-garis" /><p className="font-bold">{klinik.dokter || "Dokter"}</p></footer>
      </article>
    </>
  );
}
