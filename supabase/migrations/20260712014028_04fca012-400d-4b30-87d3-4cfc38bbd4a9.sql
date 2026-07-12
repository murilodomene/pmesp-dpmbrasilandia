
-- Notificações e intimações internas
CREATE TYPE public.notificacao_tipo AS ENUM ('auto','intimacao');

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  tipo public.notificacao_tipo NOT NULL,
  titulo text NOT NULL,
  teor text,
  remetente_id uuid,
  remetente_nome text,
  remetente_cargo public.app_role,
  lido boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_user ON public.notificacoes(user_id, lido, created_at DESC);
CREATE INDEX idx_notificacoes_denuncia ON public.notificacoes(denuncia_id);

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê apenas próprias notificações"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuário marca como lida sua notificação"
  ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Função para notificar delegados (Delegado Geral + Delegado Corregedor)
CREATE OR REPLACE FUNCTION public.notificar_delegados(
  _denuncia_id uuid, _titulo text, _teor text, _autor_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacoes (user_id, denuncia_id, tipo, titulo, teor)
  SELECT ur.user_id, _denuncia_id, 'auto', _titulo, _teor
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('delegado_geral','delegado_corregedor')
     AND p.status = 'ativo'
     AND (_autor_id IS NULL OR ur.user_id <> _autor_id);
END;
$$;

-- Trigger: nova denúncia
CREATE OR REPLACE FUNCTION public.tg_notif_nova_denuncia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notificar_delegados(
    NEW.id,
    'Nova denúncia: ' || NEW.numero_protocolo,
    NULL,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notif_nova_denuncia
  AFTER INSERT ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.tg_notif_nova_denuncia();

-- Trigger: movimentações (exceto evento/cancelamento/certidao)
CREATE OR REPLACE FUNCTION public.tg_notif_movimento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _proto text;
  _label text;
BEGIN
  IF NEW.especie IN ('evento','cancelamento','certidao') THEN
    RETURN NEW;
  END IF;

  SELECT numero_protocolo INTO _proto FROM public.denuncias WHERE id = NEW.denuncia_id;

  _label := CASE NEW.especie::text
    WHEN 'despacho'    THEN 'Despacho'
    WHEN 'decisao'     THEN 'Decisão'
    WHEN 'ipc'         THEN 'IPC'
    WHEN 'status'      THEN 'Mudança de status'
    WHEN 'retificacao' THEN 'Retificação de denunciado'
    WHEN 'portaria'    THEN 'Portaria Inaugural'
    ELSE NEW.especie::text
  END;

  PERFORM public.notificar_delegados(
    NEW.denuncia_id,
    _label || ' — ' || COALESCE(_proto,''),
    NULL,
    NEW.prolator_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notif_movimento
  AFTER INSERT ON public.movimentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_notif_movimento();

-- Função para criar intimação (destinatário interno, hierarquia)
CREATE OR REPLACE FUNCTION public.criar_intimacao(
  _denuncia_id uuid, _destinatario_id uuid, _teor text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _rem RECORD;
  _dest RECORD;
  _rem_rank int;
  _dest_rank int;
  _notif_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  IF btrim(COALESCE(_teor,'')) = '' THEN RAISE EXCEPTION 'Informe o teor da intimação.'; END IF;

  SELECT p.nome, p.status, ur.role
    INTO _rem
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.id = _uid;
  IF _rem IS NULL OR _rem.status <> 'ativo' THEN RAISE EXCEPTION 'Usuário sem cadastro ativo.'; END IF;
  IF _rem.role NOT IN ('delegado_geral','delegado_corregedor','corregedor') THEN
    RAISE EXCEPTION 'Apenas cargos internos podem intimar.';
  END IF;

  SELECT p.nome, p.status, ur.role
    INTO _dest
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.id = _destinatario_id;
  IF _dest IS NULL OR _dest.status <> 'ativo' THEN RAISE EXCEPTION 'Destinatário inválido.'; END IF;
  IF _dest.role NOT IN ('delegado_geral','delegado_corregedor','corregedor') THEN
    RAISE EXCEPTION 'Só usuários internos podem ser intimados.';
  END IF;

  _rem_rank := CASE _rem.role WHEN 'delegado_geral' THEN 3 WHEN 'delegado_corregedor' THEN 2 WHEN 'corregedor' THEN 1 END;
  _dest_rank := CASE _dest.role WHEN 'delegado_geral' THEN 3 WHEN 'delegado_corregedor' THEN 2 WHEN 'corregedor' THEN 1 END;
  IF _dest_rank > _rem_rank THEN
    RAISE EXCEPTION 'Não é possível intimar cargo superior ao seu.';
  END IF;

  INSERT INTO public.notificacoes
    (user_id, denuncia_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  VALUES
    (_destinatario_id, _denuncia_id, 'intimacao',
     'Intimação de ' || _rem.nome, _teor, _uid, _rem.nome, _rem.role)
  RETURNING id INTO _notif_id;

  INSERT INTO public.movimentos
    (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
  VALUES
    (_denuncia_id, 'evento',
     'Intimação expedida a ' || _dest.nome || ' — ' || _teor,
     _uid, _rem.nome, _rem.role);

  RETURN _notif_id;
END;
$$;

-- Marcar como lida (com evento nos autos se for intimação)
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(_notif_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _n RECORD;
  _prof RECORD;
  _role app_role;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado.'; END IF;
  SELECT * INTO _n FROM public.notificacoes WHERE id = _notif_id AND user_id = _uid;
  IF _n IS NULL THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  IF _n.lido THEN RETURN; END IF;

  UPDATE public.notificacoes SET lido = true, lida_em = now() WHERE id = _notif_id;

  IF _n.tipo = 'intimacao' THEN
    SELECT nome INTO _prof FROM public.profiles WHERE id = _uid;
    SELECT role INTO _role FROM public.user_roles WHERE user_id = _uid LIMIT 1;
    INSERT INTO public.movimentos
      (denuncia_id, especie, teor, prolator_id, prolator_nome, prolator_cargo)
    VALUES
      (_n.denuncia_id, 'evento',
       'Intimação lida por ' || _prof.nome || ' em ' ||
         to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'),
       _uid, _prof.nome, _role);
  END IF;
END;
$$;

-- Busca usuários internos ativos (autocomplete)
CREATE OR REPLACE FUNCTION public.buscar_internos(_termo text)
RETURNS TABLE(id uuid, nome text, cargo app_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nome, ur.role
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE p.status = 'ativo'
     AND ur.role IN ('delegado_geral','delegado_corregedor','corregedor')
     AND (_termo IS NULL OR _termo = '' OR p.nome ILIKE '%' || _termo || '%')
   ORDER BY p.nome
   LIMIT 20;
$$;
