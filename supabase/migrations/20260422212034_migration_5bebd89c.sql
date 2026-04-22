CREATE OR REPLACE FUNCTION public.log_change_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_actor_email text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    SELECT jsonb_object_agg(key, value) INTO v_before
      FROM jsonb_each(to_jsonb(OLD))
      WHERE value IS DISTINCT FROM (to_jsonb(NEW) -> key);
    SELECT jsonb_object_agg(key, value) INTO v_after
      FROM jsonb_each(to_jsonb(NEW))
      WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);
    IF v_before IS NULL OR v_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object('before', v_before, 'after', v_after);
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := to_jsonb(OLD) ->> 'id';
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME, v_entity_id, v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$func$;

CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_actor_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'profile.created' ELSE 'profile.role_changed' END,
    'profile', NEW.id::text,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('role', OLD.role) ELSE NULL END,
      'after', jsonb_build_object('role', NEW.role)
    )
  );

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_role_change();

DROP TRIGGER IF EXISTS on_role_change ON public.roles;
CREATE TRIGGER on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();