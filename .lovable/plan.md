# Espaçamento fiel nos atos internos

## Diagnóstico
- O editor mantém uma altura mínima para parágrafos vazios, mas a visualização e o PDF não; por isso as linhas em branco salvas ficam sem altura e parecem desaparecer.
- O sanitizador já aceita `<p>`, `<br>` e `style`, porém o editor ainda não possui um atributo próprio para gravar o entrelinhas de cada parágrafo.
- Alguns PDFs aplicam um `line-height` geral ao bloco, que precisa ceder ao valor salvo em cada parágrafo.

## Implementação
- Preservar parágrafos vazios no HTML salvo e dar a eles a mesma altura visível no editor, nos autos e nos PDFs dos atos internos.
- Adicionar ao editor um controle de entrelinhas com `1,0`, `1,15`, `1,5` e `2,0`, aplicado aos parágrafos selecionados e gravado no próprio conteúdo.
- Usar `1,15` nos novos parágrafos e atos novos, sem sobrescrever atos antigos nem espaçamentos escolhidos pelo usuário.
- Unificar as regras de renderização entre editor, autos, PDF individual e PDF completo do processo.
- Manter a Portaria fora dessas alterações.

## Validação
- Criar um ato de demonstração com várias linhas vazias e parágrafos em `1,15` e `1,5`.
- Comparar visualmente editor, ato nos autos e PDF, em computador, confirmando alturas e quebras equivalentes.
- Verificar que negrito, itálico, sublinhado, alinhamentos e links continuam funcionando.

## Limites
- Nenhuma alteração em tramitação, dados, campos, permissões, RLS, prescrição, apensamento ou Portaria.
