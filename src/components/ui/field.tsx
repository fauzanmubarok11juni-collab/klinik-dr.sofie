import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full min-h-[44px] rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta placeholder:text-redup focus:border-utama",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Field({
  label, htmlFor, hint, error, children,
}: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-bold">{label}</label>
      {children}
      {hint && <p className="text-sm text-redup">{hint}</p>}
      {error && <p role="alert" className="text-sm font-bold text-bahaya">{error}</p>}
    </div>
  );
}

/** Pilihan satu-dari-beberapa berbentuk tombol besar (mudah disentuh, bisa dipakai dengan keyboard). */
export function PilihanRadio({
  name, pilihan, defaultValue, legend, error, wajib,
}: {
  name: string;
  pilihan: { nilai: string; label: string }[];
  defaultValue?: string;
  legend: string;
  error?: string;
  wajib?: boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {pilihan.map((p) => (
          <label key={p.nilai} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={p.nilai}
              defaultChecked={defaultValue === p.nilai}
              required={wajib}
              className="peer sr-only"
            />
            <span className="flex min-h-[44px] items-center rounded-lg border-2 border-garis bg-permukaan px-5 font-bold peer-checked:border-utama peer-checked:bg-utama peer-checked:text-utama-teks peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-utama">
              {p.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-bold text-bahaya">{error}</p>}
    </fieldset>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg border-2 border-garis bg-permukaan px-3 py-2 text-base text-tinta placeholder:text-redup focus:border-utama"
    />
  );
}
