# Troca de identidade visual para a PMESP

## Objetivo
Substituir a identidade visual da Polícia Civil pela Corregedoria da Polícia Militar do Estado de São Paulo em toda a interface, incluindo os documentos exibidos na tela, sem alterar funcionalidades, dados, permissões ou PDFs exportados.

## Implementação

1. **Novo brasão**
   - Incorporar a imagem enviada como ativo oficial da interface.
   - Substituir o brasão antigo no cabeçalho global, login por meio do cabeçalho, página do Manual, Hierarquia, Fluxo do processo, Avisos, Observações, Documentos e cabeçalhos de processos/atos exibidos na tela.
   - Manter o brasão antigo exclusivamente no modo de exportação em PDF, conforme solicitado.
   - Gerar um favicon quadrado e otimizado a partir do novo brasão e remover a referência ao favicon antigo.

2. **Nome institucional visível**
   - Trocar “Polícia Civil” por “Polícia Militar do Estado de São Paulo” nos títulos institucionais da interface.
   - Trocar “Corregedoria Geral da Polícia Civil” por “Corregedoria da Polícia Militar do Estado de São Paulo” quando usado como identidade visual.
   - Atualizar a página inicial, cabeçalho, login, Manual, IPC público, fluxo, hierarquia, avisos, observações, documentos e demais textos visuais de apresentação.
   - Substituir as siglas visíveis `PCESP` e `PC-SP` por `PMESP`.
   - Preservar nomes de cargos, unidades e patentes.

3. **Aba do navegador e compartilhamento**
   - Atualizar os títulos e descrições das páginas que ainda identificam a Polícia Civil.
   - Definir título próprio para a página inicial e manter os metadados sociais coerentes com PMESP.
   - Não alterar URLs, rotas, domínio, publicação ou conteúdo estrutural de SEO além da identidade institucional.

4. **Limites da alteração**
   - Não modificar banco de dados, autenticação, permissões, RLS, tramitação, prescrição ou qualquer regra funcional.
   - Não modificar o conteúdo ou a aparência da exportação em PDF.
   - Não alterar cargos, unidades ou patentes.

5. **Validação**
   - Conferir por busca que não restaram referências visuais ao brasão antigo, “Polícia Civil”, `PCESP` ou `PC-SP` fora do PDF preservado.
   - Validar no navegador a página inicial, login, IPC público e ao menos um cabeçalho documental visível em desktop e celular.
