-- 1) Novos campos
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS certidao_gerada boolean NOT NULL DEFAULT false;

-- 2) Migração de dados: 'concluida' -> 'transito_julgado' (já eram encerrados)
UPDATE public.denuncias
   SET status = 'transito_julgado'::public.denuncia_status,
       certidao_gerada = true
 WHERE status = 'concluida'::public.denuncia_status;

-- 3) Função: transita 1 denúncia se elegível (atômico, idempotente)
CREATE OR REPLACE FUNCTION public.transitar_denuncia(_denuncia_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d RECORD;
  _texto text;
  _data_concl_fmt text;
  _updated int;
BEGIN
  SELECT id, numero_protocolo, status, concluido_em, certidao_gerada
    INTO _d FROM public.denuncias WHERE id = _denuncia_id FOR UPDATE;

  IF _d IS NULL THEN
    RETURN false;
  END IF;
  IF _d.status <> 'ag_decurso_prazo'::public.denuncia_status THEN
    RETURN false;
  END IF;
  IF _d.certidao_gerada THEN
    RETURN false;
  END IF;
  IF _d.concluido_em IS NULL OR _d.concluido_em > now() - INTERVAL '7 days' THEN
    RETURN false;
  END IF;

  -- guard atômico: só um vencedor consegue mudar certidao_gerada de false p/ true
  UPDATE public.denuncias
     SET certidao_gerada = true,
         status = 'transito_julgado'::public.denuncia_status
   WHERE id = _denuncia_id
     AND certidao_gerada = false
     AND status = 'ag_decurso_prazo'::public.denuncia_status;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    RETURN false;
  END IF;

  _data_concl_fmt := to_char(_d.concluido_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  _texto := 'Certifico que, decorrido o prazo de 7 (sete) dias corridos a contar de '
         || _data_concl_fmt
         || ' sem interposição de recurso administrativo, opera-se o trânsito em julgado da decisão proferida nos autos do procedimento '
         || _d.numero_protocolo
         || '.' || chr(10) || chr(10)
         || 'Corregedoria Geral da Polícia Civil.';

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (
    _denuncia_id,
    'certidao'::public.movimento_especie,
    _texto,
    NULL,
    'Sistema — Corregedoria Geral da Polícia Civil',
    'delegado_corregedor'::public.app_role
  );

  RETURN true;
END;
$$;

-- 4) Varredura em massa (usada pelo cron diário)
CREATE OR REPLACE FUNCTION public.transitar_pendentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec RECORD;
  _n integer := 0;
BEGIN
  FOR _rec IN
    SELECT id FROM public.denuncias
     WHERE status = 'ag_decurso_prazo'::public.denuncia_status
       AND certidao_gerada = false
       AND concluido_em <= now() - INTERVAL '7 days'
  LOOP
    IF public.transitar_denuncia(_rec.id) THEN
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END;
$$;

-- 5) Registrar recurso dentro do prazo (apenas 3 cargos internos)
CREATE OR REPLACE FUNCTION public.registrar_recurso(
  _denuncia_id uuid,
  _certificacao text,
  _recurso_link text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prof RECORD;
  _role public.app_role;
  _d RECORD;
  _teor text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF btrim(COALESCE(_certificacao, '')) = '' THEN
    RAISE EXCEPTION 'Informe a certificação do recurso.';
  END IF;

  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN
    RAISE EXCEPTION 'Usuário sem cadastro ativo.';
  END IF;

  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_geral','delegado_corregedor','corregedor') THEN
    RAISE EXCEPTION 'Apenas Delegado Geral, Delegado Corregedor ou Corregedor podem registrar recurso.';
  END IF;

  SELECT id, status, certidao_gerada, numero_protocolo
    INTO _d FROM public.denuncias WHERE id = _denuncia_id FOR UPDATE;
  IF _d IS NULL THEN
    RAISE EXCEPTION 'Procedimento não encontrado.';
  END IF;
  IF _d.status <> 'ag_decurso_prazo'::public.denuncia_status THEN
    RAISE EXCEPTION 'O procedimento não está aguardando decurso do prazo.';
  END IF;
  IF _d.certidao_gerada THEN
    RAISE EXCEPTION 'O prazo já decorreu — não é possível registrar recurso.';
  END IF;

  UPDATE public.denuncias
     SET status = 'em_analise'::public.denuncia_status,
         concluido_em = NULL
   WHERE id = _denuncia_id;

  _teor := 'Certifico e dou fé que foi interposto recurso administrativo dentro do prazo legal.' || chr(10) || chr(10)
        || 'Certificação: ' || _certificacao;
  IF btrim(COALESCE(_recurso_link, '')) <> '' THEN
    _teor := _teor || chr(10) || chr(10) || 'Recurso juntado aos autos: ' || _recurso_link;
  END IF;

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_denuncia_id, 'evento'::public.movimento_especie, _teor, _uid, _prof.nome, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.transitar_denuncia(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transitar_pendentes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_recurso(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transitar_denuncia(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transitar_pendentes() TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_recurso(uuid, text, text) TO authenticated;

-- 6) Cron diário
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('transitar-decurso-prazo-diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'transitar-decurso-prazo-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'transitar-decurso-prazo-diario',
  '0 3 * * *',
  $$SELECT public.transitar_pendentes();$$
);