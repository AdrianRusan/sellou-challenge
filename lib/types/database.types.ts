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
      pdf_parsing_jobs: {
        Row: {
          id: string
          file_name: string
          file_path: string
          file_size: number | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          total_pages: number | null
          processed_pages: number
          parsed_content: Json | null
          extracted_text: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          file_name: string
          file_path: string
          file_size?: number | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          total_pages?: number | null
          processed_pages?: number
          parsed_content?: Json | null
          extracted_text?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          total_pages?: number | null
          processed_pages?: number
          parsed_content?: Json | null
          extracted_text?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
