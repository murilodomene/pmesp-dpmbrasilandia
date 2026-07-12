UPDATE public.denuncias d
SET unidade = sub.unidade
FROM (
  SELECT DISTINCT ON (denuncia_id) denuncia_id, unidade
  FROM public.denuncia_policiais
  WHERE unidade IS NOT NULL
  ORDER BY denuncia_id, created_at ASC
) sub
WHERE d.id = sub.denuncia_id AND d.unidade IS NULL;