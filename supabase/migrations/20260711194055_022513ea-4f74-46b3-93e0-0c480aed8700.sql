
-- Column: denuncias.owner_id (dono da denúncia; NULL = anônima ou legada)
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS denuncias_owner_id_idx ON public.denuncias(owner_id);

-- Column: movimentos.ipc_publicado
ALTER TABLE public.movimentos
  ADD COLUMN IF NOT EXISTS ipc_publicado boolean NOT NULL DEFAULT false;

-- is_active_staff: EXCLUI 'cidadao' para que não herde permissões de staff.
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id
      AND p.status = 'ativo'
      AND ur.role <> 'cidadao'
  );
$$;

-- handle_new_user: cidadao entra ATIVO; staff continua com fluxo original.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_first BOOLEAN;
  nome_val TEXT;
  matricula_val TEXT;
  tipo_val TEXT;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO is_first;

  tipo_val := COALESCE(NEW.raw_user_meta_data->>'tipo', 'staff');
  nome_val := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  matricula_val := COALESCE(NEW.raw_user_meta_data->>'matricula', '');

  IF tipo_val = 'cidadao' THEN
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, '', 'ativo'::public.profile_status);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cidadao');
  ELSE
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (
      NEW.id, nome_val, matricula_val,
      CASE WHEN is_first THEN 'ativo'::public.profile_status
           ELSE 'pendente'::public.profile_status END
    );
    IF is_first THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delegado_corregedor');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remove a política antiga que expunha todas as denúncias.
DROP POLICY IF EXISTS "Anyone can view denuncia after insert" ON public.denuncias;

-- Denúncias: cidadão só lê as próprias.
DROP POLICY IF EXISTS "Cidadão lê próprias denúncias" ON public.denuncias;
CREATE POLICY "Cidadão lê próprias denúncias"
  ON public.denuncias FOR SELECT
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid());

-- Denúncias: cidadão cria denúncia própria com owner_id = ele.
DROP POLICY IF EXISTS "Cidadão cria denúncia própria" ON public.denuncias;
CREATE POLICY "Cidadão cria denúncia própria"
  ON public.denuncias FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Movimentos: cidadão só vê IPC publicado das próprias denúncias.
DROP POLICY IF EXISTS "Cidadão lê IPC publicado das próprias denúncias" ON public.movimentos;
CREATE POLICY "Cidadão lê IPC publicado das próprias denúncias"
  ON public.movimentos FOR SELECT
  TO authenticated
  USING (
    especie = 'ipc'
    AND ipc_publicado = true
    AND EXISTS (
      SELECT 1 FROM public.denuncias d
      WHERE d.id = movimentos.denuncia_id
        AND d.owner_id = auth.uid()
    )
  );
