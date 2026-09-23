-- ============================================================
-- FACE OFF AGENCIES: PAYHERO + SUPABASE PAYMENT SETUP
-- Run this once in Supabase SQL Editor.
-- ============================================================

-- 1) Payment fields on the final application record.
alter table public.model_applications
  add column if not exists payment_status text,
  add column if not exists amount_paid numeric(10,2),
  add column if not exists payhero_reference text,
  add column if not exists mpesa_reference text,
  add column if not exists external_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists photo_path text;

create unique index if not exists model_applications_external_reference_uidx
  on public.model_applications (external_reference)
  where external_reference is not null;

-- 2) Payment-only receipt table.
-- No applicant name/email/age/location/photo is stored here.
create table if not exists public.payment_receipts (
  external_reference text primary key,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed')),
  amount_expected numeric(10,2) not null default 1000.00,
  amount_paid numeric(10,2),
  payhero_reference text,
  checkout_request_id text,
  mpesa_reference text,
  payment_message text,
  paid_at timestamptz,
  application_id uuid references public.model_applications(id) on delete set null,
  application_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_receipts_payhero_reference_idx
  on public.payment_receipts (payhero_reference);

-- 3) Browser users must NOT be allowed to insert applications directly.
-- Only the finalize-application Edge Function should insert the final record.
alter table public.model_applications enable row level security;

drop policy if exists "Allow public model applications" on public.model_applications;
drop policy if exists "Public can submit model applications" on public.model_applications;
drop policy if exists "public can submit model applications" on public.model_applications;

revoke insert, update, delete on table public.model_applications from anon, authenticated;

-- 4) Payment receipts are server-side only.
alter table public.payment_receipts enable row level security;
revoke all on table public.payment_receipts from anon, authenticated;

-- 5) Keep model photos private and limited to images up to 5 MB.
-- The Edge Function uploads them with the server-side secret key.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'model-photos',
  'model-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 6) Optional check after running this script.
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'model_applications'
order by ordinal_position;
