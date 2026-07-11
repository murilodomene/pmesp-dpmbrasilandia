CREATE TABLE IF NOT EXISTS public.protocolo_contador (
  ano INTEGER PRIMARY KEY,
  ultimo INTEGER NOT NULL DEFAULT 0
);
GRANT ALL ON public.protocolo_contador TO service_role;
ALTER TABLE public.protocolo_contador ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gerar_protocolo()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  ano_atual INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  proximo INTEGER;
BEGIN
  INSERT INTO public.protocolo_contador AS pc (ano, ultimo)
  VALUES (ano_atual, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo = pc.ultimo + 1
  RETURNING pc.ultimo INTO proximo;

  RETURN '1-' || lpad(proximo::text, 3, '0') || '/' || ano_atual::text;
END;
$$;

DO $$
DECLARE
  r RECORD;
  contadores JSONB := '{}'::jsonb;
  v_ano INTEGER;
  v_prox INTEGER;
BEGIN
  DELETE FROM public.protocolo_contador;

  FOR r IN
    SELECT id, EXTRACT(YEAR FROM created_at)::INTEGER AS ano
    FROM public.denuncias
    ORDER BY created_at ASC, id ASC
  LOOP
    v_ano := r.ano;
    v_prox := COALESCE((contadores ->> v_ano::text)::int, 0) + 1;
    contadores := jsonb_set(contadores, ARRAY[v_ano::text], to_jsonb(v_prox), true);

    UPDATE public.denuncias
      SET numero_protocolo = '1-' || lpad(v_prox::text, 3, '0') || '/' || v_ano::text
    WHERE id = r.id;
  END LOOP;

  INSERT INTO public.protocolo_contador (ano, ultimo)
  SELECT (k)::int, (v)::int
  FROM jsonb_each_text(contadores) AS t(k, v);
END $$;
