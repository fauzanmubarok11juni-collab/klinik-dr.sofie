"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TombolCetak({ label = "Cetak" }: { label?: string }) {
  return (
    <Button ukuran="besar" onClick={() => window.print()}>
      <Printer aria-hidden className="h-5 w-5" />
      {label}
    </Button>
  );
}
