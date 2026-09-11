# Atualizar postos/graduações e OPMs da PMESP

## Objetivo
Substituir somente os atributos cadastrais de militares pelas listas PMESP fornecidas, sem alterar papéis funcionais, permissões, tramitação, prescrição, apensamento ou PDFs.

## Alterações
- Centralizar a lista de 15 postos/graduações, exatamente na ordem informada, e aplicá-la nos cadastros de denunciados, observações e quadro de hierarquia.
- Centralizar a lista de 15 OPMs e aplicá-la no formulário público de denúncia, instauração de ofício, Corregedoria, observações, perfil e demais seletores de unidade.
- Remover todas as opções antigas da Polícia Civil desses seletores.
- Manter intactos os papéis de acesso como Delegado Corregedor, Coordenador, Delegado Geral e Corregedor.

## Banco de dados
- `patente`/posto-graduação é texto nas tabelas relevantes; não exige mudança estrutural.
- `unidade` usa o enum `unidade_pc` em denúncias, denunciados e perfis; ele será atualizado para conter somente as novas OPMs.
- Antes da troca do enum, unidades antigas já gravadas serão definidas como sem unidade (`NULL`), conforme escolhido, preservando os registros.
- Nenhuma política de acesso, função de permissão ou regra de tramitação será alterada.

## Validação
- Conferir que os dropdowns exibem apenas as novas opções e na ordem solicitada.
- Validar cadastro público e telas internas principais sem erros.
- Auditar que papéis de acesso e exportação de PDF permaneceram inalterados.
