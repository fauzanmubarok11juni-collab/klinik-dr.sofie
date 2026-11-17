import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { PageHeader } from "@/components/page-header";
import { TombolCetak } from "@/components/tombol-cetak";
import { LABEL_JK, formatTanggal } from "@/lib/format";

export default async function KartuBerobat({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("patients").select("nama, no_rm, tanggal_lahir, jenis_kelamin").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const klinik = await ambilInfoKlinik();

  return (
    <>
      <div className="no-print">
        <PageHeader judul="Kartu berobat" deskripsi="Ukuran kartu 85,6 × 54 mm. Pada jendela cetak, pilih ukuran kertas “Actual size / 100%”." />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <TombolCetak label="Cetak kartu" />
          <Link href={`/pasien/${params.id}`} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">Kembali</Link>
        </div>
      </div>

      <article className="kartu-berobat" aria-label={`Kartu berobat ${p.nama}`}>
        <header>
          <p className="font-bold">{klinik.nama}</p>
          {(klinik.alamat || klinik.telepon) && (
            <p className="text-[8pt] opacity-80">{[klinik.alamat, klinik.telepon].filter(Boolean).join(" • ")}</p>
          )}
        </header>
        <div>
          <p className="kartu-nama">{p.nama}</p>
          <p className="kartu-rm">{p.no_rm}</p>
          <p>Lahir {formatTanggal(p.tanggal_lahir)}, {LABEL_JK[p.jenis_kelamin]}</p>
        </div>
        <footer className="text-[8pt] opacity-80">Mohon bawa kartu ini setiap berobat.</footer>
      </article>
    </>
  );
}
