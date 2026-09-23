-- =============================================================
-- FACE OFF AGENCIES / EFWA
-- DESIGNER REGISTRATION + PAYMENT DATABASE SETUP
--
-- IMPORTANT FLOW
-- 1. Before payment: ONLY payment metadata is written to payment_receipts.
-- 2. Brand name, email, phone, location and showcase categories are NOT
--    inserted into designer_applications until PayHero/M-Pesa confirms payment.
-- 3. The finalize-designer-application Edge Function will verify that the
--    payment receipt is PAID and that the amount paid matches the server-side
--    calculated showcase fee before inserting the designer application.
-- =============================================================

begin;

-- Required for gen_random_uuid() on Supabase/Postgres.
create extension if not exists pgcrypto;

-- =============================================================
-- 1. PAYMENT RECEIPTS
-- Reuse the payment_receipts table already used by model applications.
-- This keeps the existing generic payhero-callback/check-payment flow usable.
-- No designer personal/application information is stored here before payment.
-- =============================================================

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  external_reference text not null,
  payment_status text not null default 'pending',
  amount_expected integer not null,
  amount_paid integer,
  payment_message text,
  payhero_reference text,
  checkout_request_id text,
  mpesa_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add any columns that may be missing from the existing model-payment table.
alter table public.payment_receipts
  add column if not exists payment_purpose text not null default 'model',
  add column if not exists amount_paid integer,
  add column if not exists payment_message text,
  add column if not exists payhero_reference text,
  add column if not exists checkout_request_id text,
  add column if not exists mpesa_reference text,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Make payment references fast to find and prevent duplicate payment receipts.
create unique index if not exists payment_receipts_external_reference_uidx
  on public.payment_receipts (external_reference);

create index if not exists payment_receipts_status_idx
  on public.payment_receipts (payment_status);

create index if not exists payment_receipts_purpose_idx
  on public.payment_receipts (payment_purpose);

-- Restrict purpose values to the two payment flows currently used.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_receipts_payment_purpose_check'
      and conrelid = 'public.payment_receipts'::regclass
  ) then
    alter table public.payment_receipts
      add constraint payment_receipts_payment_purpose_check
      check (payment_purpose in ('model', 'designer'));
  end if;
end
$$;

-- =============================================================
-- 2. DESIGNER SHOWCASE FEE CALCULATION
--
-- Clothing rule:
--   Ladies Clothes only              = KSh 10,000
--   Men's Clothes only               = KSh 10,000
--   Ladies + Men's Clothes together  = KSh 10,000 total
-- Bags                               = KSh 10,000
-- Shoes                              = KSh 7,500
-- All categories                     = KSh 27,500
-- =============================================================

create or replace function public.designer_showcase_fee(p_showcase text[])
returns integer
language sql
immutable
as $$
  select
      case
        when coalesce(p_showcase, array[]::text[])
             && array['ladies_clothes', 'mens_clothes']::text[]
        then 10000
        else 0
      end
    + case
        when 'bags' = any(coalesce(p_showcase, array[]::text[]))
        then 10000
        else 0
      end
    + case
        when 'shoes' = any(coalesce(p_showcase, array[]::text[]))
        then 7500
        else 0
      end;
$$;

-- =============================================================
-- 3. DESIGNER SERIAL NUMBER
-- Example final serials:
--   EFWA-DES-LC-00001
--   EFWA-DES-MC-BG-00002
--   EFWA-DES-LC-MC-BG-SH-00003
--
-- The official serial is generated in the database after payment,
-- not trusted from the browser.
-- =============================================================

create sequence if not exists public.designer_serial_seq
  start with 1
  increment by 1
  minvalue 1;

create or replace function public.build_designer_serial(p_showcase text[])
returns text
language plpgsql
volatile
as $$
declare
  parts text[] := array[]::text[];
  serial_no bigint;
begin
  if 'ladies_clothes' = any(coalesce(p_showcase, array[]::text[])) then
    parts := array_append(parts, 'LC');
  end if;

  if 'mens_clothes' = any(coalesce(p_showcase, array[]::text[])) then
    parts := array_append(parts, 'MC');
  end if;

  if 'bags' = any(coalesce(p_showcase, array[]::text[])) then
    parts := array_append(parts, 'BG');
  end if;

  if 'shoes' = any(coalesce(p_showcase, array[]::text[])) then
    parts := array_append(parts, 'SH');
  end if;

  if cardinality(parts) = 0 then
    raise exception 'At least one designer showcase category is required.';
  end if;

  serial_no := nextval('public.designer_serial_seq');

  return 'EFWA-DES-' || array_to_string(parts, '-') || '-' || lpad(serial_no::text, 5, '0');
end;
$$;

-- =============================================================
-- 4. DESIGNER APPLICATIONS
-- THIS TABLE IS FOR PAID REGISTRATIONS ONLY.
-- The browser must never insert directly into this table.
-- =============================================================

create table if not exists public.designer_applications (
  id uuid primary key default gen_random_uuid(),

  designer_serial text not null unique,

  brand_name text not null,
  email text not null,
  phone text not null,
  location text not null,

  showcase text[] not null,

  -- Payment amount recorded at finalization.
  amount_paid integer not null,
  payment_status text not null default 'paid',

  external_reference text not null unique,
  payhero_reference text,
  mpesa_reference text,
  paid_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint designer_application_showcase_not_empty
    check (cardinality(showcase) >= 1),

  constraint designer_application_showcase_valid
    check (
      showcase <@ array[
        'ladies_clothes',
        'mens_clothes',
        'bags',
        'shoes'
      ]::text[]
    ),

  constraint designer_application_amount_matches_showcase
    check (amount_paid = public.designer_showcase_fee(showcase)),

  constraint designer_application_paid_only
    check (payment_status = 'paid')
);

create index if not exists designer_applications_email_idx
  on public.designer_applications (lower(email));

create index if not exists designer_applications_phone_idx
  on public.designer_applications (phone);

create index if not exists designer_applications_location_idx
  on public.designer_applications (location);

create index if not exists designer_applications_created_at_idx
  on public.designer_applications (created_at desc);

-- =============================================================
-- 5. DATABASE-LEVEL PAYMENT GATE
-- This is the key protection for your requirement:
-- designer personal/application information cannot be inserted unless a
-- matching designer payment receipt is already confirmed as PAID.
-- =============================================================

create or replace function public.validate_designer_paid_receipt()
returns trigger
language plpgsql
as $$
declare
  receipt public.payment_receipts%rowtype;
  expected_fee integer;
begin
  expected_fee := public.designer_showcase_fee(new.showcase);

  select *
  into receipt
  from public.payment_receipts
  where external_reference = new.external_reference
  limit 1;

  if not found then
    raise exception 'No payment receipt exists for reference %.', new.external_reference;
  end if;

  if receipt.payment_purpose <> 'designer' then
    raise exception 'Payment reference % is not a designer payment.', new.external_reference;
  end if;

  if receipt.payment_status <> 'paid' then
    raise exception 'Payment reference % has not been confirmed as paid.', new.external_reference;
  end if;

  if receipt.amount_expected <> expected_fee then
    raise exception 'Expected payment amount does not match the selected showcase categories.';
  end if;

  if receipt.amount_paid is null or receipt.amount_paid <> expected_fee then
    raise exception 'Confirmed amount paid does not match the required showcase fee.';
  end if;

  -- Payment facts come from the verified receipt, not from the browser.
  new.amount_paid := receipt.amount_paid;
  new.payment_status := 'paid';
  new.payhero_reference := receipt.payhero_reference;
  new.mpesa_reference := receipt.mpesa_reference;
  new.paid_at := coalesce(receipt.paid_at, now());

  return new;
end;
$$;

drop trigger if exists trg_01_validate_designer_payment
  on public.designer_applications;

create trigger trg_01_validate_designer_payment
before insert on public.designer_applications
for each row
execute function public.validate_designer_paid_receipt();

-- =============================================================
-- 6. GENERATE THE OFFICIAL SERIAL AUTOMATICALLY
-- Even if a browser sends a serial number, the database generates its own.
-- =============================================================

create or replace function public.set_designer_serial()
returns trigger
language plpgsql
as $$
begin
  new.designer_serial := public.build_designer_serial(new.showcase);
  return new;
end;
$$;

drop trigger if exists trg_02_set_designer_serial
  on public.designer_applications;

drop trigger if exists trg_set_designer_serial
  on public.designer_applications;

create trigger trg_02_set_designer_serial
before insert on public.designer_applications
for each row
execute function public.set_designer_serial();

-- =============================================================
-- 7. UPDATED_AT TRIGGERS
-- =============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_designer_applications_updated_at
  on public.designer_applications;

create trigger trg_designer_applications_updated_at
before update on public.designer_applications
for each row
execute function public.set_updated_at();

-- Keep payment receipt updated_at current as callback/payment status changes.
drop trigger if exists trg_payment_receipts_updated_at
  on public.payment_receipts;

create trigger trg_payment_receipts_updated_at
before update on public.payment_receipts
for each row
execute function public.set_updated_at();

-- =============================================================
-- 8. ROW LEVEL SECURITY / PUBLIC ACCESS
-- No application or payment-table writes should happen directly from React.
-- Edge Functions use the server/service role and can perform the required work.
-- =============================================================

alter table public.designer_applications enable row level security;
alter table public.payment_receipts enable row level security;

-- Remove direct public/authenticated access.
revoke all on table public.designer_applications from anon, authenticated;
revoke all on table public.payment_receipts from anon, authenticated;
revoke usage, select on sequence public.designer_serial_seq from anon, authenticated;

-- No anon/authenticated RLS policies are intentionally created.
-- Therefore the frontend cannot directly read/write these tables.

commit;

-- =============================================================
-- QUICK VERIFICATION QUERIES
-- Run these separately after the migration if you want to check the setup.
-- =============================================================
-- select public.designer_showcase_fee(array['ladies_clothes']);
-- Expected: 10000
--
-- select public.designer_showcase_fee(array['ladies_clothes','mens_clothes']);
-- Expected: 10000
--
-- select public.designer_showcase_fee(array['bags']);
-- Expected: 10000
--
-- select public.designer_showcase_fee(array['shoes']);
-- Expected: 7500
--
-- select public.designer_showcase_fee(
--   array['ladies_clothes','mens_clothes','bags','shoes']
-- );
-- Expected: 27500
