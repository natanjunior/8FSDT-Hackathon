# Premissas e Questões Abertas

Este documento existe por causa de uma característica estrutural do projeto: **não há Domain Expert
real.** O curso pressupõe alguém que *"detectou a necessidade e conhece o negócio"* (aula 1, p.8) — aqui,
a fonte mais forte disponível é um integrante do time que é **síndico do próprio condomínio**, e todo o
resto foi construído por proxy.

Consequência: **toda decisão de domínio é uma suposição**, e o instrumento correto é registrá-la em vez de
esconder. O mecanismo é o **Ponto de Atenção** da aula 6 (p.7–8): *"qualquer problema, preocupação ou
dúvida deve virar um ponto de atenção, pois pode ser um ponto de melhoria adiante."*

Admitir a ambiguidade com o instrumento que a disciplina ensinou é mais forte do que escolher em silêncio
e torcer para não perguntarem.

> **Nota de vocabulário.** O papel de quem executa o trabalho chama-se **`Encarregado`**. **"Responsável"**
> ficou reservado para a **atribuição** — *"o responsável por esta ocorrência"* —, que é a palavra do
> enunciado exatamente onde ele a usa. Ver D27 e o glossário.

---

## 1. Premissas assumidas

Decisões tomadas sem confirmação de fonte de domínio. Cada uma diz **o que muda se estiver errada** — que
é a informação útil.

### P1 — A criação da ocorrência gera o primeiro registro de histórico

Com `status anterior` nulo.

**Por que assumimos.** Os dois fluxogramas oficiais do enunciado divergem: o `fluxograma-2` liga **todos**
os cinco estados ao bloco de Histórico, sugerindo registro já em `Aberta`; o `fluxograma-3` liga o
histórico **apenas às transições**. Adotamos a leitura mais informativa — uma trilha de auditoria sem a
origem é incompleta — e ela custa praticamente nada.

**Se estiver errada:** sobra um registro por ocorrência. Impacto baixo, e reversível.

### ~~P2~~ — resolvida

`iniciarAtendimento` exige responsável atribuído. Era premissa derivada da jornada; **virou decisão D21**,
com auto-atribuição em um clique. Justificativa: "quem está fazendo" é exatamente o que o Gestor não sabe
hoje.

### P3 — A avaliação do Solicitante não é um sexto estado

Formalizada na decisão **D1**. A imagem do ciclo de vida **da p.2 do PDF** (bloco ②) mostra um nó
"Avaliação do solicitante" após `Resolvida`, que **não existe** na lista textual dos cinco estados (p.3),
nem no `fluxograma-2`, nem na segunda imagem do ciclo de vida — a da **p.4** (bloco ④), que traz os cinco
estados e nada mais. Prevaleceu o texto, e o placar é de **três fontes contra uma**.

> **Correção — 20/08/2026.** Esta premissa dizia *"(p.2 e p.4 do PDF)"*, atribuindo o nó de avaliação às
> duas imagens. Conferido página por página: só a p.2 o tem. O erro **enfraquecia a própria premissa**, ao
> transformar 3 a 1 em 2 a 2.

**Se estiver errada:** a máquina de estados ganha um sexto estado terminal cuja transição depende de ação
do Solicitante — e o enunciado não diz o que fazer se ele nunca avaliar. Impacto alto no modelo, e é a
divergência mais estruturante do enunciado.

### P4 — "Solução aplicada" é atributo da Ocorrência

O `fluxograma-1` **não** lista "Solução aplicada" entre os atributos; a imagem renderizada no PDF **lista**.
Tratamos a imagem como a versão mais recente.

**Se estiver errada:** provavelmente nada — a capacidade G7 ("registrar a solução aplicada") exige que o
dado exista de algum jeito.

### P5 — As personas secundárias não foram validadas

`Solicitante` e `Encarregado` foram construídos por **Domain Expert por proxy**. E a **Persona 1B**
(síndico profissional) foi narrada de fora, por quem é síndico amador.

**Se estiver errada:** a 1B sustenta os requisitos mais caros — Encarregado com conta, canais de conversa,
múltiplos condomínios por gestor. **É o maior risco de escopo do projeto**: se a persona não se confirma,
boa parte do que é `NOSSO` perde justificativa.

**Como reduzir esta premissa a evidência:** uma entrevista com um síndico profissional. **Ela não foi
feita.** É a única premissa deste documento que se resolveria com uma conversa curta, e a que mais
escopo destrava — por isso segue registrada como pendência, e não como resolvida.

---

## 2. Questões abertas

Numeração herdada de `trabalho/produto/decisoes-de-produto.md`. Das catorze, **doze foram resolvidas** —
por decisão direta ou por consequência de outra decisão.

**Não resta nenhuma.** As duas últimas eram corte de escopo, e foram fechadas pelo recorte da primeira
entrega, registrado em [escopo.md](escopo.md):

| # | Resolução |
|---|---|
| **Q10** | O aviso automático **não entra na primeira entrega**, em nenhum canal — nem externo, nem dentro do aplicativo. O Solicitante acompanha pela lista e pela linha do tempo, que são requisitos do enunciado. O e-mail transacional de acesso permanece, por ser infraestrutura de conta e não notificação |
| **Q11** | O **acesso próprio do Encarregado não entra na primeira entrega**, e com ele saem a leitura offline, o reporte de execução, a recusa de atribuição e a conversa da atribuição. O critério não foi prazo: os itens se apoiam na persona do síndico profissional, que é a premissa **P5**, não validada |

### Resolvidas, para rastreabilidade

| # | Resolvida por |
|---|---|
| Q1 · Q2 | D4, D5 — modelo de atores e cancelamento |
| Q3 | D10 — localização estruturada, por consequência da visibilidade derivada |
| Q4 | D18 — categorias configuráveis com semente |
| Q5 | D19 — dashboard é gestão; operação fica nos filtros rápidos |
| Q6 | D9 — nota interna é o canal 2 |
| Q7 | D22 — solução aplicada opcional, induzida por UX, com interruptor de tenant |
| Q8 | D24 — sem reabertura; nova ocorrência vinculada à original |
| Q9 | D25 — uma página de cadastro, três comportamentos |
| Q12 | D23 — `observação` obrigatória onde há decisão a justificar |
| Q13 | D21 — papel e atribuição ortogonais |
| Q14 | D26 — organização por auto-serviço; quem cria é o Gestor inicial |

---

## 3. Pontos de atenção do Event Storming

Levantados no passo 3 e acrescidos nos passos 4 a 6. Fonte: `trabalho/produto/event-storming.md`.
**Nenhum foi resolvido em silêncio.**

### Ainda abertos

| # | Ponto de atenção |
|---|---|
| PA-01 | **A imagem pode ser anexada depois do registro?** Na vida real o morador fotografa depois de abrir. S6 exige poder anexar, não diz quando |
| PA-02 | **Em ocorrência de área comum, o nome do autor aparece para os vizinhos?** A pesquisa cívica registra que cidadãos hesitam por **medo de retaliação** — e reclamar de algo que envolve um vizinho é rotina em condomínio |
| PA-03 | **Quem pode aderir** — qualquer pessoa com vínculo no local, ou só quem tem papel de Solicitante? O autor pode aderir à própria? |
| PA-05 | **LGPD** — foto e localização de pessoas. Tratado no RNF10, mas **sem revisão jurídica** |
| PA-06 | **Se "aguardando conferência" virar status**, o nome não pode ser `Em análise`, que já é do Gestor. Hoje é apenas o evento `Execução reportada como concluída`, sem status próprio |
| PA-07 | **Na Persona 1A, quem dispara as transições?** Seu Antônio não tem conta; o Gestor age em nome dele. O campo `autor da transição` registra o **Gestor**, mesmo quando o trabalho foi do zelador. **A trilha fica correta mas incompleta** — e isso toca o requisito central do enunciado |
| PA-08 | **Um Encarregado pode servir várias organizações?** Seu Antônio é de empresa terceirizada, "lotado no Céu Azul". Se ela atende 5 condomínios, são 5 vínculos ou uma entidade acima da organização? |
| PA-11 | **Quanto tempo é "muito tempo" sem primeira resposta?** Precisa de número para a política POL-09 existir. O objetivo O3 propõe 2 dias úteis, ainda não confirmado |
| PA-12 | **Pausada por muito tempo — o alarme funciona?** Metade resolvida pela D14 e pela D15. **Mas é o modo de falha confirmado por pesquisa independente:** *"ON HOLD ou PARKED podem ser status úteis, mas também podem ser lugares onde itens acumulam e são ignorados"*. Se falhar aqui, o produto reproduz a dor que veio consertar |
| PA-13 | **Quem são "os Gestores da organização" no canal 1?** Todos, sempre? Um condomínio com síndico e subsíndico teria os dois em toda conversa? |
| PA-16 | **O que acontece se o Solicitante nunca avaliar?** Por D1 nada trava — mas o indicador de satisfação fica cego, e ele é a **única métrica de qualidade do produto**. **Agravado na primeira entrega, e agora se sabe quanto:** o convite a avaliar aparece no detalhe e na lista, mas a lista ordena só por data de registro e não filtra *resolvida e não avaliada* — então a resolução envelhece, afunda, e o convite afunda com ela. O que traria de volta são o **sino** e os **filtros rápidos**, os dois ⬜. **O objetivo O4 (≥60% avaliadas) fica sem instrumento**, e este é um custo do corte do aviso automático que a §3.2 do escopo não previu. **E o limite não é da tela, é da paginação:** como a listagem é por cursor e não devolve total, nem contar *"resolvidas esperando avaliação"* é possível — a contagem valeria só para a página carregada, e diria *"nenhuma"* havendo. Levantado no inventário de telas em 20/08/2026, e delimitado pelo protótipo em 21/08 |
| PA-17 | **A avaliação é visível ao Encarregado?** Ele executou o serviço; a nota é sobre o trabalho dele |
| PA-19 | **Visão do Gestor atravessando organizações.** Na Persona 1B ele responde por vários condomínios e vai querer uma lista única — **exceção deliberada ao isolamento que a D2 existe para garantir**. Não resolvido pela ADR-0003, que trata do escopo por requisição |
| PA-21 | **Cinco eventos não couberam na linha do tempo** (comentário, nota interna, alteração de prioridade, reatribuição, mensagem na atribuição). O método do curso não trata de evento transversal — **limitação registrada em vez de forçá-los** |
| PA-22 | **Pausar para melhorar o número.** O material de ITSM alerta que a classe *on-hold* *"não deve ser mal utilizada para atingir o SLA intencionalmente"*. Na Persona 1B o Gestor presta contas à imobiliária — o incentivo existe |
| PA-24 | **A Organização com um Gestor só não tem caminho de volta.** Três decisões corretas isoladamente se fecham num beco: a organização nasce com **um** Gestor (D26), o papel de um vínculo **não pode ser alterado** depois de criado, e **só um Gestor aprova pedido de entrada** (D25). Se esse único Gestor perder o acesso, ninguém entra, ninguém aprova e ninguém promove — a organização fica inacessível **para sempre**. A saída existe só **fora do produto**, por acesso direto ao banco, que é justamente o caminho que a ADR-0003 declara como o que escapa do isolamento. Aceitável num MVP acadêmico; não aceitável sem estar escrito. Levantado na revisão do contrato de API, 20/08/2026 |
| PA-26 | **Quem tem conta não corrige o próprio nome depois de entrar.** `pessoas` é global, e por isso `PATCH /vinculos/{pessoaId}` recusa quem tem Usuário — um Gestor não pode alterar o cadastro de alguém em todas as outras organizações. A regra está certa; o que faltava era o outro lado. Na primeira entrega o nome nasce do cadastro da conta e é corrigível **uma vez**, no pedido de entrada. Depois disso, não há caminho. **A consequência é permanente**: o registro de transição é imutável, então o nome vigente em cada transição fica na trilha de auditoria para sempre. Não há tela de perfil porque ela não teria o que salvar. Encontrado ao montar o inventário de telas, pela pergunta *"o que uma tela de perfil salvaria?"*, 20/08/2026 |
| PA-27 | **O Gestor não consegue ver o que o Solicitante lê.** Os rótulos de status dependem de quem lê, e são calculados no servidor para o chamador — então nenhum endpoint devolve o rótulo *do outro lado*. Na prática, um Gestor escrevendo a observação de uma transição **não tem como conferir na tela dele o texto que o morador vai receber**, e a observação é imutável depois de gravada. O protótipo contornou mostrando o texto cru na pré-visualização, em vez do rótulo — o que ajuda, mas não é a mesma coisa. Levantado no protótipo low-fi, 21/08/2026 |

> **PA-24 e PA-25 não vieram do Event Storming**, e por isso quebram a proveniência desta seção. Os dois
> apareceram depois: um na revisão do contrato de API, outro ao desenhar o fluxo de entrada na
> Organização — nos dois casos, quando decisões tomadas em momentos diferentes foram lidas juntas pela
> primeira vez. O modo como surgiram é informação: **nenhuma das decisões envolvidas erra sozinha.**
>
> Os dois compartilhavam a causa raiz — *o papel de um vínculo é imutável e não havia como desfazer um
> vínculo*. **O PA-25 foi resolvido** (ver Resolvidos). O **PA-24 continua aberto e não foi resolvido pelo
> mesmo conserto**: remover um vínculo não cria Gestor, então a Organização cujo único Gestor perde o
> acesso segue sem caminho de volta dentro do produto. Vale registrar que o conserto do PA-25 **abriria**
> uma segunda porta para o PA-24 se não tivesse a guarda do último Gestor — o Gestor inicial de uma
> Organização recém-criada não tem histórico e poderia remover a si mesmo.

### Resolvidos

| # | Resolvido por |
|---|---|
| PA-04 | D18 — semente das 7 categorias do enunciado |
| PA-09 | D16 — nenhuma política altera prioridade |
| PA-10 | D17 — nada migra; impacto calculado sobre o grupo de duplicadas |
| PA-14 | D22 — é a Q7 |
| PA-15 | D24 — não há reabertura |
| PA-18 | D23 — é a Q12 |
| PA-20 | D13 e D14, e a emenda sobre e-mail transacional — resta só o corte de escopo (Q10) |
| PA-23 | D26 — auto-serviço; quem cria a organização é o Gestor inicial |
| PA-25 | **`DELETE /vinculos/{pessoaId}`** — remover vínculo sem histórico, capacidade ✅ da atividade 1 do [escopo](escopo.md). Foi preciso ceder em uma de três regras corretas (*nada é apagado* · *papel imutável* · *um vínculo por pessoa por organização*), e cedeu a primeira — porque o `ON DELETE RESTRICT` do esquema **já** delimita a exceção: só passa o vínculo sem dependente, que é o único sem histórico a preservar. Detalhe em [contrato-de-api.md](contrato-de-api.md) §8.2 |

---

## 4. Divergências nas fontes do enunciado

Já mapeadas. **Não redescobrir, não resolver em silêncio.**

| Divergência | Resolução |
|---|---|
| O `.md` do enunciado **truncou Docker, Deploy em Cloud e Documentação** (E7–E9), que só aparecem no PDF | **Em dúvida sobre requisito, o PDF manda.** Foi o que motivou o inventário completo do enunciado |
| A imagem do ciclo de vida mostra "Avaliação do solicitante" após `Resolvida`; a lista textual e o `fluxograma-2` têm só 5 estados | **P3** / decisão D1 |
| `fluxograma-2` liga todos os estados ao histórico; `fluxograma-3` liga só as transições | **P1** |
| `fluxograma-1` não lista "Solução aplicada" entre os atributos; a imagem renderizada lista | **P4** |
| O `fluxograma-1` desenha as capacidades de cada perfil como **sequência encadeada** | **Não é fluxo** — é lista de capacidades desenhada como fluxo por conveniência visual. Não modelamos como ordem obrigatória |

---

## 5. Limitações do material do curso

Encontradas na leitura. Registradas porque afetam o que citamos como fonte.

### 5.1 Domain-Driven Design — Fase 1, nove aulas

| Aula | Limitação | Como tratamos |
|---|---|---|
| 5, p.8–9 | O texto de Objetos de Valor se refere a *"essa tabela"* e *"nossa lista"* com um exemplo — **mas não existe tabela nem lista nas páginas** | Usamos apenas a parte utilizável: VO não tem identificador e é imutável |
| 9, p.5 vs p.6 | A **definição** de DoD inclui testes e documentação; o **exemplo** omite os dois | **Usamos a definição.** Registrado em `docs/definition-of-done.md` |
| 3, p.6 | "Termos Ambíguos" e "Termos Sinônimos" com definições quase idênticas e **orientações opostas** | Taxonomia **descartada**. Adotamos a orientação operante: um termo, uma definição |
| 2, p.12 | A escala de níveis de Cockburn é **usada sem ser explicada** | Não importada para a documentação |
| 6, p.11 | A regra "modelo de leitura **sempre** precede um comando" **não descreve o nosso caso**: os modelos de leitura centrais do Solicitante existem para ele *não* agir | Limitação do método, registrada no passo 7 |
| 7 e 8 | A aula 7 promete ensinar *"como buscar a resposta caso ela não venha no requisito"* e **não ensina**; a aula 8 promete tratar requisitos funcionais e não funcionais e **não trata** | Lacunas do material, sem impacto no que adotamos |
| 6 | O professor **não cita Alberto Brandolini**, criador do Event Storming | Registrado; nossa citação é do material da disciplina |
| — | **Multi-tenancy e RBAC não são cobertos por nenhuma das 9 aulas** | Tudo que escrevemos sobre tenancy é **[FONTE EXTERNA]** e se sustenta por mérito próprio |

### 5.2 Clean Architecture — Fase 5, oito aulas

Levantadas em 21/08/2026, ao confrontar o pacote com a disciplina desta fase. A curadoria completa está em
`trabalho/clean-architecture-o-que-adotar.md`; aqui ficam só as limitações que afetam o que citamos.

| Aula | Limitação | Como tratamos |
|---|---|---|
| 4, 5 e 6 | **O título não descreve a aula, três vezes.** A 4 promete *"Clean Code em testes na prática"* e é sobre **casos de uso**; a 5 promete *"Program paradigms e components paradigms"* e é sobre **Controller, Gateway e Presenter**; a 6 chama-se *"Design Principles"* e é sobre **componentização qualitativa**. As palavras-chave de cada uma confirmam o conteúdo, não o título | Citamos pelo **conteúdo**, sempre com a página. Onde o título importaria — a aula 4 e os testes — a consequência está na linha abaixo |
| 4 | **A disciplina não ensina técnicas de teste.** Uma página (p.9–10) trata do assunto, e o que diz é *"use um mock do repositório"*. **Não há um único teste escrito em oito aulas** — nem no fechamento, que roda a aplicação inteira. O professor remete o assunto a outra disciplina: *"a gente vai falar mais sobre isso lá na nossa aula de qualidade de software, quando a gente fala de TDD"* (aula 3, transcrição 02) | **Nada muda no Definition of Done nem em `arquitetura.md` §7.** O que a aula 4 diz — domínio testável sem infraestrutura — já é a coluna *"Sem banco? Sim"* da §7 e o argumento 3 da ADR-0001 |
| 5 e 6 | **Os princípios de componente do livro não são ensinados** — REP, CCP, CRP, ADP, SDP, SAP não aparecem, nem os nomes, e **não há regra de aciclicidade**. O que sobra é *"responsabilidade mínima"* e *"contexto de uso"*, que são orientações, não critérios | A regra de superfície pública por módulo (ADR-0006, regra 3) é **[FONTE EXTERNA]** e se sustenta por mérito próprio — mesma situação da multi-tenancy |
| — | **A disciplina nunca trata de transação.** Zero menções a atomicidade, unidade de trabalho ou consistência entre duas escritas, em oito aulas; todo exemplo tem **uma escrita por operação** | É por isso que **recusamos** a regra *"quem grava é o Controller"* (aula 4, p.8; aula 8, transcrições 01 e 02): ela quebraria a invariante 2 da ADR-0001, e foi formulada num universo onde o problema não existe. Recusa da **regra**, não da fonte |
| 5 p.8 vs 8 p.8 | **O terceiro componente de Interface Adapters troca de nome:** é **Presenter** na aula 5 e no diagrama de referência, e **Adapter** na aula 8 — com a mesma descrição | Usamos **Presenter**, que é o nome do diagrama e o do livro (`arquitetura.md` §5.5) |
| 2, 4, 5, 8 | **Quem fala com o repositório muda quatro vezes** entre apostila e transcrição, e o próprio professor admite não ter fechado: *"às vezes eu me pego pensando nisso"* (aula 2, transcrição 02) | Seguimos a versão que **tem código**: aula 5, transcrição 01, e aula 8 — o anel externo cria, o adaptador envolve, o caso de uso recebe. Registrado na ADR-0005 |
| 3, p.7 | A **Figura 1 é código em imagem** e não foi transcrita para o `.md` convertido | Recuperada pela transcrição 03 e pelo repositório da aula. É a única perda de conteúdo nas oito aulas |
| — | **"Agregado" não existe na disciplina.** Ela tem `Entities` e `Use Cases`, e nada entre os dois | Mantivemos o termo, que vem do DDD (aula 5, p.9) e sustenta o glossário, a ADR-0001 e o modelo de dados. **A ausência é lacuna da Fase 5, não excesso nosso** — registrado em `arquitetura.md` §5.1 |

---

## 6. Como este documento é mantido

O **Definition of Done** exige, em toda funcionalidade: *ponto de atenção resolvido é riscado, ponto de
atenção novo é registrado*. E o **Definition of Ready** exige, antes de começar: *nenhum ponto de atenção
em aberto que mude o comportamento desta tarefa*.

Ou seja — este arquivo não é um anexo. Ele é **consultado antes de cada tarefa e atualizado depois de cada
uma**.
