DO $mig$
DECLARE
  r RECORD;
  v_qual text;
  v_check text;
  v_roles text;
  v_sql text;
  f RECORD;
  v_def text;
  v_new text;
BEGIN
  -- 1) Policies
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual,'') || coalesce(with_check,'')) LIKE '%subcorregedor_geral%'
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;

    v_qual := replace(v_qual, '''subcorregedor_geral''::app_role]', '''subcorregedor_geral''::app_role, ''corregedor_supervisor''::app_role]');
    v_qual := replace(v_qual, 'has_role(auth.uid(), ''subcorregedor_geral''::app_role)', '(has_role(auth.uid(), ''subcorregedor_geral''::app_role) OR has_role(auth.uid(), ''corregedor_supervisor''::app_role))');
    v_check := replace(v_check, '''subcorregedor_geral''::app_role]', '''subcorregedor_geral''::app_role, ''corregedor_supervisor''::app_role]');
    v_check := replace(v_check, 'has_role(auth.uid(), ''subcorregedor_geral''::app_role)', '(has_role(auth.uid(), ''subcorregedor_geral''::app_role) OR has_role(auth.uid(), ''corregedor_supervisor''::app_role))');

    IF (coalesce(v_qual,'') || coalesce(v_check,'')) LIKE '%subcorregedor_geral%'
       AND (coalesce(v_qual,'') || coalesce(v_check,'')) NOT LIKE '%corregedor_supervisor%' THEN
      RAISE EXCEPTION 'Padrão não reconhecido na policy %.%', r.tablename, r.policyname;
    END IF;

    v_roles := array_to_string(r.roles, ', ');
    v_sql := format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE v_sql;
    v_sql := format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
                    r.policyname, r.tablename,
                    CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
                    r.cmd, v_roles);
    IF v_qual IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_qual || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;

  -- 2) Functions
  FOR f IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%subcorregedor_geral%'
  LOOP
    v_def := pg_get_functiondef(f.oid);
    v_new := replace(v_def, 'WHEN ''subcorregedor_geral'' THEN 2', 'WHEN ''subcorregedor_geral'' THEN 2 WHEN ''corregedor_supervisor'' THEN 2');
    v_new := replace(v_new, '''subcorregedor_geral'')', '''subcorregedor_geral'',''corregedor_supervisor'')');
    v_new := replace(v_new, '''subcorregedor_geral''::app_role]', '''subcorregedor_geral''::app_role, ''corregedor_supervisor''::app_role]');
    IF v_new NOT LIKE '%corregedor_supervisor%' THEN
      RAISE EXCEPTION 'Padrão não reconhecido na função %', f.oid::regprocedure::text;
    END IF;
    EXECUTE v_new;
  END LOOP;
END
$mig$;