import { createClient } from "@/lib/supabase/server";
import { TEMPLAT_BAWAAN } from "@/lib/pengingat";

export type InfoKlinik = {
  nama: string; alamat: string; telepon: string; sip: string; dokter: string; kodeRm: string;
  tarifKonsultasi: number; tarifKontrol: number; templatPengingat: string;
};

/** Identitas dan tarif praktik dari tabel settings (diubah lewat menu Pengaturan). */
export async function ambilInfoKlinik(): Promise<InfoKlinik> {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const m: Record<string, unknown> = {};
  for (const r of (data ?? []) as { key: string; value: unknown }[]) m[r.key] = r.value;
  const t = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
  const n = (k: string) => { const x = Number(m[k]); return Number.isFinite(x) && x >= 0 ? x : 0; };
  return {
    nama: t("nama_praktik") || process.env.NEXT_PUBLIC_NAMA_PRAKTIK || "Praktik dr.sop",
    alamat: t("alamat"), telepon: t("telepon"), sip: t("sip_dokter"), dokter: t("nama_dokter"),
    kodeRm: t("kode_rm") || "DS",
    tarifKonsultasi: n("tarif_konsultasi"), tarifKontrol: n("tarif_kontrol"),
    templatPengingat: t("templat_pengingat") || TEMPLAT_BAWAAN,
  };
}
