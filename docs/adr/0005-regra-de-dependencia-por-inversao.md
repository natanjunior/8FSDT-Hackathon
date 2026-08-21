# ADR-0005 — A regra de dependência é garantida por inversão; o lint é a verificação

**Status:** Aceita · 21/08/2026 · **Complementa a [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)**

## Contexto

A `arquitetura.md` (Parte I, §5) estabeleceu quatro camadas e uma regra de dependência, e declarou como ela
seria mantida: *"**Garantida por regra de lint**, não por disciplina: nada fora da Infraestrutura importa o
cliente de banco."*

A disciplina de **Clean Architecture da Fase 5** garante a mesma coisa por outro mecanismo, e é explícita
(aula 8, p.8, regra 1):

> *"Os componentes internos **não devem depender diretamente nem acessar** os componentes externos. Caso
> precisem, o componente necessário será informado **via injeção de dependência** e **os componentes
> internos devem sempre definir uma interface para 'receber' este componente externo**."*

As duas se parecem e **não são a mesma coisa**. A nossa proíbe um `import`; a dela faz a camada interna
**não ter o que importar**. A distinção é a mesma que a aula 1 (p.9) marca entre *inversão* e *injeção*:
*"a inversão de dependência significa passar para o usuário o que ele vai usar sem que ele se importe como
foi criado; e um dos **métodos** que vamos usar é **injetar**"*.

**Três fatos do próprio projeto mostram onde o lint não alcança** — e nenhum deles depende da disciplina
para ser verdade:

1. **A `arquitetura.md` §7 já promete um teste que hoje não tem como existir.** A linha *"Unitário de
   aplicação... Sem banco? **Sim (repositório em memória)**"* pressupõe que o repositório real seja
   substituível. Um duplo só substitui o original **se houver um tipo comum** — e **nenhum documento deste
   projeto declara esse tipo nem diz em que camada ele vive**. Sem ele, substituir vira *mock* de módulo, e
   o teste passa a depender do empacotador.
2. **A [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) tem a camada de Aplicação
   construindo infraestrutura.** `repos(ctx)` é uma fábrica **chamada de dentro** da Aplicação. A regra de
   lint não vê problema nisso — e é exatamente a dependência que a inversão existe para remover.
3. **O Definition of Done já registra um caso que o lint não alcança**, e com essas palavras: sobre a
   consulta que parte de `pessoas` em vez de `vinculos`, *"**a regra de lint não alcança este caso**,
   porque a consulta é legítima: ela apenas parte da tabela errada. A defesa é teste."*

O que o lint **proíbe** é `import` de SDK fora de um lugar. O que ele **não proíbe**: a Aplicação depender
de uma classe concreta de repositório; o repositório devolver uma linha de banco crua para dentro; a
Aplicação chamar uma fábrica que constrói infraestrutura. **Os três são legítimos para o lint, e os três
são o que a inversão impede.**

## Decisão

**A regra de dependência passa a ser garantida por inversão. O lint continua, com o papel redefinido:
verificação mecânica de que a inversão foi respeitada.**

Três partes.

**1 · A porta é declarada pela camada que a consome, e quem a consome é a Aplicação.**

A camada de **Aplicação** declara a interface do repositório; a **Infraestrutura** a implementa. O
**Domínio não declara porta nenhuma** — ele não persiste (§5) e não recebe repositório, porque quem carrega
o agregado é a Aplicação (Parte II, §1). Isto é mais estrito que o exemplo da própria disciplina, onde o
caso de uso recebe o repositório (aula 4, p.9), e é deliberado: a
[ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) depende de o comando do agregado não
conhecer persistência.

**2 · A montagem acontece no anel externo.**

Nenhuma função de aplicação chama uma fábrica de infraestrutura. Quem constrói o cliente de banco, monta o
repositório escopado e o entrega é o **route handler** — a camada mais externa —, através de um único ponto
de composição. É a cadeia que a disciplina descreve (aula 5, transcrição 01): *"a camada de API pode criar
uma conexão no banco de dados e passar para o Controller... o Controller vai passar para o UseCase o
repositório de dados, **mas não do jeito que veio**: a gente vai **envolver ele em um Gateway**."*

Na prática, um só ajudante no anel externo evita que isso vire 37 fiações à mão:

```ts
// app/api/ocorrencias/[id]/resolver/route.ts — o anel externo monta e entrega
export const POST = comContexto(async ({ ctx, repos, corpo }) =>
  resolverOcorrencia(ctx, repos, corpo)     // a Aplicação recebe; não fabrica
);
```

**3 · O que atravessa a porta é agregado ou objeto de leitura declarado — nunca linha de banco.**

O Gateway da disciplina tem assinatura `obterEstudantePorPessoa(PessoaEntity): EstudanteEntity` — **entra
entidade, sai entidade** (aula 5, p.8–9) — e *"deve expor suas ações como uma **atividade a executar**, e
não como uma função de baixo nível no serviço externo"*. `repos(ctx).ocorrencias.listar(filtros)` já é
"atividade a executar"; o que faltava era o **tipo de retorno**. Sem essa metade, nada impede que uma linha
de `ocorrencias` — ou um tipo de ORM — suba até a Aplicação, que é o vazamento que a aula 3 (p.6–7) chama
de *"erro estrutural"*.

**O lint fica, e fica mais estreito.** A regra deixa de ser *"nada fora da Infraestrutura importa o cliente
de banco"* e passa a ser *"nada fora de `infraestrutura/clientes/` importa um SDK"*
([ADR-0006](0006-organizacao-de-modulos.md)). O conjunto autorizado encolhe de uma camada inteira para um
diretório.

## Justificativa

**1 · O argumento decisivo é que a porta já era exigida por nós, e não estava escrita.** Não é uma prática
importada porque a disciplina a ensina: a `arquitetura.md` §7 promete o teste de aplicação sem banco desde
que foi escrita, e esse teste **não tem como existir** sem um tipo comum entre o repositório real e o
duplo. A decisão não acrescenta requisito — ela paga um que já estava assumido.

**2 · Inversão e lint respondem a perguntas diferentes, e as duas precisam de resposta.** A inversão é
**estrutura**: a camada interna não tem o que importar. O lint é **alarme**: avisa quando alguém reintroduz
o que a estrutura tirou. Uma sem a outra deixa buraco — estrutura sem alarme apodrece na primeira pressa;
alarme sem estrutura é o que temos hoje, e os três casos do Contexto mostram o tamanho do buraco.

**3 · Coerência com a ADR-0001 e a ADR-0003, um degrau acima.** As duas recusaram depender de boa vontade e
puseram a garantia numa invariante e numa regra de lint. Esta faz o mesmo movimento com a assimetria que
faltava: **a garantia primária vira estrutural, e a ferramenta vira conferência.** É a mesma filosofia
aplicada à única fronteira do projeto onde ela ainda não tinha chegado.

**4 · Custo marginal quase nulo no código.** A implementação seria escrita de qualquer forma. Com a porta
declarada ela custa **um parâmetro a mais por função de aplicação** e **um ajudante** no anel externo — e
devolve o teste que a §7 promete.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Manter só a regra de lint** (o estado atual) | Não alcança os três casos do Contexto, e o DoD já registra um quarto que ele não alcança. Manter significaria aceitar que o *"repositório em memória"* da §7 **não tem como existir** — ou passa a existir por *mock* de módulo, que amarra o teste ao empacotador |
| **Declarar a porta no Domínio e injetar o repositório no agregado** | É o que a disciplina faz (aula 4, p.9: *"o caso de uso recebeu uma instância de um repositório de dados"*). Recusado: o Domínio **não persiste** (§5), e a ADR-0001 depende de o comando não conhecer persistência. Além disso, quem resolve o contexto de organização é a Aplicação (ADR-0003) — um agregado que carrega repositório teria de carregar escopo junto |
| **Contêiner de injeção de dependências** (`tsyringe`, `inversify`) | Peso e indireção para **um implementador**. A montagem manual num ponto único custa menos código do que a configuração do contêiner, e é legível por quem não a escreveu — o mesmo argumento 3 da ADR-0003 |
| **Passar a conexão de banco crua por toda a cadeia** | É o que o código de referência da disciplina faz (aula 8, transcrição 01: `dbConnection` viaja por três camadas como argumento). Recusado: reintroduz na Aplicação o conhecimento de que existe um banco, que é o que se está removendo |

## Consequências

**Positivas**

- **O teste de aplicação sem banco passa a ser possível como escrito** — substituir o repositório é passar
  outro argumento, não interceptar um módulo.
- A ADR-0003 ganha o mecanismo que lhe faltava: o repositório escopado deixa de ser uma convenção de
  chamada e passa a ser um **contrato**.
- **O lint fica mais estreito e mais verdadeiro:** um diretório, em vez de uma camada.
- Nenhuma linha de banco atravessa para dentro — o vazamento que a aula 3 (p.6–7) chama de erro estrutural
  fica fechado por assinatura, não por revisão.
- Trocar de provedor de banco passa a ser trocar uma implementação da porta. A `arquitetura.md` §3 já
  afirmava isso; agora há um lugar onde a afirmação é verificável.

**Negativas e custos assumidos**

- **Toda função de aplicação ganha um parâmetro.** É ruído em 100% das assinaturas para um benefício que
  aparece nos testes e na troca de provedor. Assumido.
- **O ponto de composição é um lugar que pode crescer.** Se ele virar um arquivo de 300 linhas, o problema
  mudou de lugar em vez de sumir. Mitigação: ele monta **um** grafo de objetos, não regra — e a
  [ADR-0006](0006-organizacao-de-modulos.md) o isola em `src/composicao/`, onde fica visível.
- **A porta é mais uma coisa a manter em sincronia** com a implementação. O compilador cobre isso; o custo
  é de leitura, não de correção.
- **A montagem no anel externo não é o que a disciplina mostra no código.** O exemplo da aula 8 passa a
  conexão crua adiante. Divergimos com razão declarada, e a razão está na tabela acima.

## Escopo — o que esta ADR não decide

- **Não decide ORM.** Quando a escolha vier, o critério desta ADR é o tipo de retorno: o tipo do ORM não
  pode ser o tipo que atravessa a porta. A disciplina levanta a questão e não a fecha (aula 5, transcrição
  01: *"a gente precisa ter uma camada de entidades de regra de negócio e uma camada de entidades de banco
  de dados. Isso é bom? Isso é ruim? Tem gente que diverge"*).
- **Não decide onde os arquivos ficam** — isso é a [ADR-0006](0006-organizacao-de-modulos.md).
- **Não muda o isolamento entre organizações.** A ADR-0003 continua valendo inteira; muda **quem monta** o
  repositório escopado, não o que ele garante.

## Fontes

- **aula 8, p.8, regra 1** — a interface declarada pelo componente interno (Clean Architecture, Fase 5).
- **aula 5, transcrição 01** — a cadeia de montagem, do anel externo para dentro.
- **aula 5, p.8–9** — o Gateway expõe atividade de negócio e devolve entidade.
- **aula 1, p.9** — inversão de dependência não é injeção de dependência.
- **aula 4, p.9** — o caso de uso recebendo o repositório: a variante que **não** adotamos, e por quê.
- **aula 3, p.6–7** — os três sintomas de acoplamento ao repositório de dados.
- **ADR-0001** e **ADR-0003** — garantia mecânica em vez de disciplina; mesma lógica, um degrau acima.
- `docs/arquitetura.md` §7 — o teste que exigia a porta antes de esta ADR existir.
