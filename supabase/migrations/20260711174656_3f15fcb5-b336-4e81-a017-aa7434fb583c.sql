
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_delegado(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_cargo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_protocolo() FROM public;
GRANT EXECUTE ON FUNCTION public.gerar_protocolo() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_delegado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_cargo(uuid) TO authenticated;
