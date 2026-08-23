-- ============================================================================
--  Migração 003 — `pedidos_de_entrada` e `contatos`
--
--  As duas tabelas que `POST /pedidos-de-entrada` exige, e os três tipos que
--  elas exigem.
--  Fonte: `docs/modelo-de-dados.md` §6.15 (pedido), §6.17 (contatos), §5
--  (tipos) e §2 (convenções).
--
--  **`contatos` sobe inteira, e o único caminho que a escreve nesta fatia é o
--  telefone opcional do pedido de entrada** — o `contatos[]` de `/vinculos`, a
--  substituição e o `409 CONTATO_DUPLICADO` são do item 9b. Meia tabela custa
--  uma segunda migração alterando a mesma tabela e deixa sem dono, no
--  intervalo, garantias que o próprio modelo conta terem nascido de uma perda:
--  o `UNIQUE (pessoa_id, ordem)` da §6.17 existe porque, ao trocar
--  `principal boolean` por `ordem`, a garantia não veio junto.
--
--  Uma ausência deliberada, e ela é herdada: **continua não havendo gatilho de
--  `atualizado_em`**. A migração 001 deixou a questão ao hub declarando que
--  "nesta fatia não existe UPDATE em nenhuma das três tabelas". **Nesta fatia
--  existe** — `pessoas.nome`, corrigido pelo pedido de entrada —, e quem o
--  escreve é a aplicação, explicitamente, no mesmo `update`. Isso responde o
--  caso, não a regra: a questão do hub continua aberta para as outras tabelas,
--  e está no relatório.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos (modelo §5)
-- ----------------------------------------------------------------------------

create type situacao_pedido_entrada as enum ('pendente', 'aprovado', 'recusado');

comment on type situacao_pedido_entrada is
  'Em que pé está o Pedido de entrada. D25: o Vínculo só passa a existir com aprovação do Gestor, então '
  'estas três situações são o ciclo inteiro do pedido — e nenhuma delas é um vínculo.';

create type tipo_contato as enum ('email', 'telefone');

comment on type tipo_contato is
  'O `system` do ContactPoint do HL7 FHIR, podado ao que o produto alcança (modelo §6.17). Sete valores '
  'para um produto que alcança dois seria valor de enum sem produtor, que é promessa.';

create type finalidade_contato as enum ('pessoal', 'trabalho', 'recado');

comment on type finalidade_contato is
  'O `use` do FHIR, traduzido. `mobile` era característica do número e virou `tem_whatsapp`; `old` era '
  'vigência, e foi recusada (modelo §6.17).';

-- ----------------------------------------------------------------------------
-- `pedidos_de_entrada` — o `Pedido de entrada` (modelo §6.15)
--
-- **Escopada, e com a exceção da §4.2 declarada:** `pessoa_id` aponta direto
-- para `pessoas`, e não para `vinculos`, porque o pedido existe *antes* de o
-- vínculo existir — "o Vínculo só passa a existir com aprovação do Gestor"
-- (D25). São dois os pontos do esquema com essa licença; este é um deles.
-- ----------------------------------------------------------------------------

create table pedidos_de_entrada (
  id                      uuid                    not null default gen_random_uuid(),
  organizacao_id          uuid                    not null,
  pessoa_id               uuid                    not null,
  situacao                situacao_pedido_entrada not null default 'pendente',

  -- Só a recusa tem o que justificar, e o CHECK abaixo amarra as duas coisas.
  -- Sem ele a coluna viraria campo de anotação livre sobre pedido aberto, que
  -- é outra funcionalidade e não foi decidida (modelo §6.15).
  observacao              varchar(500),

  criado_em               timestamptz             not null default now(),
  decidido_em             timestamptz,
  decidido_por_pessoa_id  uuid,

  constraint pedidos_de_entrada_pk primary key (id),

  constraint pedidos_de_entrada_organizacao_fk
    foreign key (organizacao_id) references organizacoes (id) on delete restrict,

  -- A exceção da §4.2, e a razão dela está no cabeçalho desta tabela.
  constraint pedidos_de_entrada_pessoa_fk
    foreign key (pessoa_id) references pessoas (id) on delete restrict,

  -- Quem decidiu é um Gestor **desta** organização. FK composta, no padrão da
  -- §4.2 — e ela é satisfeita quando a coluna é nula, porque MATCH SIMPLE não
  -- verifica par com nulo. É o que permite que a linha nasça sem decisor.
  constraint pedidos_de_entrada_decisor_fk
    foreign key (decidido_por_pessoa_id, organizacao_id)
    references vinculos (pessoa_id, organizacao_id) on delete restrict,

  constraint pedidos_de_entrada_decisao_ck
    check ((situacao = 'pendente') = (decidido_em is null)),

  constraint pedidos_de_entrada_ordem_temporal_ck
    check (decidido_em is null or decidido_em >= criado_em),

  constraint pedidos_de_entrada_observacao_ck
    check (observacao is null or situacao = 'recusado')
);

comment on table pedidos_de_entrada is
  'O pedido de quem entrou com o Código da Organização e ainda não foi aprovado. Termo do glossário desde '
  '20/08/2026, e não se confunde com Convite, que dispensa aprovação. "Código vazado não vira acesso: '
  'vira um pedido aguardando aprovação" (D25).';

comment on column pedidos_de_entrada.observacao is
  'A frase do Gestor ao recusar. Existe porque é a única explicação possível de por que alguém não '
  'entrou; mostrá-la a quem foi recusado é decisão de produto ainda em aberto (modelo §6.15).';

-- **É este índice que produz o `409 PEDIDO_DE_ENTRADA_PENDENTE`.** Um pedido
-- pendente por Pessoa por Organização; pedido recusado **pode ser refeito**,
-- que é a suposição S4 do modelo e o que o `WHERE` deixa passar.
create unique index pedidos_de_entrada_pendente_uk
  on pedidos_de_entrada (pessoa_id, organizacao_id)
  where situacao = 'pendente';

-- "Os pedidos que eu preciso decidir" — o Gestor em T-08. Índice parcial, e a
-- seletividade é ótima: o normal é a tabela ter quase só linhas decididas.
-- **Sem consumidor até o item 8**, e entra junto porque é da mesma tabela.
create index pedidos_de_entrada_pendentes_ix
  on pedidos_de_entrada (organizacao_id, criado_em)
  where situacao = 'pendente';

-- ⚠️ **Índice que a §6.15 não declara, e a razão está no plano do item 7a.**
-- `GET /contexto` passa a devolver `pedidosDeEntrada[]`, e a consulta é por
-- `pessoa_id` — em **toda** requisição do sistema. A §6.15 só previu o
-- consumidor do Gestor, que é por `organizacao_id`. Sem este índice, a consulta
-- mais frequente do produto varre a tabela. Registrado como achado ao hub.
create index pedidos_de_entrada_da_pessoa_ix
  on pedidos_de_entrada (pessoa_id, criado_em desc);

-- ----------------------------------------------------------------------------
-- `contatos` — como se alcança uma Pessoa · GLOBAL (modelo §6.17)
--
-- Substituiu `pessoas.email_contato` e `pessoas.telefone` em 22/08/2026, e o
-- desenho segue o `ContactPoint` do HL7 FHIR [FONTE EXTERNA]: três elementos
-- adotados, um traduzido, um recusado.
--
-- **Global, como `pessoas`:** não tem `organizacao_id`, e portanto não há
-- escopo a aplicar. É por isso que `GET /vinculos` **não** devolve `contatos[]`
-- de outra organização — quem o impede é o contrato, não esta tabela.
-- ----------------------------------------------------------------------------

create table contatos (
  id             uuid               not null default gen_random_uuid(),
  pessoa_id      uuid               not null,
  tipo           tipo_contato       not null,
  valor          varchar(255)       not null,
  finalidade     finalidade_contato not null default 'pessoal',
  tem_whatsapp   boolean            not null default false,

  -- `ordem` é o significado, não enfeite: 1 é para onde se liga primeiro, e a
  -- lista **é** a cadeia de tentativa (contrato §8.2).
  ordem          smallint           not null default 1,

  observacao     varchar(200),
  criado_em      timestamptz        not null default now(),
  atualizado_em  timestamptz        not null default now(),

  constraint contatos_pk primary key (id),

  -- **A única CASCADE do esquema.** Contato não sobrevive à Pessoa: não é
  -- histórico, é endereço (modelo §6.17).
  constraint contatos_pessoa_fk
    foreign key (pessoa_id) references pessoas (id) on delete cascade,

  -- O mesmo número duas vezes na mesma pessoa é ruído, não dado.
  constraint contatos_par_uk unique (pessoa_id, tipo, valor),

  -- Sem esta, dois contatos empatam em 1 e a tela apresenta **empate como
  -- preferência**. Nasceu de uma garantia perdida ao trocar de mecanismo.
  constraint contatos_ordem_uk unique (pessoa_id, ordem),

  constraint contatos_ordem_ck check (ordem >= 1),

  -- WhatsApp é indicação sobre um número, e o banco recusa marcá-la num e-mail.
  constraint contatos_whatsapp_ck check (tem_whatsapp = false or tipo = 'telefone'),

  -- E.164. O CHECK aceita qualquer país; **quem escreve só produz números
  -- brasileiros**, e a consequência está declarada no modelo: número
  -- estrangeiro não é registrável nesta entrega. A coluna aceita; o formulário
  -- não produz — que é a razão de o CHECK ser E.164 completo e não `^\+55`.
  constraint contatos_telefone_e164_ck
    check (tipo <> 'telefone' or valor ~ '^\+[1-9][0-9]{7,14}$'),

  -- Forma mínima. Validação de e-mail de verdade é da aplicação; aqui é só a
  -- garantia de que não entrou um telefone no campo errado.
  constraint contatos_email_forma_ck
    check (tipo <> 'email' or valor like '%_@_%.__%')
);

comment on table contatos is
  'Por onde se alcança uma Pessoa, com finalidade, ordem de preferência e a indicação de WhatsApp. '
  'Global, como pessoas. Nesta fatia o único produtor é o telefone opcional de POST /pedidos-de-entrada; '
  'o sub-formulário de T-08 é o item 9b.';

comment on column contatos.ordem is
  'Cadeia de tentativa: 1 é para onde se liga primeiro. Não há caixa de "contato preferido" — a ordem é '
  'a preferência (contrato §8.2).';

-- **Nenhum índice a mais.** `UNIQUE (pessoa_id, ordem)` já cria um índice em
-- exatamente essas colunas, nessa ordem — um `create index` sobre o mesmo par
-- seria uma segunda B-tree mantida a cada escrita para servir a consulta que a
-- primeira já serve.

-- ----------------------------------------------------------------------------
-- Row Level Security (ADR-0003)
--
-- **Ligada e sem política nenhuma**, como as três da 001: RLS ativa sem
-- política é negação total, e quem fala com estas tabelas é o servidor, pela
-- conexão do §9. O isolamento por organização é aplicado em código, no ponto
-- único da ADR-0003.
-- ----------------------------------------------------------------------------

alter table pedidos_de_entrada enable row level security;
alter table contatos           enable row level security;
