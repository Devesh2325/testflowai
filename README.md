# TestFlow AI

TestFlow AI is an AI-powered SaaS test management platform designed for QA and engineering teams. It brings together test cases, test runs, bug tracking, requirement-to-test generation, automated test summarization, team collaboration, and CI/CD integrations.

---

## 🚀 Features

- **Test Case Management**: Create, categorize, organize, and prioritize test cases with preconditions, steps, expected results, and Gherkin BDD syntax.
- **AI-Powered Test Case Generation**: Automatically convert natural language user stories/requirements into comprehensive test scenarios (positive, negative, edge cases).
- **Screenshot to Test Steps**: Upload UI screenshots to automatically generate structured test cases and workflows.
- **Test Runs & Execution**: Execute test suites across environments/devices, log step statuses (pass/fail/blocked), and track execution logs.
- **AI Test Run Summarization**: Executive summaries highlighting risks, pass/fail trends, and recommended next actions.
- **Bug Tracking**: Built-in bug reporting with AI assistance, severity tracking, linked test cases, and status workflows.
- **Team & Workspace Management**: Role-based access control (Admin, Lead, Tester, Viewer) and multi-project workspaces.
- **Integrations**: Webhook and API notifications for Slack, Microsoft Teams, Jira, GitHub Issues, Jenkins, and Email (Resend).
- **Reports & Analytics**: Visual charts for execution velocity, pass rates, module coverage, and defect density.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide Icons, Recharts
- **Backend / Database**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI Engine**: Google Gemini / OpenAI (direct integration via Edge Functions)

---

## 🏁 Getting Started

### 1. Prerequisites

- Node.js (v18 or higher)
- npm or pnpm or yarn
- Supabase account (or local Supabase CLI)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/Devesh2325/testflowai.git

# Navigate to the project directory
cd testflowai

# Install dependencies
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL="https://<your-supabase-project-id>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-anon-key>"
VITE_SUPABASE_PROJECT_ID="<your-supabase-project-id>"
```

### 4. Supabase Setup & Edge Functions

1. Apply the database migrations located in `supabase/migrations/` to your Supabase project.
2. In Supabase Dashboard -> **Project Settings** -> **Edge Functions** -> **Secrets**, configure your AI API key:
   - `GEMINI_API_KEY`: Your Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))
   - *Optional:* `OPENAI_API_KEY` (if you prefer OpenAI models)
   - *Optional:* `RESEND_API_KEY` (for email notifications)

3. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy generate-bug
   npx supabase functions deploy generate-test-cases
   npx supabase functions deploy screenshot-to-test-steps
   npx supabase functions deploy summarize-test-run
   npx supabase functions deploy send-notification
   ```

### 5. Running the Application

```bash
# Start local development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📂 Project Structure

```
├── src/
│   ├── components/       # Reusable UI components & shadcn primitives
│   ├── contexts/         # Authentication and global state
│   ├── hooks/            # Custom React hooks (workspaces, toast, etc.)
│   ├── integrations/     # Supabase client and types
│   ├── lib/              # Helper utilities
│   ├── pages/            # App routes & views (Dashboard, TestCases, Bugs, etc.)
│   └── main.tsx          # Application entry point
├── supabase/
│   ├── functions/        # Edge functions (AI generation, notifications)
│   └── migrations/       # SQL database schema and RLS policies
└── package.json
```

---

## 📄 License

MIT
