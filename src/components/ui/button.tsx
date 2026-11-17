import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Semua tombol minimal 44x44 px (min-h-11 = 2,75rem; membesar saat Mode Besar).
const tombol = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[44px] min-w-[44px]",
  {
    variants: {
      variant: {
        utama: "bg-utama text-utama-teks hover:opacity-90",
        sekunder: "bg-permukaan text-tinta border-2 border-garis hover:border-utama",
        bahaya: "bg-bahaya text-white hover:opacity-90",
        senyap: "text-tinta hover:bg-garis/50",
      },
      ukuran: {
        biasa: "px-4 text-base",
        // Satu aksi utama per layar: tombol besar.
        besar: "px-6 min-h-[56px] text-lg",
      },
    },
    defaultVariants: { variant: "utama", ukuran: "biasa" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tombol> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ukuran, ...props }, ref) => (
    <button ref={ref} className={cn(tombol({ variant, ukuran }), className)} {...props} />
  )
);
Button.displayName = "Button";

/** Pakai pada <Link> agar tampil seperti tombol: className={gayaTombol({ ukuran: "besar" })} */
export const gayaTombol = tombol;
