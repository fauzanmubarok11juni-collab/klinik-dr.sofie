import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { hariIniWIB, sesiAktif } from "@/lib/format";
import { FormPasien } from "../../form-pasien";
import { simpanEditPasien } from "../../actions";

export default async function UbahPasien({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("patients")
    .select("nama, tanggal_lahir, jenis_kelamin, no_hp, alamat, nik, penjamin, patient_contacts(nama, hubungan, no_hp)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) notFound();

  const k = (p.patient_contacts as { nama: string; hubungan: string | null; no_hp: string | null }[] | null)?.[0];
  const awal: Record<string, string> = {
    nama: p.nama, tanggal_lahir: p.tanggal_lahir, jenis_kelamin: p.jenis_kelamin,
    no_hp: p.no_hp ?? "", alamat: p.alamat ?? "", nik: p.nik ?? "", penjamin: p.penjamin,
    kontak_nama: k?.nama ?? "", kontak_hubungan: k?.hubungan ?? "", kontak_hp: k?.no_hp ?? "",
  };

  return (
    <>
      <PageHeader judul="Ubah data pasien" deskripsi="Alergi dan riwayat penyakit diubah dari halaman pasien." />
      <FormPasien
        mode="edit" aksi={simpanEditPasien.bind(null, params.id)} awal={awal}
        sesiDefault={sesiAktif()} hariIni={hariIniWIB()} batalHref={`/pasien/${params.id}`}
      />
    </>
  );
}
