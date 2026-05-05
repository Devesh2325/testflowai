import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Projects from "./pages/app/Projects";
import TestCases from "./pages/app/TestCases";
import TestRuns from "./pages/app/TestRuns";
import Bugs from "./pages/app/Bugs";
import AIAssistant from "./pages/app/AIAssistant";
import Learning from "./pages/app/Learning";
import Reports from "./pages/app/Reports";
import Integrations from "./pages/app/Integrations";
import Settings from "./pages/app/Settings";
import Docs from "./pages/app/Docs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="test-cases" element={<TestCases />} />
              <Route path="test-runs" element={<TestRuns />} />
              <Route path="bugs" element={<Bugs />} />
              <Route path="ai" element={<AIAssistant />} />
              <Route path="learning" element={<Learning />} />
              <Route path="reports" element={<Reports />} />
              <Route path="docs" element={<Docs />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
