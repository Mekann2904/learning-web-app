export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          title: string | null
          detail: string | null
          done: boolean | null
          inserted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          title?: string | null
          detail?: string | null
          done?: boolean | null
          inserted_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          title?: string | null
          detail?: string | null
          done?: boolean | null
          inserted_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      task_defs: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          kind: "single" | "habit"
          active: boolean
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          description?: string | null
          kind?: "single" | "habit"
          active?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          kind?: "single" | "habit"
          active?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      period_rules: {
        Row: {
          id: string
          task_id: string
          cadence: "daily" | "weekly" | "monthly" | "interval"
          times_per_period: number | null
          period: string
          days_of_week: number[] | null
          week_start: number | null
          timezone: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          cadence: "daily" | "weekly" | "monthly" | "interval"
          times_per_period?: number | null
          period?: string
          days_of_week?: number[] | null
          week_start?: number | null
          timezone?: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          cadence?: "daily" | "weekly" | "monthly" | "interval"
          times_per_period?: number | null
          period?: string
          days_of_week?: number[] | null
          week_start?: number | null
          timezone?: string
          created_at?: string
        }
      }
      time_rules: {
        Row: {
          id: string
          task_id: string
          start_time: string | null
          end_time: string | null
          anytime: boolean
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          start_time?: string | null
          end_time?: string | null
          anytime?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          start_time?: string | null
          end_time?: string | null
          anytime?: boolean
          created_at?: string
        }
      }
      exec_logs: {
        Row: {
          id: string
          task_id: string
          happened_at: string
          qty: number | null
          note: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          happened_at?: string
          qty?: number | null
          note?: string | null
          source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          happened_at?: string
          qty?: number | null
          note?: string | null
          source?: string | null
          created_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      task_tags: {
        Row: {
          task_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          task_id?: string
          tag_id?: string
          created_at?: string
        }
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
