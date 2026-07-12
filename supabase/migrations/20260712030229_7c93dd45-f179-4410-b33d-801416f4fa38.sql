
-- ============================================================
-- Fix: denuncias_owner_id_spoofing + denuncia_policiais_arbitrary_linking
-- ============================================================

-- denuncias: remover policies permissivas de INSERT (anon e authenticated com WITH CHECK true)
DROP POLICY IF EXISTS "Autenticado cria denúncia" ON public.denuncias;
DROP POLICY IF EXISTS "Público cria denúncia" ON public.denuncias;
DROP POLICY IF EXISTS "Anon pode inserir denuncia" ON public.denuncias;

-- Mantida: "Cidadão cria denúncia própria" (owner_id = auth.uid())
-- Adicionar policy para Staff (Corregedoria) instaurar procedimento próprio
CREATE POLICY "Staff cria denúncia"
  ON public.denuncias
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()) AND owner_id = auth.uid());

-- denuncia_policiais: remover policies permissivas
DROP POLICY IF EXISTS "Autenticado insere policial denunciado" ON public.denuncia_policiais;
DROP POLICY IF EXISTS "Público insere policial denunciado" ON public.denuncia_policiais;
DROP POLICY IF EXISTS "Anon pode inserir denuncia_policiais" ON public.denuncia_policiais;

-- Cidadão só pode inserir policiais na própria denúncia
CREATE POLICY "Cidadão insere denunciado próprio"
  ON public.denuncia_policiais
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.denuncias d
      WHERE d.id = denuncia_id AND d.owner_id = auth.uid()
    )
  );

-- Staff pode inserir policiais em qualquer denúncia (instaurações, PDO, retificações)
CREATE POLICY "Staff insere denunciado"
  ON public.denuncia_policiais
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff(auth.uid()));

-- ============================================================
-- Fix: SUPA_(anon|authenticated)_security_definer_function_executable
-- Revoga EXECUTE público de funções SECURITY DEFINER que não são
-- expostas via RPC. Funções de trigger e helpers internos passam
-- a ser chamáveis apenas pelo próprio dono (postgres) / service_role.
-- ============================================================

-- Funções de trigger (nunca são chamadas via API/RPC)
REVOKE ALL ON FUNCTION public.tg_notif_movimento()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_notif_nova_denuncia()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_notif_novo_aviso()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;

-- Helper interno: só é chamada por outras SECURITY DEFINER / triggers
REVOKE ALL ON FUNCTION public.notificar_delegados(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

-- Contadores/geradores: chamados só a partir de server functions autenticadas
-- (nunca por anon). O canal público agora usa supabaseAdmin (service_role).
REVOKE EXECUTE ON FUNCTION public.gerar_protocolo()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_aviso()    FROM PUBLIC, anon;

-- RPCs de negócio: só authenticated precisa executar
REVOKE EXECUTE ON FUNCTION public.marcar_notificacao_lida(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_intimacao(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buscar_internos(text) FROM PUBLIC, anon;

-- Helpers usados dentro de policies RLS: anon não precisa executar
REVOKE EXECUTE ON FUNCTION public.get_obs_internas(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mp_tem_acesso(uuid, uuid)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_conceder_mp(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_excluir_denuncia(uuid) FROM PUBLIC, anon;
