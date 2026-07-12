CREATE OR REPLACE FUNCTION public.manutencao_limpar_observacoes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _role public.app_role;
  _n int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role IS DISTINCT FROM 'delegado_corregedor'::public.app_role THEN
    RAISE EXCEPTION 'Apenas o Delegado Corregedor pode limpar as observações.';
  END IF;

  SELECT count(*) INTO _n FROM public.observacoes;

  DELETE FROM public.observacao_pads WHERE true;
  DELETE FROM public.observacoes WHERE true;

  RETURN jsonb_build_object('removidos', _n);
END;
$function$;