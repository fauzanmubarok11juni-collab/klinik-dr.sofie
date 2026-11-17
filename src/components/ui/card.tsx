import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border-2 border-garis bg-permukaan p-5", className)} {...props} />;
}

export function Banner({
  jenis = "info", children,
}: { jenis?: "info" | "peringatan" | "bahaya"; children: React.ReactNode }) {
  const gaya = {
    info: "border-utama text-tinta",
    peringatan: "border-peringatan text-tinta",
    bahaya: "border-bahaya text-tinta",
  }[jenis];
  return (
    <div role={jenis === "info" ? "status" : "alert"} className={cn("rounded-lg border-l-8 bg-permukaan p-4", gaya)}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-6", className)} />;
}
