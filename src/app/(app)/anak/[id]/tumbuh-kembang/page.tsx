import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { NavKlinik } from "@/components/nav-klinik";
import { LABEL_JK, formatTanggal, hariIniWIB, teksUmur } from "@/lib/format";
import { TAFSIR, pilihCheckpoint, type Hasil } from "@/lib/perkembangan";
import { umurBulanDesimal } from "@/lib/who";
import { FormPerkembangan, type ButirForm } from "./form-perkembangan";

type Riwayat = { id: string; tanggal: string; checkpoint_bulan: number; hasil: Hasil; perlu_rujukan: boolean; khawatir: boolean; kemunduran: boolean; catatan: string | null };
const WARNA: Record<Hasil, string> = { sesuai: "border-berhasil text-berhasil", meragukan: "border-peringatan text-peringatan", rujuk: "border-bahaya text-bahaya" };

export default async function TumbuhKembang({ params, searchParams }: { params: { id: string }; searchParams: { tersimpan?: string } }) {
  await wajibRole("dokter");
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("id, nama, no_rm, tanggal_lahir, jenis_kelamin").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  const umur = umurBulanDesimal(p.tanggal_lahir, hariIniWIB());
  const cp = pilihCheckpoint(umur);

  const [butirR, riwR] = await Promise.all([
    cp === null ? Promise.resolve({ data: [] }) : supabase.from("developmental_milestones").select("domain, urutan, pertanyaan").eq("checkpoint_bulan", cp).order("domain").order("urutan"),
    supabase.from("developmental_screenings").select("id, tanggal, checkpoint_bulan, hasil, perlu_rujukan, khawatir, kemunduran, catatan").eq("patient_id", p.id).order("tanggal", { ascending: false }).limit(8),
  ]);
  const butir: ButirForm[] = ((butirR.data ?? []) as { domain: string; urutan: number; pertanyaan: string }[]).map((b) => ({ id: `${b.domain}-${b.urutan}`, domain: b.domain, pertanyaan: b.pertanyaan }));
  const riwayat = (riwR.data ?? []) as Riwayat[];

  return (
    <>
      <PageHeader judul={`Tumbuh kembang: ${p.nama}`} deskripsi={`No. RM ${p.no_rm}, ${LABEL_JK[p.jenis_kelamin]}, ${teksUmur(p.tanggal_lahir)}.`}
        aksi={<Link href={`/pasien/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Data pasien</Link>} />
      <NavKlinik label="Bagian klinik anak" items={[
        { href: `/anak/${p.id}`, label: "Pertumbuhan", aktif: false },
        { href: `/anak/${p.id}/tumbuh-kembang`, label: "Tumbuh kembang", aktif: true },
        { href: `/anak/${p.id}/cetak`, label: "Cetak ringkasan orang tua", aktif: false },
      ]} />
      {searchParams.tersimpan && <div className="mb-4"><Banner>Hasil skrining tersimpan.</Banner></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          {cp === null ? (
            <Banner jenis="peringatan">Skrining tersedia untuk usia 2 bulan sampai kurang dari 6 tahun. {umur < 2 ? "Anak ini belum berusia 2 bulan." : "Anak ini sudah di atas 6 tahun."}</Banner>
          ) : butir.length === 0 ? (
            <Banner jenis="peringatan">Butir skrining untuk usia ini belum ada. Pastikan SQL migrasi 0006 sudah dijalankan.</Banner>
          ) : (
            <FormPerkembangan pasienId={p.id} butir={butir} checkpoint={cp} />
          )}
        </section>
        <aside>
          <Card>
            <h2 className="text-lg font-bold">Riwayat skrining</h2>
            {riwayat.length === 0 ? <p className="mt-2 text-redup">Belum ada.</p> : (
              <ul className="mt-3 divide-y divide-garis">
                {riwayat.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-bold">{formatTanggal(r.tanggal)} <span className="text-sm font-normal text-redup">(butir {r.checkpoint_bulan} bulan)</span></p>
                    <span className={`inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${WARNA[r.hasil]}`}>{TAFSIR[r.hasil].label}</span>
                    {r.perlu_rujukan && <span className="ml-2 rounded-full border-2 border-bahaya px-3 py-0.5 text-sm font-bold text-bahaya">Perlu rujukan</span>}
                    {(r.khawatir || r.kemunduran) && <p className="text-sm text-redup">{[r.khawatir ? "Orang tua khawatir" : null, r.kemunduran ? "Ada kemunduran" : null].filter(Boolean).join(", ")}</p>}
                    {r.catatan && <p className="text-sm text-redup">{r.catatan}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
