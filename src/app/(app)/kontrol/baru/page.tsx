import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { hariIniWIB, sesiAktif, teksUmur } from "@/lib/format";
import { FormKontrol } from "./form-kontrol";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KontrolBaru({ searchParams }: { searchParams: { pasien?: string; kunjungan?: string } }) {
  const id = searchParams.pasien ?? "";
  if (!UUID.test(id)) {
    return (
      <>
        <PageHeader judul="Jadwal kontrol baru" />
        <Banner>Pilih pasiennya dulu: buka halaman pasien atau halaman Kasir, lalu tekan “Atur jadwal kontrol”.</Banner>
        <Link href="/pasien" className={gayaTombol({ className: "mt-4" })}>Cari pasien</Link>
      </>
    );
  }
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("nama, no_rm, tanggal_lahir").eq("id", id).maybeSingle();
  if (!p) return <Banner jenis="peringatan">Pasien tidak ditemukan.</Banner>;
  const kunj = searchParams.kunjungan && UUID.test(searchParams.kunjungan) ? searchParams.kunjungan : "";

  return (
    <>
      <PageHeader judul={`Jadwal kontrol: ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}. Pengingat dikirim manual lewat WhatsApp dari halaman Jadwal Kontrol.`} />
      <FormKontrol pasienId={id} kunjunganId={kunj} sesiDefault={sesiAktif()} hariIni={hariIniWIB()} batalHref={kunj ? `/kasir/${kunj}` : `/pasien/${id}`} />
    </>
  );
}
