---
title: "ADR-0003 · Isolamento entre organizações"
description: "O escopo aplicado num ponto único da camada de aplicação, e RLS como defesa em profundidade."
---

# ADR-0003 — Isolamento entre organizações na camada de aplicação; RLS como defesa em profundidade

**Status:** Aceita · 18/08/2026 · Parcialmente substituída pela [ADR-0018](0018-a-primeira-operacao-sem-sessao.md)

## Contexto

O produto atende várias organizações na mesma instalação. Isso não é exigência do desafio: é adição nossa,
e a mais cara, porque multiplica a superfície de falha de autorização. O compromisso assumido junto com
ela foi que o isolamento viveria num ponto único de estrangulamento, e não espalhado pelas consultas.

A plataforma oferece Row Level Security do PostgreSQL, que é o mecanismo canônico para isso: políticas no
banco leem um claim do token e filtram as linhas. Um `select` esquecido não vaza dados.

O modelo de atores, porém, muda a conta. Uma pessoa pode ter vínculo em várias organizações, com papéis
diferentes, e nesse modelo *"a organização do usuário"* não existe como valor único no token: a
organização é escolha de navegação naquela requisição.

## Decisão

**O escopo de organização é aplicado na camada de aplicação**, em dois pontos e somente dois.

**Resolução, uma vez por requisição.** A camada de aplicação lê o usuário autenticado, busca o vínculo
ativo e monta o contexto com usuário, pessoa, organização e papel. É o único lugar do sistema que descobre
em qual organização se está operando, e mora na Aplicação porque resolver o contexto exige consultar o
banco, o que a Interface não faz.

**Um repositório base já escopado.** Nenhuma consulta é escrita com o filtro de organização repetido à
mão: quem consulta recebe repositórios montados a partir do contexto, e o filtro é aplicado numa função
só. O repositório é recebido, e não construído, pela Aplicação, como manda a
[ADR-0005](0005-regra-de-dependencia-por-inversao.md), e trocá-lo por um duplo em memória num teste passa
a ser passar outro argumento.

O que torna isso estrangulamento é mecânico: nada fora da camada de infraestrutura importa o cliente de
banco, e uma regra de lint recusa quem tentar.

**RLS fica ligada, com outra responsabilidade:** negar acesso direto do cliente ao banco, forçando todo
tráfego pelo servidor. Ela está ativa em todas as tabelas e sem política nenhuma, o que no PostgreSQL é
negação total.

| Mecanismo | Responde | Onde vive |
|---|---|---|
| Camada de aplicação | qual organização | código, testável sem banco |
| Row Level Security | quem pode falar com o banco | banco, negando o papel anônimo |

### As duas exceções, enumeradas

Duas escritas em tabela escopada acontecem sem que haja sessão de onde tirar a organização. Quem pede
entrada numa organização ainda não tem vínculo com ela, e quem cria uma organização está criando o próprio
escopo.

A regra que fecha isso vale como invariante do produto: o identificador da organização de uma escrita entra
resolvido da sessão, que é o caminho de todas as outras, ou produzido pela própria operação sob regra
declarada. Não há um terceiro.

| Operação | De onde vem a organização | O que a protege |
|---|---|---|
| Pedido de entrada | do Código da Organização apresentado na requisição | o código é a credencial daquela escrita e de nenhuma outra: código de uma não cria pedido em outra |
| Criação de organização | da organização que a própria operação acabou de criar | não há organização anterior a proteger |

A lista é fechada. Um terceiro endereço que precise escrever fora do funil exige alterar esta decisão, e é
o que mantém a exceção enumerável em vez de virar precedente. As duas têm caso de teste próprio, porque a
regra de lint não as alcança: as duas escritas são legítimas.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| RLS como mecanismo primário | Vínculos múltiplos por pessoa não cabem num claim único. Fazer funcionar exigiria reescrever o claim a cada troca de organização, que é frágil, ou uma política que consulta a tabela de vínculos a cada linha lida, que é cara |
| Filtro escrito em cada consulta | É o defeito que a decisão de multi-organização se comprometeu a evitar. Uma consulta esquecida vaza, e não há como garantir a cobertura por revisão |
| Um banco ou um esquema por organização | Isolamento mais forte que os dois, e inviável na franquia gratuita, que limita o número de projetos ativos. O custo de migração por organização também não cabe no prazo |
| Não atender várias organizações | Recusado por quem no time vive o problema, com o custo à vista |

## Consequências

**O que se ganha**

- Um ponto único para auditar, testar e revisar o isolamento.
- A mesma pessoa alternando entre organizações, com papel diferente em cada, funciona sem contorção.
- A garantia é exercida por teste sem banco, o que torna provável que o teste exista.
- A RLS ainda protege contra o pior caso da plataforma, que é o navegador falando direto com o banco.

**O que custa**

- **A garantia é do código, e não do banco.** Um caminho novo que ignore o repositório escopado vaza. A
  defesa é dupla: a Aplicação não tem o que importar para construir uma consulta crua, e a regra de lint é
  o alarme. Continua sendo o risco mais sério desta decisão, e por isso toda consulta nova passa pelo
  repositório escopado como portão de tarefa.
- **Acesso administrativo direto ao banco não tem isolamento.** Script de migração e consulta manual
  escapam. Num produto com dados reais isso exigiria RLS completa.
- **Trocar de organização vira operação explícita de sessão**, com custo de interface que uma aplicação de
  organização única não teria.
