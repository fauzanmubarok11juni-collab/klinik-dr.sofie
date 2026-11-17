"use client";

import { Banner } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Galat({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Banner jenis="bahaya">
        <p className="font-bold">Halaman ini belum bisa dibuka.</p>
        <p>Periksa koneksi internet, lalu tekan “Coba lagi”. Data yang sudah tersimpan aman.</p>
      </Banner>
      <Button ukuran="besar" onClick={reset}>Coba lagi</Button>
    </div>
  );
}
