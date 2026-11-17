import { GARIS_Z } from "@/lib/who";

export type TitikGrafik = { x: number; y: number };
export type KurvaGrafik = { z: number; titik: TitikGrafik[] };

const L = 52, R = 40, T = 16, B = 40, W = 640, H = 360;
const warna = { garis: "rgb(var(--garis))", tinta: "rgb(var(--tinta))", redup: "rgb(var(--redup))", anak: "rgb(var(--utama))" };

function tickBagus(min: number, max: number, n = 6): number[] {
  const rentang = Math.max(max - min, 1e-9);
  const kasar = rentang / n;
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar)));
  const f = kasar / pangkat;
  const langkah = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pangkat;
  const awal = Math.ceil(min / langkah) * langkah;
  const hasil: number[] = [];
  for (let v = awal; v <= max + 1e-9; v += langkah) hasil.push(Math.round(v * 1000) / 1000);
  return hasil;
}

const labelZ = (z: number) => (z === 0 ? "Median" : z > 0 ? `+${z}` : `−${Math.abs(z)}`);
const POLA: Record<number, { lebar: number; dash?: string }> = { [-3]: { lebar: 1.2, dash: "2 4" }, [-2]: { lebar: 1.5, dash: "7 4" }, 0: { lebar: 2.5 }, 2: { lebar: 1.5, dash: "7 4" }, 3: { lebar: 1.2, dash: "2 4" } };

/** Grafik pertumbuhan WHO: kurva −3, −2, median, +2, +3 SD dan titik pengukuran anak. SVG murni, ikut tema dan bisa dicetak. */
export function GrafikPertumbuhan({
  judul, labelX, labelY, kurva, titik, xMin, xMax, formatX, ringkasan,
}: {
  judul: string; labelX: string; labelY: string; kurva: KurvaGrafik[]; titik: TitikGrafik[];
  xMin: number; xMax: number; formatX?: (x: number) => string; ringkasan: string;
}) {
  const semuaY = [...kurva.flatMap((k) => k.titik.map((p) => p.y)), ...titik.map((p) => p.y)];
  if (kurva.length === 0 || semuaY.length === 0) return null;
  const yLo = Math.min(...semuaY), yHi = Math.max(...semuaY);
  const pad = (yHi - yLo) * 0.04;
  const yMin = yLo - pad, yMax = yHi + pad;
  const sx = (x: number) => L + ((x - xMin) / Math.max(xMax - xMin, 1e-9)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - yMin) / Math.max(yMax - yMin, 1e-9)) * (H - T - B);
  const jalur = (p: TitikGrafik[]) => p.map((q, i) => `${i === 0 ? "M" : "L"}${sx(q.x).toFixed(1)} ${sy(q.y).toFixed(1)}`).join(" ");
  const xTick = tickBagus(xMin, xMax, 8), yTick = tickBagus(yMin, yMax, 6);
  const fx = formatX ?? ((x: number) => String(x));
  const titikAnak = titik.filter((p) => p.x >= xMin && p.x <= xMax).sort((a, b) => a.x - b.x);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${judul}. ${ringkasan}`} className="h-auto w-full max-w-[720px]">
        <title>{judul}</title>
        {yTick.map((v) => (<g key={`y${v}`}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke={warna.garis} strokeWidth={0.7} /><text x={L - 6} y={sy(v) + 4} textAnchor="end" fontSize={11} fill={warna.redup}>{v}</text></g>))}
        {xTick.map((v) => (<g key={`x${v}`}><line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} stroke={warna.garis} strokeWidth={0.5} /><text x={sx(v)} y={H - B + 16} textAnchor="middle" fontSize={11} fill={warna.redup}>{fx(v)}</text></g>))}
        <line x1={L} x2={L} y1={T} y2={H - B} stroke={warna.tinta} strokeWidth={1} />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={warna.tinta} strokeWidth={1} />
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill={warna.tinta}>{labelX}</text>
        <text x={14} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill={warna.tinta} transform={`rotate(-90 14 ${(T + H - B) / 2})`}>{labelY}</text>

        {GARIS_Z.map((z) => {
          const k = kurva.find((c) => c.z === z);
          if (!k || k.titik.length === 0) return null;
          const akhir = k.titik[k.titik.length - 1];
          const pola = POLA[z];
          return (
            <g key={z}>
              <path d={jalur(k.titik)} fill="none" stroke={warna.tinta} strokeWidth={pola.lebar} strokeDasharray={pola.dash} opacity={z === 0 ? 0.9 : 0.55} />
              <text x={sx(akhir.x) + 4} y={sy(akhir.y) + 4} fontSize={10.5} fill={warna.tinta}>{labelZ(z)}</text>
            </g>
          );
        })}

        {titikAnak.length > 1 && <path d={jalur(titikAnak)} fill="none" stroke={warna.anak} strokeWidth={2.5} />}
        {titikAnak.map((p, i) => (<circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={5} fill={warna.anak} stroke="rgb(var(--permukaan))" strokeWidth={1.5} />))}
      </svg>
      <figcaption className="mt-1 text-sm text-redup">Garis putus-putus: ±2 SD, titik-titik: ±3 SD, garis tebal: median WHO. Lingkaran: pengukuran anak.</figcaption>
    </figure>
  );
}

/** Tren skor kecil (untuk skrining geriatri). */
export function TrenSkor({ nilai, maks, label }: { nilai: number[]; maks: number; label: string }) {
  if (nilai.length < 2) return null;
  const w = 120, h = 32;
  const sx = (i: number) => 4 + (i / (nilai.length - 1)) * (w - 8);
  const sy = (v: number) => h - 4 - (v / Math.max(maks, 1)) * (h - 8);
  const d = nilai.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="h-8 w-[120px]">
      <path d={d} fill="none" stroke={warna.anak} strokeWidth={2} />
      {nilai.map((v, i) => <circle key={i} cx={sx(i)} cy={sy(v)} r={2.5} fill={warna.anak} />)}
    </svg>
  );
}
