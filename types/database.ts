// Generated from the Supabase project nkhpahcmldfuwydeglml schema (supabase gen types). Do not edit by hand.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admission_stage_events: {
        Row: {
          completed_at: string
          id: string
          lead_id: string
          note: string | null
          owner_id: string | null
          signed_off_by: string | null
          stage: Database["public"]["Enums"]["admission_stage"]
        }
        Insert: {
          completed_at?: string
          id?: string
          lead_id: string
          note?: string | null
          owner_id?: string | null
          signed_off_by?: string | null
          stage: Database["public"]["Enums"]["admission_stage"]
        }
        Update: {
          completed_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          owner_id?: string | null
          signed_off_by?: string | null
          stage?: Database["public"]["Enums"]["admission_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "admission_stage_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_stage_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_stage_events_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_turns: {
        Row: {
          cache_read_tokens: number | null
          conversation_id: string
          created_at: string
          id: number
          input_tokens: number | null
          mode: string
          outcome: string | null
          output_tokens: number | null
          question: string | null
          tools: string[]
        }
        Insert: {
          cache_read_tokens?: number | null
          conversation_id: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          mode: string
          outcome?: string | null
          output_tokens?: number | null
          question?: string | null
          tools?: string[]
        }
        Update: {
          cache_read_tokens?: number | null
          conversation_id?: string
          created_at?: string
          id?: never
          input_tokens?: number | null
          mode?: string
          outcome?: string | null
          output_tokens?: number | null
          question?: string | null
          tools?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assistant_turns_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      bsat_registrations: {
        Row: {
          created_at: string
          hall_ticket: string
          id: string
          lead_id: string
          score_pct: number | null
          session_id: string
          stream: string
        }
        Insert: {
          created_at?: string
          hall_ticket: string
          id?: string
          lead_id: string
          score_pct?: number | null
          session_id: string
          stream: string
        }
        Update: {
          created_at?: string
          hall_ticket?: string
          id?: string
          lead_id?: string
          score_pct?: number | null
          session_id?: string
          stream?: string
        }
        Relationships: [
          {
            foreignKeyName: "bsat_registrations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bsat_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bsat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bsat_sessions: {
        Row: {
          active: boolean
          capacity: number
          exam_date: string
          id: string
          mode: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          exam_date: string
          id: string
          mode: string
        }
        Update: {
          active?: boolean
          capacity?: number
          exam_date?: string
          id?: string
          mode?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          interest: Database["public"]["Enums"]["lead_category"] | null
          lead_id: string
          next_follow_up_at: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["call_outcome"]
          recording_url: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["lead_category"] | null
          lead_id: string
          next_follow_up_at?: string | null
          notes?: string | null
          outcome: Database["public"]["Enums"]["call_outcome"]
          recording_url?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          interest?: Database["public"]["Enums"]["lead_category"] | null
          lead_id?: string
          next_follow_up_at?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          author: string
          conversation_id: string
          created_at: string
          id: string
          staff_id: string | null
          text: string
          wa_message_id: string | null
        }
        Insert: {
          author: string
          conversation_id: string
          created_at?: string
          id?: string
          staff_id?: string | null
          text: string
          wa_message_id?: string | null
        }
        Update: {
          author?: string
          conversation_id?: string
          created_at?: string
          id?: string
          staff_id?: string | null
          text?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_wa_message_id_fkey"
            columns: ["wa_message_id"]
            isOneToOne: false
            referencedRelation: "wa_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assignee_id: string | null
          channel: string
          close_note: string | null
          closed_at: string | null
          consent_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string
          lead_id: string | null
          status: string
          unread: number
          visitor_token_hash: string | null
        }
        Insert: {
          assignee_id?: string | null
          channel: string
          close_note?: string | null
          closed_at?: string | null
          consent_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          lead_id?: string | null
          status: string
          unread?: number
          visitor_token_hash?: string | null
        }
        Update: {
          assignee_id?: string | null
          channel?: string
          close_note?: string | null
          closed_at?: string | null
          consent_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string
          lead_id?: string | null
          status?: string
          unread?: number
          visitor_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          generated_at: string
          payload: Json
          recipients: number
          report_date: string
        }
        Insert: {
          generated_at: string
          payload: Json
          recipients?: number
          report_date: string
        }
        Update: {
          generated_at?: string
          payload?: Json
          recipients?: number
          report_date?: string
        }
        Relationships: []
      }
      hostel_events: {
        Row: {
          alerted: number
          at: string
          created_at: string
          device: string
          device_event_id: string
          direction: string
          id: string
          student_id: string
        }
        Insert: {
          alerted?: number
          at: string
          created_at?: string
          device: string
          device_event_id: string
          direction: string
          id?: string
          student_id: string
        }
        Update: {
          alerted?: number
          at?: string
          created_at?: string
          device?: string
          device_event_id?: string
          direction?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      id_counters: {
        Row: {
          key: string
          value: number
        }
        Insert: {
          key: string
          value: number
        }
        Update: {
          key?: string
          value?: number
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          actor_id: string
          created: number
          created_at: string
          duplicates_in_file: number
          file_name: string
          id: string
          invalid: number
          merged: number
          source: string
          total_rows: number
        }
        Insert: {
          actor_id: string
          created?: number
          created_at?: string
          duplicates_in_file?: number
          file_name: string
          id?: string
          invalid?: number
          merged?: number
          source: string
          total_rows: number
        }
        Update: {
          actor_id?: string
          created?: number
          created_at?: string
          duplicates_in_file?: number
          file_name?: string
          id?: string
          invalid?: number
          merged?: number
          source?: string
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_audit: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          field: string | null
          id: number
          lead_id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          field?: string | null
          id?: never
          lead_id: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          field?: string | null
          id?: never
          lead_id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_audit_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          doc_key: string
          lead_id: string
          note: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          doc_key: string
          lead_id: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          doc_key?: string
          lead_id?: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_touchpoints: {
        Row: {
          created_at: string
          device: string | null
          id: string
          landing: string | null
          lead_id: string
          note: string | null
          page: string | null
          program: string | null
          referrer: string | null
          source: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          landing?: string | null
          lead_id: string
          note?: string | null
          page?: string | null
          program?: string | null
          referrer?: string | null
          source: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          landing?: string | null
          lead_id?: string
          note?: string | null
          page?: string | null
          program?: string | null
          referrer?: string | null
          source?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_touchpoints_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area: string | null
          assigned_at: string | null
          board: string | null
          category: Database["public"]["Enums"]["lead_category"] | null
          class_level: string | null
          college_id: string | null
          consent: boolean
          consent_at: string | null
          contact_name: string | null
          created_at: string
          first_source: string
          id: string
          import_batch_id: string | null
          last_contact_at: string | null
          last_source: string
          lost_competitor: string | null
          lost_reason: string | null
          merged_into: string | null
          next_follow_up_at: string | null
          owner_id: string | null
          parent_name: string | null
          phone: string
          program: string | null
          school: string | null
          sibling_of: string | null
          stage: Database["public"]["Enums"]["admission_stage"]
          status: Database["public"]["Enums"]["lead_status"]
          student_name: string | null
          student_phone: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          assigned_at?: string | null
          board?: string | null
          category?: Database["public"]["Enums"]["lead_category"] | null
          class_level?: string | null
          college_id?: string | null
          consent?: boolean
          consent_at?: string | null
          contact_name?: string | null
          created_at?: string
          first_source: string
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          last_source: string
          lost_competitor?: string | null
          lost_reason?: string | null
          merged_into?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          parent_name?: string | null
          phone: string
          program?: string | null
          school?: string | null
          sibling_of?: string | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          status?: Database["public"]["Enums"]["lead_status"]
          student_name?: string | null
          student_phone?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          assigned_at?: string | null
          board?: string | null
          category?: Database["public"]["Enums"]["lead_category"] | null
          class_level?: string | null
          college_id?: string | null
          consent?: boolean
          consent_at?: string | null
          contact_name?: string | null
          created_at?: string
          first_source?: string
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          last_source?: string
          lost_competitor?: string | null
          lost_reason?: string | null
          merged_into?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          parent_name?: string | null
          phone?: string
          program?: string | null
          school?: string | null
          sibling_of?: string | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          status?: Database["public"]["Enums"]["lead_status"]
          student_name?: string | null
          student_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sibling_of_fkey"
            columns: ["sibling_of"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      login_audit: {
        Row: {
          actor_id: string | null
          at: string
          email: string | null
          id: number
          ip: string | null
          method: string
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          email?: string | null
          id?: never
          ip?: string | null
          method?: string
          reason?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          email?: string | null
          id?: never
          ip?: string | null
          method?: string
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_challenges: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          phone: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          phone: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          phone?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          id: string
          lead_id: string
          mode: string
          paid_on: string
          receipt_at: string | null
          receipt_no: string | null
          recorded_at: string
          recorded_by: string | null
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          lead_id: string
          mode: string
          paid_on: string
          receipt_at?: string | null
          receipt_no?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reference?: string | null
          status: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          lead_id?: string
          mode?: string
          paid_on?: string
          receipt_at?: string | null
          receipt_no?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      records: {
        Row: {
          collection: string
          created_at: string
          data: Json
          id: string
          k1: string | null
          k2: string | null
          updated_at: string
        }
        Insert: {
          collection: string
          created_at?: string
          data: Json
          id?: string
          k1?: string | null
          k2?: string | null
          updated_at?: string
        }
        Update: {
          collection?: string
          created_at?: string
          data?: Json
          id?: string
          k1?: string | null
          k2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          is_staff: boolean
          key: string
          label: string
        }
        Insert: {
          is_staff?: boolean
          key: string
          label: string
        }
        Update: {
          is_staff?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      staff_auth: {
        Row: {
          failed_count: number
          locked_until: string | null
          profile_id: string
          recovery_hashes: string[]
          session_version: number
          totp_enabled_at: string | null
          totp_last_step: number
          totp_pending_enc: string | null
          totp_secret_enc: string | null
          updated_at: string
        }
        Insert: {
          failed_count?: number
          locked_until?: string | null
          profile_id: string
          recovery_hashes?: string[]
          session_version?: number
          totp_enabled_at?: string | null
          totp_last_step?: number
          totp_pending_enc?: string | null
          totp_secret_enc?: string | null
          updated_at?: string
        }
        Update: {
          failed_count?: number
          locked_until?: string | null
          profile_id?: string
          recovery_hashes?: string[]
          session_version?: number
          totp_enabled_at?: string | null
          totp_last_step?: number
          totp_pending_enc?: string | null
          totp_secret_enc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_auth_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          added_at: string
          added_by: string | null
          name: string
          phone: string
          relation: string
          student_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          name: string
          phone: string
          relation: string
          student_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          name?: string
          phone?: string
          relation?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          college_id: string | null
          created_at: string
          created_by: string
          dob: string
          full_name: string
          gender: string
          guardian_name: string
          guardian_phone: string
          id: string
          lead_id: string
          login_phone: string | null
          program: string
          stay: string
        }
        Insert: {
          college_id?: string | null
          created_at?: string
          created_by: string
          dob: string
          full_name: string
          gender: string
          guardian_name: string
          guardian_phone: string
          id?: string
          lead_id: string
          login_phone?: string | null
          program: string
          stay: string
        }
        Update: {
          college_id?: string | null
          created_at?: string
          created_by?: string
          dob?: string
          full_name?: string
          gender?: string
          guardian_name?: string
          guardian_phone?: string
          id?: string
          lead_id?: string
          login_phone?: string | null
          program?: string
          stay?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_reversals: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          lead_id: string
          reason: string
          requested_at: string
          requested_by: string
          stage: Database["public"]["Enums"]["admission_stage"]
          status: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          lead_id: string
          reason: string
          requested_at?: string
          requested_by: string
          stage: Database["public"]["Enums"]["admission_stage"]
          status?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          lead_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          stage?: Database["public"]["Enums"]["admission_stage"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_reversals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_reversals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_reversals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_slots: {
        Row: {
          active: boolean
          capacity: number
          label: string
          saturday: boolean
          slot: string
        }
        Insert: {
          active?: boolean
          capacity: number
          label: string
          saturday?: boolean
          slot: string
        }
        Update: {
          active?: boolean
          capacity?: number
          label?: string
          saturday?: boolean
          slot?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          created_at: string
          family_size: number
          id: string
          lead_id: string
          outcome: string | null
          outcome_at: string | null
          outcome_by: string | null
          program: string | null
          slot: string
          status: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          family_size?: number
          id?: string
          lead_id: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          program?: string | null
          slot: string
          status?: string
          visit_date: string
        }
        Update: {
          created_at?: string
          family_size?: number
          id?: string
          lead_id?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          program?: string | null
          slot?: string
          status?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_outcome_by_fkey"
            columns: ["outcome_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_slot_fkey"
            columns: ["slot"]
            isOneToOne: false
            referencedRelation: "visit_slots"
            referencedColumns: ["slot"]
          },
        ]
      }
      wa_inbound: {
        Row: {
          from_phone: string
          id: string
          lead_id: string | null
          provider_message_id: string
          received_at: string
          text: string | null
          type: string
        }
        Insert: {
          from_phone: string
          id?: string
          lead_id?: string | null
          provider_message_id: string
          received_at: string
          text?: string | null
          type: string
        }
        Update: {
          from_phone?: string
          id?: string
          lead_id?: string | null
          provider_message_id?: string
          received_at?: string
          text?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_inbound_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          error: string | null
          id: string
          lead_id: string | null
          provider_message_id: string | null
          status: string
          template: string
          to_phone: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_message_id?: string | null
          status: string
          template: string
          to_phone: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          error?: string | null
          id?: string
          lead_id?: string | null
          provider_message_id?: string | null
          status?: string
          template?: string
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_opt_outs: {
        Row: {
          at: string
          phone: string
          source: string
        }
        Insert: {
          at?: string
          phone: string
          source: string
        }
        Update: {
          at?: string
          phone?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_conversation_message: {
        Args: {
          p_at: string
          p_author: string
          p_conversation: string
          p_staff: string
          p_text: string
          p_wa_message: string
        }
        Returns: {
          author: string
          conversation_id: string
          created_at: string
          id: string
          staff_id: string | null
          text: string
          wa_message_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "conversation_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_save_staff: {
        Args: {
          p_active: boolean
          p_email: string
          p_full_name: string
          p_id: string
          p_phone: string
          p_roles: string[]
        }
        Returns: undefined
      }
      auth_consume_recovery: {
        Args: { p_hash: string; p_profile: string }
        Returns: boolean
      }
      auth_record_failure: {
        Args: { p_lock_seconds: number; p_max: number; p_profile: string }
        Returns: {
          failed_count: number
          locked_until: string | null
          profile_id: string
          recovery_hashes: string[]
          session_version: number
          totp_enabled_at: string | null
          totp_last_step: number
          totp_pending_enc: string | null
          totp_secret_enc: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_auth"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_use_step: {
        Args: { p_profile: string; p_step: number }
        Returns: boolean
      }
      book_visit: { Args: { p: Json }; Returns: string }
      can_see_all_leads: { Args: never; Returns: boolean }
      capture_lead: {
        Args: { p: Json }
        Returns: {
          is_new: boolean
          lead_id: string
        }[]
      }
      create_sibling: {
        Args: { p: Json; p_actor: string; p_lead: string }
        Returns: string
      }
      create_student: {
        Args: { p: Json; p_actor: string; p_lead: string }
        Returns: undefined
      }
      decide_reversal: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_id: string
          p_note: string
        }
        Returns: Database["public"]["Enums"]["admission_stage"][]
      }
      has_any_role: { Args: { roles: string[] }; Returns: boolean }
      import_leads: {
        Args: {
          p_actor: string
          p_batch: string
          p_file: string
          p_rows: Json
          p_source: string
        }
        Returns: {
          created: number
          merged: number
        }[]
      }
      issue_college_id: {
        Args: {
          p_actor: string
          p_codes: Json
          p_digits: number
          p_lead: string
          p_template: string
          p_year: number
        }
        Returns: string
      }
      issue_receipts: {
        Args: {
          p_actor: string
          p_counter: string
          p_digits: number
          p_lead: string
          p_prefix: string
        }
        Returns: string[]
      }
      next_counter: { Args: { p_key: string }; Returns: number }
      register_bsat: {
        Args: { p: Json }
        Returns: {
          already_registered: boolean
          hall_ticket: string
        }[]
      }
      sign_off_stage: {
        Args: {
          p_actor: string
          p_lead: string
          p_note: string
          p_stage: Database["public"]["Enums"]["admission_stage"]
        }
        Returns: undefined
      }
      wa_apply_status: {
        Args: { p_error: string; p_provider_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      admission_stage:
        | "enquiry"
        | "visit"
        | "counselling"
        | "application"
        | "documents"
        | "fee"
        | "receipt"
        | "student_record"
        | "college_id"
      call_outcome:
        | "connected"
        | "not_answered"
        | "busy"
        | "switched_off"
        | "wrong_number"
      lead_category: "hot" | "warm" | "cold" | "invalid"
      lead_status:
        | "open"
        | "visit_scheduled"
        | "visited"
        | "counselled"
        | "decision_pending"
        | "confirmed"
        | "lost"
        | "admitted"
        | "invalid"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      admission_stage: [
        "enquiry",
        "visit",
        "counselling",
        "application",
        "documents",
        "fee",
        "receipt",
        "student_record",
        "college_id",
      ],
      call_outcome: [
        "connected",
        "not_answered",
        "busy",
        "switched_off",
        "wrong_number",
      ],
      lead_category: ["hot", "warm", "cold", "invalid"],
      lead_status: [
        "open",
        "visit_scheduled",
        "visited",
        "counselled",
        "decision_pending",
        "confirmed",
        "lost",
        "admitted",
        "invalid",
      ],
    },
  },
} as const
