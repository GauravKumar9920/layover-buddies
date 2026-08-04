export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agreements: {
        Row: {
          booking_id: string
          buddy_fee_paise: number
          buddy_signed_at: string | null
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
      bookings: {
        Row: {
          actual_expenses: number | null
          arrival_flight_number: string | null
          arrival_time: string | null
          available_window_minutes: number | null
          buddy_cost: number
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          departure_flight_number: string | null
          departure_time: string | null
          ended_by_buddy_at: string | null
          estimated_expenses: number | null
          gst_amount: number | null
          guide_id: string
          id: string
          itinerary_id: string | null
          payment_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee: number | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_end_time: string | null
          tour_start_time: string | null
          traveler_id: string
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
          cancelled_by?: string | null
          created_at?: string | null
          departure_flight_number?: string | null
          departure_time?: string | null
          ended_by_buddy_at?: string | null
          estimated_expenses?: number | null
          gst_amount?: number | null
          guide_id: string
          id?: string
          itinerary_id?: string | null
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          tour_end_time?: string | null
          tour_start_time?: string | null
          traveler_id: string
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
          cancelled_by?: string | null
          created_at?: string | null
          departure_flight_number?: string | null
          departure_time?: string | null
          ended_by_buddy_at?: string | null
          estimated_expenses?: number | null
          gst_amount?: number | null
          guide_id?: string
          id?: string
          itinerary_id?: string | null
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          tour_end_time?: string | null
          tour_start_time?: string | null
          traveler_id?: string
          trip_qr_scanned_at?: string | null
          trip_qr_scanned_by_user_id?: string | null
          trip_qr_token?: string | null
          updated_at?: string | null
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
      guide_profiles: {
        Row: {
          aadhaar_verified: boolean | null
          avg_rating: number | null
          bio: string | null
          college_verified: boolean | null
          course: string | null
          created_at: string | null
          earnings_total: number | null
          hometown: string | null
          id: string
          interview_passed: boolean | null
          invite_codes_available: number | null
          is_active: boolean | null
          languages: Json | null
          police_verified: boolean | null
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
          hometown?: string | null
          id?: string
          interview_passed?: boolean | null
          invite_codes_available?: number | null
          is_active?: boolean | null
          languages?: Json | null
          police_verified?: boolean | null
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
          hometown?: string | null
          id?: string
          interview_passed?: boolean | null
          invite_codes_available?: number | null
          is_active?: boolean | null
          languages?: Json | null
          police_verified?: boolean | null
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
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
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
          initiated_at: string
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
          initiated_at?: string
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
          initiated_at?: string
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
      platform_settings: {
        Row: {
          commission_rate: number
          early_access_mode: boolean
          gst_rate: number
          id: number
          late_fee_paise: number
          platform_fee_down_rate: number
          platform_fee_up_rate: number
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
          tds_rate?: number
          updated_at?: string
        }
        Relationships: []
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
      sos_alerts: {
        Row: {
          booking_id: string
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
      traveler_profiles: {
        Row: {
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          nationality: string | null
          preferred_language: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          nationality?: string | null
          preferred_language?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          nationality?: string | null
          preferred_language?: string | null
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
      users: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_verified: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_verified?: boolean | null
          phone?: string | null
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
      backfill_public_users_from_auth: { Args: never; Returns: number }
      get_effective_rates: {
        Args: never
        Returns: {
          early_access_mode: boolean
          platform_fee_up_rate: number
          platform_fee_down_rate: number
          commission_rate: number
          gst_rate: number
          tds_rate: number
          late_fee_paise: number
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
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      handle_new_auth_user_sync: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      sync_current_auth_user: { Args: never; Returns: undefined }
      user_can_see_booking: { Args: { b_id: string }; Returns: boolean }
    }
    Enums: {
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
      payment_kind: "deposit" | "balance" | "late_fee" | "top_up" | "refund"
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
      payout_method: "bank_transfer" | "upi"
      payout_status: "pending" | "processing" | "completed" | "failed"
      sos_status: "triggered" | "acknowledged" | "resolved"
      stop_category:
        | "food"
        | "attraction"
        | "transport"
        | "shopping"
        | "experience"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
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
      payment_kind: ["deposit", "balance", "late_fee", "top_up", "refund"],
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
      ],
      payout_method: ["bank_transfer", "upi"],
      payout_status: ["pending", "processing", "completed", "failed"],
      sos_status: ["triggered", "acknowledged", "resolved"],
      stop_category: [
        "food",
        "attraction",
        "transport",
        "shopping",
        "experience",
      ],
      user_role: ["traveler", "guide", "admin"],
    },
  },
} as const
