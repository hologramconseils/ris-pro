-- Migration SQL pour Supabase
-- Exécuter ce script dans l'éditeur SQL Supabase (SQL Editor)

-- Alter column default for analysis_credits to 0
ALTER TABLE public.profiles ALTER COLUMN analysis_credits SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_credits(target_user_id UUID, qty INT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.profiles (id, analysis_credits, is_paid)
  VALUES (target_user_id, qty + 1, true)
  ON CONFLICT (id) DO UPDATE
  SET 
    analysis_credits = COALESCE(public.profiles.analysis_credits, 0) + qty,
    is_paid = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on auth.users insert with 1 initial credit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, analysis_credits, is_paid)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    0, -- 0 crédit initial
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Explication : SECURITY DEFINER permet à la fonction de s'exécuter avec les privilèges de l'administrateur de la base de données.
-- Cela permet d'outrepasser les règles RLS de manière contrôlée uniquement pour cette action métier critique.
-- SÉCURISATION INDISPENSABLE : Révoquer l'exécution de la fonction par le public, anon, et authenticated.
REVOKE EXECUTE ON FUNCTION public.increment_credits(UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_credits(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_credits(UUID, INT) FROM authenticated;

-- Nouvelle fonction pour récupérer l'ID de l'utilisateur par son email (sécurisé via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_to_search TEXT)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = email_to_search LIMIT 1;
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SÉCURISATION INDISPENSABLE : Révoquer l'exécution de la fonction par le public, anon, et authenticated.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM authenticated;

