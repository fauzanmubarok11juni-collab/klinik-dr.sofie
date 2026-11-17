import { wajibRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { FormObat } from "../form-obat";
import { simpanObatMaster } from "../../actions";

export default async function ObatBaru() {
  await wajibRole("dokter");
  return (
    <>
      <PageHeader judul="Tambah obat" deskripsi="Isi sekali; obat langsung bisa dicari saat menulis resep." />
      <FormObat mode="baru" aksi={simpanObatMaster.bind(null, null)} awal={{ satuan: "tablet", satuan_dosis: "tablet", sediaan: "tablet" }} />
    </>
  );
}
