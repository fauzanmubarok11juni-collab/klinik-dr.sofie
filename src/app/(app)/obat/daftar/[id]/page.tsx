import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { FormObat } from "../form-obat";
import { simpanObatMaster } from "../../actions";

export default async function UbahObat({ params }: { params: { id: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: m } = await supabase.from("medicines").select("*").eq("id", params.id).maybeSingle();
  if (!m) notFound();
  const s = (x: unknown) => (x === null || x === undefined ? "" : String(x));
  const awal: Record<string, string> = {
    nama: m.nama, kekuatan: m.kekuatan, sediaan: m.sediaan, kekuatan_mg: s(m.kekuatan_mg), satuan: m.satuan,
    satuan_dosis: m.satuan_dosis, zat_aktif: (m.zat_aktif ?? []).join(", "), golongan: s(m.golongan),
    dijual: m.dijual ? "1" : "", harga_jual: s(m.harga_jual), stok_minimum: s(m.stok_minimum),
    tanggal_expired: s(m.tanggal_expired), aktif: m.aktif ? "1" : "",
  };
  return (
    <>
      <PageHeader judul="Ubah obat" deskripsi={`${m.nama} ${m.kekuatan} ${m.sediaan}`.trim()} />
      <FormObat mode="edit" aksi={simpanObatMaster.bind(null, params.id)} awal={awal} />
    </>
  );
}
