
CREATE TABLE IF NOT EXISTS public.enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enquiries public insert" ON public.enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "enquiries owner read" ON public.enquiries FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "enquiries admin update" ON public.enquiries FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
