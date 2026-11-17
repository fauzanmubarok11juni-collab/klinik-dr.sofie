"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tag } from "lucide-react";
import { Banner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hapusPenjualan, muatUlangPenjualan, setPenjualan } from "@/app/(app)/obat/actions";
import { barisBaru, jumlahAngka, type ItemObat } from "@/lib/obat";
import { rupiah } from "@/lib/format";
import { BarisObat } from "./baris-obat";
import { PilihObat } from "./pilih-obat";

/**
 * Penjualan obat dari stok klinik. Setiap baris disimpan sendiri (bukan seluruh daftar), jadi perubahan Dokter dan
 * Asisten pada kunjungan yang sama tidak saling menimpa. Stok berkurang otomatis di database.
 */
export function PanelJual({
  encounterId, awal, onItems,
}: { encounterId: string; awal: ItemObat[]; onItems?: (i: ItemObat[]) => void }) {
  const [items, setItems] = useState(awal);
  const itemsRef = useRef(awal);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [umum, setUmum] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const pasang = useCallback((fn: (x: ItemObat[]) => ItemObat[]) => {
    itemsRef.current = fn(itemsRef.current);
    setItems(itemsRef.current);
  }, []);
  useEffect(() => { onItems?.(items); }, [items, onItems]);
  useEffect(() => { const t = timers.current; return () => t.forEach((x) => clearTimeout(x)); }, []);

  // Perbarui hanya stok/harga dari server, supaya ketikan di kolom lain tidak terganggu.
  const sinkron = (baris?: ItemObat[]) => {
    if (!baris) return;
    pasang((cur) => cur.map((c) => {
      const s = baris.find((b) => b.medicine_id === c.medicine_id);
      return s ? { ...c, stok: s.stok, harga_satuan: s.harga_satuan, expired: s.expired } : c;
    }));
  };

  async function simpanBaris(uid: string) {
    const it = itemsRef.current.find((x) => x.uid === uid);
    if (!it || jumlahAngka(it) === null) return;
    const h = await setPenjualan(encounterId, it);
    setGalat((g) => { const n = { ...g }; if (h.ok) delete n[uid]; else n[uid] = h.error ?? "Belum tersimpan."; return n; });
    sinkron(h.baris);
  }

  function jadwalkan(uid: string) {
    clearTimeout(timers.current.get(uid));
    timers.current.set(uid, setTimeout(() => { timers.current.delete(uid); void simpanBaris(uid); }, 700));
  }

  function tambah(m: Parameters<typeof barisBaru>[0]) {
    if (itemsRef.current.some((x) => x.medicine_id === m.id)) return;
    const b = barisBaru(m);
    pasang((c) => [...c, b]);
    void simpanBaris(b.uid);
  }

  function ubah(b: ItemObat) {
    pasang((c) => c.map((x) => (x.uid === b.uid ? b : x)));
    jadwalkan(b.uid);
  }

  async function hapus(b: ItemObat) {
    clearTimeout(timers.current.get(b.uid));
    pasang((c) => c.filter((x) => x.uid !== b.uid));
    if (!b.medicine_id) return;
    const h = await hapusPenjualan(encounterId, b.medicine_id);
    if (!h.ok) { setUmum(h.error ?? "Belum terhapus."); pasang((c) => [...c, b]); } else setUmum(null);
    sinkron(h.baris);
  }

  async function muatUlang() {
    timers.current.forEach((x) => clearTimeout(x)); timers.current.clear();
    const baru = await muatUlangPenjualan(encounterId);
    itemsRef.current = baru; setItems(baru); setGalat({}); setUmum(null);
  }

  const total = items.reduce((a, i) => a + (i.harga_satuan ?? 0) * (jumlahAngka(i) ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Penjualan obat dari stok klinik</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="sekunder" onClick={muatUlang}>Muat ulang</Button>
          <a href={`/obat/label/${encounterId}`} target="_blank" rel="noopener"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-garis bg-permukaan px-4 font-bold hover:border-utama">
            <Tag aria-hidden className="h-5 w-5" /> Cetak label obat
          </a>
        </div>
      </div>

      {umum && <Banner jenis="bahaya">{umum}</Banner>}

      <PilihObat hanyaDijual label="Tambah obat yang dijual" placeholder="Ketik nama obat yang ada di stok klinik" onPilih={tambah} />

      {items.length === 0 ? (
        <p className="text-redup">Belum ada obat yang dijual pada kunjungan ini.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <BarisObat key={it.uid} item={it} mode="jual" tanda={galat[it.uid]} onUbah={ubah} onHapus={() => void hapus(it)} />
          ))}
        </ul>
      )}
      <p className="text-lg font-bold">Total obat yang dijual: {rupiah(total)}</p>
      <p className="text-sm text-redup">Tersimpan otomatis per baris. Stok berkurang saat baris tersimpan; tagihan dibuat di Kasir (Iterasi 4).</p>
    </div>
  );
}
