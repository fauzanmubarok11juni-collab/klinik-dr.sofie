# Praktik dr.sop — Sistem Informasi Praktik Dokter Mandiri

Aplikasi web internal (rawat jalan) untuk 2 pengguna: **Dokter** dan **Asisten**.
Status: **Iterasi 5** (klinik anak: kurva WHO dan tumbuh kembang; klinik lansia: skrining geriatri dan rekonsiliasi obat).

Biaya: Rp0 (Supabase gratis + Vercel gratis).

---
## A. Persiapan sekali saja (±30 menit)

### 1. Pasang Node.js
1. Buka https://nodejs.org → unduh versi **LTS** → pasang (Next → Next → Finish).
2. Buka **Terminal** (Windows: cari "Command Prompt"; Mac: "Terminal"). Ketik `node -v` lalu Enter. Jika muncul angka versi (mis. v20.x), berhasil.

### 2. Buat database di Supabase (gratis)
1. Buka https://supabase.com → **Start your project** → daftar (boleh pakai Google/GitHub).
2. Klik **New project**. Isi nama `praktik-drsop`, buat *Database Password* (simpan!), pilih region **Southeast Asia (Singapore)**. Klik **Create**. Tunggu ±2 menit.
3. Menu kiri **SQL Editor** → **New query** → buka file `supabase/migrations/0001_auth_dan_sesi.sql` dengan Notepad → salin semua isinya → tempel → klik **Run**. Harus muncul "Success".
4. Menu kiri **Project Settings → API**. Catat dua nilai: **Project URL** dan **anon public key**.

### 3. Buat 2 akun
Menu kiri **Authentication → Users → Add user → Create new user**.
- Isi email + kata sandi, **centang "Auto Confirm User"**, klik Create.
- **URUTAN PENTING:** akun pertama otomatis menjadi **Dokter**, akun kedua otomatis **Asisten**. Akun ketiga akan ditolak oleh sistem (memang disengaja).
- Ganti nama tampilan: SQL Editor → jalankan (ubah email & nama):
```sql
update public.profiles set nama = 'dr. Sop'
where id = (select id from auth.users where email = 'EMAIL_DOKTER');
update public.profiles set nama = 'Nama Asisten'
where id = (select id from auth.users where email = 'EMAIL_ASISTEN');
```
- Disarankan: **Authentication → Sign In / Providers → Email**, matikan **"Allow new users to sign up"** agar tidak ada orang lain yang bisa mendaftar.

---
## B. Jalankan di komputer

1. Ekstrak folder proyek ini, mis. ke `Dokumen\praktik-drsop`.
2. Buka Terminal di folder itu (Windows: buka folder, klik kolom alamat, ketik `cmd`, Enter).
3. Salin file pengaturan:
   - Windows: `copy .env.example .env.local`
   - Mac/Linux: `cp .env.example .env.local`
4. Buka `.env.local` dengan Notepad, isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` dari langkah A.4. Simpan.
5. Ketik berurutan:
```
npm install
npm run dev
```
6. Buka browser: http://localhost:3000 → masuk dengan akun Dokter, lalu coba akun Asisten.

---
## C. Pasang online di Vercel (gratis)
1. Buat akun di https://github.com dan https://vercel.com (login Vercel pakai GitHub).
2. Unggah folder proyek ke repositori GitHub baru (privat) — mudah lewat **GitHub Desktop**.
3. Vercel → **Add New → Project** → pilih repositori → buka **Environment Variables** → isi 3 nilai dari `.env.example` → **Deploy**.
4. Hasilnya berupa alamat `https://nama-proyek.vercel.app`. Buka di laptop pendaftaran dan laptop dokter.
5. Supabase → **Authentication → URL Configuration** → isi **Site URL** dengan alamat Vercel tadi.

---
## D. Cara menguji (Iterasi 0)
| Uji | Hasil yang benar |
|---|---|
| Buka alamat tanpa login | Diarahkan ke halaman Masuk |
| Salah kata sandi | Pesan ramah, bukan kode error |
| Masuk sebagai Dokter | Menu: 9 item termasuk Rekam Medis, Laporan, Pengaturan |
| Masuk sebagai Asisten | Menu: 6 item (tanpa Rekam Medis, Laporan, Pengaturan) |
| Asisten mengetik `/pengaturan` di alamat | Dikembalikan ke Beranda dengan pesan |
| Tombol **Mode Besar** | Huruf & tombol membesar 1,5× |
| Tombol bulan/matahari | Tema gelap/terang |
| Asisten diam 15 menit | Keluar otomatis |
| Tombol **Tab** di keyboard | Fokus terlihat jelas; ada tautan "Lompat ke isi halaman" |
| Uji RLS (SQL Editor, lihat bawah) | Asisten hanya melihat profilnya sendiri |

Uji RLS (opsional): di SQL Editor jalankan
```sql
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email='EMAIL_ASISTEN'), true);
select * from public.profiles;   -- harus 1 baris saja
```

## E. Alternatif self-host murah (catatan)
Bila kelak ingin lepas dari layanan cloud: Laravel + MySQL di laptop/VPS/Raspberry Pi. Konsekuensi: perlu perawatan server & backup sendiri. Tidak disarankan sekarang karena stack ini sudah gratis dan lebih sedikit perawatan.


---
# Iterasi 1 — Pasien, Pendaftaran, Pasien Hari Ini

## Langkah pembaruan (dari Iterasi 0)
1. Supabase → **SQL Editor → New query** → salin seluruh isi `supabase/migrations/0002_pasien_dan_kunjungan.sql` → **Run**. Harus muncul "Success".
   (Jalankan SETELAH 0001. Aman dijalankan ulang.)
2. Ganti folder proyek lama dengan yang baru, **pertahankan file `.env.local` Anda**.
3. Terminal di folder proyek: `npm install` lalu `npm run dev`.

## Mengatur identitas (sementara lewat SQL; menu Pengaturan menyusul di Iterasi 4)
Dipakai pada kartu berobat. Ganti isi dalam tanda kutip, lalu Run di SQL Editor:
```sql
update public.settings set value = '"Jl. Contoh No. 1, Kota"' where key = 'alamat';
update public.settings set value = '"0812-3456-7890"'          where key = 'telepon';
update public.settings set value = '"DS"'                       where key = 'kode_rm';  -- awalan No. RM
```
Mengubah `kode_rm` hanya memengaruhi pasien BARU. No. RM lama tidak berubah.

## Cara menguji
| Uji | Hasil yang benar |
|---|---|
| Menu **Data Pasien** → **Pasien baru** → isi nama, tanggal lahir, jenis kelamin → **Simpan dan daftarkan hari ini** | Masuk ke "Pasien hari ini" dengan pesan hijau; No. RM tampak seperti `DS-2026-0001` |
| Ketik tanggal lahir | Umur muncul langsung di bawah kolom |
| Daftarkan pasien dengan nama + tanggal lahir yang sama lagi | Muncul peringatan kuning dengan tombol "Ya, daftarkan dia" / "Bukan, ini pasien baru" (tidak diblokir) |
| Menu **Data Pasien** → ketik sebagian nama, No. HP, NIK, atau No. RM | Hasil menyempit otomatis tanpa menekan tombol |
| Di **Pasien hari ini**: tekan "Mulai periksa", lalu "Selesai" | Status berubah; muncul tombol **Urungkan** selama 8 detik |
| Tekan "Batalkan" | Ada kotak konfirmasi; setelah dikonfirmasi status Batal (data tidak terhapus) |
| Buka aplikasi di 2 komputer/tab: daftarkan pasien di satu, lihat di yang lain | Muncul sendiri dalam beberapa detik |
| Filter **Pagi / Malam / Semua sesi** dan **Menunggu / Diperiksa / Selesai** | Daftar dan angka dalam kurung menyesuaikan |
| Halaman pasien → **Cetak kartu berobat** → Cetak | Kartu 85,6 × 54 mm, hitam-putih, tanpa QR |
| Masuk sebagai **Asisten**, buka halaman pasien | Alergi/riwayat bisa **ditambah**, tetapi tombol hapus (X) tidak muncul |
| Mode Besar / tema gelap saat mencetak kartu | Hasil cetak tetap normal dan terang |

### Uji keamanan (RLS) di SQL Editor
Asisten tidak boleh menghapus pasien maupun membaca audit:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'EMAIL_ASISTEN'), true);
select count(*) from public.audit_logs;                      -- harus 0
delete from public.patients where true;                      -- harus "DELETE 0"
rollback;
```
Dokter dapat melihat jejak perubahan: `select waktu, tabel, aksi from public.audit_logs order by waktu desc limit 20;`


---
# Iterasi 2 — Rekam Medis (SOAP), Vital, Diagnosis, Tindakan

## Langkah pembaruan (dari Iterasi 1)
1. Supabase → **SQL Editor → New query** → salin seluruh isi `supabase/migrations/0003_rekam_medis.sql` → **Run**. (File ±23 KB; salin semuanya.) Harus muncul "Success". Aman dijalankan ulang.
2. Ganti folder proyek (pertahankan `.env.local`), lalu `npm install` dan `npm run dev`.

## Sesuaikan tarif tindakan (WAJIB)
Tarif bawaan hanyalah **contoh**. Ubah lewat SQL Editor sampai menu Pengaturan tersedia (Iterasi 4):
```sql
select nama, tarif from public.services order by urutan;                       -- lihat daftar
update public.services set tarif = 30000 where nama = 'Injeksi intramuskular (IM)';
update public.services set aktif = false where nama = 'Pemasangan kateter urin'; -- sembunyikan tindakan
```
Tarif yang sudah tercatat pada kunjungan lama TIDAK berubah (disalin saat dipilih).

## Cara menguji
| Uji | Hasil yang benar |
|---|---|
| Masuk sebagai **Dokter** → **Pasien Hari Ini** → **Mulai periksa** pada satu pasien | Layar pemeriksaan terbuka; status pasien menjadi *Diperiksa*; kolom Subjective sudah berisi keluhan dari pendaftaran + template |
| Ketik di kolom apa pun, tunggu ±5 detik | Bilah bawah: "Ada perubahan…" lalu "Tersimpan pukul …" |
| Tab **Objective**: isi BB 70 dan TB 170 | IMT muncul otomatis (24,2 – Normal) |
| Isi suhu 38,2 / TD 150/95 | Tanda "Demam" / "Tinggi" muncul (hanya petunjuk) |
| Isi suhu 380 | Pesan "tampaknya salah", dan angka itu tidak ikut tersimpan |
| Tab **Assessment**: ketik `hiper` lalu Enter | Diagnosis dipilih dengan keyboard; yang pertama otomatis "Utama" |
| Kotak diagnosis dikosongkan lalu diklik | Muncul daftar "Sering dipakai" |
| Tab **Plan**: centang tindakan | Total tindakan terhitung |
| Ketik sesuatu, **tutup tab seketika**, buka lagi pasien yang sama | Isian pulih (pesan kuning "sudah dipulihkan") |
| Matikan internet, ketik, lihat bilah bawah | "Belum tersimpan… draf aman"; nyalakan internet → tersimpan sendiri |
| **Simpan dan selesai** tanpa diagnosis | Kotak konfirmasi "Belum ada diagnosis" |
| **Simpan dan selesai** dengan diagnosis | Kembali ke daftar, status *Selesai* |
| Tombol **Mode Malam** lalu **Template → Terapkan template bawaan** | Isi SOAP berganti menjadi template konsultatif |
| **Template → Simpan isi SOAP ini sebagai template saya** | Pasien berikutnya (kategori & mode sama) otomatis memakai template Anda |
| Masuk sebagai **Asisten**, ketik alamat `/rekam-medis` | Dikembalikan ke Beranda |

### Uji keamanan (RLS): Asisten tidak boleh membuka isi SOAP
Jalankan di SQL Editor (ganti EMAIL_ASISTEN). Semua hasil harus seperti komentar:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'EMAIL_ASISTEN'), true);

select count(*) from public.soap_notes;            -- harus 0 (padahal ada datanya)
select count(*) from public.vitals;                -- harus 0
select count(*) from public.encounter_diagnoses;   -- harus 0
select count(*) from public.encounter_services;    -- boleh >0 (dibutuhkan kasir)
update public.services set tarif = 1;              -- harus "UPDATE 0" (Asisten tidak bisa mengubah tarif)
select public.simpan_rekam_medis((select id from public.encounters limit 1), '{}'::jsonb, false);
                                                   -- harus ERROR: Hanya Dokter yang boleh mengisi rekam medis.
rollback;
```
Jejak perubahan SOAP *setelah selesai* (hanya Dokter yang bisa melihat):
`select waktu, aksi from public.audit_logs where tabel = 'soap_notes' order by waktu desc limit 20;`


---
# Iterasi 3 — Resep, Penjualan Obat di Klinik, Stok, Peringatan Obat

## Langkah pembaruan (dari Iterasi 2)
1. Supabase → **SQL Editor → New query** → salin seluruh isi `supabase/migrations/0004_obat_resep.sql` (±45 KB; salin semuanya) → **Run**. Harus muncul "Success". Aman dijalankan ulang.
2. Ganti folder proyek (pertahankan `.env.local`), lalu `npm install` dan `npm run dev`.
3. Isi **nama dokter** (untuk cetak resep), memakai SQL Editor:
```sql
update public.settings set value = '"dr. Nama Lengkap, Sp.X"' where key = 'nama_dokter';
update public.settings set value = '"Nomor SIP Anda"'         where key = 'sip_dokter';
```

## Sesuaikan harga dan stok (WAJIB)
Harga dan stok awal pada 20 obat yang dijual hanyalah **contoh**. Cara yang benar:
- Harga, stok minimum, atau tanggal kedaluwarsa: menu **Obat & Resep → Daftar obat → Ubah** (Dokter).
- Stok: menu **Obat & Resep → Stok obat** (Dokter dan Asisten). Untuk menyamakan stok contoh dengan stok sebenarnya, pakai "Kurangi stok" atau "Stok masuk" dengan catatan "penyesuaian awal".

## Tentang data peringatan obat (PENTING)
Interaksi (128 pasangan), batas dosis (16 obat), dan daftar obat berisiko lansia (12 baris) adalah **panduan ringkas yang disusun dari pengetahuan farmakologi umum**, bukan dari basis data resmi. Mohon dokter **memeriksa dan menyesuaikannya**. Data dapat dilihat dan diubah di tabel `drug_interactions`, `drug_dose_rules`, dan `drug_geriatric_alerts` (SQL Editor). Peringatan hanya mengingatkan dan tidak pernah memblokir.

## Cara menguji
| Uji | Hasil yang benar |
|---|---|
| Dokter: **Mulai periksa** → tab **Obat** → ketik `amoks` → Enter | Obat masuk ke resep dengan "1 kapsul, 3× sehari setelah makan, selama 3 hari", jumlah otomatis 9 |
| Ubah lama menjadi 5 hari | Jumlah berubah otomatis menjadi 15 |
| Pasien anak: isi BB 10 kg di tab Objective, resep Paracetamol 500 mg tablet, 2 tablet 4× sehari | Peringatan kuning dosis melebihi batas anak (mg/kg/hari) |
| Pasien dengan alergi "penisilin" → tambah Amoksisilin | Banner **merah** alergi |
| Resep Warfarin + Ibuprofen | Peringatan interaksi berat |
| Pasien ≥60 tahun → tambah Diazepam atau CTM | Peringatan lansia (kriteria Beers ringkas) |
| Pasien kontrol: tombol **Salin resep kunjungan terakhir** | Resep terisi dari kunjungan sebelumnya |
| Tab Obat → bagian penjualan → tambah Paracetamol 500 mg, jumlah 10 | Total harga terhitung; di **Stok obat** stok berkurang 10 dan ada baris "Keluar: Penjualan" |
| Ubah jumlah menjadi 4 | Stok bertambah kembali 6 (tercatat di riwayat) |
| Jual lebih banyak dari stok | Pesan merah "Stok tidak cukup", data tidak berubah |
| Asisten: **Obat & Resep → Catat penjualan obat** pada pasien hari ini | Bisa menambah/mengubah penjualan; tidak ada tombol Daftar obat |
| **Cetak resep** dan **Cetak label obat** | Resep standar dengan alergi pasien; label per obat (nama pasien, obat, aturan bahasa awam, tanggal, kedaluwarsa) |
| **Stok obat**: tambah stok masuk dengan tanggal kedaluwarsa | Stok bertambah; banner peringatan muncul bila di bawah minimum atau kedaluwarsa <30 hari |
| Ketik di tab Obat, tutup tab seketika, buka lagi | Isian resep pulih (sama seperti SOAP) |

### Uji keamanan (RLS) untuk Iterasi 3
Jalankan di SQL Editor (ganti EMAIL_ASISTEN). Hasil harus seperti komentar:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'EMAIL_ASISTEN'), true);

select count(*) from public.medicines;                 -- boleh >0 (Asisten perlu melihat harga)
update public.medicines set harga_jual = 1;            -- harus "UPDATE 0" (Asisten tidak bisa mengubah harga)
delete from public.medicine_sales;                     -- harus "DELETE 0"
select public.simpan_resep((select id from public.encounters limit 1), '{}'::jsonb);
                                                       -- harus ERROR: Hanya Dokter yang boleh menulis resep.
insert into public.medicine_stock_movements (medicine_id, tipe, jumlah)
  select id, 'masuk', 5 from public.medicines limit 1; -- harus ERROR: permission denied
rollback;
```
Jejak penjualan dan resep: `select waktu, tabel, aksi from public.audit_logs where tabel in ('medicine_sales','prescriptions') order by waktu desc limit 20;`


---
# Iterasi 4 — Kasir, Jadwal Kontrol, Laporan, Dashboard, Pengaturan

## Langkah pembaruan (dari Iterasi 3)
1. Supabase → **SQL Editor → New query** → salin seluruh isi `supabase/migrations/0005_kasir_kontrol_laporan.sql` (±27 KB) → **Run**. Harus muncul "Success". Aman dijalankan ulang.
2. Ganti folder proyek (pertahankan `.env.local`), lalu `npm install` dan `npm run dev`.
3. Buka **Pengaturan** (Dokter) dan isi: Identitas praktik, **Tarif konsultasi dan kontrol** (nilai bawaan hanya contoh: Rp50.000 dan Rp30.000), dan periksa tarif tindakan.

## Opsional: kelola akun Asisten dari dalam aplikasi
Tanpa langkah ini, akun tetap dibuat dan di-reset lewat dasbor Supabase (Authentication → Users). Bila ingin lewat aplikasi:
1. Supabase → Project Settings → API → salin kunci **service_role** (RAHASIA).
2. Di `.env.local` (dan di Vercel → Environment Variables) tambahkan `SUPABASE_SERVICE_ROLE_KEY=...` (tanpa awalan NEXT_PUBLIC_).
3. Jalankan ulang aplikasi. Di Pengaturan → Pengguna akan muncul tombol ganti kata sandi dan buat akun Asisten.
Kunci ini hanya dipakai di server dan hanya setelah memastikan pengguna adalah Dokter. Jangan pernah membagikannya.

## Cara kerja singkat
- **Kasir:** buka pasien dari menu Kasir → tagihan terbentuk otomatis (jasa konsultasi + tindakan + obat yang dijual). Pilih jasa (Konsultasi / Kontrol / Tanpa biaya), pilih metode bayar, tekan terima pembayaran, lalu cetak kuitansi.
- **Setelah lunas** tindakan dan penjualan obat terkunci. Untuk mengubah, Dokter membatalkan tagihan (void, wajib alasan), lalu tagihan baru dibuat.
- **Jadwal kontrol:** dibuat dari halaman pasien, Kasir, atau tab Plan. Di menu Jadwal Kontrol tekan **Salin pesan pengingat**, lalu tempel ke WhatsApp. Jadwal otomatis menjadi *Sudah datang* saat pasien didaftarkan dalam rentang ±7 hari.
- **Laporan (Dokter):** kunjungan, pendapatan, diagnosis, obat terjual, pasien kontrol. Ekspor CSV memakai pemisah titik koma (langsung rapi di Excel berbahasa Indonesia). Untuk PDF, tekan "Cetak / simpan PDF" lalu pilih Simpan sebagai PDF.

## Cara menguji
| Uji | Hasil yang benar |
|---|---|
| Menu **Kasir** → pasien yang sudah diperiksa → **Buka tagihan** | Rincian: jasa konsultasi + tindakan + obat; total benar |
| Tekan **Kontrol** pada pilihan jasa | Tarif jasa berubah ke tarif kontrol |
| Metode **Tunai**, ketik uang diterima lebih besar dari total | Kembalian tampil; setelah dibayar status **Lunas** dan muncul **Cetak kuitansi** |
| Coba ubah penjualan obat pasien yang sudah lunas | Ditolak: "Tagihan kunjungan ini sudah lunas…" |
| Dokter: **Batalkan tagihan** tanpa alasan | Ditolak; dengan alasan, status **Dibatalkan** dan kuitansi bertanda DIBATALKAN |
| Asisten membuka tagihan lunas | Tidak ada tombol batalkan; ada catatan "hubungi Dokter" |
| Buka tagihan di dua tab, ubah penjualan di tab lain, lalu bayar di tab pertama | Pembayaran ditolak: "Tagihan berubah sejak dibuka…" |
| Kasir → **Riwayat transaksi** | Daftar tagihan + total yang diterima |
| Dari Kasir: **Atur jadwal kontrol** → pilih "2 minggu" | Tanggal terisi (Minggu otomatis dilewati); jadwal muncul di Jadwal Kontrol |
| Jadwal Kontrol → **Salin pesan pengingat** → tempel di WhatsApp | Pesan lengkap (sapaan sesuai jam, tanggal, sesi, alamat); status berubah **Sudah diingatkan** |
| Daftarkan pasien yang punya jadwal kontrol | Jadwal otomatis hilang dari daftar (status Sudah datang); tagihan pasien itu menawarkan jasa Kontrol |
| Dokter: **Dashboard** | Hari ini dan bulan ini terpisah per sesi (Pagi/Malam), pendapatan, pasien baru vs lama, 10 diagnosis, kontrol, stok kritis |
| Dokter: **Laporan** → Pendapatan → **Ekspor CSV** | File CSV terbuka rapi di Excel |
| Dokter: **Pengaturan** → ganti tarif tindakan | Tagihan baru memakai tarif baru; tagihan lama tidak berubah |
| Asisten membuka `/laporan` atau `/pengaturan` | Dikembalikan ke Beranda |

### Uji keamanan (RLS) untuk Iterasi 4
Jalankan di SQL Editor (ganti EMAIL_ASISTEN). Hasil harus seperti komentar:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'EMAIL_ASISTEN'), true);

select count(*) from public.invoices;                     -- boleh >0 (kasir perlu melihat tagihan)
select * from public.ringkasan_dashboard(current_date);   -- harus ERROR: Hanya Dokter.
select * from public.laporan_pendapatan(current_date - 30, current_date);  -- harus ERROR: Hanya Dokter.
select public.void_tagihan((select id from public.invoices limit 1), 'uji');
                                                          -- harus ERROR: Hanya Dokter yang boleh membatalkan tagihan.
update public.invoices set total = 0;                     -- harus ERROR: permission denied (tagihan hanya lewat fungsi)
update public.settings set value = '1' where key = 'tarif_konsultasi';  -- harus "UPDATE 0"
rollback;
```
Jejak tagihan, pembayaran, dan void: `select waktu, tabel, aksi from public.audit_logs where tabel in ('invoices','payments') order by waktu desc limit 30;`

## Catatan penting
- **Backup belum ada.** Paket gratis Supabase tidak menyimpan cadangan harian. Backup mingguan dan uji restore dikerjakan di Iterasi 6. Sampai saat itu, ekspor CSV dari menu Laporan secara berkala.
- Pendapatan dihitung menurut **tanggal kunjungan** dan hanya tagihan **lunas**.
- Laporan pendapatan dan kontrol dibatasi 3 bulan per tampilan (batas jumlah baris layanan gratis); laporan lain 1 tahun.


---
# Iterasi 5 — Klinik Anak dan Klinik Lansia

## Langkah pembaruan (dari Iterasi 4)
1. Supabase → **SQL Editor → New query** → salin seluruh isi `supabase/migrations/0006_klinik_anak_lansia.sql` (±16 KB) → **Run**. Harus muncul "Success". Aman dijalankan ulang.
2. Ganti folder proyek (pertahankan `.env.local`), lalu `npm install` dan `npm run dev`.
3. **Impor tabel WHO** (wajib agar Z-score dan kurva muncul). Langkahnya di bawah.

## WAJIB: impor tabel standar WHO (sekali saja, ±20 menit)
Aplikasi menghitung Z-score dengan rumus resmi WHO (metode LMS), tetapi **tabel angka L, M, S tidak disertakan** karena harus berasal dari sumber resmi WHO dan saya tidak mau memasukkan angka dari ingatan. Anda cukup mengunduhnya sekali:

1. Buka situs WHO (who.int) dan cari **"WHO Child Growth Standards"** (usia 0–5 tahun) serta **"Growth reference data for 5–19 years"**.
2. Untuk setiap indikator di bawah, unduh tabel **Z-score per BULAN** (kolom `Month`, atau `Length`/`Height` dalam cm) untuk **laki-laki** dan **perempuan**. Jangan pakai tabel "per hari" (Day), karena akan ditolak.
3. Buka berkas di Excel, **blok kolom dari `Month` (atau `Length`/`Height`) sampai `S`** (kolom L, M, S ikut), salin (Ctrl+C).
4. Di aplikasi: **Pengaturan → Data WHO** → pilih indikator dan jenis kelamin → tempel (Ctrl+V) → **Impor tabel**. (Alternatif: simpan sebagai CSV lalu pilih berkas.)

| Indikator di aplikasi | Tabel WHO yang diimpor (masing-masing laki-laki dan perempuan) |
|---|---|
| Berat badan menurut umur | 0–5 tahun, lalu 5–10 tahun |
| Panjang/tinggi badan menurut umur | 0–5 tahun, lalu 5–19 tahun |
| Berat menurut panjang badan (BB/PB) | 0–2 tahun |
| Berat menurut tinggi badan (BB/TB) | 2–5 tahun |
| IMT menurut umur | 0–5 tahun, lalu 5–19 tahun |
| Lingkar kepala menurut umur | 0–5 tahun |

Total 12 kombinasi (indikator × jenis kelamin), sebagian dua kali impor. Tabel status di halaman Data WHO menunjukkan mana yang sudah **Lengkap**. Aplikasi menolak tabel yang salah indikator (mis. tabel umur dipasang pada BB/PB) dan memberi peringatan bila nilainya janggal.

**Uji wajib setelah impor:** masukkan satu anak contoh, lalu bandingkan Z-score BB/U, TB/U, dan BB/TB dengan kalkulator resmi WHO (WHO Anthro). Selisih sangat kecil (sekitar 0,1 SD) wajar karena aplikasi menginterpolasi antar bulan, sedangkan kalkulator harian WHO memakai hari. Bila selisihnya besar, periksa kembali tabel yang diimpor.

## Cara kerja singkat
- **Klinik Anak** (menu, atau tombol di halaman pasien dan layar pemeriksaan): catat berat, panjang/tinggi, dan lingkar kepala. Berat dan tinggi diisi otomatis dari tanda vital kunjungan hari ini. Z-score, kategori (Permenkes No. 2 Tahun 2020), dan grafik muncul langsung. Tab **Tumbuh kembang** berisi skrining per usia; tab **Cetak ringkasan orang tua** menghasilkan lembar cetak.
- **Klinik Lansia**: lima skrining (Morse, Barthel, MNA-SF, Mini-Cog, GDS-15) dengan skor otomatis dan tren antar kunjungan; **Rekonsiliasi obat** menggabungkan obat aktif klinik dan obat luar; **Ringkasan geriatri** satu layar yang bisa dicetak.
- Peringatan **polifarmasi** (lebih dari 5 obat aktif) muncul di Ringkasan geriatri, Rekonsiliasi obat, dan saat menulis resep untuk pasien ≥60 tahun.

## Cara menguji
| Uji | Hasil yang benar |
|---|---|
| Pengaturan → Data WHO | Tabel status menunjukkan indikator yang sudah **Lengkap** |
| Impor tabel per hari, atau tabel umur pada indikator BB/PB | Ditolak dengan pesan yang jelas |
| Klinik Anak → anak 1 tahun → catat BB dan TB | Kartu Z-score muncul dengan kategori berwarna **dan** teks; grafik BB/U terisi |
| Ubah ke tab **PB/U**, **BB/PB**, **IMT/U**, **LK/U** | Grafik berganti; titik anak tampak pada kurva |
| Isi BB tidak masuk akal (mis. 90 kg pada bayi) | Peringatan "Nilai tidak wajar. Periksa kembali pengukuran." |
| Anak <24 bulan diukur "berdiri" | Panjang dikoreksi +0,7 cm otomatis |
| Tab **Tumbuh kembang** → isi butir | Hasil sementara berubah (Sesuai / Meragukan / Perlu rujukan); tersimpan di riwayat |
| **Cetak ringkasan orang tua** | Lembar A4: hasil, 2 grafik, pesan dokter, obat dengan aturan bahasa awam, jadwal kontrol |
| Klinik Lansia → **Isi skrining** (mis. Morse) | Skor dan tafsir berubah saat memilih; tersimpan; tren tampil di Ringkasan geriatri |
| MNA-SF pada pasien yang BB dan TB-nya sudah tercatat | Pilihan IMT terisi otomatis |
| Rekonsiliasi obat → tambah obat luar (pilih dari daftar) | Interaksi dengan obat klinik terdeteksi; obat yang diketik manual ditandai "tidak ikut pemeriksaan" |
| Pasien ≥60 tahun dengan >5 obat aktif | Banner polifarmasi |
| Asisten membuka `/anak` atau `/lansia` | Dikembalikan ke Beranda |

### Uji keamanan (RLS) untuk Iterasi 5
Semua data klinik anak dan lansia hanya untuk Dokter. Jalankan di SQL Editor (ganti EMAIL_ASISTEN); semua hasil harus seperti komentar:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'EMAIL_ASISTEN'), true);
select count(*) from public.growth_records;            -- harus 0
select count(*) from public.geriatric_screenings;      -- harus 0
select count(*) from public.developmental_screenings;  -- harus 0
select count(*) from public.patient_external_meds;     -- harus 0
select count(*) from public.who_lms;                   -- harus 0
insert into public.growth_records (patient_id, tanggal, umur_bulan, bb)
  select id, current_date, 12, 9 from public.patients limit 1;   -- harus ERROR: violates row-level security policy
rollback;
```

## Catatan penting
- **Butir skrining tumbuh kembang** (102 butir, 12 kelompok usia, 3 ranah) disusun dari tonggak perkembangan umum dalam bahasa awam, **bukan KPSP** dan bukan Denver II. Silakan tinjau; dapat diganti atau ditambah lewat tabel `developmental_milestones`.
- **Tabel interaksi, Beers, dan batas dosis** sama seperti Iterasi 3 (panduan ringkas, mohon ditinjau Dokter).
- Skrining geriatri adalah alat bantu, bukan diagnosis. GDS-15 menampilkan pengingat untuk menanyakan pikiran menyakiti diri pada skor sedang/berat.
- Grafik dibuat dengan SVG bawaan (tanpa pustaka tambahan) agar ringan dan tercetak rapi.
- **Backup belum ada** (Iterasi 6). Ekspor CSV dari menu Laporan secara berkala.
