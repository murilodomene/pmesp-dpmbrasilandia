-- 1. Cadastro externo do MP: perfil ativo direto, cargo mp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ELSIF tipo_val = 'mp' THEN
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, matricula_val, 'ativo'::public.profile_status);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mp');
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
$function$;

-- 2. Excluir MP de is_active_staff
CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id
      AND p.status = 'ativo'
      AND ur.role NOT IN ('cidadao','mp')
  );
$function$;

-- 3. Tabela mp_acessos
CREATE TABLE public.mp_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  mp_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concedido_por uuid NOT NULL REFERENCES auth.users(id),
  concedido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (denuncia_id, mp_user_id)
);

GRANT SELECT, INSERT, DELETE ON public.mp_acessos TO authenticated;
GRANT ALL ON public.mp_acessos TO service_role;
ALTER TABLE public.mp_acessos ENABLE ROW LEVEL SECURITY;

-- 4. Funções auxiliares
CREATE OR REPLACE FUNCTION public.pode_conceder_mp(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor')
  );
$$;

CREATE OR REPLACE FUNCTION public.mp_tem_acesso(_user_id uuid, _denuncia_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mp_acessos
    WHERE mp_user_id = _user_id AND denuncia_id = _denuncia_id
  );
$$;

REVOKE ALL ON FUNCTION public.pode_conceder_mp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_conceder_mp(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mp_tem_acesso(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mp_tem_acesso(uuid, uuid) TO authenticated;

-- 5. Políticas mp_acessos
CREATE POLICY "Delegados concedem acesso MP"
  ON public.mp_acessos FOR INSERT TO authenticated
  WITH CHECK (public.pode_conceder_mp(auth.uid()) AND concedido_por = auth.uid());

CREATE POLICY "Delegados revogam acesso MP"
  ON public.mp_acessos FOR DELETE TO authenticated
  USING (public.pode_conceder_mp(auth.uid()));

CREATE POLICY "Staff lê acessos MP"
  ON public.mp_acessos FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE POLICY "MP lê próprios acessos"
  ON public.mp_acessos FOR SELECT TO authenticated
  USING (mp_user_id = auth.uid());

-- 6. Políticas SELECT para MP nas tabelas do procedimento
CREATE POLICY "MP lê denuncias concedidas"
  ON public.denuncias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mp') AND public.mp_tem_acesso(auth.uid(), id));

CREATE POLICY "MP lê movimentos de denuncias concedidas"
  ON public.movimentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mp') AND public.mp_tem_acesso(auth.uid(), denuncia_id));

CREATE POLICY "MP lê oitivas de denuncias concedidas"
  ON public.oitivas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mp') AND public.mp_tem_acesso(auth.uid(), denuncia_id));

CREATE POLICY "MP lê policiais de denuncias concedidas"
  ON public.denuncia_policiais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'mp') AND public.mp_tem_acesso(auth.uid(), denuncia_id));

-- 7. Permitir que staff que pode conceder consulte perfis MP para escolher
--    (a policy existente já libera perfil para staff ativo — aqui só garantimos
--    leitura do próprio perfil também para MP).
-- (nenhuma alteração adicional necessária pois "Ver próprio perfil" cobre id = auth.uid())

-- 8. Trigger updated_at n/a (tabela é imutável — não editamos concessões, só criamos/removemos)