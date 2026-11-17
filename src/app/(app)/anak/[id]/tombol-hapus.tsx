"use client";

import { hapusPertumbuhan } from "../actions";

export function TombolHapus({ id, pasienId, label }: { id: string; pasienId: string; label: string }) {
  return (
    <form action={hapusPertumbuhan.bind(null, id, pasienId)}
      onSubmit={(e) => { if (!window.confirm(`Hapus pengukuran ${label}? Tindakan ini tercatat di audit.`)) e.preventDefault(); }}>
      <button type="submit" className="min-h-[44px] rounded-lg px-3 font-bold text-bahaya underline hover:bg-garis/50">Hapus</button>
    </form>
  );
}
