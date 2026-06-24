-- Migration SQL pour Supabase
-- Exécuter ce script dans l'éditeur SQL Supabase (SQL Editor)

CREATE OR REPLACE FUNCTION public.increment_credits(target_user_id UUID, qty INT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.profiles (id, analysis_credits, is_paid)
  VALUES (target_user_id, qty, true)
  ON CONFLICT (id) DO UPDATE
  SET 
    analysis_credits = COALESCE(public.profiles.analysis_credits, 0) + qty,
    is_paid = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explication : SECURITY DEFINER permet à la fonction de s'exécuter avec les privilèges de l'administrateur de la base de données.
-- Cela permet d'outrepasser les règles RLS de manière contrôlée uniquement pour cette action métier critique.

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

