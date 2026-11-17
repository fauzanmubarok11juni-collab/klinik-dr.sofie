import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export function HalamanKosong({
  judul, deskripsi, iterasi, akanAda,
}: { judul: string; deskripsi: string; iterasi: number; akanAda: string[] }) {
  return (
    <>
      <PageHeader judul={judul} deskripsi={deskripsi} />
      <Card>
        <p className="font-bold">Halaman ini akan diisi pada Iterasi {iterasi}.</p>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-redup">
          {akanAda.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Card>
    </>
  );
}
