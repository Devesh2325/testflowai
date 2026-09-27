-- Autonomous Agentic QA Platform Schema Migration
-- Defines entities for Missions, Agent Observability, Application Maps, Self-Healing, and Agent Memory

-- 1. QA Missions
CREATE TABLE IF NOT EXISTS public.qa_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  objective TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'staging',
  browser TEXT NOT NULL DEFAULT 'chrome',
  device TEXT NOT NULL DEFAULT 'desktop',
  scope TEXT[] NOT NULL DEFAULT ARRAY['functional'],
  status TEXT NOT NULL DEFAULT 'created',
  auth_required BOOLEAN NOT NULL DEFAULT false,
  auth_config JSONB,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace missions" ON public.qa_missions
  FOR ALL USING (auth.uid() = owner_id);

-- 2. Agent Steps & Observability Traces
CREATE TABLE IF NOT EXISTS public.agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.qa_missions(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  tool TEXT,
  tool_input JSONB,
  tool_output JSONB,
  duration_ms INTEGER,
  observed_state TEXT,
  evidence_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agent steps for their missions" ON public.agent_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_missions WHERE id = agent_steps.mission_id AND owner_id = auth.uid())
  );

-- 3. Application Maps
CREATE TABLE IF NOT EXISTS public.application_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL,
  pages JSONB NOT NULL DEFAULT '[]',
  workflows JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.application_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage application maps" ON public.application_maps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = application_maps.project_id AND owner_id = auth.uid())
  );

-- 4. Self-Healing Events
CREATE TABLE IF NOT EXISTS public.self_healing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.qa_missions(id) ON DELETE CASCADE,
  scenario_id TEXT,
  original_locator TEXT NOT NULL,
  healed_locator TEXT NOT NULL,
  strategy TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 80,
  applied BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.self_healing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view self healing events" ON public.self_healing_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.qa_missions WHERE id = self_healing_events.mission_id AND owner_id = auth.uid())
  );

-- 5. Agent Memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL, -- 'workflow', 'locator', 'unstable_area', 'auth'
  key TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, memory_type, key)
);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage agent memory" ON public.agent_memory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = agent_memory.project_id AND owner_id = auth.uid())
  );
