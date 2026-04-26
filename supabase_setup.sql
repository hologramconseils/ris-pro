-- 1. Créer le bucket de stockage pour les relevés de carrière
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', false);

-- 2. Configurer les politiques de sécurité (RLS) pour le bucket 'documents'
-- Permettre l'insertion anonyme (ou authentifiée si vous ajoutez l'auth plus tard)
create policy "Allow public uploads" 
on storage.objects for insert 
with check ( bucket_id = 'documents' );

-- Note : Par défaut, la lecture et la suppression sont bloquées pour le public,
-- ce qui est sécurisé. Seul votre backend ou un admin pourra les lire/supprimer.

-- 3. Créer une table pour suivre les analyses
create table public.analyses (
  id uuid default gen_random_uuid() primary key,
  file_path text not null,
  status text default 'pending', -- pending, completed, failed
  results jsonb, -- Stocage des anomalies détectées par l'IA
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Activer RLS sur la table analyses
alter table public.analyses enable row level security;

-- Autoriser l'insertion publique
create policy "Allow public insert on analyses" 
on public.analyses for insert 
with check (true);

-- Autoriser la lecture publique (pour que le client récupère ses résultats)
create policy "Allow public select on analyses"
on public.analyses for select
using (true);

-- Autoriser la mise à jour publique (pour que le backend enregistre les résultats)
-- Note: Dans un environnement réel, utilisez la SERVICE_ROLE_KEY côté serveur
create policy "Allow public update on analyses"
on public.analyses for update
using (true)
with check (true);
