-- KosherTable Supabase sync schema.
-- Run this once in the Supabase SQL editor for the project used by
-- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

create table if not exists public.koshertable_recipe_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.koshertable_favorite_recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  recipe_id text not null,
  record jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, profile_id, recipe_id)
);

create table if not exists public.koshertable_grocery_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  item_id text not null,
  ingredient_key text not null,
  record jsonb not null,
  checked boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, item_id)
);

create index if not exists koshertable_grocery_items_profile_key_idx
  on public.koshertable_grocery_items (user_id, profile_id, ingredient_key);

create table if not exists public.koshertable_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_recipe_profile_id text,
  updated_at timestamptz not null
);

alter table public.koshertable_recipe_profiles enable row level security;
alter table public.koshertable_favorite_recipes enable row level security;
alter table public.koshertable_grocery_items enable row level security;
alter table public.koshertable_user_preferences enable row level security;

drop policy if exists "profiles are owned by the signed in user" on public.koshertable_recipe_profiles;
create policy "profiles are owned by the signed in user"
  on public.koshertable_recipe_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "favorites are owned by the signed in user" on public.koshertable_favorite_recipes;
create policy "favorites are owned by the signed in user"
  on public.koshertable_favorite_recipes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "groceries are owned by the signed in user" on public.koshertable_grocery_items;
create policy "groceries are owned by the signed in user"
  on public.koshertable_grocery_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "preferences are owned by the signed in user" on public.koshertable_user_preferences;
create policy "preferences are owned by the signed in user"
  on public.koshertable_user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
