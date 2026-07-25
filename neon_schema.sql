-- =====================================================
-- Schéma Neon pour RIS Pro (migration depuis Supabase)
-- Les IDs utilisateurs viennent de Clerk (format: user_2abc...)
-- À exécuter dans le SQL Editor de console.neon.tech
-- =====================================================

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,                        -- Clerk user ID (ex: user_2abc123)
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT,
  analysis_credits INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des analyses
CREATE TABLE IF NOT EXISTS public.analyses (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,                    -- URL Vercel Blob du fichier PDF
  status TEXT DEFAULT 'pending',              -- pending | processing | done | error
  results JSONB DEFAULT '{}'::jsonb,          -- Résultats de l'analyse IA
  nir_hash TEXT,                              -- Hash anonymisé du NIR (RGPD)
  error_message TEXT,                         -- Message d'erreur si status = error
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON public.analyses(status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Fonction pour incrémenter les crédits d'un utilisateur
CREATE OR REPLACE FUNCTION public.increment_credits(target_user_id TEXT, qty INT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.profiles (id, analysis_credits, is_paid)
  VALUES (target_user_id, qty, true)
  ON CONFLICT (id) DO UPDATE
  SET 
    analysis_credits = COALESCE(public.profiles.analysis_credits, 0) + qty,
    is_paid = true,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Vérification : afficher les tables créées
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
