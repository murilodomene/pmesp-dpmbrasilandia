# Alterar o endereço público de IPC para IPM

## Objetivo
Disponibilizar a consulta pública em `/ipm/` e os procedimentos em `/ipm/<id>`, mantendo todos os IPMs já publicados.

## Implementação
- Renomear as rotas públicas de `/ipc/` para `/ipm/` sem alterar consultas, dados ou identificadores internos.
- Atualizar o menu público, os links das pastas e o link gerado na área interna.
- Manter `/ipc/` e `/ipc/<id>` como endereços de compatibilidade, redirecionando para os novos links para não quebrar URLs já compartilhadas.
- Validar a listagem pública e a abertura de um procedimento pelo novo endereço.

## Limites
- Nenhuma mudança em publicações, banco de dados, permissões, tramitação, PDF ou conteúdo dos IPMs.
