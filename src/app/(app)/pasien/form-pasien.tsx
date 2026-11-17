"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/lib/types";
import { teksUmur, formatTanggal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Field, Input, PilihanRadio, Textarea } from "@/components/ui/field";

type Props = {
  mode: "baru" | "edit";
  aksi: (prev: FormState, fd: FormData) => Promise<FormState>;
  awal?: Record<string, string>;
  sesiDefault: "pagi" | "malam";
  hariIni: string;
  batalHref: string;
};

function TombolKirim({
  value, children, variant = "utama",
}: { value: string; children: React.ReactNode; variant?: "utama" | "sekunder" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="mode" value={value} variant={variant} ukuran="besar" disabled={pending}>
      {pending ? "Menyimpan…" : children}
    </Button>
  );
}

export function FormPasien({ mode, aksi, awal = {}, sesiDefault, hariIni, batalHref }: Props) {
  const [state, kirim] = useFormState<FormState, FormData>(aksi, {});
  const v = { ...awal, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  const [tgl, setTgl] = useState(v.tanggal_lahir ?? "");
  const umur = tgl ? teksUmur(tgl) : "";

  const opsionalTerisi = !!(v.nik || v.alergi || v.riwayat || v.kontak_nama || e.nik || e.kontak_hp);

  return (
    <form action={kirim} className="space-y-6" noValidate>
      {/* Tombol bawaan untuk tombol Enter: selalu menjalankan pemeriksaan duplikat. */}
      <button type="submit" name="mode" value={mode === "edit" || v.mode === "simpan" ? "simpan" : "daftar"} className="sr-only" tabIndex={-1} aria-hidden="true">
        Simpan
      </button>
      {state.error && !state.duplikat && <Banner jenis="bahaya">{state.error}</Banner>}

      {state.duplikat && (
        <Banner jenis="peringatan">
          <p className="font-bold">Sepertinya pasien ini sudah pernah terdaftar. Apakah salah satu di bawah ini orangnya?</p>
          <ul className="mt-3 space-y-3">
            {state.duplikat.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-garis p-3">
                <span>
                  <span className="block font-bold">{p.nama}</span>
                  <span className="text-redup">
                    {p.no_rm}, lahir {formatTanggal(p.tanggal_lahir)}{p.no_hp ? `, HP ${p.no_hp}` : ""}
                  </span>
                </span>
                <Link href={`/pasien/${p.id}/daftar`} className="inline-flex min-h-[44px] items-center rounded-lg bg-utama px-4 font-bold text-utama-teks">
                  Ya, daftarkan dia
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <TombolKirim value={`${v.mode === "simpan" ? "simpan" : "daftar"}_abaikan`} variant="sekunder">
              Bukan, ini pasien baru
            </TombolKirim>
          </div>
        </Banner>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nama pasien" htmlFor="nama" error={e.nama}>
            <Input id="nama" name="nama" defaultValue={v.nama} autoComplete="off" autoFocus required />
          </Field>
        </div>

        <Field label="Tanggal lahir" htmlFor="tanggal_lahir" error={e.tanggal_lahir}
          hint={umur ? `Umur: ${umur}` : "Ketik atau pilih dari kalender."}>
          <Input
            id="tanggal_lahir" name="tanggal_lahir" type="date" min="1900-01-01" max={hariIni}
            defaultValue={v.tanggal_lahir} onChange={(ev) => setTgl(ev.target.value)} required
          />
        </Field>

        <PilihanRadio
          legend="Jenis kelamin" name="jenis_kelamin" defaultValue={v.jenis_kelamin} error={e.jenis_kelamin} wajib
          pilihan={[{ nilai: "L", label: "Laki-laki" }, { nilai: "P", label: "Perempuan" }]}
        />

        <Field label="No. HP" htmlFor="no_hp" error={e.no_hp} hint="Boleh dikosongkan. Dipakai untuk pengingat kontrol.">
          <Input id="no_hp" name="no_hp" type="tel" inputMode="tel" defaultValue={v.no_hp} autoComplete="off" placeholder="081234567890" />
        </Field>

        <Field label="Alamat singkat" htmlFor="alamat">
          <Input id="alamat" name="alamat" defaultValue={v.alamat} autoComplete="off" />
        </Field>

        <PilihanRadio
          legend="Penjamin" name="penjamin" defaultValue={v.penjamin || "umum"} error={e.penjamin}
          pilihan={[{ nilai: "umum", label: "Umum" }, { nilai: "asuransi", label: "Asuransi" }]}
        />

        {mode === "baru" && (
          <>
            <PilihanRadio
              legend="Sesi hari ini" name="sesi" defaultValue={v.sesi || sesiDefault} error={e.sesi}
              pilihan={[{ nilai: "pagi", label: "Pagi" }, { nilai: "malam", label: "Malam" }]}
            />
            <div className="sm:col-span-2">
              <Field label="Keluhan utama" htmlFor="keluhan" hint="Cukup satu kalimat singkat.">
                <Textarea id="keluhan" name="keluhan" rows={2} defaultValue={v.keluhan} />
              </Field>
            </div>
          </>
        )}
      </div>

      <details open={opsionalTerisi} className="rounded-xl border-2 border-garis bg-permukaan p-4">
        <summary className="min-h-[44px] cursor-pointer font-bold leading-[44px]">
          Data tambahan (boleh dilewati)
        </summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field label="NIK" htmlFor="nik" error={e.nik} hint="16 angka.">
            <Input id="nik" name="nik" inputMode="numeric" maxLength={16} defaultValue={v.nik} autoComplete="off" />
          </Field>
          {mode === "baru" && (
            <>
              <Field label="Alergi" htmlFor="alergi" hint="Pisahkan dengan koma. Contoh: amoksisilin, udang">
                <Input id="alergi" name="alergi" defaultValue={v.alergi} autoComplete="off" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Riwayat penyakit" htmlFor="riwayat" hint="Pisahkan dengan koma. Contoh: darah tinggi, kencing manis">
                  <Input id="riwayat" name="riwayat" defaultValue={v.riwayat} autoComplete="off" />
                </Field>
              </div>
            </>
          )}
          <Field label="Kontak darurat: nama" htmlFor="kontak_nama">
            <Input id="kontak_nama" name="kontak_nama" defaultValue={v.kontak_nama} autoComplete="off" />
          </Field>
          <Field label="Hubungan" htmlFor="kontak_hubungan" hint="Contoh: anak, suami, ibu">
            <Input id="kontak_hubungan" name="kontak_hubungan" defaultValue={v.kontak_hubungan} autoComplete="off" />
          </Field>
          <Field label="No. HP kontak darurat" htmlFor="kontak_hp" error={e.kontak_hp}>
            <Input id="kontak_hp" name="kontak_hp" type="tel" inputMode="tel" defaultValue={v.kontak_hp} autoComplete="off" />
          </Field>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        {mode === "baru" ? (
          <>
            <TombolKirim value="daftar">Simpan dan daftarkan hari ini</TombolKirim>
            <TombolKirim value="simpan" variant="sekunder">Simpan saja</TombolKirim>
          </>
        ) : (
          <TombolKirim value="simpan">Simpan perubahan</TombolKirim>
        )}
        <Link href={batalHref} className="inline-flex min-h-[44px] items-center px-4 font-bold underline">
          Batal
        </Link>
      </div>
    </form>
  );
}
