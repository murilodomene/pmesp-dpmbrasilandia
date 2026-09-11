ALTER TABLE public.movimentos
ADD COLUMN IF NOT EXISTS portaria_dados jsonb;

COMMENT ON COLUMN public.movimentos.portaria_dados IS 'Dados estruturados e chave identificadora persistente do documento Portaria.';