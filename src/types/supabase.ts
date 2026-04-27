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
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          is_guest: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          is_guest?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          is_guest?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          id: string
          slug: string
          display_name: string
          description: string | null
          is_enabled: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          slug: string
          display_name: string
          description?: string | null
          is_enabled?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string
          display_name?: string
          description?: string | null
          is_enabled?: boolean
          metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      game_modes: {
        Row: {
          game_id: string
          id: string
          display_name: string
          min_players: number
          max_players: number
          is_enabled: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          game_id: string
          id: string
          display_name: string
          min_players: number
          max_players: number
          is_enabled?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          min_players?: number
          max_players?: number
          is_enabled?: boolean
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          id: string
          game_id: string
          mode_id: string
          code: string
          status: 'waiting' | 'playing' | 'finished' | 'cancelled'
          host_id: string
          min_players: number
          max_players: number
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      session_participants: {
        Row: {
          session_id: string
          player_id: string
          slot: number
          is_ready: boolean
          joined_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      card_game_session_state: {
        Row: {
          session_id: string
          dealt_hands: Json
          selected_creatures: Json
          state: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          session_id: string
          dealt_hands?: Json
          selected_creatures?: Json
          state?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          dealt_hands?: Json
          selected_creatures?: Json
          state?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      session_results: {
        Row: {
          session_id: string
          game_id: string
          mode_id: string
          player_id: string
          rank: number
          score: number
          season_points: number
          reward_currency_id: string | null
          reward_amount: number | null
          result_payload: Json
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      player_game_profiles: {
        Row: {
          player_id: string
          game_id: string
          games_played: number
          games_won: number
          best_score: number
          total_score: number
          season_points: number
          rewards_earned: number
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      player_balances: {
        Row: {
          player_id: string
          currency_id: string
          balance: number
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          season_id: string
          game_id: string
          mode_id: string
          player_id: string
          points: number
          wins: number
          games_played: number
          best_score: number
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      leaderboard_seasons: {
        Row: {
          id: string
          game_id: string
          mode_id: string
          display_name: string
          starts_at: string
          ends_at: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      playhub_get_or_create_profile: {
        Args: { p_display_name?: string | null }
        Returns: Json
      }
      playhub_create_session: {
        Args: { p_game_id: string; p_mode_id: string }
        Returns: Json
      }
      playhub_join_session: {
        Args: { p_code: string }
        Returns: Json
      }
      playhub_leave_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      playhub_set_ready: {
        Args: { p_session_id: string; p_ready: boolean }
        Returns: Json
      }
      playhub_start_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      playhub_finish_session: {
        Args: { p_session_id: string; p_results: Json }
        Returns: Json
      }
      card_game_get_session_state: {
        Args: { p_session_id: string }
        Returns: Json
      }
      card_game_set_selection: {
        Args: { p_session_id: string; p_selected_creatures: string[] }
        Returns: Json
      }
      card_game_set_state: {
        Args: { p_session_id: string; p_state: Json }
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
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never
