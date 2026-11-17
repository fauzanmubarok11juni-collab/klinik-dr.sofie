export type StatusKunjungan = "menunggu" | "diperiksa" | "selesai" | "batal";
export type SesiKode = "pagi" | "malam";

export const LABEL_STATUS: Record<StatusKunjungan, string> = {
  menunggu: "Menunggu",
  diperiksa: "Diperiksa",
  selesai: "Selesai",
  batal: "Batal",
};

export type KunjunganBaris = {
  id: string;
  no_urut: number;
  status: StatusKunjungan;
  keluhan_utama: string | null;
  waktu_daftar: string;
  patient_id: string;
  nama: string;
  tanggal_lahir: string;
  no_rm: string;
  sesi_kode: SesiKode;
};

export type PasienRingkas = {
  id: string;
  no_rm: string;
  nama: string;
  tanggal_lahir: string;
  no_hp: string | null;
};

export type FormState = {
  error?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  duplikat?: PasienRingkas[];
  konfirmasi?: string;
};
