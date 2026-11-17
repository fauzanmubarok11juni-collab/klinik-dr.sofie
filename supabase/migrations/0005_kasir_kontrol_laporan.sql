-- =====================================================================
-- Iterasi 4: kasir, jadwal kontrol, laporan, dashboard, pengaturan
-- Jalankan SETELAH 0001-0004. Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Profil: simpan email (untuk menu Pengaturan > Pengguna) ----------
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare jumlah int;
begin
  select count(*) into jumlah from public.profiles;
  if jumlah >= 2 then
    raise exception 'Sistem ini hanya untuk 2 akun (Dokter dan Asisten).';
  end if;
  insert into public.profiles (id, nama, role, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nama'), ''), split_part(new.email, '@', 1)),
    case when jumlah = 0 then 'dokter'::user_role else 'asisten'::user_role end,
    new.email
  );
  return new;
end $$;

-- ---------- Pengaturan baru (nilai CONTOH; ubah di menu Pengaturan) ----------
insert into public.settings (key, value) values
  ('tarif_konsultasi', '50000'),
  ('tarif_kontrol', '30000'),
  ('templat_pengingat', '"{sapaan}, {panggilan}.\nKami dari {klinik} mengingatkan jadwal kontrol {tanggal}, {sesi} (jam {jam}).{catatan}\nAlamat: {alamat}\nBila perlu mengubah jadwal, silakan hubungi {telepon}.\nTerima kasih, semoga lekas sehat."')
on conflict (key) do nothing;

-- ---------- Jadwal kontrol ----------
create table if not exists public.control_schedules (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients(id) on delete cascade,
  encounter_id     uuid references public.encounters(id) on delete set null,   -- kunjungan yang menetapkan kontrol
  tanggal          date not null,
  session_id       uuid not null references public.practice_sessions(id),
  catatan          text,
  status           text not null default 'terjadwal' check (status in ('terjadwal','datang','batal')),
  encounter_datang uuid references public.encounters(id) on delete set null,
  pengingat_pada   timestamptz,
  dibuat_oleh      uuid default auth.uid() references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists control_tgl_idx on public.control_schedules (tanggal, status);
create index if not exists control_pasien_idx on public.control_schedules (patient_id);
drop trigger if exists control_updated_at on public.control_schedules;
create trigger control_updated_at before update on public.control_schedules
  for each row execute function public.set_updated_at();

-- Pasien terdaftar pada hari kunjungan baru -> jadwal kontrol terdekat (maks. 7 hari sebelum/sesudah) menjadi "datang"
create or replace function public.trg_kontrol_datang() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'batal' then
    update public.control_schedules cs set status = 'datang', encounter_datang = new.id
    where cs.id = (
      select c.id from public.control_schedules c
      where c.patient_id = new.patient_id and c.status = 'terjadwal'
        and c.tanggal between new.tanggal - 7 and new.tanggal + 7
      order by abs(c.tanggal - new.tanggal), c.tanggal limit 1);
  end if;
  return new;
end $$;
drop trigger if exists enc_kontrol_datang on public.encounters;
create trigger enc_kontrol_datang after insert on public.encounters
  for each row execute function public.trg_kontrol_datang();

-- ---------- Tagihan, rincian, pembayaran ----------
create table if not exists public.kuitansi_counter (tahun int primary key, terakhir int not null default 0);

create or replace function public.buat_nomor_kuitansi() returns text
language plpgsql security definer set search_path = public as $$
declare th int := extract(year from timezone('Asia/Jakarta', now()))::int; n int;
begin
  insert into public.kuitansi_counter (tahun, terakhir) values (th, 1)
  on conflict (tahun) do update set terakhir = public.kuitansi_counter.terakhir + 1
  returning terakhir into n;
  return 'KW-' || th || '-' || lpad(n::text, 5, '0');
end $$;
revoke all on function public.buat_nomor_kuitansi() from public, anon, authenticated;

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  nomor           text not null unique,
  encounter_id    uuid not null references public.encounters(id),
  patient_id      uuid not null references public.patients(id),
  tanggal         date not null,                         -- tanggal kunjungan
  penjamin        penjamin_tipe not null default 'umum',
  jenis_konsultasi text not null default 'konsultasi' check (jenis_konsultasi in ('konsultasi','kontrol','gratis')),
  status          text not null default 'terbuka' check (status in ('terbuka','lunas','void')),
  total           numeric(14,2) not null default 0 check (total >= 0),
  dibayar_pada    timestamptz,
  void_alasan     text,
  void_pada       timestamptz,
  void_oleh       uuid references public.profiles(id),
  dibuat_oleh     uuid default auth.uid() references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists invoices_aktif_uniq on public.invoices (encounter_id) where status <> 'void';
create index if not exists invoices_tgl_idx on public.invoices (tanggal, status);
drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create table if not exists public.invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  jenis        text not null check (jenis in ('konsultasi','tindakan','obat')),
  nama         text not null,
  jumlah       int not null check (jumlah > 0),
  harga_satuan numeric(12,2) not null check (harga_satuan >= 0),
  subtotal     numeric(14,2) generated always as (harga_satuan * jumlah) stored,
  urutan       int not null default 0
);
create index if not exists inv_items_inv_idx on public.invoice_items (invoice_id, urutan);

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null unique references public.invoices(id),
  metode      text not null check (metode in ('tunai','transfer','qris')),
  jumlah      numeric(14,2) not null check (jumlah >= 0),
  diterima    numeric(14,2) not null check (diterima >= 0),
  kembalian   numeric(14,2) not null default 0 check (kembalian >= 0),
  catatan     text,
  dibayar_pada timestamptz not null default now(),
  dibuat_oleh uuid default auth.uid() references public.profiles(id)
);

-- Audit tagihan & pembayaran
drop trigger if exists invoices_audit on public.invoices;
create trigger invoices_audit after insert or update or delete on public.invoices
  for each row execute function public.catat_audit();
drop trigger if exists payments_audit on public.payments;
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function public.catat_audit();

-- Bangun/perbarui tagihan dari: jasa konsultasi + tindakan + obat yang dijual. Tagihan LUNAS tidak diubah.
create or replace function public.sinkron_tagihan(p_encounter uuid, p_jenis text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  enc public.encounters%rowtype; inv_id uuid; inv_status text; jenis text; tarif numeric; baru_total numeric;
begin
  if not public.is_staf() then raise exception 'Tidak berwenang.'; end if;
  select * into enc from public.encounters where id = p_encounter;
  if not found then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if enc.status = 'batal' then raise exception 'Kunjungan ini dibatalkan.'; end if;

  select id, status, jenis_konsultasi into inv_id, inv_status, jenis
  from public.invoices where encounter_id = p_encounter and status <> 'void';

  if inv_id is null then
    jenis := case when exists (select 1 from public.control_schedules where encounter_datang = p_encounter)
                  then 'kontrol' else 'konsultasi' end;
    insert into public.invoices (nomor, encounter_id, patient_id, tanggal, penjamin, jenis_konsultasi)
    values (public.buat_nomor_kuitansi(), p_encounter, enc.patient_id, enc.tanggal, enc.penjamin, jenis)
    returning id into inv_id;
    inv_status := 'terbuka';
  end if;
  if inv_status <> 'terbuka' then return inv_id; end if;

  if p_jenis in ('konsultasi','kontrol','gratis') and p_jenis <> jenis then
    update public.invoices set jenis_konsultasi = p_jenis where id = inv_id;
    jenis := p_jenis;
  end if;

  delete from public.invoice_items where invoice_id = inv_id;
  if jenis <> 'gratis' then
    select coalesce((select (value #>> '{}')::numeric from public.settings
                     where key = case when jenis = 'kontrol' then 'tarif_kontrol' else 'tarif_konsultasi' end), 0) into tarif;
    if tarif > 0 then
      insert into public.invoice_items (invoice_id, jenis, nama, jumlah, harga_satuan, urutan)
      values (inv_id, 'konsultasi', case when jenis = 'kontrol' then 'Jasa kontrol' else 'Jasa konsultasi' end, 1, tarif, 0);
    end if;
  end if;
  insert into public.invoice_items (invoice_id, jenis, nama, jumlah, harga_satuan, urutan)
    select inv_id, 'tindakan', es.nama, es.jumlah, es.tarif_satuan, 10 + row_number() over (order by es.created_at)
    from public.encounter_services es where es.encounter_id = p_encounter;
  insert into public.invoice_items (invoice_id, jenis, nama, jumlah, harga_satuan, urutan)
    select inv_id, 'obat', ms.nama, ms.jumlah, ms.harga_satuan, 100 + row_number() over (order by ms.created_at)
    from public.medicine_sales ms where ms.encounter_id = p_encounter;

  select coalesce(sum(subtotal), 0) into baru_total from public.invoice_items where invoice_id = inv_id;
  update public.invoices set total = baru_total, penjamin = enc.penjamin
   where id = inv_id and (total, penjamin) is distinct from (baru_total, enc.penjamin);
  return inv_id;
end $$;

-- Terima pembayaran penuh. Total dihitung ulang; bila berbeda dari yang dilihat kasir, pembayaran ditolak.
create or replace function public.bayar_tagihan(p_invoice uuid, p_total_dilihat numeric, p_metode text, p_diterima numeric, p_catatan text)
returns void
language plpgsql security definer set search_path = public as $$
declare inv public.invoices%rowtype; tot numeric; terima numeric;
begin
  if not public.is_staf() then raise exception 'Tidak berwenang.'; end if;
  if p_metode not in ('tunai','transfer','qris') then raise exception 'Pilih metode pembayaran.'; end if;
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'Tagihan tidak ditemukan.'; end if;
  if inv.status <> 'terbuka' then raise exception 'Tagihan ini sudah lunas atau dibatalkan.'; end if;

  perform public.sinkron_tagihan(inv.encounter_id, null);
  select total into tot from public.invoices where id = p_invoice;
  if p_total_dilihat is distinct from tot then
    raise exception 'Tagihan berubah sejak dibuka (sekarang %). Muat ulang halaman.', tot;
  end if;

  terima := case when p_metode = 'tunai' then coalesce(p_diterima, 0) else tot end;
  if terima < tot then raise exception 'Uang diterima kurang dari total tagihan.'; end if;

  insert into public.payments (invoice_id, metode, jumlah, diterima, kembalian, catatan)
  values (p_invoice, p_metode, tot, terima, terima - tot, nullif(trim(p_catatan), ''));
  update public.invoices set status = 'lunas', dibayar_pada = now() where id = p_invoice;
end $$;

-- Void: hanya Dokter, wajib alasan, tercatat di audit. Data tidak dihapus.
create or replace function public.void_tagihan(p_invoice uuid, p_alasan text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter yang boleh membatalkan tagihan.'; end if;
  if length(trim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan pembatalan (minimal 3 huruf).'; end if;
  update public.invoices
     set status = 'void', void_alasan = trim(p_alasan), void_pada = now(), void_oleh = auth.uid()
   where id = p_invoice and status in ('terbuka','lunas');
  if not found then raise exception 'Tagihan tidak ditemukan atau sudah dibatalkan.'; end if;
end $$;

-- ---------- Penguncian setelah LUNAS (menggantikan fungsi lama) ----------
create or replace function public.simpan_rekam_medis(p_encounter uuid, p_data jsonb, p_selesai boolean default false)
returns timestamptz
language plpgsql set search_path = public as $$
declare
  s     jsonb := coalesce(p_data->'soap', '{}'::jsonb);
  v     jsonb := coalesce(p_data->'vitals', '{}'::jsonb);
  stat  status_kunjungan;
  hasil timestamptz;
  lama  jsonb;
begin
  if not public.is_dokter() then
    raise exception 'Hanya Dokter yang boleh mengisi rekam medis.';
  end if;
  select status into stat from public.encounters where id = p_encounter;
  if stat is null then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if stat = 'batal' then raise exception 'Kunjungan ini sudah dibatalkan.'; end if;

  insert into public.soap_notes (encounter_id, subjective, objective, assessment, plan, catatan)
  values (p_encounter, coalesce(s->>'subjective',''), coalesce(s->>'objective',''),
          coalesce(s->>'assessment',''), coalesce(s->>'plan',''), coalesce(s->>'catatan',''))
  on conflict (encounter_id) do update set
    subjective = excluded.subjective, objective = excluded.objective,
    assessment = excluded.assessment, plan = excluded.plan, catatan = excluded.catatan
  returning updated_at into hasil;

  insert into public.vitals (encounter_id, td_sistolik, td_diastolik, nadi, rr, suhu, spo2, bb, tb, lingkar_perut)
  values (p_encounter,
    nullif(v->>'td_sistolik','')::smallint, nullif(v->>'td_diastolik','')::smallint,
    nullif(v->>'nadi','')::smallint, nullif(v->>'rr','')::smallint,
    nullif(v->>'suhu','')::numeric, nullif(v->>'spo2','')::smallint,
    nullif(v->>'bb','')::numeric, nullif(v->>'tb','')::numeric, nullif(v->>'lingkar_perut','')::numeric)
  on conflict (encounter_id) do update set
    td_sistolik = excluded.td_sistolik, td_diastolik = excluded.td_diastolik, nadi = excluded.nadi,
    rr = excluded.rr, suhu = excluded.suhu, spo2 = excluded.spo2, bb = excluded.bb,
    tb = excluded.tb, lingkar_perut = excluded.lingkar_perut;

  -- Diagnosis: ganti seluruhnya
  delete from public.encounter_diagnoses where encounter_id = p_encounter;
  insert into public.encounter_diagnoses (encounter_id, diagnosis_kode, utama)
  select p_encounter, d.kode, coalesce((e.el->>'utama')::boolean, false)
  from jsonb_array_elements(coalesce(p_data->'diagnoses', '[]'::jsonb)) as e(el)
  join public.diagnoses d on d.kode = e.el->>'kode';

  -- Tindakan: dikunci bila tagihan kunjungan ini sudah LUNAS (ubah lewat void tagihan)
  if not exists (select 1 from public.invoices where encounter_id = p_encounter and status = 'lunas') then
  select coalesce(jsonb_object_agg(service_id::text, tarif_satuan), '{}'::jsonb) into lama
  from public.encounter_services where encounter_id = p_encounter;
  delete from public.encounter_services where encounter_id = p_encounter;
  insert into public.encounter_services (encounter_id, service_id, nama, tarif_satuan, jumlah)
  select p_encounter, sv.id, sv.nama,
         coalesce((lama->>(sv.id::text))::numeric, sv.tarif),
         greatest(1, least(99, coalesce((e.el->>'jumlah')::int, 1)))
  from jsonb_array_elements(coalesce(p_data->'services', '[]'::jsonb)) as e(el)
  join public.services sv on sv.id = (e.el->>'service_id')::uuid;
  end if;

  if p_selesai then
    update public.encounters set status = 'selesai' where id = p_encounter;
  elsif stat = 'menunggu' then
    update public.encounters set status = 'diperiksa' where id = p_encounter;
  end if;

  return hasil;
end $$;

create or replace function public.set_penjualan_obat(
  p_encounter uuid, p_medicine uuid, p_jumlah int, p_per_pakai numeric,
  p_aturan_kode text, p_aturan_bebas text, p_aturan_teks text, p_lama_hari int)
returns void
language plpgsql security definer set search_path = public as $$
declare st status_kunjungan; tgl date; med public.medicines%rowtype;
begin
  if not public.is_staf() then raise exception 'Tidak berwenang.'; end if;
  select status, tanggal into st, tgl from public.encounters where id = p_encounter;
  if st is null then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if st = 'batal' then raise exception 'Kunjungan ini sudah dibatalkan.'; end if;
  if exists (select 1 from public.invoices where encounter_id = p_encounter and status = 'lunas') then
    raise exception 'Tagihan kunjungan ini sudah lunas. Batalkan (void) tagihan dahulu bila perlu mengubah penjualan.';
  end if;
  if not public.is_dokter() and tgl <> (timezone('Asia/Jakarta', now()))::date then
    raise exception 'Asisten hanya dapat mengubah penjualan kunjungan hari ini.';
  end if;

  if coalesce(p_jumlah, 0) <= 0 then
    delete from public.medicine_sales where encounter_id = p_encounter and medicine_id = p_medicine;
    return;
  end if;

  select * into med from public.medicines where id = p_medicine and aktif;
  if not found then raise exception 'Obat tidak ditemukan.'; end if;
  if not med.dijual then raise exception 'Obat ini tidak dijual di klinik.'; end if;

  insert into public.medicine_sales
    (encounter_id, medicine_id, nama, harga_satuan, jumlah, per_pakai, aturan_kode, aturan_bebas, aturan_teks, lama_hari)
  values
    (p_encounter, p_medicine,
     med.nama || case when med.kekuatan <> '' then ' ' || med.kekuatan else '' end,
     med.harga_jual, p_jumlah, p_per_pakai, left(p_aturan_kode, 20), left(p_aturan_bebas, 200),
     left(coalesce(p_aturan_teks, ''), 300), p_lama_hari)
  on conflict (encounter_id, medicine_id) do update set
    jumlah = excluded.jumlah, per_pakai = excluded.per_pakai, aturan_kode = excluded.aturan_kode,
    aturan_bebas = excluded.aturan_bebas, aturan_teks = excluded.aturan_teks, lama_hari = excluded.lama_hari
  where (public.medicine_sales.jumlah, public.medicine_sales.per_pakai, public.medicine_sales.aturan_kode,
         public.medicine_sales.aturan_bebas, public.medicine_sales.aturan_teks, public.medicine_sales.lama_hari)
        is distinct from (excluded.jumlah, excluded.per_pakai, excluded.aturan_kode,
                          excluded.aturan_bebas, excluded.aturan_teks, excluded.lama_hari);
end $$;

-- ---------- Laporan & dashboard (hanya Dokter) ----------
create or replace function public.ringkasan_dashboard(p_hari date)
returns jsonb
language plpgsql stable set search_path = public as $$
declare
  awal date := date_trunc('month', p_hari)::date;
  r_hari jsonb; r_bulan jsonb; r_bl jsonb; r_dx jsonb; r_harian jsonb;
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kode), '[]'::jsonb) into r_hari from (
    select s.kode::text as kode,
      count(e.id) filter (where e.status <> 'batal') as terdaftar,
      count(e.id) filter (where e.status = 'menunggu') as menunggu,
      count(e.id) filter (where e.status = 'diperiksa') as diperiksa,
      count(e.id) filter (where e.status = 'selesai') as selesai,
      coalesce(sum(i.total) filter (where i.status = 'lunas'), 0) as pendapatan
    from public.practice_sessions s
    left join public.encounters e on e.session_id = s.id and e.tanggal = p_hari
    left join public.invoices i on i.encounter_id = e.id and i.status = 'lunas'
    where s.aktif group by s.kode) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kode), '[]'::jsonb) into r_bulan from (
    select s.kode::text as kode,
      count(e.id) filter (where e.status <> 'batal') as kunjungan,
      coalesce(sum(i.total) filter (where i.status = 'lunas'), 0) as pendapatan
    from public.practice_sessions s
    left join public.encounters e on e.session_id = s.id and e.tanggal between awal and p_hari
    left join public.invoices i on i.encounter_id = e.id and i.status = 'lunas'
    where s.aktif group by s.kode) x;

  select to_jsonb(x) into r_bl from (
    with bulan as (select distinct patient_id from public.encounters where status <> 'batal' and tanggal between awal and p_hari),
         pertama as (select patient_id, min(tanggal) as t from public.encounters where status <> 'batal' group by patient_id)
    select count(*) filter (where pertama.t >= awal) as baru, count(*) filter (where pertama.t < awal) as lama
    from bulan join pertama using (patient_id)) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.jumlah desc, x.kode), '[]'::jsonb) into r_dx from (
    select d.kode, d.nama, count(*) as jumlah
    from public.encounter_diagnoses ed
    join public.encounters e on e.id = ed.encounter_id and e.status <> 'batal' and e.tanggal between awal and p_hari
    join public.diagnoses d on d.kode = ed.diagnosis_kode
    group by d.kode, d.nama order by count(*) desc, d.kode limit 10) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.tanggal), '[]'::jsonb) into r_harian from (
    select g::date as tanggal,
      count(e.id) filter (where s.kode = 'pagi'  and e.status <> 'batal') as pagi,
      count(e.id) filter (where s.kode = 'malam' and e.status <> 'batal') as malam
    from generate_series(p_hari - 13, p_hari, interval '1 day') g
    left join public.encounters e on e.tanggal = g::date
    left join public.practice_sessions s on s.id = e.session_id
    group by g) x;

  return jsonb_build_object('hari', r_hari, 'bulan', r_bulan, 'baru_lama', r_bl, 'diagnosis', r_dx, 'harian', r_harian);
end $$;

create or replace function public.laporan_kunjungan(p_dari date, p_sampai date)
returns table (tanggal date, pagi int, malam int, selesai int, batal int, pasien_baru int)
language plpgsql stable set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;
  return query
  with pertama as (select e2.patient_id, min(e2.tanggal) as t from public.encounters e2 where e2.status <> 'batal' group by e2.patient_id)
  select e.tanggal,
    (count(*) filter (where s.kode = 'pagi'  and e.status <> 'batal'))::int,
    (count(*) filter (where s.kode = 'malam' and e.status <> 'batal'))::int,
    (count(*) filter (where e.status = 'selesai'))::int,
    (count(*) filter (where e.status = 'batal'))::int,
    (count(distinct e.patient_id) filter (where e.status <> 'batal' and e.tanggal = pt.t))::int
  from public.encounters e
  join public.practice_sessions s on s.id = e.session_id
  left join pertama pt on pt.patient_id = e.patient_id
  where e.tanggal between p_dari and p_sampai
  group by e.tanggal order by e.tanggal;
end $$;

create or replace function public.laporan_pendapatan(p_dari date, p_sampai date)
returns table (tanggal date, sesi text, metode text, transaksi int, konsultasi numeric, tindakan numeric, obat numeric, total numeric)
language plpgsql stable set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;
  return query
  select i.tanggal, s.kode::text, pay.metode, count(*)::int,
         coalesce(sum(it.k), 0), coalesce(sum(it.t), 0), coalesce(sum(it.o), 0), sum(i.total)
  from public.invoices i
  join public.encounters e on e.id = i.encounter_id
  join public.practice_sessions s on s.id = e.session_id
  join public.payments pay on pay.invoice_id = i.id
  cross join lateral (
    select coalesce(sum(x.subtotal) filter (where x.jenis = 'konsultasi'), 0) as k,
           coalesce(sum(x.subtotal) filter (where x.jenis = 'tindakan'), 0) as t,
           coalesce(sum(x.subtotal) filter (where x.jenis = 'obat'), 0) as o
    from public.invoice_items x where x.invoice_id = i.id) it
  where i.status = 'lunas' and i.tanggal between p_dari and p_sampai
  group by i.tanggal, s.kode, pay.metode
  order by i.tanggal, s.kode, pay.metode;
end $$;

create or replace function public.laporan_diagnosis(p_dari date, p_sampai date, p_limit int default 30)
returns table (kode text, nama text, jumlah int, sebagai_utama int)
language plpgsql stable set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;
  return query
  select d.kode, d.nama, count(*)::int, (count(*) filter (where ed.utama))::int
  from public.encounter_diagnoses ed
  join public.encounters e on e.id = ed.encounter_id and e.status <> 'batal' and e.tanggal between p_dari and p_sampai
  join public.diagnoses d on d.kode = ed.diagnosis_kode
  group by d.kode, d.nama order by count(*) desc, d.kode
  limit least(greatest(coalesce(p_limit, 30), 1), 200);
end $$;

create or replace function public.laporan_obat(p_dari date, p_sampai date)
returns table (nama text, jumlah int, nilai numeric, stok_sekarang int)
language plpgsql stable set search_path = public as $$
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter.'; end if;
  return query
  select ms.nama, (sum(ms.jumlah))::int, sum(ms.subtotal), m.stok_saat_ini
  from public.medicine_sales ms
  join public.encounters e on e.id = ms.encounter_id and e.status <> 'batal' and e.tanggal between p_dari and p_sampai
  join public.medicines m on m.id = ms.medicine_id
  group by ms.medicine_id, ms.nama, m.stok_saat_ini
  order by sum(ms.subtotal) desc, ms.nama;
end $$;

revoke all on function
  public.sinkron_tagihan(uuid, text), public.bayar_tagihan(uuid, numeric, text, numeric, text), public.void_tagihan(uuid, text),
  public.ringkasan_dashboard(date), public.laporan_kunjungan(date, date), public.laporan_pendapatan(date, date),
  public.laporan_diagnosis(date, date, int), public.laporan_obat(date, date)
  from public, anon;
grant execute on function
  public.sinkron_tagihan(uuid, text), public.bayar_tagihan(uuid, numeric, text, numeric, text), public.void_tagihan(uuid, text),
  public.ringkasan_dashboard(date), public.laporan_kunjungan(date, date), public.laporan_pendapatan(date, date),
  public.laporan_diagnosis(date, date, int), public.laporan_obat(date, date)
  to authenticated;

-- ---------- Row Level Security ----------
alter table public.control_schedules enable row level security;
alter table public.kuitansi_counter  enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_items     enable row level security;
alter table public.payments          enable row level security;

-- Jadwal kontrol: staf baca/tambah/ubah; hanya Dokter menghapus
drop policy if exists control_select on public.control_schedules;
create policy control_select on public.control_schedules for select to authenticated using (public.is_staf());
drop policy if exists control_insert on public.control_schedules;
create policy control_insert on public.control_schedules for insert to authenticated with check (public.is_staf());
drop policy if exists control_update on public.control_schedules;
create policy control_update on public.control_schedules for update to authenticated using (public.is_staf()) with check (public.is_staf());
drop policy if exists control_delete on public.control_schedules;
create policy control_delete on public.control_schedules for delete to authenticated using (public.is_dokter());

-- Tagihan: hanya dibaca langsung; semua perubahan lewat fungsi di atas (tidak ada policy tulis)
do $$
declare t text;
begin
  foreach t in array array['invoices','invoice_items','payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staf())', t || '_select', t);
  end loop;
end $$;

revoke all on public.control_schedules, public.invoices, public.invoice_items, public.payments from anon;
revoke all on public.kuitansi_counter from anon, authenticated;
revoke insert, update, delete on public.invoices, public.invoice_items, public.payments from authenticated;
