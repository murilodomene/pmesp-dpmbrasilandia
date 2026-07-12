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
      aviso_contador: {
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
      avisos: {
        Row: {
          autor_cargo: Database["public"]["Enums"]["app_role"]
          autor_id: string
          autor_nome: string
          corpo: string
          created_at: string
          id: string
          numero: string
          titulo: string
          updated_at: string
        }
        Insert: {
          autor_cargo: Database["public"]["Enums"]["app_role"]
          autor_id: string
          autor_nome: string
          corpo: string
          created_at?: string
          id?: string
          numero?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          autor_cargo?: Database["public"]["Enums"]["app_role"]
          autor_id?: string
          autor_nome?: string
          corpo?: string
          created_at?: string
          id?: string
          numero?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      denuncia_policiais: {
        Row: {
          cargo: string | null
          created_at: string
          denuncia_id: string
          id: string
          nome: string
          rg_funcional: string | null
          unidade: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          denuncia_id: string
          id?: string
          nome: string
          rg_funcional?: string | null
          unidade?: Database["public"]["Enums"]["unidade_pc"] | null
        }
        Update: {
          cargo?: string | null
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
      denuncia_tarjas: {
        Row: {
          cor: string
          created_at: string
          criado_por: string | null
          denuncia_id: string
          id: string
          texto: string
          updated_at: string
        }
        Insert: {
          cor: string
          created_at?: string
          criado_por?: string | null
          denuncia_id: string
          id?: string
          texto: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          criado_por?: string | null
          denuncia_id?: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "denuncia_tarjas_denuncia_id_fkey"
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
      hierarquia_membros: {
        Row: {
          atividade: string | null
          cargo: string | null
          created_at: string
          edital: string | null
          grupo: string
          id: string
          instrutor: string | null
          nome: string
          ordem: number
          pad: string | null
          patente: string | null
          promocao: string | null
          rg: string | null
          status: string
          transferido: string | null
          updated_at: string
        }
        Insert: {
          atividade?: string | null
          cargo?: string | null
          created_at?: string
          edital?: string | null
          grupo: string
          id?: string
          instrutor?: string | null
          nome: string
          ordem?: number
          pad?: string | null
          patente?: string | null
          promocao?: string | null
          rg?: string | null
          status?: string
          transferido?: string | null
          updated_at?: string
        }
        Update: {
          atividade?: string | null
          cargo?: string | null
          created_at?: string
          edital?: string | null
          grupo?: string
          id?: string
          instrutor?: string | null
          nome?: string
          ordem?: number
          pad?: string | null
          patente?: string | null
          promocao?: string | null
          rg?: string | null
          status?: string
          transferido?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      movimentos: {
        Row: {
          anexos: Json
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
          anexos?: Json
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
          anexos?: Json
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
      notificacoes: {
        Row: {
          aviso_id: string | null
          created_at: string
          denuncia_id: string | null
          id: string
          lida_em: string | null
          lido: boolean
          remetente_cargo: Database["public"]["Enums"]["app_role"] | null
          remetente_id: string | null
          remetente_nome: string | null
          teor: string | null
          tipo: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Insert: {
          aviso_id?: string | null
          created_at?: string
          denuncia_id?: string | null
          id?: string
          lida_em?: string | null
          lido?: boolean
          remetente_cargo?: Database["public"]["Enums"]["app_role"] | null
          remetente_id?: string | null
          remetente_nome?: string | null
          teor?: string | null
          tipo: Database["public"]["Enums"]["notificacao_tipo"]
          titulo: string
          user_id: string
        }
        Update: {
          aviso_id?: string | null
          created_at?: string
          denuncia_id?: string | null
          id?: string
          lida_em?: string | null
          lido?: boolean
          remetente_cargo?: Database["public"]["Enums"]["app_role"] | null
          remetente_id?: string | null
          remetente_nome?: string | null
          teor?: string | null
          tipo?: Database["public"]["Enums"]["notificacao_tipo"]
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
        ]
      }
      observacao_pads: {
        Row: {
          created_at: string
          denuncia_id: string
          observacao_id: string
        }
        Insert: {
          created_at?: string
          denuncia_id: string
          observacao_id: string
        }
        Update: {
          created_at?: string
          denuncia_id?: string
          observacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacao_pads_denuncia_id_fkey"
            columns: ["denuncia_id"]
            isOneToOne: false
            referencedRelation: "denuncias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacao_pads_observacao_id_fkey"
            columns: ["observacao_id"]
            isOneToOne: false
            referencedRelation: "observacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      observacoes: {
        Row: {
          anexos: Json
          autor_cargo: Database["public"]["Enums"]["app_role"]
          autor_id: string
          autor_nome: string
          corpo: string
          created_at: string
          id: string
          policial_cargo: string | null
          policial_matricula: string | null
          policial_nome: string | null
          policial_unidade: string | null
          updated_at: string
        }
        Insert: {
          anexos?: Json
          autor_cargo: Database["public"]["Enums"]["app_role"]
          autor_id: string
          autor_nome: string
          corpo: string
          created_at?: string
          id?: string
          policial_cargo?: string | null
          policial_matricula?: string | null
          policial_nome?: string | null
          policial_unidade?: string | null
          updated_at?: string
        }
        Update: {
          anexos?: Json
          autor_cargo?: Database["public"]["Enums"]["app_role"]
          autor_id?: string
          autor_nome?: string
          corpo?: string
          created_at?: string
          id?: string
          policial_cargo?: string | null
          policial_matricula?: string | null
          policial_nome?: string | null
          policial_unidade?: string | null
          updated_at?: string
        }
        Relationships: []
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
      buscar_internos: {
        Args: { _termo: string }
        Returns: {
          cargo: Database["public"]["Enums"]["app_role"]
          id: string
          nome: string
        }[]
      }
      cancelar_movimento: {
        Args: { _motivo: string; _movimento_id: string }
        Returns: undefined
      }
      certificar_resultado_recurso: {
        Args: { _denuncia_id: string; _resultado: string }
        Returns: undefined
      }
      conceder_acesso_mp: {
        Args: { _denuncia_id: string; _mp_user_id: string }
        Returns: undefined
      }
      criar_intimacao: {
        Args: { _denuncia_id: string; _destinatario_id: string; _teor: string }
        Returns: string
      }
      gerar_numero_aviso: { Args: never; Returns: string }
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
      manutencao_limpar_avisos: { Args: never; Returns: Json }
      manutencao_limpar_pdos: { Args: never; Returns: Json }
      manutencao_limpar_processos: { Args: never; Returns: Json }
      marcar_notificacao_lida: {
        Args: { _notif_id: string }
        Returns: undefined
      }
      mp_tem_acesso: {
        Args: { _denuncia_id: string; _user_id: string }
        Returns: boolean
      }
      notificar_delegados: {
        Args: {
          _autor_id: string
          _denuncia_id: string
          _teor: string
          _titulo: string
        }
        Returns: undefined
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
      submeter_denuncia_anonima: { Args: { _payload: Json }; Returns: string }
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
        | "novo"
        | "recebida"
        | "aguardando_analise"
        | "em_analise"
        | "em_investigacao"
        | "concluida"
        | "arquivada"
        | "ag_decurso_prazo"
        | "transito_julgado"
        | "em_recurso"
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
      notificacao_tipo: "auto" | "intimacao" | "aviso"
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
        "novo",
        "recebida",
        "aguardando_analise",
        "em_analise",
        "em_investigacao",
        "concluida",
        "arquivada",
        "ag_decurso_prazo",
        "transito_julgado",
        "em_recurso",
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
      notificacao_tipo: ["auto", "intimacao", "aviso"],
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
