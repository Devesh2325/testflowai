
-- 1) Attach the notify-on-enquiry trigger so super-admins get a notification
DROP TRIGGER IF EXISTS trg_notify_admins_on_enquiry ON public.enquiries;
CREATE TRIGGER trg_notify_admins_on_enquiry
AFTER INSERT ON public.enquiries
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_enquiry();

-- 2) Promote every existing workspace owner to global "admin" so they can see enquiries
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT owner_id, 'admin'::app_role FROM public.workspaces
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Update handle_new_user so the very first user signing up becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ws_id uuid; nm text; user_count int;
BEGIN
  nm := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  INSERT INTO public.profiles (id, email, full_name) VALUES (new.id, new.email, nm)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'tester')
    ON CONFLICT (user_id, role) DO NOTHING;
  SELECT count(*) INTO user_count FROM public.profiles;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.workspaces (name, owner_id) VALUES (nm || '''s Workspace', new.id) RETURNING id INTO ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws_id, new.id, 'admin');
  UPDATE public.profiles SET current_workspace_id = ws_id WHERE id = new.id;
  RETURN new;
END $function$;

-- 4) RPC so an existing logged-in user can accept an invitation by token
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv record; uid uuid; uemail text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT email INTO uemail FROM public.profiles WHERE id = uid;
  SELECT * INTO inv FROM public.invitations WHERE token = _token LIMIT 1;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF lower(inv.email) <> lower(COALESCE(uemail, '')) THEN
    RAISE EXCEPTION 'This invite is for %, you are signed in as %', inv.email, uemail;
  END IF;
  IF inv.workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (inv.workspace_id, uid, inv.role)
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = inv.role;
    UPDATE public.profiles SET current_workspace_id = inv.workspace_id WHERE id = uid;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id AND accepted_at IS NULL;
  INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (inv.invited_by, 'Invitation accepted', uemail || ' joined your workspace as ' || inv.role::text, 'invite');
  RETURN jsonb_build_object('workspace_id', inv.workspace_id, 'role', inv.role);
END $$;
