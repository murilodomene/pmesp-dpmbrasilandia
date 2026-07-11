-- Tabela documentos
CREATE TABLE public.documentos (
  id text PRIMARY KEY,
  titulo text NOT NULL,
  conteudo text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- Leitura: os três cargos ativos
CREATE POLICY "Cargos autorizados leem documentos"
ON public.documentos FOR SELECT
TO authenticated
USING (
  public.is_active_staff(auth.uid())
  AND (
    public.has_role(auth.uid(), 'delegado_geral')
    OR public.has_role(auth.uid(), 'delegado_corregedor')
    OR public.has_role(auth.uid(), 'corregedor')
  )
);

-- Edição: apenas delegados
CREATE POLICY "Delegados editam documentos"
ON public.documentos FOR UPDATE
TO authenticated
USING (public.is_delegado(auth.uid()))
WITH CHECK (public.is_delegado(auth.uid()));

-- Sem policies de INSERT/DELETE => bloqueadas para todos exceto service_role

-- Trigger para manter atualizado_em
CREATE OR REPLACE FUNCTION public.touch_documento_atualizado_em()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documentos_touch
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.touch_documento_atualizado_em();

-- Seed dos quatro registros fixos
INSERT INTO public.documentos (id, titulo, conteudo) VALUES
  ('manual', 'Manual de Procedimentos', E'# Manual de Procedimentos\n\nConteúdo em elaboração.'),
  ('regimento', 'Regimento Interno', E'# Regimento Interno\n\nConteúdo em elaboração.'),
  ('fardamentos', 'Fardamentos', E'# Fardamentos\n\nConteúdo em elaboração.'),
  ('hierarquia', 'Hierarquia', E'# Hierarquia\n\nConteúdo em elaboração.');
