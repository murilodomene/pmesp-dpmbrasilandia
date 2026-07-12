
CREATE TABLE public.observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome text NOT NULL,
  autor_cargo public.app_role NOT NULL,
  policial_nome text NOT NULL,
  policial_matricula text,
  policial_cargo text,
  policial_unidade text,
  corpo text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacoes TO authenticated;
GRANT ALL ON public.observacoes TO service_role;
ALTER TABLE public.observacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos podem ver observacoes"
  ON public.observacoes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  );
CREATE POLICY "Internos podem criar observacoes"
  ON public.observacoes FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid() AND (
      public.has_role(auth.uid(),'delegado_geral')
      OR public.has_role(auth.uid(),'delegado_corregedor')
      OR public.has_role(auth.uid(),'corregedor')
    )
  );
CREATE POLICY "Internos podem editar observacoes"
  ON public.observacoes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  );
CREATE POLICY "Internos podem excluir observacoes"
  ON public.observacoes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  );

CREATE TRIGGER touch_observacoes_updated_at
  BEFORE UPDATE ON public.observacoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_hierarquia_updated_at();

CREATE INDEX observacoes_matricula_idx ON public.observacoes (policial_matricula);
CREATE INDEX observacoes_nome_idx ON public.observacoes (policial_nome);

CREATE TABLE public.observacao_pads (
  observacao_id uuid NOT NULL REFERENCES public.observacoes(id) ON DELETE CASCADE,
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (observacao_id, denuncia_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observacao_pads TO authenticated;
GRANT ALL ON public.observacao_pads TO service_role;
ALTER TABLE public.observacao_pads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos podem ver observacao_pads"
  ON public.observacao_pads FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  );
CREATE POLICY "Internos podem gerenciar observacao_pads"
  ON public.observacao_pads FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'delegado_geral')
    OR public.has_role(auth.uid(),'delegado_corregedor')
    OR public.has_role(auth.uid(),'corregedor')
  );

CREATE INDEX observacao_pads_denuncia_idx ON public.observacao_pads (denuncia_id);
