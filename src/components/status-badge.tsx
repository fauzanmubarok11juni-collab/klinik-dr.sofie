import { LABEL_STATUS, type StatusKunjungan } from "@/lib/types";
import { cn } from "@/lib/utils";

const GAYA: Record<StatusKunjungan, string> = {
  menunggu: "border-peringatan text-peringatan",
  diperiksa: "border-utama text-utama",
  selesai: "border-berhasil text-berhasil",
  batal: "border-bahaya text-bahaya",
};

// Status selalu berupa teks (tidak hanya warna) agar terbaca pengguna buta warna.
export function StatusBadge({ status }: { status: StatusKunjungan }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border-2 px-3 py-0.5 text-sm font-bold", GAYA[status])}>
      {LABEL_STATUS[status]}
    </span>
  );
}
