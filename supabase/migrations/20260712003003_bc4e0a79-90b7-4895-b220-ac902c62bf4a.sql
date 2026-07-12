
-- Permite leitura pública SOMENTE do documento "manual"
GRANT SELECT ON public.documentos TO anon;

CREATE POLICY "Manual público" ON public.documentos
  FOR SELECT
  TO anon, authenticated
  USING (id = 'manual');
