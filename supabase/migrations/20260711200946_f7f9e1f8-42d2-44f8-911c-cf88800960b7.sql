
CREATE OR REPLACE FUNCTION public.pode_excluir_denuncia(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND p.status = 'ativo'
      AND ur.role IN ('delegado_geral','delegado_corregedor')
  );
$$;

DROP POLICY IF EXISTS "Delegados excluem denuncias" ON public.denuncias;
CREATE POLICY "Delegados excluem denuncias"
ON public.denuncias
FOR DELETE
TO authenticated
USING (public.pode_excluir_denuncia(auth.uid()));
