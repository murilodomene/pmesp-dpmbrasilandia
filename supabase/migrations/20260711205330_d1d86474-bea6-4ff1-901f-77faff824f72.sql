-- 1. Novo valor no enum
ALTER TYPE public.movimento_especie ADD VALUE IF NOT EXISTS 'cancelamento';

-- 2. Colunas de cancelamento em movimentos
ALTER TABLE public.movimentos
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancelado_por_nome text,
  ADD COLUMN IF NOT EXISTS cancelado_por_cargo app_role,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;
