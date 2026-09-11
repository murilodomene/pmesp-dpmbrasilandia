DO $migration$
DECLARE
  r record;
  ddl text;
BEGIN
  FOR r IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.prosrc ~ 'delegado_(geral|corregedor)|coordenador'
  LOOP
    ddl := pg_get_functiondef(r.oid);
    ddl := replace(ddl, $q$'delegado_corregedor'$q$, $q$'corregedor_geral'$q$);
    ddl := replace(ddl, $q$'coordenador'$q$, $q$'subcorregedor_geral'$q$);
    ddl := replace(ddl, $q$'delegado_geral'$q$, $q$'ssp'$q$);
    ddl := replace(ddl, $q$'ssp','corregedor_geral','corregedor','subcorregedor_geral'$q$, $q$'ssp','cmtg','corregedor_geral','corregedor','subcorregedor_geral'$q$);
    ddl := replace(ddl, $q$'corregedor_geral','ssp','subcorregedor_geral'$q$, $q$'corregedor_geral','ssp','cmtg','subcorregedor_geral'$q$);
    ddl := replace(ddl, $q$'ssp','corregedor_geral','subcorregedor_geral'$q$, $q$'ssp','cmtg','corregedor_geral','subcorregedor_geral'$q$);
    ddl := replace(ddl, $q$WHEN 'ssp' THEN 3$q$, $q$WHEN 'ssp' THEN 3
    WHEN 'cmtg' THEN 3$q$);
    EXECUTE ddl;
  END LOOP;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nome_val text;
  matricula_val text;
  tipo_val text;
BEGIN
  tipo_val := COALESCE(NEW.raw_user_meta_data->>'tipo', 'staff');
  nome_val := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  matricula_val := COALESCE(NEW.raw_user_meta_data->>'matricula', '');

  IF tipo_val = 'cidadao' THEN
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, '', 'ativo'::public.profile_status);
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cidadao'::public.app_role);
  ELSE
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, matricula_val, 'pendente'::public.profile_status);
  END IF;

  RETURN NEW;
END;
$function$;

DO $policies$
DECLARE
  r record;
  policy_name text;
  role_clause text;
  using_clause text;
  check_clause text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname IN ('public', 'storage')
       AND (COALESCE(qual, '') LIKE '%''ssp''::app_role%'
         OR COALESCE(with_check, '') LIKE '%''ssp''::app_role%')
  LOOP
    policy_name := r.policyname || ' — CMTG';
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_name, r.schemaname, r.tablename);
    role_clause := CASE
      WHEN r.roles = ARRAY['public']::name[] THEN ''
      ELSE ' TO ' || array_to_string(r.roles, ', ')
    END;
    using_clause := CASE WHEN r.qual IS NULL THEN ''
      ELSE ' USING (' || replace(r.qual, '''ssp''::app_role', '''cmtg''::app_role') || ')' END;
    check_clause := CASE WHEN r.with_check IS NULL THEN ''
      ELSE ' WITH CHECK (' || replace(r.with_check, '''ssp''::app_role', '''cmtg''::app_role') || ')' END;
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s%s%s%s',
      policy_name, r.schemaname, r.tablename, r.permissive, r.cmd,
      role_clause, using_clause, check_clause
    );
  END LOOP;
END;
$policies$;

DROP POLICY IF EXISTS "avatars_all_subcorregedor_geral" ON storage.objects;
CREATE POLICY "avatars_all_subcorregedor_geral"
ON storage.objects
AS PERMISSIVE
FOR ALL
TO authenticated
USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'subcorregedor_geral'::public.app_role))
WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'subcorregedor_geral'::public.app_role));