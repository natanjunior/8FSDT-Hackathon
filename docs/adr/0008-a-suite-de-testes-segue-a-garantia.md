# ADR-0008 — A suíte de testes segue onde mora a garantia, não a pirâmide

**Status:** Aceita · 22/08/2026 · Complementa a [ADR-0005](0005-regra-de-dependencia-por-inversao.md),
que é o que a tornou possível, e o [Definition of Done](../definition-of-done.md), que a cobra

## Contexto

O esqueleto de deploy estabeleceu a realidade de testes deste projeto sem tê-la desenhado: 24 unitários,
15 de integração, um *shim* de `auth.users` para o CI, e o Playwright escolhido na `arquitetura.md` e
ausente do `package.json`. Os quarenta itens seguintes do backlog carregam testes cada um. O que estiver
decidido agora é herdado quarenta vezes; o que não estiver, acreta quarenta vezes.

Três restrições moldam a decisão, e nenhuma delas é sobre teste:

- **Um implementador, cinco semanas, e nenhuma revisão de código por pares**, declarado como limitação no
  `definition-of-done.md`.
- **A maior parte da regra está num agregado testável em memória em milissegundos**, porque a
  [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) a pôs lá.
- **Três garantias deste projeto já são estruturais, e não processuais:** só o agregado escreve `status`
  (ADR-0001), o escopo é aplicado numa função só
  ([ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)), e a camada interna não tem o que
  importar (ADR-0005 e [ADR-0006](0006-organizacao-de-modulos.md)).

## Decisão

**A quantidade de teste segue a natureza da garantia que ele protege, e não o nível de uma pirâmide.** São
três grupos, e o que os separa é a regra de crescimento:

| Grupo | O que protege | Como cresce |
|---|---|---|
| 1 · O agregado, exaustivo, em memória | A máquina de estados e a invariante de auditoria: toda transição gera um registro, e transição ilegal é rejeitada | **Por caso**, e é aqui que o volume vai. É combinatório e custa milissegundos |
| 2 · Uma prova por garantia estrutural | O ponto único de escopo, a substituição do repositório pela porta, as invariantes que o esquema garante | **Não cresce com funcionalidade.** Cresce com migração nova e com porta nova |
| 3 · Um teste de ponta a ponta | Que as camadas, o artefato de deploy, a autenticação real e o navegador se falam | **Não cresce.** Ganha asserção; nunca ganha arquivo |

Três consequências fixam o que isso significa.

**1 · Existe um teste de ponta a ponta, e um só, para sempre.** O que ele prova é binário: ou as camadas se
falam, ou não. Um segundo prova a mesma coisa de novo, pelo preço inteiro. Ele percorre o caminho crítico
do enunciado, de registrar a analisar, atribuir, atender, resolver e avaliar, com o histórico conferido na
interface, mais uma asserção que troca a organização no meio do percurso e confere que a lista muda. Essa
asserção é a única prova ponta a ponta que a decisão do PA-19 vai ter, e custa dois cliques.

**Um segundo só entra se provar algo que o primeiro não pode**, e isso quer dizer outro transporte, e não
outro fluxo. Nenhum item do backlog qualifica hoje. O único candidato nomeado é a leitura offline do RNF7,
porque ela mora no *service worker* e não tem camada de baixo onde ser testada. Mesmo ele passa por
decisão escrita.

**2 · Ele não é portão de pipeline por push.** Roda contra o `docker compose` mais o `supabase start`, a
mesma pilha que a conteinerização exige e que o `definition-of-done.md` já manda subir do zero a cada
funcionalidade. Não é infraestrutura nova, acrescenta zero segundo ao pipeline por push, e é a única
cobertura que a camada de Interface tem.

**3 · Não há teste de integração por endpoint.** São trinta e sete. Um teste por endpoint seria o maior
artefato do projeto e testaria sobretudo o framework. O que tem teste de integração é a consulta escopada,
porque é ela que carrega o risco, por uma suíte compartilhada descrita na §7 da `arquitetura.md`.

## Justificativa

**1 · Por que a pirâmide não serve aqui.** A pirâmide pressupõe uma equipe com revisão por pares, em que o
teste unitário faz parte do trabalho que o revisor faria, e em que o custo de um defeito cresce com o
nível em que ele escapa. A restrição real deste projeto é outra: uma garantia estrutural não precisa de um
teste por instância, e sim de um teste que prove que a estrutura vale. O escopo é aplicado numa função só;
um teste de vazamento por consulta testaria a mesma função trinta e sete vezes, e cada repetição daria a
impressão de cobertura nova.

**2 · O critério é custo por item, e ele é verificável.** Se um endpoint novo custar quatro arquivos de
teste escritos do zero, o Definition of Done vira teatro no décimo item, não por má-fé, e sim por
aritmética. A forma acima custa, num item típico: casos novos no teste do agregado, que é onde o trabalho
de fato está; uma entrada na suíte de isolamento, se a tarefa tocou consulta; e nada nos outros dois
grupos.

**3 · O lote 6 do backlog é o teste desta decisão.** São sete itens seguidos escrevendo no mesmo arquivo
de domínio, atribuir, iniciar atendimento, alterar prioridade, cancelar, pausar, retomar e registrar
solução, sem paralelismo possível, cada um cobrado pelas cinco famílias do Definition of Done. É o ponto
onde teste repetido à mão mataria o cronograma, e o ponto onde esta forma concentra o barato: os sete são
casos no mesmo teste de agregado, sem banco, sem cenário e sem infraestrutura.

**4 · A ADR-0005 já pagou o preço que torna isto possível.** O grupo 1 só é exaustivo porque o agregado
não persiste, e o grupo 2 só tem uma prova de substituição porque a porta existe. Sem aquela decisão, esta
seria uma intenção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| A pirâmide clássica, com faixa de integração larga | É a forma certa em equipe com revisão por pares e com a regra espalhada por várias camadas. Aqui a premissa não vale: a regra está concentrada num agregado, e três das garantias são estruturais. Adotá-la produziria uma faixa média grande testando o framework, que é a herança por hábito que a ADR-0006 já recusou uma vez |
| Um teste de ponta a ponta por atividade do escopo, quatro ao todo | Multiplica por quatro o artefato mais lento e mais frágil do projeto para provar quatro vezes a mesma coisa. Com um implementador, esteira vermelha por motivo que não é defeito é abandonada, e não consertada, e cada E2E a mais é uma chance a mais disso |
| O E2E contra o ambiente publicado | Há um ambiente e não há preview por branch (ADR-0004, e §9 da `arquitetura.md`). O teste escreveria dado de teste no mesmo lugar onde a revisão funcional acontece, e o *cold start* do free tier produz falha que não é defeito. As duas coisas atacam o portão pelo lado de dentro |
| O E2E com a autenticação trocada por uma porta falsa | Tecnicamente é o mais fácil de todos, porque `PortaDeAutenticacao` é porta declarada e trocá-la é passar outro argumento. Recusado mesmo assim: seria um caminho de produção existente só para teste, ligado por variável de ambiente, e a variável que finge autenticação é a pior de todas para existir numa imagem pública (ADR-0004). O E2E roda contra a pilha real porque autenticação é a única coisa que ele prova e que nenhum outro teste alcança |
| Meta de cobertura em porcentagem | Mede linha executada, e não garantia protegida. Neste desenho ela premiaria testar projeção e handler, que é onde a §5 da `arquitetura.md` proíbe que haja regra, e não distinguiria o teste que prova a estrutura daquele que a repete |

## Consequências

**Positivas**

- O custo por item é um arquivo curto ou nenhum: casos no teste do agregado, e uma entrada na suíte de
  isolamento quando a tarefa toca consulta.
- O pipeline por push continua em torno de um minuto, porque nada do que é caro entrou nele.
- O item de Definition of Done que exige que a organização A não veja dado de B deixa de depender de
  alguém reescrever o cenário, que é a forma pela qual um portão passa a ser marcado sem ser cumprido.
- O lote 6, o maior do projeto e o que não paraleliza, cai inteiro no grupo mais barato.

**Negativas e custos assumidos**

- **A camada de Interface fica praticamente sem cobertura.** Route handler e projeção são onde uma equipe
  com revisão por pares teria teste, e aqui só o único E2E os toca de raspão. **É o buraco desta decisão.**
  O que o limita é desenho, e não sorte: a §5 da `arquitetura.md` restringe essa camada a traduzir HTTP e
  validar formato, e o schema `zod` que ela usa é o mesmo que gera o `openapi.yaml`, conferido por passo de
  pipeline. Isso é argumento, e não cobertura, e está escrito como argumento.
- **O E2E só pôde existir quando o caminho crítico existiu**, ao fim do lote 8, porque o último elo do
  percurso é avaliar. Quando esta ADR foi escrita, nenhum portão do projeto o cobrava: o teste de ponta a
  ponta era capacidade exigida pelo enunciado e marcada como entregue no `escopo.md`, e o
  `definition-of-done.md` não tinha item correspondente, porque as cinco famílias dele são caminho feliz,
  transição inválida, transição gerando histórico, isolamento e a cronometragem do RNF6. A combinação era a
  pior possível, com algo que não pode ser cortado e que não era pedido a ninguém. Foi resolvido com item
  próprio no backlog, que instalou o Playwright, Chromium só e fora do pipeline, e escreveu o teste em
  `testes/ponta-a-ponta/`.
- **Um defeito de integração entre duas camadas pode chegar até o E2E.** É o preço de não haver faixa
  média. O que o reduz é que as fronteiras entre camadas aqui são poucas e declaradas (ADR-0005), e não
  muitas e implícitas.

## Fontes

- `docs/definition-of-done.md`, as cinco famílias de teste que esta ADR organiza, e a limitação de não
  haver revisão por pares.
- `docs/escopo.md`, o teste de ponta a ponta como capacidade exigida pelo enunciado.
- §7 e §9 da `arquitetura.md`, a tabela de testes e o ambiente único, sem preview por branch.
- ADR-0001, 0003, 0005 e 0006, as garantias estruturais que fazem o grupo 2 não crescer.
- [ADR-0004](0004-execucao-em-container-no-azure.md), a imagem pública, que é o que recusa a variável de
  ambiente que finge autenticação.
