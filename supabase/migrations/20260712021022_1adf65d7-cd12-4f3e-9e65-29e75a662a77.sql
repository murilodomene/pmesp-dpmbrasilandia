
-- Add 'aviso' to notificacao_tipo enum
ALTER TYPE public.notificacao_tipo ADD VALUE IF NOT EXISTS 'aviso';

-- Allow notificacoes without denuncia (avisos) and link to aviso
ALTER TABLE public.notificacoes ALTER COLUMN denuncia_id DROP NOT NULL;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS aviso_id uuid;

-- Contador anual para numeração dos avisos
CREATE TABLE IF NOT EXISTS public.aviso_contador (
  ano int PRIMARY KEY,
  ultimo int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.aviso_contador TO authenticated;
GRANT ALL ON public.aviso_contador TO service_role;
ALTER TABLE public.aviso_contador ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internos leem contador de avisos" ON public.aviso_contador
  FOR SELECT TO authenticated
  USING (public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor','corregedor'));

CREATE OR REPLACE FUNCTION public.gerar_numero_aviso()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  ano_atual int := EXTRACT(YEAR FROM now())::int;
  proximo int;
BEGIN
  INSERT INTO public.aviso_contador AS ac (ano, ultimo)
  VALUES (ano_atual, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = ac.ultimo + 1
  RETURNING ac.ultimo INTO proximo;
  RETURN 'AVISO Nº ' || lpad(proximo::text, 3, '0') || '/' || ano_atual::text;
END;
$$;

-- Tabela de avisos
CREATE TABLE IF NOT EXISTS public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL DEFAULT public.gerar_numero_aviso(),
  titulo text NOT NULL,
  corpo text NOT NULL,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  autor_nome text NOT NULL,
  autor_cargo public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos TO authenticated;
GRANT ALL ON public.avisos TO service_role;

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leem avisos" ON public.avisos
  FOR SELECT TO authenticated
  USING (public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor','corregedor'));

CREATE POLICY "Delegados publicam avisos" ON public.avisos
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor')
  );

CREATE POLICY "Delegados editam avisos" ON public.avisos
  FOR UPDATE TO authenticated
  USING (public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor'))
  WITH CHECK (public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor'));

CREATE POLICY "Delegados removem avisos" ON public.avisos
  FOR DELETE TO authenticated
  USING (public.get_user_cargo(auth.uid()) IN ('delegado_geral','delegado_corregedor'));

CREATE TRIGGER trg_avisos_updated_at
  BEFORE UPDATE ON public.avisos
  FOR EACH ROW EXECUTE FUNCTION public.touch_hierarquia_updated_at();

-- Trigger: ao publicar aviso, notificar todos os internos exceto o autor
CREATE OR REPLACE FUNCTION public.tg_notif_novo_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacoes
    (user_id, denuncia_id, aviso_id, tipo, titulo, teor, remetente_id, remetente_nome, remetente_cargo)
  SELECT ur.user_id, NULL, NEW.id, 'aviso',
         NEW.numero || ' — ' || NEW.titulo,
         NULL, NEW.autor_id, NEW.autor_nome, NEW.autor_cargo
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('delegado_geral','delegado_corregedor','corregedor')
     AND p.status = 'ativo'
     AND ur.user_id <> NEW.autor_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notif_novo_aviso
  AFTER INSERT ON public.avisos
  FOR EACH ROW EXECUTE FUNCTION public.tg_notif_novo_aviso();

-- Atualiza marcar_notificacao_lida para não gerar movimento quando não há denúncia (aviso)
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(_notif_id uuid)
RETURNS void
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

  IF _n.tipo = 'intimacao' AND _n.denuncia_id IS NOT NULL THEN
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
