import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { GrafikPertumbuhan } from "@/components/grafik-pertumbuhan";
import { NavKlinik, WARNA_TINGKAT } from "@/components/nav-klinik";
import { LABEL_JK, formatTanggal, hariIniWIB, teksUmur } from "@/lib/format";
import { META, URUT_INDIKATOR, fmtZ, indikatorBerlaku, kurvaDariTabel, teksUmurBulan, umurBulanDesimal, type Indikator } from "@/lib/who";
import { hitungHasilAnak, muatLMS, type Catatan } from "@/lib/anak-server";
import { FormPertumbuhan } from "./form-pertumbuhan";
import { TombolHapus } from "./tombol-hapus";

const TAB: { k: string; l: string }[] = [{ k: "wfa", l: "BB/U" }, { k: "hfa", l: "PB/U atau TB/U" }, { k: "bbtb", l: "BB/PB atau BB/TB" }, { k: "bmi", l: "IMT/U" }, { k: "hca", l: "LK/U" }];

export default async function KlinikAnak({ params, searchParams }: { params: { id: string }; searchParams: { grafik?: string; tersimpan?: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("id, nama, no_rm, tanggal_lahir, jenis_kelamin").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const hariIni = hariIniWIB();
  const umurNow = umurBulanDesimal(p.tanggal_lahir, hariIni);

  const nav = (aktif: string) => (
    <NavKlinik label="Bagian klinik anak" items={[
      { href: `/anak/${p.id}`, label: "Pertumbuhan", aktif: aktif === "p" },
      { href: `/anak/${p.id}/tumbuh-kembang`, label: "Tumbuh kembang", aktif: aktif === "t" },
      { href: `/anak/${p.id}/cetak`, label: "Cetak ringkasan orang tua", aktif: aktif === "c" },
    ]} />
  );

  if (umurNow > 228) {
    return (<><PageHeader judul={p.nama} deskripsi="Standar WHO tersedia sampai usia 19 tahun." /><Banner jenis="peringatan">Pasien ini sudah berusia di atas 19 tahun, jadi kurva pertumbuhan anak tidak berlaku.</Banner></>);
  }

  const { data: recs } = await supabase.from("growth_records").select("id, tanggal, umur_bulan, bb, tb, cara_ukur, lingkar_kepala, pesan_orang_tua").eq("patient_id", p.id).order("tanggal");
  const catatan = (recs ?? []) as Catatan[];
  const { baris, kurang } = await hitungHasilAnak(supabase, p.jenis_kelamin, p.tanggal_lahir, catatan);
  const terakhir = baris[baris.length - 1];

  // Isian awal formulir: catatan hari ini bila ada, selain itu tanda vital kunjungan hari ini
  const hariIniRec = catatan.find((c) => c.tanggal === hariIni);
  let awal: Record<string, string> = { tanggal: hariIni };
  let dariVital = false;
  if (hariIniRec) {
    awal = { tanggal: hariIni, bb: hariIniRec.bb === null ? "" : String(hariIniRec.bb), tb: hariIniRec.tb === null ? "" : String(hariIniRec.tb), lk: hariIniRec.lingkar_kepala === null ? "" : String(hariIniRec.lingkar_kepala), cara_ukur: hariIniRec.cara_ukur ?? "", pesan: hariIniRec.pesan_orang_tua ?? "" };
  } else {
    const { data: enc } = await supabase.from("encounters").select("id").eq("patient_id", p.id).eq("tanggal", hariIni).neq("status", "batal").order("created_at", { ascending: false }).limit(1);
    const eid = (enc as { id: string }[] | null)?.[0]?.id;
    if (eid) {
      const { data: v } = await supabase.from("vitals").select("bb, tb").eq("encounter_id", eid).maybeSingle();
      if (v && (v.bb !== null || v.tb !== null)) { awal = { ...awal, bb: v.bb === null ? "" : String(v.bb), tb: v.tb === null ? "" : String(v.tb) }; dariVital = true; }
    }
  }

  // Grafik
  const berlaku = indikatorBerlaku(umurNow);
  const tabTersedia = TAB.filter((t) => t.k === "bbtb" ? berlaku.includes("wfl") || berlaku.includes("wfh") : berlaku.includes(t.k as Indikator));
  const pilih = tabTersedia.find((t) => t.k === searchParams.grafik)?.k ?? tabTersedia[0]?.k ?? "wfa";
  const ind: Indikator = pilih === "bbtb" ? (berlaku.includes("wfl") ? "wfl" : "wfh") : (pilih as Indikator);
  const meta = META[ind];
  const [xMin, xMax] = meta.sumbuX === "tinggi" ? (ind === "wfl" ? [45, 110] : [65, 120]) : umurNow <= 60 ? [0, 60] : [60, ind === "wfa" ? 120 : 228];
  const lmsGrafik = await muatLMS(supabase, ind, p.jenis_kelamin, xMin, xMax);
  const kurva = kurvaDariTabel(lmsGrafik);
  const titik = baris.flatMap((b) => { const h = b.hasil[ind]; return h ? [{ x: h.kunci, y: h.y }] : []; });
  const ringkasanGrafik = terakhir?.hasil[ind]?.z != null ? `Pengukuran terakhir ${fmtZ(terakhir.hasil[ind]!.z as number)}, ${terakhir.hasil[ind]!.label}.` : "Belum ada pengukuran pada rentang grafik ini.";

  const sel = (c: (typeof baris)[number], ind: Indikator) => {
    const h = c.hasil[ind];
    return h ? <span key={ind} className="block whitespace-nowrap">{META[ind].singkat.split(" ")[0]}: {h.z === null ? "—" : fmtZ(h.z)}</span> : null;
  };

  return (
    <>
      <PageHeader judul={`Klinik anak: ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${LABEL_JK[p.jenis_kelamin]}, ${teksUmur(p.tanggal_lahir)}.`}
        aksi={<Link href={`/pasien/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Data pasien</Link>} />
      {nav("p")}

      {searchParams.tersimpan && <div className="mb-4"><Banner>Pengukuran tersimpan.</Banner></div>}
      {kurang.length > 0 && (
        <div className="mb-4">
          <Banner jenis="peringatan">
            <p className="font-bold">Tabel standar WHO belum lengkap, jadi Z-score belum bisa dihitung untuk: {kurang.map((k) => META[k].singkat).join(", ")}.</p>
            <p>Impor tabel WHO lewat <Link className="font-bold underline" href="/pengaturan?bagian=who">Pengaturan → Data WHO</Link>.</p>
          </Banner>
        </div>
      )}

      {terakhir ? (
        <section aria-label="Status pertumbuhan terakhir" className="mb-6">
          <h2 className="mb-1 text-lg font-bold">Pengukuran terakhir ({formatTanggal(terakhir.tanggal)}, {teksUmurBulan(terakhir.umur_bulan)})</h2>
          <p className="mb-3 text-redup">BB {terakhir.bb ?? "—"} kg, {terakhir.tb !== null ? `${terakhir.cara_ukur === "berbaring" ? "PB" : "TB"} ${terakhir.tb} cm` : "tinggi —"}{terakhir.lingkar_kepala !== null ? `, LK ${terakhir.lingkar_kepala} cm` : ""}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {URUT_INDIKATOR.filter((i) => terakhir.hasil[i]).map((i) => {
              const h = terakhir.hasil[i]!;
              return (
                <Card key={i}>
                  <p className="text-sm font-bold text-redup">{META[i].label} ({META[i].singkat})</p>
                  <p className="mt-1 text-2xl font-bold">{h.z === null ? "—" : fmtZ(h.z)}</p>
                  <span className={`mt-1 inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${WARNA_TINGKAT[h.tingkat]}`}>{h.label}</span>
                  {h.tidakWajar && <p className="mt-2 text-sm font-bold text-bahaya">Nilai tidak wajar. Periksa kembali pengukuran.</p>}
                </Card>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-redup">Kategori menurut Permenkes No. 2 Tahun 2020 (standar WHO). Z-score dihitung dengan interpolasi antar bulan, sehingga dapat berbeda sangat tipis dari kalkulator harian WHO.</p>
        </section>
      ) : <div className="mb-6"><Banner>Belum ada pengukuran. Catat berat dan tinggi badan di bawah untuk melihat Z-score dan grafik.</Banner></div>}

      <section aria-label="Grafik pertumbuhan" className="mb-8">
        <div role="group" aria-label="Pilih grafik" className="no-print mb-3 flex flex-wrap gap-2">
          {tabTersedia.map((t) => (
            <Link key={t.k} href={`/anak/${p.id}?grafik=${t.k}`} aria-current={pilih === t.k ? "true" : undefined}
              className={`flex min-h-[44px] items-center rounded-lg border-2 px-4 font-bold ${pilih === t.k ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama"}`}>{t.l}</Link>
          ))}
        </div>
        {kurva.length === 0 || lmsGrafik.length === 0 ? (
          <Banner jenis="peringatan">Tabel WHO untuk {meta.singkat} ({p.jenis_kelamin === "L" ? "laki-laki" : "perempuan"}) belum diimpor, jadi grafik belum bisa digambar.</Banner>
        ) : (
          <GrafikPertumbuhan judul={`${meta.label} (${meta.singkat}), ${p.jenis_kelamin === "L" ? "laki-laki" : "perempuan"}`}
            labelX={meta.sumbuX === "tinggi" ? "Panjang/tinggi badan (cm)" : umurNow <= 60 ? "Umur (bulan)" : "Umur (bulan; 120 = 10 tahun, 216 = 18 tahun)"}
            labelY={`${meta.label.split(" menurut")[0]} (${meta.satuan})`} kurva={kurva} titik={titik} xMin={lmsGrafik[0].kunci} xMax={lmsGrafik[lmsGrafik.length - 1].kunci} ringkasan={ringkasanGrafik} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Riwayat pengukuran" className="min-w-0 lg:order-1">
          <h2 className="mb-3 text-lg font-bold">Riwayat pengukuran</h2>
          {baris.length === 0 ? <p className="text-redup">Belum ada.</p> : (
            <div className="overflow-x-auto rounded-xl border-2 border-garis bg-permukaan">
              <table className="w-full text-left">
                <caption className="sr-only">Riwayat pengukuran pertumbuhan</caption>
                <thead><tr>{["Tanggal", "Umur", "BB (kg)", "PB/TB (cm)", "LK (cm)", "Z-score", ""].map((h, i) => <th key={i} scope="col" className="border-b-2 border-garis px-3 py-2 font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {[...baris].reverse().map((b) => (
                    <tr key={b.id} className="align-top">
                      <td className="border-b border-garis px-3 py-2">{formatTanggal(b.tanggal)}</td>
                      <td className="border-b border-garis px-3 py-2">{teksUmurBulan(b.umur_bulan)}</td>
                      <td className="border-b border-garis px-3 py-2">{b.bb ?? "—"}</td>
                      <td className="border-b border-garis px-3 py-2">{b.tb ?? "—"}</td>
                      <td className="border-b border-garis px-3 py-2">{b.lingkar_kepala ?? "—"}</td>
                      <td className="border-b border-garis px-3 py-2 text-sm">{URUT_INDIKATOR.map((i) => sel(b, i))}</td>
                      <td className="no-print border-b border-garis px-3 py-1"><TombolHapus id={b.id} pasienId={p.id} label={formatTanggal(b.tanggal)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="no-print lg:order-2">
          <FormPertumbuhan pasienId={p.id} awal={awal} hariIni={hariIni} bawahDuaTahun={umurNow < 24} adaHariIni={!!hariIniRec} dariVital={dariVital} />
        </div>
      </div>
    </>
  );
}
