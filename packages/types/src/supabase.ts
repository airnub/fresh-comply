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
          tenant_org_id: string;
          name: string;
          slug: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          name: string;
          slug: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          name?: string;
          slug?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organisations_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
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
      billing_prices: {
        Row: {
          stripe_price_id: string;
          product_name: string;
          nickname: string | null;
          unit_amount: number | null;
          currency: string;
          interval: string | null;
          interval_count: number | null;
          is_active: boolean;
          metadata: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          stripe_price_id: string;
          product_name: string;
          nickname?: string | null;
          unit_amount?: number | null;
          currency: string;
          interval?: string | null;
          interval_count?: number | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          stripe_price_id?: string;
          product_name?: string;
          nickname?: string | null;
          unit_amount?: number | null;
          currency?: string;
          interval?: string | null;
          interval_count?: number | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      billing_tenants: {
        Row: {
          id: string;
          tenant_org_id: string;
          stripe_customer_id: string | null;
          billing_mode: "direct" | "partner_managed";
          partner_org_id: string | null;
          default_price_id: string | null;
          metadata: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          stripe_customer_id?: string | null;
          billing_mode?: "direct" | "partner_managed";
          partner_org_id?: string | null;
          default_price_id?: string | null;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          stripe_customer_id?: string | null;
          billing_mode?: "direct" | "partner_managed";
          partner_org_id?: string | null;
          default_price_id?: string | null;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_tenants_default_price_id_fkey";
            columns: ["default_price_id"];
            isOneToOne: false;
            referencedRelation: "billing_prices";
            referencedColumns: ["stripe_price_id"];
          },
          {
            foreignKeyName: "billing_tenants_partner_org_id_fkey";
            columns: ["partner_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_tenants_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      billing_subscriptions: {
        Row: {
          id: string;
          tenant_org_id: string;
          billing_tenant_id: string | null;
          stripe_subscription_id: string;
          status:
            | "trialing"
            | "active"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          canceled_at: string | null;
          cancel_at_period_end: boolean;
          collection_method: string | null;
          latest_invoice_id: string | null;
          metadata: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          billing_tenant_id?: string | null;
          stripe_subscription_id: string;
          status?:
            | "trialing"
            | "active"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          canceled_at?: string | null;
          cancel_at_period_end?: boolean;
          collection_method?: string | null;
          latest_invoice_id?: string | null;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          billing_tenant_id?: string | null;
          stripe_subscription_id?: string;
          status?:
            | "trialing"
            | "active"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          canceled_at?: string | null;
          cancel_at_period_end?: boolean;
          collection_method?: string | null;
          latest_invoice_id?: string | null;
          metadata?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_billing_tenant_id_fkey";
            columns: ["billing_tenant_id"];
            isOneToOne: false;
            referencedRelation: "billing_tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_subscriptions_stripe_price_id_fkey";
            columns: ["stripe_price_id"];
            isOneToOne: false;
            referencedRelation: "billing_prices";
            referencedColumns: ["stripe_price_id"];
          },
          {
            foreignKeyName: "billing_subscriptions_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
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
          tenant_org_id: string;
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
          tenant_org_id: string;
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
          tenant_org_id?: string;
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
            foreignKeyName: "workflow_runs_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
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
          tenant_org_id: string;
          subject_org_id: string | null;
          key: string;
          title: string;
          status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          orchestration_run_id: string | null;
          execution_mode: "manual" | "temporal" | "external:webhook" | "external:websocket";
          due_date: string | null;
          assignee_user_id: string | null;
          step_type_version_id: string | null;
          permissions: string[] | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          tenant_org_id: string;
          subject_org_id?: string | null;
          key: string;
          title: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          orchestration_run_id?: string | null;
          execution_mode?: "manual" | "temporal" | "external:webhook" | "external:websocket";
          due_date?: string | null;
          assignee_user_id?: string | null;
          step_type_version_id?: string | null;
          permissions?: string[] | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          tenant_org_id?: string;
          subject_org_id?: string | null;
          key?: string;
          title?: string;
          status?: "todo" | "in_progress" | "waiting" | "blocked" | "done";
          orchestration_run_id?: string | null;
          execution_mode?: "manual" | "temporal" | "external:webhook" | "external:websocket";
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
          },
          {
            foreignKeyName: "steps_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "steps_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
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
      tenant_branding: {
        Row: {
          tenant_org_id: string;
          tokens: Json;
          logo_url: string | null;
          favicon_url: string | null;
          typography: Json;
          pdf_header: Json;
          pdf_footer: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          tenant_org_id: string;
          tokens?: Json;
          logo_url?: string | null;
          favicon_url?: string | null;
          typography?: Json;
          pdf_header?: Json;
          pdf_footer?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          tenant_org_id?: string;
          tokens?: Json;
          logo_url?: string | null;
          favicon_url?: string | null;
          typography?: Json;
          pdf_header?: Json;
          pdf_footer?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      tenant_domains: {
        Row: {
          id: string;
          tenant_org_id: string;
          domain: string;
          is_primary: boolean;
          verified_at: string | null;
          cert_status: "pending" | "provisioning" | "issued" | "failed" | "revoked";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          domain: string;
          is_primary?: boolean;
          verified_at?: string | null;
          cert_status?: "pending" | "provisioning" | "issued" | "failed" | "revoked";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          domain?: string;
          is_primary?: boolean;
          verified_at?: string | null;
          cert_status?: "pending" | "provisioning" | "issued" | "failed" | "revoked";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
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
          tenant_org_id: string;
          subject_org_id: string | null;
          template_id: string | null;
          path: string | null;
          checksum: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          tenant_org_id: string;
          subject_org_id?: string | null;
          template_id?: string | null;
          path?: string | null;
          checksum?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          tenant_org_id?: string;
          subject_org_id?: string | null;
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
          },
          {
            foreignKeyName: "documents_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_log: {
        Row: {
          id: string;
          tenant_org_id: string;
          actor_user_id: string | null;
          actor_org_id: string | null;
          on_behalf_of_org_id: string | null;
          subject_org_id: string | null;
          entity: string | null;
          run_id: string | null;
          step_id: string | null;
          action: string | null;
          meta_json: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          actor_user_id?: string | null;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          subject_org_id?: string | null;
          entity?: string | null;
          run_id?: string | null;
          step_id?: string | null;
          action?: string | null;
          meta_json?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          actor_user_id?: string | null;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          subject_org_id?: string | null;
          entity?: string | null;
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
          },
          {
            foreignKeyName: "audit_log_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      admin_actions: {
        Row: {
          id: string;
          tenant_org_id: string;
          actor_id: string;
          actor_org_id: string | null;
          on_behalf_of_org_id: string | null;
          subject_org_id: string | null;
          action: string;
          reason: string;
          payload: Json;
          requires_second_approval: boolean;
          second_actor_id: string | null;
          created_at: string;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          actor_id: string;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          subject_org_id?: string | null;
          action: string;
          reason: string;
          payload?: Json;
          requires_second_approval?: boolean;
          second_actor_id?: string | null;
          created_at?: string;
          approved_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          actor_id?: string;
          actor_org_id?: string | null;
          on_behalf_of_org_id?: string | null;
          subject_org_id?: string | null;
          action?: string;
          reason?: string;
          payload?: Json;
          requires_second_approval?: boolean;
          second_actor_id?: string | null;
          created_at?: string;
          approved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_actor_org_id_fkey";
            columns: ["actor_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_on_behalf_of_org_id_fkey";
            columns: ["on_behalf_of_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_actions_second_actor_id_fkey";
            columns: ["second_actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      dsr_requests: {
        Row: {
          id: string;
          tenant_org_id: string;
          subject_org_id: string | null;
          assignee_user_id: string | null;
          assignee_email: string | null;
          requester_email: string | null;
          requester_name: string | null;
          request_payload: Json | null;
          type:
            | "access"
            | "export"
            | "rectification"
            | "erasure"
            | "restriction"
            | "objection"
            | "portability";
          status:
            | "received"
            | "acknowledged"
            | "in_progress"
            | "paused"
            | "completed"
            | "escalated";
          received_at: string;
          ack_sent_at: string | null;
          due_at: string;
          resolved_at: string | null;
          paused_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_org_id: string;
          subject_org_id?: string | null;
          assignee_user_id?: string | null;
          assignee_email?: string | null;
          requester_email?: string | null;
          requester_name?: string | null;
          request_payload?: Json | null;
          type:
            | "access"
            | "export"
            | "rectification"
            | "erasure"
            | "restriction"
            | "objection"
            | "portability";
          status?:
            | "received"
            | "acknowledged"
            | "in_progress"
            | "paused"
            | "completed"
            | "escalated";
          received_at?: string;
          ack_sent_at?: string | null;
          due_at: string;
          resolved_at?: string | null;
          paused_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_org_id?: string;
          subject_org_id?: string | null;
          assignee_user_id?: string | null;
          assignee_email?: string | null;
          requester_email?: string | null;
          requester_name?: string | null;
          request_payload?: Json | null;
          type?:
            | "access"
            | "export"
            | "rectification"
            | "erasure"
            | "restriction"
            | "objection"
            | "portability";
          status?:
            | "received"
            | "acknowledged"
            | "in_progress"
            | "paused"
            | "completed"
            | "escalated";
          received_at?: string;
          ack_sent_at?: string | null;
          due_at?: string;
          resolved_at?: string | null;
          paused_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dsr_requests_assignee_user_id_fkey";
            columns: ["assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dsr_requests_subject_org_id_fkey";
            columns: ["subject_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dsr_requests_tenant_org_id_fkey";
            columns: ["tenant_org_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          }
        ];
      };
      dsr_request_jobs: {
        Row: {
          id: string;
          request_id: string;
          job_type: "ack_deadline" | "resolution_deadline" | "escalation_notice";
          run_after: string;
          payload: Json | null;
          attempts: number;
          locked_at: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          job_type: "ack_deadline" | "resolution_deadline" | "escalation_notice";
          run_after: string;
          payload?: Json | null;
          attempts?: number;
          locked_at?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          job_type?: "ack_deadline" | "resolution_deadline" | "escalation_notice";
          run_after?: string;
          payload?: Json | null;
          attempts?: number;
          locked_at?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dsr_request_jobs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "dsr_requests";
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
      billing_subscription_overview: {
        Row: {
          tenant_org_id: string;
          billing_mode: "direct" | "partner_managed";
          stripe_customer_id: string | null;
          partner_org_id: string | null;
          default_price_id: string | null;
          tenant_metadata: Json;
          tenant_updated_at: string | null;
          stripe_subscription_id: string | null;
          status:
            | "trialing"
            | "active"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused"
            | null;
          stripe_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          canceled_at: string | null;
          cancel_at_period_end: boolean | null;
          collection_method: string | null;
          latest_invoice_id: string | null;
          subscription_metadata: Json | null;
          subscription_updated_at: string | null;
          product_name: string | null;
          nickname: string | null;
          unit_amount: number | null;
          currency: string | null;
          interval: string | null;
          interval_count: number | null;
          price_active: boolean | null;
          price_metadata: Json | null;
          price_updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      assert_tenant_membership: {
        Args: {
          target_tenant: string;
        };
        Returns: undefined;
      };
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
      normalize_domain: {
        Args: {
          host: string;
        };
        Returns: string;
      };
      resolve_tenant_branding: {
        Args: {
          p_host: string;
        };
        Returns: {
          tenant_org_id: string;
          domain: string;
          tokens: Json;
          logo_url: string | null;
          favicon_url: string | null;
          typography: Json;
          pdf_header: Json;
          pdf_footer: Json;
          updated_at: string | null;
        }[];
      };
      rpc_delete_tenant_domain: {
        Args: {
          p_domain_id: string;
        };
        Returns: boolean;
      };
      rpc_get_tenant_branding: {
        Args: {
          p_tenant_org_id: string;
        };
        Returns: Database["public"]["Tables"]["tenant_branding"]["Row"] | null;
      };
      rpc_upsert_billing_price: {
        Args: {
          p_stripe_price_id: string;
          p_product_name: string;
          p_nickname?: string | null;
          p_unit_amount?: number | null;
          p_currency: string;
          p_interval?: string | null;
          p_interval_count?: number | null;
          p_is_active?: boolean;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["billing_prices"]["Row"];
      };
      rpc_upsert_billing_subscription: {
        Args: {
          p_tenant_org_id: string;
          p_billing_tenant_id?: string | null;
          p_stripe_subscription_id: string;
          p_status:
            | "trialing"
            | "active"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "paused";
          p_stripe_price_id?: string | null;
          p_current_period_start?: string | null;
          p_current_period_end?: string | null;
          p_cancel_at?: string | null;
          p_canceled_at?: string | null;
          p_cancel_at_period_end?: boolean;
          p_collection_method?: string | null;
          p_latest_invoice_id?: string | null;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["billing_subscriptions"]["Row"];
      };
      rpc_upsert_billing_tenant: {
        Args: {
          p_tenant_org_id: string;
          p_stripe_customer_id?: string | null;
          p_billing_mode?: "direct" | "partner_managed";
          p_partner_org_id?: string | null;
          p_default_price_id?: string | null;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["billing_tenants"]["Row"];
      };
      rpc_mark_tenant_domain_verified: {
        Args: {
          p_domain_id: string;
          p_cert_status: string;
          p_verified_at?: string;
        };
        Returns: Database["public"]["Tables"]["tenant_domains"]["Row"] | null;
      };
      rpc_upsert_tenant_branding: {
        Args: {
          p_tenant_org_id: string;
          p_tokens: Json;
          p_logo_url: string | null;
          p_favicon_url: string | null;
          p_typography: Json;
          p_pdf_header: Json;
          p_pdf_footer: Json;
        };
        Returns: Database["public"]["Tables"]["tenant_branding"]["Row"];
      };
      rpc_upsert_tenant_domain: {
        Args: {
          p_tenant_org_id: string;
          p_domain: string;
          p_is_primary?: boolean;
        };
        Returns: Database["public"]["Tables"]["tenant_domains"]["Row"];
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
