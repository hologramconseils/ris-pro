-- Ajout de la colonne role si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'user';
    END IF;
END
$$;

-- Mise à jour du rôle pour l'administrateur de référence
-- Note : On récupère l'ID depuis la table auth.users
UPDATE public.profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'btsaulnerond@icloud.com'
);
