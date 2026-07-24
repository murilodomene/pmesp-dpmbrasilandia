CREATE OR REPLACE FUNCTION public.list_ipcs_publicos()
RETURNS TABLE(
  movimento_id uuid,
  denuncia_id uuid,
  criado_em timestamptz,
  prolator_nome text,
  prolator_cargo app_role,
  teor text,
  numero_protocolo text,
  unidade unidade_pc,
  policiais jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.denuncia_id,
    m.criado_em,
    m.prolator_nome,
    m.prolator_cargo,
    m.teor,
    d.numero_protocolo,
    d.unidade,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', dp.id,
        'nome', dp.nome,
        'rg_funcional', dp.rg_funcional
      ) ORDER BY dp.nome)
      FROM public.denuncia_policiais dp
      WHERE dp.denuncia_id = d.id
    ), '[]'::jsonb)
  FROM public.movimentos m
  JOIN public.denuncias d ON d.id = m.denuncia_id
  WHERE m.especie = 'ipc'
    AND m.ipc_publicado = true
    AND m.cancelado_em IS NULL
  ORDER BY m.criado_em DESC;
$$;

REVOKE ALL ON FUNCTION public.list_ipcs_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ipcs_publicos() TO anon, authenticated;