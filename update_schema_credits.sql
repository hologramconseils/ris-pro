-- Mise à jour du schéma pour la gestion des quotas et crédits

-- 1. Table des profils utilisateurs (si non existante)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique,
  is_paid boolean default false,
  analysis_credits integer default 0,
  stripe_customer_id text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Activer RLS sur profiles
alter table public.profiles enable row level security;

create policy "Les utilisateurs peuvent voir leur propre profil"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Les utilisateurs peuvent mettre à jour leur propre profil"
  on public.profiles for update
  using ( auth.uid() = id );

-- 3. Mise à jour de la table analyses
alter table public.analyses add column if not exists user_email text;
alter table public.analyses add column if not exists nir_hash text;
alter table public.analyses add column if not exists user_id uuid references auth.users(id);

-- Index pour la recherche par NIR (RGPD : on ne stocke que le hash)
create index if not exists idx_analyses_nir_hash on public.analyses(nir_hash);
create index if not exists idx_analyses_user_id on public.analyses(user_id);

-- 4. Fonction pour décrémenter les crédits (sécurisée côté serveur)
create or replace function public.decrement_analysis_credits(user_uuid uuid)
returns void as $$
begin
  update public.profiles
  set analysis_credits = analysis_credits - 1
  where id = user_uuid and analysis_credits > 0;
end;
$$ language plpgsql security definer;
