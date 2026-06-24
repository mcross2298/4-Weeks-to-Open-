-- ===========================================================================
-- MC Training — master food database (foods table)
-- Run once in the Supabase SQL editor (or via migration).
-- ---------------------------------------------------------------------------
-- Backs the /food edge function: a unified, owned food library cached from
-- USDA FoodData Central (public domain) and Open Food Facts (ODbL — attribute).
-- Nutritionix is intentionally NOT stored here (its terms forbid caching); if
-- added later it is a live-only layer, never written to this table.
--
-- Macros are stored PER 100 g when basis='100g', or per the labeled serving
-- when basis='serving'. The edge function normalizes both sources to this.
-- ===========================================================================

create extension if not exists pg_trgm;

create table if not exists foods (
  id          bigint generated always as identity primary key,
  barcode     text unique,                 -- GTIN/UPC/EAN; null for generic foods
  name        text not null,
  brand       text,
  source      text not null,               -- 'usda' | 'off'
  source_id   text,                        -- USDA fdcId or OFF product code
  basis       text not null default '100g',-- 'serving' | '100g'
  serving_label text,
  kcal        numeric,
  protein_g   numeric,
  fat_g       numeric,
  carbs_g     numeric,
  updated_at  timestamptz default now(),
  -- full-text search over name + brand (simple config; language-agnostic)
  search tsvector generated always as
    (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(brand,''))) stored
);

create index if not exists foods_search_idx  on foods using gin (search);
create index if not exists foods_name_trgm    on foods using gin (name gin_trgm_ops);
create index if not exists foods_barcode_idx  on foods (barcode);

alter table foods enable row level security;

-- Everyone (incl. logged-out) may READ the library.
drop policy if exists foods_read on foods;
create policy foods_read on foods for select using (true);

-- No anon write policy: inserts/updates happen only from the edge function via
-- the service-role key (which bypasses RLS). Clients can never write here.
