# Resolve Aí — Plataforma de Gestão de Ocorrências

Onde um condomínio, uma empresa ou um bairro registra ocorrências (iluminação, vazamento, limpeza,
segurança, manutenção) e acompanha cada uma até a resolução, com **trilha auditável de toda mudança de
status**. Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha: o pedido chega como texto
solto, alguém transcreve à mão, e ele some no momento em que trava esperando por alguém.

Trabalho da **Fase 5** da pós-graduação em Full Stack Development da FIAP.

**Entrega:** 09/10/2026

## Estado do projeto

O produto está de pé e publicado, e o pacote de documentação está entregue.

O ciclo de vida da ocorrência roda inteiro (registrar, analisar, atribuir, atender, pausar, retomar,
resolver, avaliar, cancelar), cada transição deixando registro na trilha, e o isolamento entre
organizações passa por um ponto único. Ver **[O que está entregue](#o-que-está-entregue)** e
**[Como rodar](#como-rodar)**.

**O ambiente publicado:**
<https://ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io>, as contas para entrar
nele estão em **[A demonstração](#a-demonstração)**.

O que ainda não existe é o que [O produto](docs/produto.md) corta em letra, com o motivo de cada corte:
o acesso próprio do Encarregado e as capacidades que caem junto com ele, a nota interna e a conversa
privada da atribuição, as notificações, a leitura sem rede. **Nenhum requisito do enunciado
ficou de fora:** todo o corte recaiu sobre adições nossas.

## O que está entregue

### O produto

Cada linha se confere no próprio repositório, é o que a coluna da direita diz.

| O que | Quanto | Onde se confere |
|---|---|---|
| A `Ocorrência`, com o ciclo de vida inteiro | os **dez comandos** — `analisar` · `atribuir-responsavel` · `iniciar-atendimento` · `pausar` · `retomar` · `registrar-solucao-aplicada` · `resolver` · `cancelar` · `alterar-prioridade` · `avaliar` | `src/dominio/` e `app/api/ocorrencias/` |
| **A superfície HTTP** | **46 operações em 38 caminhos** | [`docs/api/openapi.yaml`](docs/api/openapi.yaml), conferido contra o código por `npm run verificar:openapi` |
| **As telas** | as **dezenove** de [Telas](docs/telas.md) — a de vínculo sem permissões como estado, e não como endereço próprio | `app/` |
| **O esquema** | **14 tabelas**, em onze migrações | `supabase/migrations/` |
| **A demonstração** | duas organizações e **cinco meses** de ocorrências, escritas pelas mesmas portas que o produto usa | `semente/` |
| **A esteira** | `docker compose` local, imagem no `ghcr.io`, migração aplicada antes do deploy, revisão nova no Azure Container Apps | [[`.github/workflows/entrega.yml`](.github/workflows/entrega.yml)](.github/workflows/entrega.yml) |
| **Os testes** | domínio e aplicação sem banco · isolamento contra Postgres · um de ponta a ponta, num navegador, contra a pilha real | `testes/` |

### A documentação

| Documento | O que responde |
|---|---|
| [O produto](docs/produto.md) | O problema, quem usa, o ciclo de vida da ocorrência, e o que está e o que não está nesta versão |
| [Glossário](docs/glossario.md) | A linguagem do produto: uma definição por termo |
| [Atendimento ao enunciado](docs/atendimento-ao-enunciado.md) | Cada exigência do desafio, e onde ela é cumprida |
| [Visão geral da arquitetura](docs/visao-geral-da-arquitetura.md) | O sistema no contexto, os blocos, a stack contra cada requisito |
| [Domínio e regras](docs/dominio.md) | O agregado `Ocorrência`, a máquina de estados, o histórico e as invariantes |
| [Segurança](docs/seguranca.md) | O isolamento entre organizações, quem entra, e o que acontece com dado pessoal |
| [Infraestrutura](docs/infraestrutura.md) | Onde cada peça roda, a ordem da esteira, e o caminho de volta |
| [Testes](docs/testes.md) | O que cada tipo de teste protege, e os verificadores |
| [Banco de dados](docs/banco-de-dados.md) | As catorze tabelas, e o que o esquema garante sozinho |
| [A API](docs/api.md) · [openapi.yaml](docs/api/openapi.yaml) | As convenções da superfície HTTP, e a especificação executável |
| [Telas](docs/telas.md) | O que cada tela responde, e como se navega entre elas |
| [Registros de Decisão](docs/adr/) | As decisões de arquitetura, no formato Nygard, com as alternativas rejeitadas |

O índice, na ordem de leitura, está em **[docs/README.md](docs/README.md)**. Os dois portões de qualidade
do projeto estão em **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Por onde começar

**Caminho curto** — [O produto](docs/produto.md), que conta o que o sistema faz sem entrar no como. De lá,
a [Visão geral da arquitetura](docs/visao-geral-da-arquitetura.md) e a
[ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md), que é a decisão que sustenta
o resto.

**Caminho completo**, a ordem de [docs/README.md](docs/README.md), que é produto primeiro e referência
por último.

## O que define esta solução

**A auditabilidade é invariante, não convenção.** Ninguém de fora escreve `status`: a única porta são comandos
nomeados, e cada um grava o registro de transição na mesma operação. É impossível mudar o status sem deixar
rastro, porque não existe caminho de escrita que o permita
([ADR-0001](docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md)).

**O isolamento vive num ponto único.** Várias organizações na mesma instância, e o escopo é aplicado
numa função só, não espalhado pelas consultas, onde a próxima consulta esquecida
vazaria dados de outro condomínio ([ADR-0003](docs/adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md)).

**O container construído é o que roda.** Em produção, e não só no ambiente de
desenvolvimento ([ADR-0004](docs/adr/0004-execucao-em-container-no-azure.md)).

**O corte de escopo é verificável.** O [Atendimento ao enunciado](docs/atendimento-ao-enunciado.md)
percorre exigência por exigência e diz onde cada uma é cumprida, e [O produto](docs/produto.md) diz o que
ficou de fora e por quê. Nenhum requisito do enunciado ficou de fora: o corte recaiu inteiro sobre
adições nossas.

## Como rodar

**O que já roda: o produto.** Criar conta, entrar numa organização pelo código público, registrar uma
ocorrência com foto e localização, triar, atribuir, atender, pausar, resolver, avaliar, e ler a trilha de
auditoria de tudo isso. Mais o dashboard, o cadastro de categorias, áreas e pessoas, e a troca de
organização sem sair da sessão.

### O que precisa estar instalado

| Ferramenta | Para quê | Conferir com |
|---|---|---|
| **Node 24** | build, testes e verificadores | `node --version` |
| **Docker** | a aplicação em container | `docker compose version` |
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
no mesmo `Dockerfile` que vai a produção.

Depois: **<http://localhost:3000>**.

> ⚠️ **Abra por `localhost`, e não por `host.docker.internal`.** O cookie que guarda a organização ativa
> sai com o atributo `Secure`, porque o container roda com `NODE_ENV=production` — o mesmo que vai à
> nuvem. O Chromium **descarta um cookie `Secure` servido por `http://` quando o host não é loopback**, e
> `host.docker.internal` não é loopback. Aberto por ali, quem tem vínculo em duas organizações escolhe uma
> e a tela volta a pedir a escolha, sem erro nenhum. Por `localhost` o cookie é aceito e a escolha vale.
>
> O nome do cookie de sessão sai do host da **URL do provedor**, que é variável do servidor, então ele não
> muda com a origem pela qual o navegador chega. Em produção nada disto aparece: lá o transporte é HTTPS.

⚠️ As portas locais do Supabase não são as padrão do CLI (`54391` para a API, `54392` para o banco). O
Windows reserva faixas de porta para o Hyper-V, e na máquina onde isto foi escrito a faixa reservada cobria
as nove portas padrão. O motivo e como conferir a sua estão no cabeçalho de `supabase/config.toml`.

Sem Docker, para o laço curto de quem implementa: `npm run dev`, mas aí a URL do provedor é
`http://127.0.0.1:54391` no `.env.local`, e a aplicação abre em `http://127.0.0.1:3000`. Mesma regra: **um
nome de host só**. E ele ocupa a `3000`: **deixe-o rodando e o `npm run local` não sobe.** O pré-voo diz isso
de saída, em vez de deixar o Docker reclamar de `bind` quatro minutos depois.

### Por que aparecem dois grupos no Docker Desktop

Porque são duas ferramentas, e cada uma faz o seu projeto, não é duplicação:

| Grupo | Quem cria | O que tem dentro |
|---|---|---|
| `resolve-ai-local` | o nosso [`docker-compose.yml`](docker-compose.yml) | `resolve-ai` (a aplicação) e `resolve-ai-azurite` (o storage) |
| `resolve-ai` | a **CLI do Supabase**, pelo `project_id` do `supabase/config.toml` | `supabase_db_…`, `supabase_auth_…`, `supabase_kong_…` e os demais |

O nome `resolve-ai-local` é explícito no compose. Sem ele, o Compose nomearia o projeto pela pasta,
`8fsdt-hackathon`, que não diz nada a ninguém e muda se a pasta for renomeada. E ele
não pode ser `resolve-ai`: colidiria com o do Supabase, e um `docker compose down --remove-orphans` passaria
a tratar Postgres e Auth como órfãos deste arquivo, removendo-os.

### Quando não subir

O `npm run local` falha dizendo a causa; esta tabela é o que fazer com cada uma.

| O que aparece | O que é | O que fazer |
|---|---|---|
| `A porta 3000 está ocupada por outra coisa` | um `npm run dev` esquecido, ou outro projeto | o próprio erro imprime o `taskkill`/`kill` com o PID |
| `A porta 10000 está ocupada por outra coisa` | a `10000` é a porta padrão do Azurite e a do Thrift do Spark | pare o container ou processo que o erro nomear |
| `o container subiu saudável, mas o host não o alcança` | o container voltou de um restart sem publicar a porta | **o script se cura sozinho** (recria e refaz a sonda); se insistir, reinicie o Docker Desktop |
| `.env.local … diverge do que o ambiente local diz agora` | o `supabase status` mudou e o arquivo ficou para trás | apague o `.env.local` e rode de novo — só as sessões abertas caem |
| `Docker não respondeu` | o daemon não está de pé | abra o Docker Desktop e espere o ícone verde |
| `Falta o @azure/storage-blob` | `node_modules` incompleto | `npm ci` |

Por que o `Healthy` do `docker compose ps` não é prova de nada aqui. O healthcheck roda **dentro** do
container: ele responde *"o Azurite iniciou?"*, nunca *"o host alcança o Azurite?"*. Já aconteceu de o
container ficar verde com `NetworkSettings.Ports` vazio: `docker port` devolvia nada, e a subida morria
com `ECONNREFUSED` dez quadros dentro do SDK do Azure. Quem responde a segunda pergunta é o
`ferramentas/ambiente-local.mjs`, que sonda `127.0.0.1:10000` do host depois do `up`. Os dois
healthchecks ficaram: um pega Azurite que não iniciou, o outro pega porta que não saiu.

### Verificar

```bash
npm run verificar                   # lint + tipos + teste unitário + os verificadores de docs + o de estilo
npm run teste:integracao            # exige Postgres — é o critério A4 (organização A não vê dado de B)
npm run teste:ponta-a-ponta         # exige a pilha de pé E o mundo de teste semeado — ver abaixo
```

Cada peça, separada:

| Comando | O que confere |
|---|---|
| `npm run lint` | As cinco regras de fronteira da ADR-0006, como configuração e não como parágrafo: importação só para dentro e só pela superfície pública do módulo; nada fora de `infraestrutura/clientes/` importa um SDK; `infraestrutura/` só é importada por `composicao/`; `composicao/` só pelos caminhos declarados no `eslint.config.mjs`; e `semOrganizacao` só nos cinco `route.ts` da lista fechada do contrato; e a porta sem sessão só na rota e na página do convite |
| `npm run tipos` | `tsc --noEmit`, em modo estrito |
| `npm run teste` | Domínio e aplicação, **sem banco**, em segundos |
| `npm run teste:integracao` | O repositório escopado contra Postgres, no cenário da Persona 1B |
| `npm run teste:ponta-a-ponta` | O caminho crítico do enunciado, de fora para dentro — um navegador contra a pilha real, com autenticação de verdade: registrar → analisar → atribuir → atender → resolver → avaliar, mais a trilha conferida na tela e a troca de organização no meio do percurso. É um só, e para sempre ([ADR-0008](docs/adr/0008-a-suite-de-testes-segue-a-garantia.md)); não é portão de pipeline por push |
| `npm run cobertura` | O alcance da suíte em número, para informar e nunca para reprovar: não há limite mínimo, e nada do portão o consulta. Roda o unitário e o de integração numa execução só, e por isso exige Postgres. Os recortes e a data da última medição estão em [Testes](docs/testes.md) |
| `npm run verificar:mermaid` | Todo bloco Mermaid parseia — **com controle diferencial**: um diagrama que tem de ser recusado e o mesmo diagrama, consertado, que tem de passar |
| `npm run verificar:openapi` | As quatro regras mecânicas do contrato, mais `$ref` e `operationId`. A quarta é a única que compara o YAML com os `route.ts`: `requestBody.required: false` e `corpoOpcional` são a mesma afirmação em dois lugares, e discordar delas é o portão *"a especificação corresponde ao código"* aberto sem ninguém ver |
| `npm run verificar:referencias` | Todo link relativo resolve; todo `§N` existe |
| `npm run verificar:estilo` | As peças do catálogo medidas no navegador contra os valores da prancheta (raio, altura, papel da escala, cor de fundo), **com controle diferencial**: uma peça sabidamente errada tem de ser recusada. Exige o Chromium do Playwright (`npx playwright install chromium`) |
| `npm run verificar:imagem` | **Nenhum segredo assado na imagem** — `ARG`, `.env` numa camada, variável no ambiente, nome ou chave dentro do pacote do navegador. Exige Docker, e por isso não está no `npm run verificar`; no pipeline ele roda antes do `push`, porque imagem publicada com segredo dentro não se desfaz |
| `npm run verificar:auth` | A configuração de Auth publicada bate com a que este repositório declara — Site URL, lista de redirecionamento, confirmação de e-mail, assunto e corpo do e-mail de recuperação. Exige credencial e rede, e por isso não está no `npm run verificar`; é o mesmo tratamento do `verificar:imagem`. Ver *[Publicar](#publicar)* |

O teste de integração roda num database só dele, `resolveai_teste`, criado pelo `npm run local`. Sem
`BANCO_URL_TESTE`, ele deriva do `BANCO_URL` trocando o database, e **recusa rodar** se o destino for o
mesmo banco onde você trabalha, porque a suíte derruba e recria as tabelas a cada execução.

O teste de ponta a ponta tem dois pré-requisitos, e eles não são automatizados de propósito. Ele não
sobe a pilha (o `playwright.config.ts` não tem `webServer`: a pilha não é um processo, e duplicar o
procedimento desta página seria uma segunda cópia que diverge) e não semeia (a semente **recusa** quando o
mundo já existe). O teste usa um mundo próprio, gêmeo da demonstração, com outras organizações e outras
contas, para que nenhuma corrida mude o que a demonstração mostra. Antes da primeira execução:

```bash
npx playwright install chromium                              # uma vez por máquina
npm run local                                                # a pilha, em outro terminal
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run semear:demo -- --teste   # o mundo de teste
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run teste:ponta-a-ponta
```

No PowerShell, as duas últimas linhas não parseiam, `VAR=valor comando` é sintaxe do shell POSIX, e o
PowerShell lê `SENHA_DA_DEMONSTRACAO=ResolveAi!2026` como nome de comando. Lá é assim:

```powershell
npx playwright install chromium
npm run local
$env:SENHA_DA_DEMONSTRACAO = 'ResolveAi!2026'   # vale para a sessão inteira do terminal
npm run semear:demo -- --teste                  # o mundo de teste
npm run teste:ponta-a-ponta
```

Ele **acrescenta** ocorrências às organizações do mundo de teste, com a marca do instante no título, e
não toca a demonstração. Rodar duas vezes cria mais ocorrências marcadas e nada quebra;
`npm run semear:demo -- --teste --apagar` limpa o mundo de teste. Numa falha, o rastro, a imagem e o vídeo ficam em
`test-results/` e o relatório em `playwright-report/`, os dois fora do git, e o rastro se abre com
`npx playwright show-trace <caminho>`.

### Publicar

Não há comando: **`merge` em `main` publica.** O [`.github/workflows/entrega.yml`](.github/workflows/entrega.yml) verifica, aplica as
migrações, constrói a imagem, publica no `ghcr.io` e cria uma revisão nova no Azure Container Apps, nessa
ordem, porque *o rollback da aplicação é imediato e o do banco não é*. Antes de qualquer publicação, a
esteira sobe o `docker compose` num runner limpo e bate na aplicação por HTTP, é a mesma `npm run
local` desta página, rodando numa máquina que nunca viu este projeto. É o que prova que não há estado local
escondido, e é por isso que essa conferência não depende de ninguém lembrar.

**Voltar atrás** é reapontar o tráfego para a revisão anterior do Container Apps: imediato, sem rebuild.
Migração destrutiva de esquema exige script de volta escrito à mão.

#### O que vive só no painel do Supabase

A esteira publica migração e imagem, nunca a configuração de Auth. O bloco `[auth]` de
`supabase/config.toml` governa **só a pilha local**: quem o lê é a CLI, que monta a máquina de quem rodou
`supabase start`. O projeto hospedado nunca o leu, e nada aqui o publica, não existe `supabase config
push` em lugar nenhum deste repositório, de propósito. Ele empurraria o `config.toml` **inteiro**, portas
locais incluídas, e `site_url` e `additional_redirect_urls` têm de divergir entre os ambientes.

Consequência: estes quatro campos são digitados à mão, uma vez, no painel do projeto hospedado.
Enquanto ninguém os digitou, a nuvem fica no padrão de fábrica, que é literalmente
`http://localhost:3000`, e foi o que quebrou a confirmação de conta e a redefinição de senha em produção
até que alguém os digitasse.

| # | Onde, no painel | O que digitar |
|---|---|---|
| 1 | *Authentication* → *URL Configuration* → **Site URL** | a URL pública da aplicação, **sem barra final** |
| 2 | *Authentication* → *URL Configuration* → **Redirect URLs** | `<pública>/confirmar-conta` — e **remover** toda entrada com `localhost` ou `127.0.0.1` |
| 3 | *Authentication* → *Sign In / Providers* → *Email* → **Confirm email** | **desligado**, que é o mesmo valor de `enable_confirmations` no `config.toml` |
| 4 | *Authentication* → *Emails* → *Templates* → **Reset Password** | o assunto e o corpo de [`supabase/templates/recuperacao.html`](supabase/templates/recuperacao.html) |

O 4 não precisa da lista de permissão. O link daquele template aponta direto para a nossa rota, com
`{{ .TokenHash }}`, e `pedirRedefinicaoDeSenha` chama `resetPasswordForEmail` **sem `redirectTo`**, de
propósito, é o que faz o link funcionar em outro aparelho. Não há redirecionamento do provedor a
autorizar, e acrescentar a rota de redefinição à lista é ruído numa lista que é superfície de ataque.

Como se confere, e a conferência é mecânica:

```bash
npm run verificar:auth
```

Ele lê a configuração publicada (`GET /v1/projects/{ref}/config/auth`, só leitura) e compara com o que
este repositório declara. Precisa de três variáveis, no `.env.local` ou no ambiente, ver o
`.env.example`: `URL_PUBLICA`, `SUPABASE_ACCESS_TOKEN` (Account → Access Tokens, escopo `auth:read`) e
`SUPABASE_PROJECT_REF`. A saída diz qual é o problema:

| Código | O que aconteceu |
|---|---|
| `0` | os cinco campos batem |
| `1` | a configuração publicada diverge da declarada — ou os controles embutidos do verificador falharam |
| `2` | falta credencial: ele não olhou para nada |
| `3` | não deu para falar com a API de management |

**E ele roda sozinho em dois lugares.** No [`entrega.yml`](.github/workflows/entrega.yml), como emprego próprio de que `migrar` depende —
um Auth divergente **barra a entrega inteira**, inclusive mudanças que não tocam autenticação, e a saída
de emergência é a válvula `DIVERGENCIAS` do verificador, que exige razão escrita e aparece no diff. E no
cron de sexta, que é a metade que importa: deriva de configuração não nasce de commit, alguém clica
no painel numa terça e nada no repositório muda.

Na esteira, `URL_PUBLICA` é *variable* do repositório (não *secret*: FQDN público por desenho não é
credencial, e como segredo ele sai mascarado do resumo da execução); as outras duas já são *secret*, as
mesmas que o `migrar` usa.

### A demonstração

O produto sem dado não se demonstra: *recorrência por categoria* e *tempo de resolução, mês a mês*
são séries mensais, e cinco semanas de uso real cabem em um mês e meio. A semente escreve cinco meses
de ocorrências pelas mesmas portas que o produto usa, nenhum `INSERT` administrativo, nenhuma data
corrigida depois do fato.

```bash
SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run semear:demo
```

Ela cria **duas organizações**, `Condomínio Recanto Azul` e `Edifício Aurora`, e nunca escreve numa
organização existente. Ao terminar, imprime os dois códigos públicos, a série mensal e a contagem por
status: **é a conferência**.

**Rodar duas vezes não duplica nada:** a semente recusa quando a demonstração já existe, e diz o que
fazer. Para recomeçar:

```bash
npm run semear:demo -- --apagar   # apaga as duas organizações inteiras
npm run semear:demo               # e semeia de novo
```

O `--apagar` roda contra o banco que `BANCO_URL` aponta, e imprime o host antes de começar. Ele só apaga
organização com o nome da demonstração que tenha sido fundada pelas contas dela; se encontrar outra com o
mesmo nome, deixa-a intacta e diz qual é.

**As duas contas de demonstração**, para o ambiente publicado em
<https://ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io>:

| E-mail | Senha | O que ela é |
|---|---|---|
| `helena.rocha@example.com` | `ResolveAi!2026` | **Gestora** no Recanto Azul e **Solicitante** no Aurora — é a pessoa em duas organizações, que é o argumento inteiro do multi-tenant |
| `marcos.vieira@example.com` | `ResolveAi!2026` | **Gestor** no Aurora |

**São credenciais de demonstração, publicadas de propósito.** Elas não estão no código nem na imagem —
a senha chega por `SENHA_DA_DEMONSTRACAO`, em tempo de execução. O cadastro do produto já é público e
aberto, então o que elas acrescentam é escrever **dentro das duas organizações de demonstração**, e nada
além. Trocá-las é uma variável de ambiente e uma linha desta tabela.

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

A decisão está na [ADR-0006](docs/adr/0006-organizacao-de-modulos.md); as cinco regras de importação
viram configuração em `eslint.config.mjs`, com o comentário de cada uma no arquivo.

## Como este repositório está organizado

| Pasta | O que é | Está aqui? |
|---|---|---|
| `docs/` | Os entregáveis — é o que este README indexa | sim |
| `refs/` | Material de terceiros, a começar pelo enunciado do desafio | não, porque não é nosso para redistribuir |
| `trabalho/` | O processo interno: depósito de ideias, decisões em andamento, pesquisa e planos | não, porque é rascunho e não entrega |

Os identificadores de processo — decisões de produto, premissas e pontos de atenção — vivem em
`trabalho/`, e não aparecem no que é entregue. O que a documentação diz, ela diz por inteiro no lugar
onde está escrito.

---

Projeto acadêmico, sem uso comercial. Cinco integrantes, um implementador.
