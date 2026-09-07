/**
 * Hand-authored to match supabase/migrations/*.sql exactly. Regenerate once
 * connected to the live project and keep in sync on every future migration:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public,storage > src/lib/types/database.ts
 */

export type TriggerType = "daily" | "manual";
export type ReportRunStatus = "queued" | "sent" | "processing" | "completed" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          company_name: string | null;
          full_name: string | null;
          report_email: string | null;
          daily_reports_enabled: boolean;
          preferred_report_time: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string;
          asin: string;
          title: string;
          image_path: string | null;
          notify_enabled: boolean;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          user_id: string;
          asin: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          product_id: string;
          user_id: string;
          asin: string;
          title: string;
          amazon_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitors"]["Row"]> & {
          product_id: string;
          user_id: string;
          asin: string;
          title: string;
          amazon_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "competitors_product_owner_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      report_runs: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          trigger_type: TriggerType;
          status: ReportRunStatus;
          status_rank: number;
          run_date: string | null;
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
          user_id: string;
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
      select_daily_report_candidates: {
        Args: { p_mode?: string };
        Returns: { user_id: string; report_email: string; company_name: string | null; timezone: string }[];
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
