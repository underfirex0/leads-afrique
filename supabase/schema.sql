-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,                 -- 'ciment_colle' | 'peinture'
  country text,
  city text,
  website text,
  phone text,
  email text,
  director_name text,
  status text default 'discovered',  -- discovered | enriching | enriched | failed
  source_links jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_businesses_status on businesses(status);
create index if not exists idx_businesses_country on businesses(country);

-- avoid exact duplicate names within the same country
alter table businesses
  add constraint businesses_name_country_unique unique (name, country);
