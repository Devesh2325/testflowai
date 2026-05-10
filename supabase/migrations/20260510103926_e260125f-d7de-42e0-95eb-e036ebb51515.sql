
-- 1) BACKFILL workspace_id on child tables from parents
UPDATE public.bug_comments bc SET workspace_id = b.workspace_id
  FROM public.bugs b WHERE bc.bug_id = b.id AND bc.workspace_id IS NULL;

UPDATE public.test_executions te SET workspace_id = tr.workspace_id
  FROM public.test_runs tr WHERE te.run_id = tr.id AND te.workspace_id IS NULL;

UPDATE public.document_shares ds SET workspace_id = d.workspace_id
  FROM public.documents d WHERE ds.document_id = d.id AND ds.workspace_id IS NULL;

-- For integrations / tags / ai_history / learning_progress / notification_log,
-- backfill from the user's current workspace
UPDATE public.integrations i SET workspace_id = p.current_workspace_id
  FROM public.profiles p WHERE i.user_id = p.id AND i.workspace_id IS NULL AND p.current_workspace_id IS NOT NULL;

UPDATE public.tags t SET workspace_id = p.current_workspace_id
  FROM public.profiles p WHERE t.owner_id = p.id AND t.workspace_id IS NULL AND p.current_workspace_id IS NOT NULL;

UPDATE public.ai_history a SET workspace_id = p.current_workspace_id
  FROM public.profiles p WHERE a.user_id = p.id AND a.workspace_id IS NULL AND p.current_workspace_id IS NOT NULL;

UPDATE public.learning_progress l SET workspace_id = p.current_workspace_id
  FROM public.profiles p WHERE l.user_id = p.id AND l.workspace_id IS NULL AND p.current_workspace_id IS NOT NULL;

-- 2) Make workspace_id NOT NULL on business tables (only when fully backfilled)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bug_comments WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.bug_comments ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.test_executions WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.test_executions ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tags WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.tags ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.integrations WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.integrations ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.document_shares WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.document_shares ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END $$;

-- 3) TIGHTEN RLS — drop any "workspace_id IS NULL OR" escape hatches

-- bug_comments
DROP POLICY IF EXISTS "bug_comments ws members" ON public.bug_comments;
CREATE POLICY "bug_comments ws members" ON public.bug_comments
  FOR ALL TO public
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

-- integrations
DROP POLICY IF EXISTS "integrations ws members" ON public.integrations;
CREATE POLICY "integrations ws members" ON public.integrations
  FOR ALL TO public
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);

-- tags
DROP POLICY IF EXISTS "tags ws members" ON public.tags;
CREATE POLICY "tags ws members" ON public.tags
  FOR ALL TO public
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

-- test_executions
DROP POLICY IF EXISTS "exec ws members" ON public.test_executions;
CREATE POLICY "exec ws members" ON public.test_executions
  FOR ALL TO public
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

-- document_shares (keep recipient view, but tighten the membership policy)
DROP POLICY IF EXISTS "shares ws members" ON public.document_shares;
CREATE POLICY "shares ws members" ON public.document_shares
  FOR ALL TO public
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = owner_id);

-- ai_history (per-user, but also lock to workspace when present)
DROP POLICY IF EXISTS "ai owner all" ON public.ai_history;
CREATE POLICY "ai owner ws" ON public.ai_history
  FOR ALL TO public
  USING (auth.uid() = user_id AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id)))
  WITH CHECK (auth.uid() = user_id);

-- learning_progress (per-user)
DROP POLICY IF EXISTS "learning owner all" ON public.learning_progress;
CREATE POLICY "learning owner ws" ON public.learning_progress
  FOR ALL TO public
  USING (auth.uid() = user_id AND (workspace_id IS NULL OR is_workspace_member(auth.uid(), workspace_id)))
  WITH CHECK (auth.uid() = user_id);

-- 4) AUTO-FILL workspace_id from active profile on every business table
DROP TRIGGER IF EXISTS trg_set_ws_projects ON public.projects;
CREATE TRIGGER trg_set_ws_projects BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_modules ON public.modules;
CREATE TRIGGER trg_set_ws_modules BEFORE INSERT ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_test_cases ON public.test_cases;
CREATE TRIGGER trg_set_ws_test_cases BEFORE INSERT ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_test_runs ON public.test_runs;
CREATE TRIGGER trg_set_ws_test_runs BEFORE INSERT ON public.test_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_test_executions ON public.test_executions;
CREATE TRIGGER trg_set_ws_test_executions BEFORE INSERT ON public.test_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_bugs ON public.bugs;
CREATE TRIGGER trg_set_ws_bugs BEFORE INSERT ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_bug_comments ON public.bug_comments;
CREATE TRIGGER trg_set_ws_bug_comments BEFORE INSERT ON public.bug_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_documents ON public.documents;
CREATE TRIGGER trg_set_ws_documents BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_document_shares ON public.document_shares;
CREATE TRIGGER trg_set_ws_document_shares BEFORE INSERT ON public.document_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_tags ON public.tags;
CREATE TRIGGER trg_set_ws_tags BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_integrations ON public.integrations;
CREATE TRIGGER trg_set_ws_integrations BEFORE INSERT ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_ai_history ON public.ai_history;
CREATE TRIGGER trg_set_ws_ai_history BEFORE INSERT ON public.ai_history
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_learning ON public.learning_progress;
CREATE TRIGGER trg_set_ws_learning BEFORE INSERT ON public.learning_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

DROP TRIGGER IF EXISTS trg_set_ws_notifications ON public.notifications;
CREATE TRIGGER trg_set_ws_notifications BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_from_profile();

-- 5) Validate child workspace matches parent (prevents cross-workspace linking)
CREATE OR REPLACE FUNCTION public.validate_bug_comment_ws()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pw uuid;
BEGIN
  SELECT workspace_id INTO pw FROM public.bugs WHERE id = NEW.bug_id;
  IF pw IS NULL OR pw <> NEW.workspace_id THEN
    RAISE EXCEPTION 'Bug comment workspace must match parent bug workspace';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_bug_comment_ws ON public.bug_comments;
CREATE TRIGGER trg_validate_bug_comment_ws BEFORE INSERT OR UPDATE ON public.bug_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_bug_comment_ws();

CREATE OR REPLACE FUNCTION public.validate_test_execution_ws()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pw uuid;
BEGIN
  SELECT workspace_id INTO pw FROM public.test_runs WHERE id = NEW.run_id;
  IF pw IS NULL OR pw <> NEW.workspace_id THEN
    RAISE EXCEPTION 'Execution workspace must match parent run workspace';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_test_execution_ws ON public.test_executions;
CREATE TRIGGER trg_validate_test_execution_ws BEFORE INSERT OR UPDATE ON public.test_executions
  FOR EACH ROW EXECUTE FUNCTION public.validate_test_execution_ws();

CREATE OR REPLACE FUNCTION public.validate_document_share_ws()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pw uuid;
BEGIN
  SELECT workspace_id INTO pw FROM public.documents WHERE id = NEW.document_id;
  IF pw IS NULL OR pw <> NEW.workspace_id THEN
    RAISE EXCEPTION 'Share workspace must match document workspace';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_document_share_ws ON public.document_shares;
CREATE TRIGGER trg_validate_document_share_ws BEFORE INSERT OR UPDATE ON public.document_shares
  FOR EACH ROW EXECUTE FUNCTION public.validate_document_share_ws();

-- 6) Reuse existing updated_at trigger on tables that have it
DROP TRIGGER IF EXISTS trg_updated_at_workspaces ON public.workspaces;
CREATE TRIGGER trg_updated_at_workspaces BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
