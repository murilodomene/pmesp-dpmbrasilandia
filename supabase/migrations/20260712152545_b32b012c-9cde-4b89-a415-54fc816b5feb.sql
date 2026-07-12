
CREATE TABLE public.denuncia_tarjas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  cor text NOT NULL CHECK (cor IN ('vermelho','amarelo','verde','azul')),
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 26),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_denuncia_tarjas_denuncia ON public.denuncia_tarjas(denuncia_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.denuncia_tarjas TO authenticated;
GRANT ALL ON public.denuncia_tarjas TO service_role;

ALTER TABLE public.denuncia_tarjas ENABLE ROW LEVEL SECURITY;

-- SELECT: staff interno OU MP com acesso ao procedimento
CREATE POLICY "tarjas_select_staff_ou_mp"
  ON public.denuncia_tarjas FOR SELECT
  TO authenticated
  USING (
    public.is_active_staff(auth.uid())
    OR public.mp_tem_acesso(auth.uid(), denuncia_id)
  );

-- INSERT / UPDATE / DELETE: apenas Corregedor e Delegado Corregedor
CREATE POLICY "tarjas_insert_corregedor"
  ON public.denuncia_tarjas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'corregedor'::app_role)
    OR public.has_role(auth.uid(), 'delegado_corregedor'::app_role)
  );

CREATE POLICY "tarjas_update_corregedor"
  ON public.denuncia_tarjas FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'corregedor'::app_role)
    OR public.has_role(auth.uid(), 'delegado_corregedor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'corregedor'::app_role)
    OR public.has_role(auth.uid(), 'delegado_corregedor'::app_role)
  );

CREATE POLICY "tarjas_delete_corregedor"
  ON public.denuncia_tarjas FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'corregedor'::app_role)
    OR public.has_role(auth.uid(), 'delegado_corregedor'::app_role)
  );

-- Trigger: no máximo 2 tarjas por procedimento
CREATE OR REPLACE FUNCTION public.tg_limitar_tarjas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _n int;
BEGIN
  SELECT count(*) INTO _n FROM public.denuncia_tarjas WHERE denuncia_id = NEW.denuncia_id;
  IF _n >= 2 THEN
    RAISE EXCEPTION 'Este procedimento já possui 2 tarjas. Remova uma antes de adicionar outra.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tarjas_limite_2
  BEFORE INSERT ON public.denuncia_tarjas
  FOR EACH ROW EXECUTE FUNCTION public.tg_limitar_tarjas();

-- updated_at
CREATE OR REPLACE FUNCTION public.tg_tarjas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tarjas_touch_updated_at
  BEFORE UPDATE ON public.denuncia_tarjas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarjas_updated_at();
