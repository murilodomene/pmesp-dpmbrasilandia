
-- ============== POLICIES ==============
DROP POLICY IF EXISTS "PDO deletable by corregedor" ON public.pdos;
CREATE POLICY "PDO deletable by corregedor" ON public.pdos
  FOR DELETE USING (
    has_role(auth.uid(),'delegado_corregedor'::app_role)
    OR has_role(auth.uid(),'coordenador'::app_role)
  );

DROP POLICY IF EXISTS "Somente Delegado Corregedor edita hierarquia (insert)" ON public.hierarquia_membros;
CREATE POLICY "Somente Delegado Corregedor edita hierarquia (insert)" ON public.hierarquia_membros
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.status = 'ativo'::profile_status
      AND ur.role IN ('delegado_corregedor'::app_role,'coordenador'::app_role)
  ));

DROP POLICY IF EXISTS "Somente Delegado Corregedor edita hierarquia (update)" ON public.hierarquia_membros;
CREATE POLICY "Somente Delegado Corregedor edita hierarquia (update)" ON public.hierarquia_membros
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.status = 'ativo'::profile_status
      AND ur.role IN ('delegado_corregedor'::app_role,'coordenador'::app_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.status = 'ativo'::profile_status
      AND ur.role IN ('delegado_corregedor'::app_role,'coordenador'::app_role)
  ));

DROP POLICY IF EXISTS "Somente Delegado Corregedor edita hierarquia (delete)" ON public.hierarquia_membros;
CREATE POLICY "Somente Delegado Corregedor edita hierarquia (delete)" ON public.hierarquia_membros
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.status = 'ativo'::profile_status
      AND ur.role IN ('delegado_corregedor'::app_role,'coordenador'::app_role)
  ));

-- Avisos: quem publica/edita/remove
DROP POLICY IF EXISTS "Delegados publicam avisos" ON public.avisos;
CREATE POLICY "Delegados publicam avisos" ON public.avisos
  FOR INSERT WITH CHECK (
    autor_id = auth.uid()
    AND get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'coordenador'::app_role])
  );
DROP POLICY IF EXISTS "Delegados editam avisos" ON public.avisos;
CREATE POLICY "Delegados editam avisos" ON public.avisos
  FOR UPDATE
  USING (get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'coordenador'::app_role]))
  WITH CHECK (get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'coordenador'::app_role]));
DROP POLICY IF EXISTS "Delegados removem avisos" ON public.avisos;
CREATE POLICY "Delegados removem avisos" ON public.avisos
  FOR DELETE USING (get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'coordenador'::app_role]));

-- Avisos/leitura pelos internos (inclui coordenador)
DROP POLICY IF EXISTS "Internos leem avisos" ON public.avisos;
CREATE POLICY "Internos leem avisos" ON public.avisos
  FOR SELECT USING (get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'corregedor'::app_role,'coordenador'::app_role]));
DROP POLICY IF EXISTS "Internos leem contador de avisos" ON public.aviso_contador;
CREATE POLICY "Internos leem contador de avisos" ON public.aviso_contador
  FOR SELECT USING (get_user_cargo(auth.uid()) = ANY (ARRAY['delegado_geral'::app_role,'delegado_corregedor'::app_role,'corregedor'::app_role,'coordenador'::app_role]));

-- Documentos: leitura por cargos autorizados
DROP POLICY IF EXISTS "Cargos autorizados leem documentos" ON public.documentos;
CREATE POLICY "Cargos autorizados leem documentos" ON public.documentos
  FOR SELECT USING (
    is_active_staff(auth.uid()) AND (
      has_role(auth.uid(),'delegado_geral'::app_role)
      OR has_role(auth.uid(),'delegado_corregedor'::app_role)
      OR has_role(auth.uid(),'corregedor'::app_role)
      OR has_role(auth.uid(),'coordenador'::app_role)
    )
  );

-- Tarjas: quem gerencia (inclui coordenador)
DROP POLICY IF EXISTS "tarjas_insert_corregedor" ON public.denuncia_tarjas;
CREATE POLICY "tarjas_insert_corregedor" ON public.denuncia_tarjas
  FOR INSERT WITH CHECK (
    has_role(auth.uid(),'corregedor'::app_role)
    OR has_role(auth.uid(),'delegado_corregedor'::app_role)
    OR has_role(auth.uid(),'coordenador'::app_role)
  );
DROP POLICY IF EXISTS "tarjas_update_corregedor" ON public.denuncia_tarjas;
CREATE POLICY "tarjas_update_corregedor" ON public.denuncia_tarjas
  FOR UPDATE
  USING (has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));
DROP POLICY IF EXISTS "tarjas_delete_corregedor" ON public.denuncia_tarjas;
CREATE POLICY "tarjas_delete_corregedor" ON public.denuncia_tarjas
  FOR DELETE USING (has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));

-- Observações
DROP POLICY IF EXISTS "Internos podem ver observacoes" ON public.observacoes;
CREATE POLICY "Internos podem ver observacoes" ON public.observacoes
  FOR SELECT USING (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));
DROP POLICY IF EXISTS "Internos podem criar observacoes" ON public.observacoes;
CREATE POLICY "Internos podem criar observacoes" ON public.observacoes
  FOR INSERT WITH CHECK (autor_id = auth.uid() AND (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role)));
DROP POLICY IF EXISTS "Internos podem editar observacoes" ON public.observacoes;
CREATE POLICY "Internos podem editar observacoes" ON public.observacoes
  FOR UPDATE
  USING (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));
DROP POLICY IF EXISTS "Internos podem excluir observacoes" ON public.observacoes;
CREATE POLICY "Internos podem excluir observacoes" ON public.observacoes
  FOR DELETE USING (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));
DROP POLICY IF EXISTS "Internos podem ver observacao_pads" ON public.observacao_pads;
CREATE POLICY "Internos podem ver observacao_pads" ON public.observacao_pads
  FOR SELECT USING (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));
DROP POLICY IF EXISTS "Internos podem gerenciar observacao_pads" ON public.observacao_pads;
CREATE POLICY "Internos podem gerenciar observacao_pads" ON public.observacao_pads
  FOR ALL
  USING (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role))
  WITH CHECK (has_role(auth.uid(),'delegado_geral'::app_role) OR has_role(auth.uid(),'delegado_corregedor'::app_role) OR has_role(auth.uid(),'corregedor'::app_role) OR has_role(auth.uid(),'coordenador'::app_role));

-- Hierarquia (leitura) inclui coordenador
DROP POLICY IF EXISTS "Hierarquia visível apenas para cúpula interna" ON public.hierarquia_membros;
CREATE POLICY "Hierarquia visível apenas para cúpula interna" ON public.hierarquia_membros
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() AND p.status = 'ativo'::profile_status
      AND ur.role IN ('delegado_geral'::app_role,'delegado_corregedor'::app_role,'corregedor'::app_role,'coordenador'::app_role)
  ));

-- ============== FUNCTIONS ==============
CREATE OR REPLACE FUNCTION public.is_delegado(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor','coordenador')
  );
$function$;

CREATE OR REPLACE FUNCTION public.pode_conceder_mp(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor','coordenador')
  );
$function$;

CREATE OR REPLACE FUNCTION public.pode_excluir_denuncia(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor','coordenador')
  );
$function$;

CREATE OR REPLACE FUNCTION public.buscar_internos(_termo text)
 RETURNS TABLE(id uuid, nome text, cargo app_role)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nome, ur.role
    FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.status = 'ativo'
     AND ur.role IN ('delegado_geral','delegado_corregedor','corregedor','coordenador')
     AND (_termo IS NULL OR _termo = '' OR p.nome ILIKE '%' || _termo || '%')
   ORDER BY p.nome LIMIT 20;
$function$;

CREATE OR REPLACE FUNCTION public.notificar_delegados(_denuncia_id uuid, _titulo text, _teor text, _autor_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notificacoes (user_id, denuncia_id, tipo, titulo, teor)
  SELECT ur.user_id, _denuncia_id, 'auto', _titulo, _teor
    FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('delegado_geral','delegado_corregedor','coordenador')
     AND p.status = 'ativo'
     AND (_autor_id IS NULL OR ur.user_id <> _autor_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_notif_novo_aviso()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notificacoes
    (user_id, denuncia_id, aviso_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  SELECT ur.user_id, NULL, NEW.id, 'aviso',
         NEW.numero || ' — ' || NEW.titulo,
         NULL, NEW.autor_id, NEW.autor_nome, NEW.autor_cargo
    FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('delegado_geral','delegado_corregedor','corregedor','coordenador')
     AND p.status = 'ativo'
     AND ur.user_id <> NEW.autor_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_movimento(_movimento_id uuid, _motivo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _prof RECORD; _role app_role; _mov RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF btrim(COALESCE(_motivo, '')) = '' THEN RAISE EXCEPTION 'Informe a justificativa do cancelamento.'; END IF;
  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','delegado_geral','coordenador') THEN
    RAISE EXCEPTION 'Apenas o Delegado Corregedor pode cancelar movimentações.';
  END IF;
  SELECT id, denuncia_id, especie, cancelado_em INTO _mov FROM public.movimentos WHERE id = _movimento_id;
  IF _mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada.'; END IF;
  IF _mov.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Movimentação já cancelada.'; END IF;
  IF _mov.especie = 'cancelamento' THEN RAISE EXCEPTION 'Um registro de cancelamento não pode ser cancelado.'; END IF;
  UPDATE public.movimentos
     SET cancelado_em = now(), cancelado_por_id = _uid,
         cancelado_por_nome = _prof.nome, cancelado_por_cargo = _role,
         motivo_cancelamento = _motivo
   WHERE id = _movimento_id;
  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_mov.denuncia_id,'cancelamento',
    'Movimentação anterior (' || _mov.especie::text || ') cancelada. Justificativa: ' || _motivo,
    _uid, _prof.nome, _role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.certificar_resultado_recurso(_denuncia_id uuid, _resultado text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _prof RECORD; _role public.app_role; _d RECORD;
  _teor text; _label text; _encerra boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_geral','delegado_corregedor','corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas Delegado Geral, Delegado Corregedor, Corregedor ou Coordenador podem certificar o resultado do recurso.';
  END IF;
  SELECT id, status, numero_protocolo INTO _d FROM public.denuncias WHERE id = _denuncia_id FOR UPDATE;
  IF _d IS NULL THEN RAISE EXCEPTION 'Procedimento não encontrado.'; END IF;
  IF _d.status <> 'em_recurso'::public.denuncia_status THEN
    RAISE EXCEPTION 'Só é possível certificar o resultado de procedimentos em recurso.';
  END IF;
  CASE _resultado
    WHEN 'provido' THEN _label := 'PROVIDO';
    WHEN 'parcialmente_provido' THEN _label := 'PARCIALMENTE PROVIDO';
    WHEN 'indeferido' THEN _label := 'INDEFERIDO'; _encerra := true;
    WHEN 'nao_conhecido' THEN _label := 'NÃO CONHECIDO'; _encerra := true;
    ELSE RAISE EXCEPTION 'Resultado inválido.';
  END CASE;
  _teor := 'Certifico e dou fé que o recurso administrativo interposto nos autos do procedimento '
        || _d.numero_protocolo || ' foi julgado ' || _label || '.';
  INSERT INTO public.movimentos (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_denuncia_id, 'certidao'::public.movimento_especie, _teor, _uid, _prof.nome, _role);
  IF _encerra THEN
    UPDATE public.denuncias SET status = 'arquivada'::public.denuncia_status,
        certidao_gerada = true, concluido_em = COALESCE(concluido_em, now())
      WHERE id = _denuncia_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_recurso(_denuncia_id uuid, _certificacao text, _recurso_link text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _prof RECORD; _role public.app_role; _d RECORD; _teor text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT nome, status INTO _prof FROM public.profiles WHERE id = _uid;
  IF _prof IS NULL OR _prof.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_geral','delegado_corregedor','corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas Delegado Geral, Delegado Corregedor, Corregedor ou Coordenador podem registrar recurso.';
  END IF;
  SELECT id, status, certidao_gerada, numero_protocolo INTO _d FROM public.denuncias WHERE id = _denuncia_id FOR UPDATE;
  IF _d IS NULL THEN RAISE EXCEPTION 'Procedimento não encontrado.'; END IF;
  IF _d.status <> 'ag_decurso_prazo'::public.denuncia_status THEN
    RAISE EXCEPTION 'O procedimento não está aguardando decurso do prazo.';
  END IF;
  IF _d.certidao_gerada THEN RAISE EXCEPTION 'O prazo já decorreu — não é possível registrar recurso.'; END IF;
  UPDATE public.denuncias SET status = 'em_recurso'::public.denuncia_status, concluido_em = NULL WHERE id = _denuncia_id;
  _teor := 'Certifico e dou fé que foi interposto recurso administrativo dentro do prazo legal.';
  IF btrim(COALESCE(_recurso_link, '')) <> '' THEN
    _teor := _teor || chr(10) || chr(10) || 'Recurso juntado aos autos: ' || _recurso_link;
  END IF;
  INSERT INTO public.movimentos (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_denuncia_id, 'evento'::public.movimento_especie, _teor, _uid, _prof.nome, _role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.conceder_acesso_mp(_denuncia_id uuid, _mp_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _rem RECORD; _dest RECORD; _proto text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT p.nome, p.status, ur.role INTO _rem FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id WHERE p.id = _uid;
  IF _rem IS NULL OR _rem.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  IF _rem.role NOT IN ('delegado_geral','delegado_corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas Delegado Geral, Delegado Corregedor ou Coordenador podem conceder acesso ao MP.';
  END IF;
  SELECT p.nome, ur.role INTO _dest FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id WHERE p.id = _mp_user_id;
  IF _dest IS NULL OR _dest.role <> 'mp' THEN RAISE EXCEPTION 'Destinatário inválido.'; END IF;
  SELECT numero_protocolo INTO _proto FROM public.denuncias WHERE id = _denuncia_id;
  IF _proto IS NULL THEN RAISE EXCEPTION 'Procedimento não encontrado.'; END IF;
  INSERT INTO public.mp_acessos (denuncia_id, mp_user_id, concedido_por)
  VALUES (_denuncia_id, _mp_user_id, _uid) ON CONFLICT DO NOTHING;
  INSERT INTO public.notificacoes
    (user_id, denuncia_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  VALUES (_mp_user_id, _denuncia_id, 'auto',
     'Acesso concedido ao procedimento ' || _proto,
     'Você recebeu acesso de leitura ao procedimento ' || _proto || '.',
     _uid, _rem.nome, _rem.role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_intimacao(_denuncia_id uuid, _destinatario_id uuid, _teor text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _rem RECORD; _dest RECORD;
  _rem_rank int; _dest_rank int; _notif_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF btrim(COALESCE(_teor,'')) = '' THEN RAISE EXCEPTION 'Informe o teor da intimação.'; END IF;
  SELECT p.nome, p.status, ur.role INTO _rem FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id WHERE p.id = _uid;
  IF _rem IS NULL OR _rem.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  IF _rem.role NOT IN ('delegado_geral','delegado_corregedor','corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas cargos internos podem intimar.';
  END IF;
  SELECT p.nome, p.status, ur.role INTO _dest FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id WHERE p.id = _destinatario_id;
  IF _dest IS NULL OR _dest.status <> 'ativo' THEN RAISE EXCEPTION 'Destinatário inválido.'; END IF;
  IF _dest.role NOT IN ('delegado_geral','delegado_corregedor','corregedor','coordenador') THEN
    RAISE EXCEPTION 'Só usuários internos podem ser intimados.';
  END IF;
  _rem_rank := CASE _rem.role
    WHEN 'delegado_geral' THEN 3
    WHEN 'delegado_corregedor' THEN 2
    WHEN 'coordenador' THEN 2
    WHEN 'corregedor' THEN 1 END;
  _dest_rank := CASE _dest.role
    WHEN 'delegado_geral' THEN 3
    WHEN 'delegado_corregedor' THEN 2
    WHEN 'coordenador' THEN 2
    WHEN 'corregedor' THEN 1 END;
  IF _dest_rank > _rem_rank THEN RAISE EXCEPTION 'Não é possível intimar cargo superior ao seu.'; END IF;
  INSERT INTO public.notificacoes
    (user_id, denuncia_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  VALUES (_destinatario_id, _denuncia_id, 'intimacao',
     'Intimação de ' || _rem.nome, _teor, _uid, _rem.nome, _rem.role)
  RETURNING id INTO _notif_id;
  INSERT INTO public.movimentos (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES (_denuncia_id, 'evento',
     'Intimação expedida a ' || _dest.nome || ' — ' || _teor,
     _uid, _rem.nome, _rem.role);
  RETURN _notif_id;
END;
$function$;

-- Manutenção — Coordenador tem os mesmos poderes
CREATE OR REPLACE FUNCTION public.manutencao_limpar_processos()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','coordenador') THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor ou Coordenador podem executar manutenção.'; END IF;
  SELECT count(*) INTO _n FROM public.denuncias;
  UPDATE public.pdos SET procedimento_id = NULL, procedimento_numero = NULL WHERE procedimento_id IS NOT NULL;
  DELETE FROM public.notificacoes WHERE denuncia_id IS NOT NULL;
  DELETE FROM public.mp_acessos WHERE true;
  DELETE FROM public.oitivas WHERE true;
  DELETE FROM public.movimentos WHERE true;
  DELETE FROM public.denuncia_policiais WHERE true;
  DELETE FROM public.denuncias WHERE true;
  DELETE FROM public.protocolo_contador WHERE true;
  RETURN jsonb_build_object('removidos', _n);
END; $function$;

CREATE OR REPLACE FUNCTION public.manutencao_limpar_pdos()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','coordenador') THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor ou Coordenador podem executar manutenção.'; END IF;
  SELECT count(*) INTO _n FROM public.pdos;
  DELETE FROM public.pdos WHERE true;
  DELETE FROM public.pdo_contador WHERE true;
  RETURN jsonb_build_object('removidos', _n);
END; $function$;

CREATE OR REPLACE FUNCTION public.manutencao_limpar_avisos()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE _uid uuid := auth.uid(); _role app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','coordenador') THEN RAISE EXCEPTION 'Apenas o Delegado Corregedor ou Coordenador podem executar manutenção.'; END IF;
  SELECT count(*) INTO _n FROM public.avisos;
  DELETE FROM public.notificacoes WHERE aviso_id IS NOT NULL;
  DELETE FROM public.avisos WHERE true;
  DELETE FROM public.aviso_contador WHERE true;
  RETURN jsonb_build_object('removidos', _n);
END; $function$;

CREATE OR REPLACE FUNCTION public.manutencao_limpar_observacoes()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE _uid uuid := auth.uid(); _role public.app_role; _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
  IF _role NOT IN ('delegado_corregedor','coordenador') THEN
    RAISE EXCEPTION 'Apenas o Delegado Corregedor ou Coordenador podem limpar as observações.';
  END IF;
  SELECT count(*) INTO _n FROM public.observacoes;
  DELETE FROM public.observacao_pads WHERE true;
  DELETE FROM public.observacoes WHERE true;
  RETURN jsonb_build_object('removidos', _n);
END;
$function$;
