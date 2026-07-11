
-- Tabela do quadro de Hierarquia da Corregedoria
CREATE TABLE public.hierarquia_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo TEXT NOT NULL CHECK (grupo IN ('delegado','cupula','investigadores','agentes_classe_especial','agentes')),
  ordem INTEGER NOT NULL DEFAULT 0,
  nome TEXT NOT NULL,
  rg TEXT DEFAULT '',
  edital TEXT DEFAULT '',
  patente TEXT DEFAULT '',
  transferido TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  cargo TEXT DEFAULT 'N/A',
  instrutor TEXT DEFAULT 'N/A',
  promocao TEXT DEFAULT '',
  pad TEXT DEFAULT 'N/A',
  atividade TEXT DEFAULT 'N/A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hierarquia_membros TO authenticated;
GRANT ALL ON public.hierarquia_membros TO service_role;

ALTER TABLE public.hierarquia_membros ENABLE ROW LEVEL SECURITY;

-- Só Delegado Geral, Delegado Corregedor e Corregedor (ativos) podem VER
CREATE POLICY "Hierarquia visível apenas para cúpula interna"
ON public.hierarquia_membros
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor','corregedor')
  )
);

-- Só Delegado Corregedor pode INSERIR/EDITAR/EXCLUIR
CREATE POLICY "Somente Delegado Corregedor edita hierarquia (insert)"
ON public.hierarquia_membros
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.status = 'ativo'
      AND ur.role = 'delegado_corregedor'
  )
);

CREATE POLICY "Somente Delegado Corregedor edita hierarquia (update)"
ON public.hierarquia_membros
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.status = 'ativo'
      AND ur.role = 'delegado_corregedor'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.status = 'ativo'
      AND ur.role = 'delegado_corregedor'
  )
);

CREATE POLICY "Somente Delegado Corregedor edita hierarquia (delete)"
ON public.hierarquia_membros
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.status = 'ativo'
      AND ur.role = 'delegado_corregedor'
  )
);

CREATE OR REPLACE FUNCTION public.touch_hierarquia_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hierarquia_updated_at
BEFORE UPDATE ON public.hierarquia_membros
FOR EACH ROW EXECUTE FUNCTION public.touch_hierarquia_updated_at();

-- Garante que o documento "hierarquia" exista (o quadro substitui o conteúdo em texto).
INSERT INTO public.documentos (id, titulo, conteudo)
VALUES ('hierarquia', 'Hierarquia — Corregedoria', '')
ON CONFLICT (id) DO NOTHING;
