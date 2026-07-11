
CREATE TABLE IF NOT EXISTS public.pdo_contador (
  ano INTEGER PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0
);
GRANT ALL ON public.pdo_contador TO service_role;

CREATE OR REPLACE FUNCTION public.gerar_numero_pdo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ano_atual INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  proximo INTEGER;
BEGIN
  INSERT INTO public.pdo_contador AS pc (ano, ultimo)
  VALUES (ano_atual, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = pc.ultimo + 1
  RETURNING pc.ultimo INTO proximo;

  RETURN 'PDO 1-' || lpad(proximo::text, 3, '0') || '/' || ano_atual::text;
END;
$$;
REVOKE ALL ON FUNCTION public.gerar_numero_pdo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_numero_pdo() TO service_role;

CREATE TABLE public.pdos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  abordagem_em TIMESTAMPTZ NOT NULL,
  local TEXT NOT NULL,
  vtr_prefixo TEXT,
  vtr_placa TEXT,
  vtr_unidade TEXT,
  equipe JSONB NOT NULL DEFAULT '[]'::jsonb,
  abordados JSONB NOT NULL DEFAULT '[]'::jsonb,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  desfecho TEXT NOT NULL CHECK (desfecho IN ('regular','sanada','gera_procedimento')),
  relato TEXT,
  lavrado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  lavrado_por_nome TEXT NOT NULL,
  lavrado_por_cargo TEXT NOT NULL,
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  procedimento_id UUID REFERENCES public.denuncias(id) ON DELETE SET NULL,
  procedimento_numero TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pdos TO authenticated;
GRANT ALL ON public.pdos TO service_role;

ALTER TABLE public.pdos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê PDOs"
ON public.pdos FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()));

CREATE POLICY "Staff cria PDO"
ON public.pdos FOR INSERT TO authenticated
WITH CHECK (public.is_active_staff(auth.uid()) AND lavrado_por = auth.uid());

CREATE POLICY "Staff atualiza vínculo do PDO"
ON public.pdos FOR UPDATE TO authenticated
USING (public.is_active_staff(auth.uid()))
WITH CHECK (public.is_active_staff(auth.uid()));

-- Blindagem: MP e cidadão nunca acessam PDO.
CREATE POLICY "MP nunca acessa PDO"
ON public.pdos AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT (public.has_role(auth.uid(), 'mp') OR public.has_role(auth.uid(), 'cidadao')))
WITH CHECK (NOT (public.has_role(auth.uid(), 'mp') OR public.has_role(auth.uid(), 'cidadao')));

CREATE INDEX pdos_created_at_idx ON public.pdos (created_at DESC);
CREATE INDEX pdos_numero_idx ON public.pdos (numero);
