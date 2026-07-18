
CREATE OR REPLACE FUNCTION public.certificar_transito_administrativo(_denuncia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prof RECORD;
  _role public.app_role;
  _d RECORD;
  _tem_ipc boolean;
  _data_fmt text;
  _teor text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_geral','delegado_corregedor','corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas cargos internos podem certificar o trânsito em julgado administrativo.';
  END IF;

  SELECT id, numero_protocolo, status, certidao_gerada
    INTO _d FROM public.denuncias WHERE id = _denuncia_id FOR UPDATE;
  IF _d IS NULL THEN RAISE EXCEPTION 'Procedimento não encontrado.'; END IF;
  IF _d.status IN ('transito_julgado'::public.denuncia_status, 'arquivada'::public.denuncia_status, 'em_recurso'::public.denuncia_status) THEN
    RAISE EXCEPTION 'O procedimento já está encerrado ou em recurso.';
  END IF;
  IF _d.certidao_gerada THEN
    RAISE EXCEPTION 'Já foi gerada certidão de trânsito neste procedimento.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.movimentos
     WHERE denuncia_id = _denuncia_id
       AND especie = 'ipc'::public.movimento_especie
       AND cancelado_em IS NULL
  ) INTO _tem_ipc;
  IF NOT _tem_ipc THEN
    RAISE EXCEPTION 'É necessário lavrar o IPC antes de certificar o trânsito em julgado administrativo.';
  END IF;

  UPDATE public.denuncias
     SET status = 'transito_julgado'::public.denuncia_status,
         certidao_gerada = true,
         concluido_em = COALESCE(concluido_em, now())
   WHERE id = _denuncia_id;

  _data_fmt := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  _teor := 'Certifico e dou fé que, publicado o Informe Preliminar Conclusivo (IPC) nos autos do procedimento '
        || _d.numero_protocolo
        || ' sem aplicação de sanção administrativa e, portanto, não sendo cabível recurso, opera-se, nesta data ('
        || _data_fmt
        || '), o TRÂNSITO EM JULGADO ADMINISTRATIVO da decisão proferida.'
        || chr(10) || chr(10)
        || 'Corregedoria Geral da Polícia Civil.';

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES
    (_denuncia_id, 'certidao'::public.movimento_especie, _teor, _uid, _prof.nome, _role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.certificar_transito_administrativo(uuid) TO authenticated;
