CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
  nome_val TEXT;
  matricula_val TEXT;
  tipo_val TEXT;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO is_first;

  tipo_val := COALESCE(NEW.raw_user_meta_data->>'tipo', 'staff');
  nome_val := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email);
  matricula_val := COALESCE(NEW.raw_user_meta_data->>'matricula', '');

  IF tipo_val = 'cidadao' THEN
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, '', 'ativo'::public.profile_status);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cidadao');
  ELSIF tipo_val = 'mp' THEN
    -- MP agora exige aprovação do Delegado Corregedor/Coordenador.
    -- Cria o perfil como PENDENTE e NÃO atribui cargo até aprovação.
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (NEW.id, nome_val, matricula_val, 'pendente'::public.profile_status);
  ELSE
    INSERT INTO public.profiles (id, nome, matricula, status)
    VALUES (
      NEW.id, nome_val, matricula_val,
      CASE WHEN is_first THEN 'ativo'::public.profile_status
           ELSE 'pendente'::public.profile_status END
    );
    IF is_first THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'delegado_corregedor');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;