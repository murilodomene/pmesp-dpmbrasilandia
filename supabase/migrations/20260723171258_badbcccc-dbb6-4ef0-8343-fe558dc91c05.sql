
CREATE TABLE public.denuncia_denunciantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  denuncia_id UUID NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  nome TEXT,
  identificador TEXT,
  contato TEXT,
  anonimo BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_por_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_denuncia_denunciantes_denuncia_id ON public.denuncia_denunciantes(denuncia_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.denuncia_denunciantes TO authenticated;
GRANT ALL ON public.denuncia_denunciantes TO service_role;

ALTER TABLE public.denuncia_denunciantes ENABLE ROW LEVEL SECURITY;

-- Staff interno (delegados / corregedor / coordenador) tem controle total.
CREATE POLICY "Staff pode gerenciar denunciantes adicionais"
  ON public.denuncia_denunciantes
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'delegado_geral')
    OR public.has_role(auth.uid(), 'delegado_corregedor')
    OR public.has_role(auth.uid(), 'corregedor')
    OR public.has_role(auth.uid(), 'coordenador')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'delegado_geral')
    OR public.has_role(auth.uid(), 'delegado_corregedor')
    OR public.has_role(auth.uid(), 'corregedor')
    OR public.has_role(auth.uid(), 'coordenador')
  );

-- Ministério Público pode consultar quando tiver acesso ao procedimento.
CREATE POLICY "MP pode ver denunciantes de procedimentos liberados"
  ON public.denuncia_denunciantes
  FOR SELECT
  TO authenticated
  USING (public.mp_tem_acesso(auth.uid(), denuncia_id));

-- Dono do procedimento (denunciante autenticado) pode ver seus próprios.
CREATE POLICY "Owner pode ver denunciantes adicionais do seu procedimento"
  ON public.denuncia_denunciantes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.denuncias d
      WHERE d.id = denuncia_id AND d.owner_id = auth.uid()
    )
  );

CREATE TRIGGER trg_denuncia_denunciantes_updated_at
  BEFORE UPDATE ON public.denuncia_denunciantes
  FOR EACH ROW EXECUTE FUNCTION public.touch_hierarquia_updated_at();
