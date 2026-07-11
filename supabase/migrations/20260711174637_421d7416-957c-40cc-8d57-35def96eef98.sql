
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('delegado_geral', 'delegado_corregedor', 'corregedor');
CREATE TYPE public.profile_status AS ENUM ('pendente', 'ativo', 'inativo');
CREATE TYPE public.denuncia_status AS ENUM ('recebida','aguardando_analise','em_analise','em_investigacao','concluida','arquivada');
CREATE TYPE public.movimento_especie AS ENUM ('despacho','decisao','ipc','status');
CREATE TYPE public.unidade_pc AS ENUM ('DEIC','CORREGEPOL','DECAP','DHPP','CERCO','GARRA','DENARC','GER','SAT');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  matricula TEXT NOT NULL,
  unidade public.unidade_pc,
  status public.profile_status NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER helpers ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id AND p.status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delegado(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_cargo(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- ============ PROFILES POLICIES ============
-- Ver próprio perfil sempre; staff ativo vê todos; delegados também.
CREATE POLICY "Ver próprio perfil" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_active_staff(auth.uid()));

CREATE POLICY "Inserir próprio perfil" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Editar próprio nome/matricula" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Delegado edita qualquer perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_delegado(auth.uid())) WITH CHECK (public.is_delegado(auth.uid()));

-- ============ USER_ROLES POLICIES ============
CREATE POLICY "Ver cargos (staff ativo)" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_active_staff(auth.uid()));

CREATE POLICY "Delegado gerencia cargos" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_delegado(auth.uid())) WITH CHECK (public.is_delegado(auth.uid()));

-- ============ DENUNCIAS ============
CREATE SEQUENCE IF NOT EXISTS public.protocolo_seq;

CREATE OR REPLACE FUNCTION public.gerar_protocolo()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.protocolo_seq');
  RETURN '#' || lpad(n::text, 6, '0') || '/' || to_char(now(), 'YYYY');
END;
$$;

CREATE TABLE public.denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_protocolo TEXT NOT NULL UNIQUE DEFAULT public.gerar_protocolo(),
  denunciante_nome TEXT,
  denunciante_identificador TEXT,
  denunciante_contato TEXT,
  denunciante_anonimo BOOLEAN NOT NULL DEFAULT false,
  ocorrencia_tipo TEXT,
  ocorrencia_local TEXT,
  ocorrencia_data DATE,
  ocorrencia_hora TIME,
  relato TEXT NOT NULL,
  info_adicional TEXT,
  anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.denuncia_status NOT NULL DEFAULT 'recebida',
  unidade public.unidade_pc,
  obs_internas TEXT,
  obs_denunciante TEXT,
  termo_inicial TIMESTAMPTZ NOT NULL DEFAULT now(),
  acrescimos_dias INTEGER NOT NULL DEFAULT 0,
  interrupcoes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  instaurada_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.denuncias TO authenticated;
GRANT INSERT ON public.denuncias TO anon;
GRANT ALL ON public.denuncias TO service_role;
ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

-- Público pode inserir denúncia (canal público)
CREATE POLICY "Público cria denúncia" ON public.denuncias FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "Autenticado cria denúncia" ON public.denuncias FOR INSERT TO authenticated
  WITH CHECK (true);

-- Staff ativo lê tudo
CREATE POLICY "Staff lê denúncias" ON public.denuncias FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));

-- Staff ativo atualiza
CREATE POLICY "Staff atualiza denúncias" ON public.denuncias FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid())) WITH CHECK (public.is_active_staff(auth.uid()));

-- ============ DENUNCIA_POLICIAIS ============
CREATE TABLE public.denuncia_policiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  rg_funcional TEXT,
  unidade public.unidade_pc,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denuncia_policiais TO authenticated;
GRANT INSERT ON public.denuncia_policiais TO anon;
GRANT ALL ON public.denuncia_policiais TO service_role;
ALTER TABLE public.denuncia_policiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público insere policial denunciado" ON public.denuncia_policiais FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "Autenticado insere policial denunciado" ON public.denuncia_policiais FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Staff lê policiais" ON public.denuncia_policiais FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Staff edita policiais" ON public.denuncia_policiais FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid())) WITH CHECK (public.is_active_staff(auth.uid()));
CREATE POLICY "Staff remove policiais" ON public.denuncia_policiais FOR DELETE TO authenticated
  USING (public.is_active_staff(auth.uid()));

CREATE INDEX ON public.denuncia_policiais(denuncia_id);

-- ============ MOVIMENTOS (INSERT-only) ============
CREATE TABLE public.movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  especie public.movimento_especie NOT NULL,
  teor TEXT NOT NULL,
  prolator_id UUID REFERENCES auth.users(id),
  prolator_nome TEXT NOT NULL,
  prolator_cargo public.app_role NOT NULL,
  interrompe BOOLEAN NOT NULL DEFAULT false,
  prorroga BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.movimentos TO authenticated;
GRANT ALL ON public.movimentos TO service_role;
ALTER TABLE public.movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê movimentos" ON public.movimentos FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Staff insere movimentos" ON public.movimentos FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()) AND prolator_id = auth.uid());
-- Sem UPDATE nem DELETE — bloqueio total (nenhuma policy criada)

CREATE INDEX ON public.movimentos(denuncia_id, criado_em DESC);

-- ============ OITIVAS ============
CREATE TABLE public.oitivas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  identificacao TEXT NOT NULL,
  url TEXT NOT NULL,
  data DATE,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.oitivas TO authenticated;
GRANT ALL ON public.oitivas TO service_role;
ALTER TABLE public.oitivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê oitivas" ON public.oitivas FOR SELECT TO authenticated
  USING (public.is_active_staff(auth.uid()));
CREATE POLICY "Staff insere oitivas" ON public.oitivas FOR INSERT TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));
CREATE POLICY "Staff atualiza oitivas" ON public.oitivas FOR UPDATE TO authenticated
  USING (public.is_active_staff(auth.uid())) WITH CHECK (public.is_active_staff(auth.uid()));

CREATE INDEX ON public.oitivas(denuncia_id);

-- ============ TRIGGER: primeiro usuário vira Delegado Corregedor ativo ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
  nome_val TEXT;
  matricula_val TEXT;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO is_first;

  nome_val := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  matricula_val := COALESCE(NEW.raw_user_meta_data->>'matricula', '');

  INSERT INTO public.profiles (id, nome, matricula, status)
  VALUES (
    NEW.id,
    nome_val,
    matricula_val,
    CASE WHEN is_first THEN 'ativo'::public.profile_status ELSE 'pendente'::public.profile_status END
  );

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delegado_corregedor');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
