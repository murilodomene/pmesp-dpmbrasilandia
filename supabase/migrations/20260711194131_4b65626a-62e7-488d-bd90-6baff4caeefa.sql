
DROP POLICY IF EXISTS "Staff atualiza movimentos" ON public.movimentos;
CREATE POLICY "Staff atualiza movimentos"
  ON public.movimentos FOR UPDATE
  TO authenticated
  USING (public.is_active_staff(auth.uid()))
  WITH CHECK (public.is_active_staff(auth.uid()));
