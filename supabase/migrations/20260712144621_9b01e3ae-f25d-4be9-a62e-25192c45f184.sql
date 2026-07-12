CREATE OR REPLACE FUNCTION public.conceder_acesso_mp(_denuncia_id uuid, _mp_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rem RECORD;
  _dest RECORD;
  _proto text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;

  SELECT p.nome, p.status, ur.role
    INTO _rem
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.id = _uid;
  IF _rem IS NULL OR _rem.status <> 'ativo' THEN
    RAISE EXCEPTION 'Usuário sem cadastro ativo.';
  END IF;
  IF _rem.role NOT IN ('delegado_geral','delegado_corregedor') THEN
    RAISE EXCEPTION 'Apenas Delegado Geral ou Delegado Corregedor podem conceder acesso ao MP.';
  END IF;

  SELECT p.nome, ur.role
    INTO _dest
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.id = _mp_user_id;
  IF _dest IS NULL OR _dest.role <> 'mp' THEN
    RAISE EXCEPTION 'Destinatário inválido.';
  END IF;

  SELECT numero_protocolo INTO _proto FROM public.denuncias WHERE id = _denuncia_id;
  IF _proto IS NULL THEN
    RAISE EXCEPTION 'Procedimento não encontrado.';
  END IF;

  INSERT INTO public.mp_acessos (denuncia_id, mp_user_id, concedido_por)
  VALUES (_denuncia_id, _mp_user_id, _uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notificacoes
    (user_id, denuncia_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  VALUES
    (_mp_user_id, _denuncia_id, 'auto',
     'Acesso concedido ao procedimento ' || _proto,
     'Você recebeu acesso de leitura ao procedimento ' || _proto || '.',
     _uid, _rem.nome, _rem.role);
END;
$$;