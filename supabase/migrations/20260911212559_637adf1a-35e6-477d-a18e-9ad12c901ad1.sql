CREATE OR REPLACE FUNCTION public.gerar_protocolo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ano_atual INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  proximo INTEGER;
BEGIN
  INSERT INTO public.protocolo_contador AS pc (ano, ultimo)
  VALUES (ano_atual, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo = pc.ultimo + 1
  RETURNING pc.ultimo INTO proximo;

  RETURN lpad(proximo::text, 3, '0') || '/' || ano_atual::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.manutencao_definir_proximo_protocolo(_ano integer, _proximo integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _role public.app_role;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _role IS NULL OR _role NOT IN ('corregedor_geral', 'subcorregedor_geral') THEN
    RAISE EXCEPTION 'Apenas o Corregedor-Geral ou Subcorregedor-Geral pode ajustar a numeração.';
  END IF;

  IF _ano < 2000 OR _ano > 2999 THEN
    RAISE EXCEPTION 'Ano inválido.';
  END IF;

  IF _proximo < 1 OR _proximo > 999 THEN
    RAISE EXCEPTION 'O próximo número deve estar entre 1 e 999.';
  END IF;

  INSERT INTO public.protocolo_contador (ano, ultimo)
  VALUES (_ano, _proximo - 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = _proximo - 1;

  RETURN jsonb_build_object(
    'ano', _ano,
    'proximo', lpad(_proximo::text, 3, '0') || '/' || _ano::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.manutencao_ler_contador_protocolo(_ano integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _role public.app_role;
  _ultimo integer;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _role IS NULL OR _role NOT IN ('corregedor_geral', 'subcorregedor_geral') THEN
    RAISE EXCEPTION 'Acesso restrito.';
  END IF;

  SELECT ultimo INTO _ultimo FROM public.protocolo_contador WHERE ano = _ano;
  RETURN jsonb_build_object('ano', _ano, 'proximo_numero', COALESCE(_ultimo, 0) + 1);
END;
$function$;

REVOKE ALL ON FUNCTION public.manutencao_definir_proximo_protocolo(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.manutencao_ler_contador_protocolo(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.manutencao_definir_proximo_protocolo(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manutencao_ler_contador_protocolo(integer) TO authenticated;

INSERT INTO public.protocolo_contador (ano, ultimo)
VALUES (2026, 174)
ON CONFLICT (ano) DO UPDATE SET ultimo = 174;