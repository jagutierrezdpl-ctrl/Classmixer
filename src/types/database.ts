export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      centers: {
        Row: {
          id: string
          name: string
          address: string | null
          city: string | null
          country: string | null
          openrouter_api_key: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          city?: string | null
          country?: string | null
          openrouter_api_key?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          city?: string | null
          country?: string | null
          openrouter_api_key?: string | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          center_id: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role?: string
          center_id?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          center_id?: string | null
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      processes: {
        Row: {
          id: string
          center_id: string
          name: string
          school_year: string
          source_level: string
          target_level: string
          source_groups: string[]
          target_groups: string[]
          target_class_count: number
          min_class_size: number
          max_class_size: number
          status: string
          questionnaire_deadline: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          center_id: string
          name: string
          school_year: string
          source_level: string
          target_level: string
          source_groups?: string[]
          target_groups?: string[]
          target_class_count?: number
          min_class_size?: number
          max_class_size?: number
          status?: string
          questionnaire_deadline?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          center_id?: string
          name?: string
          school_year?: string
          source_level?: string
          target_level?: string
          source_groups?: string[]
          target_groups?: string[]
          target_class_count?: number
          min_class_size?: number
          max_class_size?: number
          status?: string
          questionnaire_deadline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          process_id: string
          external_id: string
          first_name: string
          last_name: string
          current_class: string
          gender: string
          average_grade: number
          academic_level: string | null
          behavior_level: string | null
          needs_type: string | null
          observations: string | null
          tutor: string | null
          is_repeating: boolean
          support_type: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          external_id: string
          first_name: string
          last_name: string
          current_class: string
          gender: string
          average_grade: number
          academic_level?: string | null
          behavior_level?: string | null
          needs_type?: string | null
          observations?: string | null
          tutor?: string | null
          is_repeating?: boolean
          support_type?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          current_class?: string
          gender?: string
          average_grade?: number
          academic_level?: string | null
          behavior_level?: string | null
          needs_type?: string | null
          observations?: string | null
          tutor?: string | null
          is_repeating?: boolean
          support_type?: string | null
          active?: boolean
        }
        Relationships: []
      }
      questionnaire_settings: {
        Row: {
          id: string
          process_id: string
          friendship_enabled: boolean
          friendship_min: number
          friendship_max: number
          work_enabled: boolean
          work_min: number
          work_max: number
          emotional_enabled: boolean
          emotional_min: number
          emotional_max: number
          negative_enabled: boolean
          negative_max: number
          access_mode: string
          deadline: string | null
        }
        Insert: {
          id?: string
          process_id: string
          friendship_enabled?: boolean
          friendship_min?: number
          friendship_max?: number
          work_enabled?: boolean
          work_min?: number
          work_max?: number
          emotional_enabled?: boolean
          emotional_min?: number
          emotional_max?: number
          negative_enabled?: boolean
          negative_max?: number
          access_mode?: string
          deadline?: string | null
        }
        Update: {
          friendship_enabled?: boolean
          friendship_min?: number
          friendship_max?: number
          work_enabled?: boolean
          work_min?: number
          work_max?: number
          emotional_enabled?: boolean
          emotional_min?: number
          emotional_max?: number
          negative_enabled?: boolean
          negative_max?: number
          access_mode?: string
          deadline?: string | null
        }
        Relationships: []
      }
      questionnaire_tokens: {
        Row: {
          id: string
          process_id: string
          student_id: string
          token: string
          used: boolean
          completed_at: string | null
        }
        Insert: {
          id?: string
          process_id: string
          student_id: string
          token: string
          used?: boolean
          completed_at?: string | null
        }
        Update: {
          used?: boolean
          completed_at?: string | null
        }
        Relationships: []
      }
      responses: {
        Row: {
          id: string
          process_id: string
          respondent_student_id: string
          target_student_id: string
          relation_type: string
          weight: number
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          respondent_student_id: string
          target_student_id: string
          relation_type: string
          weight?: number
          created_at?: string
        }
        Update: {
          weight?: number
        }
        Relationships: []
      }
      rules: {
        Row: {
          id: string
          process_id: string
          rule_type: string
          priority: string
          description: string | null
          target_class: string | null
          max_count: number | null
          created_by: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          rule_type: string
          priority?: string
          description?: string | null
          target_class?: string | null
          max_count?: number | null
          created_by: string
          active?: boolean
          created_at?: string
        }
        Update: {
          rule_type?: string
          priority?: string
          description?: string | null
          target_class?: string | null
          max_count?: number | null
          active?: boolean
        }
        Relationships: []
      }
      rule_students: {
        Row: {
          id: string
          rule_id: string
          student_id: string
          role: string | null
        }
        Insert: {
          id?: string
          rule_id: string
          student_id: string
          role?: string | null
        }
        Update: {
          role?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          id: string
          process_id: string
          name: string
          score_total: number
          score_social: number
          score_academic: number
          score_gender: number
          score_behavior: number
          status: string
          generated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          process_id: string
          name: string
          score_total?: number
          score_social?: number
          score_academic?: number
          score_gender?: number
          score_behavior?: number
          status?: string
          generated_at?: string
          created_by?: string | null
        }
        Update: {
          name?: string
          score_total?: number
          score_social?: number
          score_academic?: number
          score_gender?: number
          score_behavior?: number
          status?: string
        }
        Relationships: []
      }
      proposal_assignments: {
        Row: {
          id: string
          proposal_id: string
          student_id: string
          target_class: string
          locked: boolean
        }
        Insert: {
          id?: string
          proposal_id: string
          student_id: string
          target_class: string
          locked?: boolean
        }
        Update: {
          target_class?: string
          locked?: boolean
        }
        Relationships: []
      }
      proposal_metrics: {
        Row: {
          id: string
          proposal_id: string
          metric_key: string
          metric_value: number
          target_class: string | null
          created_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          metric_key: string
          metric_value: number
          target_class?: string | null
          created_at?: string
        }
        Update: {
          metric_value?: number
        }
        Relationships: []
      }
      sociogram_metrics: {
        Row: {
          id: string
          process_id: string
          student_id: string
          received_count: number
          given_count: number
          reciprocal_count: number
          centrality: number
          betweenness: number
          isolation_score: number
          community_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          student_id: string
          received_count?: number
          given_count?: number
          reciprocal_count?: number
          centrality?: number
          betweenness?: number
          isolation_score?: number
          community_id?: number | null
          created_at?: string
        }
        Update: {
          received_count?: number
          given_count?: number
          reciprocal_count?: number
          centrality?: number
          betweenness?: number
          isolation_score?: number
          community_id?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          center_id: string
          process_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          center_id: string
          process_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          created_at?: string
          metadata?: Json | null
        }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
