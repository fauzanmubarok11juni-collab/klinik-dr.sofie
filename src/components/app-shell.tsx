"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Moon, Sun, ZoomIn, LogOut } from "lucide-react";
import { MENU, NAMA_ROLE, type Role } from "@/lib/roles";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { IdleLogout } from "@/components/idle-logout";
import { keluar } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const NAMA_PRAKTIK = process.env.NEXT_PUBLIC_NAMA_PRAKTIK || "Praktik dr.sop";

export function AppShell({
  nama, role, children,
}: { nama: string; role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const [buka, setBuka] = useState(false);
  const { besar, setBesar, gelap, setGelap } = useSettings();
  const menu = MENU.filter((m) => m.roles.includes(role));

  const navigasi = (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      {menu.map(({ href, label, icon: Icon }) => {
        const aktif = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setBuka(false)}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-lg px-3 font-bold",
              aktif ? "bg-utama text-utama-teks" : "hover:bg-garis/50"
            )}
          >
            <Icon aria-hidden className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      {role === "asisten" && <IdleLogout />}

      {/* Menu samping (layar lebar) */}
      <aside className="no-print hidden border-r-2 border-garis bg-permukaan p-4 lg:block">
        <p className="mb-6 px-3 text-lg font-bold leading-tight">{NAMA_PRAKTIK}</p>
        {navigasi}
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b-2 border-garis bg-permukaan px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="sekunder"
              className="lg:hidden"
              aria-label={buka ? "Tutup menu" : "Buka menu"}
              aria-expanded={buka}
              onClick={() => setBuka(!buka)}
            >
              {buka ? <X aria-hidden /> : <Menu aria-hidden />}
            </Button>
            <div className="leading-tight">
              <p className="font-bold">{nama}</p>
              <p className="text-sm text-redup">{NAMA_ROLE[role]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={besar ? "utama" : "sekunder"}
              aria-pressed={besar}
              onClick={() => setBesar(!besar)}
              title="Mode Besar: huruf dan tombol lebih besar"
            >
              <ZoomIn aria-hidden className="h-5 w-5" />
              <span className="hidden sm:inline">Mode Besar</span>
            </Button>
            <Button
              variant="sekunder"
              aria-pressed={gelap}
              aria-label={gelap ? "Pakai tema terang" : "Pakai tema gelap"}
              onClick={() => setGelap(!gelap)}
            >
              {gelap ? <Sun aria-hidden className="h-5 w-5" /> : <Moon aria-hidden className="h-5 w-5" />}
            </Button>
            <form action={keluar}>
              <Button type="submit" variant="sekunder">
                <LogOut aria-hidden className="h-5 w-5" />
                <span className="hidden sm:inline">Keluar</span>
                <span className="sr-only sm:hidden">Keluar</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Menu geser (HP/tablet) */}
        {buka && (
          <div className="no-print border-b-2 border-garis bg-permukaan p-4 lg:hidden">{navigasi}</div>
        )}

        <main id="isi" className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
