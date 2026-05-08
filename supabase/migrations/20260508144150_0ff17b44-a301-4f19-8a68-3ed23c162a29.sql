
-- 1. WORKSPACES
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'tester',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions (security definer, no recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id)
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = _role)
$$;

-- Workspaces RLS
CREATE POLICY "ws members view" ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(auth.uid(), id));
CREATE POLICY "ws owner manage" ON public.workspaces FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- workspace_members RLS
CREATE POLICY "wm self select" ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "wm admin manage" ON public.workspace_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR public.has_workspace_role(auth.uid(), workspace_id, 'admin')
  );

-- 3. Add workspace_id to all owned tables + current_workspace_id on profiles
ALTER TABLE public.profiles ADD COLUMN current_workspace_id uuid;

ALTER TABLE public.projects ADD COLUMN workspace_id uuid;
ALTER TABLE public.modules ADD COLUMN workspace_id uuid;
ALTER TABLE public.documents ADD COLUMN workspace_id uuid;
ALTER TABLE public.document_shares ADD COLUMN workspace_id uuid;
ALTER TABLE public.test_cases ADD COLUMN workspace_id uuid;
ALTER TABLE public.test_runs ADD COLUMN workspace_id uuid;
ALTER TABLE public.test_executions ADD COLUMN workspace_id uuid;
ALTER TABLE public.bugs ADD COLUMN workspace_id uuid;
ALTER TABLE public.bug_comments ADD COLUMN workspace_id uuid;
ALTER TABLE public.tags ADD COLUMN workspace_id uuid;
ALTER TABLE public.integrations ADD COLUMN workspace_id uuid;
ALTER TABLE public.notifications ADD COLUMN workspace_id uuid;
ALTER TABLE public.notification_log ADD COLUMN workspace_id uuid;
ALTER TABLE public.ai_history ADD COLUMN workspace_id uuid;
ALTER TABLE public.learning_progress ADD COLUMN workspace_id uuid;
ALTER TABLE public.invitations ADD COLUMN workspace_id uuid;

-- 4. Backfill: create one workspace per existing user (from profiles)
DO $$
DECLARE r record; ws_id uuid;
BEGIN
  FOR r IN SELECT id, COALESCE(full_name, email, 'My') AS nm FROM public.profiles LOOP
    INSERT INTO public.workspaces (name, owner_id) VALUES (r.nm || '''s Workspace', r.id) RETURNING id INTO ws_id;
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
      SELECT ws_id, r.id, COALESCE((SELECT role FROM public.user_roles WHERE user_id = r.id ORDER BY role LIMIT 1), 'admin'::app_role)
      ON CONFLICT DO NOTHING;
    -- Ensure owner is admin
    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws_id, r.id, 'admin')
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin';
    UPDATE public.profiles SET current_workspace_id = ws_id WHERE id = r.id;

    UPDATE public.projects SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.modules SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.documents SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.document_shares SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.test_cases SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.test_runs SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.test_executions SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.bugs SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.bug_comments SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.tags SET workspace_id = ws_id WHERE owner_id = r.id AND workspace_id IS NULL;
    UPDATE public.integrations SET workspace_id = ws_id WHERE user_id = r.id AND workspace_id IS NULL;
    UPDATE public.notifications SET workspace_id = ws_id WHERE user_id = r.id AND workspace_id IS NULL;
    UPDATE public.notification_log SET workspace_id = ws_id WHERE user_id = r.id AND workspace_id IS NULL;
    UPDATE public.ai_history SET workspace_id = ws_id WHERE user_id = r.id AND workspace_id IS NULL;
    UPDATE public.learning_progress SET workspace_id = ws_id WHERE user_id = r.id AND workspace_id IS NULL;
    UPDATE public.invitations SET workspace_id = ws_id WHERE invited_by = r.id AND workspace_id IS NULL;
  END LOOP;
END $$;

-- 5. Make workspace_id NOT NULL on key tables (skip nullable rows with no owner)
ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.modules ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.test_cases ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.test_runs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.bugs ALTER COLUMN workspace_id SET NOT NULL;

-- 6. Update RLS policies: drop owner-only, add membership-based (still keep owner write where reasonable)
DROP POLICY IF EXISTS "projects owner all" ON public.projects;
CREATE POLICY "projects ws members" ON public.projects FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "modules owner all" ON public.modules;
CREATE POLICY "modules ws members" ON public.modules FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "docs owner all" ON public.documents;
DROP POLICY IF EXISTS "docs shared edit" ON public.documents;
DROP POLICY IF EXISTS "docs shared view" ON public.documents;
CREATE POLICY "docs ws members" ON public.documents FOR ALL
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);
CREATE POLICY "docs shared view" ON public.documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM document_shares s WHERE s.document_id = documents.id AND (s.shared_with_user_id = auth.uid() OR s.shared_with_email = (SELECT email FROM profiles WHERE id = auth.uid()))));

DROP POLICY IF EXISTS "shares owner all" ON public.document_shares;
DROP POLICY IF EXISTS "shares recipient view" ON public.document_shares;
CREATE POLICY "shares ws members" ON public.document_shares FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id) OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "shares recipient view" ON public.document_shares FOR SELECT
  USING (shared_with_user_id = auth.uid() OR shared_with_email = (SELECT email FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tc owner all" ON public.test_cases;
CREATE POLICY "tc ws members" ON public.test_cases FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "runs owner all" ON public.test_runs;
CREATE POLICY "runs ws members" ON public.test_runs FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "exec owner all" ON public.test_executions;
CREATE POLICY "exec ws members" ON public.test_executions FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "bugs owner all" ON public.bugs;
CREATE POLICY "bugs ws members" ON public.bugs FOR ALL
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "bug_comments owner all" ON public.bug_comments;
CREATE POLICY "bug_comments ws members" ON public.bug_comments FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tags owner all" ON public.tags;
CREATE POLICY "tags ws members" ON public.tags FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "integrations owner all" ON public.integrations;
CREATE POLICY "integrations ws members" ON public.integrations FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (auth.uid() = user_id);

-- invitations: keep, but admin/manager of workspace can manage
DROP POLICY IF EXISTS "invites owner all" ON public.invitations;
CREATE POLICY "invites ws admin manage" ON public.invitations FOR ALL
  USING (
    auth.uid() = invited_by
    OR (workspace_id IS NOT NULL AND (
      public.has_workspace_role(auth.uid(), workspace_id, 'admin')
      OR public.has_workspace_role(auth.uid(), workspace_id, 'manager')
    ))
  )
  WITH CHECK (auth.uid() = invited_by);

-- 7. Update handle_new_user: create personal workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid; nm text;
BEGIN
  nm := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  INSERT INTO public.profiles (id, email, full_name) VALUES (new.id, new.email, nm)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'tester')
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.workspaces (name, owner_id) VALUES (nm || '''s Workspace', new.id) RETURNING id INTO ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (ws_id, new.id, 'admin');
  UPDATE public.profiles SET current_workspace_id = ws_id WHERE id = new.id;
  RETURN new;
END $$;

-- 8. Update apply_invitation_on_signup: add to inviter's workspace
CREATE OR REPLACE FUNCTION public.apply_invitation_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record;
BEGIN
  SELECT * INTO inv FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF inv.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, inv.role)
      ON CONFLICT (user_id, role) DO NOTHING;
    IF inv.workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (inv.workspace_id, NEW.id, inv.role)
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = inv.role;
      -- Switch active workspace to the one they were invited to
      UPDATE public.profiles SET current_workspace_id = inv.workspace_id WHERE id = NEW.id;
    END IF;
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    INSERT INTO public.notifications (user_id, title, body, kind)
      VALUES (inv.invited_by, 'Invitation accepted', NEW.email || ' joined as ' || inv.role::text, 'invite');
  END IF;
  RETURN NEW;
END $$;

-- 9. Auto-set workspace_id on insert when missing (use inviter's current_workspace_id)
CREATE OR REPLACE FUNCTION public.set_workspace_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT current_workspace_id INTO NEW.workspace_id FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['projects','modules','documents','test_cases','test_runs','test_executions','bugs','bug_comments','tags','document_shares']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_ws_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER set_ws_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile()', t, t);
  END LOOP;
END $$;
