# ADR-0003 — Isolamento entre organizações na camada de aplicação; RLS como defesa em profundidade

**Status:** Aceita · 18/08/2026

## Contexto

O Resolve Aí atende várias organizações na mesma instância (D2, D3). Isso **não é requisito do
enunciado** — é adição nossa, e a mais cara do projeto, porque multiplica a superfície de falha de
autorização. O compromisso assumido junto com a decisão foi que o isolamento viveria num **único ponto
de estrangulamento**, não espalhado pelas consultas.

A plataforma escolhida (ADR-0002) oferece **Row Level Security** do PostgreSQL, que é o mecanismo
canônico para isso em Supabase: políticas no banco leem um claim do JWT e filtram as linhas. É
poderoso, e um `select` esquecido não vaza dados.

O modelo de atores, porém, tem uma característica que muda a conta. Pela **D4**, uma `Pessoa` pode ter
**vários `Vínculo`s**, em organizações diferentes e com papéis diferentes — e isso não é hipótese: é a
**Persona 1B**, o síndico profissional que responde por vários condomínios.

## Decisão

**O escopo de organização é aplicado na camada de aplicação**, em dois pontos e somente dois:

**1. Resolução — uma vez por requisição.** O handler que valida a sessão lê o usuário autenticado, busca
o vínculo ativo e monta um contexto: `{ usuarioId, pessoaId, organizacaoId, papel }`. É o **único lugar
do sistema que descobre em qual organização se está operando**.

**2. Aplicação — um repositório base.** Nenhuma consulta é escrita à mão com o filtro de organização
espalhado. Em vez de `db.ocorrencia.findMany({ where: { organizacaoId } })` repetido em dezenas de
lugares, existe `repos(ctx).ocorrencias.listar(filtros)`, onde `repos(ctx)` já vem escopado. **O filtro
é aplicado em uma função.**

O que torna isso estrangulamento e não boa intenção: **nada fora da camada de infraestrutura importa o
cliente de banco**, garantido por **regra de lint** — mecânica, não disciplinar. É a mesma lógica da
ADR-0001.

**RLS é ligada, com outra responsabilidade:** **negar acesso direto do cliente ao banco**, forçando todo
tráfego pelo servidor. A divisão fica:

| Mecanismo | Responde | Onde vive |
|---|---|---|
| Camada de aplicação | **qual organização** | Código, testável sem banco |
| RLS | **quem pode falar com o banco** | Banco, nega o papel anônimo |

Duas responsabilidades distintas, nenhuma sobreposta.

## Justificativa

**1. O argumento decisivo é o modelo de vínculos.** RLS filtra a partir de um claim do JWT. Mas se uma
Pessoa tem vínculo em várias organizações, **"o tenant do usuário" não existe como valor único no
token** — a organização é escolha de navegação naquela requisição, não atributo da pessoa. Fazer RLS
funcionar exigiria reescrever o claim a cada troca de organização, ou uma política que consulta a tabela
de vínculos a cada linha lida. O primeiro é frágil; o segundo é caro. **O modelo de atores da D4
praticamente elimina RLS como mecanismo primário.**

**2. Testabilidade.** Escopo em código é testável em memória, em milissegundos. Política de RLS exige
banco real e um usuário autenticado por caso de teste. Com um implementador e seis semanas, testes que
precisam de banco tendem a não ser escritos.

**3. Revisibilidade.** A regra em código aparece no diff do pull request e é legível por quem não a
escreveu. Política de RLS é difícil de revisar, e exige familiaridade com SQL que a revisão funcional do
projeto não pressupõe.

**4. Coerência com a ADR-0001.** Já decidimos que a regra de negócio vive no domínio e não no banco.
Colocar o isolamento no banco criaria duas filosofias no mesmo sistema.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **RLS como mecanismo primário** | O modelo de múltiplos vínculos por pessoa (D4) não cabe num claim único. Além disso: testes exigem banco real, e a regra fica em SQL, fora do alcance da revisão funcional |
| **Filtro por organização escrito em cada consulta** | É o anti-padrão que a D2 se comprometeu a evitar. Uma consulta esquecida vaza dados de outro condomínio, e não há como garantir a cobertura por revisão |
| **Um banco (ou schema) por organização** | Isolamento mais forte que qualquer um dos dois. Inviável no free tier — o Supabase permite 2 projetos ativos — e o custo de migração por tenant é incompatível com o prazo |
| **Não fazer multi-tenant** | Foi recomendado no início da descoberta e recusado pelo Domain Expert com o trade-off à vista. Registrado na D2 |

## Consequências

**Positivas**

- Um único ponto para auditar, testar e revisar o isolamento.
- Suporta nativamente a Persona 1B: a mesma pessoa alternando entre organizações, com papéis diferentes
  em cada.
- Testável sem banco, o que torna provável que os testes existam de fato.
- RLS ainda protege contra o pior caso da plataforma escolhida — o navegador falando direto com o banco
  pelo SDK do Supabase.

**Negativas e custos assumidos**

- **A garantia é do código, não do banco.** Um caminho novo que ignore o repositório base vaza. A defesa
  é a regra de lint; se ela for contornada, a proteção cai. **É o risco mais sério desta decisão** e
  precisa aparecer no Definition of Done: toda consulta nova passa pelo repositório escopado.
- **Acesso administrativo direto ao banco não tem isolamento nenhum.** Script de migração e consulta
  manual escapam. Aceito num MVP acadêmico; num produto real exigiria RLS completa.
- **Trocar de organização é operação explícita de sessão**, com uma tela ou seletor. É custo de interface
  que não existiria em single-tenant.
- **Multi-tenancy segue sem respaldo no material da disciplina** — nenhuma das 9 aulas de DDD toca no
  assunto. Tudo nesta ADR sobre tenancy é **[FONTE EXTERNA]** e se sustenta por mérito próprio, não por
  citação.

## Fontes

- **D2, D3, D4** — decisões de produto em `trabalho/produto/decisoes-de-produto.md`.
- **ADR-0001** — regra de negócio no domínio, não no banco; mesma lógica aplicada aqui.
- [FONTE EXTERNA] Multi-tenancy e RBAC não são cobertos por nenhuma das 9 aulas da disciplina.
