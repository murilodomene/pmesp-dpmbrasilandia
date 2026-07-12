CREATE OR REPLACE FUNCTION public.preencher_unidade_denuncia_por_policial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.unidade IS NOT NULL THEN
    UPDATE public.denuncias
       SET unidade = NEW.unidade
     WHERE id = NEW.denuncia_id
       AND unidade IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS preencher_unidade_denuncia_por_policial ON public.denuncia_policiais;
CREATE TRIGGER preencher_unidade_denuncia_por_policial
AFTER INSERT OR UPDATE OF unidade ON public.denuncia_policiais
FOR EACH ROW
EXECUTE FUNCTION public.preencher_unidade_denuncia_por_policial();

WITH primeira_unidade AS (
  SELECT DISTINCT ON (dp.denuncia_id)
    dp.denuncia_id,
    dp.unidade
  FROM public.denuncia_policiais AS dp
  WHERE dp.unidade IS NOT NULL
  ORDER BY dp.denuncia_id, dp.created_at, dp.id
)
UPDATE public.denuncias AS d
SET unidade = primeira_unidade.unidade
FROM primeira_unidade
WHERE primeira_unidade.denuncia_id = d.id
  AND d.unidade IS NULL;