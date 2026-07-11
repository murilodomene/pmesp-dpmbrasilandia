CREATE OR REPLACE FUNCTION public.cancelar_movimento(_movimento_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prof RECORD;
  _role app_role;
  _mov RECORD;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF btrim(COALESCE(_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe a justificativa do cancelamento.';
  END IF;

  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN
    RAISE EXCEPTION 'Usuário sem cadastro ativo.';
  END IF;

  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','delegado_geral') THEN
    RAISE EXCEPTION 'Apenas o Delegado Corregedor pode cancelar movimentações.';
  END IF;

  SELECT id, denuncia_id, especie, cancelado_em
    INTO _mov FROM public.movimentos WHERE id = _movimento_id;
  IF _mov IS NULL THEN
    RAISE EXCEPTION 'Movimentação não encontrada.';
  END IF;
  IF _mov.cancelado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Movimentação já cancelada.';
  END IF;
  IF _mov.especie = 'cancelamento' THEN
    RAISE EXCEPTION 'Um registro de cancelamento não pode ser cancelado.';
  END IF;

  UPDATE public.movimentos
     SET cancelado_em = now(),
         cancelado_por_id = _uid,
         cancelado_por_nome = _prof.nome,
         cancelado_por_cargo = _role,
         motivo_cancelamento = _motivo
   WHERE id = _movimento_id;

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (
    _mov.denuncia_id,
    'cancelamento',
    'Movimentação anterior (' || _mov.especie::text || ') cancelada. Justificativa: ' || _motivo,
    _uid, _prof.nome, _role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_movimento(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_movimento(uuid, text) TO authenticated;