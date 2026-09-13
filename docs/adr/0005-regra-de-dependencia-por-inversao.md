---
title: "ADR-0005 · Dependência por inversão"
description: "A porta declarada pela camada que a consome, e o lint rebaixado de garantia a alarme."
---

# ADR-0005 — A regra de dependência é garantida por inversão; o lint é a verificação

**Status:** Aceita · 21/08/2026 · Complementa a
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

A `arquitetura.md` (Parte I, §5) estabeleceu quatro camadas e uma regra de dependência, e declarou como
ela seria mantida: garantida por regra de lint, e não por boa vontade, de modo que nada fora da
Infraestrutura importe o cliente de banco.

A inversão de dependências garante a mesma coisa por outro mecanismo. Nela, o componente interno não
depende do externo nem o acessa; quando precisa dele, declara a interface para recebê-lo, e alguém de
fora entrega a implementação.

As duas se parecem e não são a mesma coisa. A nossa proíbe um `import`; a inversão faz a camada interna
**não ter o que importar**. É a mesma distinção que separa inversão de injeção: inverter é passar ao
consumidor o que ele vai usar sem que ele saiba como foi criado, e injetar é um dos métodos de fazer isso.

**Três fatos do próprio projeto mostram onde o lint não alcança**, e nenhum deles depende de teoria para
ser verdade:

1. **A `arquitetura.md` §7 já promete um teste que hoje não tem como existir.** A linha que diz "unitário
   de aplicação, sem banco, com repositório em memória" pressupõe que o repositório real seja
   substituível. Um duplo só substitui o original se houver um tipo comum, e nenhum documento deste
   projeto declara esse tipo nem diz em que camada ele vive. Sem ele, substituir vira *mock* de módulo, e
   o teste passa a depender do empacotador.
2. **A [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) tinha a camada de Aplicação
   construindo infraestrutura.** O `repos(ctx)` era uma fábrica chamada de dentro da Aplicação. A regra de
   lint não vê problema nisso, e é essa a dependência que a inversão existe para remover.
3. **O Definition of Done já registra um caso que o lint não alcança**, e com essas palavras: sobre a
   consulta que parte de `pessoas` em vez de `vinculos`, a regra de lint não alcança o caso porque a
   consulta é legítima, e apenas parte da tabela errada. A defesa é teste.

O que o lint proíbe é `import` de SDK fora de um lugar. O que ele não proíbe: a Aplicação depender de uma
classe concreta de repositório; o repositório devolver uma linha de banco crua para dentro; a Aplicação
chamar uma fábrica que constrói infraestrutura. Os três são legítimos para o lint, e os três são o que a
inversão impede.

## Decisão

**A regra de dependência passa a ser garantida por inversão. O lint continua, com o papel redefinido:
verificação mecânica de que a inversão foi respeitada.**

Três partes.

**1 · A porta é declarada pela camada que a consome, e quem a consome é a Aplicação.**

A camada de Aplicação declara a interface do repositório; a Infraestrutura a implementa. O Domínio não
declara porta nenhuma: ele não persiste, e não recebe repositório, porque quem carrega o agregado é a
Aplicação. Isso é mais estrito que a formulação usual, em que o caso de uso recebe o repositório, e é
deliberado. A [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) depende de o comando
do agregado não conhecer persistência.

**2 · A montagem acontece no anel externo.**

Nenhuma função de aplicação chama uma fábrica de infraestrutura. Quem constrói o cliente de banco, monta
o repositório escopado e o entrega é o route handler, a camada mais externa, através de um único ponto de
composição.

Na prática, um só ajudante no anel externo evita que isso vire 37 fiações à mão:

```ts
// app/api/ocorrencias/[id]/resolver/route.ts — o anel externo monta e entrega
export const POST = comContexto(async ({ ctx, repos, corpo }) =>
  resolverOcorrencia(ctx, repos, corpo)     // a Aplicação recebe; não fabrica
);
```

**3 · O que atravessa a porta é agregado ou objeto de leitura declarado, nunca linha de banco.**

Uma porta bem desenhada expõe atividade de negócio, e não função de baixo nível do serviço externo. O
`repos(ctx).ocorrencias.listar(filtros)` já era atividade de negócio; o que faltava era o tipo de
retorno. Sem essa metade, nada impede que uma linha de `ocorrencias`, ou um tipo de ORM, suba até a
Aplicação. Esse vazamento é erro estrutural, e não detalhe de estilo: ele espalha o formato do banco por
camadas que não deveriam sabê-lo.

**O lint fica, e fica mais estreito.** A regra deixa de ser "nada fora da Infraestrutura importa o cliente
de banco" e passa a ser "nada fora de `infraestrutura/clientes/` importa um SDK"
([ADR-0006](0006-organizacao-de-modulos.md)). O conjunto autorizado encolhe de uma camada inteira para um
diretório.

## Justificativa

**1 · O argumento decisivo é que a porta já era exigida por nós, e não estava escrita.** A
`arquitetura.md` §7 promete o teste de aplicação sem banco desde que foi escrita, e esse teste não tem
como existir sem um tipo comum entre o repositório real e o duplo. A decisão não acrescenta requisito:
paga um que já estava assumido.

**2 · Inversão e lint respondem a perguntas diferentes, e as duas precisam de resposta.** A inversão é
estrutura, e faz a camada interna não ter o que importar. O lint é alarme, e avisa quando alguém
reintroduz o que a estrutura tirou. Uma sem a outra deixa buraco: estrutura sem alarme apodrece na
primeira pressa, e alarme sem estrutura é o que havia antes desta ADR, com o tamanho do buraco medido
pelos três casos do Contexto.

**3 · Coerência com a ADR-0001 e a ADR-0003, um degrau acima.** As duas recusaram depender de boa vontade
e puseram a garantia numa invariante e numa regra de lint. Esta faz o mesmo movimento com a assimetria que
faltava: a garantia primária vira estrutural, e a ferramenta vira conferência. É a mesma filosofia
aplicada à única fronteira do projeto onde ela ainda não tinha chegado.

**4 · Custo marginal quase nulo no código.** A implementação seria escrita de qualquer forma. Com a porta
declarada ela custa um parâmetro a mais por função de aplicação e um ajudante no anel externo, e devolve
o teste que a §7 da `arquitetura.md` promete.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter só a regra de lint, que era o estado anterior | Não alcança os três casos do Contexto, e o Definition of Done já registra um quarto. Manter significaria aceitar que o repositório em memória da §7 da `arquitetura.md` não tem como existir, ou passa a existir por *mock* de módulo, que amarra o teste ao empacotador |
| Declarar a porta no Domínio e injetar o repositório no agregado | É a variante mais comum na literatura. Recusada porque o Domínio não persiste, e a ADR-0001 depende de o comando não conhecer persistência. Além disso, quem resolve o contexto de organização é a Aplicação, pela ADR-0003, e um agregado que carregasse repositório teria de carregar escopo junto |
| Contêiner de injeção de dependências (`tsyringe`, `inversify`) | Peso e indireção para um implementador. A montagem manual num ponto único custa menos código do que a configuração do contêiner, e é legível por quem não a escreveu. É o mesmo argumento de revisibilidade da ADR-0003 |
| Passar a conexão de banco crua por toda a cadeia | Reintroduz na Aplicação o conhecimento de que existe um banco, que é o que se está removendo |

## Consequências

**Positivas**

- **O teste de aplicação sem banco passa a ser possível como escrito:** substituir o repositório é passar
  outro argumento, e não interceptar um módulo.
- A ADR-0003 ganha o mecanismo que lhe faltava, e o repositório escopado deixa de ser convenção de chamada
  para virar contrato.
- **O lint fica mais estreito e mais verdadeiro:** um diretório, em vez de uma camada.
- Nenhuma linha de banco atravessa para dentro. O vazamento fica fechado por assinatura, e não por revisão.
- Trocar de provedor de banco passa a ser trocar uma implementação da porta. A `arquitetura.md` §3 já
  afirmava isso, e agora há um lugar onde a afirmação é verificável.

**Negativas e custos assumidos**

- **Toda função de aplicação ganha um parâmetro.** É ruído em todas as assinaturas para um benefício que
  aparece nos testes e na troca de provedor. Assumido.
- **O ponto de composição é um lugar que pode crescer.** Se ele virar um arquivo de 300 linhas, o problema
  mudou de lugar em vez de sumir. Mitigação: ele monta um grafo de objetos, e não regra, e a
  [ADR-0006](0006-organizacao-de-modulos.md) o isola em `src/composicao/`, onde fica visível.
- **A porta é mais uma coisa a manter em sincronia** com a implementação. O compilador cobre isso, então o
  custo é de leitura, e não de correção.

## O que esta ADR não decide

- **Não decide ORM.** Quando a escolha vier, o critério desta ADR é o tipo de retorno: o tipo do ORM não
  pode ser o tipo que atravessa a porta.
- **Não decide onde os arquivos ficam.** Isso é a [ADR-0006](0006-organizacao-de-modulos.md).
- **Não muda o isolamento entre organizações.** A ADR-0003 continua valendo inteira; muda quem monta o
  repositório escopado, e não o que ele garante.

## Fontes

- Robert C. Martin, *Clean Architecture* (2017), de onde vem a regra de dependência e a inversão como
  mecanismo para sustentá-la.
- [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) e
  [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md): garantia mecânica em vez de boa
  vontade, mesma lógica um degrau acima.
- `docs/arquitetura.md` §7, o teste que exigia a porta antes de esta ADR existir.
