# Sistema de Corregedoria da Polícia Civil

Sistema web completo com canal público de denúncias e painel interno de condução de procedimentos disciplinares, ambientado em GTA RP. Backend com Lovable Cloud (Supabase) para auth, DB e RLS.

## Ordem de construção

### Bloco 1 — Backend e modelo de dados
Ativar Lovable Cloud e criar via migração:

- `app_role` enum: `delegado_geral`, `delegado_corregedor`, `corregedor`
- `profile_status` enum: `pendente`, `ativo`, `inativo`
- `denuncia_status` enum: `recebida`, `aguardando_analise`, `em_analise`, `em_investigacao`, `concluida`, `arquivada`
- `movimento_especie` enum: `despacho`, `decisao`, `ipc`, `status`
- `unidade` enum: DEIC, CORREGEPOL, DECAP, DHPP, CERCO, GARRA, DENARC, GER, SAT

Tabelas:
- **profiles** (id=auth.uid, nome, matricula, cargo, status, unidade, created_at) — cargo/status nullable até aprovação
- **user_roles** (id, user_id, role) — separada, com função `has_role()` SECURITY DEFINER
- **denuncias** (id, numero_protocolo gerado por sequência+ano, denunciante_*, ocorrencia_*, relato, info_adicional, anexos jsonb, links jsonb, status, obs_internas, obs_denunciante, termo_inicial, acrescimos_dias int default 0, interrupcoes_count int default 0, created_at, instaurada_em)
- **denuncia_policiais** (id, denuncia_id, nome, rg_funcional, unidade) — múltiplos denunciados
- **movimentos** (id, denuncia_id, especie, teor, prolator_nome, prolator_cargo, criado_em, interrompe bool, prorroga bool) — INSERT-only via policy
- **oitivas** (id, denuncia_id, identificacao, url, data, ativa bool)

Trigger de protocolo: sequência anual `#000001/2026`.
Trigger "primeiro usuário": no signup, se `user_roles` estiver vazia, insere `delegado_corregedor` e ativa o profile. Demais nascem pendentes.

RLS aplicando a matriz completa: denúncias públicas leem só `status` e `obs_denunciante` via server function pública; inserção pública permitida; leitura/escrita interna exige `has_role` ativo; `movimentos` sem UPDATE/DELETE para ninguém; gestão de usuários (aprovar, atribuir cargo, ativar) só para delegado_geral/delegado_corregedor.

### Bloco 2 — Auth e camada de sessão
- Rota pública `/auth` (cadastro + login por email/senha, `emailRedirectTo`)
- `_authenticated/route.tsx` (usar integração-managed)
- Tela "cadastro em análise" para profile pendente
- Header muda conforme sessão + cargo

### Bloco 3 — Design system
Editar `src/styles.css`:
- Azul-marinho profundo bg, surface um tom acima, âmbar acento
- Serifa (ex: Fraunces) nos títulos, sans (Inter) no corpo, JetBrains Mono tabular para números
- Tokens semânticos de status: `--status-recebida`, `--status-aguardando`, `--status-analise`, `--status-investigacao` (âmbar queimado), `--status-concluida` (verde), `--status-arquivada`
- `--danger` vermelho reservado a prescrição/decisões
- Âmbar NUNCA para status
- Escala do relógio: neutro / âmbar-alerta / vermelho / vermelho+rótulo

### Bloco 4 — Núcleo de prescrição
Utilitário puro `src/lib/prescricao.ts`:
```
diasRestantes = 15 + acrescimos - diasCorridos(hoje - termo_inicial)
```
Nunca persistido. Componente `<RelogioPrescricao>` com escala de alerta. Suspende quando status = concluída/arquivada.

### Bloco 5 — Painel da Corregedoria (`/_authenticated/corregedoria`)
Duas colunas, mobile empilha:
- **Fila esquerda**: busca (número/denunciante/denunciado/unidade), filtro status, linhas com selo + dias restantes, borda vermelha se prescrita
- **Autuação direita**: cabeçalho, ficha editável (unidade), relógio, anexos/links herdados, oitivas com link externo, formulário de ato (Despacho/Decisão/IPC), timeline desc com marcador por espécie, bloco de observações (internas vs denunciante rotulado)
- Diálogos: movimentar status (exige motivação → gera movimento "Status alterado de X para Y"), botão Recebimento junto ao relógio (aviso: interrompe → reset termo_inicial + zera acrescimos + incrementa interrupcoes), botão Prorrogação (+30d exige justificativa), juntar oitiva (valida URL, cria despacho automático "Junte-se a gravação"), desentranhar (gera movimento)
- Prolator sempre da sessão

### Bloco 6 — Canal público e Painel Interno
- `/` — home pública com 3 cartões (Sigilo, Análise, Canal Oficial)
- `/denunciar` — formulário público, cria denúncia status `recebida`, mostra protocolo
- `/consultar` — consulta por protocolo, exibe só status + obs_denunciante
- `/_authenticated/painel` — triagem: lista, filtros, modal para alterar status e obs (internas + denunciante)
- Exportação PDF paginado dos autos com cabeçalho institucional

### Bloco 7 — Qualidade
Responsivo, foco visível, Esc fecha diálogos, estados vazios orientativos, erros acionáveis, head/SEO por rota, sitemap+robots.

## Detalhes técnicos

- Server fns em `src/lib/*.functions.ts`: `submitDenuncia` (pública, valida com zod), `getDenunciaPublica(protocolo)`, `listDenuncias`, `getDenuncia`, `lancarMovimento`, `alterarStatus`, `receberDenuncia`, `prorrogar`, `juntarOitiva`, `desentranharOitiva`, `aprovarUsuario`, `atribuirCargo`, `ativarInativar`
- Todas as mutações usam `requireSupabaseAuth`; consultas públicas usam server publishable client + policies `TO anon` estritas projetando só colunas seguras
- Zod em todos os inputs; sanitizar URLs de oitiva
- PDF via `@react-pdf/renderer` ou `jspdf`
- TanStack Query para reads; loaders em rotas `_authenticated/`

## Não fazer
Sem UPDATE/DELETE em movimentos (policy). Prazo restante nunca persistido. Obs internas nunca em rota pública. Âmbar não é alerta. RLS obrigatória. Primeiro usuário sempre ativo como Delegado Corregedor.
