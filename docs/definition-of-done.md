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
define uma verificação de qualidade que **não exige leitura de código**.

> **A regra que governa esta lista, decidida em 22/08/2026: nenhuma caixa depende de outra pessoa para ser
> marcada.** Portão que quem faz o trabalho não pode fechar não é portão — é espera: ou fica marcado assim
> mesmo, ou o item fica aberto, e os dois desfechos são piores que não ter o portão.
>
> **Isto não afrouxa o DoD; torna-o consistente com uma limitação que ele mesmo declara** duas seções
> abaixo — *não há revisão de código por pares*. Um checklist que exigisse o segundo par de olhos **para
> fechar** estaria pedindo exatamente a pessoa que este documento diz não existir. O segundo par de olhos
> continua existindo: **fora do portão**, como atividade própria.

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
- [ ] **4. Priorizada no board, e alocada a uma sprint.** O board é o **Azure Boards**, e as sprints são
      semanais até a entrega.
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
| — | **Acrescentado** o item 5 | O curso não tem equivalente, mas este projeto **não tem Domain Expert real**: toda decisão de domínio é suposição, e há 27 pontos de atenção registrados, 17 deles ainda abertos. Sem esse portão, uma tarefa é implementada sobre uma ambiguidade não resolvida |

> **Divergência de contagem, declarada:** o plano em `trabalho/ddd-o-que-adotar.md` previa reduzir o DoR
> de 6 para 4 itens. Ficaram **5**. A fusão prevista aconteceu, mas o item novo (5) se mostrou necessário
> depois, quando os pontos de atenção passaram de vinte.

---

## Definition of Done

Uma funcionalidade só está pronta quando **todos** os itens abaixo forem verdadeiros. Organizados pelas
cinco famílias da definição da p.5.

### Qualidade do código

- [ ] `lint` e verificação de tipos passando, sem exceção adicionada para fazer passar.
- [ ] **A regra de fronteira respeitada:** nada fora de `infraestrutura/clientes/` importa um SDK — banco,
      storage ou autenticação —, e `infraestrutura/` só é importada por `composicao/`
      (`docs/arquitetura.md`, Parte I §5.2 e §5.3). **A regra é o alarme, não a garantia:** a garantia é a
      Aplicação não ter o que importar, porque recebe a porta em vez de construir infraestrutura
      ([ADR-0005](adr/0005-regra-de-dependencia-por-inversao.md)).
- [ ] **O repositório devolve agregado ou objeto de leitura declarado — nunca linha de banco**, nunca tipo
      de ORM. É o tipo de retorno que impede a forma do esquema de subir para dentro (ADR-0005), e é o
      único item desta lista que o lint **não** consegue conferir: a assinatura é legítima, só devolve a
      coisa errada. **A defesa é a revisão do tipo.**
- [ ] **Módulo novo passa nos dois testes**, se a tarefa criou um: ele é **útil** — limites e
      responsabilidade definidos — e é **competente**, faz inteiro o que faz (`docs/arquitetura.md`
      §5.3). Pasta vazia por simetria falha os dois.
- [ ] **Nenhum handler toca mais de um agregado.** É o sinal do *fat controller*, e o Next.js já protege
      por acidente — um `route.ts` por caminho. Um handler que precise de dois agregados é caso para
      dividir, não para acumular.
- [ ] **Toda consulta nova passa pelo repositório escopado à organização.** Este item existe porque é o
      **risco mais sério da [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)**: a
      garantia de isolamento é do código, e um caminho que ignore o repositório vaza dados entre
      condomínios.
- [ ] **Consulta que envolva pessoas parte de `vinculos`, nunca de `pessoas`.** `pessoas` é global e não
      tem coluna de organização — não há filtro que o repositório possa aplicar nela. Uma listagem que
      parta de `pessoas` devolve o cadastro do sistema inteiro. **A regra de lint não alcança este caso**,
      porque a consulta é legítima: ela apenas parte da tabela errada. A defesa é teste.
- [ ] **Nenhum segredo assado na imagem.** Sem `ARG` com segredo, sem `.env` copiado para dentro do
      container. A imagem publicada é **pública** ([ADR-0004](adr/0004-execucao-em-container-no-azure.md)),
      e o que entra numa camada permanece legível **mesmo que um `RUN rm` apague o arquivo depois**. Em
      Next.js, apenas variáveis `NEXT_PUBLIC_*` podem ser embutidas em tempo de build.
- [ ] **As quatro verificações mecânicas do contrato de API passam**, se a tarefa toca um endpoint. São
      automáticas, rodam sobre `docs/api/openapi.yaml`, e cada uma protege uma decisão que se perde em
      silêncio (§15 de [contrato-de-api.md](contrato-de-api.md)):

| Verificação | O que ela impede |
|---|---|
| `status` não aparece em **nenhum** schema de entrada | Que a `Ocorrência` ganhe um `PATCH` e a ADR-0001 caia junto |
| Nenhum caminho contém `pessoas` | O vazamento entre organizações mais provável do produto, subindo da consulta para a superfície pública |
| `organizacao` só nos dois caminhos permitidos | Que a organização volte a ser informada pelo cliente, contra a ADR-0003 |
| `requestBody.required: false` ⇔ `corpoOpcional` na rota | Que a especificação publique um corpo dispensável e a rota responda `415` a quem confiar nela — e o contrário |

> **Corrigido em 30/08/2026 — eram três.** A caixa dizia *"As **três** verificações mecânicas do contrato
> de API passam"* e a tabela tinha três linhas. A quarta é a primeira que compara o YAML com os
> `route.ts`, e ela existe porque a caixa seguinte — *"a especificação versionada corresponde ao código"* —
> **esteve aberta do item 8 até 27/08/2026 sem que nada acusasse**: `POST …/recusar` declarava
> `requestBody: required: false` e a rota respondia `415` a quem não mandasse corpo. Detalhe e o que a
> regra **não** alcança na §15 do [contrato-de-api.md](contrato-de-api.md). *(Item 15 da fila da frente de
> documentação.)*

- [ ] **A especificação versionada corresponde ao código.** Enquanto não há código, `openapi.yaml` é
      escrito à mão. Quando houver, o pipeline regenera a especificação a partir dos schemas de validação
      e **falha se o resultado divergir do arquivo versionado**. Sem esse portão, o contrato vira
      documentação que descreve um sistema que não existe mais.
- [ ] **Os sete compromissos de acessibilidade do protótipo estão cumpridos**, se a tarefa toca interface
      (§8 de [prototipo-low-fi.md](prototipo-low-fi.md)). **Não há teste de acessibilidade neste projeto e
      não haverá** — está declarado como limitação. O que existe no lugar é compromisso de construção,
      conferido a olho por quem revisa, e **três dos sete não precisam de ferramenta nenhuma**:

| # | Confere-se assim |
|---|---|
| **A-1** · todo campo tem rótulo associado ao controle | Clicar no rótulo põe o foco no campo. `placeholder` **não** é rótulo: se o texto some ao digitar, está errado |
| **A-3** · nenhum alvo de toque menor que ~44 px no celular | Medir um botão e um item de lista na largura de celular. É a pessoa com **uma mão no corrimão**, que é o cenário literal do RNF6 |
| **A-5** · nada é comunicado só por cor | `prioridade`, `status` e `motivoPausa` **sempre carregam a palavra**. Marcador colorido sem texto é defeito, em qualquer tela |

Os outros quatro — ordem de foco igual à de leitura (A-2), foco visível não removido (A-4), nada só em
`Tooltip` (A-6) e a trilha de auditoria como tabela de verdade (A-7) — são compromissos de construção que
a revisão confere quando a tela existir. **Isto não é conformidade declarada:** afirmar acessibilidade sem
teste seria o mesmo erro que afirmar usabilidade sem teste.

### Testes

- [ ] Teste automatizado cobrindo o **caminho feliz**.
- [ ] Teste cobrindo **ao menos uma transição inválida** — se a tarefa toca a máquina de estados.
- [ ] **Transição gerando registro de histórico, verificado em teste.** Este é o item central: é a
      **defesa processual** do requisito que o enunciado mais destaca, complementar à defesa estrutural
      do agregado (ADR-0001).
- [ ] **O custo de teste desta tarefa foi um arquivo curto ou nenhum** — casos no teste do agregado, e uma
      entrada na suíte de isolamento se ela tocou consulta. **Quatro arquivos de teste novos são sinal de
      que a forma da [ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md) foi abandonada.** Confere-se
      contando arquivos no próprio diff. **Está aqui, e não na ADR, porque ADR registra e não confere:** a
      regra só vale se alguém a aplicar no décimo item, e o instrumento que roda a cada item é este
      checklist. A hora de perceber é no item que abandona a forma — não no décimo, quando o DoD já virou
      teatro.
- [ ] Se a tarefa toca consulta de dados: teste de integração provando que **organização A não vê dado de
      B**. **É uma entrada na suíte de isolamento, não um teste novo** (§7.1 de
      [arquitetura.md](arquitetura.md)), e a entrada semeia **apenas o próprio agregado**: as pessoas e as
      organizações são da suíte, porque *seed* com pessoas distintas por organização **não detecta** o erro.
- [ ] **Se a tarefa entrega o registro de ocorrência: ele foi cronometrado.** Num aparelho real, em rede
      móvel, **por quem implementa**, no cenário declarado do **RNF6**. Leva vinte
      minutos e o número é anotado, mesmo que estoure. Este item existe porque o RNF6 é o **único
      requisito cronometrado do projeto** e porque o orçamento de tempo do protótipo indicou que ele
      **fecha por pouco** — um requisito nessa margem que nunca é medido é um requisito que se supõe
      cumprido. Não é teste de usabilidade: é a diferença entre **medido** e **declarado**.

      **O procedimento, para que "cronometrado" não dependa de improviso no dia:**

      - **Quem:** **quem implementa** — e aqui não há mecânica possível, celular real em rede móvel não se
        automatiza. Então **o viés fica declarado em vez de embutido num requisito que ninguém pode
        cumprir:** quem construiu a tela sabe onde tocar sem procurar, e mede **um tempo melhor que o de um
        morador**. É a mesma forma do *"não há teste de acessibilidade neste projeto e não haverá"* —
        declarar o que não se tem é mais defensável que exigir o que não se pode fazer. **As três medições
        e a mediana abaixo são o instrumento que sobra contra o viés**, e o número anotado com aparelho e
        rede permite que outra pessoa repita a medição depois, **sem que a entrega dependa disso**.
      - **Com o quê:** o aparelho da própria pessoa, em **rede móvel** (não Wi-Fi), contra a **URL
        publicada**, com o atalho do PWA já instalado.
      - **O quê:** cronômetro do toque no atalho até a confirmação na tela, no cenário da §2.6 de
        [prototipo-low-fi.md](prototipo-low-fi.md) — **inclusive o comprimento da descrição**, que é a
        premissa que sozinha move o resultado em mais de vinte segundos.
      - **Quantas vezes:** três. Registra-se a **mediana**, e também as três.
      - **O que se anota:** os três tempos, o modelo do aparelho, a rede (4G ou 5G) e **qual passo pareceu
        mais longo** — porque a premissa mais frágil do orçamento é a velocidade de digitação, e é a nota
        qualitativa que a refutaria.
      - **Onde fica:** uma linha datada na **§2 de [prototipo-low-fi.md](prototipo-low-fi.md)**, ao lado do
        orçamento que ela testa. **Não é documento novo.**

      **E se estourar, é decisão de produto, não de teste.** O orçamento fecha em **53 s de 60**. Uma
      medição acima de 60 s não reprova a tarefa: abre questão de escopo — cortar campo, reordenar a tela —
      e entra como **questão aberta registrada**, não como conserto silencioso.

### Revisões

**Esta seção não tem caixa, e a ausência é a decisão de 22/08/2026.**

**A revisão funcional continua existindo e continua sendo acompanhada — ela deixa de ser condição de
*Done*.** É atividade própria, com item de trabalho próprio, e corre **em paralelo**: levanta achado
depois, sem travar a entrega. O que fecha o item é o que quem o fez consegue verificar sozinho.

> **Limitação declarada.** Com **um único implementador, não há revisão de código por pares.** A revisão
> que existe é **funcional**: valida comportamento contra critério de aceitação, não implementação.
> Registrar a limitação é mais defensável que classificar como peer review algo que não é — e é a mesma
> limitação que a [ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md) cita por nome, como uma das
> três restrições que moldaram a arquitetura de testes inteira.

**O que substitui o segundo par de olhos, e não é pouco:**

| Instrumento | O que ele faz no lugar do revisor |
|---|---|
| **Os critérios de aceitação** | Foram escritos **a partir da documentação, antes de existir código**, por quem não estava implementando. Conferir contra eles **é** conferir contra artefato independente: **a independência está no momento em que foram escritos, não na pessoa que confere** |
| **Os verificadores do repositório** | Mermaid, OpenAPI e referências rodam a cada push, **com controle negativo** — um verificador que aceita tudo é indistinguível de um que funciona, e o controle é o que os separa |
| **As cinco regras de fronteira no ESLint** | Conferem a regra de dependência sem depender de ninguém lembrar — e **não há um único `eslint-disable` no projeto** |
| **A suíte de isolamento** | Aplica os mesmos casos a toda consulta escopada, preservando o cenário que detecta o vazamento (§7.1 da [`arquitetura.md`](arquitetura.md)) |
| **O portão de contrato** | Regenera a especificação a partir dos schemas e **falha se divergir** do arquivo versionado |

**Este projeto compensa a ausência de revisor com máquina**, e é isso que o checklist deve dizer — em vez
de pedir uma pessoa que ele mesmo declara não existir.

### Documentação

- [ ] **Glossário atualizado** se surgiu termo novo — `docs/glossario.md`.
- [ ] **ADR escrita** se houve decisão de arquitetura com alternativa rejeitada — `docs/adr/`.
- [ ] Endpoint novo documentado.
- [ ] **Todo bloco Mermaid do repositório tem sintaxe válida**, verificado por `mermaid.parse()` no
      pipeline. São poucas linhas de Node e roda em segundos — e é o mesmo princípio da regeneração do
      OpenAPI: **garantia mecânica em vez de disciplina**. Diagrama que não renderiza é documentação que
      não existe, e a falha é silenciosa: o GitHub mostra o bloco de código cru e ninguém percebe.
- [ ] **Ponto de atenção novo está escrito na seção *Achados* do relatório do item**, e ponto de atenção
      resolvido está apontado lá. **Não em `docs/`:** o fluxo de implementação proíbe tocar a documentação,
      e com razão — é o que impede uma conversa de trabalho de reescrever documentação em vez de levantar
      achado. Conferível por quem implementa, no próprio relatório, **sem terceiro e sem acesso a `docs/`**.

> **A outra metade, e ela precisa estar dita aqui ou vira promessa oral.** Levar os achados do relatório
> para `docs/premissas-e-questoes-abertas.md` é **passo declarado do ciclo de quem commita**, não do item:
> ao commitar o trabalho de um item, os achados do relatório são transcritos. É atividade **com dono** e
> que **não segura entrega** — a mesma forma do `Item Revision`.
>
> Sem isto escrito, o achado fica no relatório e *"alguém transcreve depois"* — que é exatamente o que a
> regra de 22/08 chama de **espera em vez de portão**. O item 39 fechou com **sete achados nessa
> condição**, e foi o que mostrou que a caixa antiga era inmarcável por construção: ela pedia uma escrita
> em `docs/` que o próprio fluxo de trabalho proíbe.

### Aprovação e publicação

- [ ] **Sobe no `docker compose`, do zero** — atende E7. **A outra máquina é o runner da esteira:** um
      estágio sobe o compose num runner limpo e bate na aplicação por HTTP, que é o que esta linha sempre
      quis provar — **não há estado local escondido**. E prova melhor que uma conferência humana: não pode
      ser esquecido, e **reverifica a cada push**, enquanto a verificação de uma pessoa vale para o commit
      em que ela aconteceu. Critério **A6** da [`arquitetura.md`](arquitetura.md) §10.
- [ ] **Publicado no ambiente único e acessível por URL** — atende E8 e é o que permite a revisão
      funcional acontecer sem instalar nada. **Não há ambiente de preview por branch**: a
      [ADR-0004](adr/0004-execucao-em-container-no-azure.md) o perdeu ao sair da plataforma anterior, e
      `arquitetura.md` §9 declara a consequência — código não validado chega ao mesmo lugar da
      demonstração, e a mitigação é este checklist, não a infraestrutura. **Se a revisão funcional reprovar
      depois** — e agora ela chega depois, porque não trava a entrega —, **o caminho de volta é redirecionar
      o tráfego para a revisão anterior do Container Apps**, que é imediato e não exige rebuild. **É o que
      torna aceitável tirar a revisão do portão:** o custo de descobrir tarde é um redirecionamento.
- [ ] **Conferido contra os critérios de aceitação escritos no DoR.** Não é autoavaliação disfarçada: os
      critérios foram escritos **a partir da documentação, antes de existir código**, por quem não estava
      implementando — conferir contra eles é conferir contra **artefato independente**.

> **Adaptação:** onde o curso pede *"aprovação do Product Owner"*, aqui é conferência contra critério de
> aceitação escrito — não há PO. Onde pede *"aprovado pela QA"* (no exemplo da p.6), não há QA: está
> coberto por Testes e pelas verificações mecânicas. A revisão funcional existe, **fora do portão**.

---

## Onde estes checklists vivem no dia a dia

Os dois são os **portões entre Upstream e Downstream** no vocabulário da aula 7: o DoR fecha o Upstream —
requisitos, vocabulário, critérios de aceitação —, e o DoD fecha o Downstream, que é a implementação. E
cada um tem um item de trabalho próprio no **Azure Boards**, o que é o que os impede de virar checklist
que ninguém abre:

| Portão | Onde vive | Quem verifica |
|---|---|---|
| **DoR** | Critério de entrada do **PBI**. Enquanto os cinco itens não forem verdadeiros, o PBI não entra em sprint | Quem escreve o PBI |
| **DoD** | Critério de aceitação do item que **faz** o trabalho | **Quem implementa** — nenhuma caixa depende de terceiro, que é a regra de 22/08/2026 |
| **Revisão funcional** | Item próprio (**`Item Revision`**), **em paralelo** | Quem não implementou — e **não bloqueia o *Done*** |

O `Item Revision` continua existindo, e o motivo mudou de lugar: **revisão é atividade, não etapa implícita
de outra atividade** — e ela precisa de dono e de prazo próprios **justamente porque deixou de ser condição
de entrega**. Sem item próprio, uma atividade que não bloqueia nada é uma atividade que não acontece.

**E o que impede o DoD de virar autoavaliação não é mais o dono separado — são as caixas.** A maioria delas
não depende de opinião: `lint`, tipos, testes, os verificadores, o portão de contrato, o compose na esteira.
**A caixa que alguém marcaria de má-fé é a mesma com qualquer dono; a caixa que uma máquina fecha, ninguém
marca.**

A consequência prática é que **toda tarefa continua gerando dois itens de trabalho** — o que faz e o que
confere —, com uma diferença: **o segundo não segura o primeiro.**

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
