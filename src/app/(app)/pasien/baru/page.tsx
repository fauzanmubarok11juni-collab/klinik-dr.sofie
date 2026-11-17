import { PageHeader } from "@/components/page-header";
import { hariIniWIB, sesiAktif } from "@/lib/format";
import { FormPasien } from "../form-pasien";
import { simpanPasienBaru } from "../actions";

export default function PasienBaru() {
  return (
    <>
      <PageHeader judul="Pasien baru" deskripsi="Isi lima kolom utama, sisanya boleh dilewati. Nomor RM dibuat otomatis." />
      <FormPasien mode="baru" aksi={simpanPasienBaru} sesiDefault={sesiAktif()} hariIni={hariIniWIB()} batalHref="/pasien" />
    </>
  );
}
