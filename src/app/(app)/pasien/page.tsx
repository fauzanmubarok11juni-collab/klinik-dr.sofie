import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { LABEL_JK, normalisasiHP, teksUmur } from "@/lib/format";
import { KotakCari } from "./kotak-cari";

type Baris = { id: string; no_rm: string; nama: string; tanggal_lahir: string; jenis_kelamin: string; no_hp: string | null };
const BATAS = 30;

export default async function DataPasien({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  // Buang karakter yang punya arti khusus pada filter pencarian.
  const bersih = q.replace(/[,()*%\\"':]/g, " ").replace(/\s+/g, " ").trim();
  const angka = bersih.replace(/\D/g, "");

  const supabase = createClient();
  let query = supabase
    .from("patients")
    .select("id, no_rm, nama, tanggal_lahir, jenis_kelamin, no_hp")
    .limit(BATAS);

  if (bersih) {
    const syarat = [`nama.ilike.*${bersih}*`, `no_rm.ilike.*${bersih}*`];
    if (angka.length >= 3) {
      syarat.push(`no_hp.ilike.*${normalisasiHP(angka)}*`, `nik.ilike.*${angka}*`);
    }
    query = query.or(syarat.join(",")).order("nama");
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  const hasil = (data ?? []) as Baris[];

  return (
    <>
      <PageHeader
        judul="Data pasien"
        deskripsi="Cari pasien lama, atau daftarkan pasien baru."
        aksi={<Link href="/pasien/baru" className={gayaTombol({ ukuran: "besar" })}>Pasien baru</Link>}
      />

      <KotakCari awal={q} />

      {error && <Card><p className="font-bold text-bahaya">Pencarian belum berhasil. Periksa koneksi internet, lalu coba lagi.</p></Card>}

      {!error && (
        <section aria-label="Hasil pencarian" className="mt-2">
          <h2 className="mb-3 font-bold">
            {bersih ? `${hasil.length} pasien ditemukan` : "Pasien terbaru"}
            {hasil.length === BATAS && <span className="font-normal text-redup"> (30 teratas, ketik lebih lengkap untuk mempersempit)</span>}
          </h2>

          {hasil.length === 0 ? (
            <Card>
              <p className="font-bold">{bersih ? "Tidak ada pasien yang cocok." : "Belum ada pasien."}</p>
              <p className="mt-1 text-redup">Periksa ejaan, atau daftarkan sebagai pasien baru.</p>
              <Link href="/pasien/baru" className={gayaTombol({ className: "mt-4" })}>Pasien baru</Link>
            </Card>
          ) : (
            <ul className="space-y-3">
              {hasil.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-garis bg-permukaan p-4">
                  <div className="min-w-0">
                    <Link href={`/pasien/${p.id}`} className="text-lg font-bold underline-offset-2 hover:underline">{p.nama}</Link>
                    <p className="text-redup">
                      {p.no_rm}, {LABEL_JK[p.jenis_kelamin]}, {teksUmur(p.tanggal_lahir)}{p.no_hp ? `, ${p.no_hp}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/pasien/${p.id}/daftar`} className={gayaTombol()}>Daftarkan hari ini</Link>
                    <Link href={`/pasien/${p.id}`} className={gayaTombol({ variant: "sekunder" })}>Buka</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
