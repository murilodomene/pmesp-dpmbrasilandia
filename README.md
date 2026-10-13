# DPM - Brasilândia

# Prompt para o Lovable — Sistema de Corregedoria da Polícia Civil

Construa um sistema web completo de corregedoria da Polícia Civil (ambientado em servidor de GTA RP), com canal público de denúncias e painel interno de condução de procedimentos disciplinares. Use Supabase para autenticação, banco de dados e políticas de acesso por linha (RLS).

Construa **na ordem abaixo**. Se precisar priorizar, os blocos 1 a 5 são o núcleo; o bloco 6 completa o sistema.

---

## 1. Modelo de dados

**profiles** — um por usuário autenticado: nome completo, matrícula, cargo (`Delegado Geral`, `Delegado Corregedor`, `Corregedor`, ou nulo enquanto pendente), status (`pendente`, `ativo`, `inativo`), unidade, data de criação.

**denuncias** — número de protocolo sequencial no formato `#000001/2026`; dados do denunciante (nome, identificador, contato); um ou mais policiais denunciados (nome, RG funcional, unidade); dados da ocorrência (tipo, local, data, horário); relato; informações adicionais; anexos e links; status; observações internas; observações ao denunciante; termo inicial do prazo; total de acréscimos; contador de interrupções; datas de criação e instauração.

**movimentos** — vínculo com a denúncia; espécie (`Despacho`, `Decisão`, `IPC`, ou movimento de status); teor; prolator (nome e cargo do usuário autenticado que lançou); data; sinalizadores de interrupção e de prorrogação. **Somente-acréscimo**: nunca editável nem excluível.

**oitivas** — vínculo com a denúncia; identificação; URL da gravação; data.

---

## 2. Autenticação, cargos e permissões

Cadastro por e-mail e senha. **O primeiro usuário cadastrado torna-se automaticamente Delegado Corregedor com status ativo** — é quem inicializa o sistema. Todo cadastro seguinte nasce com status pendente e sem cargo, e só passa a ativo quando um Delegado Geral ou Delegado Corregedor o aprova e lhe atribui um cargo. Usuário pendente faz login mas vê apenas uma tela de "cadastro em análise".

O prolator de qualquer ato é sempre o usuário autenticado — nome e cargo vêm da sessão, não de escolha manual.

Matriz de permissões:

| Ação | Delegado Geral | Delegado Corregedor | Corregedor |

|---|:---:|:---:|:---:|

| Aprovar cadastros e atribuir cargos | ✓ | ✓ | — |

| Ativar/inativar usuários | ✓ | ✓ | — |

| Ver todos os procedimentos | ✓ | ✓ | ✓ |

| Lançar Despacho | ✓ | ✓ | ✓ |

| Lançar Decisão | ✓ | ✓ | ✓ |

| Lançar IPC | ✓ | ✓ | ✓ |

| Despacho de recebimento (interrupção) | ✓ | ✓ | ✓ |

| Prorrogação por remarcação de oitiva | ✓ | ✓ | ✓ |

| Juntar/desentranhar oitiva | ✓ | ✓ | ✓ |

| Movimentar status, inclusive concluir e arquivar | ✓ | ✓ | ✓ |

| Exportar autos | ✓ | ✓ | ✓ |

O **Delegado Geral vê e faz tudo no sistema**, incluindo a gestão de usuários. As três patentes conduzem procedimentos por inteiro — despachos, decisões e IPCs; a única distinção é que a gestão de contas (aprovar cadastros, atribuir cargos, ativar e inativar) fica com as duas patentes de delegado, Geral e Corregedor.

Aplique as permissões **no banco (RLS), não só na interface**. Um Corregedor não pode aprovar cadastros nem por chamada direta à API, apenas por não enxergar o botão.

---

## 3. Página inicial e navegação

Página inicial pública com três cartões de apresentação — Sigilo Garantido, Análise Criteriosa, Canal Oficial — e navegação: Início, Fazer Denúncia, Consultar Denúncia. Para usuário autenticado com cargo ativo, surgem os itens internos: Painel Interno e Corregedoria. O acesso ao cadastro e login fica visível a quem não está logado.

---

## 4. Regra de prescrição (invariante do sistema)

Trate como restrição estrutural, não como campo de formulário.

O prazo é de **15 dias corridos**, contados de um termo inicial. **Os dias restantes nunca são armazenados**: são sempre derivados, a cada leitura, de `15 + acréscimos − dias corridos desde o termo inicial`. Armazene apenas o termo inicial e o total de acréscimos.

**Interrupção.** O despacho de recebimento da denúncia redefine o termo inicial para a data do despacho e **zera os acréscimos**. O prazo recomeça do zero, por inteiro. Prorrogações anteriores não sobrevivem à interrupção. Incremente o contador de interrupções e exiba-o.

**Prorrogação.** Remarcação de oitiva por iniciativa do denunciante permite acrescer **30 dias**, mediante justificativa. Os acréscimos se somam. O movimento recebe etiqueta visível de "+30 dias".

**Prescrição consumada** é um estado visível, não ausência de dado: saldo negativo mostra "Prescrita há N dias" em vermelho, na lista e na autuação.

**Suspensão.** Status Concluída ou Arquivada param o relógio e desabilitam os botões de recebimento e prorrogação.

**Escala de alerta do relógio:** acima de 7 dias, neutro; 7 a 4 dias, âmbar; 3 a 0 dias, vermelho; negativo, vermelho com rótulo de prescrição consumada.

---

## 5. Painel da Corregedoria

Rota protegida, duas colunas, empilhando no celular.

**Esquerda — fila.** Busca por número, denunciante, denunciado ou unidade. Filtro por status. Cada linha: número, natureza, unidade, selo de status e dias restantes. Procedimento prescrito recebe borda vermelha.

**Direita — autuação**, nesta ordem: cabeçalho com número, natureza, selo de status e botão de movimentar status; ficha com denunciante, denunciado, unidade (editável por lista suspensa), data da ocorrência, instauração e termo inicial vigente; relógio da prescrição; anexos e links herdados da denúncia; oitivas juntadas com link; formulário de lançamento de ato; linha do tempo do mais recente ao mais antigo; bloco de gestão com observações internas (só à Corregedoria) e observações ao denunciante (visíveis na consulta pública), cada campo rotulado com quem o enxerga.

**Domínios fixos.** Status: Recebida, Aguardando análise, Em análise, Em investigação, Concluída, Arquivada (mais "Todos os status" no filtro). Unidades: DEIC, CORREGEPOL, DECAP, DHPP, CERCO, GARRA, DENARC, GER, SAT. Espécies de ato: Despacho, Decisão, IPC.

**Comportamento dos atos.** Movimentar status abre diálogo que exige motivação; gera movimento "Status alterado de X para Y". Recebimento tem botão próprio junto ao relógio, com aviso de que interrompe a prescrição. Prorrogação tem botão próprio, exige justificativa, soma 30 dias. Juntar oitiva valida a URL e lança automaticamente um despacho "Junte-se a gravação"; o link abre em nova aba; desentranhar gera movimento. Cada espécie de ato tem marcador visual próprio na linha do tempo, para localizar decisões sem leitura. Correções se fazem por novo despacho retificador, nunca por sobrescrita.

---

## 6. Painel Interno e canal público

**Fazer Denúncia** — formulário público que cria um registro em denuncias com status Recebida e gera o número de protocolo. Campos conforme o modelo de dados. Ao final, exibe o número de protocolo para consulta posterior.

**Consultar Denúncia** — consulta pública por número de protocolo, exibindo status e observações ao denunciante, e nada além disso.

**Painel Interno** — lista de denúncias com busca e filtro de status, e um modal de detalhe para triagem: alterar status, escrever observações internas e observações ao denunciante. É a superfície de entrada; a Corregedoria é a de condução. Ambas operam sobre a mesma denúncia, sem duplicar registros.

---

## Identidade visual

Fundo azul-marinho profundo, superfícies um tom acima, acento em âmbar, serifada nos títulos. **Reserve o âmbar para rótulos, eyebrows e ações primárias — nunca para status.** Cada estado tem cor semântica própria: tom frio para Recebida, cinza para Aguardando análise, azul-petróleo para Em análise, âmbar queimado para Em investigação, verde para Concluída, cinza-escuro para Arquivada. Vermelho fica reservado ao risco prescricional e às decisões. Números de procedimento, datas e contagem de dias em fonte monoespaçada, com numerais tabulares.

---

## Qualidade

Responsivo até o celular. Foco de teclado visível. Diálogos fecham com Esc e devolvem o foco. Estados vazios que orientam a ação. Erros que dizem o que houve e como resolver. Exportação dos autos em PDF paginado com cabeçalho institucional.

---

## O que não fazer

Não permita editar ou apagar movimentos. Não armazene o prazo restante como número. Não exponha observações internas em rota pública. Não use o âmbar da marca como cor de alerta. Não aplique permissões só na interface — aplique também no banco. Não deixe o primeiro usuário pendente ou sem cargo, ou o sistema trava sem quem aprove os demais.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pmesp-dpmbrasilandia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ab318e7a-a3c9-43a3-8bdd-763f83364dcb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
