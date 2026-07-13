
-- Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS discord_id text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS foto_path text;

-- Storage RLS for avatars bucket
CREATE POLICY "avatars_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Corregedor pode gerenciar todos avatares
CREATE POLICY "avatars_all_corregedor"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'delegado_corregedor'))
  WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'delegado_corregedor'));
