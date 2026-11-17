import { Card, Banner } from "@/components/ui/card";
import { FormMasuk } from "./form-masuk";

const NAMA_PRAKTIK = process.env.NEXT_PUBLIC_NAMA_PRAKTIK || "Praktik dr.sop";

const PESAN: Record<string, string> = {
  idle: "Anda keluar otomatis karena 15 menit tidak ada aktivitas. Silakan masuk kembali.",
  nonaktif: "Akun ini sedang dinonaktifkan. Hubungi dokter.",
};

export default function HalamanLogin({ searchParams }: { searchParams: { alasan?: string } }) {
  const pesan = searchParams.alasan ? PESAN[searchParams.alasan] : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{NAMA_PRAKTIK}</h1>
        <p className="mt-1 text-redup">Masuk untuk membuka sistem praktik.</p>
      </div>
      {pesan && <Banner jenis="peringatan">{pesan}</Banner>}
      <Card>
        <FormMasuk />
      </Card>
    </main>
  );
}
