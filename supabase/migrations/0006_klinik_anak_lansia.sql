-- =====================================================================
-- Iterasi 5: klinik anak (pertumbuhan WHO, tumbuh kembang) dan klinik lansia (skrining geriatri, obat luar)
-- Jalankan SETELAH 0001-0005. Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Tabel standar WHO (nilai L, M, S) -- DIISI LEWAT Pengaturan > Data WHO ----------
-- indikator: wfa = berat/umur, hfa = panjang atau tinggi/umur, wfl = berat/panjang (0-2 th), wfh = berat/tinggi (2-5 th),
--            bmi = IMT/umur, hca = lingkar kepala/umur.   kunci: umur dalam BULAN, atau panjang/tinggi dalam CM.
create table if not exists public.who_lms (
  indikator text not null check (indikator in ('wfa','hfa','wfl','wfh','bmi','hca')),
  sex       text not null check (sex in ('L','P')),
  kunci     numeric(7,2) not null,
  l         numeric(10,5) not null,
  m         numeric(10,5) not null check (m > 0),
  s         numeric(10,6) not null check (s > 0),
  sumber    text,
  primary key (indikator, sex, kunci)
);

-- ---------- Pengukuran pertumbuhan anak (Z-score dihitung saat ditampilkan, tidak disimpan) ----------
create table if not exists public.growth_records (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients(id) on delete cascade,
  encounter_id    uuid references public.encounters(id) on delete set null,
  tanggal         date not null,
  umur_bulan      numeric(6,2) not null check (umur_bulan >= 0),
  bb              numeric(5,2) check (bb is null or bb between 0.3 and 250),
  tb              numeric(5,1) check (tb is null or tb between 20 and 250),      -- cm, sesuai yang diukur
  cara_ukur       text check (cara_ukur is null or cara_ukur in ('berbaring','berdiri')),
  lingkar_kepala  numeric(4,1) check (lingkar_kepala is null or lingkar_kepala between 15 and 80),
  pesan_orang_tua text,
  dibuat_oleh     uuid default auth.uid() references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (patient_id, tanggal),
  check (bb is not null or tb is not null or lingkar_kepala is not null)
);
create index if not exists growth_pasien_idx on public.growth_records (patient_id, tanggal);
drop trigger if exists growth_updated_at on public.growth_records;
create trigger growth_updated_at before update on public.growth_records
  for each row execute function public.set_updated_at();

-- ---------- Skrining tumbuh kembang ----------
create table if not exists public.developmental_milestones (
  checkpoint_bulan smallint not null,
  domain           text not null check (domain in ('motorik','bahasa','sosial')),
  urutan           smallint not null,
  pertanyaan       text not null,
  primary key (checkpoint_bulan, domain, urutan)
);

create table if not exists public.developmental_screenings (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  encounter_id     uuid references public.encounters(id) on delete set null,
  tanggal          date not null default (timezone('Asia/Jakarta', now()))::date,
  umur_bulan       numeric(6,2) not null,
  checkpoint_bulan smallint not null,
  jawaban          jsonb not null,                       -- {"motorik-1":"ya", ...}
  khawatir         boolean not null default false,       -- orang tua khawatir
  kemunduran       boolean not null default false,       -- kemampuan yang sudah dimiliki hilang
  hasil            text not null check (hasil in ('sesuai','meragukan','rujuk')),
  perlu_rujukan    boolean not null default false,
  catatan          text,
  dibuat_oleh      uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists dev_scr_pasien_idx on public.developmental_screenings (patient_id, tanggal desc);

-- ---------- Skrining geriatri ----------
create table if not exists public.geriatric_screenings (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  tanggal      date not null default (timezone('Asia/Jakarta', now()))::date,
  jenis        text not null check (jenis in ('morse','barthel','mna_sf','mini_cog','gds15')),
  skor         int not null,
  interpretasi text not null,
  jawaban      jsonb not null,
  catatan      text,
  dibuat_oleh  uuid default auth.uid() references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists geri_scr_idx on public.geriatric_screenings (patient_id, jenis, tanggal desc);

-- ---------- Obat dari luar klinik (untuk rekonsiliasi obat) ----------
create table if not exists public.patient_external_meds (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  medicine_id uuid references public.medicines(id),      -- kosong = ditulis manual (tidak ikut pemeriksaan interaksi)
  nama        text not null check (length(trim(nama)) > 0),
  aturan      text,
  sumber      text,                                      -- mis. "RS X", "apotek", "dibeli sendiri"
  aktif       boolean not null default true,
  dibuat_oleh uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ext_meds_pasien_idx on public.patient_external_meds (patient_id, aktif);
drop trigger if exists ext_meds_updated_at on public.patient_external_meds;
create trigger ext_meds_updated_at before update on public.patient_external_meds
  for each row execute function public.set_updated_at();

-- ---------- Audit ----------
drop trigger if exists growth_audit on public.growth_records;
create trigger growth_audit after insert or update or delete on public.growth_records
  for each row execute function public.catat_audit();
drop trigger if exists dev_scr_audit on public.developmental_screenings;
create trigger dev_scr_audit after insert or update or delete on public.developmental_screenings
  for each row execute function public.catat_audit();
drop trigger if exists geri_scr_audit on public.geriatric_screenings;
create trigger geri_scr_audit after insert or update or delete on public.geriatric_screenings
  for each row execute function public.catat_audit();

-- ---------- Row Level Security: seluruhnya khusus Dokter (data klinis) ----------
alter table public.who_lms                  enable row level security;
alter table public.growth_records           enable row level security;
alter table public.developmental_milestones enable row level security;
alter table public.developmental_screenings enable row level security;
alter table public.geriatric_screenings     enable row level security;
alter table public.patient_external_meds    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['who_lms','growth_records','developmental_milestones','developmental_screenings','geriatric_screenings','patient_external_meds'] loop
    execute format('drop policy if exists %I on public.%I', t || '_dokter', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dokter()) with check (public.is_dokter())', t || '_dokter', t);
  end loop;
end $$;
revoke all on public.who_lms, public.growth_records, public.developmental_milestones,
              public.developmental_screenings, public.geriatric_screenings, public.patient_external_meds from anon;

-- ---------- Ringkasan isi tabel WHO (untuk Pengaturan > Data WHO) ----------
create or replace function public.who_lms_ringkasan()
returns table (indikator text, sex text, jumlah int, min_kunci numeric, max_kunci numeric)
language plpgsql stable set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;
  return query
  select w.indikator, w.sex, count(*)::int, min(w.kunci), max(w.kunci)
  from public.who_lms w group by w.indikator, w.sex order by w.indikator, w.sex;
end $$;
revoke all on function public.who_lms_ringkasan() from public, anon;
grant execute on function public.who_lms_ringkasan() to authenticated;

-- ---------- Data awal: butir skrining tumbuh kembang ----------
-- Butir ini ringkasan tonggak perkembangan umum (bukan KPSP). Dokter dapat mengganti/menambah lewat SQL Editor.
insert into public.developmental_milestones (checkpoint_bulan, domain, urutan, pertanyaan) values
  (2, 'motorik', 1, 'Saat tengkurap, bayi dapat mengangkat kepalanya.'),
  (2, 'motorik', 2, 'Kedua tangan dan kedua kakinya aktif bergerak.'),
  (2, 'motorik', 3, 'Tangannya kadang terbuka (tidak selalu menggenggam).'),
  (2, 'bahasa', 1, 'Bayi mengeluarkan suara selain menangis (mis. mengoceh pelan).'),
  (2, 'bahasa', 2, 'Bayi terkejut atau bereaksi terhadap suara keras.'),
  (2, 'sosial', 1, 'Bayi menatap wajah Anda.'),
  (2, 'sosial', 2, 'Bayi tersenyum ketika diajak bicara atau tersenyum.'),
  (2, 'sosial', 3, 'Bayi tenang ketika diajak bicara atau digendong.'),
  (4, 'motorik', 1, 'Kepala dapat ditegakkan dengan mantap ketika digendong.'),
  (4, 'motorik', 2, 'Bayi dapat memegang mainan yang diletakkan di tangannya.'),
  (4, 'motorik', 3, 'Saat tengkurap, bayi menumpu tubuh pada siku/lengan bawah.'),
  (4, 'bahasa', 1, 'Bayi mengeluarkan suara seperti “ooo” atau “aaah”.'),
  (4, 'bahasa', 2, 'Bayi membalas dengan suara ketika diajak bicara.'),
  (4, 'bahasa', 3, 'Bayi menoleh ke arah suara Anda.'),
  (4, 'sosial', 1, 'Bayi tersenyum sendiri untuk menarik perhatian Anda.'),
  (4, 'sosial', 2, 'Bayi terkekeh saat diajak bermain.'),
  (4, 'sosial', 3, 'Bayi menatap, bergerak, atau bersuara agar Anda memperhatikannya.'),
  (6, 'motorik', 1, 'Bayi dapat berguling dari tengkurap ke telentang.'),
  (6, 'motorik', 2, 'Saat tengkurap, bayi menumpu tubuh dengan lengan yang lurus.'),
  (6, 'motorik', 3, 'Saat didudukkan, bayi bertumpu pada tangannya.'),
  (6, 'bahasa', 1, 'Bayi bergantian bersuara dengan Anda saat diajak ‘mengobrol’.'),
  (6, 'bahasa', 2, 'Bayi membunyikan bibir (meniup gelembung/‘raspberry’).'),
  (6, 'sosial', 1, 'Bayi mengenali orang yang dikenalnya.'),
  (6, 'sosial', 2, 'Bayi suka melihat dirinya di cermin.'),
  (6, 'sosial', 3, 'Bayi tertawa.'),
  (9, 'motorik', 1, 'Bayi dapat duduk sendiri tanpa disangga.'),
  (9, 'motorik', 2, 'Bayi memindahkan benda dari satu tangan ke tangan lain.'),
  (9, 'motorik', 3, 'Bayi menyapu makanan kecil ke arahnya dengan jari-jari.'),
  (9, 'bahasa', 1, 'Bayi mengucapkan suku kata berulang seperti “mamama” atau “bababa”.'),
  (9, 'bahasa', 2, 'Bayi mengangkat kedua tangan minta digendong.'),
  (9, 'sosial', 1, 'Bayi menoleh ketika namanya dipanggil.'),
  (9, 'sosial', 2, 'Bayi tampak malu atau takut pada orang asing.'),
  (9, 'sosial', 3, 'Bayi tertawa atau tersenyum saat bermain “ciluk ba”.'),
  (12, 'motorik', 1, 'Anak dapat berdiri sambil berpegangan.'),
  (12, 'motorik', 2, 'Anak berjalan sambil berpegangan pada perabot.'),
  (12, 'motorik', 3, 'Anak memungut benda kecil dengan ibu jari dan telunjuk.'),
  (12, 'bahasa', 1, 'Anak melambaikan tangan “dadah”.'),
  (12, 'bahasa', 2, 'Anak memanggil “mama” atau “papa” (atau sebutan khusus) dengan tepat.'),
  (12, 'bahasa', 3, 'Anak berhenti sejenak ketika dilarang “tidak”.'),
  (12, 'sosial', 1, 'Anak bermain bersama Anda, mis. tepuk tangan atau ‘cilukba’.'),
  (12, 'sosial', 2, 'Anak mencari benda yang disembunyikan di depannya.'),
  (12, 'sosial', 3, 'Anak menunjukkan benda yang disukainya.'),
  (15, 'motorik', 1, 'Anak berjalan beberapa langkah sendiri.'),
  (15, 'motorik', 2, 'Anak makan sebagian makanan sendiri dengan jari.'),
  (15, 'motorik', 3, 'Anak menyusun dua benda kecil (mis. balok) bertumpuk.'),
  (15, 'bahasa', 1, 'Anak mengucapkan satu atau dua kata selain “mama” dan “papa”.'),
  (15, 'bahasa', 2, 'Anak menunjuk untuk meminta sesuatu atau minta tolong.'),
  (15, 'bahasa', 3, 'Anak mengikuti perintah sederhana yang disertai isyarat.'),
  (15, 'sosial', 1, 'Anak meniru anak lain saat bermain.'),
  (15, 'sosial', 2, 'Anak bertepuk tangan ketika senang.'),
  (15, 'sosial', 3, 'Anak menunjukkan kasih sayang (memeluk atau mencium).'),
  (18, 'motorik', 1, 'Anak berjalan tanpa berpegangan pada apa pun.'),
  (18, 'motorik', 2, 'Anak mencoret-coret dengan alat tulis.'),
  (18, 'motorik', 3, 'Anak naik-turun kursi atau sofa tanpa dibantu.'),
  (18, 'bahasa', 1, 'Anak mengucapkan tiga kata atau lebih selain “mama” dan “papa”.'),
  (18, 'bahasa', 2, 'Anak mengikuti perintah satu langkah tanpa isyarat, mis. “duduk”.'),
  (18, 'sosial', 1, 'Anak menunjuk untuk memperlihatkan sesuatu yang menarik.'),
  (18, 'sosial', 2, 'Anak membantu saat dipakaikan baju (memasukkan lengan).'),
  (18, 'sosial', 3, 'Anak menjauh sebentar tetapi memeriksa Anda masih dekat.'),
  (24, 'motorik', 1, 'Anak menendang bola.'),
  (24, 'motorik', 2, 'Anak berlari.'),
  (24, 'motorik', 3, 'Anak berjalan naik beberapa anak tangga dengan atau tanpa dibantu.'),
  (24, 'bahasa', 1, 'Anak mengucapkan gabungan dua kata, mis. “mau minum”.'),
  (24, 'bahasa', 2, 'Anak menunjuk sedikitnya dua bagian tubuh ketika diminta.'),
  (24, 'bahasa', 3, 'Anak menunjuk gambar di buku ketika diminta.'),
  (24, 'sosial', 1, 'Anak memperhatikan ketika orang lain terluka atau sedih.'),
  (24, 'sosial', 2, 'Anak melihat wajah Anda untuk menilai reaksi pada situasi baru.'),
  (30, 'motorik', 1, 'Anak melompat dengan kedua kaki lepas dari tanah.'),
  (30, 'motorik', 2, 'Anak memutar benda, mis. membuka tutup botol atau gagang pintu.'),
  (30, 'motorik', 3, 'Anak membalik halaman buku satu per satu.'),
  (30, 'bahasa', 1, 'Anak mengucapkan sekitar 50 kata.'),
  (30, 'bahasa', 2, 'Anak menyebut nama benda di buku ketika ditanya “ini apa?”.'),
  (30, 'bahasa', 3, 'Anak memakai kata “aku”, “saya”, atau “kita”.'),
  (30, 'sosial', 1, 'Anak bermain di dekat anak lain dan kadang bermain bersama.'),
  (30, 'sosial', 2, 'Anak mengatakan “lihat aku!” untuk menunjukkan kemampuannya.'),
  (30, 'sosial', 3, 'Anak mengikuti kegiatan rutin sederhana, mis. membereskan mainan.'),
  (36, 'motorik', 1, 'Anak dapat merangkai benda besar, mis. manik-manik besar.'),
  (36, 'motorik', 2, 'Anak memakai sebagian pakaian sendiri, mis. celana longgar atau jaket.'),
  (36, 'motorik', 3, 'Anak dapat makan dengan garpu.'),
  (36, 'bahasa', 1, 'Anak dapat bercakap-cakap dengan minimal dua kali bolak-balik.'),
  (36, 'bahasa', 2, 'Anak mengajukan pertanyaan seperti “siapa”, “apa”, “di mana”, atau “kenapa”.'),
  (36, 'bahasa', 3, 'Anak menyebutkan nama depannya dan bicaranya cukup jelas dipahami orang lain.'),
  (36, 'sosial', 1, 'Anak tenang dalam 10 menit setelah ditinggal, mis. di tempat penitipan.'),
  (36, 'sosial', 2, 'Anak memperhatikan anak lain dan ikut bermain.'),
  (48, 'motorik', 1, 'Anak menangkap bola besar dalam sebagian besar percobaan.'),
  (48, 'motorik', 2, 'Anak membuka beberapa kancing baju.'),
  (48, 'motorik', 3, 'Anak memegang pensil dengan jari dan ibu jari (bukan menggenggam).'),
  (48, 'bahasa', 1, 'Anak berbicara dalam kalimat empat kata atau lebih.'),
  (48, 'bahasa', 2, 'Anak menceritakan sesuatu yang terjadi pada hari itu.'),
  (48, 'bahasa', 3, 'Anak menyanyikan sebagian lagu atau menceritakan sebagian cerita.'),
  (48, 'sosial', 1, 'Anak bermain pura-pura (menjadi guru, pahlawan, hewan).'),
  (48, 'sosial', 2, 'Anak menghibur orang lain yang terluka atau sedih.'),
  (48, 'sosial', 3, 'Anak menyesuaikan perilaku dengan tempatnya (tempat ibadah, perpustakaan, taman bermain).'),
  (60, 'motorik', 1, 'Anak melompat dengan satu kaki.'),
  (60, 'motorik', 2, 'Anak mengancingkan sebagian kancing.'),
  (60, 'motorik', 3, 'Anak menuliskan beberapa huruf namanya.'),
  (60, 'bahasa', 1, 'Anak menceritakan kisah dengan sedikitnya dua kejadian.'),
  (60, 'bahasa', 2, 'Anak mempertahankan percakapan lebih dari tiga kali bolak-balik.'),
  (60, 'bahasa', 3, 'Anak mengenali atau menyebut kata yang berima sederhana.'),
  (60, 'sosial', 1, 'Anak mengikuti aturan atau bergantian saat bermain.'),
  (60, 'sosial', 2, 'Anak bernyanyi, menari, atau bermain peran di depan Anda.'),
  (60, 'sosial', 3, 'Anak melakukan tugas rumah sederhana, mis. merapikan meja.')
on conflict do nothing;
