import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type Profil = { id: string; nama: string; role: Role };

export async function ambilProfil(): Promise<Profil> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("id, nama, role, aktif")
    .eq("id", user.id)
    .single();

  if (!data || !data.aktif) {
    await supabase.auth.signOut();
    redirect("/login?alasan=nonaktif");
  }
  return { id: data.id, nama: data.nama, role: data.role as Role };
}

/** Pakai di halaman khusus Dokter. Asisten diarahkan kembali ke Beranda. */
export async function wajibRole(role: Role): Promise<Profil> {
  const profil = await ambilProfil();
  if (profil.role !== role) redirect("/dashboard?akses=ditolak");
  return profil;
}
