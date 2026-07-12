
CREATE POLICY "Público envia denúncia anônima"
  ON public.denuncias
  FOR INSERT
  TO anon
  WITH CHECK (owner_id IS NULL);

CREATE POLICY "Público vincula policiais em denúncia anônima"
  ON public.denuncia_policiais
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.denuncias d
      WHERE d.id = denuncia_id AND d.owner_id IS NULL
    )
  );

GRANT INSERT ON public.denuncias TO anon;
GRANT INSERT ON public.denuncia_policiais TO anon;
