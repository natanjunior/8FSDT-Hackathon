---
title: "ADR-0003 · Isolamento entre organizações"
description: "O escopo aplicado num ponto único da camada de aplicação, e RLS como defesa em profundidade."
---

# ADR-0003 — Isolamento entre organizações na camada de aplicação; RLS como defesa em profundidade

**Status:** Aceita · 18/08/2026

## Contexto

O Resolve Aí atende várias organizações na mesma instância (decisões de produto D2 e D3). Isso não é
exigência do enunciado: é adição nossa, e a mais cara do projeto, porque multiplica a superfície de falha
de autorização. O compromisso assumido junto com a decisão foi que o isolamento viveria num **único ponto
de estrangulamento**, e não espalhado pelas consultas.

A plataforma escolhida na ADR-0002 oferece Row Level Security do PostgreSQL, que é o mecanismo canônico
para isso em Supabase: políticas no banco leem um claim do JWT e filtram as linhas. É poderoso, e um
`select` esquecido não vaza dados.

O modelo de atores, porém, tem uma característica que muda a conta. Pela decisão D4, uma `Pessoa` pode
ter vários `Vínculo`s, em organizações diferentes e com papéis diferentes. Não é hipótese: é a Persona
1B, o síndico profissional que responde por vários condomínios.

## Decisão

**O escopo de organização é aplicado na camada de aplicação**, em dois pontos e somente dois.

**1. Resolução, uma vez por requisição.** A camada de aplicação, invocada uma vez por requisição, lê o
usuário autenticado, busca o vínculo ativo e monta um contexto:
`{ usuarioId, pessoaId, organizacaoId, papel }`. É o único lugar do sistema que descobre em qual
organização se está operando. Note que o passo mora na Aplicação, e não na Interface: resolver o contexto
exige consultar `vinculos`, e a camada de Interface não toca o banco.

**2. Aplicação, um repositório base.** Nenhuma consulta é escrita à mão com o filtro de organização
espalhado. Em vez de `db.ocorrencia.findMany({ where: { organizacaoId } })` repetido em dezenas de
lugares, existe `repos(ctx).ocorrencias.listar(filtros)`, onde `repos(ctx)` já vem escopado. O filtro é
aplicado em uma função.

O repositório escopado é **recebido, e não construído** pela Aplicação. Ela declara a porta e recebe a
implementação, montada pelo route handler no anel externo, como manda a
[ADR-0005](0005-regra-de-dependencia-por-inversao.md). O que atravessa essa porta é agregado ou objeto de
leitura declarado, nunca linha de banco. Do ponto de vista de quem consulta continua sendo `repos(ctx)`,
e o filtro continua aplicado numa função só; o que muda é quem monta. O ganho está no teste: trocar o
repositório por um duplo em memória passa a ser passar outro argumento, em vez de interceptar um módulo.

O que torna isso estrangulamento em vez de boa intenção: nada fora da camada de infraestrutura importa o
cliente de banco, e isso é garantido por **regra de lint**, que é mecânica. É a mesma lógica da ADR-0001.

**RLS fica ligada, com outra responsabilidade:** negar acesso direto do cliente ao banco, forçando todo
tráfego pelo servidor. A divisão fica assim:

| Mecanismo | Responde | Onde vive |
|---|---|---|
| Camada de aplicação | qual organização | Código, testável sem banco |
| RLS | quem pode falar com o banco | Banco, nega o papel anônimo |

Duas responsabilidades distintas, nenhuma sobreposta.

### As duas exceções, enumeradas

Há duas escritas em tabela escopada que acontecem sem que haja sessão de onde tirar a organização. Quem
pede entrada numa Organização ainda não tem vínculo com ela, e quem cria uma Organização está criando o
próprio escopo. Deixar de dizer de onde vem o `organizacao_id` nesses dois casos abriria na garantia de
isolamento o buraco que esta ADR existe para fechar.

A regra que fecha isso, e que vale como invariante do produto:

> O `organizacao_id` de uma escrita entra por um de dois caminhos, e não existe um terceiro: resolvido da
> sessão, que é o caminho normal de todas as outras escritas, ou produzido pela própria operação sob
> regra declarada. As operações com essa licença são duas.

| Operação | De onde vem o `organizacao_id` | O que o protege |
|---|---|---|
| `POST /pedidos-de-entrada` | Do Código da Organização apresentado na requisição, resolvido para uma Organização. O código é a credencial daquela escrita e de nenhuma outra | O pedido só pode nascer na Organização cujo código foi apresentado. Código de A não cria pedido em B |
| `POST /organizacoes` | Da Organização que a própria operação acabou de criar. As escritas seguintes, o vínculo do Gestor inicial e as sementes da POL-01, usam esse identificador | Não há Organização anterior a proteger: a operação é o nascimento do escopo |

A lista é fechada. Um terceiro endpoint que precise escrever fora do funil não é caso a resolver no
código: exige alterar esta ADR. É o que mantém a exceção enumerável em vez de virar precedente.

**Verificação:** o critério A4 da `arquitetura.md` ganha um caso próprio, o de que pedido de entrada
criado com o código da Organização A não produz linha escopada em B. É teste, e não revisão: a regra de
lint não alcança este caso, porque as duas escritas são legítimas.

## Justificativa

**1. O argumento decisivo é o modelo de vínculos.** RLS filtra a partir de um claim do JWT. Mas se uma
Pessoa tem vínculo em várias organizações, "o tenant do usuário" não existe como valor único no token:
a organização é escolha de navegação naquela requisição, e não atributo da pessoa. Fazer RLS funcionar
exigiria reescrever o claim a cada troca de organização, ou uma política que consulta a tabela de
vínculos a cada linha lida. O primeiro caminho é frágil; o segundo é caro. O modelo de atores da D4
praticamente elimina RLS como mecanismo primário.

**2. Testabilidade.** Escopo em código é testável em memória, em milissegundos. Política de RLS exige
banco real e um usuário autenticado por caso de teste. Com um implementador e seis semanas, testes que
precisam de banco tendem a não ser escritos.

**3. Revisibilidade.** A regra em código aparece no diff do pull request e é legível por quem não a
escreveu. Política de RLS é difícil de revisar, e exige familiaridade com SQL que a revisão funcional do
projeto não pressupõe.

**4. Coerência com a ADR-0001.** Já ficou decidido que a regra de negócio vive no domínio e não no banco.
Colocar o isolamento no banco criaria duas filosofias no mesmo sistema.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| RLS como mecanismo primário | O modelo de múltiplos vínculos por pessoa não cabe num claim único. Além disso, os testes exigem banco real, e a regra fica em SQL, fora do alcance da revisão funcional |
| Filtro por organização escrito em cada consulta | É o anti-padrão que a decisão D2 se comprometeu a evitar. Uma consulta esquecida vaza dados de outro condomínio, e não há como garantir a cobertura por revisão |
| Um banco ou schema por organização | Isolamento mais forte que qualquer um dos dois. Inviável no free tier, que permite dois projetos ativos, e o custo de migração por organização é incompatível com o prazo |
| Não fazer multi-organização | Foi recomendado no início da descoberta e recusado pelo integrante do time que vive o problema, com o custo à vista. Registrado na decisão D2 |

## Consequências

**Positivas**

- Um único ponto para auditar, testar e revisar o isolamento.
- Suporta nativamente a Persona 1B: a mesma pessoa alternando entre organizações, com papéis diferentes
  em cada.
- Testável sem banco, o que torna provável que os testes existam de fato.
- RLS ainda protege contra o pior caso da plataforma escolhida, o navegador falando direto com o banco
  pelo SDK do Supabase.

**Negativas e custos assumidos**

- **A garantia é do código, e não do banco.** Um caminho novo que ignore o repositório base vaza. A
  defesa é dupla: estrutural, porque a Aplicação não tem o que importar para construir uma consulta crua
  ([ADR-0005](0005-regra-de-dependencia-por-inversao.md)), e mecânica, pela regra de lint, que é o
  alarme. Continua sendo o risco mais sério desta decisão, e continua precisando aparecer no Definition
  of Done: toda consulta nova passa pelo repositório escopado.
- **Acesso administrativo direto ao banco não tem isolamento nenhum.** Script de migração e consulta
  manual escapam. Aceito num MVP acadêmico; num produto real exigiria RLS completa.
- **Trocar de organização é operação explícita de sessão**, com uma tela ou seletor. É custo de interface
  que não existiria numa aplicação de organização única.
- **Multi-organização é a parte do projeto com menos precedente pronto para copiar.** Tudo nesta ADR
  sobre o assunto se sustenta por mérito próprio, e foi conferido contra o modelo de atores real do
  produto em vez de contra um padrão de prateleira.
