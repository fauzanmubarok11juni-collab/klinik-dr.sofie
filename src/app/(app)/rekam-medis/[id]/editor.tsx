"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { formatJam } from "@/lib/format";
import {
  adaIsiSoap, cekVital, gabungKeluhan, hitungBMI, kategoriBMI, tandaVital,
  type DataRekam, type KunciVital, type TemplateIsi, type TemplateRow,
} from "@/lib/rekam";
import type { SesiKode, StatusKunjungan } from "@/lib/types";
import { ubahStatus } from "../../pasien/actions";
import { simpanResepKunjungan } from "../../obat/actions";
import { PanelObat } from "@/components/obat/panel-obat";
import type { ItemObat, ResepState } from "@/lib/obat";
import { hapusTemplatePribadi, simpanRekamMedis, simpanTemplatePribadi } from "../actions";
import { PilihDiagnosis } from "./pilih-diagnosis";
import { PilihTindakan, type MasterTindakan } from "./pilih-tindakan";

type Props = {
  encounterId: string;
  pasienId: string;
  statusAwal: StatusKunjungan;
  sesiKode: SesiKode;
  namaPasien: string;
  kategori: "umum" | "anak" | "lansia";
  dewasa: boolean;
  keluhanDaftar: string | null;
  awal: DataRekam;
  serverUpdatedAt: string | null;
  master: MasterTindakan[];
  templates: TemplateRow[];
  hintBBTB: { bb?: string; tb?: string };
  awalResep: ResepState;
  jualAwal: ItemObat[];
  resepTerakhir: ItemObat[] | null;
};

type Tab = "S" | "O" | "A" | "P" | "R";
type Simpan = "bersih" | "kotor" | "menyimpan" | "gagal";

const TABS: { id: Tab; label: string; panjang: string }[] = [
  { id: "S", label: "Subjective", panjang: "Keluhan dan riwayat" },
  { id: "O", label: "Objective", panjang: "Tanda vital dan pemeriksaan" },
  { id: "A", label: "Assessment", panjang: "Penilaian dan diagnosis" },
  { id: "P", label: "Plan", panjang: "Rencana, tindakan, catatan" },
  { id: "R", label: "Obat", panjang: "Resep dan penjualan" },
];

const jsonSama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function EditorRekamMedis(p: Props) {
  const router = useRouter();
  const kunciDraf = `draf-rm:${p.encounterId}`;

  const [data, setData] = useState<DataRekam>(p.awal);
  const dataRef = useRef<DataRekam>(p.awal);
  const versi = useRef(0);
  const versiTersimpan = useRef(0);
  const sedangSimpan = useRef(false);

  const [status, setStatus] = useState<Simpan>("bersih");
  const [waktuSimpan, setWaktuSimpan] = useState<string | null>(p.serverUpdatedAt);
  const [tab, setTab] = useState<Tab>("S");
  const [mode, setMode] = useState<SesiKode>(p.sesiKode);
  const [galat, setGalat] = useState<string | null>(null);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [drafDipulihkan, setDrafDipulihkan] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>(p.templates);
  const [resep, setResep] = useState<ResepState>(p.awalResep);
  const resepRef = useRef<ResepState>(p.awalResep);
  const resepVersi = useRef(0);
  const resepTersimpan = useRef(0);
  const [jumlahPeringatan, setJumlahPeringatan] = useState(0);
  const [menyelesaikan, setMenyelesaikan] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // ---------- perubahan data ----------
  const ubah = useCallback((fn: (d: DataRekam) => DataRekam) => {
    const baru = fn(dataRef.current);
    dataRef.current = baru;
    setData(baru);
    versi.current += 1;
    setStatus((s) => (s === "menyimpan" ? s : "kotor"));
    try { localStorage.setItem(kunciDraf, JSON.stringify({ waktu: Date.now(), data: baru, resep: resepRef.current })); } catch { /* abaikan */ }
  }, [kunciDraf]);

  const ubahResep = useCallback((r: ResepState) => {
    resepRef.current = r;
    setResep(r);
    resepVersi.current += 1;
    versi.current += 1;
    setStatus((st) => (st === "menyimpan" ? st : "kotor"));
    try { localStorage.setItem(kunciDraf, JSON.stringify({ waktu: Date.now(), data: dataRef.current, resep: r })); } catch { /* abaikan */ }
  }, [kunciDraf]);

  const ubahSoap = (k: keyof DataRekam["soap"], v: string) => ubah((d) => ({ ...d, soap: { ...d.soap, [k]: v } }));
  const ubahVital = (k: KunciVital, v: string) => ubah((d) => ({ ...d, vitals: { ...d.vitals, [k]: v } }));

  // ---------- simpan ----------
  const simpan = useCallback(async (selesai = false): Promise<boolean> => {
    if (sedangSimpan.current) return false;
    sedangSimpan.current = true;
    setStatus("menyimpan");
    const v = versi.current;
    // Resep disimpan lebih dulu, supaya status Selesai baru ditetapkan setelah resep aman.
    const rv = resepVersi.current;
    let galatResep: string | null = null;
    if (rv !== resepTersimpan.current) {
      try {
        const hr = await simpanResepKunjungan(p.encounterId, resepRef.current);
        if (hr.ok) resepTersimpan.current = rv; else galatResep = hr.error ?? "Resep belum tersimpan.";
      } catch { galatResep = "Tidak ada koneksi internet."; }
    }
    if (galatResep && selesai) {
      sedangSimpan.current = false;
      setGalat(galatResep);
      setStatus("gagal");
      return false;
    }
    let hasil;
    try {
      hasil = await simpanRekamMedis(p.encounterId, dataRef.current, selesai);
    } catch {
      hasil = { ok: false, error: "Tidak ada koneksi internet." } as const;
    }
    sedangSimpan.current = false;
    if (!hasil.ok) {
      setGalat(hasil.error ?? "Belum tersimpan.");
      setStatus("gagal");
      return false;
    }
    if (galatResep) {
      setGalat(galatResep);
      setStatus("gagal");
      return false;
    }
    setGalat(null);
    setPeringatan("peringatan" in hasil && hasil.peringatan ? hasil.peringatan : []);
    versiTersimpan.current = v;
    setWaktuSimpan(("updatedAt" in hasil && hasil.updatedAt) || new Date().toISOString());
    if (versi.current === v) {
      setStatus("bersih");
      try { localStorage.removeItem(kunciDraf); } catch { /* abaikan */ }
    } else {
      setStatus("kotor");
    }
    return true;
  }, [p.encounterId, kunciDraf]);

  // Autosave: setiap 5 detik bila ada perubahan (dan terus mencoba lagi bila gagal).
  useEffect(() => {
    const t = setInterval(() => {
      if (versi.current !== versiTersimpan.current && !sedangSimpan.current) void simpan();
    }, 5000);
    return () => clearInterval(t);
  }, [simpan]);

  // Pindah tab/jendela atau menutup: simpan segera; peringatkan bila masih ada yang belum tersimpan.
  useEffect(() => {
    const saatSembunyi = () => {
      if (document.visibilityState === "hidden" && versi.current !== versiTersimpan.current) void simpan();
    };
    const sebelumTutup = (e: BeforeUnloadEvent) => {
      if (versi.current !== versiTersimpan.current) { e.preventDefault(); e.returnValue = ""; }
    };
    document.addEventListener("visibilitychange", saatSembunyi);
    window.addEventListener("beforeunload", sebelumTutup);
    return () => {
      document.removeEventListener("visibilitychange", saatSembunyi);
      window.removeEventListener("beforeunload", sebelumTutup);
    };
  }, [simpan]);

  // Saat dibuka: mulai pemeriksaan (Menunggu -> Diperiksa) dan pulihkan draf bila ada yang lebih baru dari server.
  useEffect(() => {
    if (p.statusAwal === "menunggu") void ubahStatus(p.encounterId, "diperiksa");
    try {
      const mentah = localStorage.getItem(kunciDraf);
      if (!mentah) return;
      const draf = JSON.parse(mentah) as { waktu: number; data: DataRekam; resep?: ResepState };
      const waktuServer = p.serverUpdatedAt ? Date.parse(p.serverUpdatedAt) : 0;
      if (draf.waktu > waktuServer && (!jsonSama(draf.data, p.awal) || (draf.resep && !jsonSama(draf.resep, p.awalResep)))) {
        if (draf.resep) { resepRef.current = draf.resep; setResep(draf.resep); resepVersi.current += 1; }
        dataRef.current = draf.data;
        setData(draf.data);
        versi.current += 1;
        setStatus("kotor");
        setDrafDipulihkan(true);
      } else {
        localStorage.removeItem(kunciDraf);
      }
    } catch { /* abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- selesai ----------
  async function tunggu() {
    for (let i = 0; i < 100 && sedangSimpan.current; i++) await new Promise((r) => setTimeout(r, 100));
  }
  async function prosesSelesai() {
    setMenyelesaikan(true);
    await tunggu();
    const ok = await simpan(true);
    setMenyelesaikan(false);
    if (ok) {
      router.push(`/hari-ini?sesi=${p.sesiKode}&selesai=${encodeURIComponent(p.namaPasien)}`);
      return;
    }
    if (Object.keys(cekVital(dataRef.current.vitals)).length) setTab("O");
  }
  function klikSelesai() {
    if (dataRef.current.diagnoses.length === 0) dialog.current?.showModal();
    else void prosesSelesai();
  }

  // ---------- template ----------
  const tplBawaan = templates.find((t) => t.mode === mode && !t.pribadi);
  const tplPribadi = templates.find((t) => t.mode === mode && t.pribadi);

  function terapkan(isi: TemplateIsi) {
    if (adaIsiSoap(dataRef.current.soap) && !window.confirm("Isi SOAP yang sekarang akan diganti dengan template. Lanjutkan?")) return;
    ubah((d) => ({
      ...d,
      soap: {
        ...d.soap,
        subjective: gabungKeluhan(p.keluhanDaftar, isi.subjective),
        objective: isi.objective, assessment: isi.assessment, plan: isi.plan,
      },
    }));
  }
  async function simpanSebagaiTemplate() {
    const s = dataRef.current.soap;
    const isi: TemplateIsi = { subjective: s.subjective, objective: s.objective, assessment: s.assessment, plan: s.plan };
    const r = await simpanTemplatePribadi(p.kategori, mode, isi);
    if (r.ok) setTemplates((t) => [...t.filter((x) => !(x.mode === mode && x.pribadi)), { mode, pribadi: true, isi }]);
    else setGalat(r.error ?? "Template belum tersimpan.");
  }
  async function hapusTemplate() {
    if (!window.confirm("Hapus template pribadi ini dan kembali memakai template bawaan?")) return;
    const r = await hapusTemplatePribadi(p.kategori, mode);
    if (r.ok) setTemplates((t) => t.filter((x) => !(x.mode === mode && x.pribadi)));
  }

  // ---------- tampilan ----------
  const errVital = cekVital(data.vitals);
  const tanda = tandaVital(data.vitals, p.dewasa);
  const bmi = hitungBMI(data.vitals.bb, data.vitals.tb);

  const teksStatus =
    status === "menyimpan" ? "Menyimpan…"
    : status === "gagal" ? "Belum tersimpan. Periksa internet; draf aman di perangkat ini dan dicoba lagi otomatis."
    : status === "kotor" ? "Ada perubahan, disimpan otomatis…"
    : waktuSimpan ? `Tersimpan pukul ${formatJam(waktuSimpan)}` : "Belum ada perubahan";

  function pindahTab(e: React.KeyboardEvent, i: number) {
    const arah = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!arah) return;
    e.preventDefault();
    const baru = TABS[(i + arah + TABS.length) % TABS.length].id;
    setTab(baru);
    document.getElementById(`tab-${baru}`)?.focus();
  }

  const kolomVital = (k: KunciVital, label: string, satuan: string, hint?: string) => (
    <div key={k}>
      <label htmlFor={`v-${k}`} className="mb-1 block font-bold">{label} <span className="font-normal text-redup">({satuan})</span></label>
      <input
        id={`v-${k}`} inputMode="decimal" autoComplete="off" enterKeyHint="next"
        value={data.vitals[k]} onChange={(e) => ubahVital(k, e.target.value)}
        aria-invalid={!!errVital[k]} aria-describedby={`v-${k}-info`}
        className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama aria-[invalid=true]:border-bahaya"
      />
      <p id={`v-${k}-info`} className="min-h-[1.25rem] text-sm">
        {errVital[k] ? <span role="alert" className="font-bold text-bahaya">{errVital[k]}</span>
          : tanda[k] ? <span className="font-bold text-peringatan">{tanda[k]}</span>
          : hint ? <span className="text-redup">{hint}</span> : null}
      </p>
    </div>
  );

  return (
    <div className="pb-28">
      {drafDipulihkan && (
        <div className="mb-4"><Banner jenis="peringatan">Ada isian yang belum sempat tersimpan sebelumnya. Isian itu sudah dipulihkan dan akan disimpan otomatis.</Banner></div>
      )}
      {galat && <div className="mb-4"><Banner jenis="bahaya">{galat}</Banner></div>}
      {peringatan.length > 0 && (
        <div className="mb-4"><Banner jenis="peringatan">Angka ini belum disimpan karena tidak masuk akal: {peringatan.join(", ")}. Periksa di tab Objective.</Banner></div>
      )}

      {/* Mode + template */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Mode pemeriksaan" className="inline-flex rounded-lg border-2 border-garis bg-permukaan p-1">
          {(["pagi", "malam"] as const).map((m) => (
            <button
              key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`min-h-[44px] rounded-md px-4 font-bold ${mode === m ? "bg-utama text-utama-teks" : "hover:bg-garis/50"}`}
            >
              {m === "pagi" ? "Mode Pagi (cepat)" : "Mode Malam (konsultatif)"}
            </button>
          ))}
        </div>
        <details className="relative">
          <summary className="flex min-h-[44px] cursor-pointer items-center rounded-lg border-2 border-garis bg-permukaan px-4 font-bold">Template</summary>
          <div className="absolute z-20 mt-1 flex w-72 flex-col gap-2 rounded-lg border-2 border-garis bg-permukaan p-3 shadow-lg">
            <p className="text-sm text-redup">Untuk pasien {p.kategori}, mode {mode}.</p>
            {tplBawaan && <Button variant="sekunder" onClick={() => terapkan(tplBawaan.isi)}>Terapkan template bawaan</Button>}
            {tplPribadi && <Button variant="sekunder" onClick={() => terapkan(tplPribadi.isi)}>Terapkan template saya</Button>}
            <Button variant="sekunder" onClick={simpanSebagaiTemplate}>Simpan isi SOAP ini sebagai template saya</Button>
            {tplPribadi && <Button variant="senyap" onClick={hapusTemplate}>Hapus template saya</Button>}
          </div>
        </details>
      </div>

      {/* Tab */}
      <div role="tablist" aria-label="Bagian rekam medis" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.id} id={`tab-${t.id}`} role="tab" type="button"
            aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)} onKeyDown={(e) => pindahTab(e, i)}
            className={`min-h-[48px] rounded-lg border-2 px-4 text-left font-bold ${tab === t.id ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama"}`}
          >
            {t.label}{t.id === "R" && jumlahPeringatan > 0 ? ` (${jumlahPeringatan} peringatan)` : ""}
            <span className="hidden text-sm font-normal sm:block">{t.panjang}</span>
          </button>
        ))}
      </div>

      {/* S */}
      <section id="panel-S" role="tabpanel" aria-labelledby="tab-S" hidden={tab !== "S"} className="space-y-3">
        <label htmlFor="soap-s" className="block font-bold">Keluhan dan riwayat (Subjective)</label>
        <Textarea id="soap-s" rows={10} value={data.soap.subjective} onChange={(e) => ubahSoap("subjective", e.target.value)} />
      </section>

      {/* O */}
      <section id="panel-O" role="tabpanel" aria-labelledby="tab-O" hidden={tab !== "O"} className="space-y-5">
        <div>
          <h2 className="mb-3 text-lg font-bold">Tanda vital</h2>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className="mb-1 block font-bold">Tekanan darah <span className="font-normal text-redup">(mmHg)</span></span>
              <div className="flex items-center gap-2">
                <input aria-label="Tekanan darah atas" id="v-td_sistolik" inputMode="numeric" autoComplete="off" enterKeyHint="next"
                  value={data.vitals.td_sistolik} onChange={(e) => ubahVital("td_sistolik", e.target.value)}
                  aria-invalid={!!errVital.td_sistolik}
                  className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama aria-[invalid=true]:border-bahaya" />
                <span aria-hidden className="text-xl">/</span>
                <input aria-label="Tekanan darah bawah" id="v-td_diastolik" inputMode="numeric" autoComplete="off" enterKeyHint="next"
                  value={data.vitals.td_diastolik} onChange={(e) => ubahVital("td_diastolik", e.target.value)}
                  aria-invalid={!!errVital.td_diastolik}
                  className="min-h-[44px] w-full rounded-lg border-2 border-garis bg-permukaan px-3 text-base text-tinta focus:border-utama aria-[invalid=true]:border-bahaya" />
              </div>
              <p className="min-h-[1.25rem] text-sm">
                {errVital.td_sistolik || errVital.td_diastolik
                  ? <span role="alert" className="font-bold text-bahaya">{errVital.td_sistolik ?? errVital.td_diastolik}</span>
                  : tanda.td_sistolik ? <span className="font-bold text-peringatan">{tanda.td_sistolik}</span> : null}
              </p>
            </div>
            {kolomVital("nadi", "Nadi", "x/menit")}
            {kolomVital("rr", "Napas", "x/menit")}
            {kolomVital("suhu", "Suhu", "°C")}
            {kolomVital("spo2", "SpO2", "%")}
            {kolomVital("bb", "Berat badan", "kg", p.hintBBTB.bb ? `Terakhir: ${p.hintBBTB.bb} kg` : undefined)}
            {kolomVital("tb", "Tinggi badan", "cm", p.hintBBTB.tb ? `Terakhir: ${p.hintBBTB.tb} cm` : undefined)}
            {kolomVital("lingkar_perut", "Lingkar perut", "cm")}
          </div>
          <div className="mt-2 rounded-lg border-2 border-garis bg-permukaan p-3" aria-live="polite">
            <span className="font-bold">IMT (BMI): </span>
            {bmi === null ? <span className="text-redup">isi berat dan tinggi badan</span>
              : p.dewasa ? <span>{bmi.toString().replace(".", ",")} kg/m², {kategoriBMI(bmi)} <span className="text-sm text-redup">(kriteria Kemenkes)</span></span>
              : <span>{bmi.toString().replace(".", ",")} kg/m² <a className="text-sm font-bold underline" target="_blank" rel="noopener" href={`/anak/${p.pasienId}`}>Pasien anak: lihat Z-score dan kurva pertumbuhan</a></span>}
          </div>
        </div>
        <div>
          <label htmlFor="soap-o" className="mb-1.5 block font-bold">Pemeriksaan fisik (Objective)</label>
          <Textarea id="soap-o" rows={8} value={data.soap.objective} onChange={(e) => ubahSoap("objective", e.target.value)} />
        </div>
      </section>

      {/* A */}
      <section id="panel-A" role="tabpanel" aria-labelledby="tab-A" hidden={tab !== "A"} className="space-y-6">
        <PilihDiagnosis items={data.diagnoses} onChange={(x) => ubah((d) => ({ ...d, diagnoses: x }))} />
        <div>
          <label htmlFor="soap-a" className="mb-1.5 block font-bold">Catatan penilaian (Assessment)</label>
          <Textarea id="soap-a" rows={5} value={data.soap.assessment} onChange={(e) => ubahSoap("assessment", e.target.value)} />
        </div>
      </section>

      {/* P */}
      <section id="panel-P" role="tabpanel" aria-labelledby="tab-P" hidden={tab !== "P"} className="space-y-6">
        <div>
          <label htmlFor="soap-p" className="mb-1.5 block font-bold">Rencana terapi dan edukasi (Plan)</label>
          <Textarea id="soap-p" rows={6} value={data.soap.plan} onChange={(e) => ubahSoap("plan", e.target.value)} />
        </div>
        <PilihTindakan master={p.master} items={data.services} onChange={(x) => ubah((d) => ({ ...d, services: x }))} />
        <Banner>
          Resep ke apotek luar dan penjualan obat dari stok klinik ada di tab <span className="font-bold">Obat</span>.{" "}
          <a className="font-bold underline" target="_blank" rel="noopener" href={`/kontrol/baru?pasien=${p.pasienId}&kunjungan=${p.encounterId}`}>Atur jadwal kontrol</a>
        </Banner>
        <div>
          <label htmlFor="soap-c" className="mb-1.5 block font-bold">Catatan bebas</label>
          <Textarea id="soap-c" rows={3} value={data.soap.catatan} onChange={(e) => ubahSoap("catatan", e.target.value)} />
        </div>
      </section>

      {/* R */}
      <section id="panel-R" role="tabpanel" aria-labelledby="tab-R" hidden={tab !== "R"}>
        <PanelObat
          encounterId={p.encounterId} resep={resep} onResep={ubahResep} jualAwal={p.jualAwal}
          resepTerakhir={p.resepTerakhir} onJumlahPeringatan={setJumlahPeringatan}
        />
      </section>

      {/* Bilah bawah */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 border-garis bg-permukaan px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className={`text-sm font-bold ${status === "gagal" ? "text-bahaya" : "text-redup"}`}>{teksStatus}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/hari-ini" className="inline-flex min-h-[44px] items-center px-3 font-bold underline">Daftar pasien</Link>
            <Button variant="sekunder" onClick={() => void simpan()} disabled={status === "menyimpan"}>Simpan sekarang</Button>
            <Button ukuran="besar" onClick={klikSelesai} disabled={menyelesaikan}>{menyelesaikan ? "Menyimpan…" : "Simpan dan selesai"}</Button>
          </div>
        </div>
      </div>

      <dialog
        ref={dialog} aria-labelledby="judul-tanpa-dx"
        className="w-[min(28rem,92vw)] rounded-xl border-2 border-garis bg-permukaan p-6 text-tinta backdrop:bg-black/50"
      >
        <h2 id="judul-tanpa-dx" className="text-xl font-bold">Belum ada diagnosis</h2>
        <p className="mt-2">Kunjungan ini belum punya diagnosis. Tetap tandai selesai?</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => { dialog.current?.close(); void prosesSelesai(); }}>Ya, tetap selesai</Button>
          <Button variant="sekunder" autoFocus onClick={() => { dialog.current?.close(); setTab("A"); }}>Isi diagnosis dulu</Button>
        </div>
      </dialog>
    </div>
  );
}
