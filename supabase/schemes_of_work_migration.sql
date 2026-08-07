-- ═══════════════════════════════════════════════════════════════════
-- SCHEMES OF WORK MARKETPLACE — Database Migration
-- ─────────────────────────────────────────────────────────────────
-- Run this ONCE in your Supabase project:
--   Supabase Dashboard → SQL Editor → New Query → paste this whole
--   file → Run.
--
-- This creates:
--   1. A Storage bucket ("schemes-of-work") for the actual PDF files
--   2. Table: schemes_of_work   — catalog of uploaded schemes
--   3. Table: scheme_purchases  — payment/unlock records
--
-- SAFE TO RE-RUN: uses IF NOT EXISTS everywhere, won't duplicate or
-- error if you run it more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 1. STORAGE BUCKET for the PDF files themselves.
--    Private by default — nobody can access a file's URL unless our
--    app code explicitly generates a signed link for it (paid unlock)
--    or the owner dashboard requests it directly.
insert into storage.buckets (id, name, public)
values ('schemes-of-work', 'schemes-of-work', false)
on conflict (id) do nothing;

-- 2. CATALOG TABLE — one row per uploaded scheme of work.
create table if not exists schemes_of_work (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  class_name    text not null,   -- e.g. "Grade 7", "Form 2"
  term          text not null,   -- e.g. "Term 1 2026"
  curriculum    text,            -- e.g. "CBC", "8-4-4" (optional)
  title         text,            -- optional display title override
  storage_path  text not null,   -- path inside the schemes-of-work bucket
  price_system  numeric not null default 40,  -- KES, price for in-system teachers
  price_public  numeric not null default 70,  -- KES, price for public marketplace
  page_count    int,             -- total pages (for display, "12 pages")
  active        boolean not null default true, -- owner can hide without deleting
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_schemes_subject_class on schemes_of_work (subject, class_name);
create index if not exists idx_schemes_active on schemes_of_work (active);

-- 3. PURCHASES TABLE — one row per unlock, whether by a system teacher
--    or a public (no-login) buyer. Buyer identity is phone number,
--    since that's the one thing every buyer has (system teachers too —
--    pulled from their staff profile).
create table if not exists scheme_purchases (
  id              uuid primary key default gen_random_uuid(),
  buyer_phone     text not null,
  buyer_name      text,
  scheme_id       uuid references schemes_of_work(id) on delete set null,
  -- 'TERMLY_ALL' marker below is used instead of a scheme_id for bundle
  -- purchases (school teacher unlocking every subject they teach at once)
  is_termly_bundle boolean not null default false,
  termly_school_id  uuid,        -- which school's teacher (for bundle scope)
  termly_teacher_id text,        -- teacher's staff id (for bundle scope)
  termly_subjects   text[],      -- snapshot of subjects covered by this bundle
  amount_paid     numeric not null,
  payment_ref     text,          -- InstaSend invoice id
  purchased_at    timestamptz not null default now()
);

create index if not exists idx_purchases_phone on scheme_purchases (buyer_phone);
create index if not exists idx_purchases_scheme on scheme_purchases (scheme_id);

-- 4. ROW LEVEL SECURITY — matches the pattern your other tables likely
--    already use (open read/write via the anon key, since this app's
--    security model relies on your own app-level password gates rather
--    than per-row RLS policies). If your project has RLS enabled by
--    default on new tables, these policies open it up the same way.
alter table schemes_of_work enable row level security;
alter table scheme_purchases enable row level security;

drop policy if exists "Allow all on schemes_of_work" on schemes_of_work;
create policy "Allow all on schemes_of_work" on schemes_of_work
  for all using (true) with check (true);

drop policy if exists "Allow all on scheme_purchases" on scheme_purchases;
create policy "Allow all on scheme_purchases" on scheme_purchases
  for all using (true) with check (true);

-- 5. STORAGE POLICIES — allow the app (anon key) to upload/read/delete
--    inside the schemes-of-work bucket. Actual access control (who's
--    allowed to see/download what) is enforced in the app's own code
--    via signed URLs generated only after a verified purchase, or by
--    the password-gated owner dashboard.
drop policy if exists "Allow all on schemes-of-work bucket" on storage.objects;
create policy "Allow all on schemes-of-work bucket" on storage.objects
  for all using (bucket_id = 'schemes-of-work') with check (bucket_id = 'schemes-of-work');
