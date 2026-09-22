CREATE OR REPLACE FUNCTION public.tg_notif_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _proto text;
  _label text;
BEGIN
  IF NEW.especie IN ('evento','cancelamento','certidao') THEN
    RETURN NEW;
  END IF;

  SELECT numero_protocolo INTO _proto FROM public.denuncias WHERE id = NEW.denuncia_id;

  _label := CASE NEW.especie::text
    WHEN 'despacho'    THEN 'Despacho'
    WHEN 'decisao'     THEN 'Decisão'
    WHEN 'ipc'         THEN 'IPM'
    WHEN 'status'      THEN 'Mudança de status'
    WHEN 'retificacao' THEN 'Retificação de denunciado'
    WHEN 'portaria'    THEN 'Portaria Inaugural'
    ELSE NEW.especie::text
  END;

  PERFORM public.notificar_delegados(
    NEW.denuncia_id,
    _label || ' — ' || COALESCE(_proto,''),
    NULL,
    NEW.prolator_id
  );
  RETURN NEW;
END;
$function$;

UPDATE public.notificacoes
SET titulo = regexp_replace(titulo, '\mIPC\M', 'IPM', 'gi'),
    teor = CASE
      WHEN teor IS NULL THEN NULL
      ELSE regexp_replace(teor, '\mIPC\M', 'IPM', 'gi')
    END
WHERE coalesce(titulo, '') ~* '\mIPC\M'
   OR coalesce(teor, '') ~* '\mIPC\M';