# Resolve Aí — Plataforma de Gestão de Ocorrências

Onde um condomínio, uma empresa ou um bairro registra ocorrências — iluminação, vazamento, limpeza,
segurança, manutenção — e acompanha cada uma até a resolução, com **trilha auditável de toda mudança de
status**. Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha: o pedido chega como texto
solto, alguém transcreve à mão, e é justamente quando a ocorrência trava esperando por alguém que ela
desaparece.

Trabalho da **Fase 5** da pós-graduação em Full Stack Development da FIAP. Entrega em 29/09/2026.

## Estado do projeto

**O produto está de pé e publicado, e o pacote de documentação está entregue.**

O ciclo de vida da ocorrência roda inteiro — registrar, analisar, atribuir, atender, pausar, retomar,
resolver, avaliar, cancelar —, cada transição deixando registro na trilha, e o isolamento entre
organizações passa por um ponto único. Ver **[O que está entregue](#o-que-está-entregue)** e
**[Como rodar](#como-rodar)**.

**O ambiente publicado:**
<https://ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io> — as contas para entrar
nele estão em **[A demonstração](#a-demonstração)**.

**O que ainda não existe é o que o [Escopo](docs/escopo.md) corta em letra, com o motivo de cada corte:**
o acesso próprio do Encarregado e as capacidades que caem junto com ele, o convite por link, a nota interna
e a conversa privada da atribuição, as notificações, a leitura sem rede. **Nenhum item `ENUNCIADO` ficou de
fora** — todo o corte recaiu sobre adições nossas.

> ### Corrigido em 30/08/2026 — este bloco descrevia o repositório de três sprints atrás
>
> **A redação anterior era:** *"A documentação está entregue, e o código começou pelo esqueleto de deploy.
> O que existe hoje: a esteira inteira de entrega … com **um** endpoint (`GET /contexto`), as duas telas
> que ele sustenta (entrar e 'onde eu trabalho?'), as três tabelas de que ele depende … O que ainda não
> existe: a `Ocorrência` e tudo que gira em volta dela — que são as próximas tarefas, e são **oito dos nove
> entregáveis** do enunciado."*
>
> **Nenhuma dessas afirmações vale mais**, e nenhuma delas errava por pouco: são **37 operações HTTP em
> 30 caminhos**, **treze telas**, **catorze tabelas** e a `Ocorrência` com o agregado, a máquina de estados
> e a trilha imutável. Os seis itens de fundação técnica do [Escopo](docs/escopo.md) — o agregado, o
> isolamento, o contêiner, a publicação em nuvem, os testes e a documentação — estão **todos** marcados
> como entregues.
>
> **Por que ficou assim tanto tempo:** o parágrafo foi escrito quando era verdade e ninguém o reabriu.
> **Nenhum número de capacidades entrou aqui de propósito** — essa contagem é do
> [`escopo.md`](docs/escopo.md), que é quem a fecha, e duplicá-la neste arquivo criaria uma segunda fonte
> para envelhecer sozinha.

## O que está entregue

### O produto

Cada linha se confere no próprio repositório — é o que a coluna da direita diz.

| O que | Quanto | Onde se confere |
|---|---|---|
| **A `Ocorrência`, com o ciclo de vida inteiro** | os **dez comandos** — `analisar` · `atribuir-responsavel` · `iniciar-atendimento` · `pausar` · `retomar` · `registrar-solucao-aplicada` · `resolver` · `cancelar` · `alterar-prioridade` · `avaliar` | `src/dominio/` e `app/api/ocorrencias/` |
| **A superfície HTTP** | **37 operações em 30 caminhos** | `docs/api/openapi.yaml`, conferido contra o código por `npm run verificar:openapi` |
| **As telas** | **T-01 a T-13**, as treze do [Inventário de Telas](docs/inventario-de-telas.md) — a T-10 como estado da rota `/`, que é como o inventário a descreve | `app/` |
| **O esquema** | **14 tabelas**, em nove migrações | `supabase/migrations/` |
| **A demonstração** | duas organizações e **cinco meses** de ocorrências, escritas pelas mesmas portas que o produto usa | `semente/` |
| **A esteira** | `docker compose` local, imagem no `ghcr.io`, migração aplicada **antes** do deploy, revisão nova no Azure Container Apps | `.github/workflows/entrega.yml` |
| **Os testes** | domínio e aplicação sem banco · isolamento contra Postgres · **um** de ponta a ponta, num navegador, contra a pilha real | `testes/` |

### A documentação

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

**O que já roda: o produto.** Criar conta, entrar numa organização pelo código público, registrar uma
ocorrência com foto e localização, triar, atribuir, atender, pausar, resolver, avaliar — e ler a trilha de
auditoria de tudo isso. Mais o dashboard, o cadastro de categorias, áreas e pessoas, e a troca de
organização sem sair da sessão.

> **Corrigido em 30/08/2026, pela mesma razão do bloco *Estado do projeto*.** Este parágrafo dizia:
> *"O que já roda: **o esqueleto de deploy**. Criar conta, entrar, e ver em qual organização você está — ou
> que não está em nenhuma. Um endpoint (`GET /contexto`), duas telas (T-01 e T-02), três tabelas, e a
> esteira inteira de `push` a container publicado. **O resto do produto vem nas tarefas seguintes.**"* Era
> a mesma afirmação escrita duas vezes no mesmo arquivo, e as duas envelheceram juntas.

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

`npm run local` faz, nesta ordem: **pré-voo** (Docker de pé, CLI do Supabase de pé, e as portas `3000` e
`10000` livres ou já nossas) → `supabase start` (Postgres e Auth locais, em containers) → escreve o
`.env.local` a partir do `supabase status` **se ele não existir**, e se existir **compara e avisa** o que
divergiu, sem sobrescrever → cria o database `resolveai_teste`, da suíte de integração, se ele não existir →
`supabase migration up` → sobe o Azurite e **confere do host** que ele responde → `docker compose up --build`,
no **mesmo `Dockerfile` que vai a produção**.

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
nome de host só**. E ele ocupa a `3000`: **deixe-o rodando e o `npm run local` não sobe.** O pré-voo diz isso
com todas as letras, em vez de deixar o Docker reclamar de `bind` quatro minutos depois.

### Por que aparecem dois grupos no Docker Desktop

Porque são **duas ferramentas**, e cada uma faz o seu projeto — não é duplicação:

| Grupo | Quem cria | O que tem dentro |
|---|---|---|
| `resolve-ai-local` | o nosso `docker-compose.yml` | `resolve-ai` (a aplicação) e `resolve-ai-azurite` (o storage) |
| `resolve-ai` | a **CLI do Supabase**, pelo `project_id` do `supabase/config.toml` | `supabase_db_…`, `supabase_auth_…`, `supabase_kong_…` e os demais |

O nome `resolve-ai-local` é **explícito** no compose desde 30/08/2026. Sem ele, o Compose nomeava o projeto
pela pasta — `8fsdt-hackathon` —, o que não dizia nada a ninguém e mudava se a pasta fosse renomeada. E ele
não pode ser `resolve-ai`: colidiria com o do Supabase, e um `docker compose down --remove-orphans` passaria
a tratar Postgres e Auth como órfãos deste arquivo — removendo-os.

### Quando não subir

O `npm run local` falha **dizendo a causa**; esta tabela é o que fazer com cada uma.

| O que aparece | O que é | O que fazer |
|---|---|---|
| `A porta 3000 está ocupada por outra coisa` | um `npm run dev` esquecido, ou outro projeto | o próprio erro imprime o `taskkill`/`kill` com o PID |
| `A porta 10000 está ocupada por outra coisa` | a `10000` é a porta padrão do Azurite **e** a do Thrift do Spark | pare o container ou processo que o erro nomear |
| `o container subiu saudável, mas o host não o alcança` | o container voltou de um restart sem publicar a porta | **o script se cura sozinho** (recria e refaz a sonda); se insistir, reinicie o Docker Desktop |
| `.env.local … diverge do que o ambiente local diz agora` | o `supabase status` mudou e o arquivo ficou para trás | apague o `.env.local` e rode de novo — só as sessões abertas caem |
| `Docker não respondeu` | o daemon não está de pé | abra o Docker Desktop e espere o ícone verde |
| `Falta o @azure/storage-blob` | `node_modules` incompleto | `npm ci` |

> **Por que o `Healthy` do `docker compose ps` não é prova de nada aqui.** O healthcheck roda **dentro** do
> container: ele responde *"o Azurite iniciou?"*, nunca *"o host alcança o Azurite?"*. Em 30/08/2026 o
> container ficou verde com `NetworkSettings.Ports` vazio — `docker port` devolvia nada, e a subida morria
> com `ECONNREFUSED` dez quadros dentro do SDK do Azure. Quem responde a segunda pergunta é o
> `ferramentas/ambiente-local.mjs`, que sonda `127.0.0.1:10000` **do host** depois do `up`. Os dois
> healthchecks ficaram: um pega Azurite que não iniciou, o outro pega porta que não saiu.

### Verificar

```bash
npm run verificar                   # lint + tipos + teste unitário + os três verificadores de docs
npm run teste:integracao            # exige Postgres — é o critério A4 (organização A não vê dado de B)
npm run teste:ponta-a-ponta         # exige a pilha de pé E a semente de demonstração — ver abaixo
```

Cada peça, separada:

| Comando | O que confere |
|---|---|
| `npm run lint` | **As cinco regras de fronteira da ADR-0006**, como configuração e não como parágrafo: importação só para dentro e só pela superfície pública do módulo; nada fora de `infraestrutura/clientes/` importa um SDK; `infraestrutura/` só é importada por `composicao/`; `composicao/` só pelos caminhos declarados no `eslint.config.mjs`; e `semOrganizacao` só nos quatro `route.ts` da lista fechada do contrato *(esta linha dizia **três** — a própria ADR-0006 já as contava como cinco desde a emenda de 22/08/2026; corrigido em 30/08/2026)* |
| `npm run tipos` | `tsc --noEmit`, em modo estrito |
| `npm run teste` | Domínio e aplicação, **sem banco**, em segundos |
| `npm run teste:integracao` | O repositório escopado contra Postgres, no cenário da Persona 1B |
| `npm run teste:ponta-a-ponta` | **O caminho crítico do enunciado, de fora para dentro** — um navegador contra a pilha real, com autenticação de verdade: registrar → analisar → atribuir → atender → resolver → avaliar, mais a trilha conferida na tela e a troca de organização no meio do percurso. **É um só, e para sempre** ([ADR-0008](docs/adr/0008-a-suite-de-testes-segue-a-garantia.md)); **não é portão de pipeline por push** |
| `npm run verificar:mermaid` | Todo bloco Mermaid parseia — **com controle diferencial**: um diagrama que tem de ser recusado e o mesmo diagrama, consertado, que tem de passar |
| `npm run verificar:openapi` | As **quatro** regras mecânicas da §15 do contrato, mais `$ref` e `operationId`. A quarta é a única que compara o YAML com os `route.ts`: `requestBody.required: false` e `corpoOpcional` são a mesma afirmação em dois lugares, e discordar delas é o portão *"a especificação corresponde ao código"* aberto sem ninguém ver *(eram três até 30/08/2026)* |
| `npm run verificar:referencias` | Todo link relativo resolve; todo `§N` existe |
| `npm run verificar:imagem` | **Nenhum segredo assado na imagem** — `ARG`, `.env` numa camada, variável no ambiente, nome ou chave dentro do pacote do navegador. Exige Docker, e por isso **não** está no `npm run verificar`; no pipeline ele roda **antes** do `push`, porque imagem publicada com segredo dentro não se desfaz |
| `npm run verificar:auth` | **A configuração de Auth publicada bate com a que este repositório declara** — Site URL, lista de redirecionamento, confirmação de e-mail, assunto e corpo do e-mail de recuperação. Exige credencial e rede, e por isso **não** está no `npm run verificar`; é o mesmo tratamento do `verificar:imagem`. Ver *[Publicar](#publicar)* |

**O teste de integração roda num database só dele, `resolveai_teste`**, criado pelo `npm run local`. Sem
`BANCO_URL_TESTE`, ele deriva do `BANCO_URL` trocando o database — e **recusa rodar** se o destino for o
mesmo banco onde você trabalha, porque a suíte derruba e recria as tabelas a cada execução.

**O teste de ponta a ponta tem dois pré-requisitos, e eles não são automatizados de propósito.** Ele não
sobe a pilha (o `playwright.config.ts` não tem `webServer`: a pilha não é um processo, e duplicar o
procedimento desta página seria uma segunda cópia que diverge) e não semeia (a semente **recusa** quando a
demonstração já existe). Antes da primeira execução:

```bash
npx playwright install chromium                              # uma vez por máquina
npm run local                                                # a pilha, em outro terminal
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run semear:demo     # o mundo
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run teste:ponta-a-ponta
```

**No PowerShell, as duas últimas linhas não parseiam** — `VAR=valor comando` é sintaxe do shell POSIX, e o
PowerShell lê `SENHA_DA_DEMONSTRACAO=ResolveAi!2026` como nome de comando. Lá é assim:

```powershell
npx playwright install chromium
npm run local
$env:SENHA_DA_DEMONSTRACAO = 'ResolveAi!2026'   # vale para a sessão inteira do terminal
npm run semear:demo
npm run teste:ponta-a-ponta
```

*(Acrescentado em 30/08/2026: o bloco `bash` estava sozinho, e a máquina onde este projeto é desenvolvido é
Windows com PowerShell. O mesmo vale para o `BANCO_URL_TESTE` citado acima.)*

Ele **acrescenta** uma ocorrência ao `Edifício Aurora (demonstração)`, com a marca do instante no título,
e não altera nada do que a semente escreveu. Rodar duas vezes cria duas ocorrências marcadas e nada
quebra; `npm run semear:demo -- --apagar` limpa tudo. Numa falha, o rastro, a imagem e o vídeo ficam em
`test-results/` e o relatório em `playwright-report/` — os dois fora do git, e o rastro se abre com
`npx playwright show-trace <caminho>`.

### Publicar

Não há comando: **`merge` em `main` publica.** O `.github/workflows/entrega.yml` verifica, aplica as
migrações, constrói a imagem, publica no `ghcr.io` e cria uma revisão nova no Azure Container Apps — nessa
ordem, porque *o rollback da aplicação é imediato e o do banco não é*. Antes de qualquer publicação, a
esteira **sobe o `docker compose` num runner limpo e bate na aplicação por HTTP** — é a mesma `npm run
local` desta página, rodando numa máquina que nunca viu este projeto. É o que prova que não há estado local
escondido, e é por isso que essa conferência não depende de ninguém lembrar.

**Voltar atrás** é reapontar o tráfego para a revisão anterior do Container Apps: imediato, sem rebuild.
Migração destrutiva de esquema exige script de volta escrito à mão.

#### O que vive só no painel do Supabase

**A esteira publica migração e imagem — nunca a configuração de Auth.** O bloco `[auth]` de
`supabase/config.toml` governa **só a pilha local**: quem o lê é a CLI, que monta a máquina de quem rodou
`supabase start`. O projeto hospedado nunca o leu, e nada aqui o publica — não existe `supabase config
push` em lugar nenhum deste repositório, de propósito. Ele empurraria o `config.toml` **inteiro**, portas
locais incluídas, e `site_url` e `additional_redirect_urls` **têm** de divergir entre os ambientes.

Consequência: **estes quatro campos são digitados à mão, uma vez, no painel do projeto hospedado.**
Enquanto ninguém os digitou, a nuvem fica no padrão de fábrica — que é literalmente
`http://localhost:3000`, e foi o que quebrou a confirmação de conta e a redefinição de senha em produção
até 31/08/2026.

| # | Onde, no painel | O que digitar |
|---|---|---|
| 1 | *Authentication* → *URL Configuration* → **Site URL** | a URL pública da aplicação, **sem barra final** |
| 2 | *Authentication* → *URL Configuration* → **Redirect URLs** | `<pública>/confirmar-conta` — e **remover** toda entrada com `localhost` ou `127.0.0.1` |
| 3 | *Authentication* → *Sign In / Providers* → *Email* → **Confirm email** | **desligado**, que é o mesmo valor de `enable_confirmations` no `config.toml` |
| 4 | *Authentication* → *Emails* → *Templates* → **Reset Password** | o assunto e o corpo de `supabase/templates/recuperacao.html` |

**O 4 não precisa da lista de permissão.** O link daquele template aponta direto para a nossa rota, com
`{{ .TokenHash }}`, e `pedirRedefinicaoDeSenha` chama `resetPasswordForEmail` **sem `redirectTo`**, de
propósito — é o que faz o link funcionar em outro aparelho. Não há redirecionamento do provedor a
autorizar, e acrescentar a rota de redefinição à lista é ruído numa lista que é superfície de ataque.

**Como se confere — e a conferência é mecânica:**

```bash
npm run verificar:auth
```

Ele lê a configuração publicada (`GET /v1/projects/{ref}/config/auth`, só leitura) e compara com o que
este repositório declara. Precisa de três variáveis, no `.env.local` ou no ambiente — ver o
`.env.example`: `URL_PUBLICA`, `SUPABASE_ACCESS_TOKEN` (Account → Access Tokens, escopo `auth:read`) e
`SUPABASE_PROJECT_REF`. **A saída diz qual é o problema:**

| Código | O que aconteceu |
|---|---|
| **0** | os cinco campos batem |
| **1** | a configuração publicada **diverge** da declarada — ou os controles embutidos do verificador falharam |
| **2** | falta credencial: ele não olhou para nada |
| **3** | não deu para falar com a API de management |

**E ele roda sozinho em dois lugares.** No `entrega.yml`, como emprego próprio de que `migrar` depende —
um Auth divergente **barra a entrega inteira**, inclusive mudanças que não tocam autenticação, e a saída
de emergência é a válvula `DIVERGENCIAS` do verificador, que exige razão escrita e aparece no diff. E no
cron de sexta, que é a metade que importa: **deriva de configuração não nasce de commit** — alguém clica
no painel numa terça e nada no repositório muda.

Na esteira, `URL_PUBLICA` é *variable* do repositório (não *secret*: FQDN público por desenho não é
credencial, e como segredo ele sai mascarado do resumo da execução); as outras duas já são *secret*, as
mesmas que o `migrar` usa.

### A demonstração

O produto sem dado não se demonstra: *recorrência por categoria* e *tempo médio de resolução, mês a mês*
são séries mensais, e cinco semanas de uso real cabem em um mês e meio. A semente escreve **cinco meses**
de ocorrências pelas mesmas portas que o produto usa — nenhum `INSERT` administrativo, nenhuma data
corrigida depois do fato.

```bash
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run semear:demo
```

Ela cria **duas organizações** — `Condomínio Recanto Azul (demonstração)` e
`Edifício Aurora (demonstração)` — e nunca escreve numa organização existente. Ao terminar, imprime os
dois códigos públicos, a série mensal e a contagem por status: **é a conferência**.

**Rodar duas vezes não duplica nada:** a semente recusa quando a demonstração já existe, e diz o que
fazer. Para recomeçar:

```bash
npm run semear:demo -- --apagar   # apaga as duas organizações inteiras
npm run semear:demo               # e semeia de novo
```

**As duas contas de demonstração**, para o ambiente publicado em
<https://ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io>:

| E-mail | Senha | O que ela é |
|---|---|---|
| `helena.demo@example.com` | `ResolveAi!2026` | **Gestora** no Recanto Azul e **Solicitante** no Aurora — é a pessoa em duas organizações, que é o argumento inteiro do multi-tenant |
| `marcos.demo@example.com` | `ResolveAi!2026` | **Gestor** no Aurora |

> **São credenciais de demonstração, publicadas de propósito.** Elas não estão no código nem na imagem —
> a senha chega por `SENHA_DA_DEMONSTRACAO`, em tempo de execução. O cadastro do produto já é público e
> aberto, então o que elas acrescentam é escrever **dentro das duas organizações de demonstração**, e nada
> além. Trocá-las é uma variável de ambiente e uma linha desta tabela.

### O mapa das pastas de código

| Pasta | Camada | Regra |
|---|---|---|
| `app/` | Interface, metade externa | rotas e telas. **Não alcança `infraestrutura/` nem `composicao/`** |
| `src/interface/` | Interface, metade adaptadora | `http/` (o `comContexto`), `schemas/`, `projecoes/`, `acoes/`, `componentes/` |
| `src/aplicacao/` | Aplicação | **declara as portas** e recebe as implementações |
| `src/dominio/` | Domínio | as regras. Não persiste, não conhece HTTP |
| `src/infraestrutura/` | Infraestrutura | `clientes/` (o único lugar com SDK), `repositorios/`, `contexto/` (o ponto único de escopo) |
| `src/composicao/` | — | monta o grafo de objetos; não decide regra |
| `ferramentas/verificadores/` | — | **cinco** verificadores: os três de documentação que `npm run verificar:docs` roda, mais o da imagem, que exige Docker, e o do Auth publicado, que exige credencial e rede — os dois últimos rodam no pipeline |
| `supabase/migrations/` | — | o esquema, versionado |
| `testes/` | — | `dominio/` e `aplicacao/` sem banco; `integracao/` com |

A decisão está na [ADR-0006](docs/adr/0006-organizacao-de-modulos.md); as **cinco** regras de importação
viram configuração em `eslint.config.mjs`, com o comentário de cada uma no arquivo. *(Esta frase dizia
"as três regras"; a ADR já registrava cinco desde a emenda de 22/08/2026. Corrigido em 30/08/2026.)*

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
