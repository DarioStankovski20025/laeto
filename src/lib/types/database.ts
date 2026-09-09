/**
 * Hand-authored to match supabase/migrations/*.sql exactly. Regenerate once
 * connected to the live project and keep in sync on every future migration:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public,storage > src/lib/types/database.ts
 *
 * Shared-workspace model: every authenticated user of this app sees and
 * edits the same LAETO catalog. created_by/updated_by/requested_by columns
 * are attribution only (server-stamped from auth.uid() via triggers), not
 * an access-control boundary — RLS grants access to any authenticated user.
 */

export type TriggerType = "feed" | "manual";
export type ReportRunStatus = "queued" | "sent" | "processing" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      report_settings: {
        Row: {
          id: boolean;
          company_name: string | null;
          report_email: string | null;
          daily_reports_enabled: boolean;
          preferred_report_time: string;
          timezone: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["report_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["report_settings"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "report_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          asin: string;
          title: string;
          amazon_url: string | null;
          image_path: string | null;
          notify_enabled: boolean;
          last_checked_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          asin: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      competitors: {
        Row: {
          id: string;
          product_id: string;
          asin: string;
          title: string;
          amazon_url: string;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitors"]["Row"]> & {
          product_id: string;
          asin: string;
          title: string;
          amazon_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "competitors_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitors_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_runs: {
        Row: {
          id: string;
          requested_by: string | null;
          product_id: string | null;
          trigger_type: TriggerType;
          status: ReportRunStatus;
          status_rank: number;
          external_job_id: string | null;
          products_count: number;
          competitors_count: number;
          result_data: Record<string, unknown> | null;
          report_file_url: string | null;
          error_message: string | null;
          requested_at: string;
          sent_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["report_runs"]["Row"]> & {
          trigger_type: TriggerType;
        };
        Update: Partial<Database["public"]["Tables"]["report_runs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "report_runs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_runs_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deleted_storage_objects: {
        Row: {
          id: number;
          bucket_id: string;
          path: string;
          enqueued_at: string;
          attempts: number;
        };
        Insert: Partial<Database["public"]["Tables"]["deleted_storage_objects"]["Row"]> & {
          bucket_id: string;
          path: string;
        };
        Update: Partial<Database["public"]["Tables"]["deleted_storage_objects"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_report_run_callback: {
        Args: {
          p_run_id: string;
          p_external_job_id: string | null;
          p_status: string;
          p_started_at?: string | null;
          p_completed_at?: string | null;
          p_sent_at?: string | null;
          p_error_message?: string | null;
          p_report_file_url?: string | null;
          p_result_data?: Record<string, unknown> | null;
        };
        Returns: { applied: boolean; previous_status: string; current_status: string }[];
      };
      expire_stale_report_runs: {
        Args: { p_max_age?: string };
        Returns: number;
      };
      set_product_image: {
        Args: { p_product_id: string; p_path: string | null };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
  };
}
