
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
          id: string;
          title: string | null;
          detail: string | null;
          done: boolean | null;
          start_date: string | null;
          end_date: string | null;
          start_time: string | null;
          end_time: string | null;
          inserted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          title?: string | null;
          detail?: string | null;
          done?: boolean | null;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          inserted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          id?: string;
          title?: string | null;
          detail?: string | null;
          done?: boolean | null;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          inserted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
