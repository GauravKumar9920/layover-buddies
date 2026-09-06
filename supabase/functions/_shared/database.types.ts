// Generated from the local migration state. Keep this artifact inside the
// Supabase function tree so the Edge deployment bundler can resolve it; the
// @detour/database workspace re-exports the same type for browser clients.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_action_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["admin_role"]
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          reason: string | null
          request_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: Database["public"]["Enums"]["admin_role"]
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"]
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          invited_at: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string
          invited_by?: string | null
          is_active?: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_realtime_signals: {
        Row: {
          created_at: string
          entity_id: string
          event_type: string
          id: number
          safe_payload: Json
          topic: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_type: string
          id?: never
          safe_payload?: Json
          topic: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_type?: string
          id?: never
          safe_payload?: Json
          topic?: string
        }
        Relationships: []
      }
      agreements: {
        Row: {
          booking_id: string
          buddy_fee_paise: number
          buddy_signed_at: string | null
          buddy_signed_name: string | null
          buffer_paise: number
          cancellation_terms_version: string
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          created_at: string
          drafted_at: string | null
          drafted_by_user_id: string
          gst_rate: number
          id: string
          itinerary_fund_paise: number
          pdf_url: string | null
          platform_fee_down_rate: number
          platform_fee_up_rate: number
          sent_at: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          tds_rate: number
          traveler_gst_paise: number
          traveler_signed_at: string | null
          traveler_signed_name: string | null
          traveler_subtotal_paise: number
          traveler_total_paise: number
          trip_ends_at: string | null
          trip_starts_at: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          buddy_fee_paise: number
          buddy_signed_at?: string | null
          buddy_signed_name?: string | null
          buffer_paise: number
          cancellation_terms_version?: string
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          created_at?: string
          drafted_at?: string | null
          drafted_by_user_id: string
          gst_rate?: number
          id?: string
          itinerary_fund_paise: number
          pdf_url?: string | null
          platform_fee_down_rate?: number
          platform_fee_up_rate?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          tds_rate?: number
          traveler_gst_paise: number
          traveler_signed_at?: string | null
          traveler_signed_name?: string | null
          traveler_subtotal_paise: number
          traveler_total_paise: number
          trip_ends_at?: string | null
          trip_starts_at: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          buddy_fee_paise?: number
          buddy_signed_at?: string | null
          buddy_signed_name?: string | null
          buffer_paise?: number
          cancellation_terms_version?: string
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          created_at?: string
          drafted_at?: string | null
          drafted_by_user_id?: string
          gst_rate?: number
          id?: string
          itinerary_fund_paise?: number
          pdf_url?: string | null
          platform_fee_down_rate?: number
          platform_fee_up_rate?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["agreement_status"]
          tds_rate?: number
          traveler_gst_paise?: number
          traveler_signed_at?: string | null
          traveler_signed_name?: string | null
          traveler_subtotal_paise?: number
          traveler_total_paise?: number
          trip_ends_at?: string | null
          trip_starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agreements_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_drafted_by_user_id_fkey"
            columns: ["drafted_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "agreements_drafted_by_user_id_fkey"
            columns: ["drafted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          actual_expenses: number | null
          arrival_flight_number: string | null
          arrival_time: string | null
          available_window_minutes: number | null
          buddy_cost: number
          cancellation_reason: string | null
          cancellation_trigger_event: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          cancelled_resolution_jsonb: Json | null
          completed_at: string | null
          created_at: string | null
          departure_flight_number: string | null
          departure_time: string | null
          ended_by_buddy_at: string | null
          estimated_expenses: number | null
          gst_amount: number | null
          guide_id: string
          id: string
          itinerary_id: string | null
          late_fee_assessed_at: string | null
          late_fee_paise: number
          num_travelers: number
          payment_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee: number | null
          proofs_due_at: string | null
          rating_link_sent_at: string | null
          reconciled_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_end_time: string | null
          tour_start_time: string | null
          traveler_id: string
          trip_pot_released_at: string | null
          trip_qr_scanned_at: string | null
          trip_qr_scanned_by_user_id: string | null
          trip_qr_token: string | null
          updated_at: string | null
        }
        Insert: {
          actual_expenses?: number | null
          arrival_flight_number?: string | null
          arrival_time?: string | null
          available_window_minutes?: number | null
          buddy_cost: number
          cancellation_reason?: string | null
          cancellation_trigger_event?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          cancelled_resolution_jsonb?: Json | null
          completed_at?: string | null
          created_at?: string | null
          departure_flight_number?: string | null
          departure_time?: string | null
          ended_by_buddy_at?: string | null
          estimated_expenses?: number | null
          gst_amount?: number | null
          guide_id: string
          id?: string
          itinerary_id?: string | null
          late_fee_assessed_at?: string | null
          late_fee_paise?: number
          num_travelers?: number
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number | null
          proofs_due_at?: string | null
          rating_link_sent_at?: string | null
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_end_time?: string | null
          tour_start_time?: string | null
          traveler_id: string
          trip_pot_released_at?: string | null
          trip_qr_scanned_at?: string | null
          trip_qr_scanned_by_user_id?: string | null
          trip_qr_token?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_expenses?: number | null
          arrival_flight_number?: string | null
          arrival_time?: string | null
          available_window_minutes?: number | null
          buddy_cost?: number
          cancellation_reason?: string | null
          cancellation_trigger_event?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_user_id?: string | null
          cancelled_reason?: string | null
          cancelled_resolution_jsonb?: Json | null
          completed_at?: string | null
          created_at?: string | null
          departure_flight_number?: string | null
          departure_time?: string | null
          ended_by_buddy_at?: string | null
          estimated_expenses?: number | null
          gst_amount?: number | null
          guide_id?: string
          id?: string
          itinerary_id?: string | null
          late_fee_assessed_at?: string | null
          late_fee_paise?: number
          num_travelers?: number
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number | null
          proofs_due_at?: string | null
          rating_link_sent_at?: string | null
          reconciled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          tour_end_time?: string | null
          tour_start_time?: string | null
          traveler_id?: string
          trip_pot_released_at?: string | null
          trip_qr_scanned_at?: string | null
          trip_qr_scanned_by_user_id?: string | null
          trip_qr_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_qr_scanned_by_user_id_fkey"
            columns: ["trip_qr_scanned_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_trip_qr_scanned_by_user_id_fkey"
            columns: ["trip_qr_scanned_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      content_deployment_events: {
        Row: {
          created_at: string
          deployment_id: string
          event_id: string
          id: number
          safe_payload: Json
          status: Database["public"]["Enums"]["content_deployment_status"]
        }
        Insert: {
          created_at?: string
          deployment_id: string
          event_id: string
          id?: never
          safe_payload?: Json
          status: Database["public"]["Enums"]["content_deployment_status"]
        }
        Update: {
          created_at?: string
          deployment_id?: string
          event_id?: string
          id?: never
          safe_payload?: Json
          status?: Database["public"]["Enums"]["content_deployment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "content_deployment_events_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "content_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_deployments: {
        Row: {
          completed_at: string | null
          deployment_url: string | null
          error_message: string | null
          id: string
          last_webhook_event_id: string | null
          metadata: Json
          preview_url: string | null
          provider_deployment_id: string | null
          requested_at: string
          requested_by: string | null
          sanity_document_id: string
          sanity_document_type: string | null
          sanity_version: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["content_deployment_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          deployment_url?: string | null
          error_message?: string | null
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          preview_url?: string | null
          provider_deployment_id?: string | null
          requested_at?: string
          requested_by?: string | null
          sanity_document_id: string
          sanity_document_type?: string | null
          sanity_version?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_deployment_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          deployment_url?: string | null
          error_message?: string | null
          id?: string
          last_webhook_event_id?: string | null
          metadata?: Json
          preview_url?: string | null
          provider_deployment_id?: string | null
          requested_at?: string
          requested_by?: string | null
          sanity_document_id?: string
          sanity_document_type?: string | null
          sanity_version?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["content_deployment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      cost_line_items: {
        Row: {
          agreement_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          description: string
          estimated_paise: number
          id: string
          position: number
        }
        Insert: {
          agreement_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          description: string
          estimated_paise: number
          id?: string
          position?: number
        }
        Update: {
          agreement_id?: string
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          description?: string
          estimated_paise?: number
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_line_items_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount_paise: number
          booking_id: string
          created_at: string
          held_at: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_refund_id: string | null
          resolution_reason: string | null
          resolved_at: string | null
          side: Database["public"]["Enums"]["deposit_side"]
          status: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Insert: {
          amount_paise?: number
          booking_id: string
          created_at?: string
          held_at?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_refund_id?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          side: Database["public"]["Enums"]["deposit_side"]
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Update: {
          amount_paise?: number
          booking_id?: string
          created_at?: string
          held_at?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_refund_id?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          side?: Database["public"]["Enums"]["deposit_side"]
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_proofs: {
        Row: {
          amount_paise: number
          bill_url: string | null
          booking_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          description: string | null
          id: string
          payment_proof_url: string
          uploaded_by_user_id: string
        }
        Insert: {
          amount_paise: number
          bill_url?: string | null
          booking_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          description?: string | null
          id?: string
          payment_proof_url: string
          uploaded_by_user_id: string
        }
        Update: {
          amount_paise?: number
          bill_url?: string | null
          booking_id?: string
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          description?: string | null
          id?: string
          payment_proof_url?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_proofs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_proofs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_proofs_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expense_proofs_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          booking_id: string
          category: Database["public"]["Enums"]["expense_category"]
          description: string | null
          id: string
          logged_at: string | null
          logged_by: string
          receipt_image_url: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          category: Database["public"]["Enums"]["expense_category"]
          description?: string | null
          id?: string
          logged_at?: string | null
          logged_by: string
          receipt_image_url?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          description?: string | null
          id?: string
          logged_at?: string | null
          logged_by?: string
          receipt_image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          itinerary_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          itinerary_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          itinerary_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_tracking: {
        Row: {
          actual_time: string | null
          booking_id: string
          delay_minutes: number | null
          estimated_time: string | null
          flight_number: string
          flight_type: Database["public"]["Enums"]["flight_type"]
          id: string
          last_checked_at: string | null
          scheduled_time: string
          status: Database["public"]["Enums"]["flight_status"]
        }
        Insert: {
          actual_time?: string | null
          booking_id: string
          delay_minutes?: number | null
          estimated_time?: string | null
          flight_number: string
          flight_type: Database["public"]["Enums"]["flight_type"]
          id?: string
          last_checked_at?: string | null
          scheduled_time: string
          status?: Database["public"]["Enums"]["flight_status"]
        }
        Update: {
          actual_time?: string | null
          booking_id?: string
          delay_minutes?: number | null
          estimated_time?: string | null
          flight_number?: string
          flight_type?: Database["public"]["Enums"]["flight_type"]
          id?: string
          last_checked_at?: string | null
          scheduled_time?: string
          status?: Database["public"]["Enums"]["flight_status"]
        }
        Relationships: [
          {
            foreignKeyName: "flight_tracking_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_tracking_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_report_cache: {
        Row: {
          end_date: string
          expires_at: string
          generated_at: string
          id: string
          payload: Json
          provider: string
          report_name: string
          start_date: string
          warnings: string[]
        }
        Insert: {
          end_date: string
          expires_at: string
          generated_at?: string
          id?: string
          payload: Json
          provider: string
          report_name: string
          start_date: string
          warnings?: string[]
        }
        Update: {
          end_date?: string
          expires_at?: string
          generated_at?: string
          id?: string
          payload?: Json
          provider?: string
          report_name?: string
          start_date?: string
          warnings?: string[]
        }
        Relationships: []
      }
      guide_profile_photos: {
        Row: {
          caption: string | null
          created_at: string
          guide_profile_id: string
          id: string
          position: number
          role: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          guide_profile_id: string
          id?: string
          position?: number
          role: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          guide_profile_id?: string
          id?: string
          position?: number
          role?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_profile_photos_guide_profile_id_fkey"
            columns: ["guide_profile_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_profile_photos_guide_profile_id_fkey"
            columns: ["guide_profile_id"]
            isOneToOne: false
            referencedRelation: "guide_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_profiles: {
        Row: {
          aadhaar_verified: boolean | null
          avg_rating: number | null
          bio: string | null
          college_verified: boolean | null
          course: string | null
          created_at: string | null
          earnings_total: number | null
          gallery_urls: string[] | null
          hometown: string | null
          id: string
          interview_passed: boolean | null
          invite_codes_available: number | null
          is_active: boolean | null
          languages: Json | null
          police_verified: boolean | null
          profile_completed_at: string | null
          profile_status: string
          prompts: Json | null
          pull_quote: string | null
          referred_by: string | null
          response_time_minutes: number | null
          skills: Json | null
          total_reviews: number | null
          total_trips: number | null
          university: string | null
          updated_at: string | null
          user_id: string
          video_intro_url: string | null
          year_of_study: string | null
        }
        Insert: {
          aadhaar_verified?: boolean | null
          avg_rating?: number | null
          bio?: string | null
          college_verified?: boolean | null
          course?: string | null
          created_at?: string | null
          earnings_total?: number | null
          gallery_urls?: string[] | null
          hometown?: string | null
          id?: string
          interview_passed?: boolean | null
          invite_codes_available?: number | null
          is_active?: boolean | null
          languages?: Json | null
          police_verified?: boolean | null
          profile_completed_at?: string | null
          profile_status?: string
          prompts?: Json | null
          pull_quote?: string | null
          referred_by?: string | null
          response_time_minutes?: number | null
          skills?: Json | null
          total_reviews?: number | null
          total_trips?: number | null
          university?: string | null
          updated_at?: string | null
          user_id: string
          video_intro_url?: string | null
          year_of_study?: string | null
        }
        Update: {
          aadhaar_verified?: boolean | null
          avg_rating?: number | null
          bio?: string | null
          college_verified?: boolean | null
          course?: string | null
          created_at?: string | null
          earnings_total?: number | null
          gallery_urls?: string[] | null
          hometown?: string | null
          id?: string
          interview_passed?: boolean | null
          invite_codes_available?: number | null
          is_active?: boolean | null
          languages?: Json | null
          police_verified?: boolean | null
          profile_completed_at?: string | null
          profile_status?: string
          prompts?: Json | null
          pull_quote?: string | null
          referred_by?: string | null
          response_time_minutes?: number | null
          skills?: Json | null
          total_reviews?: number | null
          total_trips?: number | null
          university?: string | null
          updated_at?: string | null
          user_id?: string
          video_intro_url?: string | null
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guide_profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "guide_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string
          id: string
          is_used: boolean | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          avg_rating: number | null
          buddy_cost: number
          category: Database["public"]["Enums"]["itinerary_category"]
          cover_image_url: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          duration_hours: number
          estimated_expense: number | null
          gallery_urls: string[] | null
          guide_id: string
          id: string
          is_published: boolean | null
          max_travelers: number
          prompts: Json | null
          story_blocks: Json | null
          title: string
          total_bookings: number | null
          updated_at: string | null
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          avg_rating?: number | null
          buddy_cost: number
          category?: Database["public"]["Enums"]["itinerary_category"]
          cover_image_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_hours: number
          estimated_expense?: number | null
          gallery_urls?: string[] | null
          guide_id: string
          id?: string
          is_published?: boolean | null
          max_travelers?: number
          prompts?: Json | null
          story_blocks?: Json | null
          title: string
          total_bookings?: number | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          avg_rating?: number | null
          buddy_cost?: number
          category?: Database["public"]["Enums"]["itinerary_category"]
          cover_image_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_hours?: number
          estimated_expense?: number | null
          gallery_urls?: string[] | null
          guide_id?: string
          id?: string
          is_published?: boolean | null
          max_travelers?: number
          prompts?: Json | null
          story_blocks?: Json | null
          title?: string
          total_bookings?: number | null
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "itineraries_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_stops: {
        Row: {
          category: Database["public"]["Enums"]["stop_category"]
          description: string | null
          estimated_cost: number | null
          estimated_duration_minutes: number | null
          id: string
          image_url: string | null
          itinerary_id: string
          location_lat: number | null
          location_lng: number | null
          name: string
          stop_order: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["stop_category"]
          description?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          image_url?: string | null
          itinerary_id: string
          location_lat?: number | null
          location_lng?: number | null
          name: string
          stop_order: number
        }
        Update: {
          category?: Database["public"]["Enums"]["stop_category"]
          description?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          image_url?: string | null
          itinerary_id?: string
          location_lat?: number | null
          location_lng?: number | null
          name?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_stops_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      location_tracking: {
        Row: {
          booking_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_tracking_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_tracking_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "location_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_attribution_daily: {
        Row: {
          archived_at: string
          campaign: string
          completed_trips: number
          landing_page: string
          leads: number
          linked_bookings: number
          medium: string
          metric_date: string
          qualified_leads: number
          source: string
        }
        Insert: {
          archived_at?: string
          campaign: string
          completed_trips?: number
          landing_page: string
          leads?: number
          linked_bookings?: number
          medium: string
          metric_date: string
          qualified_leads?: number
          source: string
        }
        Update: {
          archived_at?: string
          campaign?: string
          completed_trips?: number
          landing_page?: string
          leads?: number
          linked_bookings?: number
          medium?: string
          metric_date?: string
          qualified_leads?: number
          source?: string
        }
        Relationships: []
      }
      marketing_lead_rate_limits: {
        Row: {
          key_hash: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          key_hash: string
          request_count: number
          updated_at?: string
          window_started_at: string
        }
        Update: {
          key_hash?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          arrival: string | null
          closed_at: string | null
          converted_at: string | null
          created_at: string
          departure: string | null
          email: string | null
          first_attribution: Json
          first_contacted_at: string | null
          flight_numbers: string | null
          id: string
          interests: string | null
          landing_page: string
          last_attribution: Json
          linked_booking_id: string | null
          linked_user_id: string | null
          metadata: Json
          name: string | null
          owner_admin_id: string | null
          pii_redact_after: string | null
          pii_redacted_at: string | null
          qualified_at: string | null
          rate_limit_key_hash: string | null
          request_type: string
          status: Database["public"]["Enums"]["marketing_lead_status"]
          submission_fingerprint: string | null
          updated_at: string
        }
        Insert: {
          arrival?: string | null
          closed_at?: string | null
          converted_at?: string | null
          created_at?: string
          departure?: string | null
          email?: string | null
          first_attribution?: Json
          first_contacted_at?: string | null
          flight_numbers?: string | null
          id?: string
          interests?: string | null
          landing_page: string
          last_attribution?: Json
          linked_booking_id?: string | null
          linked_user_id?: string | null
          metadata?: Json
          name?: string | null
          owner_admin_id?: string | null
          pii_redact_after?: string | null
          pii_redacted_at?: string | null
          qualified_at?: string | null
          rate_limit_key_hash?: string | null
          request_type: string
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          submission_fingerprint?: string | null
          updated_at?: string
        }
        Update: {
          arrival?: string | null
          closed_at?: string | null
          converted_at?: string | null
          created_at?: string
          departure?: string | null
          email?: string | null
          first_attribution?: Json
          first_contacted_at?: string | null
          flight_numbers?: string | null
          id?: string
          interests?: string | null
          landing_page?: string
          last_attribution?: Json
          linked_booking_id?: string | null
          linked_user_id?: string | null
          metadata?: Json
          name?: string | null
          owner_admin_id?: string | null
          pii_redact_after?: string | null
          pii_redacted_at?: string | null
          qualified_at?: string | null
          rate_limit_key_hash?: string | null
          request_type?: string
          status?: Database["public"]["Enums"]["marketing_lead_status"]
          submission_fingerprint?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_leads_linked_booking_id_fkey"
            columns: ["linked_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_linked_booking_id_fkey"
            columns: ["linked_booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_leads_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "marketing_leads_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      match_requests: {
        Row: {
          expires_at: string | null
          guide_id: string
          guide_message: string | null
          guide_proposed_cost: number | null
          id: string
          match_score: number | null
          responded_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          traveler_id: string
        }
        Insert: {
          expires_at?: string | null
          guide_id: string
          guide_message?: string | null
          guide_proposed_cost?: number | null
          id?: string
          match_score?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          traveler_id: string
        }
        Update: {
          expires_at?: string | null
          guide_id?: string
          guide_message?: string | null
          guide_proposed_cost?: number | null
          id?: string
          match_score?: number | null
          responded_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          traveler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_requests_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_requests_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_requests_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_requests_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          booking_id: string
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          booking_id: string
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          booking_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          booking_id: string | null
          created_at: string | null
          data: Json | null
          deep_link: string | null
          dismissed_at: string | null
          id: string
          is_read: boolean | null
          kind: string | null
          payload: Json
          push_failed_at: string | null
          push_failed_reason: string | null
          push_sent_at: string | null
          read_at: string | null
          recipient_user_id: string | null
          sent_at: string
          title: string | null
          type: Database["public"]["Enums"]["notification_type"] | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          data?: Json | null
          deep_link?: string | null
          dismissed_at?: string | null
          id?: string
          is_read?: boolean | null
          kind?: string | null
          payload?: Json
          push_failed_at?: string | null
          push_failed_reason?: string | null
          push_sent_at?: string | null
          read_at?: string | null
          recipient_user_id?: string | null
          sent_at?: string
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          created_at?: string | null
          data?: Json | null
          deep_link?: string | null
          dismissed_at?: string | null
          id?: string
          is_read?: boolean | null
          kind?: string | null
          payload?: Json
          push_failed_at?: string | null
          push_failed_reason?: string | null
          push_sent_at?: string | null
          read_at?: string | null
          recipient_user_id?: string | null
          sent_at?: string
          title?: string | null
          type?: Database["public"]["Enums"]["notification_type"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_paise: number
          booking_id: string
          captured_at: string | null
          failed_reason: string | null
          fx_rate_at_capture: number | null
          id: string
          idempotency_key: string | null
          initiated_at: string
          is_late_fee_component: boolean
          kind: Database["public"]["Enums"]["payment_kind"]
          original_amount_minor_units: number | null
          original_currency: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: Database["public"]["Enums"]["payment_event_status"]
          user_id: string
        }
        Insert: {
          amount_paise: number
          booking_id: string
          captured_at?: string | null
          failed_reason?: string | null
          fx_rate_at_capture?: number | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          is_late_fee_component?: boolean
          kind: Database["public"]["Enums"]["payment_kind"]
          original_amount_minor_units?: number | null
          original_currency?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_event_status"]
          user_id: string
        }
        Update: {
          amount_paise?: number
          booking_id?: string
          captured_at?: string | null
          failed_reason?: string | null
          fx_rate_at_capture?: number | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          is_late_fee_component?: boolean
          kind?: Database["public"]["Enums"]["payment_kind"]
          original_amount_minor_units?: number | null
          original_currency?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: Database["public"]["Enums"]["payment_event_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_dispatches: {
        Row: {
          booking_id: string
          buffer_clawback_paise: number
          completed_at: string | null
          deposit_component_paise: number
          failed_reason: string | null
          gross_paise: number
          id: string
          initiated_at: string
          kind: Database["public"]["Enums"]["payout_kind"]
          net_paise: number
          razorpay_fund_account_id: string | null
          razorpay_payout_id: string | null
          razorpay_refund_id: string | null
          recipient_user_id: string
          status: Database["public"]["Enums"]["payout_dispatch_status"]
          tds_paise: number
        }
        Insert: {
          booking_id: string
          buffer_clawback_paise?: number
          completed_at?: string | null
          deposit_component_paise?: number
          failed_reason?: string | null
          gross_paise: number
          id?: string
          initiated_at?: string
          kind: Database["public"]["Enums"]["payout_kind"]
          net_paise: number
          razorpay_fund_account_id?: string | null
          razorpay_payout_id?: string | null
          razorpay_refund_id?: string | null
          recipient_user_id: string
          status?: Database["public"]["Enums"]["payout_dispatch_status"]
          tds_paise?: number
        }
        Update: {
          booking_id?: string
          buffer_clawback_paise?: number
          completed_at?: string | null
          deposit_component_paise?: number
          failed_reason?: string | null
          gross_paise?: number
          id?: string
          initiated_at?: string
          kind?: Database["public"]["Enums"]["payout_kind"]
          net_paise?: number
          razorpay_fund_account_id?: string | null
          razorpay_payout_id?: string | null
          razorpay_refund_id?: string | null
          recipient_user_id?: string
          status?: Database["public"]["Enums"]["payout_dispatch_status"]
          tds_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_dispatches_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payout_dispatches_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          bank_details_encrypted: string | null
          guide_id: string
          id: string
          payment_method: Database["public"]["Enums"]["payout_method"]
          processed_at: string | null
          requested_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount: number
          bank_details_encrypted?: string | null
          guide_id: string
          id?: string
          payment_method: Database["public"]["Enums"]["payout_method"]
          processed_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount?: number
          bank_details_encrypted?: string | null
          guide_id?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payout_method"]
          processed_at?: string | null
          requested_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payouts_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          commission_rate: number
          early_access_mode: boolean
          gst_rate: number
          id: number
          late_fee_paise: number
          platform_fee_down_rate: number
          platform_fee_up_rate: number
          pricing_content_deployment_id: string | null
          tds_rate: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          early_access_mode?: boolean
          gst_rate?: number
          id?: number
          late_fee_paise?: number
          platform_fee_down_rate?: number
          platform_fee_up_rate?: number
          pricing_content_deployment_id?: string | null
          tds_rate?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          early_access_mode?: boolean
          gst_rate?: number
          id?: number
          late_fee_paise?: number
          platform_fee_down_rate?: number
          platform_fee_up_rate?: number
          pricing_content_deployment_id?: string | null
          tds_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_pricing_content_deployment_id_fkey"
            columns: ["pricing_content_deployment_id"]
            isOneToOne: false
            referencedRelation: "content_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          booking_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string
          reporter_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          overall_rating: number
          personality_rating: number | null
          reviewee_id: string
          reviewer_id: string
          safety_rating: number | null
          value_for_money_rating: number | null
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          overall_rating: number
          personality_rating?: number | null
          reviewee_id: string
          reviewer_id: string
          safety_rating?: number | null
          value_for_money_rating?: number | null
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          overall_rating?: number
          personality_rating?: number | null
          reviewee_id?: string
          reviewer_id?: string
          safety_rating?: number | null
          value_for_money_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      search_console_daily: {
        Row: {
          clicks: number
          country: string
          ctr: number
          device: string
          id: number
          impressions: number
          metric_date: string
          page: string
          position: number
          query: string
          search_type: string
          site_url: string
          synced_at: string
        }
        Insert: {
          clicks?: number
          country?: string
          ctr?: number
          device?: string
          id?: never
          impressions?: number
          metric_date: string
          page?: string
          position?: number
          query?: string
          search_type?: string
          site_url: string
          synced_at?: string
        }
        Update: {
          clicks?: number
          country?: string
          ctr?: number
          device?: string
          id?: never
          impressions?: number
          metric_date?: string
          page?: string
          position?: number
          query?: string
          search_type?: string
          site_url?: string
          synced_at?: string
        }
        Relationships: []
      }
      sos_alerts: {
        Row: {
          booking_id: string
          delivered_at: string | null
          dispatch_attempts: number
          dispatch_channels: string[]
          dispatch_last_attempt_at: string | null
          dispatch_last_error: string | null
          dispatch_status: string
          id: string
          latitude: number
          longitude: number
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["sos_status"]
          triggered_at: string | null
          triggered_by: string
        }
        Insert: {
          booking_id: string
          delivered_at?: string | null
          dispatch_attempts?: number
          dispatch_channels?: string[]
          dispatch_last_attempt_at?: string | null
          dispatch_last_error?: string | null
          dispatch_status?: string
          id?: string
          latitude: number
          longitude: number
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string | null
          triggered_by: string
        }
        Update: {
          booking_id?: string
          delivered_at?: string | null
          dispatch_attempts?: number
          dispatch_channels?: string[]
          dispatch_last_attempt_at?: string | null
          dispatch_last_error?: string | null
          dispatch_status?: string
          id?: string
          latitude?: number
          longitude?: number
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_alerts_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sos_alerts_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      top_up_requests: {
        Row: {
          booking_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          payment_event_id: string | null
          purpose: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          requested_paise: number
          status: Database["public"]["Enums"]["top_up_status"]
          traveler_decided_at: string | null
        }
        Insert: {
          booking_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          created_by_user_id: string
          expires_at?: string
          id?: string
          payment_event_id?: string | null
          purpose: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          requested_paise: number
          status?: Database["public"]["Enums"]["top_up_status"]
          traveler_decided_at?: string | null
        }
        Update: {
          booking_id?: string
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          created_by_user_id?: string
          expires_at?: string
          id?: string
          payment_event_id?: string | null
          purpose?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          requested_paise?: number
          status?: Database["public"]["Enums"]["top_up_status"]
          traveler_decided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "top_up_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "top_up_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "pending_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "top_up_requests_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "top_up_requests_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "top_up_requests_payment_event_id_fkey"
            columns: ["payment_event_id"]
            isOneToOne: false
            referencedRelation: "payment_events"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_layovers: {
        Row: {
          airport_code: string
          arrival_at: string
          created_at: string
          departure_at: string
          flight_in: string | null
          flight_out: string | null
          group_size: number
          id: string
          status: string
          traveler_id: string
          updated_at: string
        }
        Insert: {
          airport_code?: string
          arrival_at: string
          created_at?: string
          departure_at: string
          flight_in?: string | null
          flight_out?: string | null
          group_size?: number
          id?: string
          status?: string
          traveler_id: string
          updated_at?: string
        }
        Update: {
          airport_code?: string
          arrival_at?: string
          created_at?: string
          departure_at?: string
          flight_in?: string | null
          flight_out?: string | null
          group_size?: number
          id?: string
          status?: string
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_layovers_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "traveler_layovers_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_profiles: {
        Row: {
          about_me: string | null
          accessibility_notes: string | null
          arrival_at: string | null
          created_at: string | null
          departure_at: string | null
          dietary_preferences: string[] | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          flight_in: string | null
          flight_out: string | null
          gender: string | null
          id: string
          interests: string[] | null
          nationality: string | null
          onboarded_at: string | null
          onboarding_version: number
          preferred_language: string | null
          setup_completed_at: string | null
          travel_pace: string | null
          user_id: string
        }
        Insert: {
          about_me?: string | null
          accessibility_notes?: string | null
          arrival_at?: string | null
          created_at?: string | null
          departure_at?: string | null
          dietary_preferences?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          flight_in?: string | null
          flight_out?: string | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          nationality?: string | null
          onboarded_at?: string | null
          onboarding_version?: number
          preferred_language?: string | null
          setup_completed_at?: string | null
          travel_pace?: string | null
          user_id: string
        }
        Update: {
          about_me?: string | null
          accessibility_notes?: string | null
          arrival_at?: string | null
          created_at?: string | null
          departure_at?: string | null
          dietary_preferences?: string[] | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          flight_in?: string | null
          flight_out?: string | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          nationality?: string | null
          onboarded_at?: string | null
          onboarding_version?: number
          preferred_language?: string | null
          setup_completed_at?: string | null
          travel_pace?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "traveler_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_safety_profiles: {
        Row: {
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          gender: string | null
          traveler_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          traveler_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          gender?: string | null
          traveler_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_safety_profiles_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: true
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "traveler_safety_profiles_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          expo_push_token: string
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          is_valid: boolean
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          expo_push_token: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_valid?: boolean
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          expo_push_token?: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          is_valid?: boolean
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          created_at: string | null
          deleted_at: string | null
          deletion_pending_at: string | null
          email: string
          full_name: string
          id: string
          is_banned: boolean
          is_verified: boolean | null
          payout_vpa: string | null
          phone: string | null
          razorpay_fund_account_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_pending_at?: string | null
          email: string
          full_name: string
          id?: string
          is_banned?: boolean
          is_verified?: boolean | null
          payout_vpa?: string | null
          phone?: string | null
          razorpay_fund_account_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_pending_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_banned?: boolean
          is_verified?: boolean | null
          payout_vpa?: string | null
          phone?: string | null
          razorpay_fund_account_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_guides: {
        Row: {
          avg_rating: number | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          itinerary_count: number | null
          response_time_minutes: number | null
          total_reviews: number | null
          total_trips: number | null
          university: string | null
          user_id: string | null
        }
        Relationships: []
      }
      guide_earnings_summary: {
        Row: {
          avg_tour_earnings: number | null
          completed_tours: number | null
          earned_amount: number | null
          guide_id: string | null
          platform_fees_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_bookings: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          departure_time: string | null
          guide_id: string | null
          guide_name: string | null
          id: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          total_amount: number | null
          traveler_id: string | null
          traveler_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "active_guides"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bookings_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_is_active: { Args: { p_user_id: string }; Returns: boolean }
      admin_claim_money_dispatch_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_dispatch_id: string
          p_family: string
          p_idempotency_key: string
          p_reason: string
          p_request_id?: string
        }
        Returns: Json
      }
      admin_finance_summary: {
        Args: { p_end_date: string; p_start_date: string | null }
        Returns: Json
      }
      admin_idempotent_result: {
        Args: {
          p_action: string
          p_actor_id: string
          p_idempotency_key: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      admin_log_sensitive_access_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_idempotency_key: string
          p_metadata?: Json
          p_reason: string
          p_request_id?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      admin_marketing_attribution_report: {
        Args: { p_end_date: string; p_limit?: number; p_start_date: string }
        Returns: Json
      }
      admin_record_money_dispatch_outcome_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_claim_idempotency_key: string
          p_dispatch_id: string
          p_family: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_resolve_dispute_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_booking_id: string
          p_idempotency_key: string
          p_reason: string
          p_request_id?: string
          p_resolution: string
        }
        Returns: Json
      }
      admin_search_console_report: {
        Args: { p_end_date: string; p_limit?: number; p_start_date: string }
        Returns: Json
      }
      admin_set_user_suspension_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_idempotency_key: string
          p_reason: string
          p_request_id?: string
          p_suspended: boolean
          p_user_id: string
        }
        Returns: Json
      }
      admin_transition_report_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_admin_notes: string
          p_idempotency_key: string
          p_next_status: string
          p_reason: string
          p_report_id: string
          p_request_id?: string
        }
        Returns: Json
      }
      admin_transition_sos_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_idempotency_key: string
          p_next_status: string
          p_reason: string
          p_request_id?: string
          p_resolution_notes: string
          p_sos_alert_id: string
        }
        Returns: Json
      }
      admin_update_marketing_lead_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_idempotency_key: string
          p_lead_id: string
          p_linked_booking_id: string
          p_linked_booking_id_set: boolean
          p_linked_user_id: string
          p_linked_user_id_set: boolean
          p_next_status: string
          p_owner_admin_id: string
          p_owner_admin_id_set: boolean
          p_reason: string
          p_request_id?: string
        }
        Returns: Json
      }
      admin_update_platform_settings_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_commission_rate: number
          p_content_deployment_id: string
          p_early_access_mode: boolean
          p_gst_rate: number
          p_idempotency_key: string
          p_late_fee_paise: number
          p_platform_fee_down_rate: number
          p_platform_fee_up_rate: number
          p_reason: string
          p_request_id?: string
          p_tds_rate: number
        }
        Returns: Json
      }
      admin_upsert_membership_tx: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_idempotency_key: string
          p_is_active: boolean
          p_reason: string
          p_request_id?: string
          p_role: string
          p_user_id: string
        }
        Returns: Json
      }
      anonymize_user_data_tx: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      assert_admin_actor: {
        Args: {
          p_actor_id: string
          p_actor_role: Database["public"]["Enums"]["admin_role"]
          p_allowed_roles: Database["public"]["Enums"]["admin_role"][]
        }
        Returns: undefined
      }
      backfill_public_users_from_auth: { Args: never; Returns: number }
      complete_traveler_onboarding_tx: {
        Args: {
          p_arrival_at: string
          p_departure_at: string
          p_flight_in?: string
          p_flight_out?: string
          p_gender: string
          p_interests?: string[]
          p_nationality: string
        }
        Returns: undefined
      }
      compute_cancellation_resolution_tx: {
        Args: { p_actor: string; p_booking_id: string; p_trigger: string }
        Returns: Json
      }
      compute_reconciliation_tx: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      consume_marketing_lead_rate_limit: {
        Args: {
          p_key_hash: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      create_agreement_draft_tx: {
        Args: {
          p_booking_id: string
          p_trip_ends_at?: string
          p_trip_starts_at: string
        }
        Returns: {
          booking_id: string
          buddy_fee_paise: number
          buddy_signed_at: string | null
          buddy_signed_name: string | null
          buffer_paise: number
          cancellation_terms_version: string
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          created_at: string
          drafted_at: string | null
          drafted_by_user_id: string
          gst_rate: number
          id: string
          itinerary_fund_paise: number
          pdf_url: string | null
          platform_fee_down_rate: number
          platform_fee_up_rate: number
          sent_at: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          tds_rate: number
          traveler_gst_paise: number
          traveler_signed_at: string | null
          traveler_signed_name: string | null
          traveler_subtotal_paise: number
          traveler_total_paise: number
          trip_ends_at: string | null
          trip_starts_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_my_next_layover: {
        Args: {
          p_airport_code?: string
          p_arrival_at: string
          p_departure_at: string
          p_flight_in?: string
          p_flight_out?: string
          p_group_size?: number
        }
        Returns: string
      }
      cron_balance_reminder: { Args: never; Returns: undefined }
      cron_deposit_window_expire: { Args: never; Returns: undefined }
      cron_deposits_held_sweep: { Args: never; Returns: undefined }
      cron_late_fee_assess: { Args: never; Returns: undefined }
      cron_no_pay_cancel: { Args: never; Returns: undefined }
      cron_proofs_overdue: { Args: never; Returns: undefined }
      cron_rating_link_send: { Args: never; Returns: undefined }
      cron_send_pending_pushes: { Args: never; Returns: undefined }
      cron_sync_search_console: { Args: never; Returns: undefined }
      cron_t_minus_12_balance_paid: { Args: never; Returns: undefined }
      current_account_has_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      current_account_is_active: { Args: never; Returns: boolean }
      enqueue_sos_alert: { Args: { p_sos_alert_id: string }; Returns: boolean }
      get_effective_rates: {
        Args: never
        Returns: {
          commission_rate: number
          early_access_mode: boolean
          gst_rate: number
          late_fee_paise: number
          platform_fee_down_rate: number
          platform_fee_up_rate: number
          tds_rate: number
        }[]
      }
      get_my_guide_dashboard_summary: {
        Args: never
        Returns: {
          active_tours_count: number
          average_rating: number
          completed_trips_count: number
          is_active: boolean
          is_published: boolean
          open_inquiries_count: number
          paid_earnings_current_month_paise: number
          paid_earnings_paise: number
          profile_completion_percent: number
          profile_missing_fields: string[]
          profile_status: string
          review_count: number
          upcoming_trips_count: number
        }
      }
      get_my_role: { Args: never; Returns: string }
      guide_profile_missing_fields: {
        Args: { p_profile_id: string }
        Returns: string[]
      }
      handle_new_auth_user_sync: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      is_active_admin: {
        Args: {
          p_require_mfa?: boolean
          p_roles?: Database["public"]["Enums"]["admin_role"][]
        }
        Returns: boolean
      }
      move_my_guide_profile_to_draft: { Args: never; Returns: undefined }
      prepare_account_deletion_tx: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      prune_marketing_lead_rate_limits: { Args: never; Returns: number }
      publish_my_guide_profile: { Args: never; Returns: Json }
      raise_admin_growth_input_error: { Args: never; Returns: boolean }
      redact_expired_marketing_leads: {
        Args: { p_limit?: number }
        Returns: number
      }
      replace_search_console_day_tx: {
        Args: {
          p_metric_date: string
          p_rows: Json
          p_search_type: string
          p_site_url: string
        }
        Returns: number
      }
      retry_pending_sos_alerts: { Args: never; Returns: undefined }
      run_admin2_lead_maintenance: { Args: never; Returns: Json }
      save_my_guide_profile_builder_tx: {
        Args: {
          p_bio: string
          p_full_name: string
          p_gallery: Json
          p_hometown: string
          p_languages: Json
          p_prompts: Json
          p_pull_quote: string
          p_university: string
        }
        Returns: Json
      }
      save_my_guide_profile_tx: {
        Args: {
          p_bio: string
          p_full_name: string
          p_hometown: string
          p_languages: Json
          p_prompts: Json
          p_pull_quote: string
          p_university: string
        }
        Returns: Json
      }
      save_my_traveler_profile_tx: {
        Args: { p_patch: Json }
        Returns: undefined
      }
      schedule_completed_lead_redaction: {
        Args: { p_limit?: number }
        Returns: number
      }
      send_agreement_tx: {
        Args: { p_agreement_id: string }
        Returns: {
          booking_id: string
          buddy_fee_paise: number
          buddy_signed_at: string | null
          buddy_signed_name: string | null
          buffer_paise: number
          cancellation_terms_version: string
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          cancelled_reason: string | null
          created_at: string
          drafted_at: string | null
          drafted_by_user_id: string
          gst_rate: number
          id: string
          itinerary_fund_paise: number
          pdf_url: string | null
          platform_fee_down_rate: number
          platform_fee_up_rate: number
          sent_at: string | null
          status: Database["public"]["Enums"]["agreement_status"]
          tds_rate: number
          traveler_gst_paise: number
          traveler_signed_at: string | null
          traveler_signed_name: string | null
          traveler_subtotal_paise: number
          traveler_total_paise: number
          trip_ends_at: string | null
          trip_starts_at: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agreements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_my_guide_availability: {
        Args: { p_is_active: boolean }
        Returns: undefined
      }
      set_top_up_status: {
        Args: { p_id: string; p_new_status: string }
        Returns: {
          booking_id: string
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          created_by_user_id: string
          expires_at: string
          id: string
          payment_event_id: string | null
          purpose: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          requested_paise: number
          status: Database["public"]["Enums"]["top_up_status"]
          traveler_decided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "top_up_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sign_agreement_tx: {
        Args: { p_agreement_id: string; p_side: string; p_signed_name?: string }
        Returns: {
          agreement_status: Database["public"]["Enums"]["agreement_status"]
          both_signatures_present: boolean
        }[]
      }
      sync_current_auth_user: { Args: never; Returns: undefined }
      upsert_content_deployment_event_tx: {
        Args: {
          p_deployment_id: string
          p_deployment_url: string
          p_error_message: string
          p_event_id: string
          p_metadata: Json
          p_preview_url: string
          p_provider_deployment_id: string
          p_sanity_document_id: string
          p_sanity_document_type: string
          p_sanity_version: string
          p_status: string
        }
        Returns: Json
      }
      user_can_see_booking: { Args: { b_id: string }; Returns: boolean }
      validate_admin_command_fields: {
        Args: { p_idempotency_key: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_role: "owner" | "operations" | "finance" | "growth"
      agreement_status:
        | "draft"
        | "sent"
        | "signed_traveler"
        | "signed_guide"
        | "fully_signed"
        | "cancelled"
        | "expired"
      auth_provider: "email" | "google" | "apple"
      booking_status:
        | "pending"
        | "guide_accepted"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
        | "chat_open"
        | "agreement_drafting"
        | "agreement_sent"
        | "agreement_signed_traveler"
        | "agreement_signed_buddy"
        | "awaiting_deposits"
        | "deposits_held"
        | "awaiting_balance"
        | "late_fee_due"
        | "balance_paid"
        | "trip_ready"
        | "awaiting_proofs"
        | "reconciling"
        | "rated"
        | "cancelled_no_pay"
        | "cancelled_traveler_voluntary"
        | "cancelled_buddy"
        | "cancelled_force_majeure"
        | "cancelled_pre_signing"
        | "cancelled_no_deposit"
      content_deployment_status:
        | "requested"
        | "building"
        | "ready"
        | "failed"
        | "cancelled"
      cost_category: "food" | "transport" | "entry" | "activity" | "misc"
      deposit_side: "traveler" | "buddy"
      deposit_status: "pending" | "held" | "forfeited" | "refunded"
      expense_category:
        | "food"
        | "transport"
        | "entry_fee"
        | "shopping"
        | "other"
      flight_status:
        | "scheduled"
        | "delayed"
        | "landed"
        | "departed"
        | "cancelled"
      flight_type: "arrival" | "departure"
      itinerary_category:
        | "food"
        | "culture"
        | "history"
        | "nightlife"
        | "photography"
        | "adventure"
        | "custom"
      marketing_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "closed"
        | "spam"
      match_status: "sent" | "viewed" | "accepted" | "declined" | "expired"
      notification_type:
        | "match_request"
        | "booking_confirmed"
        | "flight_delayed"
        | "tour_starting"
        | "review_received"
        | "payout_completed"
        | "invite_earned"
        | "sos_alert"
      payment_event_status: "initiated" | "captured" | "failed" | "refunded"
      payment_kind:
        | "deposit"
        | "balance"
        | "late_fee"
        | "top_up"
        | "refund"
        | "platform_credit"
      payment_status:
        | "pending"
        | "paid"
        | "refunded"
        | "partial_refund"
        | "authorized"
        | "captured"
        | "released"
        | "failed"
      payout_dispatch_status: "pending" | "sent" | "failed"
      payout_kind:
        | "trip_pot_release"
        | "buddy_fee_final"
        | "traveler_refund"
        | "cancellation_refund"
        | "force_majeure_refund"
        | "late_fee_forfeit_to_platform"
        | "platform_credit"
        | "traveler_deposit_refund"
        | "buddy_deposit_refund"
        | "trip_fund_cancellation_refund"
        | "buddy_fee_cancellation_refund"
      payout_method: "bank_transfer" | "upi"
      payout_status: "pending" | "processing" | "completed" | "failed"
      report_reason:
        | "harassment"
        | "safety"
        | "inappropriate"
        | "spam"
        | "scam"
        | "other"
      report_status: "open" | "reviewing" | "actioned" | "dismissed"
      sos_status: "triggered" | "acknowledged" | "resolved"
      stop_category:
        | "food"
        | "attraction"
        | "transport"
        | "shopping"
        | "experience"
      top_up_status:
        | "pending"
        | "approved"
        | "declined"
        | "captured"
        | "cancelled"
        | "expired"
      user_role: "traveler" | "guide" | "admin"
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
      admin_role: ["owner", "operations", "finance", "growth"],
      agreement_status: [
        "draft",
        "sent",
        "signed_traveler",
        "signed_guide",
        "fully_signed",
        "cancelled",
        "expired",
      ],
      auth_provider: ["email", "google", "apple"],
      booking_status: [
        "pending",
        "guide_accepted",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
        "chat_open",
        "agreement_drafting",
        "agreement_sent",
        "agreement_signed_traveler",
        "agreement_signed_buddy",
        "awaiting_deposits",
        "deposits_held",
        "awaiting_balance",
        "late_fee_due",
        "balance_paid",
        "trip_ready",
        "awaiting_proofs",
        "reconciling",
        "rated",
        "cancelled_no_pay",
        "cancelled_traveler_voluntary",
        "cancelled_buddy",
        "cancelled_force_majeure",
        "cancelled_pre_signing",
        "cancelled_no_deposit",
      ],
      content_deployment_status: [
        "requested",
        "building",
        "ready",
        "failed",
        "cancelled",
      ],
      cost_category: ["food", "transport", "entry", "activity", "misc"],
      deposit_side: ["traveler", "buddy"],
      deposit_status: ["pending", "held", "forfeited", "refunded"],
      expense_category: ["food", "transport", "entry_fee", "shopping", "other"],
      flight_status: [
        "scheduled",
        "delayed",
        "landed",
        "departed",
        "cancelled",
      ],
      flight_type: ["arrival", "departure"],
      itinerary_category: [
        "food",
        "culture",
        "history",
        "nightlife",
        "photography",
        "adventure",
        "custom",
      ],
      marketing_lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "closed",
        "spam",
      ],
      match_status: ["sent", "viewed", "accepted", "declined", "expired"],
      notification_type: [
        "match_request",
        "booking_confirmed",
        "flight_delayed",
        "tour_starting",
        "review_received",
        "payout_completed",
        "invite_earned",
        "sos_alert",
      ],
      payment_event_status: ["initiated", "captured", "failed", "refunded"],
      payment_kind: [
        "deposit",
        "balance",
        "late_fee",
        "top_up",
        "refund",
        "platform_credit",
      ],
      payment_status: [
        "pending",
        "paid",
        "refunded",
        "partial_refund",
        "authorized",
        "captured",
        "released",
        "failed",
      ],
      payout_dispatch_status: ["pending", "sent", "failed"],
      payout_kind: [
        "trip_pot_release",
        "buddy_fee_final",
        "traveler_refund",
        "cancellation_refund",
        "force_majeure_refund",
        "late_fee_forfeit_to_platform",
        "platform_credit",
        "traveler_deposit_refund",
        "buddy_deposit_refund",
        "trip_fund_cancellation_refund",
        "buddy_fee_cancellation_refund",
      ],
      payout_method: ["bank_transfer", "upi"],
      payout_status: ["pending", "processing", "completed", "failed"],
      report_reason: [
        "harassment",
        "safety",
        "inappropriate",
        "spam",
        "scam",
        "other",
      ],
      report_status: ["open", "reviewing", "actioned", "dismissed"],
      sos_status: ["triggered", "acknowledged", "resolved"],
      stop_category: [
        "food",
        "attraction",
        "transport",
        "shopping",
        "experience",
      ],
      top_up_status: [
        "pending",
        "approved",
        "declined",
        "captured",
        "cancelled",
        "expired",
      ],
      user_role: ["traveler", "guide", "admin"],
    },
  },
} as const
