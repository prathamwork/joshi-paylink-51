export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          brand_name: string;
          brand_tagline: string;
          default_tip_presets: number[];
          enabled_currencies: string[];
          id: number;
          support_email: string;
          support_phone: string | null;
          updated_at: string;
        };
        Insert: {
          brand_name?: string;
          brand_tagline?: string;
          default_tip_presets?: number[];
          enabled_currencies?: string[];
          id?: number;
          support_email?: string;
          support_phone?: string | null;
          updated_at?: string;
        };
        Update: {
          brand_name?: string;
          brand_tagline?: string;
          default_tip_presets?: number[];
          enabled_currencies?: string[];
          id?: number;
          support_email?: string;
          support_phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_attempts: {
        Row: {
          bank_reference: string | null;
          base_amount_minor: number;
          cashfree_cf_order_id: string | null;
          cashfree_order_id: string | null;
          cashfree_payment_id: string | null;
          cashfree_payment_session_id: string | null;
          created_at: string;
          currency: string;
          error_code: string | null;
          error_description: string | null;
          id: string;
          link_id: string;
          provider: string;
          provider_verified: boolean;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          signature_verified: boolean;
          status: string;
          tip_amount_minor: number;
          total_amount_minor: number;
          updated_at: string;
        };
        Insert: {
          bank_reference?: string | null;
          base_amount_minor: number;
          cashfree_cf_order_id?: string | null;
          cashfree_order_id?: string | null;
          cashfree_payment_id?: string | null;
          cashfree_payment_session_id?: string | null;
          created_at?: string;
          currency: string;
          error_code?: string | null;
          error_description?: string | null;
          id?: string;
          link_id: string;
          provider?: string;
          provider_verified?: boolean;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          signature_verified?: boolean;
          status?: string;
          tip_amount_minor?: number;
          total_amount_minor: number;
          updated_at?: string;
        };
        Update: {
          bank_reference?: string | null;
          base_amount_minor?: number;
          cashfree_cf_order_id?: string | null;
          cashfree_order_id?: string | null;
          cashfree_payment_id?: string | null;
          cashfree_payment_session_id?: string | null;
          created_at?: string;
          currency?: string;
          error_code?: string | null;
          error_description?: string | null;
          id?: string;
          link_id?: string;
          provider?: string;
          provider_verified?: boolean;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          signature_verified?: boolean;
          status?: string;
          tip_amount_minor?: number;
          total_amount_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_attempts_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "payment_links";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_links: {
        Row: {
          allow_tip: boolean;
          base_amount_minor: number;
          client_country: string | null;
          client_email: string | null;
          client_name: string;
          client_phone: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          expires_at: string | null;
          id: string;
          invoice_ref: string | null;
          project_title: string;
          public_code: string;
          single_use: boolean;
          status: string;
          tip_custom_allowed: boolean;
          tip_max_minor: number | null;
          tip_min_minor: number;
          tip_presets: number[];
          updated_at: string;
        };
        Insert: {
          allow_tip?: boolean;
          base_amount_minor: number;
          client_country?: string | null;
          client_email?: string | null;
          client_name: string;
          client_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          invoice_ref?: string | null;
          project_title: string;
          public_code: string;
          single_use?: boolean;
          status?: string;
          tip_custom_allowed?: boolean;
          tip_max_minor?: number | null;
          tip_min_minor?: number;
          tip_presets?: number[];
          updated_at?: string;
        };
        Update: {
          allow_tip?: boolean;
          base_amount_minor?: number;
          client_country?: string | null;
          client_email?: string | null;
          client_name?: string;
          client_phone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          expires_at?: string | null;
          id?: string;
          invoice_ref?: string | null;
          project_title?: string;
          public_code?: string;
          single_use?: boolean;
          status?: string;
          tip_custom_allowed?: boolean;
          tip_max_minor?: number | null;
          tip_min_minor?: number;
          tip_presets?: number[];
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          provider?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer Row;
    }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer Row;
      }
      ? Row
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer Insert;
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer Insert;
      }
      ? Insert
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer Update;
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer Update;
      }
      ? Update
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const;
