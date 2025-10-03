export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          user_id: string;
          org_id: string;
          role: "owner" | "admin" | "member" | "viewer";
        };
        Insert: {
          user_id: string;
          org_id: string;
          role: "owner" | "admin" | "member" | "viewer";
        };
        Update: {
          user_id?: string;
          org_id?: string;
          role?: "owner" | "admin" | "member" | "viewer";
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      engagements: {
        Row: {
          id: string;
          engager_org_id: string;
          client_org_id: string;
          status: "active" | "ended";
          scope: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          engager_org_id: string;
          client_org_id: string;
          status?: "active" | "ended";
          scope?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          engager_org_id?: string;
          client_org_id?: string;
          status?: "active" | "ended";
          scope?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "engagements_client_org_id_fkey";
            columns: ["client_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagements_engager_org_id_fkey";
            columns: ["engager_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      workflow_defs: {
        Row: {
          id: string;
          key: string;
          version: string;
          title: string;
          dsl_json: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          version: string;
          title: string;
          dsl_json: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          version?: string;
          title?: string;
          dsl_json?: Json;
          created_at?: string | null;
        };
        Relationships: [];
      };
      workflow_runs: {
        Row: {
          id: string;
          workflow_def_id: string | null;
          subject_org_id: string;
          engager_org_id: string | null;
          status: "draft" | "active" | "done" | "archived";
          created_by_user_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_def_id?: string | null;
          subject_org_id: string;
          engager_org_id?: string | null;
          status?: "draft" | "active" | "done" | "archived";
          created_by_user_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          workflow_def_id?: string | null;
          subject_org_id?: string;
          engager_org_id?: string | null;
          status?: "draft" | "active" | "done" | "archived";
          created_by_user_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_runs_created_by_user_id_fkey";
            columns: ["created_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_runs_engager_org_id_fkey";
            columns: ["engager_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_runs_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_runs_workflow_def_id_fkey";
            columns: ["workflow_def_id"];
            isOneToOne: false;
            referencedRelation: "workflow_defs";
            referencedColumns: ["id"];
          }
        ];
      };
      steps: {
        Row: {
          id: string;
          run_id: string;
          key: string;
          title: string;
          status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          due_date: string | null;
          assignee_user_id: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          key: string;
          title: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          due_date?: string | null;
          assignee_user_id?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          key?: string;
          title?: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          due_date?: string | null;
          assignee_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "steps_assignee_user_id_fkey";
            columns: ["assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "steps_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          run_id: string;
          template_id: string | null;
          path: string | null;
          checksum: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          template_id?: string | null;
          path?: string | null;
          checksum?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          template_id?: string | null;
          path?: string | null;
          checksum?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_user_id: string | null;
          actor_org_id: string | null;
          on_behalf_of_org_id: string | null;
          run_id: string | null;
          step_id: string | null;
          action: string | null;
          meta_json: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          run_id?: string | null;
          step_id?: string | null;
          action?: string | null;
          meta_json?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          run_id?: string | null;
          step_id?: string | null;
          action?: string | null;
          meta_json?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_org_id_fkey";
            columns: ["actor_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_on_behalf_of_org_id_fkey";
            columns: ["on_behalf_of_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "steps";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_run: {
        Args: {
          target_run_id: string;
        };
        Returns: boolean;
      };
      is_member_of_org: {
        Args: {
          target_org_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
