# ADR-0008 — A suíte de testes segue onde mora a garantia, não a pirâmide

**Status:** Aceita · 22/08/2026 · **Complementa a [ADR-0005](0005-regra-de-dependencia-por-inversao.md)**,
que é o que a tornou possível, e o [Definition of Done](../definition-of-done.md), que a cobra

## Contexto

O esqueleto de deploy estabeleceu a realidade de testes deste projeto **sem tê-la desenhado**: 24 unitários,
15 de integração, um *shim* de `auth.users` para o CI, e o **Playwright na stack sem uma linha o usando**.
Os próximos quarenta itens do backlog carregam testes cada um. O que estiver decidido agora é herdado
quarenta vezes; o que não estiver, acreta quarenta vezes.

Três restrições moldam a decisão, e **nenhuma delas é sobre teste**:

- **Um implementador, cinco semanas, e nenhuma revisão de código por pares** — está declarado como
  limitação no `definition-of-done.md`.
- **A maior parte da regra está num agregado testável em memória em milissegundos**, porque a
  [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) a pôs lá.
- **Três garantias deste projeto já são estruturais, não processuais:** só o agregado escreve `status`
  (ADR-0001), o escopo é aplicado numa função só ([ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)),
  e a camada interna **não tem o que importar** (ADR-0005 e [ADR-0006](0006-organizacao-de-modulos.md)).

E há uma restrição do material que precisa estar dita: **a disciplina de Clean Architecture da Fase 5 não
ensina teste.** Em oito aulas **não há um único teste escrito** — nem na aula de fechamento, que roda a
aplicação inteira —, embora *"testabilidade"* seja o argumento oferecido para inversão de dependência em
cinco delas. O professor diz onde o assunto mora: *"a gente vai falar mais sobre isso lá na nossa aula de
Qualidade de Software"*, que é outra disciplina e não a temos. **Esta ADR é [FONTE EXTERNA] quase inteira**,
na mesma situação da multi-tenancy: sustenta-se por mérito próprio ou não se sustenta.

## Decisão

**A quantidade de teste segue a natureza da garantia que ele protege, não o nível de uma pirâmide.** São
três grupos, e o que os separa é a **regra de crescimento**:

| Grupo | O que protege | Como cresce |
|---|---|---|
| **1 · O agregado, exaustivo, em memória** | A máquina de estados e a invariante de auditoria: toda transição gera um registro; transição ilegal é rejeitada | **Por caso**, e é aqui que o volume vai. É combinatório e custa milissegundos |
| **2 · Uma prova por garantia estrutural** | O ponto único de escopo, a substituição do repositório pela porta, as invariantes que o esquema garante | **Não cresce com funcionalidade.** Cresce com migração nova e com porta nova |
| **3 · Um teste de ponta a ponta** | Que as camadas, o artefato de deploy, a autenticação real e o navegador se falam | **Não cresce.** Ganha asserção; nunca ganha arquivo |

Três consequências fixam o que isso significa.

**1 · Existe um teste de ponta a ponta, e um só — para sempre.** O que ele prova é **binário**: ou as
camadas se falam, ou não. Um segundo prova a mesma coisa de novo, pelo preço inteiro. Ele é o caminho
crítico do enunciado — registrar → analisar → atribuir → atender → resolver → avaliar —, com o histórico
conferido na interface, **mais uma asserção** que troca a organização no meio do percurso e confere que a
lista muda. Essa asserção é a única prova ponta a ponta que a decisão do PA-19 vai ter, e custa dois
cliques.

**Um segundo só entra se provar algo que o primeiro não pode** — e isso quer dizer **outro transporte**, não
outro fluxo. Nenhum item do backlog qualifica hoje. O único candidato nomeado é a **leitura offline do
RNF7**, porque ela mora no *service worker* e não tem camada de baixo onde ser testada. Mesmo ele passa por
decisão escrita.

**2 · Ele não é portão de pipeline por push.** Roda contra o `docker compose` mais o `supabase start` — a
mesma pilha que o E7 exige e que o `definition-of-done.md` já manda subir do zero a cada funcionalidade. É
**automação de um item de DoD que hoje é feito à mão**, não infraestrutura nova, e acrescenta **zero
segundo** ao pipeline por push.

**3 · Não há teste de integração por endpoint.** São trinta e sete. Um teste por endpoint seria o maior
artefato do projeto e testaria sobretudo o framework. O que tem teste de integração é a **consulta
escopada** — porque é ela que carrega o risco —, por uma suíte compartilhada descrita na §7 da
`arquitetura.md`.

## Justificativa

**1 · Por que a pirâmide não serve aqui.** A pirâmide pressupõe uma equipe com revisão por pares, em que o
teste unitário faz parte do trabalho que o revisor faria, e em que o custo de um defeito cresce com o nível
em que ele escapa. A restrição real deste projeto é outra: **uma garantia estrutural não precisa de um teste
por instância — precisa de um teste que prove que a estrutura vale.** O escopo é aplicado numa função só; um
teste de vazamento por consulta testaria a mesma função trinta e sete vezes, e cada repetição daria a
impressão de cobertura nova.

**2 · O critério é custo por item, e ele é verificável.** Se um endpoint novo custar quatro arquivos de teste
escritos do zero, o DoD vira teatro no décimo item — não por má-fé, por aritmética. A forma acima custa, num
item típico: **casos novos no teste do agregado**, que é onde o trabalho de fato está; **uma entrada na suíte
de isolamento**, se a tarefa tocou consulta; e **nada** nos outros dois grupos.

**3 · O lote 6 do backlog é o teste desta decisão.** São sete itens seguidos escrevendo no mesmo arquivo de
domínio — atribuir, iniciar atendimento, alterar prioridade, cancelar, pausar, retomar, registrar solução —,
sem paralelismo possível, cada um cobrado pelas cinco famílias do DoD. **É exatamente onde teste repetido à
mão mataria o cronograma**, e é exatamente onde esta forma concentra o barato: os sete são casos no mesmo
teste de agregado, sem banco, sem cenário e sem infraestrutura.

**4 · A ADR-0005 já pagou o preço que torna isto possível.** O grupo 1 só é exaustivo porque o agregado não
persiste, e o grupo 2 só tem *uma* prova de substituição porque a porta existe. Sem aquela decisão, esta
seria uma intenção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **A pirâmide clássica**, com faixa de integração larga | É a forma certa em equipe com revisão por pares e com a regra espalhada por várias camadas. **Aqui a premissa não vale**: a regra está concentrada num agregado, e três das garantias são estruturais. Adotá-la produziria uma faixa média grande testando o framework — e é a herança por hábito que a ADR-0006 já recusou uma vez, ao rejeitar a *colocation* que o Next.js sugere |
| **Um teste de ponta a ponta por atividade do escopo** (quatro) | Multiplica por quatro o artefato mais lento e mais frágil do projeto para provar quatro vezes a mesma coisa. Com um implementador, **esteira vermelha por motivo que não é defeito é abandonada, não consertada** — e cada E2E a mais é uma chance a mais disso |
| **O E2E contra o ambiente publicado** | Há **um** ambiente e não há preview por branch (ADR-0004; §9 da `arquitetura.md`). O teste escreveria dado de teste no mesmo lugar onde a revisão funcional acontece, e o *cold start* do free tier produz falha que não é defeito. As duas coisas atacam o portão pelo lado de dentro |
| **O E2E com a autenticação trocada por uma porta falsa** | Tecnicamente é o mais fácil de todos: `PortaDeAutenticacao` é porta declarada, e trocá-la é passar outro argumento (ADR-0005). **Recusado mesmo assim:** seria um caminho de produção existente só para teste, ligado por variável de ambiente — e a variável que finge autenticação é a pior de todas para existir numa **imagem pública** (ADR-0004). O E2E roda contra a pilha real justamente porque autenticação é a única coisa que ele prova e que nenhum outro teste alcança |
| **Meta de cobertura em porcentagem** | Mede linha executada, não garantia protegida. Neste desenho ela premiaria testar projeção e handler — que é onde a §5 da `arquitetura.md` proíbe que haja regra — e não distinguiria o teste que prova a estrutura daquele que a repete |

## Consequências

**Positivas**

- O custo por item é **um arquivo curto ou nenhum**: casos no teste do agregado, e uma entrada na suíte de
  isolamento quando a tarefa toca consulta.
- O pipeline por push continua em torno de um minuto, porque nada do que é caro entrou nele.
- O item de DoD *"organização A não vê dado de B"* deixa de depender de alguém reescrever o cenário — que é
  a forma pela qual um portão passa a ser **marcado sem ser cumprido**.
- O lote 6 — o maior do projeto e o que não paraleliza — cai inteiro no grupo mais barato.

**Negativas e custos assumidos**

- **A camada de Interface fica praticamente sem cobertura.** Route handler e projeção são justamente onde uma
  equipe com revisão por pares teria teste, e aqui só o único E2E os toca de raspão. **É o buraco desta
  decisão.** O que o limita é desenho, não sorte: a §5 da `arquitetura.md` restringe essa camada a *traduzir
  HTTP e validar formato*, e o schema `zod` que ela usa é o mesmo que gera o `openapi.yaml`, conferido por
  passo de pipeline (§15 do `contrato-de-api.md`). **Isto é argumento, não cobertura**, e está escrito como
  argumento.
- **O único E2E só pode existir quando o caminho crítico existir**, o que é ao fim do **lote 8** — porque o
  último elo do percurso é *avaliar*, e ele está lá, não no lote 6 — e **nenhum
  portão do projeto o cobra.** Conferido ao escrever esta ADR: *"testes de ponta a ponta"* é **capacidade ✅
  do `escopo.md`**, marcada `ENUNCIADO · aberto` (E6), e o `definition-of-done.md` **não tem item de teste de
  ponta a ponta** — as cinco famílias dele são caminho feliz, transição inválida, transição gerando
  histórico, isolamento e a cronometragem do RNF6. A combinação é a pior possível: **não pode ser cortado, e
  não é pedido a ninguém.** Ele precisa de **item próprio no backlog**; sem isso é a entrega que o enunciado
  exige e que nenhuma tarefa foi encarregada de fazer.
- **Um defeito de integração entre duas camadas pode chegar até o E2E.** É o preço de não haver faixa média.
  O que o reduz é que as fronteiras entre camadas aqui são **poucas e declaradas** (ADR-0005), não muitas e
  implícitas.
- **É [FONTE EXTERNA].** A disciplina da Fase 5 não oferece critério de teste nenhum, e remete o assunto a
  uma aula que não temos.

## Fontes

- `docs/definition-of-done.md` — as cinco famílias de teste que esta ADR organiza, e a limitação de não haver
  revisão por pares.
- `docs/escopo.md` — o teste de ponta a ponta como capacidade ✅ marcada `ENUNCIADO · aberto` (E6), que é o
  único lugar do pacote onde ele é exigido.
- §7 e §9 da `arquitetura.md` — a tabela de testes e o ambiente único, sem preview por branch.
- **ADR-0001, 0003, 0005 e 0006** — as garantias estruturais que fazem o grupo 2 não crescer.
- **ADR-0004** — a imagem pública, que é o que recusa a variável de ambiente que finge autenticação.
- `trabalho/backlog.md` — o lote 6, sete itens sequenciais no mesmo arquivo de domínio.
- **[FONTE EXTERNA]** — a forma da suíte. A Clean Architecture da Fase 5 não escreve um teste em oito aulas, e
  remete o assunto a outra disciplina.
