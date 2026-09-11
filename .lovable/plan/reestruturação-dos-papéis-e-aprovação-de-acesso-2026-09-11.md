# Reestruturação dos papéis e aprovação de acesso

## Resultado esperado

- Substituir os administradores antigos por `Corregedor-Geral` e `Subcorregedor-Geral`, ambos com acesso máximo e equivalente.
- Substituir `Delegado Geral` por `SSP` e `CMTG`, preservando exatamente o nível de permissões anterior.
- Manter `Corregedor`, `Cidadão` e `Ministério Público` sem mudança de nível.
- Fazer todo cadastro interno e do Ministério Público entrar como pendente, sem acesso às páginas protegidas até aprovação.
- Permitir que somente os dois administradores aprovem usuários e promovam alguém ao nível máximo.

## Banco e regras de acesso

- Migrar o enum de papéis sem apagar registros: `delegado_corregedor` → `corregedor_geral`, `coordenador` → `subcorregedor_geral` e `delegado_geral` → `ssp`; adicionar `cmtg`.
- Atualizar conjuntamente as seis colunas que usam o enum, as atribuições em `user_roles`, todas as políticas de acesso e as funções que verificam os papéis.
- Replicar para `CMTG` todas as permissões recebidas por `SSP`, garantindo equivalência ao antigo Delegado Geral.
- Atualizar o gatilho de novos usuários para nunca ativar automaticamente o primeiro cadastro e nunca atribuir papel antes da aprovação.
- Manter cidadãos com o fluxo externo atual; novos cadastros internos e do MP permanecem pendentes.
- Desativar a confirmação automática no serviço de autenticação, sem configurar envio de e-mails.

## Aplicação

- Centralizar nomes e grupos de papéis para evitar divergências futuras.
- Atualizar validações no servidor, Gestão de Usuários, menus, telas internas, assinaturas e nomes exibidos.
- Bloquear no layout protegido qualquer perfil pendente ou inativo, redirecionando-o à tela de espera; a própria tela de espera continuará acessível.
- Atualizar as opções de aprovação e edição com os sete papéis finais.
- Preservar a proteção contra autoexclusão e impedir exclusão/inativação de outros administradores pelas ações comuns.

## Validação

- Confirmar que não restaram referências aos três identificadores antigos no código, nas políticas ou nas funções do banco.
- Verificar a compilação e testar no navegador o login, a tela de espera e a Gestão de Usuários.
- Executar a verificação de segurança do banco e tratar somente alertas relacionados a esta mudança.

## Fora do escopo

- Não alterar tramitação, prescrição, apensamento ou exportação de PDF.
- Não configurar domínio, SMTP ou mensagens automáticas. Ao final, apenas indicar o necessário para ativá-las futuramente.
