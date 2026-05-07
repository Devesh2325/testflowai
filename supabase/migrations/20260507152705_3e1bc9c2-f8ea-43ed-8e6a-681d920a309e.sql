
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags owner all" ON public.tags;
CREATE POLICY "tags owner all" ON public.tags FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'tester',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (lower(email));
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invites owner all" ON public.invitations;
CREATE POLICY "invites owner all" ON public.invitations FOR ALL USING (auth.uid() = invited_by) WITH CHECK (auth.uid() = invited_by);
DROP POLICY IF EXISTS "invites recipient read" ON public.invitations;
CREATE POLICY "invites recipient read" ON public.invitations FOR SELECT
  USING (lower(email) = lower(coalesce((SELECT email FROM public.profiles WHERE id = auth.uid()), '')));

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs owner all" ON public.notifications;
CREATE POLICY "notifs owner all" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifs public insert" ON public.notifications;
CREATE POLICY "notifs public insert" ON public.notifications FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.apply_invitation_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF inv.id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, inv.role);
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    INSERT INTO public.notifications (user_id, title, body, kind)
      VALUES (inv.invited_by, 'Invitation accepted', NEW.email || ' joined as ' || inv.role::text, 'invite');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apply_invitation_trigger ON auth.users;
CREATE TRIGGER apply_invitation_trigger AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_invitation_on_signup();

CREATE OR REPLACE FUNCTION public.notify_admins_on_enquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link, kind)
  SELECT ur.user_id, 'New enquiry: ' || NEW.subject,
         NEW.name || ' (' || NEW.email || ') — ' || left(NEW.message, 140),
         '/app/enquiries', 'enquiry'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_enquiry_trigger ON public.enquiries;
CREATE TRIGGER notify_enquiry_trigger AFTER INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_enquiry();

DROP POLICY IF EXISTS "roles admin manage" ON public.user_roles;
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Avatar storage: ensure upsert from authenticated users works regardless of folder format
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars auth write" ON storage.objects;
CREATE POLICY "avatars auth write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "avatars auth update" ON storage.objects;
CREATE POLICY "avatars auth update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "avatars auth delete" ON storage.objects;
CREATE POLICY "avatars auth delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
