create extension if not exists pgcrypto;

create table if not exists public.user_reviews (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  examiner_name text not null,
  topic text not null,
  transcript text not null default '',
  scores jsonb not null default '{}'::jsonb,
  overall_score numeric(3,1) not null,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists user_reviews_user_name_created_at_idx
  on public.user_reviews (user_name, created_at desc);
