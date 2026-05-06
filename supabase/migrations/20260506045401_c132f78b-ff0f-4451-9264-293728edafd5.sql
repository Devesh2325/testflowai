
-- Bugs detail fields
ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS steps_to_reproduce text,
  ADD COLUMN IF NOT EXISTS expected_result text,
  ADD COLUMN IF NOT EXISTS actual_result text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS app_version text,
  ADD COLUMN IF NOT EXISTS assignee_email text,
  ADD COLUMN IF NOT EXISTS reporter_email text,
  ADD COLUMN IF NOT EXISTS module_id uuid,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

-- Bug comments
CREATE TABLE IF NOT EXISTS public.bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  author_email text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bug_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bug_comments owner all" ON public.bug_comments
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Notification log
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  title text,
  message text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif owner all" ON public.notification_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Profile extras
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS timezone text;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bug-attachments', 'bug-attachments', false)
  ON CONFLICT (id) DO NOTHING;

-- Avatar policies (public read, user write own folder)
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Bug attachment policies (private, owner only)
CREATE POLICY "bug-attach user read" ON storage.objects FOR SELECT
  USING (bucket_id = 'bug-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bug-attach user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bug-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bug-attach user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'bug-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "bug-attach user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'bug-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow profile insert (in case trigger doesn't run)
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
