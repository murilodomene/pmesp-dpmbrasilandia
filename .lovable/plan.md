# Portaria escura na tela e paginação segura no PDF

## Implementação
- Separar explicitamente as duas apresentações da Portaria: `screen` para a leitura no site e `pdf` para o documento formal.
- Na tela, manter todos os dados e a ordem atuais, aplicando o padrão visual do Despacho: fundo integrado, textos claros, rótulos âmbar, divisórias discretas e código de barras sobre uma faixa clara compacta.
- Manter uma cópia formal branca fora da tela exclusivamente para gerar o PDF, sem alterar seu cabeçalho, tipografia, medidas ou conteúdo.
- Substituir o corte do PDF em alturas fixas por quebras calculadas entre linhas/blocos, com margem inferior de segurança e proteção de parágrafos contra linhas divididas.
- Aplicar a separação tela/PDF em todos os locais onde a Portaria estruturada é exibida ou exportada.

## Validação
- Conferir visualmente a Portaria escura em resolução de computador e celular.
- Gerar um exemplo com conteúdo longo, inspecionar todas as páginas renderizadas e confirmar que nenhuma linha cruza a quebra.
- Entregar a imagem da tela e o PDF de exemplo para comparação.

## Limites
- Nenhuma mudança em campos, dados, edição, tramitação, permissões, banco, prescrição ou apensamento.
