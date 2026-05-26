-- Migration SQL pour Supabase
-- Exécuter ce script dans l'éditeur SQL Supabase (SQL Editor)

CREATE OR REPLACE FUNCTION public.increment_credits(target_user_id UUID, qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET 
    analysis_credits = COALESCE(analysis_credits, 0) + qty,
    is_paid = true
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explication : SECURITY DEFINER permet à la fonction de s'exécuter avec les privilèges de l'administrateur de la base de données.
-- Cela permet d'outrepasser les règles RLS de manière contrôlée uniquement pour cette action métier critique.
