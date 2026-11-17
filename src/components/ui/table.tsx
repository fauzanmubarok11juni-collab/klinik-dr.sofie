import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Pembungkus tabel: bila sempit, tabel menggulir di dalam kotaknya sendiri (halaman tidak bergeser).
export function Tabel({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border-2 border-garis bg-permukaan">
      <table className={cn("w-full text-left text-base", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("border-b-2 border-garis px-4 py-3 font-bold", className)} {...props} />;
}
export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-garis px-4 py-3", className)} {...props} />;
}
