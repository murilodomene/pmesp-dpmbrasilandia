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

  _teor := 'Certifico e dou fé que foi interposto recurso administrativo dentro do prazo legal.';
  IF btrim(COALESCE(_recurso_link, '')) <> '' THEN
    _teor := _teor || chr(10) || chr(10) || 'Recurso juntado aos autos: ' || _recurso_link;
  END IF;

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_denuncia_id, 'evento'::public.movimento_especie, _teor, _uid, _prof.nome, _role);
END;
$$;