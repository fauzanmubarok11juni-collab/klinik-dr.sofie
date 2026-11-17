import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { sesiAktif, teksUmur } from "@/lib/format";
import { daftarkanKunjungan } from "../../actions";
import { FormDaftar } from "./form-daftar";

export default async function DaftarkanHariIni({
  params, searchParams,
}: { params: { id: string }; searchParams: { gagal?: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("patients").select("nama, no_rm, tanggal_lahir, penjamin").eq("id", params.id).maybeSingle();
  if (!p) notFound();

  return (
    <>
      <PageHeader judul={`Daftarkan ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}`} />
      {searchParams.gagal && (
        <div className="mb-4">
          <Banner jenis="peringatan">Data pasien sudah tersimpan, tetapi pendaftaran hari ini belum berhasil. Silakan coba lagi di bawah.</Banner>
        </div>
      )}
      <FormDaftar
        aksi={daftarkanKunjungan.bind(null, params.id)}
        sesiDefault={sesiAktif()}
        penjaminDefault={p.penjamin}
        batalHref={`/pasien/${params.id}`}
      />
    </>
  );
}
