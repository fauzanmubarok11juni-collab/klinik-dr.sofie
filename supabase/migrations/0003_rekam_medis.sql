-- =====================================================================
-- Iterasi 2: rekam medis (SOAP), tanda vital, diagnosis ICD-10, tindakan
-- Jalankan SETELAH 0001 dan 0002. Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Master diagnosis (ICD-10, subset tersering) ----------
create table if not exists public.diagnoses (
  kode   text primary key,
  nama   text not null,
  bobot  int  not null default 0,          -- urutan awal "sering dipakai"
  aktif  boolean not null default true
);
create index if not exists diagnoses_nama_trgm on public.diagnoses using gin (nama extensions.gin_trgm_ops);
create index if not exists diagnoses_kode_idx  on public.diagnoses (kode text_pattern_ops);

-- ---------- Master tindakan + tarif ----------
create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null unique,
  kategori   text,
  tarif      numeric(12,2) not null default 0 check (tarif >= 0),
  urutan     int not null default 0,
  aktif      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------- SOAP ----------
create table if not exists public.soap_notes (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete cascade,
  subjective   text not null default '',
  objective    text not null default '',
  assessment   text not null default '',
  plan         text not null default '',
  catatan      text not null default '',
  dibuat_oleh  uuid default auth.uid() references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists soap_updated_at on public.soap_notes;
create trigger soap_updated_at before update on public.soap_notes
  for each row execute function public.set_updated_at();

-- ---------- Tanda vital (satu baris per kunjungan) ----------
create table if not exists public.vitals (
  id            uuid primary key default gen_random_uuid(),
  encounter_id  uuid not null unique references public.encounters(id) on delete cascade,
  td_sistolik   smallint     check (td_sistolik  between 40 and 300),
  td_diastolik  smallint     check (td_diastolik between 20 and 200),
  nadi          smallint     check (nadi         between 20 and 300),
  rr            smallint     check (rr           between 5 and 100),
  suhu          numeric(3,1) check (suhu         between 30 and 45),
  spo2          smallint     check (spo2         between 50 and 100),
  bb            numeric(5,2) check (bb           between 0.3 and 400),
  tb            numeric(5,1) check (tb           between 20 and 250),
  lingkar_perut numeric(5,1) check (lingkar_perut between 10 and 300),
  -- IMT/BMI dihitung otomatis oleh database
  bmi numeric(4,1) generated always as (
    case when bb is not null and tb is not null and tb > 0
         then round((bb / power(tb / 100.0, 2))::numeric, 1) end
  ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists vitals_updated_at on public.vitals;
create trigger vitals_updated_at before update on public.vitals
  for each row execute function public.set_updated_at();

-- ---------- Diagnosis & tindakan per kunjungan ----------
create table if not exists public.encounter_diagnoses (
  id             uuid primary key default gen_random_uuid(),
  encounter_id   uuid not null references public.encounters(id) on delete cascade,
  diagnosis_kode text not null references public.diagnoses(kode),
  utama          boolean not null default false,
  catatan        text,
  created_at     timestamptz not null default now(),
  unique (encounter_id, diagnosis_kode)
);
create unique index if not exists enc_dx_utama_uniq on public.encounter_diagnoses (encounter_id) where utama;
create index if not exists enc_dx_kode_idx on public.encounter_diagnoses (diagnosis_kode);

create table if not exists public.encounter_services (
  id           uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  service_id   uuid not null references public.services(id),
  nama         text not null,                              -- salinan nama saat itu
  tarif_satuan numeric(12,2) not null check (tarif_satuan >= 0),  -- salinan tarif saat itu
  jumlah       int not null default 1 check (jumlah between 1 and 99),
  subtotal     numeric(14,2) generated always as (tarif_satuan * jumlah) stored,
  created_at   timestamptz not null default now(),
  unique (encounter_id, service_id)
);

-- ---------- Template SOAP (bawaan sistem + pribadi Dokter) ----------
create table if not exists public.soap_templates (
  id         uuid primary key default gen_random_uuid(),
  kategori   text not null check (kategori in ('umum','anak','lansia')),
  mode       sesi_kode not null,
  nama       text not null default 'Bawaan',
  isi        jsonb not null,
  pemilik    uuid references public.profiles(id) on delete cascade,   -- null = bawaan sistem
  updated_at timestamptz not null default now()
);
create unique index if not exists tpl_bawaan_uniq  on public.soap_templates (kategori, mode) where pemilik is null;
create unique index if not exists tpl_pribadi_uniq on public.soap_templates (pemilik, kategori, mode) where pemilik is not null;

-- ---------- Audit SOAP ----------
-- Autosave menyimpan tiap 5 detik, jadi mencatat setiap simpanan akan membengkakkan audit_logs (kuota gratis).
-- Yang dicatat: pembuatan, penghapusan, dan PERUBAHAN SETELAH kunjungan berstatus Selesai (yang penting secara hukum).
create or replace function public.catat_audit_soap() returns trigger
language plpgsql security definer set search_path = public as $$
declare st status_kunjungan;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama)
    values (auth.uid(), tg_table_name, old.id::text, tg_op, to_jsonb(old));
    return old;
  end if;
  if tg_op = 'INSERT' then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_baru)
    values (auth.uid(), tg_table_name, new.id::text, tg_op, to_jsonb(new));
    return new;
  end if;
  select e.status into st from public.encounters e where e.id = new.encounter_id;
  if st = 'selesai' and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    insert into public.audit_logs (user_id, tabel, record_id, aksi, data_lama, data_baru)
    values (auth.uid(), tg_table_name, new.id::text, tg_op, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end $$;

drop trigger if exists soap_audit on public.soap_notes;
create trigger soap_audit after insert or update or delete on public.soap_notes
  for each row execute function public.catat_audit_soap();

-- ---------- Pencarian diagnosis (autocomplete) ----------
-- Kosong  -> "sering dipakai" (bobot awal + pemakaian nyata).  Berisi -> cocok kode atau nama.
create or replace function public.cari_diagnosis(p_q text, p_limit int default 8)
returns table (kode text, nama text)
language sql stable set search_path = public, extensions as $$
  with k as (
    select trim(coalesce(p_q, '')) as t,
           replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as e
  )
  select d.kode, d.nama
  from public.diagnoses d
  cross join k
  left join (select diagnosis_kode, count(*) as n from public.encounter_diagnoses group by 1) u
         on u.diagnosis_kode = d.kode
  where d.aktif and (
    case when k.t = '' then (d.bobot > 0 or coalesce(u.n, 0) > 0)
         else (d.kode ilike k.e || '%'
               or replace(d.kode, '.', '') ilike replace(k.e, '.', '') || '%'
               or d.nama ilike '%' || k.e || '%')
    end)
  order by (k.t <> '' and d.kode ilike k.e || '%') desc,
           (k.t <> '' and d.nama ilike k.e || '%') desc,
           (d.bobot + coalesce(u.n, 0) * 10) desc, d.kode
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

-- ---------- Simpan seluruh rekam medis sekaligus (atomik) ----------
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

  -- Tindakan: ganti seluruhnya, tetapi tarif yang sudah tercatat untuk kunjungan ini dipertahankan
  select coalesce(jsonb_object_agg(service_id::text, tarif_satuan), '{}'::jsonb) into lama
  from public.encounter_services where encounter_id = p_encounter;
  delete from public.encounter_services where encounter_id = p_encounter;
  insert into public.encounter_services (encounter_id, service_id, nama, tarif_satuan, jumlah)
  select p_encounter, sv.id, sv.nama,
         coalesce((lama->>(sv.id::text))::numeric, sv.tarif),
         greatest(1, least(99, coalesce((e.el->>'jumlah')::int, 1)))
  from jsonb_array_elements(coalesce(p_data->'services', '[]'::jsonb)) as e(el)
  join public.services sv on sv.id = (e.el->>'service_id')::uuid;

  if p_selesai then
    update public.encounters set status = 'selesai' where id = p_encounter;
  elsif stat = 'menunggu' then
    update public.encounters set status = 'diperiksa' where id = p_encounter;
  end if;

  return hasil;
end $$;

revoke all on function public.cari_diagnosis(text, int), public.simpan_rekam_medis(uuid, jsonb, boolean) from public, anon;
grant execute on function public.cari_diagnosis(text, int), public.simpan_rekam_medis(uuid, jsonb, boolean) to authenticated;

-- ---------- Row Level Security ----------
alter table public.diagnoses           enable row level security;
alter table public.services            enable row level security;
alter table public.soap_notes          enable row level security;
alter table public.vitals              enable row level security;
alter table public.encounter_diagnoses enable row level security;
alter table public.encounter_services  enable row level security;
alter table public.soap_templates      enable row level security;

-- Isi klinis (SOAP, vital, diagnosis, template): HANYA Dokter. Asisten tidak bisa membaca maupun menulis.
do $$
declare t text;
begin
  foreach t in array array['soap_notes','vitals','encounter_diagnoses','soap_templates'] loop
    execute format('drop policy if exists %I on public.%I', t || '_dokter', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dokter()) with check (public.is_dokter())', t || '_dokter', t);
  end loop;
end $$;

-- Master diagnosis & tindakan: staf boleh membaca; hanya Dokter boleh mengubah (termasuk tarif).
drop policy if exists diagnoses_select on public.diagnoses;
create policy diagnoses_select on public.diagnoses for select to authenticated using (public.is_staf());
drop policy if exists diagnoses_dokter on public.diagnoses;
create policy diagnoses_dokter on public.diagnoses for all to authenticated using (public.is_dokter()) with check (public.is_dokter());

drop policy if exists services_select on public.services;
create policy services_select on public.services for select to authenticated using (public.is_staf());
drop policy if exists services_dokter on public.services;
create policy services_dokter on public.services for all to authenticated using (public.is_dokter()) with check (public.is_dokter());

-- Tindakan per kunjungan: staf boleh membaca (kasir butuh untuk tagihan), hanya Dokter boleh menulis.
drop policy if exists enc_services_select on public.encounter_services;
create policy enc_services_select on public.encounter_services for select to authenticated using (public.is_staf());
drop policy if exists enc_services_dokter on public.encounter_services;
create policy enc_services_dokter on public.encounter_services for all to authenticated using (public.is_dokter()) with check (public.is_dokter());

revoke all on public.diagnoses, public.services, public.soap_notes, public.vitals,
              public.encounter_diagnoses, public.encounter_services, public.soap_templates from anon;

-- ---------- Data awal ----------
insert into public.diagnoses (kode, nama, bobot) values
  ('J00', 'Nasofaringitis akut (common cold)', 92),
  ('J01.9', 'Sinusitis akut, tidak spesifik', 0),
  ('J02.9', 'Faringitis akut, tidak spesifik', 90),
  ('J03.9', 'Tonsilitis akut, tidak spesifik', 0),
  ('J04.0', 'Laringitis akut', 0),
  ('J05.0', 'Laringitis obstruktif akut (croup)', 0),
  ('J06.9', 'Infeksi saluran napas atas akut (ISPA)', 99),
  ('J18.9', 'Pneumonia, tidak spesifik', 0),
  ('J20.9', 'Bronkitis akut, tidak spesifik', 79),
  ('J21.9', 'Bronkiolitis akut, tidak spesifik', 0),
  ('J30.4', 'Rinitis alergi, tidak spesifik', 0),
  ('J31.0', 'Rinitis kronik', 0),
  ('J32.9', 'Sinusitis kronik, tidak spesifik', 0),
  ('J35.0', 'Tonsilitis kronik', 0),
  ('J40', 'Bronkitis, tidak spesifik', 0),
  ('J44.9', 'Penyakit paru obstruktif kronik (PPOK), tidak spesifik', 0),
  ('J45.9', 'Asma, tidak spesifik', 85),
  ('A01.0', 'Demam tifoid', 0),
  ('A08.4', 'Infeksi usus oleh virus, tidak spesifik', 0),
  ('A09', 'Diare dan gastroenteritis, diduga infeksi', 93),
  ('A16.9', 'Tuberkulosis saluran napas, tidak spesifik', 0),
  ('A90', 'Demam dengue', 0),
  ('A91', 'Demam berdarah dengue', 0),
  ('B01.9', 'Varisela (cacar air) tanpa komplikasi', 0),
  ('B02.9', 'Herpes zoster tanpa komplikasi', 0),
  ('B05.9', 'Campak tanpa komplikasi', 0),
  ('B07', 'Kutil virus', 0),
  ('B26.9', 'Parotitis epidemika (gondongan) tanpa komplikasi', 0),
  ('B34.9', 'Infeksi virus, tidak spesifik', 81),
  ('B35.3', 'Tinea pedis (kutu air)', 0),
  ('B35.4', 'Tinea korporis (kurap)', 0),
  ('B35.6', 'Tinea kruris', 0),
  ('B36.0', 'Pitiriasis versikolor (panu)', 0),
  ('B37.0', 'Stomatitis kandida (sariawan jamur)', 0),
  ('B77.9', 'Askariasis, tidak spesifik', 0),
  ('B80', 'Enterobiasis (cacing kremi)', 0),
  ('B82.9', 'Parasitosis usus (cacingan), tidak spesifik', 0),
  ('B85.0', 'Pedikulosis kapitis (kutu rambut)', 0),
  ('B86', 'Skabies', 0),
  ('D50.9', 'Anemia defisiensi besi, tidak spesifik', 0),
  ('D64.9', 'Anemia, tidak spesifik', 0),
  ('E03.9', 'Hipotiroidisme, tidak spesifik', 0),
  ('E05.9', 'Tirotoksikosis, tidak spesifik', 0),
  ('E10.9', 'Diabetes melitus tipe 1 tanpa komplikasi', 0),
  ('E11.9', 'Diabetes melitus tipe 2 tanpa komplikasi', 97),
  ('E46', 'Malnutrisi energi-protein, tidak spesifik', 0),
  ('E55.9', 'Defisiensi vitamin D, tidak spesifik', 0),
  ('E66.9', 'Obesitas, tidak spesifik', 0),
  ('E78.0', 'Hiperkolesterolemia murni', 0),
  ('E78.5', 'Hiperlipidemia, tidak spesifik', 84),
  ('E86', 'Dehidrasi', 0),
  ('F03', 'Demensia, tidak spesifik', 0),
  ('F32.9', 'Episode depresif, tidak spesifik', 0),
  ('F41.9', 'Gangguan cemas, tidak spesifik', 0),
  ('G40.9', 'Epilepsi, tidak spesifik', 0),
  ('G43.9', 'Migren, tidak spesifik', 0),
  ('G44.2', 'Nyeri kepala tipe tegang', 0),
  ('G47.0', 'Insomnia (gangguan memulai dan mempertahankan tidur)', 0),
  ('G51.0', 'Paresis nervus fasialis (Bell palsy)', 0),
  ('G62.9', 'Polineuropati, tidak spesifik', 0),
  ('H00.0', 'Hordeolum (bintitan)', 0),
  ('H10.9', 'Konjungtivitis, tidak spesifik', 78),
  ('H25.9', 'Katarak senilis, tidak spesifik', 0),
  ('H40.9', 'Glaukoma, tidak spesifik', 0),
  ('H52.7', 'Gangguan refraksi, tidak spesifik', 0),
  ('H60.9', 'Otitis eksterna, tidak spesifik', 0),
  ('H61.2', 'Serumen impaksi (kotoran telinga)', 0),
  ('H66.9', 'Otitis media, tidak spesifik', 0),
  ('H81.1', 'Vertigo posisional paroksismal jinak', 0),
  ('H93.1', 'Tinitus', 0),
  ('I10', 'Hipertensi esensial (primer)', 100),
  ('I11.9', 'Penyakit jantung hipertensif tanpa gagal jantung', 0),
  ('I25.9', 'Penyakit jantung iskemik kronik, tidak spesifik', 0),
  ('I48', 'Fibrilasi dan flutter atrium', 0),
  ('I50.9', 'Gagal jantung, tidak spesifik', 0),
  ('I63.9', 'Infark serebral, tidak spesifik', 0),
  ('I64', 'Stroke, tidak spesifik', 0),
  ('I83.9', 'Varises tungkai tanpa ulkus', 0),
  ('K00.7', 'Sindrom tumbuh gigi', 0),
  ('K02.9', 'Karies gigi, tidak spesifik', 0),
  ('K12.0', 'Stomatitis aftosa berulang (sariawan)', 0),
  ('K21.9', 'Penyakit refluks gastroesofageal (GERD) tanpa esofagitis', 0),
  ('K29.7', 'Gastritis, tidak spesifik', 91),
  ('K30', 'Dispepsia', 98),
  ('K52.9', 'Gastroenteritis dan kolitis non-infeksi, tidak spesifik', 0),
  ('K59.0', 'Konstipasi', 0),
  ('K64.9', 'Hemoroid, tidak spesifik', 0),
  ('K76.0', 'Perlemakan hati', 0),
  ('L01.0', 'Impetigo', 0),
  ('L02.9', 'Abses kulit, furunkel, karbunkel', 0),
  ('L03.9', 'Selulitis, tidak spesifik', 0),
  ('L20.9', 'Dermatitis atopik, tidak spesifik', 0),
  ('L21.9', 'Dermatitis seboroik, tidak spesifik', 0),
  ('L22', 'Dermatitis popok', 0),
  ('L23.9', 'Dermatitis kontak alergi, tidak spesifik', 0),
  ('L29.9', 'Pruritus (gatal), tidak spesifik', 0),
  ('L30.9', 'Dermatitis, tidak spesifik', 89),
  ('L50.9', 'Urtikaria, tidak spesifik', 80),
  ('L60.0', 'Kuku tumbuh ke dalam (ingrown nail)', 0),
  ('L70.0', 'Akne vulgaris (jerawat)', 0),
  ('L74.3', 'Miliaria (biang keringat), tidak spesifik', 0),
  ('L89.9', 'Ulkus dekubitus, tidak spesifik', 0),
  ('M06.9', 'Artritis reumatoid, tidak spesifik', 0),
  ('M10.9', 'Gout (asam urat), tidak spesifik', 83),
  ('M17.9', 'Osteoartritis lutut, tidak spesifik', 0),
  ('M19.9', 'Artrosis, tidak spesifik', 0),
  ('M25.5', 'Nyeri sendi', 0),
  ('M47.9', 'Spondilosis, tidak spesifik', 0),
  ('M54.2', 'Nyeri leher (servikalgia)', 0),
  ('M54.4', 'Nyeri punggung bawah dengan skiatika', 0),
  ('M54.5', 'Nyeri punggung bawah', 96),
  ('M75.0', 'Kapsulitis adhesif bahu (frozen shoulder)', 0),
  ('M79.1', 'Nyeri otot (mialgia)', 86),
  ('M79.6', 'Nyeri anggota gerak', 0),
  ('M81.9', 'Osteoporosis, tidak spesifik', 0),
  ('N18.9', 'Penyakit ginjal kronik, tidak spesifik', 0),
  ('N20.0', 'Batu ginjal', 0),
  ('N30.9', 'Sistitis, tidak spesifik', 0),
  ('N39.0', 'Infeksi saluran kemih, lokasi tidak spesifik', 82),
  ('N40', 'Hiperplasia prostat', 0),
  ('N76.0', 'Vaginitis akut', 0),
  ('N94.6', 'Dismenore, tidak spesifik', 0),
  ('N95.1', 'Keadaan menopause dan klimakterik', 0),
  ('P59.9', 'Ikterus neonatorum, tidak spesifik', 0),
  ('R00.2', 'Palpitasi', 0),
  ('R03.0', 'Tekanan darah tinggi tanpa diagnosis hipertensi', 0),
  ('R04.0', 'Epistaksis (mimisan)', 0),
  ('R05', 'Batuk', 0),
  ('R07.4', 'Nyeri dada, tidak spesifik', 0),
  ('R10.4', 'Nyeri perut, tidak spesifik', 0),
  ('R11', 'Mual dan muntah', 0),
  ('R19.7', 'Diare, tidak spesifik', 0),
  ('R21', 'Ruam kulit', 0),
  ('R29.6', 'Jatuh berulang', 0),
  ('R32', 'Inkontinensia urin, tidak spesifik', 0),
  ('R42', 'Pusing dan rasa melayang', 77),
  ('R50.9', 'Demam, tidak spesifik', 94),
  ('R51', 'Sakit kepala', 95),
  ('R53', 'Malaise dan kelelahan', 0),
  ('R54', 'Usia lanjut (senilitas)', 0),
  ('R55', 'Pingsan (sinkop)', 0),
  ('R56.0', 'Kejang demam', 0),
  ('R62.0', 'Keterlambatan pencapaian tonggak perkembangan', 0),
  ('R73.9', 'Hiperglikemia, tidak spesifik', 0),
  ('S93.4', 'Terkilir pergelangan kaki', 0),
  ('T14.0', 'Cedera superfisial, regio tidak spesifik', 0),
  ('T14.1', 'Luka terbuka, regio tidak spesifik', 0),
  ('T30.0', 'Luka bakar, regio dan derajat tidak spesifik', 0),
  ('T78.4', 'Alergi, tidak spesifik', 0),
  ('Z00.0', 'Pemeriksaan kesehatan umum', 0),
  ('Z00.1', 'Pemeriksaan kesehatan rutin anak', 0),
  ('Z02.7', 'Penerbitan surat keterangan medis', 0),
  ('Z09', 'Pemeriksaan lanjutan (kontrol) setelah pengobatan selesai', 88),
  ('Z76.0', 'Penerbitan resep ulang', 87)
on conflict (kode) do nothing;

-- Tarif di bawah hanya CONTOH. Sesuaikan dengan tarif praktik Anda (lihat README).
insert into public.services (nama, kategori, tarif, urutan) values
  ('Injeksi intramuskular (IM)', 'Tindakan', 25000, 1),
  ('Injeksi intravena (IV)', 'Tindakan', 35000, 2),
  ('Pemasangan infus', 'Tindakan', 75000, 3),
  ('Nebulisasi', 'Tindakan', 60000, 4),
  ('Perawatan luka kecil', 'Luka', 40000, 5),
  ('Perawatan luka sedang', 'Luka', 75000, 6),
  ('Jahit luka (sampai 5 jahitan)', 'Luka', 150000, 7),
  ('Jahit luka (lebih dari 5 jahitan)', 'Luka', 250000, 8),
  ('Angkat jahitan', 'Luka', 40000, 9),
  ('Insisi abses kecil', 'Bedah minor', 150000, 10),
  ('Ekstraksi benda asing (telinga/hidung)', 'Bedah minor', 100000, 11),
  ('Irigasi telinga (serumen)', 'THT', 60000, 12),
  ('EKG', 'Pemeriksaan', 75000, 13),
  ('Cek gula darah', 'Pemeriksaan', 20000, 14),
  ('Cek kolesterol', 'Pemeriksaan', 35000, 15),
  ('Cek asam urat', 'Pemeriksaan', 25000, 16),
  ('Cek hemoglobin', 'Pemeriksaan', 25000, 17),
  ('Pemasangan kateter urin', 'Tindakan', 100000, 18),
  ('Surat keterangan sehat', 'Surat', 30000, 19),
  ('Surat keterangan sakit', 'Surat', 20000, 20)
on conflict (nama) do nothing;

insert into public.soap_templates (kategori, mode, nama, isi) values
  ('umum', 'pagi', 'Bawaan', '{"subjective": "Kontrol. Keluhan saat ini: \nObat diminum teratur: ", "objective": "KU: baik, compos mentis\n", "assessment": "", "plan": "Lanjutkan terapi. Edukasi gaya hidup.\nKontrol kembali: "}'::jsonb),
  ('umum', 'malam', 'Bawaan', '{"subjective": "Keluhan utama: \nOnset / lama: \nFaktor memperberat / memperingan: \nKeluhan penyerta: \nRiwayat penyakit dan obat yang sedang diminum: \nRiwayat alergi: ", "objective": "KU: \nKepala-leher: \nThoraks (paru/jantung): \nAbdomen: \nEkstremitas: ", "assessment": "", "plan": "Terapi: \nEdukasi: \nRencana kontrol / rujukan: "}'::jsonb),
  ('anak', 'pagi', 'Bawaan', '{"subjective": "Keluhan: \nDemam (sejak): \nNafsu makan / minum: \nBAB / BAK: ", "objective": "KU: aktif, tampak sakit ringan\nTHT: \nParu: \nAbdomen: \nKulit: ", "assessment": "", "plan": "Terapi sesuai berat badan.\nEdukasi orang tua: tanda bahaya.\nKontrol bila: "}'::jsonb),
  ('anak', 'malam', 'Bawaan', '{"subjective": "Keluhan utama: \nOnset / lama: \nDemam (sejak, tertinggi): \nBatuk / pilek / sesak: \nMuntah / diare: \nNafsu makan dan minum: \nBAB / BAK: \nKontak sakit / riwayat serupa: \nRiwayat alergi: ", "objective": "KU / kesadaran: \nTHT: \nParu: \nJantung: \nAbdomen: \nKulit: ", "assessment": "", "plan": "Terapi sesuai berat badan: \nEdukasi orang tua (tanda bahaya, cairan, istirahat): \nKontrol bila: "}'::jsonb),
  ('lansia', 'pagi', 'Bawaan', '{"subjective": "Kontrol. Keluhan saat ini: \nObat rutin diminum teratur: \nJatuh dalam 3 bulan terakhir: ", "objective": "KU: \nTD (duduk): ", "assessment": "", "plan": "Lanjutkan terapi. Evaluasi jumlah obat.\nKontrol kembali: "}'::jsonb),
  ('lansia', 'malam', 'Bawaan', '{"subjective": "Keluhan utama: \nOnset / lama: \nKeluhan penyerta: \nObat yang sedang diminum (termasuk obat luar / herbal): \nJatuh / pusing / gangguan tidur: \nNafsu makan / BAB / BAK: \nRiwayat alergi: ", "objective": "KU / kesadaran: \nKepala-leher: \nThoraks (paru/jantung): \nAbdomen: \nEkstremitas / gerak: ", "assessment": "", "plan": "Terapi: \nEdukasi pasien dan pendamping: \nRencana kontrol / rujukan: "}'::jsonb)
on conflict do nothing;
