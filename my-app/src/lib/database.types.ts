
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
          inserted_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          title?: string | null;
          detail?: string | null;
          done?: boolean | null;
          inserted_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          id?: string;
          title?: string | null;
          detail?: string | null;
          done?: boolean | null;
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
