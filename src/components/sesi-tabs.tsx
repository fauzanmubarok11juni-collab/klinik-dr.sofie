import Link from "next/link";
import { cn } from "@/lib/utils";

export type Sesi = "semua" | "pagi" | "malam";

const PILIHAN: { nilai: Sesi; label: string }[] = [
  { nilai: "semua", label: "Semua sesi" },
  { nilai: "pagi", label: "Sesi Pagi" },
  { nilai: "malam", label: "Sesi Malam" },
];

/**
 * Filter sesi satu klik. Memakai tautan biasa (tanpa JavaScript tambahan).
 * eksplisitSemua: bila halaman punya sesi bawaan (mis. sesi yang sedang berjalan), "Semua sesi" harus ditulis di alamat.
 */
export function SesiTabs({
  aktif, basePath, eksplisitSemua = false, paramLain = {},
}: { aktif: Sesi; basePath: string; eksplisitSemua?: boolean; paramLain?: Record<string, string> }) {
  const buatHref = (nilai: Sesi) => {
    const p = new URLSearchParams(paramLain);
    if (nilai !== "semua" || eksplisitSemua) p.set("sesi", nilai);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div role="group" aria-label="Pilih sesi praktik" className="inline-flex flex-wrap rounded-lg border-2 border-garis bg-permukaan p-1">
      {PILIHAN.map(({ nilai, label }) => (
        <Link
          key={nilai}
          href={buatHref(nilai)}
          aria-current={aktif === nilai ? "true" : undefined}
          className={cn(
            "flex min-h-[44px] items-center rounded-md px-4 font-bold",
            aktif === nilai ? "bg-utama text-utama-teks" : "hover:bg-garis/50"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function bacaSesi(v?: string): Sesi {
  return v === "pagi" || v === "malam" ? v : "semua";
}
