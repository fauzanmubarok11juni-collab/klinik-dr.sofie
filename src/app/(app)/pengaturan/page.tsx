import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ambilInfoKlinik } from "@/lib/klinik";
import { adminTersedia } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/page-header";
import { Banner, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { buatAsisten, resetKataSandi, setAktifPengguna, ubahNamaPengguna } from "./actions";
import { simpanIdentitas, simpanTarifKonsultasi } from "./actions";
import { FormPengaturan } from "./form-pengaturan";
import { FormPesan } from "./form-pesan";
import { FormSandi } from "./form-sandi";
import { FormSesi, type SesiAwal } from "./form-sesi";
import { FormTindakan, type Tindakan } from "./form-tindakan";
import { FormWHO } from "./form-who";
import { ringkasanWHO } from "@/lib/anak-server";
import { HARAPAN } from "@/lib/who-impor";
import { URUT_INDIKATOR } from "@/lib/who";

const BAGIAN = [
  { k: "identitas", l: "Identitas praktik" }, { k: "tarif", l: "Tarif" }, { k: "sesi", l: "Sesi praktik" },
  { k: "pesan", l: "Pesan pengingat" }, { k: "who", l: "Data WHO" }, { k: "pengguna", l: "Pengguna" }, { k: "backup", l: "Backup" },
] as const;
type Kunci = (typeof BAGIAN)[number]["k"];

type Profil = { id: string; nama: string; role: "dokter" | "asisten"; aktif: boolean; email: string | null };

export default async function Pengaturan({ searchParams }: { searchParams: { bagian?: string; ok?: string; galat?: string } }) {
  const dokter = await wajibRole("dokter");
  const bagian = (BAGIAN.find((b) => b.k === searchParams.bagian)?.k ?? "identitas") as Kunci;
  const supabase = createClient();
  const klinik = await ambilInfoKlinik();

  return (
    <>
      <PageHeader judul="Pengaturan" deskripsi="Hanya Dokter yang dapat membuka halaman ini." />
      <nav aria-label="Bagian pengaturan" className="mb-6 flex flex-wrap gap-2">
        {BAGIAN.map((b) => (
          <Link key={b.k} href={`/pengaturan?bagian=${b.k}`} aria-current={bagian === b.k ? "page" : undefined}
            className={cn("flex min-h-[44px] items-center rounded-lg border-2 px-4 font-bold", bagian === b.k ? "border-utama bg-utama text-utama-teks" : "border-garis bg-permukaan hover:border-utama")}>
            {b.l}
          </Link>
        ))}
      </nav>

      {bagian === "identitas" && (
        <>
          <p className="mb-4 max-w-2xl text-redup">Dipakai pada kartu berobat, resep, kuitansi, dan pesan pengingat. Kode RM hanya memengaruhi pasien baru; No. RM lama tidak berubah.</p>
          <FormPengaturan aksi={simpanIdentitas}
            awal={{ nama_praktik: klinik.nama, alamat: klinik.alamat, telepon: klinik.telepon, sip_dokter: klinik.sip, nama_dokter: klinik.dokter, kode_rm: klinik.kodeRm }}
            bidang={[
              { nama: "nama_praktik", label: "Nama praktik" },
              { nama: "nama_dokter", label: "Nama dokter (untuk resep)", hint: "Contoh: dr. Nama Lengkap, Sp.PD" },
              { nama: "sip_dokter", label: "Nomor SIP" },
              { nama: "alamat", label: "Alamat" },
              { nama: "telepon", label: "Telepon / WhatsApp praktik" },
              { nama: "kode_rm", label: "Kode No. RM", hint: "1–6 huruf atau angka. Contoh: DS → DS-2026-0001" },
            ]} />
        </>
      )}

      {bagian === "tarif" && <BagianTarif klinik={klinik} />}
      {bagian === "sesi" && await BagianSesi()}
      {bagian === "pesan" && <FormPesan awal={klinik.templatPengingat} klinik={{ nama: klinik.nama, alamat: klinik.alamat, telepon: klinik.telepon }} />}

      {bagian === "who" && await BagianWHO()}

      {bagian === "pengguna" && (
        <>
          {searchParams.ok && <div className="mb-4"><Banner>{searchParams.ok}</Banner></div>}
          {searchParams.galat && <div className="mb-4"><Banner jenis="bahaya">{searchParams.galat}</Banner></div>}
          <BagianPengguna dokterId={dokter.id} />
        </>
      )}

      {bagian === "backup" && (
        <Card className="max-w-2xl">
          <h2 className="text-lg font-bold">Backup dan restore</h2>
          <p className="mt-2">Dibuat di <b>Iterasi 6</b> (backup mingguan pada hari Minggu, panduan restore, dan uji restore).</p>
          <Banner jenis="peringatan"><p className="mt-0">Sampai saat itu, <b>data belum punya backup otomatis</b>. Paket gratis Supabase tidak menyimpan cadangan harian. Sementara, ekspor CSV dari menu Laporan secara berkala, dan jangan hapus proyek Supabase.</p></Banner>
        </Card>
      )}
    </>
  );

  async function BagianWHO() {
    const ring = await ringkasanWHO(supabase);
    const status = (ind: (typeof URUT_INDIKATOR)[number], sex: string) => {
      const r = ring.find((x) => x.indikator === ind && x.sex === sex);
      const h = HARAPAN[ind];
      if (!r) return { teks: "Belum diimpor", ok: false, rentang: "—", jumlah: 0 };
      const lengkap = r.min_kunci <= h.min + 0.5 && r.max_kunci >= h.max - 0.5;
      return { teks: lengkap ? "Lengkap" : "Sebagian (impor tabel lainnya)", ok: lengkap, rentang: `${r.min_kunci}–${r.max_kunci}`, jumlah: r.jumlah };
    };
    return (
      <div className="space-y-8">
        <div className="max-w-3xl space-y-2">
          <p>Kurva pertumbuhan dan Z-score anak memakai tabel resmi WHO (nilai L, M, S). Tabel ini <b>tidak disertakan</b> di aplikasi; impor sekali dari file WHO milik Anda (langkah rinci ada di README bagian Iterasi 5).</p>
          <Banner jenis="peringatan">Setelah impor, uji satu anak contoh dengan kalkulator resmi WHO (WHO Anthro) dan bandingkan Z-score-nya sebelum dipakai untuk pasien.</Banner>
        </div>
        <div className="overflow-x-auto rounded-xl border-2 border-garis bg-permukaan">
          <table className="w-full text-left">
            <caption className="sr-only">Status tabel WHO yang sudah diimpor</caption>
            <thead><tr>{["Indikator", "Laki-laki", "Perempuan"].map((h) => <th key={h} scope="col" className="border-b-2 border-garis px-3 py-2 font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {URUT_INDIKATOR.map((i) => (
                <tr key={i}>
                  <th scope="row" className="border-b border-garis px-3 py-2 font-bold">{HARAPAN[i].label}</th>
                  {["L", "P"].map((sx) => { const st = status(i, sx); return (
                    <td key={sx} className="border-b border-garis px-3 py-2"><span className={st.ok ? "font-bold text-berhasil" : "font-bold text-peringatan"}>{st.teks}</span><br /><span className="text-sm text-redup">{st.jumlah ? `${st.jumlah} baris, rentang ${st.rentang}` : ""}</span></td>
                  ); })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormWHO />
      </div>
    );
  }

  async function BagianSesi() {
    const { data } = await supabase.from("practice_sessions").select("kode, nama, jam_mulai, jam_selesai, aktif").order("jam_mulai");
    const sesi: SesiAwal[] = ((data ?? []) as { kode: "pagi" | "malam"; nama: string; jam_mulai: string; jam_selesai: string; aktif: boolean }[])
      .map((s) => ({ kode: s.kode, nama: s.nama, mulai: s.jam_mulai.slice(0, 5), selesai: s.jam_selesai.slice(0, 5), aktif: s.aktif }));
    return <FormSesi sesi={sesi} />;
  }

  async function BagianTarif({ klinik }: { klinik: Awaited<ReturnType<typeof ambilInfoKlinik>> }) {
    const { data } = await supabase.from("services").select("id, nama, kategori, tarif, aktif").order("urutan");
    return (
      <div className="space-y-10">
        <section>
          <h2 className="mb-2 text-lg font-bold">Jasa konsultasi</h2>
          <p className="mb-4 max-w-2xl text-redup">Nilai bawaan hanyalah contoh. Kasir memilih antara Konsultasi, Kontrol, atau tanpa biaya, tetapi tidak dapat mengubah angkanya.</p>
          <FormPengaturan aksi={simpanTarifKonsultasi}
            awal={{ tarif_konsultasi: String(klinik.tarifKonsultasi), tarif_kontrol: String(klinik.tarifKontrol) }}
            bidang={[{ nama: "tarif_konsultasi", label: "Tarif konsultasi (Rp)", tipe: "angka" }, { nama: "tarif_kontrol", label: "Tarif kontrol (Rp)", tipe: "angka" }]} />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold">Tindakan dan pemeriksaan</h2>
          <FormTindakan daftar={(data ?? []) as Tindakan[]} />
        </section>
      </div>
    );
  }

  async function BagianPengguna({ dokterId }: { dokterId: string }) {
    const { data } = await supabase.from("profiles").select("id, nama, role, aktif, email").order("role");
    const daftar = (data ?? []) as Profil[];
    const asisten = daftar.find((p) => p.role === "asisten");
    const admin = adminTersedia();
    return (
      <div className="max-w-2xl space-y-6">
        <p className="text-redup">Sistem ini hanya untuk 2 akun: satu Dokter dan satu Asisten.</p>
        {daftar.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{p.nama} {p.id === dokterId ? <span className="text-sm font-normal text-redup">(Anda)</span> : null}</p>
                <p className="text-redup">{p.role === "dokter" ? "Dokter" : "Asisten"}{p.email ? `, ${p.email}` : ""}{p.aktif ? "" : ", dinonaktifkan"}</p>
              </div>
              {p.role === "asisten" && (
                <form action={setAktifPengguna.bind(null, p.id, !p.aktif)}>
                  <Button type="submit" variant={p.aktif ? "bahaya" : "utama"}>{p.aktif ? "Nonaktifkan akun" : "Aktifkan akun"}</Button>
                </form>
              )}
            </div>
            <form action={ubahNamaPengguna.bind(null, p.id)} className="mt-4 flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor={`nama-${p.id}`} className="mb-1 block text-sm font-bold">Nama tampilan</label>
                <Input id={`nama-${p.id}`} name="nama" defaultValue={p.nama} autoComplete="off" />
              </div>
              <Button type="submit" variant="sekunder">Simpan nama</Button>
            </form>
            {p.role === "asisten" && (
              <div className="mt-5 border-t-2 border-garis pt-4">
                <h3 className="mb-2 font-bold">Ganti kata sandi Asisten</h3>
                {admin ? <FormSandi mode="reset" aksi={resetKataSandi.bind(null, p.id)} /> : (
                  <p className="text-redup">Lewat dasbor Supabase: Authentication → Users → pilih pengguna → Send password recovery / Reset password. Atau aktifkan fitur ini dengan SUPABASE_SERVICE_ROLE_KEY (lihat README).</p>
                )}
              </div>
            )}
          </Card>
        ))}
        {!asisten && (
          <Card>
            <h2 className="mb-2 text-lg font-bold">Buat akun Asisten</h2>
            {admin ? <FormSandi mode="buat" aksi={buatAsisten} /> : (
              <p className="text-redup">Belum ada akun Asisten. Buat lewat dasbor Supabase: Authentication → Users → Add user (centang Auto Confirm), atau aktifkan fitur ini dengan SUPABASE_SERVICE_ROLE_KEY (lihat README).</p>
            )}
          </Card>
        )}
      </div>
    );
  }
}
