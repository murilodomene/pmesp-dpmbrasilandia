ALTER TYPE public.app_role RENAME VALUE 'delegado_corregedor' TO 'corregedor_geral';
ALTER TYPE public.app_role RENAME VALUE 'coordenador' TO 'subcorregedor_geral';
ALTER TYPE public.app_role RENAME VALUE 'delegado_geral' TO 'ssp';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cmtg';