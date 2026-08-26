# Resolve Aí — Plataforma de Gestão de Ocorrências

Onde um condomínio, uma empresa ou um bairro registra ocorrências — iluminação, vazamento, limpeza,
segurança, manutenção — e acompanha cada uma até a resolução, com **trilha auditável de toda mudança de
status**. Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha: o pedido chega como texto
solto, alguém transcreve à mão, e é justamente quando a ocorrência trava esperando por alguém que ela
desaparece.

Trabalho da **Fase 5** da pós-graduação em Full Stack Development da FIAP. Entrega em 29/09/2026.

## Estado do projeto

**A documentação está entregue, e o código começou pelo esqueleto de deploy.**

O que existe hoje: a esteira inteira de entrega — `docker compose` local, imagem publicada no `ghcr.io`,
revisão no Azure Container Apps —, com **um** endpoint (`GET /contexto`), as duas telas que ele sustenta
(entrar e "onde eu trabalho?"), as três tabelas de que ele depende, e as regras de fronteira da arquitetura
convertidas em configuração de `lint`. Ver **[Como rodar](#como-rodar)**.

O que ainda não existe: a `Ocorrência` e tudo que gira em volta dela — que são as próximas tarefas, e são
oito dos nove entregáveis do enunciado.

## O que está entregue

| Documento | O que responde |
|---|---|
| [Documentação da Demanda](docs/documentacao-da-demanda.md) | Quem são as pessoas, qual é o problema, o objetivo com métrica, e os requisitos — funcionais e não funcionais quantificados |
| [Escopo](docs/escopo.md) | O que o produto é, o que entra na primeira entrega, e o que ficou de fora com o motivo de cada corte |
| [Glossário](docs/glossario.md) | A linguagem ubíqua: uma definição por termo, e as colisões de vocabulário que ela resolve |
| [Arquitetura](docs/arquitetura.md) | Design estratégico de DDD e o Documento de Requisito Técnico da Solução |
| [Modelo de Dados](docs/modelo-de-dados.md) | O esquema em PostgreSQL, com cada índice justificado por uma consulta |
| [Contrato de API](docs/contrato-de-api.md) · [openapi.yaml](docs/api/openapi.yaml) | A superfície HTTP, e a especificação executável em OpenAPI 3.1 |
| [Fluxos e Diagramas](docs/fluxos-e-diagramas.md) | Os fluxos que o texto explica pior — e a lista do que decidimos **não** desenhar |
| [Inventário de Telas](docs/inventario-de-telas.md) | O que cada tela responde, o que oferece e qual endpoint chama |
| [Protótipo Low-Fi](docs/prototipo-low-fi.md) | A forma das telas, e o orçamento de tempo do requisito de registro em menos de um minuto |
| [Registros de Decisão (ADR)](docs/adr/) | As decisões de arquitetura, no formato Nygard — com as alternativas rejeitadas |
| [Premissas e Questões Abertas](docs/premissas-e-questoes-abertas.md) | O que assumimos sem confirmar, e o que muda se estiver errado |
| [Definition of Done e Definition of Ready](docs/definition-of-done.md) | Os dois portões de qualidade do projeto |

O índice comentado, com a ordem de leitura, está em **[docs/README.md](docs/README.md)**.

## Por onde começar

**Caminho curto** — a [narrativa da primeira entrega](docs/escopo.md#a-primeira-entrega-em-uma-passada),
na abertura do Escopo: o produto inteiro de ponta a ponta, e o que ele não faz. De lá, a
[Arquitetura](docs/arquitetura.md) e a [ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md),
que é a decisão que sustenta o resto.

**Caminho completo** — a ordem numerada de [docs/README.md](docs/README.md), que é a ordem em que os
documentos foram produzidos: cada um usa o anterior.

## O que define esta solução

**A auditabilidade é invariante, não convenção.** Ninguém de fora escreve `status`: a única porta são
comandos nomeados, e cada um grava o registro de transição na mesma operação. É impossível mudar o status
sem deixar rastro, porque não existe caminho de escrita que o permita ([ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md)).

**O isolamento entre organizações vive num ponto único.** Várias organizações na mesma instância, e o
escopo é aplicado numa função só — não espalhado pelas consultas, onde a próxima consulta esquecida
vazaria dados de outro condomínio ([ADR-0003](docs/adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)).

**O container que construímos é o que roda em produção** — não só o ambiente de
desenvolvimento ([ADR-0004](docs/adr/0004-execucao-em-container-no-azure.md)).

**Todo requisito carrega a origem.** `ENUNCIADO · literal` (o desafio define o quê **e** o como) ·
`ENUNCIADO · aberto` (a existência é imposta, a forma é nossa) · `NOSSO` (adição do projeto). É o que
torna o corte de escopo verificável em vez de opinativo: nenhum item `ENUNCIADO` ficou de fora, e todo o
corte recaiu sobre adições nossas.

## Como rodar

**O que já roda: o esqueleto de deploy.** Criar conta, entrar, e ver em qual organização você está — ou
que não está em nenhuma. Um endpoint (`GET /contexto`), duas telas (T-01 e T-02), três tabelas, e a
esteira inteira de `push` a container publicado. O resto do produto vem nas tarefas seguintes.

### O que precisa estar instalado

| Ferramenta | Para quê | Conferir com |
|---|---|---|
| **Node 24** | build, testes e verificadores | `node --version` |
| **Docker** | a aplicação em container (E7) | `docker compose version` |
| **Supabase CLI** | Postgres e autenticação locais | `supabase --version` |

### Subir o ambiente local, do zero

```bash
npm ci                              # dependências
npm run local                       # tudo o resto
```

`npm run local` faz, nesta ordem: `supabase start` (Postgres e Auth locais, em containers) → escreve o
`.env.local` a partir do `supabase status`, **se ele não existir** → cria o database `resolveai_teste`, da
suíte de integração, se ele não existir → `supabase migration up` → `docker compose up --build`, no **mesmo
`Dockerfile` que vai a produção**.

Depois: **<http://host.docker.internal:3000>**.

> ⚠️ **Abra por `host.docker.internal`, não por `localhost`.** O `@supabase/ssr` deriva o **nome do cookie
> de sessão do host do provedor**: com `127.0.0.1` ele grava `sb-127-auth-token`, com
> `host.docker.internal` grava `sb-host-auth-token`. Se o navegador falar do provedor por um nome e o
> container por outro, o cookie que o navegador guarda tem um nome que o servidor não procura — e a sessão
> simplesmente **não existe do lado de dentro**, sem erro nenhum. Em produção o problema não existe: os dois
> lados usam a mesma URL pública. Os detalhes estão em `.env.example`.

> ⚠️ **As portas locais do Supabase não são as padrão do CLI** (`54391` para a API, `54392` para o banco). O
> Windows reserva faixas de porta para o Hyper-V, e na máquina onde isto foi escrito a faixa reservada cobria
> as nove portas padrão. O motivo e como conferir a sua estão no cabeçalho de `supabase/config.toml`.

Sem Docker, para o laço curto de quem implementa: `npm run dev` — mas aí a URL do provedor é
`http://127.0.0.1:54391` no `.env.local`, e a aplicação abre em `http://127.0.0.1:3000`. Mesma regra: **um
nome de host só**.

### Verificar

```bash
npm run verificar                   # lint + tipos + teste unitário + os três verificadores de docs
npm run teste:integracao            # exige Postgres — é o critério A4 (organização A não vê dado de B)
```

Cada peça, separada:

| Comando | O que confere |
|---|---|
| `npm run lint` | **As três regras de fronteira da ADR-0006**, como configuração e não como parágrafo: nada fora de `infraestrutura/clientes/` importa um SDK; `infraestrutura/` só é importada por `composicao/`; importação só para dentro e só pela superfície pública do módulo |
| `npm run tipos` | `tsc --noEmit`, em modo estrito |
| `npm run teste` | Domínio e aplicação, **sem banco**, em segundos |
| `npm run teste:integracao` | O repositório escopado contra Postgres, no cenário da Persona 1B |
| `npm run verificar:mermaid` | Todo bloco Mermaid parseia — **com controle diferencial**: um diagrama que tem de ser recusado e o mesmo diagrama, consertado, que tem de passar |
| `npm run verificar:openapi` | As três regras mecânicas da §15 do contrato, mais `$ref` e `operationId` |
| `npm run verificar:referencias` | Todo link relativo resolve; todo `§N` existe |
| `npm run verificar:imagem` | **Nenhum segredo assado na imagem** — `ARG`, `.env` numa camada, variável no ambiente, nome ou chave dentro do pacote do navegador. Exige Docker, e por isso **não** está no `npm run verificar`; no pipeline ele roda **antes** do `push`, porque imagem publicada com segredo dentro não se desfaz |

**O teste de integração roda num database só dele, `resolveai_teste`**, criado pelo `npm run local`. Sem
`BANCO_URL_TESTE`, ele deriva do `BANCO_URL` trocando o database — e **recusa rodar** se o destino for o
mesmo banco onde você trabalha, porque a suíte derruba e recria as tabelas a cada execução.

### Publicar

Não há comando: **`merge` em `main` publica.** O `.github/workflows/entrega.yml` verifica, aplica as
migrações, constrói a imagem, publica no `ghcr.io` e cria uma revisão nova no Azure Container Apps — nessa
ordem, porque *o rollback da aplicação é imediato e o do banco não é*. Antes de qualquer publicação, a
esteira **sobe o `docker compose` num runner limpo e bate na aplicação por HTTP** — é a mesma `npm run
local` desta página, rodando numa máquina que nunca viu este projeto. É o que prova que não há estado local
escondido, e é por isso que essa conferência não depende de ninguém lembrar.

**Voltar atrás** é reapontar o tráfego para a revisão anterior do Container Apps: imediato, sem rebuild.
Migração destrutiva de esquema exige script de volta escrito à mão.

### O mapa das pastas de código

| Pasta | Camada | Regra |
|---|---|---|
| `app/` | Interface, metade externa | rotas e telas. **Não alcança `infraestrutura/` nem `composicao/`** |
| `src/interface/` | Interface, metade adaptadora | `http/` (o `comContexto`), `schemas/`, `projecoes/`, `acoes/`, `componentes/` |
| `src/aplicacao/` | Aplicação | **declara as portas** e recebe as implementações |
| `src/dominio/` | Domínio | as regras. Não persiste, não conhece HTTP |
| `src/infraestrutura/` | Infraestrutura | `clientes/` (o único lugar com SDK), `repositorios/`, `contexto/` (o ponto único de escopo) |
| `src/composicao/` | — | monta o grafo de objetos; não decide regra |
| `ferramentas/verificadores/` | — | os três verificadores de documentação |
| `supabase/migrations/` | — | o esquema, versionado |
| `testes/` | — | `dominio/` e `aplicacao/` sem banco; `integracao/` com |

A decisão está na [ADR-0006](docs/adr/0006-organizacao-de-modulos.md); as três regras de importação viram
configuração em `eslint.config.mjs`, com o comentário de cada uma no arquivo.

## Como este repositório está organizado

| Pasta | O que é | Está aqui? |
|---|---|---|
| `docs/` | Os entregáveis — é o que este README indexa | **sim** |
| `refs/` | Material de terceiros: o enunciado do desafio e as apostilas das aulas | não — não redistribuímos |
| `trabalho/` | O processo interno: depósito de ideias, decisões em andamento, curadoria do material do curso | não — é rascunho, não entrega |

Onde um documento cita uma decisão de produto por identificador (`D1` a `D27`), uma premissa (`P1` a `P5`)
ou um ponto de atenção (`PA-nn`), o conteúdo está em `docs/` — os identificadores são estáveis e
atravessam todos os documentos.

---

Projeto acadêmico, sem uso comercial. Cinco integrantes, um implementador.
