
DROP POLICY IF EXISTS "enquiries public insert" ON public.enquiries;
CREATE POLICY "enquiries public insert" ON public.enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(coalesce(name,'')) > 0
    AND length(coalesce(email,'')) > 3
    AND length(coalesce(subject,'')) > 0
    AND length(coalesce(message,'')) > 0
  );
