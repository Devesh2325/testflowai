
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'tester')
  on conflict (user_id, role) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_invitation_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF inv.id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, inv.role)
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    INSERT INTO public.notifications (user_id, title, body, kind)
      VALUES (inv.invited_by, 'Invitation accepted', NEW.email || ' joined as ' || inv.role::text, 'invite');
  END IF;
  RETURN NEW;
END $function$;
