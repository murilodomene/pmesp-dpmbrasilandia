-- Blindar obs_internas contra leitura direta por qualquer role authenticated/anon
REVOKE SELECT (obs_internas) ON public.denuncias FROM authenticated;
REVOKE SELECT (obs_internas) ON public.denuncias FROM anon;

-- Função para staff ler obs_internas de forma controlada
CREATE OR REPLACE FUNCTION public.get_obs_internas(_denuncia_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_active_staff(auth.uid())
      THEN (SELECT d.obs_internas FROM public.denuncias d WHERE d.id = _denuncia_id)
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.get_obs_internas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_obs_internas(uuid) TO authenticated;