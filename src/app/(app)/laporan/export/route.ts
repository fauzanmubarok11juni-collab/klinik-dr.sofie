import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ambilLaporan, JENIS_LAPORAN, type JenisLaporan } from "@/lib/laporan";
import { buatCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Silakan masuk terlebih dahulu.", { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("role, aktif").eq("id", user.id).single();
  if (!prof || prof.role !== "dokter" || !prof.aktif) return new NextResponse("Ekspor laporan khusus Dokter.", { status: 403 });

  const u = new URL(req.url);
  const jenis = JENIS_LAPORAN.find((j) => j.kode === u.searchParams.get("jenis"))?.kode as JenisLaporan | undefined;
  const dari = u.searchParams.get("dari") ?? "";
  const sampai = u.searchParams.get("sampai") ?? "";
  if (!jenis) return new NextResponse("Jenis laporan tidak dikenal.", { status: 400 });

  const { laporan, error } = await ambilLaporan(supabase, jenis, dari, sampai);
  if (!laporan) return new NextResponse(error ?? "Laporan gagal dibuat.", { status: 400 });

  const csv = buatCSV(laporan.kolom, [...laporan.baris, ...(laporan.total ? [laporan.total] : [])]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-${jenis}-${dari}_${sampai}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
