import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { TombolCetak } from "@/components/tombol-cetak";
import { TrenSkor } from "@/components/grafik-pertumbuhan";
import { NavKlinik, WARNA_TINGKAT } from "@/components/nav-klinik";
import { LABEL_JK, formatTanggal, hitungUmur, teksUmur } from "@/lib/format";
import { INSTRUMEN, URUT_GERI, type JenisGeri } from "@/lib/geriatri";
import { analisisRekonsiliasi, muatObatAktif } from "@/lib/rekonsiliasi";

type Skr = { jenis: JenisGeri; tanggal: string; skor: number; interpretasi: string };

export default async function RingkasanGeriatri({ params, searchParams }: { params: { id: string }; searchParams: { tersimpan?: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: p } = await supabase.from("patients")
    .select("id, nama, no_rm, tanggal_lahir, jenis_kelamin, patient_allergies(nama_alergi), patient_conditions(nama_kondisi)").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const umur = hitungUmur(p.tanggal_lahir).tahun;

  const [skrR, encR, obat] = await Promise.all([
    supabase.from("geriatric_screenings").select("jenis, tanggal, skor, interpretasi").eq("patient_id", p.id).order("tanggal", { ascending: false }).limit(80),
    supabase.from("encounters").select("id, tanggal").eq("patient_id", p.id).neq("status", "batal").order("tanggal", { ascending: false }).limit(8),
    muatObatAktif(supabase, p.id),
  ]);
  const skr = (skrR.data ?? []) as Skr[];
  const enc = (encR.data ?? []) as { id: string; tanggal: string }[];
  const ids = enc.map((e) => e.id);
  const [vitR, dxR, peringatan] = await Promise.all([
    ids.length ? supabase.from("vitals").select("encounter_id, td_sistolik, td_diastolik, nadi, spo2, bb, tb").in("encounter_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("encounter_diagnoses").select("encounter_id, utama, diagnoses(kode, nama)").in("encounter_id", ids) : Promise.resolve({ data: [] }),
    analisisRekonsiliasi(supabase, obat, umur),
  ]);
  const vit = (vitR.data ?? []) as { encounter_id: string; td_sistolik: number | null; td_diastolik: number | null; nadi: number | null; spo2: number | null; bb: number | null; tb: number | null }[];
  const dx = (dxR.data ?? []) as unknown as { encounter_id: string; utama: boolean; diagnoses: { kode: string; nama: string } | null }[];

  const vitTerakhir = enc.map((e) => ({ e, v: vit.find((x) => x.encounter_id === e.id) })).find((x) => x.v);
  const bbTren = enc.map((e) => ({ tanggal: e.tanggal, bb: vit.find((x) => x.encounter_id === e.id)?.bb ?? null })).filter((x) => x.bb !== null).slice(0, 5);
  const dxUnik = Array.from(new Map(dx.filter((d) => d.diagnoses).map((d) => [d.diagnoses!.kode, d.diagnoses!])).values()).slice(0, 6);
  const kondisi = (p.patient_conditions as { nama_kondisi: string }[] | null) ?? [];
  const alergi = (p.patient_allergies as { nama_alergi: string }[] | null) ?? [];
  const poli = obat.length > 5;

  return (
    <>
      <PageHeader judul={`Ringkasan geriatri: ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${LABEL_JK[p.jenis_kelamin]}, ${teksUmur(p.tanggal_lahir)}.`}
        aksi={<div className="no-print flex flex-wrap gap-2"><TombolCetak label="Cetak ringkasan" /><Link href={`/pasien/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Data pasien</Link></div>} />
      <NavKlinik label="Bagian klinik lansia" items={[
        { href: `/lansia/${p.id}`, label: "Ringkasan", aktif: true },
        { href: `/lansia/${p.id}/obat`, label: "Rekonsiliasi obat", aktif: false },
      ]} />
      {searchParams.tersimpan && <div className="mb-4"><Banner>Hasil skrining tersimpan.</Banner></div>}
      {alergi.length > 0 && <div className="mb-4"><Banner jenis="bahaya"><span className="font-bold">Alergi: </span>{alergi.map((a) => a.nama_alergi).join(", ")}</Banner></div>}
      {poli && <div className="mb-4"><Banner jenis="peringatan"><span className="font-bold">Polifarmasi: </span>{obat.length} obat aktif (lebih dari 5). Tinjau di <Link className="font-bold underline" href={`/lansia/${p.id}/obat`}>Rekonsiliasi obat</Link>.</Banner></div>}

      <section aria-label="Skrining geriatri" className="mb-6">
        <h2 className="mb-3 text-lg font-bold">Skrining geriatri</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {URUT_GERI.map((k) => {
            const ins = INSTRUMEN[k];
            const riw = skr.filter((s) => s.jenis === k);
            const t = riw[0];
            const tafsir = t ? ins.tafsir(t.skor) : null;
            return (
              <Card key={k}>
                <p className="font-bold">{ins.nama}</p>
                {t && tafsir ? (
                  <>
                    <p className="mt-1 text-2xl font-bold">{t.skor} <span className="text-base font-normal text-redup">dari {ins.maks}</span></p>
                    <span className={`mt-1 inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${WARNA_TINGKAT[tafsir.tingkat]}`}>{t.interpretasi}</span>
                    <p className="mt-1 text-sm text-redup">{formatTanggal(t.tanggal)}{riw.length > 1 ? `, ${riw.length} pemeriksaan` : ""}</p>
                    <TrenSkor nilai={[...riw].reverse().slice(-8).map((r) => r.skor)} maks={ins.maks} label={`Tren skor ${ins.singkat}`} />
                    {tafsir.saran && <p className="mt-1 text-sm">{tafsir.saran}</p>}
                  </>
                ) : <p className="mt-1 text-redup">Belum pernah diperiksa.</p>}
                <Link href={`/lansia/${p.id}/skrining/${k}`} className={`no-print ${gayaTombol({ variant: t ? "sekunder" : "utama", className: "mt-3" })}`}>{t ? "Periksa ulang" : "Isi skrining"}</Link>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Obat aktif ({obat.length})</h2>
          {obat.length === 0 ? <p className="mt-2 text-redup">Tidak ada obat aktif tercatat.</p> : (
            <ul className="mt-2 space-y-1">{obat.map((o) => (<li key={o.kunci}><span className="font-bold">{o.nama}</span>{o.aturan ? `: ${o.aturan}` : ""} <span className="text-sm text-redup">({o.sumber === "luar" ? "dari luar klinik" : `klinik, sampai ${o.sampai ? formatTanggal(o.sampai) : "—"}`})</span></li>))}</ul>
          )}
          {peringatan.length > 0 && (
            <div className="mt-3 space-y-2">
              {peringatan.slice(0, 6).map((a, i) => <Banner key={i} jenis="peringatan">{a.pesan}</Banner>)}
              {peringatan.length > 6 && <p className="text-sm text-redup">dan {peringatan.length - 6} peringatan lain di Rekonsiliasi obat.</p>}
            </div>
          )}
          <Link href={`/lansia/${p.id}/obat`} className={`no-print ${gayaTombol({ variant: "sekunder", className: "mt-3" })}`}>Rekonsiliasi obat</Link>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Kondisi dan kunjungan</h2>
          <dl className="mt-3 space-y-3">
            <div><dt className="text-sm font-bold text-redup">Riwayat penyakit</dt><dd>{kondisi.length ? kondisi.map((k) => k.nama_kondisi).join(", ") : "Belum tercatat"}</dd></div>
            <div><dt className="text-sm font-bold text-redup">Diagnosis terbaru</dt><dd>{dxUnik.length ? dxUnik.map((d) => `${d.kode} ${d.nama}`).join("; ") : "Belum ada"}</dd></div>
            <div><dt className="text-sm font-bold text-redup">Tanda vital terakhir{vitTerakhir ? ` (${formatTanggal(vitTerakhir.e.tanggal)})` : ""}</dt>
              <dd>{vitTerakhir?.v ? [vitTerakhir.v.td_sistolik !== null ? `TD ${vitTerakhir.v.td_sistolik}/${vitTerakhir.v.td_diastolik ?? "—"}` : null, vitTerakhir.v.nadi !== null ? `nadi ${vitTerakhir.v.nadi}` : null, vitTerakhir.v.spo2 !== null ? `SpO2 ${vitTerakhir.v.spo2}%` : null, vitTerakhir.v.bb !== null ? `BB ${vitTerakhir.v.bb} kg` : null].filter(Boolean).join(", ") || "Tidak tercatat" : "Belum ada"}</dd></div>
            <div><dt className="text-sm font-bold text-redup">Tren berat badan</dt><dd>{bbTren.length ? [...bbTren].reverse().map((b) => `${b.bb} kg (${formatTanggal(b.tanggal).replace(/ \d{4}$/, "")})`).join(" → ") : "Belum ada"}</dd></div>
            <div><dt className="text-sm font-bold text-redup">Kunjungan terakhir</dt><dd>{enc[0] ? formatTanggal(enc[0].tanggal) : "Belum ada"}</dd></div>
          </dl>
        </Card>
      </div>
      <p className="mt-4 text-sm text-redup">Hasil skrining adalah alat bantu, bukan diagnosis. Usia lansia dihitung mulai 60 tahun.</p>
    </>
  );
}
