 
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
          client_id: string | null
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
          client_id?: string | null
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
          client_id?: string | null
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
      stores: {
        Row: {
          client_id: string | null
          consumer_key: string | null
          consumer_secret: string | null
          created_at: string | null
          health_checked_at: string | null
          health_issues: Json | null
          health_score: number | null
          id: string
          last_sync_at: string | null
          logo_url: string | null
          name: string
          next_sync_at: string | null
          short_id: string | null
          status: string | null
          sync_interval: number | null
          updated_at: string | null
          url: string
          wp_app_password: string | null
          wp_username: string | null
        }
        Insert: {
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          health_checked_at?: string | null
          health_issues?: Json | null
          health_score?: number | null
          id?: string
          last_sync_at?: string | null
          logo_url?: string | null
          name: string
          next_sync_at?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          updated_at?: string | null
          url: string
          wp_app_password?: string | null
          wp_username?: string | null
        }
        Update: {
          client_id?: string | null
          consumer_key?: string | null
          consumer_secret?: string | null
          created_at?: string | null
          health_checked_at?: string | null
          health_issues?: Json | null
          health_score?: number | null
          id?: string
          last_sync_at?: string | null
          logo_url?: string | null
          name?: string
          next_sync_at?: string | null
          short_id?: string | null
          status?: string | null
          sync_interval?: number | null
          updated_at?: string | null
          url?: string
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
      sync_runs: {
        Row: {
          aspect: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_total: number | null
          id: string
          is_initial: boolean | null
          processed_total: number | null
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
          estimated_total?: number | null
          id?: string
          is_initial?: boolean | null
          processed_total?: number | null
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
          estimated_total?: number | null
          id?: string
          is_initial?: boolean | null
          processed_total?: number | null
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
      has_permission: { Args: { perm: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      user_can_access_store: { Args: { p_store_id: string }; Returns: boolean }
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
