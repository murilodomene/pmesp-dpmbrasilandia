ALTER TYPE public.movimento_especie ADD VALUE IF NOT EXISTS 'retificacao';

DROP POLICY IF EXISTS "Staff edita policiais" ON public.denuncia_policiais;

CREATE POLICY "Delegados retificam denunciado" ON public.denuncia_policiais
  FOR UPDATE TO authenticated
  USING (public.is_delegado(auth.uid()))
  WITH CHECK (public.is_delegado(auth.uid()));