-- =====================================================================
-- Iterasi 0: akun (2 role), sesi praktik, dan keamanan dasar (RLS)
-- Jalankan sekali di Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipe data ----------
do $$ begin
  create type user_role as enum ('dokter', 'asisten');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sesi_kode as enum ('pagi', 'malam');
exception when duplicate_object then null; end $$;

-- ---------- Tabel ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nama        text not null check (length(trim(nama)) > 0),
  role        user_role not null default 'asisten',
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  kode         sesi_kode not null unique,
  nama         text not null,
  jam_mulai    time not null,
  jam_selesai  time not null,
  hari_aktif   smallint[] not null default '{1,2,3,4,5,6}', -- 1=Senin ... 6=Sabtu, 0=Minggu (libur)
  aktif        boolean not null default true,
  check (jam_selesai > jam_mulai)
);

-- ---------- Fungsi bantu (dipakai oleh RLS di semua iterasi berikutnya) ----------
create or replace function public.is_dokter() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'dokter' and aktif);
$$;

create or replace function public.is_asisten() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'asisten' and aktif);
$$;

create or replace function public.is_staf() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and aktif);
$$;

revoke all on function public.is_dokter(), public.is_asisten(), public.is_staf() from public, anon;
grant execute on function public.is_dokter(), public.is_asisten(), public.is_staf() to authenticated;

-- ---------- Akun baru -> profil otomatis; maksimal 2 akun ----------
-- Akun PERTAMA otomatis menjadi Dokter, akun KEDUA menjadi Asisten.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare jumlah int;
begin
  select count(*) into jumlah from public.profiles;
  if jumlah >= 2 then
    raise exception 'Sistem ini hanya untuk 2 akun (Dokter dan Asisten).';
  end if;
  insert into public.profiles (id, nama, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nama'), ''), split_part(new.email, '@', 1)),
    case when jumlah = 0 then 'dokter'::user_role else 'asisten'::user_role end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at otomatis ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.practice_sessions enable row level security;

-- profiles: tiap orang melihat profilnya sendiri; Dokter melihat semua; hanya Dokter boleh mengubah.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_dokter());

drop policy if exists profiles_update_dokter on public.profiles;
create policy profiles_update_dokter on public.profiles for update to authenticated
  using (public.is_dokter()) with check (public.is_dokter());
-- Tidak ada policy INSERT/DELETE: profil hanya dibuat oleh trigger di atas.

-- practice_sessions: semua staf boleh melihat; hanya Dokter boleh mengubah.
drop policy if exists sesi_select on public.practice_sessions;
create policy sesi_select on public.practice_sessions for select to authenticated
  using (public.is_staf());

drop policy if exists sesi_ubah_dokter on public.practice_sessions;
create policy sesi_ubah_dokter on public.practice_sessions for all to authenticated
  using (public.is_dokter()) with check (public.is_dokter());

-- ---------- Data awal: 2 sesi praktik ----------
insert into public.practice_sessions (kode, nama, jam_mulai, jam_selesai) values
  ('pagi',  'Sesi Pagi',  '06:00', '08:00'),
  ('malam', 'Sesi Malam', '18:00', '22:00')
on conflict (kode) do nothing;
