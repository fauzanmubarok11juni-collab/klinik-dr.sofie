import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { PanelJualHalaman } from "@/components/obat/panel-jual-halaman";
import { muatPenjualan, muatResep } from "@/lib/obat-server";
import { formatTanggal, teksUmur } from "@/lib/format";

type Enc = {
  id: string; tanggal: string; status: string; patient_id: string;
  patients: { nama: string; no_rm: string; tanggal_lahir: string; patient_allergies: { nama_alergi: string }[] } | null;
};

export default async function JualObat({ params }: { params: { encounterId: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("encounters")
    .select("id, tanggal, status, patient_id, patients(nama, no_rm, tanggal_lahir, patient_allergies(nama_alergi))")
    .eq("id", params.encounterId).maybeSingle();
  const enc = data as unknown as Enc | null;
  if (!enc || !enc.patients) notFound();
  const p = enc.patients;

  if (enc.status === "batal") {
    return (
      <>
        <PageHeader judul={p.nama} deskripsi="Kunjungan ini sudah dibatalkan." />
        <Banner jenis="peringatan">Penjualan tidak bisa dicatat pada kunjungan yang dibatalkan.</Banner>
        <Link href="/obat" className={gayaTombol({ className: "mt-4" })}>Kembali</Link>
      </>
    );
  }

  const [jual, resep] = await Promise.all([muatPenjualan(supabase, enc.id), muatResep(supabase, enc.id)]);

  return (
    <>
      <PageHeader
        judul={`Penjualan obat: ${p.nama}`}
        deskripsi={`No. RM ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}. Kunjungan ${formatTanggal(enc.tanggal)}.`}
        aksi={<Link href="/obat" className={gayaTombol({ variant: "sekunder" })}>Selesai, kembali</Link>}
      />
      {p.patient_allergies.length > 0 && (
        <div className="mb-4"><Banner jenis="bahaya"><span className="font-bold">Alergi: </span>{p.patient_allergies.map((a) => a.nama_alergi).join(", ")}</Banner></div>
      )}
      <PanelJualHalaman encounterId={enc.id} awal={jual} resepTetap={resep.items} />
    </>
  );
}
