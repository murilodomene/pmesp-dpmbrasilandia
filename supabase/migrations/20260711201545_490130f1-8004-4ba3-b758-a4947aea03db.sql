
ALTER TABLE public.pdo_contador ENABLE ROW LEVEL SECURITY;
-- Sem policies: só service_role/security definer acessa (a função gerar_numero_pdo).
