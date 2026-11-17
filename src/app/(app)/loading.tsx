import { Skeleton } from "@/components/ui/card";

export default function Memuat() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman" className="space-y-4">
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
