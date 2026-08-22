-- ============================================================================
--  Migração 001 — `pessoas`, `organizacoes`, `vinculos`
--
--  As três tabelas que `GET /contexto` exige, e os tipos que elas exigem.
--  Fonte: `docs/modelo-de-dados.md` §2 (convenções), §5 (tipos), §6.2, §6.3,
--  §6.4 e §9 (integração com o Supabase Auth).
--
--  Convenções aplicadas, com a seção que as decide:
--    §2.1  nomes em pt-BR, snake_case, sem acento; tabela no plural
--    §2.2  UUID onde a linha tem identidade própria; chave natural composta
--          onde a linha *é* a relação — `vinculos` é o segundo caso
--    §2.3  TIMESTAMPTZ, nunca TIMESTAMP: a nuvem roda em UTC e o usuário em BRT
--    §2.4  conjunto fechado vira ENUM
--    §2.5  ON DELETE RESTRICT é o padrão; a única exceção é o SET NULL da LGPD
--    §2.7  VARCHAR(n) onde existe limite de negócio, TEXT onde não existe
--    §2.9  em tabela escopada, `organizacao_id` é a primeira coluna do índice
--          de listagem
--
--  Duas ausências deliberadas, e as duas estão declaradas no relatório desta
--  tarefa:
--
--  1. `vinculos.area_id` **não entra aqui.** A coluna existe no modelo (§6.4) e
--     a sua chave estrangeira é composta para `areas (id, organizacao_id)` —
--     tabela que esta migração não cria. As duas opções eram uma coluna `uuid`
--     solta sem FK (que é exatamente o que o §1 do modelo usa para justificar
--     relacional) ou esperar. Ela entra na migração que cria `areas`, **junto
--     com a sua FK**, e nesta fatia nada a escreveria: o corpo de
--     `POST /pedidos-de-entrada` não tem esse campo, e o endpoint não existe.
--
--  2. **Não há gatilho de `atualizado_em`.** Nenhum documento do pacote decide
--     se o relógio de atualização é mantido pelo banco ou pela aplicação. Como
--     nesta fatia não existe UPDATE em nenhuma das três tabelas, a decisão não
--     precisa ser tomada agora — e tomá-la em silêncio, num esquema cuja razão
--     de existir é auditabilidade, seria pior. Fica como questão ao hub.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos (modelo §5)
--
-- `papel_vinculo` é o único dos catorze tipos que estas três tabelas exigem.
-- ENUM em vez de `VARCHAR + CHECK` porque um CHECK por coluna é um CHECK a
-- manter em sincronia, e um deles desatualizado é como um valor inválido entra
-- na trilha. Os valores são a grafia técnica, sem acento (§2.4).
-- ----------------------------------------------------------------------------

create type papel_vinculo as enum ('gestor', 'solicitante', 'encarregado');

comment on type papel_vinculo is
  'O que a Pessoa é dentro de uma Organização. D4, D27. Solicitante, Gestor e Encarregado são os nomes '
  'do domínio; estes são a grafia técnica deles.';

-- ----------------------------------------------------------------------------
-- `pessoas` — o agregado `Pessoa` · GLOBAL (modelo §6.2)
--
-- Quatro colunas e dois relógios. `pessoas` guarda como a pessoa é chamada, se
-- ela consegue entrar, e se foi anonimizada. Nada mais (§6.2.1).
--
-- **Tabela global: não tem `organizacao_id`, e portanto não há filtro que o
-- repositório possa aplicar nela.** É por isso que nenhuma listagem parte
-- daqui — toda listagem de gente é listagem de `Vínculo` (§4.3, contrato §4.6).
-- ----------------------------------------------------------------------------

create table pessoas (
  id              uuid          primary key default gen_random_uuid(),

  -- Anulável de propósito: `Pessoa` existe sem `Usuário` — o Encarregado sem
  -- conta (D4), a importação em lote, a Pessoa criada pelo Gestor antes do
  -- convite. Ver §9.1.
  usuario_id      uuid,

  nome            varchar(120)  not null,
  anonimizada_em  timestamptz,
  criado_em       timestamptz   not null default now(),
  atualizado_em   timestamptz   not null default now(),

  -- Implementa o `0..1` por Pessoa. No PostgreSQL os NULLs são distintos entre
  -- si num índice único, então N pessoas sem conta convivem sem conflito.
  constraint pessoas_usuario_uk unique (usuario_id),

  -- **A única exceção ao RESTRICT do §2.5**, e é o mecanismo do RNF10 (§10):
  -- apagar a conta não apaga a Pessoa, e portanto não apaga a trilha.
  constraint pessoas_usuario_fk
    foreign key (usuario_id) references auth.users (id) on delete set null,

  -- Pessoa anonimizada não tem conta. Este CHECK **encolheu** em 22/08/2026,
  -- quando o contato saiu daqui para a tabela `contatos`: ele garantia, numa
  -- linha só, que Pessoa anonimizada não carregava contato, e CHECK no
  -- PostgreSQL só vê a própria linha. O rebaixamento está declarado no §6.2 do
  -- modelo, e a garantia é reconstruída no comando de anonimização e num
  -- gatilho sobre `contatos` — nenhum dos dois nesta fatia.
  constraint pessoas_anonimizada_sem_conta_ck
    check (anonimizada_em is null or usuario_id is null)
);

comment on table pessoas is
  'O agregado Pessoa. GLOBAL: não tem organizacao_id. Toda consulta de gente parte de vinculos '
  '(modelo §4.3, contrato §4.6) — uma listagem que partisse daqui devolveria o cadastro do sistema inteiro.';

comment on column pessoas.usuario_id is
  'FK para auth.users. auth.users É o agregado Usuário: não existe tabela usuarios nossa, e nenhuma '
  'coluna nossa guarda senha, hash, token ou fator de autenticação (modelo §9).';

-- **A consulta mais frequente do sistema inteiro** (modelo §6.2): resolver a
-- sessão em Pessoa, uma vez por requisição (ADR-0003, ponto 1). Servida pelo
-- índice único de `usuario_id` acima — nenhum índice adicional.
--
-- Índice deliberadamente não criado: nenhum em `nome`. Um índice global aqui só
-- serviria a uma consulta que não deve existir.

-- ----------------------------------------------------------------------------
-- `organizacoes` — o agregado `Organização` (o tenant) · modelo §6.3
--
-- É o limite de isolamento de dados (D2, D3, ADR-0003).
-- ----------------------------------------------------------------------------

create table organizacoes (
  id                          uuid         primary key default gen_random_uuid(),
  nome                        varchar(120) not null collate "pt-BR-x-icu",
  codigo_publico              varchar(12)  not null,

  -- `collate` em `nome` pela §2.10: a face D de T-02 lista organizações por
  -- esta coluna, e em collation C ou en_US "Água Branca" ordenaria DEPOIS de
  -- "Zona Sul". A convenção cobria `categorias.nome` e `areas.nome` e deixou
  -- esta de fora — é o tipo de defeito que só aparece na demonstração, com a
  -- lista fora de ordem na frente de quem avalia.
  --
  -- Caminho de volta, se o ICU não existir no servidor: `pt_BR.utf8`. Confira
  -- com `select collname from pg_collation where collname like 'pt%'`.


  -- `nome` + `logo_caminho` **são** o whitelabel da D25 — não há tabela para
  -- dois campos. TEXT por escolha dita (§2.7): é chave gerada por máquina, cujo
  -- tamanho o provedor decide.
  --
  -- ⚠️ Limitação declarada (modelo §6.3): esta coluna é uma chave de storage
  -- **fora** do mecanismo de storage — não é opaca por CHECK, não nasce
  -- pendente, não é reivindicada e não é recolhida pela faxina. Fica assim
  -- porque **nada escreve nela hoje**: não existe `PATCH /organizacao` na
  -- primeira entrega. Quando a logo entrar, ela vira uma linha em `anexos`.
  logo_caminho                text,

  -- O interruptor por organização da D22. Evolução prevista, e custa uma coluna
  -- em vez de uma migração depois.
  exigir_solucao_ao_resolver  boolean      not null default false,

  -- Quem criou esta Organização (D26). Anulável de propósito: organizações
  -- semeadas em ambiente de teste não têm criador.
  criada_por_pessoa_id        uuid,

  criado_em                   timestamptz  not null default now(),
  atualizado_em               timestamptz  not null default now(),

  -- **Global, não por organização**: o código é digitado sem contexto nenhum
  -- (D25, caminho "código digitado"), então precisa identificar uma organização
  -- sozinho. É uma das exceções nomeadas da §2.9.
  constraint organizacoes_codigo_publico_uk unique (codigo_publico),

  -- Sem minúscula e sem caractere ambíguo, porque o código vive em cartaz de
  -- elevador e é digitado à mão.
  constraint organizacoes_codigo_publico_ck
    check (codigo_publico ~ '^[A-Z0-9]{6,12}$')
);

comment on table organizacoes is
  'O agregado Organização — o condomínio, a empresa ou o bairro. É o limite de isolamento de dados '
  '(D2, D3, ADR-0003) e o cliente do produto.';

comment on column organizacoes.codigo_publico is
  'O código do cartaz do elevador. Público por natureza: quem o usa abre um Pedido de entrada, não um '
  'acesso. Gerado pelo servidor, nunca aceito no corpo (contrato §8.1).';

-- Índices: só a PK e o único de `codigo_publico`, que serve a `where
-- codigo_publico = $1`. Com 50 organizações (RNF3), a aula 3 é explícita:
-- tabelas com menos de 1000 linhas geralmente não precisam de índices.

-- ----------------------------------------------------------------------------
-- `vinculos` — o `Vínculo` (Pessoa + Papel + Organização) · modelo §6.4
--
-- **A única ponte entre o mundo global (`pessoas`) e o mundo escopado.**
-- ----------------------------------------------------------------------------

create table vinculos (
  pessoa_id       uuid          not null,
  organizacao_id  uuid          not null,
  papel           papel_vinculo not null,
  criado_em       timestamptz   not null default now(),

  -- **Revogar não apaga.** É o que permite que as FKs compostas continuem
  -- válidas para toda a trilha escrita por alguém que depois saiu (§6.4).
  revogado_em     timestamptz,

  -- Chave natural (§2.2): a linha não tem identidade fora do par que a define.
  -- **É também a restrição de unicidade que todas as FKs compostas do esquema
  -- referenciam** (§4.2) — inclusive a de `organizacoes` abaixo.
  --
  -- 🔗 Esta chave depende de uma decisão de arquitetura, e não é óbvio que
  -- dependa: a autorização é orientada a **permissão**, não a papel
  -- (`vinculo.pode(X)`, nunca `vinculo.papel == GESTOR`). Se fosse por papel, o
  -- síndico que mora no prédio precisaria de um segundo vínculo — que é
  -- exatamente o que esta chave proíbe.
  constraint vinculos_pk primary key (pessoa_id, organizacao_id),

  constraint vinculos_pessoa_fk
    foreign key (pessoa_id) references pessoas (id) on delete restrict,

  constraint vinculos_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict
);

comment on table vinculos is
  'O Vínculo: o que uma Pessoa é dentro de uma Organização. Um vínculo por Pessoa por Organização '
  '(confirmado em 20/08/2026). É a única ponte entre pessoas (global) e o mundo escopado.';

comment on column vinculos.revogado_em is
  'Revogar não apaga. Limitação declarada: não há histórico de vínculo — readmitir exige limpar esta '
  'coluna, e com isso desaparece o registro de que houve revogação. É perda de histórico administrativo, '
  'não de auditoria de domínio (modelo §6.4).';

-- "Quem são os Gestores desta organização" — participantes do canal 1, alvo de
-- notificação, e a lista de pessoas a quem atribuir. Índice **parcial**: só as
-- linhas ativas entram, e as revogadas nunca são listadas. `organizacao_id`
-- primeiro, pela §2.9.
create index vinculos_organizacao_papel_ix
  on vinculos (organizacao_id, papel)
  where revogado_em is null;

-- ----------------------------------------------------------------------------
-- A FK do ovo-e-galinha (modelo §6.3)
--
-- A organização é inserida **antes** do vínculo — o vínculo precisa do
-- `organizacao_id` para existir. Uma FK comum recusaria o INSERT da
-- organização, porque o vínculo alvo ainda não existe.
--
-- `DEFERRABLE INITIALLY DEFERRED` adia a verificação para o COMMIT, e as duas
-- inserções já estão na mesma transação (a POL-01 cria organização, vínculo,
-- categorias-semente e áreas-semente juntas). A alternativa era uma FK direta
-- para `pessoas`, que criaria a **terceira** exceção à §4.2 num documento que
-- afirma haver exatamente duas.
--
-- ⚠️ Custo declarado: FK diferida move o erro do INSERT para o COMMIT, o que
-- piora a mensagem quando algo dá errado — e exige que quem escreve a migração
-- **não** a declare como FK normal por hábito. Está escrita aqui de propósito,
-- separada, para que a próxima pessoa veja a decisão em vez de a herdar.
-- ----------------------------------------------------------------------------

alter table organizacoes
  add constraint organizacoes_criada_por_vinculo_fk
    foreign key (criada_por_pessoa_id, id)
    references vinculos (pessoa_id, organizacao_id)
    deferrable initially deferred;

-- ----------------------------------------------------------------------------
-- Row Level Security (ADR-0003)
--
-- **RLS é ligada, com outra responsabilidade que não a de isolar organizações.**
-- A divisão da ADR-0003:
--
--   | Mecanismo            | Responde              | Onde vive               |
--   |----------------------|-----------------------|-------------------------|
--   | Camada de aplicação  | **qual** organização  | Código, testável        |
--   | RLS                  | **quem** pode falar   | Banco, nega o anônimo   |
--
-- Duas responsabilidades distintas, nenhuma sobreposta. RLS aqui protege contra
-- o pior caso da plataforma: o navegador falando direto com o banco pelo SDK.
--
-- **Ligada e sem política nenhuma, de propósito.** No PostgreSQL, RLS ativa sem
-- política é negação total: os papéis `anon` e `authenticated` não leem nem
-- escrevem linha alguma. Quem fala com estas tabelas é o servidor, pela conexão
-- do §9 — e nela o isolamento por organização é aplicado em código, no ponto
-- único da ADR-0003.
--
-- Consequência já declarada na ADR: **acesso administrativo direto ao banco não
-- tem isolamento nenhum.** Script de migração e consulta manual escapam.
-- Aceito num MVP acadêmico.
-- ----------------------------------------------------------------------------

alter table pessoas      enable row level security;
alter table organizacoes enable row level security;
alter table vinculos     enable row level security;
