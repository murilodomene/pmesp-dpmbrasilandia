
-- 1) Column for attachments on movimentos
ALTER TABLE public.movimentos
  ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Storage policies for bucket "atos-anexos"
-- Path convention: {denuncia_id}/{uuid}-{filename}

-- Read: active staff, or MP with access to the denuncia
CREATE POLICY "atos_anexos_select_autorizado"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'atos-anexos'
  AND (
    public.is_active_staff(auth.uid())
    OR public.mp_tem_acesso(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

-- Insert: active staff only
CREATE POLICY "atos_anexos_insert_staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'atos-anexos'
  AND public.is_active_staff(auth.uid())
);

-- Delete: active staff (para limpar órfãos)
CREATE POLICY "atos_anexos_delete_staff"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'atos-anexos'
  AND public.is_active_staff(auth.uid())
);
