# Definition of Ready e Definition of Done

Os dois checklists da **aula 9** (p.5–6), adaptados ao projeto. A distinção, nas palavras do professor:

> *"O **DoR** é um conjunto de condições que devem ser atendidas **antes de uma tarefa iniciar**...
> Em contraste, o **DoD** é uma lista de critérios que uma tarefa deve cumprir para ser **considerada
> concluída**, assegurando que todos os aspectos da qualidade e funcionalidade foram atendidos."*

> ⚠️ **Aviso sobre a fonte, e ele importa.** A aula 9 tem uma inconsistência interna: a **definição** de
> DoD (p.5) abrange *"qualidade do código, realização de **testes unitários e de aceitação**, revisões de
> código, **atualizações de documentação** e aprovação do Product Owner"* — cinco famílias. Mas o
> **exemplo** de DoD (p.6) tem três itens (`Code Review`, `Aprovado pela QA`, `Validado com o usuário
> final`) e **não menciona testes nem documentação**. Copiar o exemplo perderia exatamente os dois itens
> que o enunciado do Resolve Aí exige (E6 e E9). **Este documento usa a definição, não o exemplo.**

---

## Por que estes dois checklists existem aqui

A configuração do projeto — **um único implementador, papéis não-implementadores no restante da equipe, e
seis semanas** — torna-os mais necessários que o usual. Nela, testes, Docker, deploy e documentação, que
são **entregáveis exigidos pelo enunciado**, são exatamente os itens que ficam por último e não acontecem.

O DoD converte cada um deles de tarefa futura em **condição de conclusão de toda funcionalidade**. E
define uma verificação de qualidade que **não exige leitura de código**: cada item é conferível por quem
não implementou.

---

## Definition of Ready

Uma tarefa só entra em desenvolvimento quando:

- [ ] **1. Descrição e critérios de aceitação escritos.** O que a tarefa entrega, e como se sabe que
      entregou. O professor lista como critérios do DoR *"a clareza da descrição da tarefa, a definição
      de critérios de aceitação, e a identificação de dependências"* (p.5).
- [ ] **2. Abordagem técnica clara.** Qual camada muda, qual agregado é afetado, se toca a fronteira de
      contexto. Se a resposta exigir investigação, isso vira **uma tarefa de investigação própria**,
      com resultado escrito, antes de virar tarefa de implementação.
- [ ] **3. Quebrada em item implementável.** Cabe numa sessão de trabalho — noite de semana ou manhã de
      fim de semana. Se não cabe, quebra de novo.
- [ ] **4. Priorizada no board.**
- [ ] **5. Nenhum ponto de atenção em aberto que mude o comportamento desta tarefa.** Consulta a
      `docs/premissas-e-questoes-abertas.md`. Se houver, ou a questão se resolve, ou a tarefa espera, ou
      a premissa é assumida **por escrito**.

### O que foi adaptado, e por quê

| Item do curso (p.6) | O que fizemos | Justificativa |
|---|---|---|
| "Documentação de requisitos escrita, com todas as informações do fluxo de solução" | **Mantido**, como item 1, somado aos critérios de aceitação que a p.5 pede | — |
| "Refinamento Técnico realizado" + "Arquitetura da solução desenhada" | **Fundidos** no item 2 | No nível de **uma tarefa** os dois significam a mesma coisa: a abordagem técnica está clara. A arquitetura do **projeto** está desenhada em `docs/arquitetura.md` e não se redesenha por tarefa |
| "Quebra em itens de desenvolvimento" | **Mantido**, com critério concreto de tamanho | — |
| "Estimativa das demandas" | **Cortado** | Exige base histórica de velocidade que não existe e não existirá em seis semanas. O próprio professor admite que *"sem uma base histórica, dificilmente vamos conseguir ser assertivos"* (aula 8, p.9). Estimar aqui seria teatro |
| "Priorizada pelo PM ou PO" | **Trocado** por "priorizada no board" | Não há PM nem PO no projeto |
| — | **Acrescentado** o item 5 | O curso não tem equivalente, mas este projeto **não tem Domain Expert real**: toda decisão de domínio é suposição, e há 23 pontos de atenção registrados. Sem esse portão, uma tarefa é implementada sobre uma ambiguidade não resolvida |

> **Divergência de contagem, declarada:** o plano em `trabalho/ddd-o-que-adotar.md` previa reduzir o DoR
> de 6 para 4 itens. Ficaram **5**. A fusão prevista aconteceu, mas o item novo (5) se mostrou necessário
> depois, quando os pontos de atenção chegaram a 23.

---

## Definition of Done

Uma funcionalidade só está pronta quando **todos** os itens abaixo forem verdadeiros. Organizados pelas
cinco famílias da definição da p.5.

### Qualidade do código

- [ ] `lint` e verificação de tipos passando, sem exceção adicionada para fazer passar.
- [ ] **A regra de fronteira respeitada:** nada fora da camada de Infraestrutura importa o cliente de
      banco (`docs/arquitetura.md`, Parte I §5).
- [ ] **Toda consulta nova passa pelo repositório escopado à organização.** Este item existe porque é o
      **risco mais sério da [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)**: a
      garantia de isolamento é do código, e um caminho que ignore o repositório vaza dados entre
      condomínios.

### Testes

- [ ] Teste automatizado cobrindo o **caminho feliz**.
- [ ] Teste cobrindo **ao menos uma transição inválida** — se a tarefa toca a máquina de estados.
- [ ] **Transição gerando registro de histórico, verificado em teste.** Este é o item central: é a
      **defesa processual** do requisito que o enunciado mais destaca, complementar à defesa estrutural
      do agregado (ADR-0001).
- [ ] Se a tarefa toca consulta de dados: teste de integração provando que **organização A não vê dado de
      B**.

### Revisões

- [ ] **Revisão funcional** por quem não implementou, contra os critérios de aceitação escritos no DoR.

> **Limitação declarada.** Com **um único implementador, não há revisão de código por pares.** A revisão
> que existe é **funcional**: valida comportamento contra critério de aceitação, não implementação.
> Registrar a limitação é mais defensável que classificar como peer review algo que não é.

### Documentação

- [ ] **Glossário atualizado** se surgiu termo novo — `docs/glossario.md`.
- [ ] **ADR escrita** se houve decisão de arquitetura com alternativa rejeitada — `docs/adr/`.
- [ ] Endpoint novo documentado.
- [ ] **Ponto de atenção resolvido é riscado**, e ponto de atenção novo é registrado, em
      `docs/premissas-e-questoes-abertas.md`.

### Aprovação e publicação

- [ ] **Sobe no `docker compose` local, do zero** — atende E7, e é verificável em outra máquina por quem
      não implementou.
- [ ] **Publicado no ambiente de preview** e acessível por URL — atende E8 e é o que permite a revisão
      funcional acontecer sem instalar nada.
- [ ] **Validado contra os critérios de aceitação**, por quem não implementou.

> **Adaptação:** onde o curso pede *"aprovação do Product Owner"*, aqui é validação contra critério de
> aceitação escrito — não há PO. Onde pede *"aprovado pela QA"* (no exemplo da p.6), não há QA: está
> coberto por Testes e por Revisão funcional.

---

## Onde estes checklists vivem no dia a dia

O DoD é colado no **template de issue do GitHub**, para aparecer em toda tarefa sem depender de memória. O
DoR é o critério de passagem para o desenvolvimento.

Os dois são os **portões entre Upstream e Downstream** no vocabulário da aula 7: o DoR fecha o Upstream —
requisitos, vocabulário, critérios de aceitação —, e o DoD fecha o Downstream, que é a implementação.

---

## Nota de método

As aulas 7, 8 e 9 formam **um processo único**: a esteira (aula 7) é o fluxo, o refinamento técnico
(aula 8) é o trabalho feito dentro dela, e DoR/DoD (aula 9) são os portões entre as fases. Adotamos as
três como conjunto, com as reduções justificadas item a item — aqui e no tópico 4 de
`docs/arquitetura.md`.

**Uma observação sobre a origem:** as aulas 7 a 9 são de autor diferente das aulas 1 a 6, com bibliografia
inteiramente distinta, e **não citam DDD uma única vez**. São um módulo de processo de engenharia, não a
continuação do DDD. Apresentá-las como metodologia única seria falso; o valor está em amarrá-las
explicitamente — e a amarração é esta: **o DoD é o que garante, por processo, a mesma invariante que o
agregado garante por estrutura.**
