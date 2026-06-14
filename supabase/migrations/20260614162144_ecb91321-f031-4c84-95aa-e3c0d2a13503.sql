
-- 1) Notifications: remove permissive public insert
DROP POLICY IF EXISTS "notifs public insert" ON public.notifications;
CREATE POLICY "notifs self insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2) Storage: drop overly broad avatar policies + public listing
DROP POLICY IF EXISTS "avatars auth delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth update" ON storage.objects;
DROP POLICY IF EXISTS "avatars auth write" ON storage.objects;
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

-- 3) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_invitation_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_enquiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_workspace_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_bug_comment_ws() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_document_share_ws() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_test_execution_ws() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
-- accept_invitation must be callable by signed-in users via RPC
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
