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
      denuncia_policiais: {
        Row: {
          created_at: string
          denuncia_id: string
          id: string
          nome: string
          rg_funcional: string | null
          unidade: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Insert: {
          created_at?: string
          denuncia_id: string
          id?: string
          nome: string
          rg_funcional?: string | null
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Update: {
          created_at?: string
          denuncia_id?: string
          id?: string
          nome?: string
          rg_funcional?: string | null
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Relationships: [
          {
            foreignKeyName: "denuncia_policiais_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      denuncias: {
        Row: {
          acrescimos_dias: number
          anexos: Json
          certidao_gerada: boolean
          concluido_em: string | null
          created_at: string
          denunciante_anonimo: boolean
          denunciante_contato: string | null
          denunciante_identificador: string | null
          denunciante_nome: string | null
          id: string
          info_adicional: string | null
          instaurada_em: string | null
          interrupcoes_count: number
          links: Json
          numero_protocolo: string
          obs_denunciante: string | null
          obs_internas: string | null
          ocorrencia_data: string | null
          ocorrencia_hora: string | null
          ocorrencia_local: string | null
          ocorrencia_tipo: string | null
          owner_id: string | null
          relato: string
          status: Database["public"]["Enums"]["denuncia_status"]
          termo_inicial: string
          unidade: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Insert: {
          acrescimos_dias?: number
          anexos?: Json
          certidao_gerada?: boolean
          concluido_em?: string | null
          created_at?: string
          denunciante_anonimo?: boolean
          denunciante_contato?: string | null
          denunciante_identificador?: string | null
          denunciante_nome?: string | null
          id?: string
          info_adicional?: string | null
          instaurada_em?: string | null
          interrupcoes_count?: number
          links?: Json
          numero_protocolo?: string
          obs_denunciante?: string | null
          obs_internas?: string | null
          ocorrencia_data?: string | null
          ocorrencia_hora?: string | null
          ocorrencia_local?: string | null
          ocorrencia_tipo?: string | null
          owner_id?: string | null
          relato: string
          status?: Database["public"]["Enums"]["denuncia_status"]
          termo_inicial?: string
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Update: {
          acrescimos_dias?: number
          anexos?: Json
          certidao_gerada?: boolean
          concluido_em?: string | null
          created_at?: string
          denunciante_anonimo?: boolean
          denunciante_contato?: string | null
          denunciante_identificador?: string | null
          denunciante_nome?: string | null
          id?: string
          info_adicional?: string | null
          instaurada_em?: string | null
          interrupcoes_count?: number
          links?: Json
          numero_protocolo?: string
          obs_denunciante?: string | null
          obs_internas?: string | null
          ocorrencia_data?: string | null
          ocorrencia_hora?: string | null
          ocorrencia_local?: string | null
          ocorrencia_tipo?: string | null
          owner_id?: string | null
          relato?: string
          status?: Database["public"]["Enums"]["denuncia_status"]
          termo_inicial?: string
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Relationships: []
      }
      documentos: {
        Row: {
          atualizado_em: string
          conteudo: string
          id: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          conteudo?: string
          id: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          conteudo?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      movimentos: {
        Row: {
          cancelado_em: string | null
          cancelado_por_cargo: Database["public"]["Enums"]["app_role"] | null
          cancelado_por_id: string | null
          cancelado_por_nome: string | null
          criado_em: string
          denuncia_id: string
          especie: Database["public"]["Enums"]["movimento_especie"]
          id: string
          interrompe: boolean
          ipc_publicado: boolean
          motivo_cancelamento: string | null
          prolator_cargo: Database["public"]["Enums"]["app_role"]
          prolator_id: string | null
          prolator_nome: string
          prorroga: boolean
          teor: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por_cargo?: Database["public"]["Enums"]["app_role"] | null
          cancelado_por_id?: string | null
          cancelado_por_nome?: string | null
          criado_em?: string
          denuncia_id: string
          especie: Database["public"]["Enums"]["movimento_especie"]
          id?: string
          interrompe?: boolean
          ipc_publicado?: boolean
          motivo_cancelamento?: string | null
          prolator_cargo: Database["public"]["Enums"]["app_role"]
          prolator_id?: string | null
          prolator_nome: string
          prorroga?: boolean
          teor: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por_cargo?: Database["public"]["Enums"]["app_role"] | null
          cancelado_por_id?: string | null
          cancelado_por_nome?: string | null
          criado_em?: string
          denuncia_id?: string
          especie?: Database["public"]["Enums"]["movimento_especie"]
          id?: string
          interrompe?: boolean
          ipc_publicado?: boolean
          motivo_cancelamento?: string | null
          prolator_cargo?: Database["public"]["Enums"]["app_role"]
          prolator_id?: string | null
          prolator_nome?: string
          prorroga?: boolean
          teor?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_acessos: {
        Row: {
          concedido_em: string
          concedido_por: string
          denuncia_id: string
          id: string
          mp_user_id: string
        }
        Insert: {
          concedido_em?: string
          concedido_por: string
          denuncia_id: string
          id?: string
          mp_user_id: string
        }
        Update: {
          concedido_em?: string
          concedido_por?: string
          denuncia_id?: string
          id?: string
          mp_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mp_acessos_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      oitivas: {
        Row: {
          ativa: boolean
          created_at: string
          data: string | null
          denuncia_id: string
          id: string
          identificacao: string
          url: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data?: string | null
          denuncia_id: string
          id?: string
          identificacao: string
          url: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data?: string | null
          denuncia_id?: string
          id?: string
          identificacao?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "oitivas_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      pdo_contador: {
        Row: {
          ano: number
          ultimo: number
        }
        Insert: {
          ano: number
          ultimo?: number
        }
        Update: {
          ano?: number
          ultimo?: number
        }
        Relationships: []
      }
      pdos: {
        Row: {
          abordados: Json
          abordagem_em: string
          assinado_em: string
          created_at: string
          desfecho: string
          equipe: Json
          id: string
          itens: Json
          lavrado_por: string
          lavrado_por_cargo: string
          lavrado_por_nome: string
          local: string
          numero: string
          procedimento_id: string | null
          procedimento_numero: string | null
          relato: string | null
          vtr_placa: string | null
          vtr_prefixo: string | null
          vtr_unidade: string | null
        }
        Insert: {
          abordados?: Json
          abordagem_em: string
          assinado_em?: string
          created_at?: string
          desfecho: string
          equipe?: Json
          id?: string
          itens?: Json
          lavrado_por: string
          lavrado_por_cargo: string
          lavrado_por_nome: string
          local: string
          numero: string
          procedimento_id?: string | null
          procedimento_numero?: string | null
          relato?: string | null
          vtr_placa?: string | null
          vtr_prefixo?: string | null
          vtr_unidade?: string | null
        }
        Update: {
          abordados?: Json
          abordagem_em?: string
          assinado_em?: string
          created_at?: string
          desfecho?: string
          equipe?: Json
          id?: string
          itens?: Json
          lavrado_por?: string
          lavrado_por_cargo?: string
          lavrado_por_nome?: string
          local?: string
          numero?: string
          procedimento_id?: string | null
          procedimento_numero?: string | null
          relato?: string | null
          vtr_placa?: string | null
          vtr_prefixo?: string | null
          vtr_unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          matricula: string
          nome: string
          status: Database["public"]["Enums"]["profile_status"]
          unidade: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Insert: {
          created_at?: string
          id: string
          matricula: string
          nome: string
          status?: Database["public"]["Enums"]["profile_status"]
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Update: {
          created_at?: string
          id?: string
          matricula?: string
          nome?: string
          status?: Database["public"]["Enums"]["profile_status"]
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Relationships: []
      }
      protocolo_contador: {
        Row: {
          ano: number
          ultimo: number
        }
        Insert: {
          ano: number
          ultimo?: number
        }
        Update: {
          ano?: number
          ultimo?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancelar_movimento: {
        Args: { _motivo: string; _movimento_id: string }
        Returns: undefined
      }
      gerar_numero_pdo: { Args: never; Returns: string }
      gerar_protocolo: { Args: never; Returns: string }
      get_obs_internas: { Args: { _denuncia_id: string }; Returns: string }
      get_user_cargo: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff: { Args: { _user_id: string }; Returns: boolean }
      is_delegado: { Args: { _user_id: string }; Returns: boolean }
      mp_tem_acesso: {
        Args: { _denuncia_id: string; _user_id: string }
        Returns: boolean
      }
      pode_conceder_mp: { Args: { _user_id: string }; Returns: boolean }
      pode_excluir_denuncia: { Args: { _user_id: string }; Returns: boolean }
      registrar_recurso: {
        Args: {
          _certificacao: string
          _denuncia_id: string
          _recurso_link: string
        }
        Returns: undefined
      }
      transitar_denuncia: { Args: { _denuncia_id: string }; Returns: boolean }
      transitar_pendentes: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "delegado_geral"
        | "delegado_corregedor"
        | "corregedor"
        | "cidadao"
        | "mp"
      denuncia_status:
        | "recebida"
        | "aguardando_analise"
        | "em_analise"
        | "em_investigacao"
        | "concluida"
        | "arquivada"
        | "ag_decurso_prazo"
        | "transito_julgado"
      movimento_especie:
        | "despacho"
        | "decisao"
        | "ipc"
        | "status"
        | "retificacao"
        | "portaria"
        | "cancelamento"
        | "certidao"
        | "evento"
      profile_status: "pendente" | "ativo" | "inativo"
      unidade_pc:
        | "DEIC"
        | "CORREGEPOL"
        | "DECAP"
        | "DHPP"
        | "CERCO"
        | "GARRA"
        | "DENARC"
        | "GER"
        | "SAT"
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
      app_role: [
        "delegado_geral",
        "delegado_corregedor",
        "corregedor",
        "cidadao",
        "mp",
      ],
      denuncia_status: [
        "recebida",
        "aguardando_analise",
        "em_analise",
        "em_investigacao",
        "concluida",
        "arquivada",
        "ag_decurso_prazo",
        "transito_julgado",
      ],
      movimento_especie: [
        "despacho",
        "decisao",
        "ipc",
        "status",
        "retificacao",
        "portaria",
        "cancelamento",
        "certidao",
        "evento",
      ],
      profile_status: ["pendente", "ativo", "inativo"],
      unidade_pc: [
        "DEIC",
        "CORREGEPOL",
        "DECAP",
        "DHPP",
        "CERCO",
        "GARRA",
        "DENARC",
        "GER",
        "SAT",
      ],
    },
  },
} as const
