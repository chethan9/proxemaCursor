/* eslint-disable @typescript-eslint/no-empty-object-type */
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
      clients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          job_type: string
          message: string | null
          metadata: Json | null
          started_at: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          message?: string | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          message?: string | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cron_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          avatar_url: string | null
          billing: Json | null
          created_at: string | null
          date_created: string | null
          email: string | null
          first_name: string | null
          id: string
          is_paying_customer: boolean | null
          last_name: string | null
          orders_count: number | null
          raw_data: Json | null
          role: string | null
          shipping: Json | null
          store_id: string
          synced_at: string | null
          total_spent: number | null
          username: string | null
          woo_id: number
        }
        Insert: {
          avatar_url?: string | null
          billing?: Json | null
          created_at?: string | null
          date_created?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_paying_customer?: boolean | null
          last_name?: string | null
          orders_count?: number | null
          raw_data?: Json | null
          role?: string | null
          shipping?: Json | null
          store_id: string
          synced_at?: string | null
          total_spent?: number | null
          username?: string | null
          woo_id: number
        }
        Update: {
          avatar_url?: string | null
          billing?: Json | null
          created_at?: string | null
          date_created?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_paying_customer?: boolean | null
          last_name?: string | null
          orders_count?: number | null
          raw_data?: Json | null
          role?: string | null
          shipping?: Json | null
          store_id?: string
          synced_at?: string | null
          total_spent?: number | null
          username?: string | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing: Json | null
          coupon_lines: Json | null
          created_at: string | null
          currency: string | null
          customer_id: number | null
          date_created: string | null
          date_modified: string | null
          discount_total: number | null
          fee_lines: Json | null
          id: string
          line_items: Json | null
          order_number: string | null
          payment_method: string | null
          payment_method_title: string | null
          raw_data: Json | null
          shipping: Json | null
          shipping_lines: Json | null
          shipping_total: number | null
          status: string | null
          store_id: string
          subtotal: number | null
          synced_at: string | null
          total: number | null
          total_tax: number | null
          woo_id: number
        }
        Insert: {
          billing?: Json | null
          coupon_lines?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_id?: number | null
          date_created?: string | null
          date_modified?: string | null
          discount_total?: number | null
          fee_lines?: Json | null
          id?: string
          line_items?: Json | null
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_data?: Json | null
          shipping?: Json | null
          shipping_lines?: Json | null
          shipping_total?: number | null
          status?: string | null
          store_id: string
          subtotal?: number | null
          synced_at?: string | null
          total?: number | null
          total_tax?: number | null
          woo_id: number
        }
        Update: {
          billing?: Json | null
          coupon_lines?: Json | null
          created_at?: string | null
          currency?: string | null
          customer_id?: number | null
          date_created?: string | null
          date_modified?: string | null
          discount_total?: number | null
          fee_lines?: Json | null
          id?: string
          line_items?: Json | null
          order_number?: string | null
          payment_method?: string | null
          payment_method_title?: string | null
          raw_data?: Json | null
          shipping?: Json | null
          shipping_lines?: Json | null
          shipping_total?: number | null
          status?: string | null
          store_id?: string
          subtotal?: number | null
          synced_at?: string | null
          total?: number | null
          total_tax?: number | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          categories: Json | null
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          name: string
          price: number | null
          raw_data: Json | null
          regular_price: number | null
          sale_price: number | null
          short_description: string | null
          sku: string | null
          slug: string | null
          status: string | null
          stock_quantity: number | null
          stock_status: string | null
          store_id: string
          synced_at: string | null
          type: string | null
          updated_at: string | null
          woo_id: number
        }
        Insert: {
          attributes?: Json | null
          categories?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          name: string
          price?: number | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          store_id: string
          synced_at?: string | null
          type?: string | null
          updated_at?: string | null
          woo_id: number
        }
        Update: {
          attributes?: Json | null
          categories?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          name?: string
          price?: number | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          store_id?: string
          synced_at?: string | null
          type?: string | null
          updated_at?: string | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          client_id: string | null
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          name: string
          next_sync_at: string | null
          short_id: string | null
          status: string | null
          sync_interval: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          next_sync_at?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          next_sync_at?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          aspect: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          records_created: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string | null
          store_id: string
        }
        Insert: {
          aspect: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          store_id: string
        }
        Update: {
          aspect?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          processing_status: string | null
          store_id: string
          topic: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_status?: string | null
          store_id: string
          topic: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_status?: string | null
          store_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          delivery_url: string
          failure_count: number | null
          id: string
          last_triggered_at: string | null
          secret: string | null
          status: string | null
          store_id: string
          topic: string
          updated_at: string | null
          woo_webhook_id: number | null
        }
        Insert: {
          created_at?: string | null
          delivery_url: string
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          secret?: string | null
          status?: string | null
          store_id: string
          topic: string
          updated_at?: string | null
          woo_webhook_id?: number | null
        }
        Update: {
          created_at?: string | null
          delivery_url?: string
          failure_count?: number | null
          id?: string
          last_triggered_at?: string | null
          secret?: string | null
          status?: string | null
          store_id?: string
          topic?: string
          updated_at?: string | null
          woo_webhook_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
