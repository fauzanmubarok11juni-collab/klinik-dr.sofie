-- =====================================================================
-- Iterasi 1: pasien, pendaftaran per sesi, Daftar Pasien Hari Ini, audit
-- Jalankan SETELAH 0001. Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

do $$ begin create type jenis_kelamin   as enum ('L', 'P');                                   exception when duplicate_object then null; end $$;
do $$ begin create type penjamin_tipe   as enum ('umum', 'asuransi');                         exception when duplicate_object then null; end $$;
do $$ begin create type status_kunjungan as enum ('menunggu', 'diperiksa', 'selesai', 'batal'); exception when duplicate_object then null; end $$;

-- ---------- settings (identitas praktik; diedit lewat menu Pengaturan di iterasi 4) ----------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('nama_praktik', '"Praktik dr.sop"'),
  ('alamat',       '""'),
  ('telepon',      '""'),
  ('sip_dokter',   '""'),
  ('kode_rm',      '"DS"')
on conflict (key) do nothing;

-- ---------- audit_logs (tidak bisa diubah/dihapus oleh pengguna) ----------
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  waktu      timestamptz not null default now(),
  user_id    uuid,
  tabel      text not null,
  record_id  text,
  aksi       text not null check (aksi in ('INSERT', 'UPDATE', 'DELETE')),
  data_lama  jsonb,
  data_baru  jsonb
);
create index if not exists audit_tabel_record_idx on public.audit_logs (tabel, record_id);
create index if not exists audit_waktu_idx on public.audit_logs (waktu desc);

create or replace function public.catat_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama)
    values (auth.uid(), tg_table_name, to_jsonb(old)->>'id', tg_op, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama, data_baru)
    values (auth.uid(), tg_table_name, to_jsonb(new)->>'id', tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_baru)
    values (auth.uid(), tg_table_name, to_jsonb(new)->>'id', tg_op, to_jsonb(new));
    return new;
  end if;
end $$;

-- ---------- Nomor RM: [KODE]-[TAHUN]-[URUT], mis. DS-2026-0001 ----------
create table if not exists public.rm_counter (
  tahun    int primary key,
  terakhir int not null default 0
);

create or replace function public.buat_no_rm() returns text
language plpgsql security definer set search_path = public as $$
declare
  th   int := extract(year from timezone('Asia/Jakarta', now()))::int;
  n    int;
  kode text;
begin
  select value #>> '{}' into kode from public.settings where key = 'kode_rm';
  kode := upper(regexp_replace(coalesce(nullif(kode, ''), 'DS'), '[^A-Za-z0-9]', '', 'g'));
  insert into public.rm_counter (tahun, terakhir) values (th, 1)
  on conflict (tahun) do update set terakhir = public.rm_counter.terakhir + 1
  returning terakhir into n;
  return kode || '-' || th || '-' || lpad(n::text, 4, '0');
end $$;

-- ---------- patients ----------
create table if not exists public.patients (
  id             uuid primary key default gen_random_uuid(),
  no_rm          text not null unique,
  nama           text not null check (length(trim(nama)) >= 2),
  tanggal_lahir  date not null check (tanggal_lahir >= date '1900-01-01'),
  jenis_kelamin  jenis_kelamin not null,
  no_hp          text check (no_hp is null or no_hp ~ '^[0-9]{8,15}$'),
  alamat         text,
  nik            text check (nik is null or nik ~ '^[0-9]{16}$'),
  penjamin       penjamin_tipe not null default 'umum',
  catatan        text,
  dibuat_oleh    uuid default auth.uid() references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists patients_nik_uniq on public.patients (nik) where nik is not null;
create index if not exists patients_nama_trgm on public.patients using gin (nama extensions.gin_trgm_ops);
create index if not exists patients_hp_idx  on public.patients (no_hp);
create index if not exists patients_tgl_idx on public.patients (tanggal_lahir);

create or replace function public.trg_set_no_rm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.no_rm is null or new.no_rm = '' then new.no_rm := public.buat_no_rm(); end if;
  return new;
end $$;
drop trigger if exists patients_no_rm on public.patients;
create trigger patients_no_rm before insert on public.patients
  for each row execute function public.trg_set_no_rm();

create or replace function public.trg_kunci_no_rm() returns trigger language plpgsql as $$
begin
  if new.no_rm is distinct from old.no_rm then raise exception 'No. RM tidak boleh diubah.'; end if;
  return new;
end $$;
drop trigger if exists patients_kunci_rm on public.patients;
create trigger patients_kunci_rm before update on public.patients
  for each row execute function public.trg_kunci_no_rm();

drop trigger if exists patients_updated_at on public.patients;
create trigger patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

-- ---------- data pendamping pasien ----------
create table if not exists public.patient_allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  nama_alergi text not null check (length(trim(nama_alergi)) > 0),
  reaksi      text,
  created_at  timestamptz not null default now()
);
create index if not exists allergies_patient_idx on public.patient_allergies (patient_id);

create table if not exists public.patient_conditions (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  nama_kondisi text not null check (length(trim(nama_kondisi)) > 0),
  catatan      text,
  created_at   timestamptz not null default now()
);
create index if not exists conditions_patient_idx on public.patient_conditions (patient_id);

create table if not exists public.patient_contacts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  nama        text not null check (length(trim(nama)) > 0),
  hubungan    text,
  no_hp       text check (no_hp is null or no_hp ~ '^[0-9]{8,15}$'),
  created_at  timestamptz not null default now()
);
create index if not exists contacts_patient_idx on public.patient_contacts (patient_id);

-- ---------- encounters (kunjungan = satu baris di Daftar Pasien Hari Ini) ----------
create table if not exists public.encounters (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete restrict,
  session_id    uuid not null references public.practice_sessions(id),
  tanggal       date not null default (timezone('Asia/Jakarta', now()))::date,
  no_urut       smallint not null,           -- nomor internal saja, BUKAN nomor panggilan
  keluhan_utama text,
  penjamin      penjamin_tipe not null default 'umum',
  status        status_kunjungan not null default 'menunggu',
  waktu_daftar  timestamptz not null default now(),
  waktu_mulai   timestamptz,
  waktu_selesai timestamptz,
  dibuat_oleh   uuid default auth.uid() references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tanggal, session_id, no_urut)
);
create index if not exists enc_tanggal_sesi_idx on public.encounters (tanggal, session_id, status);
create index if not exists enc_patient_idx on public.encounters (patient_id, tanggal desc);

create or replace function public.trg_set_no_urut() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.tanggal::text || new.session_id::text));
  select coalesce(max(e.no_urut), 0) + 1 into new.no_urut
  from public.encounters e where e.tanggal = new.tanggal and e.session_id = new.session_id;
  return new;
end $$;
drop trigger if exists enc_no_urut on public.encounters;
create trigger enc_no_urut before insert on public.encounters
  for each row execute function public.trg_set_no_urut();

create or replace function public.trg_set_waktu_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'menunggu' then
      new.waktu_mulai := null; new.waktu_selesai := null;
    elsif new.status = 'diperiksa' then
      new.waktu_mulai := coalesce(new.waktu_mulai, now()); new.waktu_selesai := null;
    elsif new.status = 'selesai' then
      new.waktu_mulai := coalesce(new.waktu_mulai, now()); new.waktu_selesai := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists enc_waktu_status on public.encounters;
create trigger enc_waktu_status before update on public.encounters
  for each row execute function public.trg_set_waktu_status();

drop trigger if exists enc_updated_at on public.encounters;
create trigger enc_updated_at before update on public.encounters
  for each row execute function public.set_updated_at();

-- ---------- Audit: patients & encounters ----------
drop trigger if exists patients_audit on public.patients;
create trigger patients_audit after insert or update or delete on public.patients
  for each row execute function public.catat_audit();
drop trigger if exists encounters_audit on public.encounters;
create trigger encounters_audit after insert or update or delete on public.encounters
  for each row execute function public.catat_audit();

-- ---------- Deteksi duplikat: peringatan, bukan pemblokiran ----------
create or replace function public.cari_duplikat(p_nama text, p_tgl date)
returns table (id uuid, no_rm text, nama text, tanggal_lahir date, no_hp text)
language sql stable set search_path = public, extensions as $$
  select p.id, p.no_rm, p.nama, p.tanggal_lahir, p.no_hp
  from public.patients p
  where (p.tanggal_lahir = p_tgl and similarity(lower(p.nama), lower(p_nama)) > 0.3)
     or similarity(lower(p.nama), lower(p_nama)) >= 0.8
  order by similarity(lower(p.nama), lower(p_nama)) desc
  limit 5;
$$;

-- ---------- Row Level Security ----------
alter table public.settings          enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.rm_counter        enable row level security;
alter table public.patients          enable row level security;
alter table public.patient_allergies enable row level security;
alter table public.patient_conditions enable row level security;
alter table public.patient_contacts  enable row level security;
alter table public.encounters        enable row level security;

-- settings: staf boleh baca; hanya Dokter boleh mengubah
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (public.is_staf());
drop policy if exists settings_dokter on public.settings;
create policy settings_dokter on public.settings for all to authenticated
  using (public.is_dokter()) with check (public.is_dokter());

-- audit_logs: hanya Dokter boleh membaca. Tidak ada policy tulis (diisi trigger).
drop policy if exists audit_select_dokter on public.audit_logs;
create policy audit_select_dokter on public.audit_logs for select to authenticated using (public.is_dokter());

-- Tabel pasien & kunjungan: staf baca/tambah/ubah; HANYA Dokter boleh menghapus.
do $$
declare t text;
begin
  foreach t in array array['patients','patient_allergies','patient_conditions','patient_contacts','encounters'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staf())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_staf())', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_staf()) with check (public.is_staf())', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_dokter())', t || '_delete', t);
  end loop;
end $$;

-- ---------- Hak akses tingkat tabel ----------
revoke all on public.audit_logs, public.rm_counter from anon, authenticated;
grant select on public.audit_logs to authenticated;
revoke all on public.settings, public.patients, public.patient_allergies, public.patient_conditions,
              public.patient_contacts, public.encounters from anon;
revoke all on function public.cari_duplikat(text, date) from public, anon;
grant execute on function public.cari_duplikat(text, date) to authenticated;
revoke all on function public.buat_no_rm() from public, anon, authenticated;

-- ---------- Realtime: Daftar Pasien Hari Ini otomatis segar di 2 komputer ----------
do $$ begin
  alter publication supabase_realtime add table public.encounters;
exception when duplicate_object or undefined_object then null; end $$;
