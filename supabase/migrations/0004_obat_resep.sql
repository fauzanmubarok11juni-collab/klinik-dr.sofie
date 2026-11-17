-- =====================================================================
-- Iterasi 3: obat, stok sederhana, resep, penjualan di klinik, interaksi, dosis
-- Jalankan SETELAH 0001, 0002, 0003. Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Master obat (satu baris per obat; SATU tanggal kedaluwarsa, tanpa batch) ----------
create table if not exists public.medicines (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null check (length(trim(nama)) > 0),
  kekuatan      text not null default '',                 -- tampilan, mis. '500 mg'
  sediaan       text not null,                            -- tablet, kapsul, sirup, krim ...
  kekuatan_mg   numeric(10,3),                            -- mg zat aktif PER satuan_dosis (kosong bila kombinasi/tidak berlaku)
  satuan        text not null,                            -- satuan yang diserahkan/dijual: tablet, botol, tube
  satuan_dosis  text not null,                            -- satuan sekali pakai: tablet, ml, oles
  zat_aktif     text[] not null default '{}',
  golongan      text,
  dijual        boolean not null default false,           -- true = disediakan & dijual di klinik
  harga_jual    numeric(12,2) not null default 0 check (harga_jual >= 0),
  stok_saat_ini int not null default 0 check (stok_saat_ini >= 0),
  stok_minimum  int not null default 0 check (stok_minimum >= 0),
  tanggal_expired date,
  aktif         boolean not null default true,
  catatan       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (nama, kekuatan, sediaan)
);
create index if not exists medicines_nama_trgm on public.medicines using gin (nama extensions.gin_trgm_ops);
create index if not exists medicines_dijual_idx on public.medicines (dijual) where aktif;
drop trigger if exists medicines_updated_at on public.medicines;
create trigger medicines_updated_at before update on public.medicines
  for each row execute function public.set_updated_at();

-- ---------- Riwayat stok masuk/keluar (sederhana) ----------
create table if not exists public.medicine_stock_movements (
  id          uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id),
  tipe        text not null check (tipe in ('masuk','keluar')),
  jumlah      int  not null check (jumlah > 0),
  tanggal     date not null default (timezone('Asia/Jakarta', now()))::date,
  catatan     text,
  sale_id     uuid,                                       -- terisi bila berasal dari penjualan
  stok_sesudah int,
  dibuat_oleh uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists stock_mv_med_idx on public.medicine_stock_movements (medicine_id, created_at desc);

-- ---------- Resep (ke apotek luar) ----------
create table if not exists public.prescriptions (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete cascade,
  dokter_id    uuid default auth.uid() references public.profiles(id),
  catatan      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists prescriptions_updated_at on public.prescriptions;
create trigger prescriptions_updated_at before update on public.prescriptions
  for each row execute function public.set_updated_at();

create table if not exists public.prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  encounter_id    uuid not null references public.encounters(id) on delete cascade,
  medicine_id     uuid references public.medicines(id),   -- kosong = obat di luar daftar (diketik manual)
  nama            text not null,
  sediaan         text,
  satuan          text not null default 'tablet',
  satuan_dosis    text,
  per_pakai       numeric(8,2),
  aturan_kode     text,
  aturan_bebas    text,
  aturan_teks     text not null default '',               -- teks bahasa awam siap cetak
  lama_hari       int check (lama_hari is null or lama_hari between 1 and 365),
  jumlah          int not null default 1 check (jumlah between 1 and 9999),
  catatan         text,
  urutan          int not null default 0
);
create index if not exists rx_items_rx_idx on public.prescription_items (prescription_id, urutan);
create index if not exists rx_items_enc_idx on public.prescription_items (encounter_id);
create index if not exists rx_items_med_idx on public.prescription_items (medicine_id);

-- ---------- Penjualan obat di klinik ----------
create table if not exists public.medicine_sales (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  medicine_id  uuid not null references public.medicines(id),
  nama         text not null,                              -- salinan saat dijual
  harga_satuan numeric(12,2) not null check (harga_satuan >= 0),
  jumlah       int not null check (jumlah > 0),
  subtotal     numeric(14,2) generated always as (harga_satuan * jumlah) stored,
  per_pakai    numeric(8,2),
  aturan_kode  text,
  aturan_bebas text,
  aturan_teks  text not null default '',
  lama_hari    int check (lama_hari is null or lama_hari between 1 and 365),
  dibuat_oleh  uuid default auth.uid() references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (encounter_id, medicine_id)
);
create index if not exists sales_enc_idx on public.medicine_sales (encounter_id);
drop trigger if exists sales_updated_at on public.medicine_sales;
create trigger sales_updated_at before update on public.medicine_sales
  for each row execute function public.set_updated_at();

-- ---------- Interaksi, aturan dosis, kriteria Beers ringkas ----------
create table if not exists public.drug_interactions (
  id       uuid primary key default gen_random_uuid(),
  kunci_a  text not null,            -- nama zat aktif ATAU golongan (huruf kecil)
  kunci_b  text not null,
  tingkat  text not null check (tingkat in ('berat','sedang','ringan')),
  keterangan text not null
);
create unique index if not exists drug_inter_uniq on public.drug_interactions ((least(kunci_a, kunci_b)), (greatest(kunci_a, kunci_b)));

create table if not exists public.drug_dose_rules (
  zat_aktif          text primary key,
  anak_min_mg_kg_hari numeric(8,2),
  anak_maks_mg_kg_hari numeric(8,2),
  dewasa_maks_mg_hari numeric(10,2),
  catatan            text
);

create table if not exists public.drug_geriatric_alerts (
  kunci  text primary key,           -- zat aktif atau golongan
  saran  text not null
);

-- ---------- Stok: satu pintu, tidak boleh minus ----------
create or replace function public.terapkan_stok(p_medicine uuid, p_delta int, p_catatan text, p_sale uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare baru int; nm text;
begin
  if p_delta = 0 then return null; end if;
  update public.medicines set stok_saat_ini = stok_saat_ini + p_delta
   where id = p_medicine and stok_saat_ini + p_delta >= 0
   returning stok_saat_ini into baru;
  if baru is null then
    select m.nama || ' ' || m.kekuatan || ' (tersisa ' || m.stok_saat_ini || ')' into nm from public.medicines m where m.id = p_medicine;
    raise exception 'Stok tidak cukup: %', coalesce(nm, 'obat');
  end if;
  insert into public.medicine_stock_movements (medicine_id, tipe, jumlah, catatan, sale_id, stok_sesudah)
  values (p_medicine, case when p_delta < 0 then 'keluar' else 'masuk' end, abs(p_delta), p_catatan, p_sale, baru);
  return baru;
end $$;
revoke all on function public.terapkan_stok(uuid, int, text, uuid) from public, anon, authenticated;

create or replace function public.trg_sales_stok() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.terapkan_stok(new.medicine_id, -new.jumlah, 'Penjualan', new.id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.jumlah <> old.jumlah then
      perform public.terapkan_stok(new.medicine_id, old.jumlah - new.jumlah, 'Perubahan jumlah penjualan', new.id);
    end if;
    return new;
  else
    perform public.terapkan_stok(old.medicine_id, old.jumlah, 'Penjualan dibatalkan', old.id);
    return old;
  end if;
end $$;
drop trigger if exists sales_stok on public.medicine_sales;
create trigger sales_stok after insert or update or delete on public.medicine_sales
  for each row execute function public.trg_sales_stok();

-- ---------- Audit ----------
drop trigger if exists sales_audit on public.medicine_sales;
create trigger sales_audit after insert or update or delete on public.medicine_sales
  for each row execute function public.catat_audit();
drop trigger if exists prescriptions_audit on public.prescriptions;
create trigger prescriptions_audit after insert or update or delete on public.prescriptions
  for each row execute function public.catat_audit();

-- Isi resep dicatat hanya bila diubah SETELAH kunjungan Selesai (menghindari lonjakan log akibat autosave)
create or replace function public.catat_audit_resep_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare st status_kunjungan;
begin
  if tg_op = 'DELETE' then
    select e.status into st from public.encounters e where e.id = old.encounter_id;
    if st = 'selesai' then
      insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama)
      values (auth.uid(), tg_table_name, old.id::text, tg_op, to_jsonb(old));
    end if;
    return old;
  end if;
  select e.status into st from public.encounters e where e.id = new.encounter_id;
  if st = 'selesai' then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama, data_baru)
    values (auth.uid(), tg_table_name, new.id::text, tg_op,
            case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  end if;
  return new;
end $$;
drop trigger if exists rx_items_audit on public.prescription_items;
create trigger rx_items_audit after insert or update or delete on public.prescription_items
  for each row execute function public.catat_audit_resep_item();

-- ---------- Pencarian obat (autocomplete; kosong = yang sering dipakai) ----------
create or replace function public.cari_obat(p_q text, p_hanya_dijual boolean default false, p_limit int default 8)
returns table (id uuid, nama text, kekuatan text, sediaan text, kekuatan_mg numeric, satuan text, satuan_dosis text,
               harga_jual numeric, stok_saat_ini int, stok_minimum int, tanggal_expired date, dijual boolean)
language sql stable set search_path = public, extensions as $$
  with k as (
    select trim(coalesce(p_q, '')) as t,
           replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as e
  ),
  pakai as (
    select medicine_id, count(*) n from (
      select medicine_id from public.prescription_items where medicine_id is not null
      union all select medicine_id from public.medicine_sales) x
    group by medicine_id
  )
  select m.id, m.nama, m.kekuatan, m.sediaan, m.kekuatan_mg, m.satuan, m.satuan_dosis,
         m.harga_jual, m.stok_saat_ini, m.stok_minimum, m.tanggal_expired, m.dijual
  from public.medicines m
  cross join k
  left join pakai p on p.medicine_id = m.id
  where m.aktif and (not coalesce(p_hanya_dijual, false) or m.dijual)
    and (k.t = '' or m.nama ilike '%' || k.e || '%'
         or exists (select 1 from unnest(m.zat_aktif) z where z ilike '%' || k.e || '%'))
  order by (k.t <> '' and m.nama ilike k.e || '%') desc, coalesce(p.n, 0) desc, m.dijual desc, m.nama, m.kekuatan
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

-- ---------- Obat aktif pasien (dari resep & penjualan kunjungan lain yang masa pakainya belum habis) ----------
create or replace function public.obat_aktif_pasien(p_patient uuid, p_kecuali uuid default null)
returns table (medicine_id uuid, nama text, aturan text, sampai date)
language sql stable set search_path = public as $$
  select x.medicine_id, x.nama, x.aturan, x.sampai from (
    select pi.medicine_id, pi.nama, pi.aturan_teks as aturan, (e.tanggal + pi.lama_hari) as sampai
    from public.prescription_items pi
    join public.encounters e on e.id = pi.encounter_id
    where e.patient_id = p_patient and e.status <> 'batal' and e.id is distinct from p_kecuali and pi.lama_hari is not null
    union all
    select ms.medicine_id, ms.nama, ms.aturan_teks, (e.tanggal + ms.lama_hari)
    from public.medicine_sales ms
    join public.encounters e on e.id = ms.encounter_id
    where e.patient_id = p_patient and e.status <> 'batal' and e.id is distinct from p_kecuali and ms.lama_hari is not null
  ) x
  where x.sampai >= (timezone('Asia/Jakarta', now()))::date
  order by x.sampai desc;
$$;

-- ---------- Simpan resep (hanya Dokter; ganti seluruh isi resep kunjungan) ----------
create or replace function public.simpan_resep(p_encounter uuid, p_data jsonb)
returns timestamptz
language plpgsql set search_path = public as $$
declare
  stat status_kunjungan; pid uuid; cat text := coalesce(p_data->>'catatan', '');
  items jsonb := coalesce(p_data->'items', '[]'::jsonb);
begin
  if not public.is_dokter() then raise exception 'Hanya Dokter yang boleh menulis resep.'; end if;
  select status into stat from public.encounters where id = p_encounter;
  if stat is null then raise exception 'Kunjungan tidak ditemukan.'; end if;
  if stat = 'batal' then raise exception 'Kunjungan ini sudah dibatalkan.'; end if;

  if jsonb_array_length(items) = 0 and trim(cat) = '' then
    delete from public.prescriptions where encounter_id = p_encounter;
    return now();
  end if;

  insert into public.prescriptions (encounter_id, catatan) values (p_encounter, cat)
  on conflict (encounter_id) do update set catatan = excluded.catatan
    where public.prescriptions.catatan is distinct from excluded.catatan
  returning id into pid;
  if pid is null then select id into pid from public.prescriptions where encounter_id = p_encounter; end if;

  delete from public.prescription_items where prescription_id = pid;
  insert into public.prescription_items
    (prescription_id, encounter_id, medicine_id, nama, sediaan, satuan, satuan_dosis, per_pakai,
     aturan_kode, aturan_bebas, aturan_teks, lama_hari, jumlah, catatan, urutan)
  select pid, p_encounter, m.id,
         coalesce(m.nama || case when m.kekuatan <> '' then ' ' || m.kekuatan else '' end, left(e.el->>'nama', 200)),
         coalesce(m.sediaan, nullif(left(e.el->>'sediaan', 100), '')),
         coalesce(m.satuan, nullif(left(e.el->>'satuan', 30), ''), 'tablet'),
         coalesce(m.satuan_dosis, nullif(left(e.el->>'satuan_dosis', 30), '')),
         nullif(e.el->>'per_pakai', '')::numeric,
         nullif(left(e.el->>'aturan_kode', 20), ''), nullif(left(e.el->>'aturan_bebas', 200), ''),
         left(coalesce(e.el->>'aturan_teks', ''), 300),
         nullif(e.el->>'lama_hari', '')::int,
         greatest(1, least(9999, coalesce(nullif(e.el->>'jumlah', '')::int, 1))),
         nullif(left(e.el->>'catatan', 300), ''),
         (e.n)::int
  from jsonb_array_elements(items) with ordinality as e(el, n)
  left join public.medicines m on m.id = nullif(e.el->>'medicine_id', '')::uuid;

  return now();
end $$;

-- ---------- Penjualan obat: per baris (Dokter dan Asisten) ----------
-- jumlah 0 = hapus baris. Asisten hanya boleh mengubah kunjungan HARI INI; semua perubahan tercatat di audit.
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

-- ---------- Catat stok manual (Dokter dan Asisten) ----------
create or replace function public.catat_stok(
  p_medicine uuid, p_tipe text, p_jumlah int, p_tanggal date, p_catatan text, p_expired date default null)
returns int
language plpgsql security definer set search_path = public as $$
declare baru int;
begin
  if not public.is_staf() then raise exception 'Tidak berwenang.'; end if;
  if p_tipe not in ('masuk','keluar') then raise exception 'Jenis harus masuk atau keluar.'; end if;
  if coalesce(p_jumlah, 0) <= 0 then raise exception 'Jumlah harus lebih dari 0.'; end if;
  if p_tipe = 'keluar' and coalesce(trim(p_catatan), '') = '' then raise exception 'Tulis alasan stok dikurangi.'; end if;
  if not exists (select 1 from public.medicines where id = p_medicine and dijual) then
    raise exception 'Obat ini tidak dijual di klinik.';
  end if;
  baru := public.terapkan_stok(p_medicine, case when p_tipe = 'masuk' then p_jumlah else -p_jumlah end,
                               coalesce(nullif(trim(p_catatan), ''), 'Stok masuk'));
  if p_tanggal is not null then
    update public.medicine_stock_movements set tanggal = p_tanggal
     where id = (select id from public.medicine_stock_movements where medicine_id = p_medicine order by created_at desc limit 1);
  end if;
  if p_expired is not null then
    update public.medicines set tanggal_expired = p_expired where id = p_medicine;
  end if;
  return baru;
end $$;

revoke all on function public.cari_obat(text, boolean, int), public.obat_aktif_pasien(uuid, uuid),
  public.simpan_resep(uuid, jsonb), public.set_penjualan_obat(uuid, uuid, int, numeric, text, text, text, int),
  public.catat_stok(uuid, text, int, date, text, date) from public, anon;
grant execute on function public.cari_obat(text, boolean, int), public.obat_aktif_pasien(uuid, uuid),
  public.simpan_resep(uuid, jsonb), public.set_penjualan_obat(uuid, uuid, int, numeric, text, text, text, int),
  public.catat_stok(uuid, text, int, date, text, date) to authenticated;

-- ---------- Row Level Security ----------
alter table public.medicines                enable row level security;
alter table public.medicine_stock_movements enable row level security;
alter table public.prescriptions            enable row level security;
alter table public.prescription_items       enable row level security;
alter table public.medicine_sales           enable row level security;
alter table public.drug_interactions        enable row level security;
alter table public.drug_dose_rules          enable row level security;
alter table public.drug_geriatric_alerts    enable row level security;

-- Dibaca staf, diubah Dokter (Asisten tidak bisa mengubah harga/daftar obat)
do $$
declare t text;
begin
  foreach t in array array['medicines','prescriptions','prescription_items','medicine_sales',
                           'drug_interactions','drug_dose_rules','drug_geriatric_alerts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staf())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_dokter', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dokter()) with check (public.is_dokter())', t || '_dokter', t);
  end loop;
end $$;
-- Riwayat stok: hanya dibaca; ditulis oleh fungsi di atas
drop policy if exists stock_mv_select on public.medicine_stock_movements;
create policy stock_mv_select on public.medicine_stock_movements for select to authenticated using (public.is_staf());

revoke all on public.medicines, public.medicine_stock_movements, public.prescriptions, public.prescription_items,
              public.medicine_sales, public.drug_interactions, public.drug_dose_rules, public.drug_geriatric_alerts from anon;
revoke insert, update, delete on public.medicine_stock_movements from authenticated;

-- Nama dokter untuk cetak resep
insert into public.settings (key, value) values ('nama_dokter', '"dr. Sop"') on conflict (key) do nothing;

-- ---------- Data awal ----------
-- HARGA dan STOK di bawah hanyalah CONTOH. Sesuaikan (lihat README).
insert into public.medicines
  (nama, kekuatan, sediaan, kekuatan_mg, satuan, satuan_dosis, zat_aktif, golongan, dijual, harga_jual, stok_saat_ini, stok_minimum, tanggal_expired) values
  ('Paracetamol', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['paracetamol']::text[], 'analgesik-antipiretik', true, 1000, 200, 50, '2028-03-31'),
  ('Paracetamol', '120 mg/5 mL', 'sirup', 24, 'botol', 'ml', array['paracetamol']::text[], 'analgesik-antipiretik', true, 15000, 12, 4, '2027-10-31'),
  ('Ibuprofen', '400 mg', 'tablet', 400, 'tablet', 'tablet', array['ibuprofen']::text[], 'nsaid', true, 1500, 100, 30, '2028-01-31'),
  ('Asam mefenamat', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['asam mefenamat']::text[], 'nsaid', true, 1500, 100, 30, '2028-01-31'),
  ('Amoksisilin', '500 mg', 'kapsul', 500, 'kapsul', 'kapsul', array['amoksisilin']::text[], 'penisilin', true, 2000, 150, 50, '2027-12-31'),
  ('Cetirizine', '10 mg', 'tablet', 10, 'tablet', 'tablet', array['cetirizine']::text[], 'antihistamin generasi 2', true, 1500, 60, 20, '2028-02-29'),
  ('Klorfeniramin (CTM)', '4 mg', 'tablet', 4, 'tablet', 'tablet', array['klorfeniramin']::text[], 'antihistamin generasi 1', true, 500, 100, 30, '2028-02-29'),
  ('Ambroksol', '30 mg', 'tablet', 30, 'tablet', 'tablet', array['ambroksol']::text[], 'mukolitik', true, 1000, 80, 30, '2027-11-30'),
  ('Ambroksol', '15 mg/5 mL', 'sirup', 3, 'botol', 'ml', array['ambroksol']::text[], 'mukolitik', true, 14000, 8, 3, '2027-09-30'),
  ('Omeprazol', '20 mg', 'kapsul', 20, 'kapsul', 'kapsul', array['omeprazol']::text[], 'ppi', true, 2500, 60, 20, '2027-12-31'),
  ('Antasida DOEN', '200/200 mg', 'tablet kunyah', null, 'tablet', 'tablet', array['aluminium hidroksida','magnesium hidroksida']::text[], 'antasida', true, 1000, 100, 30, '2028-04-30'),
  ('Domperidon', '10 mg', 'tablet', 10, 'tablet', 'tablet', array['domperidon']::text[], 'prokinetik', true, 1500, 60, 20, '2027-12-31'),
  ('Zinc', '20 mg', 'tablet', 20, 'tablet', 'tablet', array['zinc']::text[], 'suplemen zinc', true, 2000, 60, 20, '2028-05-31'),
  ('Vitamin B kompleks', 'B1/B6/B12', 'tablet', null, 'tablet', 'tablet', array['vitamin b kompleks']::text[], 'vitamin', true, 500, 200, 50, '2028-06-30'),
  ('Vitamin C', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['asam askorbat']::text[], 'vitamin', true, 800, 100, 30, '2028-06-30'),
  ('Deksametason', '0,5 mg', 'tablet', 0.5, 'tablet', 'tablet', array['deksametason']::text[], 'kortikosteroid', true, 500, 100, 30, '2028-03-31'),
  ('Hidrokortison', '2,5%', 'krim 5 g', null, 'tube', 'oles', array['hidrokortison']::text[], 'kortikosteroid topikal', true, 12000, 10, 3, '2027-12-31'),
  ('Mikonazol', '2%', 'krim 10 g', null, 'tube', 'oles', array['mikonazol']::text[], 'azol topikal', true, 15000, 8, 3, '2027-12-31'),
  ('Amlodipin', '5 mg', 'tablet', 5, 'tablet', 'tablet', array['amlodipin']::text[], 'ccb', true, 1500, 100, 30, '2028-01-31'),
  ('Metformin', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['metformin']::text[], 'biguanid', true, 1000, 100, 30, '2028-01-31'),
  ('Natrium diklofenak', '50 mg', 'tablet', 50, 'tablet', 'tablet', array['natrium diklofenak']::text[], 'nsaid', false, 0, 0, 0, null),
  ('Meloxicam', '15 mg', 'tablet', 15, 'tablet', 'tablet', array['meloxicam']::text[], 'nsaid', false, 0, 0, 0, null),
  ('Amoksisilin', '125 mg/5 mL', 'sirup', 25, 'botol', 'ml', array['amoksisilin']::text[], 'penisilin', false, 0, 0, 0, null),
  ('Amoksisilin-asam klavulanat', '625 mg', 'tablet', null, 'tablet', 'tablet', array['amoksisilin','asam klavulanat']::text[], 'penisilin', false, 0, 0, 0, null),
  ('Sefiksim', '100 mg', 'kapsul', 100, 'kapsul', 'kapsul', array['sefiksim']::text[], 'sefalosporin', false, 0, 0, 0, null),
  ('Sefadroksil', '500 mg', 'kapsul', 500, 'kapsul', 'kapsul', array['sefadroksil']::text[], 'sefalosporin', false, 0, 0, 0, null),
  ('Azitromisin', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['azitromisin']::text[], 'makrolida', false, 0, 0, 0, null),
  ('Klaritromisin', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['klaritromisin']::text[], 'makrolida', false, 0, 0, 0, null),
  ('Siprofloksasin', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['siprofloksasin']::text[], 'kuinolon', false, 0, 0, 0, null),
  ('Levofloksasin', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['levofloksasin']::text[], 'kuinolon', false, 0, 0, 0, null),
  ('Kotrimoksazol', '480 mg', 'tablet', null, 'tablet', 'tablet', array['kotrimoksazol']::text[], 'sulfonamida', false, 0, 0, 0, null),
  ('Metronidazol', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['metronidazol']::text[], 'imidazol', false, 0, 0, 0, null),
  ('Doksisiklin', '100 mg', 'kapsul', 100, 'kapsul', 'kapsul', array['doksisiklin']::text[], 'tetrasiklin', false, 0, 0, 0, null),
  ('Klindamisin', '300 mg', 'kapsul', 300, 'kapsul', 'kapsul', array['klindamisin']::text[], 'linkosamid', false, 0, 0, 0, null),
  ('Flukonazol', '150 mg', 'kapsul', 150, 'kapsul', 'kapsul', array['flukonazol']::text[], 'azol', false, 0, 0, 0, null),
  ('Ketokonazol', '200 mg', 'tablet', 200, 'tablet', 'tablet', array['ketokonazol']::text[], 'azol', false, 0, 0, 0, null),
  ('Salbutamol', '2 mg', 'tablet', 2, 'tablet', 'tablet', array['salbutamol']::text[], 'agonis beta-2', false, 0, 0, 0, null),
  ('Loratadin', '10 mg', 'tablet', 10, 'tablet', 'tablet', array['loratadin']::text[], 'antihistamin generasi 2', false, 0, 0, 0, null),
  ('Metilprednisolon', '4 mg', 'tablet', 4, 'tablet', 'tablet', array['metilprednisolon']::text[], 'kortikosteroid', false, 0, 0, 0, null),
  ('Dekstrometorfan', '15 mg', 'tablet', 15, 'tablet', 'tablet', array['dekstrometorfan']::text[], 'antitusif', false, 0, 0, 0, null),
  ('Lansoprazol', '30 mg', 'kapsul', 30, 'kapsul', 'kapsul', array['lansoprazol']::text[], 'ppi', false, 0, 0, 0, null),
  ('Famotidin', '20 mg', 'tablet', 20, 'tablet', 'tablet', array['famotidin']::text[], 'h2 blocker', false, 0, 0, 0, null),
  ('Ondansetron', '4 mg', 'tablet', 4, 'tablet', 'tablet', array['ondansetron']::text[], 'antiemetik', false, 0, 0, 0, null),
  ('Loperamid', '2 mg', 'kapsul', 2, 'kapsul', 'kapsul', array['loperamid']::text[], 'antidiare', false, 0, 0, 0, null),
  ('Hiosin butilbromida', '10 mg', 'tablet', 10, 'tablet', 'tablet', array['hiosin butilbromida']::text[], 'antispasmodik', false, 0, 0, 0, null),
  ('Kaptopril', '25 mg', 'tablet', 25, 'tablet', 'tablet', array['kaptopril']::text[], 'ace inhibitor', false, 0, 0, 0, null),
  ('Lisinopril', '10 mg', 'tablet', 10, 'tablet', 'tablet', array['lisinopril']::text[], 'ace inhibitor', false, 0, 0, 0, null),
  ('Valsartan', '80 mg', 'tablet', 80, 'tablet', 'tablet', array['valsartan']::text[], 'arb', false, 0, 0, 0, null),
  ('Telmisartan', '40 mg', 'tablet', 40, 'tablet', 'tablet', array['telmisartan']::text[], 'arb', false, 0, 0, 0, null),
  ('Bisoprolol', '5 mg', 'tablet', 5, 'tablet', 'tablet', array['bisoprolol']::text[], 'penyekat beta', false, 0, 0, 0, null),
  ('Furosemid', '40 mg', 'tablet', 40, 'tablet', 'tablet', array['furosemid']::text[], 'diuretik loop', false, 0, 0, 0, null),
  ('Hidroklorotiazid', '25 mg', 'tablet', 25, 'tablet', 'tablet', array['hidroklorotiazid']::text[], 'diuretik tiazid', false, 0, 0, 0, null),
  ('Spironolakton', '25 mg', 'tablet', 25, 'tablet', 'tablet', array['spironolakton']::text[], 'diuretik hemat kalium', false, 0, 0, 0, null),
  ('Simvastatin', '20 mg', 'tablet', 20, 'tablet', 'tablet', array['simvastatin']::text[], 'statin', false, 0, 0, 0, null),
  ('Atorvastatin', '20 mg', 'tablet', 20, 'tablet', 'tablet', array['atorvastatin']::text[], 'statin', false, 0, 0, 0, null),
  ('Glimepirid', '2 mg', 'tablet', 2, 'tablet', 'tablet', array['glimepirid']::text[], 'sulfonilurea', false, 0, 0, 0, null),
  ('Glibenklamid', '5 mg', 'tablet', 5, 'tablet', 'tablet', array['glibenklamid']::text[], 'sulfonilurea', false, 0, 0, 0, null),
  ('Warfarin', '2 mg', 'tablet', 2, 'tablet', 'tablet', array['warfarin']::text[], 'antikoagulan', false, 0, 0, 0, null),
  ('Asetosal', '80 mg', 'tablet', 80, 'tablet', 'tablet', array['asetosal']::text[], 'antiplatelet', false, 0, 0, 0, null),
  ('Klopidogrel', '75 mg', 'tablet', 75, 'tablet', 'tablet', array['klopidogrel']::text[], 'antiplatelet', false, 0, 0, 0, null),
  ('Digoksin', '0,25 mg', 'tablet', 0.25, 'tablet', 'tablet', array['digoksin']::text[], 'glikosida jantung', false, 0, 0, 0, null),
  ('Isosorbid dinitrat', '5 mg', 'tablet', 5, 'tablet', 'tablet', array['isosorbid dinitrat']::text[], 'nitrat', false, 0, 0, 0, null),
  ('Allopurinol', '100 mg', 'tablet', 100, 'tablet', 'tablet', array['allopurinol']::text[], 'penghambat xantin oksidase', false, 0, 0, 0, null),
  ('Kolkisin', '0,5 mg', 'tablet', 0.5, 'tablet', 'tablet', array['kolkisin']::text[], 'antigout', false, 0, 0, 0, null),
  ('Alprazolam', '0,5 mg', 'tablet', 0.5, 'tablet', 'tablet', array['alprazolam']::text[], 'benzodiazepin', false, 0, 0, 0, null),
  ('Diazepam', '5 mg', 'tablet', 5, 'tablet', 'tablet', array['diazepam']::text[], 'benzodiazepin', false, 0, 0, 0, null),
  ('Amitriptilin', '25 mg', 'tablet', 25, 'tablet', 'tablet', array['amitriptilin']::text[], 'antidepresan trisiklik', false, 0, 0, 0, null),
  ('Sertralin', '50 mg', 'tablet', 50, 'tablet', 'tablet', array['sertralin']::text[], 'ssri', false, 0, 0, 0, null),
  ('Betahistin', '6 mg', 'tablet', 6, 'tablet', 'tablet', array['betahistin']::text[], 'antivertigo', false, 0, 0, 0, null),
  ('Metokarbamol', '500 mg', 'tablet', 500, 'tablet', 'tablet', array['metokarbamol']::text[], 'relaksan otot', false, 0, 0, 0, null),
  ('Eperison', '50 mg', 'tablet', 50, 'tablet', 'tablet', array['eperison']::text[], 'relaksan otot sentral', false, 0, 0, 0, null),
  ('Kalium klorida', '600 mg', 'tablet', null, 'tablet', 'tablet', array['kalium klorida']::text[], 'suplemen kalium', false, 0, 0, 0, null),
  ('Sulfas ferosus', '300 mg', 'tablet', null, 'tablet', 'tablet', array['sulfas ferosus']::text[], 'zat besi', false, 0, 0, 0, null)
on conflict (nama, kekuatan, sediaan) do nothing;

insert into public.drug_interactions (kunci_a, kunci_b, tingkat, keterangan) values
  ('warfarin', 'nsaid', 'berat', 'Risiko perdarahan (terutama saluran cerna) meningkat.'),
  ('warfarin', 'asetosal', 'berat', 'Risiko perdarahan meningkat.'),
  ('warfarin', 'klopidogrel', 'berat', 'Risiko perdarahan meningkat.'),
  ('warfarin', 'metronidazol', 'berat', 'INR dapat naik tajam; risiko perdarahan.'),
  ('warfarin', 'kotrimoksazol', 'berat', 'INR dapat naik tajam; risiko perdarahan.'),
  ('warfarin', 'azol', 'berat', 'Efek warfarin meningkat; risiko perdarahan.'),
  ('warfarin', 'makrolida', 'sedang', 'Efek warfarin dapat meningkat; pantau INR.'),
  ('warfarin', 'kuinolon', 'sedang', 'Efek warfarin dapat meningkat; pantau INR.'),
  ('warfarin', 'amoksisilin', 'sedang', 'INR dapat meningkat; pantau.'),
  ('warfarin', 'allopurinol', 'sedang', 'Efek warfarin dapat meningkat.'),
  ('warfarin', 'tetrasiklin', 'sedang', 'Efek warfarin dapat meningkat.'),
  ('warfarin', 'ssri', 'sedang', 'Risiko perdarahan meningkat.'),
  ('warfarin', 'kortikosteroid', 'sedang', 'Perubahan INR dan risiko perdarahan saluran cerna.'),
  ('warfarin', 'paracetamol', 'ringan', 'Pemakaian rutin dosis tinggi dapat menaikkan INR.'),
  ('warfarin', 'statin', 'ringan', 'INR dapat berubah ringan; pantau.'),
  ('warfarin', 'sefalosporin', 'ringan', 'INR dapat meningkat; pantau.'),
  ('warfarin', 'omeprazol', 'ringan', 'Efek warfarin dapat sedikit meningkat.'),
  ('nsaid', 'asetosal', 'sedang', 'Risiko perdarahan lambung meningkat; NSAID dapat mengurangi efek pelindung jantung asetosal.'),
  ('nsaid', 'klopidogrel', 'sedang', 'Risiko perdarahan meningkat.'),
  ('nsaid', 'kortikosteroid', 'sedang', 'Risiko tukak dan perdarahan lambung meningkat.'),
  ('nsaid', 'ace inhibitor', 'sedang', 'Efek penurun tekanan darah berkurang; risiko gangguan ginjal.'),
  ('nsaid', 'arb', 'sedang', 'Efek penurun tekanan darah berkurang; risiko gangguan ginjal.'),
  ('nsaid', 'diuretik loop', 'sedang', 'Efek diuretik berkurang; risiko gangguan ginjal.'),
  ('nsaid', 'diuretik tiazid', 'sedang', 'Efek diuretik berkurang; risiko gangguan ginjal.'),
  ('nsaid', 'diuretik hemat kalium', 'sedang', 'Risiko gangguan ginjal dan kalium tinggi.'),
  ('nsaid', 'penyekat beta', 'ringan', 'Efek penurun tekanan darah dapat berkurang.'),
  ('nsaid', 'ssri', 'sedang', 'Risiko perdarahan saluran cerna meningkat.'),
  ('nsaid', 'nsaid', 'sedang', 'Duplikasi golongan NSAID: efek samping bertambah tanpa manfaat tambahan.'),
  ('nsaid', 'kuinolon', 'sedang', 'Risiko kejang meningkat.'),
  ('ace inhibitor', 'suplemen kalium', 'berat', 'Risiko kalium darah tinggi (hiperkalemia).'),
  ('ace inhibitor', 'diuretik hemat kalium', 'berat', 'Risiko kalium darah tinggi (hiperkalemia).'),
  ('arb', 'suplemen kalium', 'berat', 'Risiko kalium darah tinggi (hiperkalemia).'),
  ('arb', 'diuretik hemat kalium', 'berat', 'Risiko kalium darah tinggi (hiperkalemia).'),
  ('diuretik hemat kalium', 'suplemen kalium', 'berat', 'Risiko kalium darah tinggi (hiperkalemia).'),
  ('ace inhibitor', 'arb', 'sedang', 'Kombinasi menambah risiko kalium tinggi dan gangguan ginjal.'),
  ('ace inhibitor', 'kotrimoksazol', 'sedang', 'Risiko kalium darah tinggi.'),
  ('arb', 'kotrimoksazol', 'sedang', 'Risiko kalium darah tinggi.'),
  ('ace inhibitor', 'diuretik loop', 'ringan', 'Tekanan darah dapat turun tajam pada dosis awal.'),
  ('ace inhibitor', 'diuretik tiazid', 'ringan', 'Tekanan darah dapat turun tajam pada dosis awal.'),
  ('ace inhibitor', 'allopurinol', 'ringan', 'Risiko reaksi alergi meningkat.'),
  ('ace inhibitor', 'ace inhibitor', 'sedang', 'Duplikasi golongan penghambat ACE.'),
  ('arb', 'arb', 'sedang', 'Duplikasi golongan penghambat reseptor angiotensin.'),
  ('diuretik loop', 'digoksin', 'sedang', 'Kalium rendah dapat memicu keracunan digoksin.'),
  ('diuretik tiazid', 'digoksin', 'sedang', 'Kalium rendah dapat memicu keracunan digoksin.'),
  ('diuretik loop', 'kortikosteroid', 'ringan', 'Risiko kalium rendah.'),
  ('diuretik tiazid', 'kortikosteroid', 'ringan', 'Risiko kalium rendah.'),
  ('diuretik tiazid', 'allopurinol', 'sedang', 'Risiko reaksi hipersensitivitas meningkat.'),
  ('agonis beta-2', 'diuretik loop', 'ringan', 'Risiko kalium rendah.'),
  ('digoksin', 'spironolakton', 'ringan', 'Kadar digoksin dapat naik.'),
  ('digoksin', 'antasida', 'ringan', 'Penyerapan digoksin berkurang; beri jarak waktu.'),
  ('digoksin', 'penyekat beta', 'sedang', 'Denyut jantung dapat terlalu lambat.'),
  ('digoksin', 'klaritromisin', 'sedang', 'Kadar digoksin naik; risiko keracunan.'),
  ('simvastatin', 'klaritromisin', 'berat', 'Risiko kerusakan otot (rabdomiolisis); hindari.'),
  ('simvastatin', 'azol', 'berat', 'Risiko kerusakan otot (rabdomiolisis); hindari/pertimbangkan alternatif.'),
  ('simvastatin', 'amlodipin', 'sedang', 'Dosis simvastatin sebaiknya tidak lebih dari 20 mg/hari.'),
  ('atorvastatin', 'klaritromisin', 'sedang', 'Kadar statin naik; risiko nyeri/kerusakan otot.'),
  ('atorvastatin', 'azol', 'sedang', 'Kadar statin naik; risiko nyeri/kerusakan otot.'),
  ('statin', 'kolkisin', 'ringan', 'Risiko nyeri/kerusakan otot.'),
  ('statin', 'statin', 'sedang', 'Duplikasi golongan statin.'),
  ('sulfonilurea', 'kuinolon', 'sedang', 'Gula darah dapat turun atau naik tak terduga.'),
  ('sulfonilurea', 'sulfonamida', 'sedang', 'Risiko gula darah rendah (hipoglikemia).'),
  ('sulfonilurea', 'azol', 'sedang', 'Risiko gula darah rendah (hipoglikemia).'),
  ('sulfonilurea', 'penyekat beta', 'ringan', 'Gejala gula darah rendah dapat tersamarkan.'),
  ('sulfonilurea', 'kortikosteroid', 'ringan', 'Efek penurun gula darah berkurang.'),
  ('biguanid', 'kortikosteroid', 'ringan', 'Efek penurun gula darah berkurang.'),
  ('sulfonilurea', 'sulfonilurea', 'sedang', 'Duplikasi golongan sulfonilurea: risiko gula darah rendah.'),
  ('klaritromisin', 'ccb', 'sedang', 'Kadar penghambat kanal kalsium naik; tekanan darah dapat turun.'),
  ('klaritromisin', 'benzodiazepin', 'sedang', 'Efek sedasi meningkat.'),
  ('klaritromisin', 'kolkisin', 'berat', 'Risiko keracunan kolkisin; hindari.'),
  ('makrolida', 'domperidon', 'berat', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('makrolida', 'ondansetron', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('kuinolon', 'makrolida', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('kuinolon', 'antasida', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak minimal 2 jam.'),
  ('kuinolon', 'zinc', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak minimal 2 jam.'),
  ('kuinolon', 'zat besi', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak minimal 2 jam.'),
  ('kuinolon', 'kortikosteroid', 'sedang', 'Risiko radang/putusnya tendon meningkat.'),
  ('kuinolon', 'antidepresan trisiklik', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('makrolida', 'antidepresan trisiklik', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('tetrasiklin', 'antasida', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak 2-3 jam.'),
  ('tetrasiklin', 'zinc', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak 2-3 jam.'),
  ('tetrasiklin', 'zat besi', 'sedang', 'Penyerapan antibiotik berkurang; beri jarak 2-3 jam.'),
  ('penisilin', 'tetrasiklin', 'ringan', 'Efek antibiotik penisilin dapat berkurang.'),
  ('allopurinol', 'penisilin', 'ringan', 'Risiko ruam kulit meningkat.'),
  ('ketokonazol', 'ppi', 'sedang', 'Penyerapan ketokonazol berkurang.'),
  ('ketokonazol', 'antasida', 'sedang', 'Penyerapan ketokonazol berkurang; beri jarak 2 jam.'),
  ('ketokonazol', 'h2 blocker', 'sedang', 'Penyerapan ketokonazol berkurang.'),
  ('azol', 'benzodiazepin', 'sedang', 'Efek sedasi meningkat.'),
  ('azol', 'kortikosteroid', 'ringan', 'Kadar kortikosteroid dapat naik.'),
  ('domperidon', 'azol', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('domperidon', 'ketokonazol', 'berat', 'Risiko gangguan irama jantung (perpanjangan QT); hindari.'),
  ('domperidon', 'ondansetron', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('domperidon', 'antidepresan trisiklik', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('ondansetron', 'kuinolon', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('ondansetron', 'antidepresan trisiklik', 'sedang', 'Risiko gangguan irama jantung (perpanjangan QT).'),
  ('ondansetron', 'ssri', 'sedang', 'Risiko sindrom serotonin dan gangguan irama jantung.'),
  ('penisilin', 'penisilin', 'sedang', 'Duplikasi golongan penisilin.'),
  ('sefalosporin', 'sefalosporin', 'sedang', 'Duplikasi golongan sefalosporin.'),
  ('makrolida', 'makrolida', 'sedang', 'Duplikasi golongan makrolida.'),
  ('kuinolon', 'kuinolon', 'sedang', 'Duplikasi golongan kuinolon.'),
  ('benzodiazepin', 'antihistamin generasi 1', 'sedang', 'Efek kantuk dan sedasi bertambah.'),
  ('benzodiazepin', 'antidepresan trisiklik', 'sedang', 'Efek sedasi bertambah.'),
  ('benzodiazepin', 'relaksan otot', 'sedang', 'Efek sedasi dan risiko jatuh bertambah.'),
  ('benzodiazepin', 'benzodiazepin', 'sedang', 'Duplikasi golongan benzodiazepin.'),
  ('benzodiazepin', 'dekstrometorfan', 'ringan', 'Efek kantuk bertambah.'),
  ('diazepam', 'omeprazol', 'sedang', 'Kadar diazepam dapat naik; efek sedasi lebih lama.'),
  ('antihistamin generasi 1', 'relaksan otot', 'sedang', 'Efek kantuk dan sedasi bertambah.'),
  ('antihistamin generasi 1', 'antidepresan trisiklik', 'sedang', 'Efek antikolinergik bertambah (mulut kering, sulit BAK, bingung).'),
  ('antihistamin generasi 1', 'antihistamin generasi 2', 'ringan', 'Duplikasi antihistamin.'),
  ('antihistamin generasi 2', 'antihistamin generasi 2', 'ringan', 'Duplikasi antihistamin.'),
  ('antihistamin generasi 1', 'antihistamin generasi 1', 'ringan', 'Duplikasi antihistamin: kantuk bertambah.'),
  ('betahistin', 'antihistamin generasi 1', 'ringan', 'Efek betahistin dapat berkurang.'),
  ('ssri', 'antidepresan trisiklik', 'sedang', 'Kadar antidepresan trisiklik naik; risiko sindrom serotonin.'),
  ('ssri', 'antiplatelet', 'sedang', 'Risiko perdarahan meningkat.'),
  ('dekstrometorfan', 'ssri', 'sedang', 'Risiko sindrom serotonin.'),
  ('dekstrometorfan', 'antidepresan trisiklik', 'sedang', 'Risiko sindrom serotonin dan efek samping bertambah.'),
  ('penyekat beta', 'agonis beta-2', 'sedang', 'Saling melemahkan; hati-hati pada penderita asma.'),
  ('penyekat beta', 'verapamil', 'berat', 'Denyut jantung dapat sangat lambat.'),
  ('penyekat beta', 'diltiazem', 'sedang', 'Denyut jantung dapat terlalu lambat.'),
  ('nitrat', 'sildenafil', 'berat', 'Tekanan darah dapat turun drastis; hindari.'),
  ('nitrat', 'tadalafil', 'berat', 'Tekanan darah dapat turun drastis; hindari.'),
  ('klopidogrel', 'omeprazol', 'sedang', 'Efek klopidogrel dapat berkurang; pertimbangkan pantoprazol.'),
  ('asetosal', 'kortikosteroid', 'sedang', 'Risiko tukak dan perdarahan lambung meningkat.'),
  ('allopurinol', 'kolkisin', 'ringan', 'Dapat dipakai bersama; pantau efek samping.'),
  ('kolkisin', 'azol', 'sedang', 'Risiko keracunan kolkisin.'),
  ('zat besi', 'antasida', 'ringan', 'Penyerapan zat besi berkurang; beri jarak 2 jam.'),
  ('ppi', 'ppi', 'ringan', 'Duplikasi obat penekan asam lambung.'),
  ('ppi', 'h2 blocker', 'ringan', 'Duplikasi obat penekan asam lambung.'),
  ('paracetamol', 'paracetamol', 'sedang', 'Duplikasi paracetamol: awasi total dosis harian.')
on conflict do nothing;

insert into public.drug_dose_rules (zat_aktif, anak_min_mg_kg_hari, anak_maks_mg_kg_hari, dewasa_maks_mg_hari, catatan) values
  ('paracetamol', 30, 60, 4000, 'Anak: 10-15 mg/kg/kali, maksimum 60 mg/kg/hari.'),
  ('ibuprofen', 15, 40, 2400, 'Anak: 5-10 mg/kg/kali, maksimum 40 mg/kg/hari.'),
  ('amoksisilin', 25, 90, 3000, 'Anak: 25-50 mg/kg/hari; dosis tinggi sampai 90 mg/kg/hari.'),
  ('sefiksim', 6, 10, 400, 'Anak: sekitar 8 mg/kg/hari.'),
  ('sefadroksil', 25, 50, 2000, 'Anak: 25-50 mg/kg/hari.'),
  ('azitromisin', 5, 12, 500, 'Anak: sekitar 10 mg/kg sekali sehari.'),
  ('ambroksol', 1, 2, 120, 'Anak: sekitar 1,2-1,6 mg/kg/hari.'),
  ('asam mefenamat', null, null, 1500, null),
  ('natrium diklofenak', null, null, 150, null),
  ('meloxicam', null, null, 15, null),
  ('cetirizine', null, null, 10, null),
  ('klorfeniramin', null, null, 24, null),
  ('domperidon', null, null, 30, null),
  ('loperamid', null, null, 16, null),
  ('dekstrometorfan', null, null, 120, null),
  ('amlodipin', null, null, 10, null)
on conflict (zat_aktif) do nothing;

insert into public.drug_geriatric_alerts (kunci, saran) values
  ('benzodiazepin', 'Hindari pada lansia: risiko jatuh, patah tulang, kebingungan, dan gangguan ingatan.'),
  ('antihistamin generasi 1', 'Hindari pada lansia: efek antikolinergik kuat (bingung, sulit BAK, sembelit). Pilih antihistamin generasi 2.'),
  ('antidepresan trisiklik', 'Hindari pada lansia: antikolinergik, kantuk, dan tekanan darah turun saat berdiri.'),
  ('nsaid', 'Hati-hati/hindari pemakaian lama pada lansia: perdarahan saluran cerna, gangguan ginjal, tekanan darah naik.'),
  ('sulfonilurea', 'Hindari bila ada alternatif: risiko gula darah rendah berkepanjangan.'),
  ('relaksan otot', 'Hindari pada lansia: kantuk, risiko jatuh, manfaat terbatas.'),
  ('metoklopramid', 'Hindari kecuali ada indikasi jelas: efek samping gerakan tak terkendali.'),
  ('digoksin', 'Dosis lebih dari 0,125 mg/hari sebaiknya dihindari pada lansia.'),
  ('ppi', 'Pemakaian lebih dari 8 minggu tanpa indikasi jelas sebaiknya dihindari (patah tulang, infeksi usus).'),
  ('diuretik hemat kalium', 'Awasi kadar kalium dan fungsi ginjal.'),
  ('glimepirid', 'Sulfonilurea kerja panjang: risiko gula darah rendah lebih besar; pertimbangkan alternatif.'),
  ('glibenklamid', 'Sulfonilurea kerja panjang: risiko gula darah rendah lebih besar; hindari bila ada alternatif.')
on conflict (kunci) do nothing;
