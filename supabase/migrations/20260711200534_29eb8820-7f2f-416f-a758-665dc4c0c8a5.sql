-- Bloqueio universal de escrita para o cargo MP (restrictive = AND com as demais)
-- Aplicado em todas as tabelas de procedimento. Não altera leitura nem staff.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['denuncias','denuncia_policiais','movimentos','oitivas','documentos','mp_acessos']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "MP nunca insere" ON public.%I
        AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (NOT public.has_role(auth.uid(), 'mp'::public.app_role));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "MP nunca atualiza" ON public.%I
        AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (NOT public.has_role(auth.uid(), 'mp'::public.app_role))
        WITH CHECK (NOT public.has_role(auth.uid(), 'mp'::public.app_role));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "MP nunca deleta" ON public.%I
        AS RESTRICTIVE FOR DELETE TO authenticated
        USING (NOT public.has_role(auth.uid(), 'mp'::public.app_role));
    $f$, t);
  END LOOP;
END $$;