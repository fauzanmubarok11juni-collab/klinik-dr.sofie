import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambilProfil } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { InfoMedis } from "@/components/info-medis";
import { StatusBadge } from "@/components/status-badge";
import { LABEL_JK, formatTanggal, hariIniWIB, teksUmur, kategoriPasien } from "@/lib/format";
import type { StatusKunjungan } from "@/lib/types";
import { tambahAlergi, tambahRiwayat, hapusAlergi, hapusRiwayat } from "../actions";

type Pasien = {
  id: string; no_rm: string; nama: string; tanggal_lahir: string; jenis_kelamin: string;
  no_hp: string | null; alamat: string | null; nik: string | null; penjamin: string;
  patient_allergies: { id: string; nama_alergi: string }[];
  patient_conditions: { id: string; nama_kondisi: string }[];
  patient_contacts: { id: string; nama: string; hubungan: string | null; no_hp: string | null }[];
};
type Kunjungan = {
  id: string; tanggal: string; status: StatusKunjungan; keluhan_utama: string | null;
  practice_sessions: { nama: string } | null;
};

export default async function DetailPasien({
  params, searchParams,
}: { params: { id: string }; searchParams: { tersimpan?: string; cek?: string } }) {
  const profil = await ambilProfil();
  const supabase = createClient();

  const { data } = await supabase
    .from("patients")
    .select("*, patient_allergies(id, nama_alergi), patient_conditions(id, nama_kondisi), patient_contacts(id, nama, hubungan, no_hp)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as Pasien;

  const { data: kj } = await supabase
    .from("encounters")
    .select("id, tanggal, status, keluhan_utama, practice_sessions(nama)")
    .eq("patient_id", p.id)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const kunjungan = (kj ?? []) as unknown as Kunjungan[];

  const { data: kjD } = await supabase.from("control_schedules").select("tanggal, practice_sessions(nama)").eq("patient_id", p.id).eq("status", "terjadwal").gte("tanggal", hariIniWIB()).order("tanggal").limit(1);
  const kontrolBerikut = (kjD as unknown as { tanggal: string; practice_sessions: { nama: string } | null }[] | null)?.[0];
  const dokter = profil.role === "dokter";
  const kontak = p.patient_contacts[0];
  const kategori = kategoriPasien(p.tanggal_lahir);

  return (
    <>
      <PageHeader
        judul={p.nama}
        deskripsi={`No. RM ${p.no_rm}, ${LABEL_JK[p.jenis_kelamin]}, ${teksUmur(p.tanggal_lahir)}${kategori === "umum" ? "" : kategori === "anak" ? " (anak)" : " (lansia)"}`}
        aksi={<Link href={`/pasien/${p.id}/daftar`} className={gayaTombol({ ukuran: "besar" })}>Daftarkan hari ini</Link>}
      />

      <div className="space-y-4">
        {searchParams.tersimpan && <Banner>Data pasien sudah tersimpan.</Banner>}
        {searchParams.cek && (
          <Banner jenis="peringatan">Pasien tersimpan, tetapi sebagian data tambahan (alergi/riwayat/kontak) belum masuk. Silakan tambahkan di bawah.</Banner>
        )}
        {kontrolBerikut && <Banner>Jadwal kontrol berikutnya: <span className="font-bold">{formatTanggal(kontrolBerikut.tanggal, true)}</span>, {kontrolBerikut.practice_sessions?.nama}.</Banner>}
        {p.patient_allergies.length > 0 && (
          <Banner jenis="peringatan">
            <span className="font-bold">Alergi: </span>
            {p.patient_allergies.map((a) => a.nama_alergi).join(", ")}
          </Banner>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href={`/pasien/${p.id}/edit`} className={gayaTombol({ variant: "sekunder" })}>Ubah data</Link>
          <Link href={`/pasien/${p.id}/kartu`} className={gayaTombol({ variant: "sekunder" })}>Cetak kartu berobat</Link>
          <Link href={`/kontrol/baru?pasien=${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Atur jadwal kontrol</Link>
          {dokter && kategori === "anak" && <Link href={`/anak/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Klinik anak</Link>}
          {dokter && kategori === "lansia" && <Link href={`/lansia/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Klinik lansia</Link>}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold">Data diri</h2>
            <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-redup">Tanggal lahir</dt><dd>{formatTanggal(p.tanggal_lahir)}</dd>
              <dt className="text-redup">No. HP</dt><dd>{p.no_hp ?? "—"}</dd>
              <dt className="text-redup">Alamat</dt><dd>{p.alamat ?? "—"}</dd>
              <dt className="text-redup">NIK</dt><dd>{p.nik ?? "—"}</dd>
              <dt className="text-redup">Penjamin</dt><dd>{p.penjamin === "asuransi" ? "Asuransi" : "Umum"}</dd>
              <dt className="text-redup">Kontak darurat</dt>
              <dd>{kontak ? `${kontak.nama}${kontak.hubungan ? ` (${kontak.hubungan})` : ""}${kontak.no_hp ? `, ${kontak.no_hp}` : ""}` : "—"}</dd>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Kunjungan terakhir</h2>
            {kunjungan.length === 0 ? (
              <p className="mt-2 text-redup">Belum pernah berkunjung.</p>
            ) : (
              <ul className="mt-3 divide-y divide-garis">
                {kunjungan.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="block font-bold">{formatTanggal(k.tanggal)}, {k.practice_sessions?.nama}</span>
                      <span className="text-redup">{k.keluhan_utama || "Tanpa keluhan tercatat"}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {dokter && k.status !== "batal" && (
                        <Link href={`/rekam-medis/${k.id}`} className={gayaTombol({ variant: "sekunder" })}>Rekam medis</Link>
                      )}
                      <StatusBadge status={k.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <InfoMedis
            judul="Alergi" idInput="tambah-alergi" petunjuk="Contoh: amoksisilin" kosong="Tidak ada alergi tercatat."
            items={p.patient_allergies.map((a) => ({ id: a.id, teks: a.nama_alergi }))}
            tambah={tambahAlergi.bind(null, p.id)}
            hapus={dokter ? (id) => hapusAlergi.bind(null, id, p.id) : undefined}
          />
          <InfoMedis
            judul="Riwayat penyakit" idInput="tambah-riwayat" petunjuk="Contoh: darah tinggi" kosong="Belum ada riwayat penyakit tercatat."
            items={p.patient_conditions.map((c) => ({ id: c.id, teks: c.nama_kondisi }))}
            tambah={tambahRiwayat.bind(null, p.id)}
            hapus={dokter ? (id) => hapusRiwayat.bind(null, id, p.id) : undefined}
          />
        </div>
      </div>
    </>
  );
}
