-- Permitir exclusão de PDO apenas para Delegado Corregedor via RLS
DROP POLICY IF EXISTS "PDO deletable by corregedor" ON public.pdos;
CREATE POLICY "PDO deletable by corregedor"
  ON public.pdos
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'delegado_corregedor'));