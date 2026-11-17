import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { LABEL_JK, hitungUmur, kategoriPasien, teksUmur } from "@/lib/format";
import { SOAP_KOSONG, VITAL_KOSONG, gabungKeluhan, type DataRekam, type TemplateRow, type Vital } from "@/lib/rekam";
import type { SesiKode, StatusKunjungan } from "@/lib/types";
import { muatPenjualan, muatResep, muatResepTerakhir } from "@/lib/obat-server";
import { EditorRekamMedis } from "./editor";
import { RingkasanPasien, type Ringkasan } from "./ringkasan";

type Enc = {
  id: string; patient_id: string; tanggal: string; status: StatusKunjungan; keluhan_utama: string | null;
  practice_sessions: { kode: SesiKode; nama: string } | null;
  patients: {
    id: string; nama: string; no_rm: string; tanggal_lahir: string; jenis_kelamin: string;
    patient_allergies: { nama_alergi: string }[]; patient_conditions: { nama_kondisi: string }[];
  } | null;
};
type VitalRow = {
  td_sistolik: number | null; td_diastolik: number | null; nadi: number | null; rr: number | null; suhu: number | null;
  spo2: number | null; bb: number | null; tb: number | null; lingkar_perut: number | null;
};
const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export default async function HalamanRekamMedis({ params }: { params: { id: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();

  const { data: encRaw } = await supabase
    .from("encounters")
    .select("id, patient_id, tanggal, status, keluhan_utama, practice_sessions(kode, nama), patients(id, nama, no_rm, tanggal_lahir, jenis_kelamin, patient_allergies(nama_alergi), patient_conditions(nama_kondisi))")
    .eq("id", params.id)
    .maybeSingle();
  const enc = encRaw as unknown as Enc | null;
  if (!enc || !enc.patients || !enc.practice_sessions) notFound();
  const pasien = enc.patients;
  const sesi = enc.practice_sessions;
  const kategori = kategoriPasien(pasien.tanggal_lahir);
  const dewasa = hitungUmur(pasien.tanggal_lahir).tahun >= 18;

  if (enc.status === "batal") {
    return (
      <>
        <PageHeader judul={pasien.nama} deskripsi="Kunjungan ini sudah dibatalkan." />
        <Banner jenis="peringatan">Kunjungan dibatalkan, jadi rekam medisnya tidak bisa diisi. Daftarkan kembali dari halaman Pasien Hari Ini bila pasien tetap datang.</Banner>
        <Link href="/hari-ini" className={gayaTombol({ className: "mt-4" })}>Ke daftar pasien hari ini</Link>
      </>
    );
  }

  const [soapR, vitalR, dxR, svcR, masterR, tplR, prevR] = await Promise.all([
    supabase.from("soap_notes").select("subjective, objective, assessment, plan, catatan, updated_at").eq("encounter_id", enc.id).maybeSingle(),
    supabase.from("vitals").select("td_sistolik, td_diastolik, nadi, rr, suhu, spo2, bb, tb, lingkar_perut").eq("encounter_id", enc.id).maybeSingle(),
    supabase.from("encounter_diagnoses").select("diagnosis_kode, utama, diagnoses(nama)").eq("encounter_id", enc.id).order("created_at"),
    supabase.from("encounter_services").select("service_id, nama, tarif_satuan, jumlah").eq("encounter_id", enc.id).order("created_at"),
    supabase.from("services").select("id, nama, tarif, kategori").eq("aktif", true).order("urutan"),
    supabase.from("soap_templates").select("mode, pemilik, isi").eq("kategori", kategori),
    supabase.from("encounters")
      .select("id, tanggal, keluhan_utama, practice_sessions(nama)")
      .eq("patient_id", enc.patient_id).neq("id", enc.id).neq("status", "batal")
      .order("tanggal", { ascending: false }).order("created_at", { ascending: false }).limit(10),
  ]);

  const templates: TemplateRow[] = ((tplR.data ?? []) as { mode: SesiKode; pemilik: string | null; isi: TemplateRow["isi"] }[])
    .map((t) => ({ mode: t.mode, pribadi: t.pemilik !== null, isi: t.isi }));

  // Riwayat kunjungan sebelumnya: diagnosis & vital terakhir
  const prev = (prevR.data ?? []) as unknown as { id: string; tanggal: string; keluhan_utama: string | null; practice_sessions: { nama: string } | null }[];
  const ids = prev.map((x) => x.id);
  const [prevDxR, prevVitR] = ids.length
    ? await Promise.all([
        supabase.from("encounter_diagnoses").select("encounter_id, diagnosis_kode, utama, diagnoses(nama)").in("encounter_id", ids),
        supabase.from("vitals").select("encounter_id, td_sistolik, td_diastolik, nadi, suhu, spo2, bb, tb").in("encounter_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const prevDx = (prevDxR.data ?? []) as unknown as { encounter_id: string; diagnosis_kode: string; utama: boolean; diagnoses: { nama: string } | null }[];
  const prevVit = (prevVitR.data ?? []) as unknown as (VitalRow & { encounter_id: string })[];

  const kunjDx = prev.find((x) => prevDx.some((d) => d.encounter_id === x.id));
  const kunjVit = prev.find((x) => prevVit.some((v) => v.encounter_id === x.id));
  const vitLama = kunjVit ? prevVit.find((v) => v.encounter_id === kunjVit.id)! : null;

  // Hint berat/tinggi: nilai terakhir yang pernah tercatat
  const vitBB = prev.map((x) => prevVit.find((v) => v.encounter_id === x.id)).find((v) => v && v.bb !== null);
  const vitTB = prev.map((x) => prevVit.find((v) => v.encounter_id === x.id)).find((v) => v && v.tb !== null);

  // Obat: resep tersimpan, penjualan di klinik, resep terakhir (untuk disalin), dan obat yang masih dipakai
  const [resepAwal, jualAwal, resepTerakhir, aktifR] = await Promise.all([
    muatResep(supabase, enc.id),
    muatPenjualan(supabase, enc.id),
    muatResepTerakhir(supabase, enc.patient_id, enc.id),
    supabase.rpc("obat_aktif_pasien", { p_patient: enc.patient_id, p_kecuali: enc.id }),
  ]);
  const obatAktif = ((aktifR.data ?? []) as { nama: string; aturan: string; sampai: string }[])
    .map((o) => ({ nama: o.nama, aturan: o.aturan, sampai: o.sampai }));

  const ringkasan: Ringkasan = {
    obatAktif,
    alergi: pasien.patient_allergies.map((a) => a.nama_alergi),
    riwayat: pasien.patient_conditions.map((c) => c.nama_kondisi),
    dxTerakhir: kunjDx
      ? {
          tanggal: kunjDx.tanggal,
          items: prevDx.filter((d) => d.encounter_id === kunjDx.id)
            .map((d) => ({ kode: d.diagnosis_kode, nama: d.diagnoses?.nama ?? "", utama: d.utama }))
            .sort((a, b) => Number(b.utama) - Number(a.utama)),
        }
      : null,
    vitalTerakhir: kunjVit && vitLama
      ? {
          tanggal: kunjVit.tanggal,
          td: vitLama.td_sistolik !== null && vitLama.td_diastolik !== null ? `${vitLama.td_sistolik}/${vitLama.td_diastolik}` : null,
          nadi: vitLama.nadi, suhu: vitLama.suhu, spo2: vitLama.spo2, bb: vitLama.bb, tb: vitLama.tb,
        }
      : null,
    kunjunganTerakhir: prev[0]
      ? { tanggal: prev[0].tanggal, sesi: prev[0].practice_sessions?.nama ?? "", keluhan: prev[0].keluhan_utama }
      : null,
  };

  // Data awal editor: dari database; bila belum ada SOAP, isi dari template (pribadi lebih diutamakan) + keluhan pendaftaran.
  const soap = soapR.data as { subjective: string; objective: string; assessment: string; plan: string; catatan: string; updated_at: string } | null;
  const tplAwal = templates.find((t) => t.mode === sesi.kode && t.pribadi) ?? templates.find((t) => t.mode === sesi.kode && !t.pribadi);
  const vr = vitalR.data as VitalRow | null;
  const vitals: Vital = vr
    ? {
        td_sistolik: s(vr.td_sistolik), td_diastolik: s(vr.td_diastolik), nadi: s(vr.nadi), rr: s(vr.rr),
        suhu: s(vr.suhu), spo2: s(vr.spo2), bb: s(vr.bb), tb: s(vr.tb), lingkar_perut: s(vr.lingkar_perut),
      }
    : { ...VITAL_KOSONG };

  const awal: DataRekam = {
    soap: soap
      ? { subjective: soap.subjective, objective: soap.objective, assessment: soap.assessment, plan: soap.plan, catatan: soap.catatan }
      : {
          ...SOAP_KOSONG,
          subjective: gabungKeluhan(enc.keluhan_utama, tplAwal?.isi.subjective ?? ""),
          objective: tplAwal?.isi.objective ?? "",
          assessment: tplAwal?.isi.assessment ?? "",
          plan: tplAwal?.isi.plan ?? "",
        },
    vitals,
    diagnoses: ((dxR.data ?? []) as unknown as { diagnosis_kode: string; utama: boolean; diagnoses: { nama: string } | null }[])
      .map((d) => ({ kode: d.diagnosis_kode, nama: d.diagnoses?.nama ?? "", utama: d.utama })),
    services: ((svcR.data ?? []) as { service_id: string; nama: string; tarif_satuan: number; jumlah: number }[])
      .map((x) => ({ service_id: x.service_id, nama: x.nama, tarif: Number(x.tarif_satuan), jumlah: x.jumlah })),
  };

  const master = ((masterR.data ?? []) as { id: string; nama: string; tarif: number; kategori: string | null }[])
    .map((m) => ({ id: m.id, nama: m.nama, tarif: Number(m.tarif), kategori: m.kategori }));

  return (
    <>
      <PageHeader
        judul={pasien.nama}
        deskripsi={`No. RM ${pasien.no_rm}, ${LABEL_JK[pasien.jenis_kelamin]}, ${teksUmur(pasien.tanggal_lahir)}. ${sesi.nama}, nomor kunjungan hari ini.`}
        aksi={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={enc.status} />
            {kategori === "anak" && <Link href={`/anak/${pasien.id}`} className={gayaTombol({ variant: "sekunder" })}>Klinik anak</Link>}
            {kategori === "lansia" && <Link href={`/lansia/${pasien.id}`} className={gayaTombol({ variant: "sekunder" })}>Klinik lansia</Link>}
            <Link href={`/pasien/${pasien.id}`} className={gayaTombol({ variant: "sekunder" })}>Data pasien</Link>
          </div>
        }
      />

      {ringkasan.alergi.length > 0 && (
        <div className="mb-4">
          <Banner jenis="bahaya"><span className="font-bold">Alergi: </span>{ringkasan.alergi.join(", ")}</Banner>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="lg:order-2"><div className="lg:sticky lg:top-24"><RingkasanPasien r={ringkasan} /></div></aside>
        <div className="min-w-0">
          <EditorRekamMedis
            encounterId={enc.id}
            pasienId={pasien.id}
            statusAwal={enc.status}
            sesiKode={sesi.kode}
            namaPasien={pasien.nama}
            kategori={kategori}
            dewasa={dewasa}
            keluhanDaftar={enc.keluhan_utama}
            awal={awal}
            serverUpdatedAt={soap?.updated_at ?? null}
            master={master}
            templates={templates}
            awalResep={resepAwal}
            jualAwal={jualAwal}
            resepTerakhir={resepTerakhir}
            hintBBTB={{ bb: vitBB?.bb !== null && vitBB ? String(vitBB.bb) : undefined, tb: vitTB?.tb !== null && vitTB ? String(vitTB.tb) : undefined }}
          />
        </div>
      </div>
    </>
  );
}
