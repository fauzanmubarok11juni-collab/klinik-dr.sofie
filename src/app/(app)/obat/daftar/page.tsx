import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { gayaTombol } from "@/components/ui/button";
import { rupiah } from "@/lib/format";

type Med = { id: string; nama: string; kekuatan: string; sediaan: string; golongan: string | null; dijual: boolean; harga_jual: number; aktif: boolean };

export default async function DaftarObat({ searchParams }: { searchParams: { q?: string; tersimpan?: string } }) {
  await wajibRole("dokter");
  const q = (searchParams.q ?? "").replace(/[,()*%\\"':]/g, " ").trim();
  const supabase = createClient();
  let query = supabase.from("medicines").select("id, nama, kekuatan, sediaan, golongan, dijual, harga_jual, aktif").order("nama").limit(60);
  if (q) query = query.or(`nama.ilike.*${q}*,golongan.ilike.*${q}*`);
  const { data } = await query;
  const meds = (data ?? []) as Med[];

  return (
    <>
      <PageHeader
        judul="Daftar obat"
        deskripsi="Semua obat yang bisa diresepkan. Obat yang ditandai dijual memiliki stok dan harga di klinik."
        aksi={<Link href="/obat/daftar/baru" className={gayaTombol({ ukuran: "besar" })}>Tambah obat</Link>}
      />
      {searchParams.tersimpan && <div className="mb-4"><Banner>Obat sudah tersimpan.</Banner></div>}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="mb-1.5 block font-bold">Cari obat</label>
          <input id="q" name="q" defaultValue={q} autoComplete="off" placeholder="Nama atau golongan"
            className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama" />
        </div>
        <button type="submit" className="min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-5 font-bold hover:border-utama">Cari</button>
      </form>

      {meds.length === 0 ? (
        <Card><p className="font-bold">Tidak ada obat yang cocok.</p></Card>
      ) : (
        <ul className="space-y-2">
          {meds.map((m) => (
            <li key={m.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-garis bg-permukaan p-3 ${m.aktif ? "" : "opacity-60"}`}>
              <div>
                <p className="font-bold">{[m.nama, m.kekuatan, m.sediaan].filter(Boolean).join(" ")}</p>
                <p className="text-sm text-redup">
                  {m.golongan ?? "tanpa golongan"}, {m.dijual ? `dijual di klinik, ${rupiah(Number(m.harga_jual))}` : "hanya untuk resep"}{m.aktif ? "" : ", disembunyikan"}
                </p>
              </div>
              <Link href={`/obat/daftar/${m.id}`} className={gayaTombol({ variant: "sekunder" })}>Ubah</Link>
            </li>
          ))}
        </ul>
      )}
      {meds.length === 60 && <p className="mt-3 text-sm text-redup">Menampilkan 60 teratas. Ketik nama untuk mempersempit.</p>}
    </>
  );
}
