import Link from "next/link";
import { cn } from "@/lib/utils";

export function NavKlinik({ items, label }: { items: { href: string; label: string; aktif: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="no-print mb-6 flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.aktif ? "page" : undefined}
          className={cn("flex min-h-[44px] items-center rounded-lg border-2 px-4 font-bold", i.aktif ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export const WARNA_TINGKAT: Record<string, string> = {
  normal: "border-berhasil text-berhasil", perhatian: "border-peringatan text-peringatan", bahaya: "border-bahaya text-bahaya", info: "border-garis text-redup",
};
