import type { ReactNode } from "react";

export function PageHeader({
  judul, deskripsi, aksi,
}: { judul: string; deskripsi?: string; aksi?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{judul}</h1>
        {deskripsi && <p className="mt-1 max-w-prose text-redup">{deskripsi}</p>}
      </div>
      {aksi}
    </div>
  );
}
