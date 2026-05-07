export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_history: {
        Row: {
          created_at: string
          id: string
          kind: string | null
          prompt: string
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string | null
          prompt: string
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string | null
          prompt?: string
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bug_comments: {
        Row: {
          author_email: string | null
          body: string
          bug_id: string
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          author_email?: string | null
          body: string
          bug_id: string
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          author_email?: string | null
          body?: string
          bug_id?: string
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      bugs: {
        Row: {
          actual_result: string | null
          app_version: string | null
          assignee_email: string | null
          attachments: Json
          browser: string | null
          created_at: string
          description: string | null
          device: string | null
          environment: string | null
          expected_result: string | null
          id: string
          linked_test_case: string | null
          module_id: string | null
          owner_id: string
          priority: Database["public"]["Enums"]["bug_priority"]
          project_id: string
          reporter_email: string | null
          run_id: string | null
          severity: Database["public"]["Enums"]["bug_severity"]
          status: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          actual_result?: string | null
          app_version?: string | null
          assignee_email?: string | null
          attachments?: Json
          browser?: string | null
          created_at?: string
          description?: string | null
          device?: string | null
          environment?: string | null
          expected_result?: string | null
          id?: string
          linked_test_case?: string | null
          module_id?: string | null
          owner_id: string
          priority?: Database["public"]["Enums"]["bug_priority"]
          project_id: string
          reporter_email?: string | null
          run_id?: string | null
          severity?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          actual_result?: string | null
          app_version?: string | null
          assignee_email?: string | null
          attachments?: Json
          browser?: string | null
          created_at?: string
          description?: string | null
          device?: string | null
          environment?: string | null
          expected_result?: string | null
          id?: string
          linked_test_case?: string | null
          module_id?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["bug_priority"]
          project_id?: string
          reporter_email?: string | null
          run_id?: string | null
          severity?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          steps_to_reproduce?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bugs_linked_test_case_fkey"
            columns: ["linked_test_case"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bugs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bugs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          created_at: string
          document_id: string
          id: string
          owner_id: string
          permission: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          owner_id: string
          permission?: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          owner_id?: string
          permission?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          created_at: string
          id: string
          owner_id: string
          project_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          topic: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          topic: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string | null
          payload: Json | null
          provider: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          provider: string
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          provider?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          timezone: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          timezone?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          owner_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
        }
        Relationships: []
      }
      test_cases: {
        Row: {
          created_at: string
          expected_result: string | null
          id: string
          module_id: string | null
          owner_id: string
          preconditions: string | null
          priority: Database["public"]["Enums"]["test_priority"]
          project_id: string
          status: Database["public"]["Enums"]["test_status"]
          steps: string | null
          tags: string[] | null
          title: string
          type: Database["public"]["Enums"]["test_type"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          expected_result?: string | null
          id?: string
          module_id?: string | null
          owner_id: string
          preconditions?: string | null
          priority?: Database["public"]["Enums"]["test_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["test_status"]
          steps?: string | null
          tags?: string[] | null
          title: string
          type?: Database["public"]["Enums"]["test_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          expected_result?: string | null
          id?: string
          module_id?: string | null
          owner_id?: string
          preconditions?: string | null
          priority?: Database["public"]["Enums"]["test_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["test_status"]
          steps?: string | null
          tags?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["test_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_executions: {
        Row: {
          browser: string | null
          created_at: string
          device: string | null
          executed_at: string | null
          id: string
          notes: string | null
          owner_id: string
          run_id: string
          screenshot_url: string | null
          status: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device?: string | null
          executed_at?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          run_id: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device?: string | null
          executed_at?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          run_id?: string
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_executions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "tester" | "viewer" | "manager"
      bug_priority: "low" | "medium" | "high" | "urgent"
      bug_severity: "low" | "medium" | "high" | "critical"
      bug_status: "open" | "in_progress" | "resolved" | "closed" | "reopened"
      execution_status: "not_run" | "pass" | "fail" | "blocked" | "skipped"
      test_priority: "low" | "medium" | "high" | "critical"
      test_status: "draft" | "active" | "deprecated"
      test_type:
        | "functional"
        | "regression"
        | "smoke"
        | "integration"
        | "performance"
        | "security"
        | "usability"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tester", "viewer", "manager"],
      bug_priority: ["low", "medium", "high", "urgent"],
      bug_severity: ["low", "medium", "high", "critical"],
      bug_status: ["open", "in_progress", "resolved", "closed", "reopened"],
      execution_status: ["not_run", "pass", "fail", "blocked", "skipped"],
      test_priority: ["low", "medium", "high", "critical"],
      test_status: ["draft", "active", "deprecated"],
      test_type: [
        "functional",
        "regression",
        "smoke",
        "integration",
        "performance",
        "security",
        "usability",
      ],
    },
  },
} as const
