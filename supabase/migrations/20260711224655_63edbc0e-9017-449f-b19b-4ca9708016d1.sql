ALTER TYPE public.denuncia_status ADD VALUE IF NOT EXISTS 'ag_decurso_prazo';
ALTER TYPE public.denuncia_status ADD VALUE IF NOT EXISTS 'transito_julgado';
ALTER TYPE public.movimento_especie ADD VALUE IF NOT EXISTS 'certidao';
ALTER TYPE public.movimento_especie ADD VALUE IF NOT EXISTS 'evento';