import { Card } from "@/components/ui/card";
import { formatTanggal } from "@/lib/format";

export type Ringkasan = {
  obatAktif: { nama: string; aturan: string; sampai: string }[];
  alergi: string[];
  riwayat: string[];
  dxTerakhir: { tanggal: string; items: { kode: string; nama: string; utama: boolean }[] } | null;
  vitalTerakhir: { tanggal: string; td: string | null; nadi: number | null; suhu: number | null; spo2: number | null; bb: number | null; tb: number | null } | null;
  kunjunganTerakhir: { tanggal: string; sesi: string; keluhan: string | null } | null;
};

/** Ringkasan satu layar untuk dokter: hal terpenting sebelum memeriksa. */
export function RingkasanPasien({ r }: { r: Ringkasan }) {
  const baris = (judul: string, isi: React.ReactNode) => (
    <div>
      <dt className="text-sm font-bold text-redup">{judul}</dt>
      <dd className="mt-0.5">{isi}</dd>
    </div>
  );
  const kosong = <span className="text-redup">Belum ada</span>;
  const v = r.vitalTerakhir;

  return (
    <Card>
      <h2 className="text-lg font-bold">Ringkasan pasien</h2>
      <dl className="mt-3 space-y-3">
        {baris("Alergi", r.alergi.length ? <span className="font-bold text-bahaya">{r.alergi.join(", ")}</span> : <span className="text-redup">Tidak ada tercatat</span>)}
        {baris("Riwayat penyakit", r.riwayat.length ? r.riwayat.join(", ") : kosong)}
        {baris(
          "Obat aktif",
          r.obatAktif.length ? (
            <ul>
              {r.obatAktif.map((o, i) => (
                <li key={i}>{o.nama} <span className="text-sm text-redup">(sampai {formatTanggal(o.sampai)})</span></li>
              ))}
            </ul>
          ) : <span className="text-redup">Tidak ada yang masih dipakai</span>
        )}
        {baris(
          "Diagnosis terakhir",
          r.dxTerakhir ? (
            <>
              <span className="block text-sm text-redup">{formatTanggal(r.dxTerakhir.tanggal)}</span>
              <ul>{r.dxTerakhir.items.map((d) => <li key={d.kode}>{d.kode} {d.nama}{d.utama ? " (utama)" : ""}</li>)}</ul>
            </>
          ) : kosong
        )}
        {baris(
          "Vital terakhir",
          v ? (
            <>
              <span className="block text-sm text-redup">{formatTanggal(v.tanggal)}</span>
              <span>
                {[
                  v.td ? `TD ${v.td}` : null,
                  v.nadi !== null ? `nadi ${v.nadi}` : null,
                  v.suhu !== null ? `suhu ${String(v.suhu).replace(".", ",")}°` : null,
                  v.spo2 !== null ? `SpO2 ${v.spo2}%` : null,
                  v.bb !== null ? `BB ${v.bb} kg` : null,
                  v.tb !== null ? `TB ${v.tb} cm` : null,
                ].filter(Boolean).join(", ") || "Tidak tercatat"}
              </span>
            </>
          ) : kosong
        )}
        {baris(
          "Kunjungan terakhir",
          r.kunjunganTerakhir ? (
            <>
              <span className="block text-sm text-redup">{formatTanggal(r.kunjunganTerakhir.tanggal)}, {r.kunjunganTerakhir.sesi}</span>
              <span>{r.kunjunganTerakhir.keluhan || "Tanpa keluhan tercatat"}</span>
            </>
          ) : <span className="text-redup">Kunjungan pertama</span>
        )}
      </dl>
    </Card>
  );
}
