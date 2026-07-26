ALTER TYPE public.unidade_pc ADD VALUE IF NOT EXISTS 'GOE';

CREATE OR REPLACE FUNCTION public.submeter_denuncia_anonima(_payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _denuncia_id uuid;
  _protocolo text;
  _policiais jsonb;
  _links jsonb;
  _anonimo boolean;
  _unidade public.unidade_pc;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Este canal é exclusivo para envio público não autenticado.';
  END IF;

  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados da denúncia inválidos.';
  END IF;

  _policiais := COALESCE(_payload->'policiais', '[]'::jsonb);
  _links := COALESCE(_payload->'links', '[]'::jsonb);
  _anonimo := COALESCE((_payload->>'denunciante_anonimo')::boolean, false);

  IF jsonb_typeof(_policiais) <> 'array'
     OR jsonb_array_length(_policiais) < 1
     OR jsonb_array_length(_policiais) > 20 THEN
    RAISE EXCEPTION 'Informe entre 1 e 20 policiais denunciados.';
  END IF;

  IF jsonb_typeof(_links) <> 'array' OR jsonb_array_length(_links) > 20 THEN
    RAISE EXCEPTION 'Lista de links inválida.';
  END IF;

  IF char_length(btrim(COALESCE(_payload->>'relato', ''))) < 20
     OR char_length(_payload->>'relato') > 10000 THEN
    RAISE EXCEPTION 'O relato deve conter entre 20 e 10000 caracteres.';
  END IF;

  IF char_length(COALESCE(_payload->>'denunciante_nome', '')) > 200
     OR char_length(COALESCE(_payload->>'denunciante_identificador', '')) > 200
     OR char_length(COALESCE(_payload->>'denunciante_contato', '')) > 200
     OR char_length(COALESCE(_payload->>'ocorrencia_tipo', '')) > 200
     OR char_length(COALESCE(_payload->>'ocorrencia_local', '')) > 500
     OR char_length(COALESCE(_payload->>'info_adicional', '')) > 5000 THEN
    RAISE EXCEPTION 'Um ou mais campos excedem o tamanho permitido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_policiais) AS p
    WHERE btrim(COALESCE(p->>'nome', '')) = ''
       OR char_length(p->>'nome') > 200
       OR char_length(COALESCE(p->>'rg_funcional', '')) > 50
       OR (NULLIF(p->>'unidade', '') IS NOT NULL
           AND (p->>'unidade') NOT IN ('DEIC','CORREGEPOL','DECAP','DHPP','CERCO','GARRA','DENARC','GER','SAT','GOE'))
  ) THEN
    RAISE EXCEPTION 'Dados de policial inválidos.';
  END IF;

  SELECT NULLIF(p->>'unidade', '')::public.unidade_pc
    INTO _unidade
    FROM jsonb_array_elements(_policiais) AS p
   WHERE NULLIF(p->>'unidade', '') IS NOT NULL
   LIMIT 1;

  INSERT INTO public.denuncias (
    owner_id,
    denunciante_nome,
    denunciante_identificador,
    denunciante_contato,
    denunciante_anonimo,
    ocorrencia_tipo,
    ocorrencia_local,
    ocorrencia_data,
    ocorrencia_hora,
    relato,
    info_adicional,
    links,
    unidade
  )
  VALUES (
    NULL,
    CASE WHEN _anonimo THEN NULL ELSE NULLIF(btrim(_payload->>'denunciante_nome'), '') END,
    CASE WHEN _anonimo THEN NULL ELSE NULLIF(btrim(_payload->>'denunciante_identificador'), '') END,
    CASE WHEN _anonimo THEN NULL ELSE NULLIF(btrim(_payload->>'denunciante_contato'), '') END,
    _anonimo,
    NULLIF(btrim(_payload->>'ocorrencia_tipo'), ''),
    NULLIF(btrim(_payload->>'ocorrencia_local'), ''),
    NULLIF(_payload->>'ocorrencia_data', '')::date,
    NULLIF(_payload->>'ocorrencia_hora', '')::time,
    btrim(_payload->>'relato'),
    NULLIF(btrim(_payload->>'info_adicional'), ''),
    _links,
    _unidade
  )
  RETURNING id, numero_protocolo INTO _denuncia_id, _protocolo;

  INSERT INTO public.denuncia_policiais (denuncia_id, nome, rg_funcional, unidade)
  SELECT
    _denuncia_id,
    btrim(p->>'nome'),
    NULLIF(btrim(p->>'rg_funcional'), ''),
    NULLIF(p->>'unidade', '')::public.unidade_pc
  FROM jsonb_array_elements(_policiais) AS p;

  RETURN _protocolo;
END;
$function$;