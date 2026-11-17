import Link from "next/link";
import { notFound } from "next/navigation";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { NavKlinik, WARNA_TINGKAT } from "@/components/nav-klinik";
import { formatTanggal, teksUmur } from "@/lib/format";
import { INSTRUMEN, adalahJenis, pilihanImtMna } from "@/lib/geriatri";
import { hitungBMI } from "@/lib/rekam";
import { FormSkrining } from "./form-skrining";

export default async function Skrining({ params }: { params: { id: string; jenis: string } }) {
  await wajibRole("dokter");
  if (!adalahJenis(params.jenis)) notFound();
  const ins = INSTRUMEN[params.jenis];
  const supabase = createClient();
  const { data: p } = await supabase.from("patients").select("id, nama, no_rm, tanggal_lahir").eq("id", params.id).maybeSingle();
  if (!p) notFound();

  const { data: riw } = await supabase.from("geriatric_screenings").select("id, tanggal, skor, interpretasi").eq("patient_id", p.id).eq("jenis", params.jenis).order("tanggal", { ascending: false }).limit(8);
  const riwayat = (riw ?? []) as { id: string; tanggal: string; skor: number; interpretasi: string }[];

  // MNA-SF: usulkan pilihan IMT dari berat dan tinggi badan terakhir
  let awal: Record<string, string> = {};
  let imtInfo: string | null = null;
  if (params.jenis === "mna_sf") {
    const { data: enc } = await supabase.from("encounters").select("id").eq("patient_id", p.id).neq("status", "batal").order("tanggal", { ascending: false }).limit(6);
    const ids = ((enc ?? []) as { id: string }[]).map((e) => e.id);
    if (ids.length) {
      const { data: v } = await supabase.from("vitals").select("bb, tb").in("encounter_id", ids);
      const ada = ((v ?? []) as { bb: number | null; tb: number | null }[]).find((x) => x.bb !== null && x.tb !== null);
      const imt = ada ? hitungBMI(String(ada.bb), String(ada.tb)) : null;
      const pil = pilihanImtMna(imt);
      if (imt !== null && pil) { awal = { imt: pil }; imtInfo = `IMT dari tanda vital terakhir: ${String(imt).replace(".", ",")} kg/m². Pilihan IMT sudah diisi; periksa kembali.`; }
    }
  }

  return (
    <>
      <PageHeader judul={ins.nama} deskripsi={`${p.nama}, ${p.no_rm}, ${teksUmur(p.tanggal_lahir)}`} aksi={<Link href={`/lansia/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Kembali ke ringkasan</Link>} />
      <NavKlinik label="Bagian klinik lansia" items={[{ href: `/lansia/${p.id}`, label: "Ringkasan", aktif: false }, { href: `/lansia/${p.id}/obat`, label: "Rekonsiliasi obat", aktif: false }]} />
      {imtInfo && <div className="mb-4"><Banner>{imtInfo}</Banner></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <FormSkrining pasienId={p.id} kode={params.jenis} awal={awal} />
        <aside>
          <Card>
            <h2 className="text-lg font-bold">Hasil sebelumnya</h2>
            {riwayat.length === 0 ? <p className="mt-2 text-redup">Belum ada.</p> : (
              <ul className="mt-3 divide-y divide-garis">
                {riwayat.map((r) => (
                  <li key={r.id} className="py-2">
                    <p className="font-bold">{formatTanggal(r.tanggal)}: {r.skor} dari {ins.maks}</p>
                    <span className={`inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${WARNA_TINGKAT[ins.tafsir(r.skor).tingkat]}`}>{r.interpretasi}</span>
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
