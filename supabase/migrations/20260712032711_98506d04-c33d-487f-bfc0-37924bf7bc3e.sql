
CREATE OR REPLACE FUNCTION public.manutencao_limpar_processos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role <> 'delegado_corregedor' THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor pode executar manutenção.'; END IF;

  SELECT count(*) INTO _n FROM public.denuncias;
  UPDATE public.pdos SET procedimento_id = NULL, procedimento_numero = NULL WHERE procedimento_id IS NOT NULL;
  DELETE FROM public.notificacoes WHERE denuncia_id IS NOT NULL;
  DELETE FROM public.mp_acessos;
  DELETE FROM public.oitivas;
  DELETE FROM public.movimentos;
  DELETE FROM public.denuncia_policiais;
  DELETE FROM public.denuncias;
  DELETE FROM public.protocolo_contador;
  RETURN jsonb_build_object('removidos', _n);
END; $$;

CREATE OR REPLACE FUNCTION public.manutencao_limpar_pdos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role <> 'delegado_corregedor' THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor pode executar manutenção.'; END IF;

  SELECT count(*) INTO _n FROM public.pdos;
  DELETE FROM public.pdos;
  DELETE FROM public.pdo_contador;
  RETURN jsonb_build_object('removidos', _n);
END; $$;

CREATE OR REPLACE FUNCTION public.manutencao_limpar_avisos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role <> 'delegado_corregedor' THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor pode executar manutenção.'; END IF;

  SELECT count(*) INTO _n FROM public.avisos;
  DELETE FROM public.notificacoes WHERE aviso_id IS NOT NULL;
  DELETE FROM public.avisos;
  DELETE FROM public.aviso_contador;
  RETURN jsonb_build_object('removidos', _n);
END; $$;
