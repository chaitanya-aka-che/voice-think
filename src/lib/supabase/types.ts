export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TstzRange =
  | string
  | {
      lower: string | null;
      upper: string | null;
      lowerInclusive?: boolean;
      upperInclusive?: boolean;
    };

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "15.0.0";
  };
  public: {
    Tables: {
      context_aux_tables: {
        Row: {
          created_at: string;
          created_by: string | null;
          ddl: string;
          id: string;
          prompt_context_id: string;
          table_name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ddl: string;
          id?: string;
          prompt_context_id: string;
          table_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ddl?: string;
          id?: string;
          prompt_context_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_aux_tables_prompt_context_id_fkey";
            columns: ["prompt_context_id"];
            isOneToOne: false;
            referencedRelation: "prompt_contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "context_aux_tables_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      conversation_turns: {
        Row: {
          content: string;
          content_tokens: Json;
          conversation_id: string;
          created_at: string;
          id: number;
          metadata: Json;
          role: "user" | "assistant" | "system" | "tool";
          session_uuid: string;
        };
        Insert: {
          content?: string;
          content_tokens?: Json;
          conversation_id: string;
          created_at?: string;
          id?: number;
          metadata?: Json;
          role: "user" | "assistant" | "system" | "tool";
          session_uuid: string;
        };
        Update: {
          content?: string;
          content_tokens?: Json;
          conversation_id?: string;
          created_at?: string;
          id?: number;
          metadata?: Json;
          role?: "user" | "assistant" | "system" | "tool";
          session_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_turns_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_turns_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json;
          prompt_id: string | null;
          session_uuid: string;
          status: "active" | "archived" | "completed";
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          prompt_id?: string | null;
          session_uuid: string;
          status?: "active" | "archived" | "completed";
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          prompt_id?: string | null;
          session_uuid?: string;
          status?: "active" | "archived" | "completed";
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      insights: {
        Row: {
          created_at: string;
          data: Json;
          details: string | null;
          goal_id: string | null;
          headline: string;
          id: string;
          insight_type: string | null;
          session_uuid: string;
          summary_window: TstzRange | null;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          details?: string | null;
          goal_id?: string | null;
          headline: string;
          id?: string;
          insight_type?: string | null;
          session_uuid: string;
          summary_window?: TstzRange | null;
        };
        Update: {
          created_at?: string;
          data?: Json;
          details?: string | null;
          goal_id?: string | null;
          headline?: string;
          id?: string;
          insight_type?: string | null;
          session_uuid?: string;
          summary_window?: TstzRange | null;
        };
        Relationships: [
          {
            foreignKeyName: "insights_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "user_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insights_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      metrics: {
        Row: {
          captured_at: string;
          id: string;
          metric_key: string;
          metric_value: Json;
          session_uuid: string;
        };
        Insert: {
          captured_at?: string;
          id?: string;
          metric_key: string;
          metric_value: Json;
          session_uuid: string;
        };
        Update: {
          captured_at?: string;
          id?: string;
          metric_key?: string;
          metric_value?: Json;
          session_uuid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metrics_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      prompt_contexts: {
        Row: {
          aux_schema_required: boolean;
          context_payload: Json;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          prompt_id: string;
          updated_at: string;
        };
        Insert: {
          aux_schema_required?: boolean;
          context_payload?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          prompt_id: string;
          updated_at?: string;
        };
        Update: {
          aux_schema_required?: boolean;
          context_payload?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          prompt_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_contexts_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          },
        ];
      };
      prompts: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          owner_session_uuid: string | null;
          system_prompt: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          owner_session_uuid?: string | null;
          system_prompt: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          owner_session_uuid?: string | null;
          system_prompt?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompts_owner_session_uuid_fkey";
            columns: ["owner_session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      sessions: {
        Row: {
          created_at: string;
          label: string | null;
          last_seen_at: string;
          metadata: Json;
          session_uuid: string;
        };
        Insert: {
          created_at?: string;
          label?: string | null;
          last_seen_at?: string;
          metadata?: Json;
          session_uuid?: string;
        };
        Update: {
          created_at?: string;
          label?: string | null;
          last_seen_at?: string;
          metadata?: Json;
          session_uuid?: string;
        };
        Relationships: [];
      };
      trends: {
        Row: {
          created_at: string;
          id: string;
          metric_key: string;
          metric_payload: Json;
          session_uuid: string;
          summary_window: TstzRange | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metric_key: string;
          metric_payload: Json;
          session_uuid: string;
          summary_window?: TstzRange | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          metric_key?: string;
          metric_payload?: Json;
          session_uuid?: string;
          summary_window?: TstzRange | null;
        };
        Relationships: [
          {
            foreignKeyName: "trends_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
      user_goals: {
        Row: {
          created_at: string;
          description: string | null;
          goal_state: Json;
          id: string;
          session_uuid: string;
          status: "active" | "completed" | "archived";
          target_date: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          goal_state?: Json;
          id?: string;
          session_uuid: string;
          status?: "active" | "completed" | "archived";
          target_date?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          goal_state?: Json;
          id?: string;
          session_uuid?: string;
          status?: "active" | "completed" | "archived";
          target_date?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_goals_session_uuid_fkey";
            columns: ["session_uuid"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["session_uuid"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_session_uuid: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  auth: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  storage: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PublicTables = Database["public"]["Tables"];

export type Tables<
  TName extends keyof PublicTables,
  TRelation extends "Row" | "Insert" | "Update" = "Row",
> = PublicTables[TName][TRelation];

export const databaseSchemas = null;
