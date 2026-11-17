import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Item = { id: string; teks: string };

/** Daftar kecil (alergi / riwayat penyakit) dengan kotak "tambah". Hapus hanya tampil untuk Dokter. */
export function InfoMedis({
  judul, idInput, petunjuk, kosong, items, tambah, hapus,
}: {
  judul: string;
  idInput: string;
  petunjuk: string;
  kosong: string;
  items: Item[];
  tambah: (fd: FormData) => Promise<void>;
  hapus?: (itemId: string) => () => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="text-lg font-bold">{judul}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-redup">{kosong}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-1 rounded-full border-2 border-garis py-0.5 pl-3 pr-1">
              <span className="font-bold">{it.teks}</span>
              {hapus && (
                <form action={hapus(it.id)}>
                  <button
                    type="submit"
                    aria-label={`Hapus ${it.teks}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-garis/60"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <form action={tambah} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor={idInput} className="mb-1 block text-sm font-bold">Tambah</label>
          <Input id={idInput} name="isi" placeholder={petunjuk} autoComplete="off" />
        </div>
        <Button type="submit" variant="sekunder">
          <Plus aria-hidden className="h-5 w-5" /> Tambah
        </Button>
      </form>
    </Card>
  );
}
