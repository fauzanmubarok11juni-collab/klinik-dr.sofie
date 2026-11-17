"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, gayaTombol } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatJam, teksUmur } from "@/lib/format";
import { LABEL_STATUS, type KunjunganBaris, type StatusKunjungan } from "@/lib/types";
import { ubahStatus } from "../pasien/actions";

type Aksi = { label: string; ke: StatusKunjungan; utama?: boolean };

// Alur: Menunggu -> Diperiksa -> Selesai. Tombol sekunder untuk koreksi.
const AKSI: Record<StatusKunjungan, Aksi[]> = {
  menunggu: [{ label: "Mulai periksa", ke: "diperiksa", utama: true }, { label: "Batalkan", ke: "batal" }],
  diperiksa: [{ label: "Selesai", ke: "selesai", utama: true }, { label: "Kembali ke menunggu", ke: "menunggu" }, { label: "Batalkan", ke: "batal" }],
  selesai: [{ label: "Buka kembali", ke: "diperiksa" }],
  batal: [{ label: "Daftarkan kembali", ke: "menunggu" }],
};

type Undo = { id: string; nama: string; dari: StatusKunjungan; ke: StatusKunjungan };

export function DaftarHariIni({ rows: awal, tampilSesi, dokter }: { rows: KunjunganBaris[]; tampilSesi: boolean; dokter: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(awal);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<KunjunganBaris | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timerUndo = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setRows(awal); }, [awal]);

  // Segarkan otomatis: perubahan dari komputer lain (realtime), cadangan tiap 30 detik, dan saat jendela dibuka kembali.
  useEffect(() => {
    const supabase = createClient();
    const kanal = supabase
      .channel("kunjungan-hari-ini")
      .on("postgres_changes", { event: "*", schema: "public", table: "encounters" }, () => router.refresh())
      .subscribe();
    const interval = setInterval(() => router.refresh(), 30000);
    const saatFokus = () => router.refresh();
    window.addEventListener("focus", saatFokus);
    return () => {
      supabase.removeChannel(kanal);
      clearInterval(interval);
      window.removeEventListener("focus", saatFokus);
    };
  }, [router]);

  useEffect(() => {
    if (konfirmasi) dialog.current?.showModal();
    else dialog.current?.close();
  }, [konfirmasi]);

  async function ganti(row: KunjunganBaris, ke: StatusKunjungan, dariUndo = false) {
    const dari = row.status;
    setGalat(null);
    setSibuk(row.id);
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: ke } : x)));
    const hasil = await ubahStatus(row.id, ke);
    setSibuk(null);
    if (!hasil.ok) {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status: dari } : x)));
      setGalat(hasil.error ?? "Status belum berubah.");
      return;
    }
    clearTimeout(timerUndo.current);
    if (dariUndo) {
      setUndo(null);
    } else {
      setUndo({ id: row.id, nama: row.nama, dari, ke });
      timerUndo.current = setTimeout(() => setUndo(null), 8000);
    }
    router.refresh();
  }

  function klik(row: KunjunganBaris, a: Aksi) {
    if (a.ke === "batal") setKonfirmasi(row);
    else void ganti(row, a.ke);
  }

  // Dokter: "Mulai periksa" / "Buka rekam medis" membuka layar pemeriksaan. Asisten: tombol status biasa.
  const tombolAksi = (row: KunjunganBaris) => {
    const lain = AKSI[row.status]
      .filter((a) => !(dokter && row.status === "menunggu" && a.ke === "diperiksa"))
      .map((a) => (dokter ? { ...a, utama: false } : a));
    const labelBuka = row.status === "menunggu" ? "Mulai periksa" : row.status === "diperiksa" ? "Buka rekam medis" : "Lihat rekam medis";
    return (
      <div className="flex flex-wrap gap-2">
        {dokter && row.status !== "batal" && (
          <Link
            href={`/rekam-medis/${row.id}`}
            className={gayaTombol({ variant: row.status === "selesai" ? "sekunder" : "utama" })}
            aria-label={`${labelBuka}: ${row.nama}`}
          >
            {labelBuka}
          </Link>
        )}
        {lain.map((a) => (
          <Button
            key={a.label}
            variant={a.utama ? "utama" : "sekunder"}
            disabled={sibuk === row.id}
            onClick={() => klik(row, a)}
            aria-label={`${a.label}: ${row.nama}`}
          >
            {a.label}
          </Button>
        ))}
      </div>
    );
  };

  const kolomNama = (row: KunjunganBaris) => (
    <>
      <Link href={`/pasien/${row.patient_id}`} className="font-bold underline-offset-2 hover:underline">{row.nama}</Link>
      <span className="block text-sm text-redup">{row.no_rm}</span>
    </>
  );

  return (
    <div>
      <div aria-live="polite" className="space-y-3">
        {galat && <Banner jenis="bahaya">{galat}</Banner>}
      </div>

      {/* HP & tablet: kartu */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-xl border-2 border-garis bg-permukaan p-4 ${r.status === "batal" ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                {kolomNama(r)}
                <p className="text-sm text-redup">
                  {tampilSesi ? `${r.sesi_kode === "pagi" ? "Pagi" : "Malam"} nomor ${r.no_urut}, ` : `Nomor ${r.no_urut}, `}
                  {teksUmur(r.tanggal_lahir)}, daftar {formatJam(r.waktu_daftar)}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-2">{r.keluhan_utama || <span className="text-redup">Tanpa keluhan tercatat</span>}</p>
            <div className="mt-3">{tombolAksi(r)}</div>
          </li>
        ))}
      </ul>

      {/* Layar lebar: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border-2 border-garis bg-permukaan md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Daftar pasien hari ini</caption>
          <thead>
            <tr className="border-b-2 border-garis">
              <th scope="col" className="px-4 py-3 font-bold">No.</th>
              <th scope="col" className="px-4 py-3 font-bold">Nama</th>
              <th scope="col" className="px-4 py-3 font-bold">Umur</th>
              <th scope="col" className="px-4 py-3 font-bold">Keluhan</th>
              <th scope="col" className="px-4 py-3 font-bold">Status</th>
              <th scope="col" className="px-4 py-3 font-bold">Daftar</th>
              <th scope="col" className="px-4 py-3 font-bold"><span className="sr-only">Tindakan</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-garis last:border-b-0 ${r.status === "batal" ? "opacity-70" : ""}`}>
                <td className="px-4 py-3 text-redup">
                  {tampilSesi && <span className="block text-xs">{r.sesi_kode === "pagi" ? "Pagi" : "Malam"}</span>}
                  {r.no_urut}
                </td>
                <td className="px-4 py-3">{kolomNama(r)}</td>
                <td className="whitespace-nowrap px-4 py-3">{teksUmur(r.tanggal_lahir)}</td>
                <td className="max-w-[16rem] px-4 py-3">{r.keluhan_utama || <span className="text-redup">—</span>}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3">{formatJam(r.waktu_daftar)}</td>
                <td className="px-4 py-3">{tombolAksi(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Urungkan */}
      {undo && (
        <div role="status" className="no-print fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border-2 border-utama bg-permukaan p-3 shadow-lg">
          <span>{undo.nama}: {LABEL_STATUS[undo.ke]}</span>
          <Button
            variant="sekunder"
            onClick={() => {
              const r = rows.find((x) => x.id === undo.id);
              if (r) void ganti({ ...r, status: undo.ke }, undo.dari, true);
            }}
          >
            Urungkan
          </Button>
        </div>
      )}

      {/* Konfirmasi batal */}
      <dialog
        ref={dialog}
        onClose={() => setKonfirmasi(null)}
        aria-labelledby="judul-batal"
        className="w-[min(28rem,92vw)] rounded-xl border-2 border-garis bg-permukaan p-6 text-tinta backdrop:bg-black/50"
      >
        <h2 id="judul-batal" className="text-xl font-bold">Batalkan kunjungan?</h2>
        <p className="mt-2">{konfirmasi?.nama} akan ditandai Batal. Data pasien tidak terhapus, dan bisa didaftarkan kembali.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="bahaya"
            onClick={() => { const r = konfirmasi; setKonfirmasi(null); if (r) void ganti(r, "batal"); }}
          >
            Ya, batalkan
          </Button>
          <Button variant="sekunder" onClick={() => setKonfirmasi(null)} autoFocus>Tidak</Button>
        </div>
      </dialog>
    </div>
  );
}
