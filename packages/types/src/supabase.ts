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
      freshness_snapshots: {
        Row: {
          id: string;
          source_key: string;
          fingerprint: string;
          payload: Json;
          polled_at: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          source_key: string;
          fingerprint: string;
          payload: Json;
          polled_at?: string;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          source_key?: string;
          fingerprint?: string;
          payload?: Json;
          polled_at?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      freshness_pending_updates: {
        Row: {
          id: string;
          source_key: string;
          current_snapshot_id: string;
          previous_snapshot_id: string | null;
          status: "pending" | "approved" | "rejected";
          diff_summary: string;
          diff_payload: Json | null;
          detected_at: string;
          approval_reason: string | null;
          rejection_reason: string | null;
          approved_by_user_id: string | null;
          workflow_keys: string[] | null;
          verified_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          source_key: string;
          current_snapshot_id: string;
          previous_snapshot_id?: string | null;
          status?: "pending" | "approved" | "rejected";
          diff_summary: string;
          diff_payload?: Json | null;
          detected_at?: string;
          approval_reason?: string | null;
          rejection_reason?: string | null;
          approved_by_user_id?: string | null;
          workflow_keys?: string[] | null;
          verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          source_key?: string;
          current_snapshot_id?: string;
          previous_snapshot_id?: string | null;
          status?: "pending" | "approved" | "rejected";
          diff_summary?: string;
          diff_payload?: Json | null;
          detected_at?: string;
          approval_reason?: string | null;
          rejection_reason?: string | null;
          approved_by_user_id?: string | null;
          workflow_keys?: string[] | null;
          verified_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "freshness_pending_updates_approved_by_user_id_fkey";
            columns: ["approved_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "freshness_pending_updates_current_snapshot_id_fkey";
            columns: ["current_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "freshness_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "freshness_pending_updates_previous_snapshot_id_fkey";
            columns: ["previous_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "freshness_snapshots";
            referencedColumns: ["id"];
          }
        ];
      };
      freshness_rule_verifications: {
        Row: {
          id: string;
          rule_id: string;
          evidence: Json;
          verified_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          rule_id: string;
          evidence: Json;
          verified_at: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          rule_id?: string;
          evidence?: Json;
          verified_at?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
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
          orchestration_provider: string;
          orchestration_workflow_id: string | null;
          created_by_user_id: string | null;
          merged_workflow_snapshot: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_def_id?: string | null;
          subject_org_id: string;
          engager_org_id?: string | null;
          status?: "draft" | "active" | "done" | "archived";
          orchestration_provider?: string;
          orchestration_workflow_id?: string | null;
          created_by_user_id?: string | null;
          merged_workflow_snapshot?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          workflow_def_id?: string | null;
          subject_org_id?: string;
          engager_org_id?: string | null;
          status?: "draft" | "active" | "done" | "archived";
          orchestration_provider?: string;
          orchestration_workflow_id?: string | null;
          created_by_user_id?: string | null;
          merged_workflow_snapshot?: Json | null;
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
          orchestration_run_id: string | null;
          execution_mode: "manual" | "temporal";
          due_date: string | null;
          assignee_user_id: string | null;
          step_type_version_id: string | null;
          permissions: string[] | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          key: string;
          title: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          orchestration_run_id?: string | null;
          execution_mode?: "manual" | "temporal";
          due_date?: string | null;
          assignee_user_id?: string | null;
          step_type_version_id?: string | null;
          permissions?: string[] | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          key?: string;
          title?: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          orchestration_run_id?: string | null;
          execution_mode?: "manual" | "temporal";
          due_date?: string | null;
          assignee_user_id?: string | null;
          step_type_version_id?: string | null;
          permissions?: string[] | null;
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
          },
          {
            foreignKeyName: "steps_step_type_version_id_fkey";
            columns: ["step_type_version_id"];
            isOneToOne: false;
            referencedRelation: "step_type_versions";
            referencedColumns: ["id"];
          }
        ];
      };
      json_schemas: {
        Row: {
          id: string;
          slug: string;
          version: string;
          description: string | null;
          schema: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          version: string;
          description?: string | null;
          schema: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          version?: string;
          description?: string | null;
          schema?: Json;
          created_at?: string | null;
        };
        Relationships: [];
      };
      step_types: {
        Row: {
          id: string;
          slug: string;
          title: string;
          category: string | null;
          summary: string | null;
          latest_version: string | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          category?: string | null;
          summary?: string | null;
          latest_version?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          category?: string | null;
          summary?: string | null;
          latest_version?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "step_types_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      step_type_versions: {
        Row: {
          id: string;
          step_type_id: string;
          version: string;
          definition: Json;
          input_schema_id: string | null;
          output_schema_id: string | null;
          status: "draft" | "published" | "deprecated";
          created_by: string | null;
          created_at: string | null;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          step_type_id: string;
          version: string;
          definition: Json;
          input_schema_id?: string | null;
          output_schema_id?: string | null;
          status?: "draft" | "published" | "deprecated";
          created_by?: string | null;
          created_at?: string | null;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          step_type_id?: string;
          version?: string;
          definition?: Json;
          input_schema_id?: string | null;
          output_schema_id?: string | null;
          status?: "draft" | "published" | "deprecated";
          created_by?: string | null;
          created_at?: string | null;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "step_type_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "step_type_versions_input_schema_id_fkey";
            columns: ["input_schema_id"];
            isOneToOne: false;
            referencedRelation: "json_schemas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "step_type_versions_output_schema_id_fkey";
            columns: ["output_schema_id"];
            isOneToOne: false;
            referencedRelation: "json_schemas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "step_type_versions_step_type_id_fkey";
            columns: ["step_type_id"];
            isOneToOne: false;
            referencedRelation: "step_types";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_step_type_installs: {
        Row: {
          id: string;
          org_id: string;
          step_type_version_id: string;
          installed_at: string | null;
          status: "enabled" | "disabled";
        };
        Insert: {
          id?: string;
          org_id: string;
          step_type_version_id: string;
          installed_at?: string | null;
          status?: "enabled" | "disabled";
        };
        Update: {
          id?: string;
          org_id?: string;
          step_type_version_id?: string;
          installed_at?: string | null;
          status?: "enabled" | "disabled";
        };
        Relationships: [
          {
            foreignKeyName: "tenant_step_type_installs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_step_type_installs_step_type_version_id_fkey";
            columns: ["step_type_version_id"];
            isOneToOne: false;
            referencedRelation: "step_type_versions";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_secret_bindings: {
        Row: {
          id: string;
          org_id: string;
          alias: string;
          description: string | null;
          provider: string | null;
          external_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          alias: string;
          description?: string | null;
          provider?: string | null;
          external_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          alias?: string;
          description?: string | null;
          provider?: string | null;
          external_id?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_secret_bindings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_workflow_overlays: {
        Row: {
          id: string;
          org_id: string;
          workflow_def_id: string;
          title: string;
          patch: Json;
          status: "draft" | "published" | "archived";
          created_by: string | null;
          updated_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          workflow_def_id: string;
          title: string;
          patch: Json;
          status?: "draft" | "published" | "archived";
          created_by?: string | null;
          updated_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          workflow_def_id?: string;
          title?: string;
          patch?: Json;
          status?: "draft" | "published" | "archived";
          created_by?: string | null;
          updated_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_workflow_overlays_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_workflow_overlays_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_workflow_overlays_workflow_def_id_fkey";
            columns: ["workflow_def_id"];
            isOneToOne: false;
            referencedRelation: "workflow_defs";
            referencedColumns: ["id"];
          }
        ];
      };
      workflow_overlay_snapshots: {
        Row: {
          id: string;
          run_id: string;
          tenant_overlay_id: string | null;
          applied_overlays: Json;
          merged_workflow: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          tenant_overlay_id?: string | null;
          applied_overlays?: Json;
          merged_workflow: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          tenant_overlay_id?: string | null;
          applied_overlays?: Json;
          merged_workflow?: Json;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_overlay_snapshots_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_overlay_snapshots_tenant_overlay_id_fkey";
            columns: ["tenant_overlay_id"];
            isOneToOne: false;
            referencedRelation: "tenant_workflow_overlays";
            referencedColumns: ["id"];
          }
        ];
      };
      workflow_overlay_layers: {
        Row: {
          id: string;
          snapshot_id: string;
          source: string;
          patch: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          source: string;
          patch: Json;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          snapshot_id?: string;
          source?: string;
          patch?: Json;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_overlay_layers_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "workflow_overlay_snapshots";
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
      cro_companies: {
        Row: {
          company_number: string;
          name: string;
          status: string | null;
          company_type: string | null;
          registered_on: string | null;
          dissolved_on: string | null;
          last_return_date: string | null;
          address: Json | null;
          eircode: string | null;
          metadata: Json | null;
          snapshot_fingerprint: string | null;
          source_resource_id: string | null;
          refreshed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          company_number: string;
          name: string;
          status?: string | null;
          company_type?: string | null;
          registered_on?: string | null;
          dissolved_on?: string | null;
          last_return_date?: string | null;
          address?: Json | null;
          eircode?: string | null;
          metadata?: Json | null;
          snapshot_fingerprint?: string | null;
          source_resource_id?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          company_number?: string;
          name?: string;
          status?: string | null;
          company_type?: string | null;
          registered_on?: string | null;
          dissolved_on?: string | null;
          last_return_date?: string | null;
          address?: Json | null;
          eircode?: string | null;
          metadata?: Json | null;
          snapshot_fingerprint?: string | null;
          source_resource_id?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      charity_registration_metrics: {
        Row: {
          metric_key: string;
          metric_label: string;
          values_json: Json;
          source_resource_id: string | null;
          snapshot_fingerprint: string | null;
          refreshed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          metric_key: string;
          metric_label: string;
          values_json: Json;
          source_resource_id?: string | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          metric_key?: string;
          metric_label?: string;
          values_json?: Json;
          source_resource_id?: string | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      revenue_charity_registry: {
        Row: {
          id: string;
          charity_name: string;
          charity_address: string | null;
          source_resource_id: string | null;
          snapshot_fingerprint: string | null;
          refreshed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          charity_name: string;
          charity_address?: string | null;
          source_resource_id?: string | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          charity_name?: string;
          charity_address?: string | null;
          source_resource_id?: string | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      funding_opportunities: {
        Row: {
          id: string;
          external_id: string;
          source_resource_id: string;
          title: string;
          summary: string | null;
          call_year: number | null;
          call_type: string | null;
          domain: string | null;
          county: string | null;
          lead_institution: string | null;
          acronym: string | null;
          amount_awarded: number | null;
          currency: string | null;
          metadata: Json | null;
          snapshot_fingerprint: string | null;
          refreshed_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          external_id: string;
          source_resource_id: string;
          title: string;
          summary?: string | null;
          call_year?: number | null;
          call_type?: string | null;
          domain?: string | null;
          county?: string | null;
          lead_institution?: string | null;
          acronym?: string | null;
          amount_awarded?: number | null;
          currency?: string | null;
          metadata?: Json | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          external_id?: string;
          source_resource_id?: string;
          title?: string;
          summary?: string | null;
          call_year?: number | null;
          call_type?: string | null;
          domain?: string | null;
          county?: string | null;
          lead_institution?: string | null;
          acronym?: string | null;
          amount_awarded?: number | null;
          currency?: string | null;
          metadata?: Json | null;
          snapshot_fingerprint?: string | null;
          refreshed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      funding_opportunity_workflows: {
        Row: {
          id: string;
          funding_opportunity_id: string;
          workflow_key: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          funding_opportunity_id: string;
          workflow_key: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          funding_opportunity_id?: string;
          workflow_key?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "funding_opportunity_workflows_funding_opportunity_id_fkey";
            columns: ["funding_opportunity_id"];
            isOneToOne: false;
            referencedRelation: "funding_opportunities";
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
