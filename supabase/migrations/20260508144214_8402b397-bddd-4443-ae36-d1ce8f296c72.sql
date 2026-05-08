
ALTER TABLE public.projects ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.modules ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.test_cases ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.test_runs ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE public.bugs ALTER COLUMN workspace_id DROP NOT NULL;
