---
title: "ADR-0005 · Dependência por inversão"
description: "A porta declarada pela camada que a consome, e o lint rebaixado de garantia a alarme."
---

# ADR-0005 — A regra de dependência é garantida por inversão; o lint é a verificação

**Status:** Aceita · 21/08/2026 · Complementa a
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

O desenho tem quatro camadas e uma regra de dependência, e até aqui ela era mantida por regra de lint:
nada fora da Infraestrutura importa o cliente de banco.

A inversão de dependências garante a mesma coisa por outro mecanismo. Nela, a camada interna não depende
da externa nem a acessa; quando precisa dela, declara a interface para recebê-la, e alguém de fora entrega
a implementação. A diferença com o lint é de natureza: o lint **proíbe** uma importação; a inversão faz a
camada interna **não ter o que importar**.

Três buracos do próprio projeto mostram onde o lint não alcança. O teste de aplicação sem banco, já
prometido, pressupõe um repositório substituível, e substituir exige um tipo comum que nenhum documento
declarava — sem ele, substituir vira interceptação de módulo, e o teste passa a depender do empacotador. A
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) tinha a camada de Aplicação chamando uma
fábrica que constrói infraestrutura, o que o lint considera legítimo. E o repositório podia devolver uma
linha de banco crua para dentro, o que o lint também não vê.

## Decisão

**A regra de dependência passa a ser garantida por inversão, e o lint continua com o papel redefinido:
verificação mecânica de que a inversão foi respeitada.** Três partes.

**A porta é declarada pela camada que a consome, e quem a consome é a Aplicação.** A Aplicação declara a
interface do repositório, e a Infraestrutura a implementa. O Domínio não declara porta nenhuma: ele não
persiste e não recebe repositório, porque quem carrega o agregado é a Aplicação. Isso é mais estrito que a
formulação usual, em que o caso de uso recebe o repositório, e é deliberado — a
[ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) depende de o comando do agregado não
conhecer persistência.

**A montagem acontece no anel externo.** Nenhuma função de aplicação chama uma fábrica de infraestrutura.
Quem constrói o cliente de banco, monta o repositório escopado e o entrega é a rota, através de um ponto
único de composição:

```ts
// a rota monta e entrega; a Aplicação recebe e não fabrica
export const POST = comContexto(async ({ ctx, repos, corpo }) =>
  resolverOcorrencia(ctx, repos, corpo),
);
```

**O que atravessa a porta é agregado ou objeto de leitura declarado, nunca linha de banco.** Sem essa
metade, o formato do banco sobe até a Aplicação e se espalha por camadas que não deveriam conhecê-lo.

**O lint fica, e fica mais estreito.** A regra deixa de ser *nada fora da Infraestrutura importa o cliente
de banco* e passa a ser *nada fora do diretório de clientes importa um SDK*. O conjunto autorizado encolhe
de uma camada inteira para um diretório.

A decisão paga um requisito que já estava assumido, em vez de acrescentar um: o teste de aplicação sem
banco não tinha como existir sem essa porta. E as duas coisas respondem a perguntas diferentes — a
inversão é estrutura, o lint é alarme. Estrutura sem alarme apodrece na primeira pressa, e alarme sem
estrutura era o estado anterior.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter só a regra de lint | Não alcança nenhum dos três buracos do contexto, e deixaria o teste sem banco existindo só por interceptação de módulo, o que o amarra ao empacotador |
| Declarar a porta no Domínio e injetar o repositório no agregado | É a variante mais comum na literatura, e é recusada porque o Domínio não persiste: a ADR-0001 depende de o comando não conhecer persistência. Um agregado que carregasse repositório teria ainda de carregar o escopo de organização junto |
| Contêiner de injeção de dependências | Peso e indireção para um implementador. A montagem manual num ponto único custa menos código do que a configuração do contêiner, e é legível por quem não a escreveu |
| Passar a conexão de banco crua por toda a cadeia | Reintroduz na Aplicação o conhecimento de que existe um banco, que é o que se está removendo |

## Consequências

**O que se ganha**

- O teste de aplicação sem banco passa a ser possível como escrito: substituir o repositório é passar
  outro argumento.
- A ADR-0003 ganha o mecanismo que lhe faltava: o repositório escopado vira contrato.
- O lint fica mais estreito e mais verdadeiro: um diretório, em vez de uma camada.
- Nenhuma linha de banco atravessa para dentro, fechada por assinatura em vez de por revisão.
- Trocar de provedor de banco passa a ser trocar uma implementação da porta.

**O que custa**

- **Toda função de aplicação ganha um parâmetro**, para um benefício que aparece no teste.
- **O ponto de composição pode crescer.** Se virar um arquivo enorme, o problema mudou de lugar em vez de
  sumir. Ele monta um grafo de objetos, e não regra, e a [ADR-0006](0006-organizacao-de-modulos.md) o
  isola num diretório próprio, onde fica visível.
- **A porta é mais uma coisa a manter em sincronia**, e quem cobra isso é o compilador.

Esta decisão não escolhe ORM: o critério, quando a escolha vier, é que o tipo do ORM não atravessa a
porta.

## Fontes

- Robert C. Martin, *Clean Architecture* (2017), de onde vem a regra de dependência e a inversão como
  mecanismo para sustentá-la.
