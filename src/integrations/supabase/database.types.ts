 
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
      activity_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_type: string
          actor_user_id: string | null
          client_id: string | null
          created_at: string
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_type?: string
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_type?: string
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_call_logs: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          method: string | null
          path: string | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          path?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string | null
          path?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_call_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_origins: string[] | null
          client_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit: number | null
          scopes: string[] | null
        }
        Insert: {
          allowed_origins?: string[] | null
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit?: number | null
          scopes?: string[] | null
        }
        Update: {
          allowed_origins?: string[] | null
          client_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          client_id: string | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          response_time_ms?: number | null
          status_code: number
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string
          prefix: string | null
          revoked_at: string | null
          scopes: Json | null
          token: string
          token_hash: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          prefix?: string | null
          revoked_at?: string | null
          scopes?: Json | null
          token: string
          token_hash?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string | null
          revoked_at?: string | null
          scopes?: Json | null
          token?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          accent_color: string | null
          brand_name: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          sidebar_color: string | null
          theme_preset: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          theme_preset?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          theme_preset?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_coupons: {
        Row: {
          code: string
          created_at: string
          currency: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          plan_ids: string[] | null
          redemptions_count: number
          type: Database["public"]["Enums"]["coupon_type"]
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_ids?: string[] | null
          redemptions_count?: number
          type: Database["public"]["Enums"]["coupon_type"]
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_ids?: string[] | null
          redemptions_count?: number
          type?: Database["public"]["Enums"]["coupon_type"]
          value?: number
        }
        Relationships: []
      }
      branding_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          id: string
          new_brand_name: string | null
          new_logo_url: string | null
          new_primary_color: string | null
          new_theme_preset: string | null
          previous_brand_name: string | null
          previous_logo_url: string | null
          previous_primary_color: string | null
          previous_theme_preset: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
          new_brand_name?: string | null
          new_logo_url?: string | null
          new_primary_color?: string | null
          new_theme_preset?: string | null
          previous_brand_name?: string | null
          previous_logo_url?: string | null
          previous_primary_color?: string | null
          previous_theme_preset?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
          new_brand_name?: string | null
          new_logo_url?: string | null
          new_primary_color?: string | null
          new_theme_preset?: string | null
          previous_brand_name?: string | null
          previous_logo_url?: string | null
          previous_primary_color?: string | null
          previous_theme_preset?: string | null
        }
        Relationships: []
      }
      bulk_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          errors: Json
          failed: number
          id: string
          job_type: string
          payload: Json
          processed: number
          started_at: string | null
          status: string
          store_id: string
          succeeded: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          errors?: Json
          failed?: number
          id?: string
          job_type: string
          payload?: Json
          processed?: number
          started_at?: string | null
          status?: string
          store_id: string
          succeeded?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          errors?: Json
          failed?: number
          id?: string
          job_type?: string
          payload?: Json
          processed?: number
          started_at?: string | null
          status?: string
          store_id?: string
          succeeded?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          count: number | null
          created_at: string | null
          description: string | null
          display: string | null
          id: string
          image: Json | null
          menu_order: number | null
          name: string
          parent_id: number | null
          raw_data: Json | null
          slug: string | null
          store_id: string
          synced_at: string | null
          woo_id: number
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          id?: string
          image?: Json | null
          menu_order?: number | null
          name: string
          parent_id?: number | null
          raw_data?: Json | null
          slug?: string | null
          store_id: string
          synced_at?: string | null
          woo_id: number
        }
        Update: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          id?: string
          image?: Json | null
          menu_order?: number | null
          name?: string
          parent_id?: number | null
          raw_data?: Json | null
          slug?: string | null
          store_id?: string
          synced_at?: string | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_methods: {
        Row: {
          card_brand: string | null
          card_expiry_month: number | null
          card_expiry_year: number | null
          card_last4: string | null
          client_id: string
          created_at: string
          gateway: Database["public"]["Enums"]["billing_gateway"]
          gateway_token: string
          id: string
          is_default: boolean
          recurring_eligible: boolean
          updated_at: string
        }
        Insert: {
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last4?: string | null
          client_id: string
          created_at?: string
          gateway: Database["public"]["Enums"]["billing_gateway"]
          gateway_token: string
          id?: string
          is_default?: boolean
          recurring_eligible?: boolean
          updated_at?: string
        }
        Update: {
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last4?: string | null
          client_id?: string
          created_at?: string
          gateway?: Database["public"]["Enums"]["billing_gateway"]
          gateway_token?: string
          id?: string
          is_default?: boolean
          recurring_eligible?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_methods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          country: string | null
          created_at: string | null
          currency: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          applied_at: string
          client_id: string
          coupon_id: string
          currency: string
          discount_minor: number
          id: string
          subscription_id: string | null
        }
        Insert: {
          applied_at?: string
          client_id: string
          coupon_id: string
          currency: string
          discount_minor: number
          id?: string
          subscription_id?: string | null
        }
        Update: {
          applied_at?: string
          client_id?: string
          coupon_id?: string
          currency?: string
          discount_minor?: number
          id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount: number | null
          code: string
          created_at: string | null
          date_created: string | null
          date_expires: string | null
          description: string | null
          discount_type: string | null
          excluded_product_ids: Json | null
          free_shipping: boolean | null
          id: string
          individual_use: boolean | null
          maximum_amount: number | null
          minimum_amount: number | null
          product_ids: Json | null
          raw_data: Json | null
          store_id: string
          synced_at: string | null
          usage_count: number | null
          usage_limit: number | null
          usage_limit_per_user: number | null
          woo_id: number
        }
        Insert: {
          amount?: number | null
          code: string
          created_at?: string | null
          date_created?: string | null
          date_expires?: string | null
          description?: string | null
          discount_type?: string | null
          excluded_product_ids?: Json | null
          free_shipping?: boolean | null
          id?: string
          individual_use?: boolean | null
          maximum_amount?: number | null
          minimum_amount?: number | null
          product_ids?: Json | null
          raw_data?: Json | null
          store_id: string
          synced_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          woo_id: number
        }
        Update: {
          amount?: number | null
          code?: string
          created_at?: string | null
          date_created?: string | null
          date_expires?: string | null
          description?: string | null
          discount_type?: string | null
          excluded_product_ids?: Json | null
          free_shipping?: boolean | null
          id?: string
          individual_use?: boolean | null
          maximum_amount?: number | null
          minimum_amount?: number | null
          product_ids?: Json | null
          raw_data?: Json | null
          store_id?: string
          synced_at?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      deleted_records: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          snapshot: Json | null
          source: string | null
          store_id: string
          woo_id: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          snapshot?: Json | null
          source?: string | null
          store_id: string
          woo_id?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          snapshot?: Json | null
          source?: string | null
          store_id?: string
          woo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deleted_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_changes: {
        Row: {
          change_type: string
          changed_fields: Json | null
          created_at: string | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          error_message: string | null
          id: string
          retry_payload: Json | null
          snapshot_after: Json | null
          snapshot_before: Json | null
          source: string
          status: string | null
          store_id: string
          woo_id: number | null
        }
        Insert: {
          change_type: string
          changed_fields?: Json | null
          created_at?: string | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          retry_payload?: Json | null
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          source?: string
          status?: string | null
          store_id: string
          woo_id?: number | null
        }
        Update: {
          change_type?: string
          changed_fields?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          retry_payload?: Json | null
          snapshot_after?: Json | null
          snapshot_before?: Json | null
          source?: string
          status?: string | null
          store_id?: string
          woo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_changes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_minor: number
          client_id: string
          coupon_id: string | null
          created_at: string
          currency: string
          discount_minor: number
          gateway: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_invoice_ref: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
        }
        Insert: {
          amount_minor: number
          client_id: string
          coupon_id?: string | null
          created_at?: string
          currency: string
          discount_minor?: number
          gateway?: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_invoice_ref?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
        }
        Update: {
          amount_minor?: number
          client_id?: string
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_minor?: number
          gateway?: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_invoice_ref?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_configs: {
        Row: {
          config: Json
          id: string
          role: string
          scope: string
          site_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          role: string
          scope?: string
          site_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          role?: string
          scope?: string
          site_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_configs_site_id_fkey"
            columns: ["site_id"]
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
      payment_methods: {
        Row: {
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string
          key: string
          label: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_interval: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_custom: boolean
          max_api_calls_per_month: number
          max_products_per_site: number
          max_sites: number
          max_users: number
          name: string
          prices: Json
          slug: string
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom?: boolean
          max_api_calls_per_month?: number
          max_products_per_site?: number
          max_sites?: number
          max_users?: number
          name: string
          prices?: Json
          slug: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_custom?: boolean
          max_api_calls_per_month?: number
          max_products_per_site?: number
          max_sites?: number
          max_users?: number
          name?: string
          prices?: Json
          slug?: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_variations: {
        Row: {
          attributes: Json | null
          created_at: string | null
          description: string | null
          dimensions: Json | null
          downloadable: boolean | null
          gallery: Json | null
          id: string
          image: Json | null
          manage_stock: boolean | null
          menu_order: number | null
          price: number | null
          product_id: string | null
          raw_data: Json | null
          regular_price: number | null
          sale_price: number | null
          sku: string | null
          status: string | null
          stock_quantity: number | null
          stock_status: string | null
          store_id: string
          synced_at: string | null
          tax_class: string | null
          updated_at: string | null
          virtual: boolean | null
          weight: string | null
          woo_id: number
          woo_parent_id: number
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          downloadable?: boolean | null
          gallery?: Json | null
          id?: string
          image?: Json | null
          manage_stock?: boolean | null
          menu_order?: number | null
          price?: number | null
          product_id?: string | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          sku?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          store_id: string
          synced_at?: string | null
          tax_class?: string | null
          updated_at?: string | null
          virtual?: boolean | null
          weight?: string | null
          woo_id: number
          woo_parent_id: number
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          downloadable?: boolean | null
          gallery?: Json | null
          id?: string
          image?: Json | null
          manage_stock?: boolean | null
          menu_order?: number | null
          price?: number | null
          product_id?: string | null
          raw_data?: Json | null
          regular_price?: number | null
          sale_price?: number | null
          sku?: string | null
          status?: string | null
          stock_quantity?: number | null
          stock_status?: string | null
          store_id?: string
          synced_at?: string | null
          tax_class?: string | null
          updated_at?: string | null
          virtual?: boolean | null
          weight?: string | null
          woo_id?: number
          woo_parent_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variations_store_id_fkey"
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
          billing_currency: string | null
          client_id: string | null
          country_code: string | null
          created_at: string | null
          default_landing_path: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_currency?: string | null
          client_id?: string | null
          country_code?: string | null
          created_at?: string | null
          default_landing_path?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_currency?: string | null
          client_id?: string | null
          country_code?: string | null
          created_at?: string | null
          default_landing_path?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      schema_dump: {
        Row: {
          ddl: string | null
          sort: number | null
        }
        Insert: {
          ddl?: string | null
          sort?: number | null
        }
        Update: {
          ddl?: string | null
          sort?: number | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          celebration_shown_at: string | null
          client_id: string | null
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string | null
          currency: string | null
          health_checked_at: string | null
          health_issues: Json | null
          health_score: number | null
          id: string
          initial_sync_completed_at: string | null
          last_full_sync_at: string | null
          last_sync_at: string | null
          logo_url: string | null
          name: string
          next_sync_at: string | null
          onboarding_completed_at: string | null
          screenshot_captured_at: string | null
          screenshot_url: string | null
          short_id: string | null
          status: string | null
          sync_interval: number | null
          timezone: string | null
          updated_at: string | null
          url: string
          woo_key_id: number | null
          wp_app_password: string | null
          wp_username: string | null
        }
        Insert: {
          celebration_shown_at?: string | null
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          currency?: string | null
          health_checked_at?: string | null
          health_issues?: Json | null
          health_score?: number | null
          id?: string
          initial_sync_completed_at?: string | null
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          logo_url?: string | null
          name: string
          next_sync_at?: string | null
          onboarding_completed_at?: string | null
          screenshot_captured_at?: string | null
          screenshot_url?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          timezone?: string | null
          updated_at?: string | null
          url: string
          woo_key_id?: number | null
          wp_app_password?: string | null
          wp_username?: string | null
        }
        Update: {
          celebration_shown_at?: string | null
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          currency?: string | null
          health_checked_at?: string | null
          health_issues?: Json | null
          health_score?: number | null
          id?: string
          initial_sync_completed_at?: string | null
          last_full_sync_at?: string | null
          last_sync_at?: string | null
          logo_url?: string | null
          name?: string
          next_sync_at?: string | null
          onboarding_completed_at?: string | null
          screenshot_captured_at?: string | null
          screenshot_url?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          timezone?: string | null
          updated_at?: string | null
          url?: string
          woo_key_id?: number | null
          wp_app_password?: string | null
          wp_username?: string | null
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
      subscription_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["subscription_status"] | null
          id: string
          metadata: Json | null
          subscription_id: string
          to_status: Database["public"]["Enums"]["subscription_status"] | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          metadata?: Json | null
          subscription_id: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          id?: string
          metadata?: Json | null
          subscription_id?: string
          to_status?: Database["public"]["Enums"]["subscription_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          api_calls_this_period: number
          auto_renew_disabled_reason: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          client_id: string
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          gateway: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_subscription_ref: string | null
          grace_period_days: number
          id: string
          last_charge_attempt_at: string | null
          last_charge_failed_at: string | null
          payment_method_id: string | null
          pending_coupon_id: string | null
          plan_id: string
          renewal_mode: Database["public"]["Enums"]["renewal_mode"]
          status: Database["public"]["Enums"]["subscription_status"]
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          api_calls_this_period?: number
          auto_renew_disabled_reason?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          client_id: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_subscription_ref?: string | null
          grace_period_days?: number
          id?: string
          last_charge_attempt_at?: string | null
          last_charge_failed_at?: string | null
          payment_method_id?: string | null
          pending_coupon_id?: string | null
          plan_id: string
          renewal_mode?: Database["public"]["Enums"]["renewal_mode"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          api_calls_this_period?: number
          auto_renew_disabled_reason?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          client_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["billing_gateway"] | null
          gateway_subscription_ref?: string | null
          grace_period_days?: number
          id?: string
          last_charge_attempt_at?: string | null
          last_charge_failed_at?: string | null
          payment_method_id?: string | null
          pending_coupon_id?: string | null
          plan_id?: string
          renewal_mode?: Database["public"]["Enums"]["renewal_mode"]
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pending_coupon_id_fkey"
            columns: ["pending_coupon_id"]
            isOneToOne: false
            referencedRelation: "billing_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_benchmarks: {
        Row: {
          aspect: string
          completed_at: string
          duration_seconds: number
          id: string
          is_initial: boolean
          record_count: number
          store_id: string
        }
        Insert: {
          aspect: string
          completed_at?: string
          duration_seconds?: number
          id?: string
          is_initial?: boolean
          record_count?: number
          store_id: string
        }
        Update: {
          aspect?: string
          completed_at?: string
          duration_seconds?: number
          id?: string
          is_initial?: boolean
          record_count?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_benchmarks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          aspect: string
          attempt: number
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_total: number | null
          id: string
          is_initial: boolean | null
          next_retry_at: string | null
          processed_total: number | null
          records_created: number | null
          records_processed: number | null
          records_updated: number | null
          request_method: string | null
          request_params: Json | null
          request_url: string | null
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          started_at: string | null
          status: string | null
          store_id: string
        }
        Insert: {
          aspect: string
          attempt?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_total?: number | null
          id?: string
          is_initial?: boolean | null
          next_retry_at?: string | null
          processed_total?: number | null
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          request_method?: string | null
          request_params?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          started_at?: string | null
          status?: string | null
          store_id: string
        }
        Update: {
          aspect?: string
          attempt?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_total?: number | null
          id?: string
          is_initial?: boolean | null
          next_retry_at?: string | null
          processed_total?: number | null
          records_created?: number | null
          records_processed?: number | null
          records_updated?: number | null
          request_method?: string | null
          request_params?: Json | null
          request_url?: string | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
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
      tags: {
        Row: {
          count: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          raw_data: Json | null
          slug: string | null
          store_id: string
          synced_at: string | null
          woo_id: number
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          raw_data?: Json | null
          slug?: string | null
          store_id: string
          synced_at?: string | null
          woo_id: number
        }
        Update: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          raw_data?: Json | null
          slug?: string | null
          store_id?: string
          synced_at?: string | null
          woo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          clicked_at: string | null
          client_id: string | null
          created_at: string
          cta_label: string | null
          cta_url: string | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          lottie_url: string | null
          metadata: Json
          priority: number
          shown_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          lottie_url?: string | null
          metadata?: Json
          priority?: number
          shown_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          lottie_url?: string | null
          metadata?: Json
          priority?: number
          shown_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_view_preferences: {
        Row: {
          id: string
          preferences: Json
          updated_at: string
          user_id: string
          view_key: string
        }
        Insert: {
          id?: string
          preferences?: Json
          updated_at?: string
          user_id: string
          view_key: string
        }
        Update: {
          id?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
          view_key?: string
        }
        Relationships: []
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
      webhook_test_results: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          id: string
          response_body: string | null
          response_status: number | null
          store_id: string | null
          success: boolean | null
          test_payload: Json | null
          tested_at: string | null
          webhook_id: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          response_body?: string | null
          response_status?: number | null
          store_id?: string | null
          success?: boolean | null
          test_payload?: Json | null
          tested_at?: string | null
          webhook_id: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          response_body?: string | null
          response_status?: number | null
          store_id?: string | null
          success?: boolean | null
          test_payload?: Json | null
          tested_at?: string | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_test_results_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_test_results_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
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
      bootstrap_super_admin: { Args: never; Returns: undefined }
      can_bootstrap_super_admin: { Args: never; Returns: boolean }
      current_user_client_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      get_site_home_stats:
        | { Args: { p_store_id: string; p_tz?: string }; Returns: Json }
        | {
            Args: { p_currency?: string; p_store_id: string; p_tz?: string }
            Returns: Json
          }
      has_permission: { Args: { perm: string }; Returns: boolean }
      increment_api_call_count: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      increment_coupon_redemption_count: {
        Args: { coupon_id_in: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      recalc_customer_aggregates: {
        Args: { p_customer_woo_id: number; p_store_id: string }
        Returns: undefined
      }
      user_can_access_store: { Args: { p_store_id: string }; Returns: boolean }
    }
    Enums: {
      billing_gateway: "myfatoorah" | "razorpay"
      coupon_type: "percent" | "fixed" | "free_months"
      invoice_status: "pending" | "paid" | "failed" | "refunded" | "void"
      renewal_mode: "auto" | "manual"
      subscription_status:
        | "pending_payment"
        | "trialing"
        | "active"
        | "past_due"
        | "locked"
        | "canceled"
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
      billing_gateway: ["myfatoorah", "razorpay"],
      coupon_type: ["percent", "fixed", "free_months"],
      invoice_status: ["pending", "paid", "failed", "refunded", "void"],
      renewal_mode: ["auto", "manual"],
      subscription_status: [
        "pending_payment",
        "trialing",
        "active",
        "past_due",
        "locked",
        "canceled",
      ],
    },
  },
} as const
