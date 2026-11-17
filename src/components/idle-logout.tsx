"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const BATAS_MS = 15 * 60 * 1000; // 15 menit tanpa aktivitas

export function IdleLogout() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const keluar = async () => {
      await createClient().auth.signOut();
      router.replace("/login?alasan=idle");
      router.refresh();
    };
    const ulang = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(keluar, BATAS_MS);
    };
    const kejadian = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    kejadian.forEach((e) => window.addEventListener(e, ulang, { passive: true }));
    ulang();
    return () => {
      clearTimeout(timer.current);
      kejadian.forEach((e) => window.removeEventListener(e, ulang));
    };
  }, [router]);

  return null;
}
