import { AppShell } from "@/components/app-shell";
import { ambilProfil } from "@/lib/auth";

export default async function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const profil = await ambilProfil();
  return (
    <AppShell nama={profil.nama} role={profil.role}>
      {children}
    </AppShell>
  );
}
