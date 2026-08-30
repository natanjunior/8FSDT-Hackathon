# Contrato de API — Resolve Aí

Superfície HTTP da primeira entrega. Deriva de [escopo.md](escopo.md) (as 44 capacidades ✅),
[modelo-de-dados.md](modelo-de-dados.md) (as 17 tabelas e a regra do vínculo), [arquitetura.md](arquitetura.md)
(o agregado `Ocorrência` e as quatro camadas), [glossario.md](glossario.md) (os nomes) e do
**Event Storming** do projeto (comandos do passo 5, modelos de leitura do passo 7) — que é material de
processo e não acompanha esta pasta.

A especificação executável está em [`docs/api/openapi.yaml`](api/openapi.yaml) — **OpenAPI 3.1**, carregável
no Swagger UI sem edição. **Os dois arquivos são o mesmo contrato**: este documento defende as decisões, o
YAML as declara.

> **O que este documento não faz.** Não escreve handler, repositório nem estrutura de pastas — isso é
> implementação. Não decide produto: onde a documentação anterior não respondia, a resposta virou
> **suposição declarada** (§12) ou **questão registrada** (§13), nunca uma escolha invisível dentro do YAML.

> **Nota de revisão — 21/08/2026 · a imagem virou anexo.** A `imagem_caminho` da ocorrência passou a ser a
> tabela **`anexos`** (§6.16 e §7.8 do `modelo-de-dados.md`), porque o conceito do domínio é **evidência** e
> a coluna modelava o exemplo. **O escopo não mudou:** continua sendo **um anexo, do tipo imagem,
> comprimido no aparelho** — as 42 capacidades ✅ e os 37 endpoints são exatamente os mesmos.
>
> O que mudou na superfície, em cinco linhas:
>
> | Antes | Agora |
> |---|---|
> | `POST /imagens/autorizacoes` | `POST /anexos/autorizacoes` — mesma operação, renomeada |
> | `GET /ocorrencias/{id}/imagem` | `GET /ocorrencias/{id}/anexos/{anexoId}` — mesma operação, endereçada |
> | corpo `imagem: { chave, ticket }` | `anexos: [ { chave, ticket } ]`, com **`maxItems: 1`** |
> | `OcorrenciaResumo.temImagem` | `quantidadeDeAnexos` (contagem) |
> | `OcorrenciaDetalhe.imagemUrl` | `anexos[]` (lista) |
>
> Erros: `IMAGEM_*` → `ANEXO_*`, e **dois códigos novos** — `409 ANEXO_JA_REIVINDICADO` (§10.3) e
> `404 ANEXO_NAO_ENCONTRADO`. **`LIMITE_DE_AUTORIZACOES_DE_UPLOAD` não mudou de nome**, porque nunca
> nomeou o exemplo.
>
> **Por que agora e não depois:** cada linha dessa tabela seria, depois da primeira entrega, uma mudança
> **não-aditiva** pela regra da §11 deste documento. Hoje custa reescrever texto; depois custaria quebrar
> cliente. A §11.1 mede o que o desenho novo torna barato.

> **Nota de revisão — 22/08/2026 · a rodada de revisão do modelo bateu aqui.** Uma leitura crítica do
> esquema produziu mudanças que atravessam a superfície. **Os 37 endpoints e as 42 capacidades ✅ continuam
> os mesmos** — nada entrou, nada saiu, e o `escopo.md` segue com 63 itens.
>
> | Antes | Agora | Onde |
> |---|---|---|
> | `pessoa.emailContato` + `pessoa.telefone` | **`pessoa.contatos[]`** — com `tipo`, `finalidade`, `ordem` e `temWhatsapp` | §8.2, §12 |
> | *(nada)* | **`vinculo.area`** — a unidade do morador, e `areaId` na escrita | §8.2 |
> | `/recusar` aceitava `observacao` e **a descartava** | `observacao` é **guardada** | §8.2 |
> | `Anexo` com quatro campos | **+ `titulo`, `nomeArquivo`, `miniaturaUrl`** | §8.3, §10 |
> | Uma autorização, um destino de upload | **Uma autorização, dois destinos** — anexo e miniatura | §10.2 |
>
> **Duas coisas que este documento passa a dizer e não dizia:** que **telefone entra e sai em E.164**
> (§7.11), e que a escrita de contatos é **substituição, não mesclagem** (§8.2). As duas são decisões de
> contrato, não de banco, e sem elas o cliente adivinharia.
>
> **O contexto completo da rodada — incluindo o que foi recusado e por quê — está na nota de 22/08/2026 do
> `modelo-de-dados.md`, e as duas reversões declaradas estão nas §7.8 e §7.9 do `modelo-de-dados.md`.**

---

## 1. Como ler

**Marcadores de origem**, herdados do `escopo.md`. Todo endpoint carrega o marcador da **capacidade que
ele realiza**, não um marcador próprio:

| Marcador | Significado | Pode ser cortado? |
|---|---|---|
| `ENUNCIADO · literal` | O desafio define o quê **e** o como | **Não** |
| `ENUNCIADO · aberto` | A existência é imposta; a forma é decisão do projeto | **Não** (a existência) |
| `NOSSO` | Adição do projeto | Sim |

**Citação de fonte.** O que vem da disciplina de DDD é citado como `aula N, p.X`. **Semântica de HTTP, REST,
RFC 9457, paginação por cursor e o mecanismo de URL assinada não são tratados em nenhuma das nove aulas** —
tudo isso está marcado **[FONTE EXTERNA]** e se sustenta por mérito próprio, no mesmo regime que a
`modelo-de-dados.md` aplicou a multi-tenancy.

**Atores pelo papel** (aula 2, p.7): `Solicitante`, `Gestor`, `Encarregado`. Vale inclusive para os
**exemplos** do YAML: onde um campo `nome` precisa de valor, o exemplo traz uma função (*"Zelador — Bloco B"*)
e não um nome próprio. Em produção o campo recebe o nome civil.

**Cada endpoint declara seis coisas**: quem pode chamar · o que recebe · o que devolve · os erros com o
motivo de domínio de cada um · a capacidade do `escopo.md` que realiza · o comando ou modelo de leitura do
Event Storming de onde veio.

---

## 2. Princípios do contrato

Sete regras que valem para **todos** os endpoints. Cada uma existe para impedir uma regressão específica.

**P1 · Comando de domínio não vira campo.** Nenhum corpo de requisição, em nenhum endpoint, aceita `status`.
A verificação é mecânica: `status` não aparece em nenhum schema de **entrada** do YAML. Detalhe e defesa na §3.

**P2 · A organização nunca é escolha do cliente.** Nenhum caminho contém identificador de organização e
nenhum cabeçalho o define. O escopo vem da sessão, resolvido no ponto único da
[ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md). §4.

**P3 · Gente só existe dentro de uma organização.** Nenhum endpoint expõe `Pessoa` fora do contexto de uma
organização; **toda listagem de gente é listagem de `Vínculo`**. É a regra da §4.3 do `modelo-de-dados.md`
promovida a regra de superfície. §4.4.

**P4 · A trilha é só de leitura.** Não existe `POST`, `PATCH` nem `DELETE` sobre registro de transição.
Registro nasce como **efeito** de um comando. §9.

**P5 · O que você não pode ver não existe.** Falta de acesso de **leitura** responde `404`; falta de
permissão para **agir** sobre algo que você já pode ler responde `403`. §6.

**P6 · Quase nada é apagado — e a exceção é uma só.** Não há `DELETE` em ocorrência, em mensagem, em
categoria nem em área. O que existe é desativar, arquivar e cancelar. Decorre do RNF9 e do
`ON DELETE RESTRICT` que é padrão do esquema (`modelo-de-dados.md`, §2.5).

> **A exceção, enumerada: `DELETE /vinculos/{pessoaId}`**, e somente ele. Remove um vínculo que **não tem
> histórico**, para desfazer um papel aprovado por engano (PA-25). A licença é estreita e a guarda não é
> nossa: `RESTRICT` **já recusa** apagar o que tem dependente, então o endpoint só consegue apagar
> exatamente o que o RNF9 não precisa preservar. Detalhe em §8.2. Um segundo `DELETE` no contrato não é
> decisão de implementação: é emenda a este princípio.

**P7 · Resposta de dado de organização nunca é cacheável por intermediário.** Toda resposta autenticada sai
com `Cache-Control: private, no-store`. Numa aplicação multi-tenant em que a única diferença entre a
requisição de duas organizações é um cookie, cache compartilhado é um caminho de vazamento do RNF1 que não
passa por nenhuma consulta ao banco. **[FONTE EXTERNA]**

---

## 3. A tradução de comando para HTTP

É a decisão central deste documento, e a que mais pode destruir o que já foi decidido.

### 3.1 O que está em jogo

O agregado `Ocorrência` tem **consistência forçada** (aula 5, p.9: *"somente a lógica do agregado pode
alterar o seu estado"*), e a [ADR-0001](adr/0001-historico-de-transicoes-como-conceito-de-dominio.md)
transforma isso na garantia de auditabilidade: se ninguém de fora escreve `status`, e a única porta são
comandos nomeados, **é impossível mudar o status sem passar pelo código que grava o registro de transição**.

O caminho REST óbvio — `PATCH /ocorrencias/{id}` com `{"status": "em_analise"}` — desfaz exatamente isso:

1. Torna `status` um **campo escrevível**, e a invariante 1 do agregado passa a depender de o handler
   lembrar de não deixar.
2. Joga a máquina de estados para dentro da camada de Interface, que a `arquitetura.md` (Parte I, §5)
   proíbe de conter regra de negócio.
3. Abre um corpo onde `status` e `prioridade` chegam juntos, e um deles exige registro de transição e o
   outro não — a diferença some no schema.
4. Perde o nome do comando: `pausar` e `cancelar` deixam de ser operações distintas e viram valores de um
   campo, o que apaga a razão de `observacao` ser obrigatória em dois casos e opcional nos outros (D23).

### 3.2 As quatro opções, pesadas

| Opção | Forma | O que ganha | O que custa |
|---|---|---|---|
| **A · Sub-recurso de ação** | `POST /ocorrencias/{id}/analise` | Ortodoxia REST: a ação vira substantivo e um recurso é criado | **Obriga a inventar substantivo** para `retomar`, `iniciarAtendimento` e `avaliar` — nomes que **não existem no glossário**. Viola a regra de vocabulário do projeto |
| **B · Verbo no caminho** | `POST /ocorrencias/{id}/analisar` | O caminho **é** o nome do comando do passo 5, no imperativo (aula 6, p.9–10). Um schema por comando | É RPC sobre HTTP, não REST ortodoxo |
| **C · Recurso de transição** | `POST /ocorrencias/{id}/transicoes` com o comando no corpo | Modela o que o domínio faz; a transição já é entidade e tabela | **Sugere que o cliente cria o registro de auditoria** — exatamente o que a §9 proíbe. E corpo polimórfico devolve a validação condicional que a opção B elimina |
| **D · Híbrido** | Comandos como ação; campos sem regra por `PATCH` | Separa o que tem regra do que não tem | Precisa de uma lista explícita de campos, senão a fronteira apodrece |

### 3.3 A decisão

> **Todo comando de domínio é `POST /ocorrencias/{id}/<comando>`, com o caminho no imperativo e idêntico ao
> nome do comando no passo 5 do Event Storming. `PATCH` existe apenas em recursos de configuração
> (`categorias`, `areas`), e a `Ocorrência` não tem `PATCH` nenhum.**

É a opção **B**, com a metade do híbrido **D** que sobrou — e o que decidiu foram três argumentos.

**1 · O vocabulário já existe e é do domínio.** O glossário define *Transição de status* como *"a operação
de negócio que muda o status. Só acontece por **comando nomeado** (`analisar`, `iniciarAtendimento`,
`pausar`, `retomar`, `resolver`, `cancelar`)"*. Esses nomes são linguagem ubíqua (aula 3, p.6: um termo, uma
definição). A opção A exigiria inventar `analise`, `atendimento`, `retomada` — nomes técnicos que a §9 do
`glossario.md` manda **propor ao glossário**, não criar no contrato. Pagar essa invenção para obter ortodoxia REST é
trocar a linguagem do negócio por uma convenção de transporte.

**2 · Um schema por comando transforma regra condicional em regra estática.** A D23 diz que `observacao` é
obrigatória em `pausar` e `cancelar` e opcional no avanço rotineiro. Com um endpoint por comando, isso deixa
de ser condicional: o schema de `pausar` tem `motivo` e `observacao` como `required`, e o de `analisar` não
tem nem um nem outro. **A regra de domínio vira validação de formato — que é a única coisa que a camada de
Interface pode fazer** (`arquitetura.md`, Parte I, §5). Com a opção C, o mesmo corpo teria de validar
condicionalmente pelo valor de `comando`, e a validação condicional é precisamente onde regra de negócio
começa a morar no handler.

**3 · A opção C convida ao erro que a §9 existe para impedir.** `POST /ocorrencias/{id}/transicoes` lê-se
como *"crie uma transição"*. O registro de transição é **objeto de valor imutável dentro do agregado**,
criado como efeito — nunca por chamada direta. Um contrato que exponha `transicoes` como coleção de escrita
está a uma ferramenta de scaffolding de distância de ganhar `PATCH /transicoes/{id}`.

**O que a escolha custa, declarado:** o contrato **não é REST ortodoxo na escrita**. `POST
/ocorrencias/{id}/resolver` não cria um recurso `resolver`, e nenhum `GET` responde nesse caminho. Aceitamos
o rótulo RPC-sobre-HTTP para a metade de escrita e ficamos REST na metade de leitura — que é onde a
uniformidade de recursos realmente paga (cache, paginação, links estáveis para o PWA).

**Decidido por pouco:** a opção **C** foi a segunda, e por pouco. Ela é a que melhor descreve o domínio, e
`Registro de transição` é termo do glossário enquanto "comando" não é recurso. O que a derrubou não foi
elegância, foi risco: ela nomeia como recurso de escrita justamente a entidade que precisa ser
inescrevível. Fica registrada aqui porque, se um dia o contrato precisar de um caminho genérico de comando
(por exemplo, uma fila de comandos offline para o Encarregado — RNF7, evolução prevista), **C é para onde voltar**.

### 3.4 Os dez endpoints de comando — para onze comandos

Todos são `POST /ocorrencias/{id}/<comando>` e todos devolvem `200` com a `OcorrenciaDetalhe` atualizada,
incluindo `ultimaTransicao` — o registro que acabou de ser gravado. **Devolver o registro na resposta do
comando é a forma de o contrato afirmar a invariante 2 da ADR-0001**: se o comando respondeu `200` e não
trouxe `ultimaTransicao`, houve transição sem registro, e isso é um defeito visível de fora.

Não devolvem `201` porque **nenhum recurso endereçável foi criado**: o registro de transição não tem URL
própria (§9).

| Caminho | Comando (passo 5) | De → Para |
|---|---|---|
| `/analisar` | `Analisar` | `aberta` → `em_analise` |
| `/alterar-prioridade` | `Alterar prioridade` | — (não transiciona) |
| `/atribuir-responsavel` | `Atribuir responsável` · `Reatribuir` | — (não transiciona) |
| `/iniciar-atendimento` | `Iniciar atendimento` | `em_analise` → `em_atendimento` |
| `/pausar` | `Pausar` | `em_analise` · `em_atendimento` → `pausada` |
| `/retomar` | `Retomar` | `pausada` → **o `statusAnterior` do registro de pausa** |
| `/registrar-solucao-aplicada` | `Registrar solução aplicada` | — (não transiciona) |
| `/resolver` | `Resolver` | `em_atendimento` → `resolvida` |
| `/cancelar` | `Cancelar` | `aberta` · `em_analise` · `em_atendimento` · `pausada` → `cancelada` |
| `/avaliar` | `Avaliar resolução` | — (não transiciona) |

São dez caminhos para onze comandos: **`/atribuir-responsavel` realiza dois** (`Atribuir responsável` e
`Reatribuir`). A distinção é derivada do estado — existe atribuição vigente? — e não da intenção do cliente;
a resposta diz qual dos dois aconteceu, no campo `reatribuicao`. Reatribuir encerra a atribuição anterior
com motivo `reatribuicao` e dispara a POL-04, que arquiva o canal 3.

> **Na primeira entrega a POL-04 não tem canal para arquivar.** O canal 3 — a conversa privada da
> atribuição — é evolução prevista. A política fica declarada porque o encadeamento é do desenho e volta
> inteiro quando o canal existir; **hoje reatribuir encerra a atribuição anterior e para aí.**

> **Alternativa rejeitada, também por pouco:** `PUT /ocorrencias/{id}/responsavel`. O responsável é um
> sub-recurso singular, e `PUT` expressaria *"faça desta pessoa a responsável"* cobrindo atribuir e
> reatribuir com semântica correta e idempotente. Perdeu por **uniformidade**: seria o único comando de
> escrita fora do padrão verbo-no-caminho, e esconderia que reatribuir tem dois efeitos colaterais
> (encerra a atribuição vigente, arquiva o canal). Se um dia o contrato admitir `PUT` para
> sub-recursos singulares, este é o primeiro candidato.

### 3.5 A lista que impede a regressão

É esta tabela que evita que `status` volte a ser campo. **Na `Ocorrência`, nenhum campo é escrevível por
`PATCH` — porque não existe `PATCH` de ocorrência.**

| Campo de `ocorrencias` | Como muda |
|---|---|
| `titulo` · `descricao` · `categoriaId` · `areaId` · `localizacaoComplemento` · `anexos` | Escritos **uma vez**, em `POST /ocorrencias`. **Não há endpoint de edição na primeira entrega** — editar ocorrência não é capacidade ✅ do escopo (§12, suposição S-A7) |
| `status` | **Só por comando.** Não aparece em nenhum schema de entrada do contrato |
| `prioridade` | Só por `POST /ocorrencias/{id}/alterar-prioridade` — que recusa em estado terminal (D6) |
| `solucaoAplicada` | Por `POST /ocorrencias/{id}/registrar-solucao-aplicada` **ou no corpo de `POST /ocorrencias/{id}/resolver`** — os dois, e é de propósito (§8.4) |
| `avaliacaoNota` · `avaliacaoComentario` · `avaliadaEm` | Só por `POST /ocorrencias/{id}/avaliar` |
| responsável (tabela `atribuicoes`) | Só por `POST /ocorrencias/{id}/atribuir-responsavel` |
| `areaTipo` | **Escrito pelo servidor** no registro, cópia congelada da Área (emenda à D10, §7.5 do `modelo-de-dados.md`). **Nunca aceito no corpo**, em nenhum endpoint |
| `organizacaoId` · `autorPessoaId` · `registradaEm` · `atualizadaEm` | Escritos pelo servidor. Enviados no corpo → `422 CAMPO_NAO_SUPORTADO` |

**Onde `PATCH` existe, e por quê.** Só em `categorias` e `areas`: `nome`, `ordem`, `ativa`, `icone`, `tipo`. Nenhum
desses campos é governado por máquina de estados nem gera registro de transição. O critério, escrito para
ser aplicado a campos futuros:

> **Se o campo tem máquina de estados, ou se mudá-lo obriga a gravar um registro de transição, ele muda por
> comando nomeado. Caso contrário, `PATCH`.**

`categorias.ativa` cai do lado do `PATCH` mesmo tendo o evento *"Categoria desativada"* no passo 1 do Event
Storming: não há estado anterior a validar, não há transição ilegal possível e não há trilha a alimentar.
Custo declarado: o evento existe no Event Storming e o contrato o realiza como escrita de campo — é a única
divergência entre a lista de eventos e a forma do contrato, e é deliberada.

---

## 4. Autenticação, contexto de organização e autorização

### 4.1 Autenticação — o que o contrato não cobre

`Criar conta` e `Autenticar-se` (S1, S2) **não são endpoints deste contrato**. São o subdomínio **Genérico**
comprado no Supabase Auth (`arquitetura.md`, Parte I, §1 e §3), integrado como **Conformista + ACL**: o
domínio nunca vê token. O contrato **consome** a sessão; não a emite.

Consequência para o Swagger: o botão *Authorize* aceita as duas formas em que a sessão chega:

| Esquema | Como | Para quem |
|---|---|---|
| `sessaoSupabase` | Cookie de sessão emitido pelo provedor | O PWA, no navegador |
| `bearerSupabase` | `Authorization: Bearer <access_token>` | `curl`, Postman, testes de ponta a ponta |

**A tradução de sessão em contexto é o ACL**, e acontece no ponto único da ADR-0003 — o mesmo que descobre a
organização. É lá, e só lá, que `auth.users.id` vira `pessoas.id`, criando a `Pessoa` se ainda não existir
(a resolução idempotente da §9.2 do `modelo-de-dados.md`).

**De onde vem o `nome` dessa Pessoa recém-criada.** `pessoas.nome` é obrigatório e não nulável, então a
criação pelo ACL precisa de um valor e o contrato precisa dizer qual: **vem dos metadados da conta**,
preenchidos no cadastro. Isso obriga o formulário de criação de conta — que é do provedor, mas cuja tela é
nossa — a **pedir o nome**, e não só e-mail e senha.

A alternativa era tornar `nome` obrigatório em `POST /pedidos-de-entrada`, o que empurraria a pergunta para
depois e deixaria um intervalo em que a Pessoa existe sem nome. O campo `nome` daquele endpoint continua
existindo e **opcional** — mas com outro papel: é o ponto de **correção**, não de origem (§8.2).

**E quando os metadados não trazem nome — acrescentado em 22/08/2026.** A redação acima prometia a origem
e não dizia o que acontece quando ela falha. Conta criada por outro fluxo do provedor — ou semeada — não
passa pelo nosso formulário, e a coluna é `NOT NULL`: o ACL precisa de um valor de qualquer forma.

> **O valor é o literal `"Sem nome"`.** É corrigível **uma última vez** em T-02, face A — o mesmo campo
> `nome` do pedido de entrada que a §8.2 já descreve como ponto de correção. Depois disso, quem tem conta
> não edita mais o próprio cadastro: `409 PESSOA_COM_CONTA_NAO_EDITAVEL`.
>
> **As duas alternativas foram recusadas com motivo.** Cair no **trecho local do e-mail** poria credencial
> dentro de uma trilha que é imutável por invariante (§9.1), e o RNF10 pede exatamente o contrário.
> **Recusar o login** inutiliza a conta, e não há código para isso na taxonomia da §6.4 — seria erro novo
> numa porta que este contrato declara não cobrir (§9.5).

### 4.2 Onde vive a organização

> **A organização ativa vem da sessão. Nunca do caminho, nunca de um cabeçalho, nunca do corpo.**

O caminho `/organizacoes/{orgId}/ocorrencias` foi considerado e rejeitado. O argumento é o da ADR-0003,
aplicado à superfície: se o cliente informa a organização, **o servidor tem de validar o vínculo em cada
endpoint** — e o dia em que alguém escrever um endpoint novo sem essa validação é o dia do vazamento do
RNF1, que é o risco número um do produto. Com a organização derivada da sessão, o esquecimento não é
improvável: **é impossível**, porque não existe valor a esquecer de validar.

O que se perde, declarado: a URL deixa de ser auto-descritiva. `/ocorrencias/{id}` não diz de quem é a
ocorrência, e no Swagger o avaliador precisa entender que há um contexto ativo antes de clicar. É o custo
aceito, e a §4.3 o compensa em parte.

**Rejeitado também: cabeçalho `X-Organizacao-Id` como fonte.** Ele parece mais barato que o caminho, e a
validação continuaria centralizada no mesmo ponto único — mas mantém a organização como **entrada do
cliente**, e entrada do cliente é superfície de ataque: um identificador adivinhado por alguém com vínculo
em duas organizações vira teste de força bruta contra o ponto de validação. Derivar da sessão remove a
superfície inteira.

### 4.3 O mecanismo de troca — a Persona 1B

O síndico que também mora em outro prédio tem vínculo em duas organizações. A ADR-0003 já diz o que fazer:
*"trocar de organização é operação explícita de sessão"*. O contrato a realiza em dois endpoints:

- **`GET /contexto`** — devolve `{ pessoa, organizacaoAtiva, papel, permissoes[], vinculos[], pedidosDeEntrada[] }`.
  É o primeiro pedido de qualquer cliente e a única fonte da lista de organizações da pessoa. Funciona
  **sem organização ativa** — é ele que permite a tela de escolha e a tela de quem ainda não entrou em
  organização nenhuma.
- **`PUT /contexto/organizacao`** — recebe `{ organizacaoId }`, valida que **existe vínculo ativo** daquela
  Pessoa naquela organização e grava a escolha num **cookie de sessão assinado pelo servidor**. Sem vínculo
  ativo: `403 SEM_VINCULO_NA_ORGANIZACAO` — e a resposta é idêntica para organização inexistente e para
  organização real onde a pessoa não tem vínculo, para não confirmar existência.

O `organizacaoId` aparece **uma vez** em todo o contrato: no corpo deste `PUT`. É o único ponto onde o
cliente nomeia uma organização, e é o ponto que a verificação automatizada do RNF1 tem de cobrir.

**Qual é a organização ativa antes de existir cookie — a situação de todo primeiro login.** Acrescentado
em 20/08/2026: a redação anterior descrevia o mecanismo de troca e não dizia qual é o estado inicial.

> Se a Pessoa tem **exatamente um vínculo ativo**, o servidor **escolhe esse** e grava o cookie na própria
> resposta de `GET /contexto`. Se tem **dois ou mais**, `organizacaoAtiva` vem `null` e o cliente precisa
> chamar o `PUT`. Se tem **zero**, vem `null` e não há o que escolher.

Não é conveniência: sem isso, **todo login de todo usuário** custaria um `PUT` antes de qualquer tela,
inclusive no caso comum — em que a pergunta *"qual organização?"* tem uma resposta só. Sob a escala a zero
do RNF5, essa é uma segunda espera cobrada de graça, na primeira impressão do dia. A escolha automática
não afrouxa nada: só existe vínculo porque um Gestor o criou, e o `PUT` valida a mesma coisa que o
servidor já sabe aqui.

**A trava contra a aba esquecida.** Um PWA com duas abas compartilha o cookie: trocar de organização na aba
A muda silenciosamente o contexto da aba B, e o Gestor pode resolver na organização errada. Por isso o
contrato aceita o cabeçalho **opcional `X-Organizacao-Id`** com um papel estritamente diferente:

> **`X-Organizacao-Id` nunca escolhe a organização — apenas confirma a que a sessão já escolheu.** Ausente,
> não há verificação. Presente e diferente da organização ativa: `409 ORGANIZACAO_DIVERGENTE`, e nada é
> executado.

É afirmação, não fonte. O cliente que o envia está dizendo *"eu acho que estou na organização X"*, e o
servidor recusa quando a sessão discorda. Custa um cabeçalho e fecha uma classe inteira de erro operacional
que o isolamento por sessão, sozinho, introduz.

### 4.4 Os quatro endpoints que rodam sem organização

Decorre da P2 uma lista curta e auditável — **exatamente quatro operações não passam pelo repositório
escopado**, e nenhuma delas lê dado de ocorrência:

| Endpoint | Por que fica fora do escopo |
|---|---|
| `GET /contexto` | Precisa listar os vínculos **de todas** as organizações da Pessoa. Parte de `vinculos` pela Pessoa da sessão — nunca de `pessoas` |
| `PUT /contexto/organizacao` | É o ato de **escolher** o escopo |
| `POST /organizacoes` | Cria o escopo. É o bootstrap da D26: o primeiro Gestor não tem quem o aprove |
| `POST /pedidos-de-entrada` | Acontece **antes** de existir vínculo (D25). Recebe o código público, não o identificador da organização |

Qualquer endpoint acrescentado a esta lista é mudança de contrato que exige revisão explícita. É a versão de
superfície do compromisso da ADR-0003.

> ### ⚠️ *"Não exige organização ativa"* ≠ *"exige não ter organização ativa"* — 22/08/2026
>
> A redação anterior desta seção e das tabelas da §8.1 e da §8.2 dizia que `POST /organizacoes` e
> `POST /pedidos-de-entrada` rodam *"sem organização ativa"*, e a coluna *Quem* chegava a escrever
> **"sessão válida, sem organização ativa"** — que se lê como **pré-condição**. Nenhum código do catálogo da
> §6.4 correspondia a essa pré-condição, e o `openapi.yaml` nunca declarou recusa. A frase descrevia **a
> tela**, não o endpoint.
>
> **Fica decidido: os dois ignoram a organização ativa e não a recusam.** Um Gestor de A pode fundar B, e
> quem já está em A pode pedir entrada em B.
>
> **A segunda metade não é conveniência — é o que faz a Persona 1B existir.** O síndico que também mora em
> outro prédio precisa de um **segundo vínculo**, e o único caminho para um vínculo novo é o pedido de
> entrada aprovado por um Gestor (D25) — `POST /vinculos` cria sempre uma Pessoa nova (§12, S-A2) e
> `PATCH /vinculos/{pessoaId}` não muda papel nem organização. Se `POST /pedidos-de-entrada` exigisse não
> ter organização ativa, **o segundo vínculo seria inalcançável dentro do produto** — e com ele cairiam o
> `PUT /contexto/organizacao`, a face D de T-02 e o cabeçalho `X-Organizacao-Id`, que existem para servir
> exatamente essa pessoa.
>
> **O que isto não resolve, e é de tela:** nenhuma tela oferece *"entrar em outra organização"* a quem já
> tem uma — T-02 só aparece quando `organizacaoAtiva` é nula. O contrato deixa o caminho aberto; quem o
> desenha é o inventário de telas.

### 4.5 Autorização — permissão, nunca papel

As checagens perguntam `vinculo.pode(X)`, **nunca** `vinculo.papel == GESTOR` (`arquitetura.md`, Parte II,
tópico 5). Isso não é preferência de estilo: a `PRIMARY KEY (pessoa_id, organizacao_id)` de `vinculos`
depende dela (`modelo-de-dados.md`, §6.4). O contrato exprime a permissão, e o mapa papel→permissão é
constante em código.

| Permissão | Solicitante | Gestor | Encarregado |
|---|---|---|---|
| `ocorrencia.registrar` | ✅ | ✅ | — |
| `ocorrencia.ler_propria` | ✅ | ✅ | — |
| `ocorrencia.ler_todas` | — | ✅ | — |
| `ocorrencia.comentar` | ✅ (na própria) | ✅ | — |
| `ocorrencia.analisar` · `alterar_prioridade` · `atribuir` · `iniciar_atendimento` · `pausar` · `retomar` · `registrar_solucao` · `resolver` | — | ✅ | — |
| `ocorrencia.cancelar_propria` | ✅ (até `em_analise`, D12) | ✅ | — |
| `ocorrencia.cancelar_qualquer` | — | ✅ | — |
| `ocorrencia.avaliar` | ✅ (só o autor) | ✅ (só o autor) | — |
| `organizacao.configurar` · `vinculo.gerir` · `dashboard.ler` | — | ✅ | — |

**O Gestor acumula as capacidades do Solicitante.** É a resposta 1 registrada em `modelo-de-dados.md`,
§13: *o papel define a visão padrão e o conjunto de permissões; não retira capacidade que o enunciado
concede*. É o que dispensa o segundo vínculo do síndico que mora no prédio — e, no contrato, é o que faz
`POST /ocorrencias` e `POST /ocorrencias/{id}/avaliar` aceitarem um Gestor sem nenhuma exceção escrita.

**O Encarregado não tem permissão nenhuma na primeira entrega.** Não é esquecimento: as cinco capacidades do
acesso próprio dele são ⬜ (`escopo.md` §3.1). Um vínculo `encarregado` que tenha conta autentica normalmente,
recebe `permissoes: []` em `GET /contexto` e leva `403 PERMISSAO_INSUFICIENTE` em qualquer endpoint de
negócio. O contrato **declara** esse estado em vez de deixá-lo acontecer por acidente.

**Duas camadas, dois erros diferentes.** Permissão de papel responde `403 PERMISSAO_INSUFICIENTE`; relação
com o recurso — ser o autor, ser o responsável — responde `403` com código próprio
(`SOMENTE_O_AUTOR_PODE_AVALIAR`). Separar os dois importa para depuração: o primeiro é configuração de
papel, o segundo é o recurso errado.

### 4.6 A regra do vínculo primeiro — `GET /pessoas` não existe

> ### 🔒 Regra do vínculo primeiro
>
> **Nenhum endpoint expõe `Pessoa` fora do contexto de uma organização. Toda listagem de gente é listagem de
> `Vínculo`, e todo endereço de gente é `/vinculos/{pessoaId}` — nunca `/pessoas/{id}`.**

É a §4.3 do `modelo-de-dados.md` promovida a regra de superfície. Lá ela é regra de repositório
(*"a consulta começa em `vinculos` e faz `JOIN` para `pessoas`, nunca o contrário"*); aqui ela é a garantia
de que **não existe URL** capaz de pedir a consulta proibida. `pessoas` é tabela global, sem
`organizacao_id`: um `GET /pessoas` devolveria o cadastro do sistema inteiro, e **nenhuma chave estrangeira,
`CHECK` ou índice impede isso**.

Três consequências concretas no contrato:

1. **Listar candidatos a responsável é `GET /vinculos`.** É o ponto onde a tentação de consultar `pessoas` é
   maior — e a D21 o dissolve: a atribuição aponta para *"qualquer Pessoa com vínculo na organização"*, então
   a lista de candidatos **é literalmente a lista de vínculos ativos**. Não há endpoint de busca de pessoas
   a criar, porque não há pergunta que ele responderia.
2. **Cadastrar Encarregado é `POST /vinculos`**, não `POST /pessoas`. O corpo traz os dados da Pessoa
   (`nome`, `contatos[]`) e o `papel`; o servidor cria a `Pessoa` global, os **contatos** e o `Vínculo`
   escopado na mesma transação. A escrita segue a mesma direção da leitura: entra-se pelo vínculo.
3. **`POST /vinculos` sempre cria uma Pessoa nova — nunca reaproveita por e-mail.** Reaproveitar exigiria
   procurar em `contatos` por e-mail, que é exatamente a consulta global proibida, e a resposta
   vazaria a existência de um cadastro em outra organização. O custo é duplicação de linhas em `pessoas`
   para o mesmo ser humano em organizações diferentes — coerente com o modelo, que **não** impõe unicidade global de e-mail em `contatos` e declara isso
   **não único** de propósito (§6.2: *"dois Encarregados de uma terceirizada podem compartilhar o e-mail do
   escritório"*). A unificação de identidade acontece pelo caminho oposto e correto: a pessoa cria conta e o
   `usuario_id` a liga.

**Onde `Pessoa` aparece nas respostas:** sempre **embutida** num recurso escopado — `autor`, `responsavel`,
`autorDaTransicao`, `autorDaMensagem` —, com `pessoaId` e `nome`, e nunca com contato. Contato só aparece em
`GET /vinculos`, que exige `vinculo.gerir` (§12, suposição S-A5) — dado de contato é dado pessoal sob o
RNF10, e não há razão para o Solicitante ler o telefone do vizinho.

> **A regra aperta em 22/08/2026, e não por decisão nova — por consequência.** Com o contato virando a
> tabela `contatos` (§6.17 do `modelo-de-dados.md`), **a segunda tabela global do esquema**, o que a consulta errada
> vazaria deixou de ser *nomes* e passou a ser **telefone e e-mail de todas as pessoas de todas as
> organizações**. A regra do vínculo primeiro é a mesma; o que mudou é o prêmio de quebrá-la.
>
> Consequência para a superfície: **`contatos[]` aparece em exatamente um lugar** — `GET /vinculos` — e o
> `PessoaReferencia` embutido em ocorrência, mensagem e transição continua sendo `{pessoaId, nome}` e nada
> mais. Se algum dia um schema de resposta ganhar contato fora de `GET /vinculos`, **é emenda a este
> princípio**, não detalhe de implementação.

---

## 5. A porta é única?

Next.js permite que um Server Component chame a camada de aplicação **sem passar por HTTP**. Não é gambiarra
— é o modelo do framework, e economiza uma ida e volta dentro do mesmo container.

### 5.1 A decisão

> **Escrita: a API HTTP é a única porta. Nenhuma Server Action escreve na camada de aplicação — todo comando
> passa por um endpoint deste contrato.**
>
> **Leitura: existem duas estradas para a mesma consulta, e o contrato descreve todas elas.** Um Server
> Component pode chamar o mesmo objeto de consulta que o route handler chama, para renderizar a primeira
> pintura da página. **A regra que sustenta isso: nenhum modelo de leitura existe sem endpoint HTTP
> equivalente e documentado.**

### 5.2 Por que não "tudo por HTTP", e por que isso não é mentira por omissão

A objeção correta à segunda estrada é que o contrato passaria a documentar menos do que o sistema faz. Ela
não se aplica aqui por causa da regra acima: **a estrada direta não acrescenta capacidade**, ela só troca o
transporte da primeira renderização. Toda consulta que o Server Component faz existe como `GET` no YAML, com
o mesmo schema de resposta, a mesma autorização e o mesmo escopo — porque é a **mesma função de aplicação**,
chamada por dois transportes.

O que se ganha: numa plataforma cuja franquia é medida em **vCPU-segundos** (ADR-0004) e cujo p95 já convive
com **cold start** (RNF5), um salto HTTP interno para si mesmo é trabalho medido e cobrado que não produz
nada. E o PWA continua consumindo os mesmos `GET`s — o que, na evolução prevista, é o que torna a **leitura sem rede**
(RNF7) possível: o service worker cacheia respostas HTTP, e só existe o que passou por HTTP.

O que se perde, declarado: **dois transportes, duas oportunidades de checar autorização**. A mitigação é
estrutural — a autorização é feita no serviço de aplicação, não no handler; o handler só traduz HTTP
(`arquitetura.md`, Parte I, §5). Se a checagem estivesse no handler, a estrada direta a contornaria, e a
decisão inteira cairia.

**Duas regras verificáveis, para o Definition of Done:**

1. Nenhum arquivo de Server Action importa a camada de aplicação para **escrever** — a mesma regra de lint de
   fronteira que já existe, com um alvo a mais.
2. Todo objeto de consulta usado por Server Component tem endpoint correspondente no `openapi.yaml`. A
   verificação é a tabela de rastreabilidade da §14: modelo de leitura sem endpoint é lacuna, não atalho.

---

## 6. Modelo de erros

### 6.1 O formato

**RFC 9457 · `application/problem+json`** **[FONTE EXTERNA]**, com três extensões nossas:

```json
{
  "type": "https://resolveai.app/erros/transicao-nao-permitida",
  "title": "Transição não permitida",
  "status": 409,
  "detail": "Não é possível resolver uma ocorrência que está Aberta.",
  "instance": "/api/ocorrencias/9a1f.../resolver",
  "codigo": "TRANSICAO_NAO_PERMITIDA",
  "traceId": "01JB8Z6K9T2M4N7Q",
  "statusAtual": "aberta",
  "acoesDisponiveis": ["analisar", "cancelar"]
}
```

| Campo | Papel |
|---|---|
| `codigo` | **O contrato de verdade.** Estável, em `SCREAMING_SNAKE_CASE`, é o que o cliente compara. `title` e `detail` são texto para gente e **podem mudar sem aviso** |
| `traceId` | O identificador que liga a resposta à linha de log do servidor. É o que compensa a decisão da §6.3 |
| `erros[]` | Só em `400`: `{ campo, codigo, mensagem }` por violação |
| `type` | URI de documentação, apontando para a seção correspondente deste documento. Não precisa ser dereferenciável (RFC 9457, §3.1.1) |

`title` e `detail` são **pt-BR** e podem ir direto para a tela; `codigo` nunca é exibido.

### 6.2 A taxonomia, em cinco linhas

A regra completa cabe numa escada, e a ordem importa — a primeira que se aplica vence:

| Situação | Código HTTP | Exemplo |
|---|---|---|
| Não posso **ler** o recurso | **`404`** | Ocorrência de outra organização; ocorrência de outro Solicitante |
| Posso ler, mas não posso **executar** este comando | **`403`** | Solicitante chamando `resolver`; não-autor chamando `avaliar` |
| Posso executar, mas o **estado atual** não permite | **`409`** | `resolver` em `aberta`; `iniciar-atendimento` sem responsável; avaliar duas vezes |
| Requisição bem formada, **valor inválido** no domínio | **`422`** | Categoria inativa; responsável sem vínculo ativo; motivo de cancelamento não permitido ao papel |
| Requisição **mal formada** | **`400`** | Campo faltando, tipo errado, `titulo` com 300 caracteres |

**`400` × `422`.** A fronteira é *"o servidor conseguiu entender o pedido?"*. Falta de campo obrigatório,
tipo errado e tamanho fora do limite são **forma** — rejeitados na camada de Interface, contra o schema,
antes de o domínio existir: `400`. Um corpo perfeitamente válido cujo `categoriaId` aponta para uma
categoria desativada é **significado** — só a aplicação sabe: `422`. A escolha de não usar `422` para tudo
tem consequência prática: quem recebe `400` sabe que errou o formato e pode corrigir sozinho contra o
Swagger; quem recebe `422` precisa reler o domínio.

**`409` para conflito de estado.** Toda transição fora da tabela da `arquitetura.md` (Parte I, §4) é `409`,
com `statusAtual` e `acoesDisponiveis` no corpo — o cliente descobre pelo erro o que **pode** fazer, sem
reimplementar a máquina de estados. `409` também cobre o que já aconteceu (`JA_AVALIADA`,
`PEDIDO_JA_DECIDIDO`) e a unicidade que o banco impõe (`CATEGORIA_NOME_DUPLICADO`).

### 6.3 Recurso de outra organização: `404`, não `403`

> **Recomendação: `404`.** Recurso que existe em outra organização responde exatamente como recurso que
> nunca existiu — mesmo status, mesmo `codigo`, mesmo corpo, mesmo tempo de resposta.

`403` seria mais informativo e é **vazamento pelo código de status**: confirma que aquele UUID existe em
algum lugar do sistema. Num produto cujo RNF1 é isolamento e cuja adição mais cara é multi-tenancy,
entregar existência de identificador pelo status seria contradizer o requisito com a própria resposta de
erro. E não é hipotético: a `arquitetura.md` (tópico 10, critério A4) já mede o isolamento com **a mesma
Pessoa vinculada a duas organizações** — a Persona 1B, que tem identificadores legítimos dos dois lados.

**O que custa, e a compensação.** Perde-se a distinção entre *"digitei o id errado"* e *"estou na organização
errada"* — as duas dores mais comuns de depuração de um sistema multi-tenant. Três compensações, todas no
contrato:

1. O corpo do `404` traz `organizacaoAtiva` (id e nome). Metade das vezes a resposta é *"ah, estou na
   organização errada"*, e a resposta já diz em qual você está.
2. O `traceId` liga à linha de log, e **no log a distinção existe**: o servidor registra `motivo:
   fora_da_organizacao` ou `motivo: inexistente`. A informação não é destruída, é movida para onde só o
   operador chega.
3. O cabeçalho `X-Organizacao-Id` (§4.3) transforma o caso mais frequente num `409` explícito antes de virar
   `404` confuso.

### 6.4 Catálogo de códigos

| `codigo` | HTTP | Motivo de domínio |
|---|---|---|
| `FORMATO_INVALIDO` | 400 | Schema violado; `erros[]` detalha por campo |
| `CORPO_NAO_SUPORTADO` | 415 | `Content-Type` diferente de `application/json` |
| `NAO_AUTENTICADO` | 401 | Sessão ausente, inválida ou expirada |
| `SEM_ORGANIZACAO_ATIVA` | 403 | Autenticado, sem organização escolhida na sessão |
| `SEM_VINCULO_NA_ORGANIZACAO` | 403 | Não há vínculo **ativo** da Pessoa na organização pedida |
| `PERMISSAO_INSUFICIENTE` | 403 | O papel não tem a permissão exigida pelo endpoint |
| `SOMENTE_O_AUTOR_PODE_AVALIAR` | 403 | Invariante 8 do agregado: avaliar é só do Solicitante autor (D1) |
| `SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO` | 403 | A partir de `em_atendimento`, só o Gestor cancela (D12) |
| `OCORRENCIA_NAO_ENCONTRADA` | 404 | Não existe **nesta organização**, ou não é visível a quem pediu (§6.3) |
| `CATEGORIA_NAO_ENCONTRADA` · `AREA_NAO_ENCONTRADA` · `VINCULO_NAO_ENCONTRADO` · `PEDIDO_NAO_ENCONTRADO` | 404 | Idem |
| `CODIGO_PUBLICO_NAO_ENCONTRADO` | 404 | Nenhuma organização com aquele código |
| `ORGANIZACAO_DIVERGENTE` | 409 | `X-Organizacao-Id` diferente da organização ativa (§4.3) |
| `TRANSICAO_NAO_PERMITIDA` | 409 | O par (status atual, comando) não está na tabela de transições |
| `RESPONSAVEL_NAO_ATRIBUIDO` | 409 | `iniciarAtendimento` sem responsável — invariante 9 (D21) |
| `PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` | 409 | Invariante 7 (D6): dashboard reproduzível |
| `AVALIACAO_EXIGE_RESOLVIDA` | 409 | Avaliar antes de `resolvida` (D1) |
| `JA_AVALIADA` | 409 | A avaliação é `0..1` por ocorrência |
| `JA_VINCULADO` | 409 | Pedido de entrada onde já existe vínculo ativo |
| `PEDIDO_DE_ENTRADA_PENDENTE` | 409 | Já há pedido pendente (índice único parcial, §6.15 do `modelo-de-dados.md`) |
| `PEDIDO_JA_DECIDIDO` | 409 | Aprovar ou recusar pedido já decidido |
| `PESSOA_COM_CONTA_NAO_EDITAVEL` | 409 | Editar dados de Pessoa que tem Usuário (§12, S-A3) |
| `VINCULO_COM_HISTORICO` | 409 | Remover vínculo que já tem linha dependente. **Recusa vinda do `ON DELETE RESTRICT`**, traduzida — o caminho é revogar, que é evolução prevista (§8.2) |
| `ULTIMO_GESTOR` | 409 | Remover o último vínculo com `gerir` da Organização. A única regra do `DELETE` que o banco não garante (§8.2) |
| `CATEGORIA_NOME_DUPLICADO` · `AREA_NOME_DUPLICADO` | 409 | `UNIQUE (organizacao_id, nome)` |
| `CATEGORIA_INVALIDA` · `AREA_INVALIDA` | 422 | Existe, mas está **inativa** — ou não é desta organização |
| `RESPONSAVEL_SEM_VINCULO_ATIVO` | 422 | A pessoa indicada não tem vínculo ativo aqui (D21) |
| `MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL` | 422 | Motivo de cancelamento fora da lista do papel (D5) |
| `ANEXO_NAO_RECONHECIDO` | 422 | Chave/ticket inválido, expirado, ou objeto ausente no storage |
| `ANEXO_ACIMA_DO_LIMITE` | 422 | Objeto maior que o teto do RNF8 |
| `ANEXO_JA_REIVINDICADO` | 409 | O objeto já está anexado a uma ocorrência — `UNIQUE (chave)` em `anexos` (§6.16 do `modelo-de-dados.md`). O corpo traz `ocorrenciaId`, para o cliente navegar em vez de registrar de novo. Ver §10.3 |
| `ANEXO_NAO_ENCONTRADO` | 404 | O anexo não é desta ocorrência, ou não existe — **ou existe e não tem miniatura**, quando `?variante=miniatura`. Mesma resposta para os três casos, pela §6.3 |
| `CONTATO_DUPLICADO` | 409 | O mesmo par (`tipo`, `valor`) repetido na mesma Pessoa — `UNIQUE (pessoa_id, tipo, valor)` em `contatos` (§6.17 do `modelo-de-dados.md`) |
| `CAMPO_NAO_SUPORTADO` | 422 | Campo cuja capacidade é evolução prevista (ex.: `ocorrenciaOrigemId`) ou escrito só pelo servidor |
| `LIMITE_DE_AUTORIZACOES_DE_UPLOAD` | 429 | Mais de 30 autorizações de anexo por Pessoa por hora. **É o único limite de chamadas do contrato** — e a §10.3 diz por quê. *(O nome deste código não mudou em 21/08/2026: ele nunca nomeou o exemplo, nomeia a operação.)* |
| `ERRO_INTERNO` | 500 | Sem `detail` de domínio; só `traceId` |

**Nenhum código de erro expõe nome de tabela, coluna, SQL ou identificador de outra organização.** É regra
de contrato, e é o que impede que a mensagem de erro faça o que o status foi projetado para não fazer.

> **O que este catálogo não tem, e a ausência é decisão — 22/08/2026.** Não existe código para *"você já
> tem organização ativa"*, e não vai existir: os quatro endpoints da §4.4 **ignoram** a organização ativa
> em vez de recusá-la. Consequência direta para quem lê a tabela acima: **`SEM_ORGANIZACAO_ATIVA` nunca é
> resposta de nenhum dos quatro** — ele é a resposta dos outros trinta e três, e é o que leva a T-02.
>
> A ausência está escrita porque um catálogo é lido como exaustivo, e um leitor que não achasse o código
> concluiria que ele foi esquecido.

---

## 7. Convenções

Dez decisões que parecem menores. Cada uma tem uma linha de justificativa e, onde havia alternativa
defensável, o que foi rejeitado.

**7.1 · Idioma: pt-BR, em recurso e em campo, sem exceção.** `/ocorrencias`, não `/incidents`;
`registradaEm`, não `createdAt`. O glossário é pt-BR e existe justamente porque *"estes termos viram nome de
tabela, de endpoint e de classe"*. Misturar seria o pior resultado possível — obrigaria um de-para mental em
toda leitura. **Um único termo estrangeiro sobrevive: `status`**, que é palavra do enunciado
(`ENUNCIADO · literal`) e já é termo do glossário.

**7.2 · Vocabulário: sai do glossário, e o que não está lá vira pergunta.** Nome de recurso e de campo é o
**conceito**, não o identificador (`glossario.md` §9). Quatro nomes do contrato não existiam no glossário e
estão declarados: `contexto` (§13, Q-API-2), `anexos/autorizacoes` (§10), `comentarios` como recurso
(deriva de *Comentário*, o canal 1) e `dashboard` (palavra do enunciado, G8). Nenhum foi criado em silêncio.

> **`Anexo` é o quinto, e ele é diferente dos outros quatro — 21/08/2026.** Os quatro acima são nomes
> técnicos: `contexto` e `dashboard` não são conceitos de domínio, e `autorizacoes` é decomposição de um
> comando. **`Anexo` é conceito**: é uma coisa que existe no domínio, tem tipo, tem autor e tem ciclo de
> vida próprio no storage. Pelo critério que a §9 do `glossario.md` fixou em 20/08/2026 — *entra no glossário o
> conceito, não o identificador* —, ele **deveria ser termo**.
>
> **Este contrato não inventou o termo: propôs.** A definição foi escrita **no glossário**, não aqui —
> *"a evidência que acompanha uma Ocorrência: foto hoje, outros tipos depois"*, com *não confundir com*
> **Solução aplicada** e **Comentário**. **Aprovada e incorporada ao glossário (`glossario.md` §3) em 21/08/2026**, no
> mesmo caminho que `Pedido de entrada` percorreu: o artefato propõe, o glossário decide.

**7.3 · Caixa: `snake_case` no banco, `camelCase` no JSON, mesmo vocábulo nos dois.**
`registros_transicao.autor_pessoa_id` vira `autorPessoaId`. A convenção segue o **meio** — SQL e JSON têm as
suas —, a palavra segue o domínio. É a mesma lógica da §2.1 do `modelo-de-dados.md`, que adotou `snake_case` sem
acento por ser convenção de SQL. **Identificador nunca leva acento; texto para humano sempre leva.**

**7.4 · Valores de `enum`: idênticos aos do banco.** `em_analise`, `aguardando_peca`, `aberta_por_engano` —
minúsculo, sem acento, `snake_case`. Um vocabulário só, do banco à tela; o **rótulo exibido** (D19) é um
campo à parte, nunca uma tradução do valor.

**7.5 · Datas: ISO 8601 com fuso, sempre em UTC na saída.** `2026-08-20T17:32:10Z`. O banco é `TIMESTAMPTZ`
(§2.3 do `modelo-de-dados.md`), a nuvem roda em UTC e os usuários estão em BRT: converter é do cliente. Na **entrada**,
qualquer deslocamento é aceito. **Exceção declarada:** os parâmetros de janela do dashboard são `date`
(`2026-08-01`) e são interpretados em **America/Sao_Paulo** — agregação "mês a mês" em UTC parte o mês
brasileiro em dois, e o indicador passaria a depender do fuso do servidor.

**7.6 · Identificadores: UUID v4 em string.** É o que a §2.2 do `modelo-de-dados.md` fixa, inclusive pela
propriedade que
importa aqui: **id sequencial em URL vaza o volume de uma organização para outra**. Duas tabelas têm chave
natural composta, e o contrato as endereça pelo par que as define: o vínculo é `/vinculos/{pessoaId}` dentro
da organização ativa — nunca um id sintético que o modelo recusou criar.

**7.7 · Paginação: cursor, não offset.** Vale para `GET /ocorrencias` e `GET /ocorrencias/{id}/comentarios`.

- **Por quê.** A triagem ordena por `registradaEm DESC` e a lista recebe inserções o tempo todo: com
  `offset`, uma ocorrência registrada entre a página 1 e a 2 **empurra um item para trás, e ele aparece duas
  vezes** — e quem lê a lista de cima é justamente o Gestor que ainda não triou. Cursor é imune a isso.
- **Como.** `?limite=20&cursor=<opaco>`; a resposta traz `{ itens, proximoCursor }`. O cursor codifica o par
  `(registradaEm, id)`, que é exatamente o índice `(organizacao_id, registrada_em DESC)` já existente
  (§6.7 do `modelo-de-dados.md`). Nenhum índice novo.
- **Sem `total`.** Contar exigiria uma segunda varredura da partição a cada página, e o número que o Gestor
  precisa — quantas em cada status — é do `GET /dashboard`, que já o calcula.
- **Coleções pequenas não paginam:** categorias, áreas e vínculos devolvem tudo em `{ itens }`. São ~15, ~30
  e ≤ 200 linhas (RNF3). Se uma organização passar disso, o envelope já é o mesmo e ganha `proximoCursor`
  sem quebrar cliente nenhum.

**7.11 · Telefone entra e sai em E.164. [FONTE EXTERNA]**

`+5511987654321` — `+`, código do país, e no máximo 15 dígitos. Vale em **toda** a superfície: no corpo de
`POST /vinculos`, no de `POST /pedidos-de-entrada`, e em `contatos[].valor` de `GET /vinculos`.

**Duas razões, e a segunda é de produto.** A primeira é que representações diferentes do mesmo número —
`(11) 98765-4321`, `11987654321`, `+55 11 98765-4321` — tornam comparação e deduplicação impossíveis, e a
restrição `UNIQUE (pessoa_id, tipo, valor)` do banco passaria a não garantir nada. A segunda é que **é
exatamente o formato que um link de WhatsApp consome**: guardar em qualquer outro obrigaria a normalizar em
cada lugar que montasse o link.

> **Quem normaliza é o cliente ou o servidor, antes de chegar ao banco — e precisa de biblioteca, não de
> expressão regular.** Transformar o que a pessoa digitou em E.164 depende de país padrão, regra de discagem
> nacional e validade do número; a referência é a `libphonenumber` do Google. **O banco não normaliza: ele
> recusa o que não foi normalizado** (`CHECK` na §6.17 do `modelo-de-dados.md`), e o schema deste contrato recusa antes,
> com `400 FORMATO_INVALIDO`. É a divisão de sempre — a Interface valida forma, o banco garante forma, e
> nenhum dos dois inventa a regra do outro.

**Custo declarado:** a tela precisa de máscara de entrada e de um seletor de país, ou de uma suposição de
país padrão (`BR`). É trabalho de interface que não existia quando o telefone era texto livre — e é o
preço de o número servir para algo além de ser lido.

**7.8 · Versionamento: não há `/v1`. O prefixo é `/api`.** Contra o hábito, com quatro razões:

1. **Não há consumidor independente.** O PWA é servido pelo **mesmo container** que a API (ADR-0004) —
   cliente e servidor sobem juntos, na mesma revisão. Versionar existe para proteger quem você não pode
   atualizar; aqui não existe esse quem.
2. **`/v1` só paga quando `v1` e `v2` coexistem**, o que exige duplicar handlers ou implantações. Com **um
   implementador** e franquia gratuita, é custo garantido contra benefício hipotético.
3. **Prefixo não precisa ser reservado.** No dia da primeira quebra, criar `/api/v2` custa o mesmo que
   custaria se `/api/v1` existisse desde hoje. Não há dívida a antecipar.
4. **A evolução prevista é aditiva por construção** (§11): dos 21 itens, 20 entram por endpoint
   novo ou campo opcional novo.

**Custo declarado:** se o produto ganhar consumidor externo — o plano pago da D13 é o caminho —, a primeira
quebra será mais desconfortável do que seria com o prefixo pronto. A mitigação é a regra da §11 (só aditivo)
e o `openapi.yaml` versionado no repositório, cuja diferença aparece no *pull request*.

**O dia da quebra, descrito antes de acontecer.** Enquanto o único cliente for o PWA, uma mudança
incompatível é **migração de corte único**: servidor e cliente mudam na mesma revisão do container, e o
cliente antigo deixa de existir no instante do deploy — `/api/v2` não teria a quem servir. Há **uma**
frincha nesse "sobem juntos": o service worker do PWA pode manter um shell antigo em cache e virar, na
prática, um cliente velho falando com servidor novo. A resposta a isso é o ciclo de atualização do próprio
service worker, não versionar a API — e é uma linha do Definition of Done, não um prefixo de caminho.
`/api/v2` convivendo com `/api` só se torna necessário quando existir **um consumidor que não podemos
implantar**; nesse dia, v2 nasce para ele e o `/api` atual é congelado.

**7.9 · Concorrência: sem `ETag`/`If-Match`. Última escrita vence — e é decisão consciente.**

O caso que preocupa é dois Gestores triando a mesma ocorrência. **Nos comandos de transição o problema não
existe:** a máquina de estados já é o controle otimista. Se dois chamam `analisar`, o segundo recebe
`409 TRANSICAO_NAO_PERMITIDA` — porque `analisar` não sai de `em_analise` — com uma mensagem de domínio, que
é melhor do que um `412` de `ETag` desencontrado.

**Os comandos que NÃO transicionam também têm controle otimista — e é do estado, não do valor.** São
quatro: `alterar-prioridade`, `atribuir-responsavel`, `registrar-solucao-aplicada` e `avaliar`. *Não
transicionar* não é *poder ser chamado de qualquer estado*: cada um tem a lista de estados que o admite na
**tabela companheira** da máquina (§8.4), e **essa lista é o predicado da própria porta de escrita**. Uma
ocorrência que vira `resolvida` ou `cancelada` entre a leitura do agregado e o `COMMIT` faz o `update`
tocar zero linhas, e o comando responde `409` em vez de gravar em registro fechado — que é a mutação
silenciosa que a **ADR-0001** existe para impedir. **Cada porta expressa a invariante do seu próprio
comando**, e não uma regra comum: `alterar-prioridade` recusa pelos dois estados terminais, porque o nome
do erro dele é `PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` e a frase publicada precisa continuar verdadeira;
`atribuir-responsavel` recusa pelos quatro estados que o admitem, com o `409 TRANSICAO_NAO_PERMITIDA`
genérico. As duas listas são o mesmo conjunto **hoje**, e não por desenho.

Sobra exposição real em **dois** pontos: `alterar-prioridade` e `registrar-solucao-aplicada`, onde a última
escrita sobrescreve a anterior sem aviso — e a alteração de prioridade **não entra na trilha** (só transições
entram; é o PA-21). Aceitamos, por três razões: o cenário da primeira entrega é o do **síndico único**
(`escopo.md` §3.3 — o mesmo argumento que cortou a nota interna); a coluna `atualizada_em` já está lá se
`If-Unmodified-Since` for necessário depois; e toda resposta de comando devolve `atualizadaEm`, então um
cliente atento detecta a corrida sem que o contrato mude.

> **Correção — 30/08/2026.** Esta seção organizava a concorrência em **duas** caixas — *"nos comandos de
> transição o problema não existe"* e *"sobra exposição real em dois pontos"* — e **`atribuir-responsavel`
> não cabia em nenhuma das duas**: ele não transiciona, então a primeira não o cobria; e ele não é
> exposição aceita, então a segunda também não. O parágrafo *"os comandos que não transicionam"* acima é a
> **terceira categoria** que faltava, e ela é o que torna a enumeração completa — o que importa porque é
> esta seção que autoriza o produto a não ter `ETag`, e o argumento depende de a lista fechar.
>
> **A enumeração dos dois pontos não mudou, e não deve mudar:** ela sempre esteve certa sobre os dois que
> nomeia, e continua sendo a exposição que este documento aceita, pelas três razões escritas acima. **A
> distinção entre as duas coisas é o que a correção acrescenta:** o predicado da porta defende o
> **estado** — ninguém escreve em registro fechado; o que fica exposto é o **valor** — dois Gestores
> alterando a prioridade no mesmo estado, e o segundo vence. **A exposição continua sendo dois pontos, não
> três.**
>
> *(Item 18 da fila da frente de documentação, metade (a). A metade de código era a porta de
> `atribuir-responsavel`, que gravava com `where organizacao_id = $1 and id = $2` e nenhum predicado de
> `status`; ela ganhou a lista do próprio comando no item 21, e só por isso esta correção pôde ser escrita
> — antes dele, o texto descreveria um produto que ainda não existia.)*

**7.10 · Idempotência: não há chave de idempotência, e o domínio já tem o desfazer.**

O risco é real e está no RNF6: toque duplo em rede móvel ruim cria duas ocorrências. Mesmo assim, não:

- **Chave de idempotência exige guardar chave → resposta**, e **não há tabela para isso** no modelo de dados.
  Criá-la é mudança de esquema, que este artefato não pode decidir (§13, Q-API-4).
- **Os comandos já são seguros sob repetição.** Repetir `resolver` devolve `409`, não uma segunda resolução —
  a máquina de estados faz o papel da chave.
- **O caso que sobra tem desfazer dentro do produto:** ocorrência duplicada por toque duplo nasce `Aberta`, e
  o Solicitante cancela a própria com o motivo `aberta_por_engano` (D5/D12) — que existe no enum exatamente
  para isto. E na evolução prevista, *ver semelhantes e aderir* (D11) intercepta antes de criar.

Custo declarado: `POST /ocorrencias/{id}/comentarios` **não** é protegido — dois toques criam dois
comentários, e não há exclusão de mensagem (P6).

---

## 8. Os endpoints

**37 operações**, agrupadas pelas nove atividades do `escopo.md`. Nas tabelas: *Quem* é a permissão exigida
(§4.5); *Capacidade* é a linha do `escopo.md` com o marcador de origem; *Comando/Leitura* é a origem no
Event Storming.

Omito, em todos, as respostas que valem para **todo** endpoint autenticado: `401 NAO_AUTENTICADO`,
`403 SEM_ORGANIZACAO_ATIVA`, `415 CORPO_NAO_SUPORTADO` (em qualquer operação que receba corpo) e
`500 ERRO_INTERNO`.

### 8.0 Contexto — a sessão e a organização ativa

| Endpoint | Quem | Recebe | Devolve |
|---|---|---|---|
| `GET /contexto` | qualquer sessão válida | — | `200` `Contexto` |
| `PUT /contexto/organizacao` | qualquer sessão válida | `{ organizacaoId }` | `200` `Contexto` + `Set-Cookie` |

**Marcador:** `NOSSO` (D2, D3, ADR-0003) · realiza a **fundação técnica** *"isolamento por organização em
ponto único"*. Não é capacidade de usuário: é o mecanismo que torna todas as outras escopadas.

`Contexto` = `{ pessoa{pessoaId,nome}, organizacaoAtiva{id,nome,codigoPublico}|null, papel|null,
permissoes[], vinculos[], pedidosDeEntrada[] }`.

**Cada item de `vinculos[]` tem QUATRO campos:** `{ organizacaoId, nome, papel, codigoPublico }`.

- **Para que serve o `codigoPublico`:** casar o código digitado na tela de entrar numa organização com um
  vínculo que a Pessoa **já tem**, *antes de enviar*. Sem ele o cliente só descobria o encontro pelo
  `409 JA_VINCULADO`, cujo corpo traz `title` e `detail` e **nenhuma identidade de organização** — e a tela
  não conseguia oferecer *"entrar nela"* nomeando o lugar. Com o campo, o `409` volta a ser só o que é:
  corrida entre abas.
- **Não é vazamento** (§4.6): o que se publica é o código público **das organizações da própria Pessoa,
  para ela mesma**, e ele já é *"público por natureza"* — quem o usa abre um pedido de entrada, não um
  acesso. O dado já vinha do servidor; a projeção o descartava por escolha, e **nenhuma consulta muda**.
- **É propriedade solta, e não um `$ref` para `OrganizacaoResumo`.** As duas formas foram consideradas:
  referenciar o resumo é mais limpo e **quebra a forma** (`organizacaoId` viraria `organizacao.id`, em
  todos os clientes); a propriedade solta é a mudança mínima e não renomeia nada. **Ficou a segunda**, que
  é a que o produto implementa.

*(Acrescentado em 30/08/2026: até esta data o contrato descrevia `vinculos[]` sem dizer o que cada item
carrega, e o `openapi.yaml` declarava três campos — o produto projeta o quarto desde o item 7b, por
decisão do hub de 29/08/2026. **A fila da frente de documentação endereçava este conserto à §12**, que é
*Suposições declaradas* e não descreve schema nenhum; o lugar certo é esta §8.0, e a §8.8 continua sendo
a tabela dos formatos de ocorrência. Item 22 da fila.)*

- **Erro do `PUT`:** `403 SEM_VINCULO_NA_ORGANIZACAO` — resposta **idêntica** para organização inexistente e
  para organização real onde a Pessoa não tem vínculo ativo (§4.2).
- Os dois rodam **sem organização ativa** (§4.4). `GET /contexto` é o único endpoint que uma Pessoa sem
  nenhum vínculo consegue usar — é ele que sustenta a tela *"você ainda não está em nenhuma organização"*.

### 8.1 Atividade 0 — Configurar a organização

| Endpoint | Quem | Capacidade · origem | Comando/Leitura |
|---|---|---|---|
| `POST /organizacoes` | qualquer sessão válida — **não exige** organização ativa | Criar a organização por auto-serviço; quem cria vira Gestor inicial · `NOSSO` (D26) | `Registrar organização` |
| `GET /categorias` | qualquer vínculo ativo | Editar categorias · `ENUNCIADO · aberto` | leitura do formulário de registro |
| `POST /categorias` | `organizacao.configurar` | idem | `Criar categoria` |
| `PATCH /categorias/{id}` | `organizacao.configurar` | idem | `Criar` / `Desativar categoria` |
| `GET /areas` | qualquer vínculo ativo | Editar áreas · `NOSSO` (D18) | leitura do formulário de registro |
| `POST /areas` | `organizacao.configurar` | idem | `Definir áreas do local` |
| `PATCH /areas/{id}` | `organizacao.configurar` | idem | idem |

**`POST /organizacoes`** — recebe `{ nome }`, devolve `201` com a organização (incluindo o `codigoPublico`
gerado pelo servidor), **cria o vínculo de Gestor de quem chamou** e **deixa a nova organização ativa na
sessão**. Duas capacidades ✅ acontecem aqui sem endpoint próprio — **categorias-semente** e **áreas-semente**
—, porque são efeito da **POL-01**, não chamada do cliente. Ficam verificáveis com um `GET /categorias` logo
depois, e é assim que a §14 as contabiliza.

> **O conteúdo da semente é do `modelo-de-dados.md`, §14** — as sete categorias enumeradas, uma por
> marcador do enunciado, e a metade das áreas que segue **não decidida**. Este contrato descreve o efeito
> e as duas contagens que a resposta devolve; a lista é dado, e dado mora lá.

- O `codigoPublico` é gerado pelo servidor no formato `^[A-Z0-9]{6,12}$` (§6.3 do `modelo-de-dados.md` — ele vive em
  cartaz de elevador e é digitado à mão). **Não é aceito no corpo:** deixar o cliente escolher abriria
  disputa por códigos bonitos e permitiria adivinhação dirigida.
- É um dos quatro endpoints fora do escopo de organização (§4.4): ele **cria** o escopo. É o bootstrap da
  D26 — o primeiro Gestor não tem quem o aprove.
- **Não exige organização ativa, e também não a recusa.** Chamá-lo com uma organização já ativa na sessão
  funciona e **troca a ativa pela recém-criada**, pelo `Set-Cookie` da própria resposta. Não há código de
  erro para *"você já tem organização"*, e a §6.4 declara a ausência: um Gestor de A pode fundar B, que é
  o caso da Persona 1B (§4.3 e §4.4).

**A ordenação das duas listas, declarada.** `Categoria` e `Area` têm **`ordem`**, e as duas listas saem
na ordem que o Gestor definiu, com desempate alfabético.

> **A `Area` ganhou `ordem` em 21/08/2026, e vale registrar por quê — porque a decisão anterior era a
> oposta.** A primeira redação desta seção deixou a `Area` sem `ordem`, em ordem alfabética, e declarou:
> *"não a fizemos agora porque não há evidência, e o passo 5 é a primeira oportunidade de obtê-la"*.
>
> **A evidência chegou.** O orçamento de tempo do protótipo mediu o campo de Área em **cerca de 12
> segundos** no caso típico e 20 no pior — um quinto do orçamento do RNF6 gasto em dizer *onde*, que não é
> o conteúdo da ocorrência, é só o endereço dela. Busca e *"usadas recentemente"* derrubam isso para ~4
> segundos, mas **só a partir do segundo registro de cada pessoa**: no primeiro não há recentes, e o
> primeiro registro é o único que decide se existe um segundo.
>
> `ordem` é o único conserto que atua no primeiro. Custa uma coluna, um campo opcional num `PATCH` que já
> existe, e reordenação numa tela que já reordena `Categoria`.

**`PATCH /categorias/{id}`** — `{ nome?, ordem?, ativa?, icone? }`. `ordem` existe porque *"qual categoria
aparece antes é escolha do Gestor"* (D18); `ativa` é como categoria sai de uso, já que **não há `DELETE`**
(P6) e a FK vinda de `ocorrencias` é `RESTRICT`.

> ### `icone` entrou em 22/08/2026, e vem com uma lista fechada
>
> `POST /categorias` e este `PATCH` passam a aceitar **`icone`**, e a `Categoria` passa a devolvê-lo como
> campo **obrigatório na resposta**. É o item 4b do backlog — escopo `NOSSO`, justificado pelo **RNF6**:
> lista de triagem em texto corrido custa leitura, e ícone é o que faz a mesma lista se ler de relance no
> celular.
>
> **A lista de valores é fechada, e a fonte normativa é a §14.5 do `modelo-de-dados.md`** — 25 nomes do
> conjunto `lucide`, sete deles fixados nas categorias-semente. O contrato a declara como `enum` no schema
> de entrada, e nome fora dela responde `400 FORMATO_INVALIDO`, que é forma e não domínio.
>
> **É opcional no corpo, e o servidor grava `tag` quando o cliente não manda.** Obrigar a escolher um
> ícone para salvar um *nome* poria um seletor de 25 células entre o Gestor e a edição de uma palavra —
> e T-09 é trabalho de escritório, não o caminho cronometrado. A consequência é que **`icone` nunca é
> nulo na resposta**: nenhuma tela precisa de caminho para ausência.
>
> **Por que a lista não é `ENUM` de banco**, que seria o gosto da casa: o cliente **não consegue
> renderizar uma string** — `lucide-react` exporta componentes, então já existe obrigatoriamente um mapa
> nome → componente na Interface. Com a lista no banco seriam três cópias da mesma decisão de produto. A
> §14.5 do `modelo-de-dados.md` pesa isso contra a classificação da §8 de lá, e declara o que se perde. Erros: `404 CATEGORIA_NAO_ENCONTRADA` (inclusive quando é de outra
organização, §6.3) · `409 CATEGORIA_NOME_DUPLICADO` — `UNIQUE (organizacao_id, nome)`, porque duas
categorias com o mesmo nome quebrariam o indicador de recorrência, que é o número mais importante do
dashboard.

**`PATCH /areas/{id}`** — `{ nome?, tipo?, ativa?, ordem? }`. **Mudar `tipo` é permitido e não é retroativo:**
as ocorrências já registradas guardam a cópia congelada `areaTipo` (emenda à D10). A resposta traz
`ocorrenciasComTipoAnterior` — uma contagem — para que a interface possa dizer ao Gestor, em português, que
o passado não muda. `ordem` é `0..999`, simétrico ao de `Categoria`, e é o que sustenta a reordenação em
T-09. Erros: `404 AREA_NAO_ENCONTRADA` · `409 AREA_NOME_DUPLICADO`.

*(Corrigido em 30/08/2026: até esta data a linha dizia `{ nome?, tipo?, ativa? }`, sem `ordem`. O campo
entrou em `Area` em **21/08/2026** — decisão **Q-P5 (a)** do `prototipo-low-fi.md` —, o `openapi.yaml`
acompanhou no mesmo dia, o critério **5.4** o exige e a implementação do 4a · 5 o entregou; **só a prosa
ficou para trás, aqui e no `inventario-de-telas.md`**. A mesma omissão em dois arquivos é sinal de prosa
escrita a partir de prosa, e não do `openapi.yaml`. Item 10 da fila da frente de documentação.)*

**Não existe `PATCH /organizacao`.** Renomear, logo e o interruptor *"exigir solução ao resolver"* são ⬜
(evolução prevista). Na primeira entrega **a organização é imutável depois de criada** — consequência do corte, não
descuido, e registrada na §11.

### 8.2 Atividade 1 — Entrar na organização

| Endpoint | Quem | Capacidade · origem | Comando/Leitura |
|---|---|---|---|
| — | — | Criar conta e autenticar-se · `ENUNCIADO · aberto` (S1,S2) | **fora do contrato** — Supabase Auth (§4.1) |
| `POST /pedidos-de-entrada` | qualquer sessão válida — **não exige** organização ativa | Pedir entrada com o código, aguardando aprovação · `NOSSO` (D25) | *(lacuna — §13, Q-API-1)* |
| `GET /pedidos-de-entrada` | `vinculo.gerir` | Gestor aprova ou recusa o pedido · `NOSSO` (D25) | leitura: pedidos pendentes |
| `POST /pedidos-de-entrada/{id}/aprovar` | `vinculo.gerir` | idem | *(lacuna — §13, Q-API-1)* |
| `POST /pedidos-de-entrada/{id}/recusar` | `vinculo.gerir` | idem | *(lacuna — §13, Q-API-1)* |
| `GET /vinculos` | `vinculo.gerir` | Cadastro de Encarregados, sem conta · `NOSSO` (D27) | leitura: a quem atribuir |
| `POST /vinculos` | `vinculo.gerir` | idem | `Cadastrar pessoa` |
| `PATCH /vinculos/{pessoaId}` | `vinculo.gerir` | idem (o **U** do CRUD de Encarregados) | `Cadastrar pessoa` |
| `DELETE /vinculos/{pessoaId}` | `vinculo.gerir` | Remover vínculo sem histórico, desfazendo papel errado · `NOSSO` (D25, PA-25) | `Remover vínculo` |

**`POST /pedidos-de-entrada`** — recebe `{ codigoPublico, nome?, telefone? }`, com o **telefone em E.164**
(§7.11), e **não exige organização ativa**
(§4.4), porque o vínculo ainda não existe: *"o Vínculo só passa a existir com aprovação do Gestor"* (D25).
Devolve `201` com `{ id, organizacao{nome}, situacao: "pendente" }` — **e nada mais da organização**: o
código é público, mas isso não autoriza ler quem está lá dentro.

**E também não a recusa** — quem já está em A pede entrada em B por aqui, que é o **único** caminho para o
segundo vínculo da Persona 1B. O quadro da §4.4 tem o argumento inteiro.

- Erros: `404 CODIGO_PUBLICO_NAO_ENCONTRADO` · `409 JA_VINCULADO` · `409 PEDIDO_DE_ENTRADA_PENDENTE` (o
  índice único parcial da §6.15 do `modelo-de-dados.md`). Pedido **recusado pode ser refeito** — suposição S4 do modelo de
  dados, aqui herdada e não redecidida.
- *"Código vazado não vira acesso: vira um pedido aguardando aprovação"* (D25) é o comportamento inteiro
  deste endpoint. Ele **nunca** cria vínculo.

**`POST /pedidos-de-entrada/{id}/aprovar`** — recebe `{ papel, areaId? }` (`solicitante` · `gestor` ·
`encarregado`) e cria o **Vínculo**. É onde a invariante da D25 se fecha: nenhum vínculo nasce sem decisão
de um Gestor. Erros: `404 PEDIDO_NAO_ENCONTRADO` · `409 PEDIDO_JA_DECIDIDO` · `409 JA_VINCULADO` ·
`422 AREA_INVALIDA`. **`/recusar`** recebe `{ observacao? }` e não cria nada — **e a observação agora é
guardada.**

> ### `areaId` na aprovação — e por que esta linha estava errada até 22/08/2026
>
> Este parágrafo dizia *"recebe `{ papel }`"*, e o `openapi.yaml` **já aceitava `areaId`**. A divergência
> não era cosmética: ela descrevia como buraco aberto uma coisa que já tinha conserto declarado.
>
> **`areaId` é a unidade da pessoa nesta organização** — o apartamento 302, a sala 14 —, e **este é o
> único momento em que ela pode ser informada para quem tem conta**: o `PATCH /vinculos/{pessoaId}`
> recusa Pessoa com Usuário (§12, S-A3), e o morador sempre tem uma. Sem o campo aqui,
> `vinculos.area_id` seria preenchível apenas para quem **não** é morador — e ela existe justamente para
> descrever quem é.
>
> É opcional: um pedido aprovado sem `areaId` cria o vínculo com `area` nula, que é o caso do Gestor e do
> Encarregado terceirizado. Área que não é desta organização, ou está inativa, responde
> `422 AREA_INVALIDA` — a mesma resposta para os dois casos, pela §6.3.
>
> **Consequência fora deste documento:** o achado `F13` do `inventario-de-telas.md` e o `R-23` do
> `prototipo-low-fi.md` descrevem esta lacuna como aberta, e ela **não está**. Os dois precisam ser
> riscados, e a tela de T-08 precisa oferecer o campo — é conserto de quem tem aqueles arquivos.

> **Até 22/08/2026 este campo era aceito e descartado.** O `openapi.yaml` declarava `observacao` com
> `maxLength: 500` e **não existia coluna** em `pedidos_de_entrada` para ela. O contrato recebia um dado e o
> jogava fora em silêncio.
>
> **Havia duas saídas, e guardar foi a escolhida.** Tirar o campo do contrato era mais barato e seria pior:
> a frase que o Gestor escreve — *"não consta como morador na lista da administradora"* — é a **única
> explicação existente** de por que alguém não entrou. Descartá-la produz exatamente a pergunta que o
> produto veio eliminar, *"por que fui recusado?"*, sem ninguém capaz de responder.
>
> **O que continua fora:** mostrá-la a quem foi recusado. `GET /contexto` devolve `pedidosDeEntrada[]` com
> `situacao`, e **não** com o motivo. A informação passa a existir; se ela é dita, é decisão de produto.

**`POST /vinculos`** — recebe `{ nome, papel, areaId?, contatos[]? }` e cria **Pessoa + contatos + Vínculo
na mesma transação**. É o cadastro de Encarregado sem conta (D27) e o caminho de **escrita** da regra do
vínculo primeiro (§4.6): entra-se pelo vínculo, nunca pela Pessoa. Devolve `201` com o vínculo e a pessoa
embutida.

> ### Os contatos viajam no corpo do vínculo, e a escrita é **substituição** — 22/08/2026
>
> **Por que embutidos e não em recurso próprio.** Endpoints de contato
> (`POST/PATCH/DELETE /vinculos/{pessoaId}/contatos/{id}`) seriam três operações novas para gerir o que
> cabe num campo — e criariam a pergunta *"contato é recurso do domínio?"*, cuja resposta é **não**: é
> atributo de uma Pessoa que **só é alcançável através de um vínculo** (§4.6). Recurso próprio precisaria
> de URL própria, e URL própria é exatamente o que a regra do vínculo primeiro nega a `Pessoa`.
> **Consequência boa:** continuam **37 operações**.
>
> **Por que substituição e não mesclagem.** `PATCH` com `contatos[]` **troca a lista inteira**; `[]`
> remove todos; **omitir o campo não mexe em nada**. A alternativa — mesclar por `id` — exigiria que o
> cliente devolvesse os `id`s que recebeu, e criaria três casos que o contrato teria de definir (item sem
> `id` é novo? `id` ausente da lista é remoção? conflito de `ordem`?). **Substituição tem um caso só**, e
> o custo é que o cliente precisa mandar a lista completa — que ele já tem, porque acabou de ler.
>
> **O que a substituição significa no banco:** `DELETE` das linhas antigas e `INSERT` das novas, na mesma
> transação. É a razão de `contatos` ser a única tabela do esquema que recebe `DELETE` de rotina, e está
> declarado na §11.4 do `modelo-de-dados.md` — a suposição *"nada é apagado"* do RNF9 **não vale** para esta tabela.
>
> **Erros próprios:** `400 FORMATO_INVALIDO` para telefone fora de E.164 ou `temWhatsapp: true` num e-mail
> (as duas são forma, e o schema pega antes do domínio) · `409 CONTATO_DUPLICADO` para o mesmo
> `(tipo, valor)` repetido na mesma pessoa · `422 AREA_INVALIDA` quando `areaId` não é Área **desta**
> organização ou está inativa.

**`PATCH /vinculos/{pessoaId}`** — `{ nome?, areaId?, contatos[]? }`, com uma regra de fronteira própria
que protege as **duas** tabelas globais do esquema:

> **A guarda nomeia campos, não o endpoint.** `409 PESSOA_COM_CONTA_NAO_EDITAVEL` recusa alteração de
> `nome` e dos **contatos** quando a Pessoa tem Usuário — porque essas duas coisas são **globais** e
> mudá-las alteraria o cadastro daquela pessoa em todas as outras organizações. **`areaId` não está sob a
> guarda:** ele pertence ao `Vínculo`, é escopado a esta organização, e o Gestor tem toda a legitimidade
> para dizer em qual unidade a pessoa mora aqui.
>
> Precisão de 22/08/2026: a redação anterior aplicava a recusa ao **endpoint inteiro**, e o alcance ficava
> maior que a razão dela.

O motivo: `pessoas` é global. Um Gestor editando o nome de alguém que tem conta estaria **alterando o
cadastro daquela pessoa em todas as outras organizações** — inclusive naquela em que ela é Gestora. Quem
não tem conta existe apenas como cadastro de quem o criou. **`papel` não é alterável por aqui:** promover
alguém a Gestor não é capacidade ✅ do `escopo.md`.

> **Onde quem tem conta corrige o próprio nome — e a limitação declarada.** A primeira redação desta seção
> dizia *"quem tem conta edita os próprios dados"*, e **essa frase prometia um caminho que não existe**:
> este `PATCH` recusa justamente quem tem conta, não há `PATCH /contexto/pessoa`, e `/pessoas` não existe
> nem deve existir (§4.6). Encontrado ao montar o inventário de telas, pela pergunta *"o que uma tela de
> perfil salvaria?"*.
>
> Como fica na primeira entrega: o nome nasce do **cadastro da conta** e é **corrigível no momento em que
> a pessoa entra numa Organização** — o campo `nome` de `POST /pedidos-de-entrada`, que já existe e é
> opcional, e cuja tela pré-preenche com o nome atual. Depois disso, **não há como alterá-lo**.
>
> A consequência precisa ser dita porque é permanente: **o registro de transição é imutável**, então o
> nome vigente no momento de cada transição fica na trilha de auditoria para sempre. Quem digitou errado e
> já agiu no sistema carrega o erro no histórico. É limitação aceita, não descuido — está registrada como
> ponto de atenção em `premissas-e-questoes-abertas.md`.
>
> **Não existe tela de perfil** na primeira entrega, e a razão é esta: ela não teria o que salvar.

**`DELETE /vinculos/{pessoaId}` — o único `DELETE` do contrato, e por que ele existe.**

Este endpoint conserta um erro específico e frequente: **aprovar um pedido de entrada com o papel errado**,
ou cadastrar um Encarregado com o papel errado. É um erro de clique num `select` de formulário de rotina, e
sem este endpoint ele era **irreversível** — o ponto de atenção **PA-25**.

Ele existe porque três regras corretas se fechavam num beco:

| Regra | De onde vem |
|---|---|
| **Nada é apagado** | P6 deste contrato, RNF9 e o `ON DELETE RESTRICT` do esquema |
| **O `papel` de um vínculo não muda** | Resposta à Q-API-6, §13.2; promover a Gestor não é capacidade ✅ |
| **Uma Pessoa tem no máximo um vínculo por Organização** | `PRIMARY KEY (pessoa_id, organizacao_id)` — suposição S1 do modelo |

Com as três de pé, um morador aprovado como `Encarregado` fica com `permissoes: []` e **não consegue nem
registrar uma ocorrência**, para sempre. Não há como trocar o papel, não há como apagar o vínculo, e um
novo pedido é recusado com `409 JA_VINCULADO`. **Alguma das três tinha de ceder**, e a escolhida foi o P6 —
por uma razão que não é preferência:

> **O `ON DELETE RESTRICT` do esquema não é um obstáculo a contornar aqui: é a própria guarda.** `RESTRICT`
> recusa apagar quando existe linha dependente e permite quando não existe. Um vínculo **sem histórico** não
> tem nada que o RNF9 precise preservar — é justamente por isso que ele pode sair. A condição *"sem
> histórico"* não é verificação que o código faz antes: é o que o banco impõe, e o endpoint apenas traduz a
> recusa dele.

Nada é enviado no corpo. As respostas:

- **`204`** — vínculo removido. A `Pessoa` **permanece** (é global; nunca se apaga por aqui), e um novo
  pedido de entrada passa a ser aceito, agora com o papel certo.
- **`404 VINCULO_NAO_ENCONTRADO`** — inclusive quando o vínculo existe em outra organização (§6.3).
- **`409 VINCULO_COM_HISTORICO`** — a pessoa já registrou ocorrência, foi responsável, escreveu mensagem ou
  autorou uma transição. **Aqui o caminho é *revogar*, que é evolução prevista** (§11, item 6): revogar encerra o
  acesso e **preserva** o registro. Os dois não são a mesma operação com nomes diferentes — ver o glossário.
- **`409 ULTIMO_GESTOR`** — não se remove o último vínculo com `gerir` da Organização. Sem esta guarda o
  endpoint abriria um caminho **novo** para o **PA-24**: numa Organização recém-criada o Gestor inicial não
  tem histórico, e poderia remover a si mesmo, deixando a Organização sem ninguém que possa aprovar
  qualquer entrada. Esta é a única regra do endpoint que o banco **não** garante.

**O que ele não conserta:** o PA-24 em si. Se o único Gestor perder o acesso à conta, continua não havendo
caminho de volta dentro do produto — remover vínculo não cria Gestor.

### 8.3 Atividade 2 — Registrar a ocorrência

| Endpoint | Quem | Capacidade · origem | Comando/Leitura |
|---|---|---|---|
| `POST /anexos/autorizacoes` | `ocorrencia.registrar` | Anexar imagem, comprimida no celular · `ENUNCIADO · aberto` (S6) + RNF8 | decomposição técnica de `Registrar ocorrência` (§10) |
| `POST /ocorrencias` | `ocorrencia.registrar` | Registrar com título, descrição e categoria · `ENUNCIADO · literal` (S3,S4) · Informar a localização · `ENUNCIADO · aberto` (S5) + D10 | `Registrar ocorrência` |

**`POST /anexos/autorizacoes`** é o único endpoint com limite de chamadas do contrato — 30 por Pessoa por
hora, `429` acima disso —, porque é o único que permite consumir armazenamento externo **sem criar registro
de domínio nenhum**. O fluxo inteiro, incluindo o que acontece com o objeto que nunca é reivindicado, está
na §10.

> **O caminho fala em anexo; o corpo aceita imagem — e a diferença é deliberada.** O `tipoConteudo` aceito
> é `image/jpeg` ou `image/png`, e nada mais: é o escopo da primeira entrega (RNF8). O nome do recurso é o
> **conceito** — evidência —, e o corpo é o **recorte**. Admitir outro tipo é acrescentar um valor àquela
> lista; **o caminho, o schema e o cliente não mudam**, porque o cliente nunca envia o tipo do anexo: o
> servidor o deriva do `tipoConteudo` que autorizou. É o mesmo raciocínio da §7.8 do `modelo-de-dados.md` —
> *estrutura certa, escopo estreito*.

**`POST /ocorrencias`** recebe:

```json
{
  "titulo": "Lâmpada queimada na garagem",
  "descricao": "A lâmpada da vaga 34 está queimada há três dias; à noite o corredor fica escuro.",
  "categoriaId": "6b1c8f2e-…",
  "areaId": "0f9a4d71-…",
  "localizacaoComplemento": "ao lado da vaga 34",
  "anexos": [ { "chave": "anx_01JB8Z…", "ticket": "eyJhbGciOi…" } ]
}
```

**`anexos` é lista com `maxItems: 1`, e é aí que o escopo mora.** A tabela `anexos` do banco **não tem
restrição de quantidade** — de propósito, porque proibir no banco devolveria a migração que a tabela veio
evitar (§7.8 do `modelo-de-dados.md`). O teto de um vive **aqui**, no schema de entrada, e ampliá-lo é trocar um número:
uma mudança que **aceita mais e nunca menos**, e portanto não quebra cliente nenhum pela regra da §11.

Devolve `201` + `Location` + `OcorrenciaDetalhe`. **Três coisas o servidor escreve e o cliente não pode
enviar:** `status: "aberta"`, `prioridade: "normal"` (D6) e **`areaTipo`** — a cópia congelada que decide a
visibilidade para sempre (§7.5 do `modelo-de-dados.md`). E mais uma, que é o requisito central do desafio: **o primeiro
registro de transição**, com `statusAnterior` nulo — a premissa **P1** —, devolvido em `ultimaTransicao`.

Erros: `400 FORMATO_INVALIDO` (título acima de 150, título ou descrição vazios — os `CHECK
(length(trim(...)) > 0)` do modelo têm par no schema; **e mais de um anexo**, que é `maxItems` violado e
portanto forma, não domínio) · `422 CATEGORIA_INVALIDA` e `422 AREA_INVALIDA`
(inexistente **nesta** organização **ou** desativada — mesma resposta para os dois casos, §6.3) ·
`422 ANEXO_NAO_RECONHECIDO` · **`409 ANEXO_JA_REIVINDICADO`** (§10.3) · `422 CAMPO_NAO_SUPORTADO` para
`ocorrenciaOrigemId`, cuja coluna existe mas cuja capacidade é ⬜, evolução prevista.

**Por que o anexo chega como referência, e não como bytes.** O corpo é JSON puro: a foto já subiu para o
storage enquanto o Solicitante digitava. É o que faz o registro caber em menos de um minuto (RNF6) — o
fluxo inteiro está na §10.

**E a reivindicação agora escreve uma linha.** Com a coluna, aceitar a referência era preencher um campo
da própria ocorrência; com a tabela, é `INSERT` em `anexos`, **na mesma transação** que grava a ocorrência
e o primeiro registro de transição. Três escritas, um `BEGIN … COMMIT` — a invariante 2 da ADR-0001 já
exigia a transação, e o anexo entrou nela.

### 8.4 Atividades 3 a 6 — os comandos sobre a ocorrência

Onze comandos em dez endpoints, todos `POST /ocorrencias/{id}/<comando>` e todos devolvendo
`200` + `OcorrenciaDetalhe` com `ultimaTransicao` (§3.4).

| Endpoint | Quem (permissão) | Corpo | Capacidade · origem | Comando |
|---|---|---|---|---|
| `/analisar` | `ocorrencia.analisar` — Gestor | `{ observacao? }` | Analisar · `ENUNCIADO · literal` (F2) | `Analisar` |
| `/alterar-prioridade` | `ocorrencia.alterar_prioridade` — Gestor | `{ prioridade }` | Alterar a prioridade · `ENUNCIADO · aberto` (G3) + D6 | `Alterar prioridade` |
| `/atribuir-responsavel` | `ocorrencia.atribuir` — Gestor | `{ responsavelPessoaId }` | Atribuir responsável · `ENUNCIADO · aberto` (G4) + D21 · Auto-atribuição · `NOSSO` · Reatribuir · `NOSSO` | `Atribuir responsável` · `Reatribuir` |
| `/iniciar-atendimento` | `ocorrencia.iniciar_atendimento` — Gestor | `{ observacao? }` | Iniciar o atendimento · `ENUNCIADO · literal` (F2) + D21 | `Iniciar atendimento` |
| `/pausar` | `ocorrencia.pausar` — Gestor | `{ motivo, observacao }` | Pausar com motivo · `NOSSO` (D8) | `Pausar` |
| `/retomar` | `ocorrencia.retomar` — Gestor | `{ observacao? }` | Retomar · `NOSSO` (D8) | `Retomar` |
| `/registrar-solucao-aplicada` | `ocorrencia.registrar_solucao` — Gestor | `{ solucaoAplicada }` | Registrar a solução aplicada · `ENUNCIADO · aberto` (G7) + D22 | `Registrar solução aplicada` |
| `/resolver` | `ocorrencia.resolver` — **Gestor apenas** | `{ observacao?, solucaoAplicada? }` | Resolver · `ENUNCIADO · literal` (F2) | `Resolver` |
| `/cancelar` | `cancelar_propria` (autor) · `cancelar_qualquer` (Gestor) | `{ motivo, observacao }` | Cancelar com motivo · `ENUNCIADO · literal` (F3) + D12 | `Cancelar` |
| `/avaliar` | `ocorrencia.avaliar` — **só o Solicitante autor** | `{ nota, comentario? }` | Avaliar a resolução · `ENUNCIADO · aberto` (S10) + D1 | `Avaliar resolução` |

**Erros comuns a todos:** `404 OCORRENCIA_NAO_ENCONTRADA` (não existe nesta organização **ou** não é visível
a quem pediu, §6.3) · `403 PERMISSAO_INSUFICIENTE` · `409 TRANSICAO_NAO_PERMITIDA` para todo par (status
atual, comando) fora da tabela da `arquitetura.md` (Parte I, §4) — o corpo do `409` traz `statusAtual` e
`acoesDisponiveis`.

> ### De onde saem os dois comandos que não transicionam — 22/08/2026
>
> **A tabela da `arquitetura.md` (Parte I, §4) diz de onde sai cada comando que transiciona, e por
> construção não diz nada dos que não transicionam** — eles estão listados abaixo dela, sem estados. Mesmo
> assim `/atribuir-responsavel` e `/registrar-solucao-aplicada` declaram `409 TRANSICAO_NAO_PERMITIDA`
> neste contrato e no `openapi.yaml`, e até aqui **nenhum documento dizia quando ele acontece**. Dos oito
> comandos sem transição, dois já tinham regra — `alterarPrioridade` pela invariante 7 e `avaliar` pela
> invariante 8 — e quatro são evolução prevista. Sobravam estes dois:
>
> | Comando | Admitido em | Recusado em |
> |---|---|---|
> | `atribuirResponsavel` | `aberta` · `em_analise` · `em_atendimento` · `pausada` | `resolvida` · `cancelada` |
> | `registrarSolucaoAplicada` | `em_atendimento` · `pausada` | `aberta` · `em_analise` · `resolvida` · `cancelada` |
>
> **Por que `atribuir` já em `aberta`:** a auto-atribuição é capacidade ✅ e acontece na triagem, **a
> partir do detalhe da ocorrência**, onde ela normalmente está `aberta`. Proibir ali transformaria um
> clique em dois — e atribuir não é triar, é dizer de quem é. *(O exemplo de `aberta` do `openapi.yaml`
> foi corrigido junto: ele omitia `atribuir-responsavel`.)*
>
> > **Correção — 30/08/2026 — o argumento fica, o lugar muda.** A frase dizia *"a auto-atribuição **em um
> > clique** é capacidade ✅ e acontece **na triagem**"*, e *"na triagem"* se lê como *"na lista de
> > triagem"*. **A lista de triagem é T-03, e T-03 não oferece ação de ocorrência nenhuma** — a capacidade
> > nº 20 vive no **modal de atribuir de T-05**, que é o que a coluna *Telas* do item 20 do backlog diz e
> > o que o produto entregue faz. **A justificativa continua inteira:** *"um clique em dois"* conta
> > **comandos** — `analisar` e depois `atribuir` —, não toques de tela; medido dentro de T-05, o Gestor
> > em `aberta` dá **quatro** toques até atribuir a si mesmo. Foi por isso que *"em um clique"* saiu desta
> > frase e ficou só onde é **nome de capacidade** (§14, nº 20), agora com o que ela conta escrito ao
> > lado. **Levar a ação para a lista é evolução declarada, não esquecimento:** contradiria a coluna
> > *Telas* e o critério 20.5.
>
> **Por que solução aplicada só a partir de `em_atendimento`:** solução aplicada descreve trabalho feito, e
> antes de o atendimento começar não há trabalho a descrever.
>
> **Nos dois terminais a razão é mais forte que *"registro fechado não recebe escrita nova"*, e precisa
> estar dita** — porque a consequência é permanente. `registrarSolucaoAplicada` **não gera registro de
> transição**. Admiti-lo em `resolvida` faria o detalhe de uma ocorrência encerrada mudar **sem nada na
> linha do tempo dizendo quando nem por quem**: mutação silenciosa de registro fechado, que é precisamente
> o que a [ADR-0001](adr/0001-historico-de-transicoes-como-conceito-de-dominio.md) existe para impedir.
>
> **O custo aceito, escrito porque é irreversível:** uma ocorrência resolvida com o campo vazio **fica sem
> solução aplicada para sempre**. Não há caminho de volta, e não deve haver.
>
> **A alavanca para quem se importa já existe, e é o interruptor da D22** — *"exigir solução ao resolver"*,
> evolução prevista (§11, item 2). Ligado, `/resolver` passa a recusar sem `solucaoAplicada`, e o caso do
> campo vazio deixa de acontecer na origem em vez de ser consertado depois. Organização que quer toda
> resolução documentada liga; quem deixa desligado **decidiu** que não precisa. Até o interruptor existir,
> a indução é de interface: o formulário de resolver abre com o campo em foco, e pular exige um clique a
> mais.
>
> **A tabela normativa é a da `arquitetura.md` (Parte I, §4)**, que ganha estes dois em rodada própria; o
> que está aqui é a metade de superfície, e é ela que dá alvo ao *"teste cobrindo ao menos uma transição
> inválida"* que o `definition-of-done.md` cobra.

O que cada um tem de específico:

- **`/alterar-prioridade`** — `409 PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` em `resolvida` e `cancelada`
  (D6: dashboard que muda o passado não é dashboard). **Não gera registro de transição** — a trilha é só de
  status —, e é a razão de a alteração de prioridade não aparecer na linha do tempo (PA-21).
- **`/atribuir-responsavel`** — `422 RESPONSAVEL_SEM_VINCULO_ATIVO` se a pessoa indicada não tem vínculo
  ativo aqui, e `409 TRANSICAO_NAO_PERMITIDA` em `resolvida` e `cancelada` (quadro acima). **A
  auto-atribuição não é endpoint:** o cliente envia o próprio `pessoaId`, que
  `GET /contexto` já lhe deu — e *"em um clique"*, o nome da capacidade, conta **comando** e não toque de
  tela (quadro acima). **Reatribuir é o mesmo endpoint** com atribuição vigente: encerra a anterior
  com motivo `reatribuicao`, dispara a POL-04 (arquiva o canal 3 — **que não existe na primeira entrega**,
  ver §3.4) e devolve `reatribuicao: true`.
- **`/iniciar-atendimento`** — `409 RESPONSAVEL_NAO_ATRIBUIDO` (invariante 9, D21: *"quem está fazendo"* é
  exatamente o que se perde hoje). É a única precondição de estado que não é sobre `status`.
- **`/pausar`** — `motivo` e `observacao` são **obrigatórios no schema** (D23 virou regra estática, §3.3).
  `motivo` ∈ `aguardando_informacao_solicitante` · `aguardando_peca` · `aguardando_autorizacao` ·
  `aguardando_terceiro`. Sai de `em_analise` **ou** `em_atendimento`.
- **`/retomar`** — devolve ao **`statusAnterior` do registro de pausa**, lido pelo agregado (invariante 6).
  O cliente **não escolhe o destino**, e nem é informado dele antes: descobre pela resposta. É a expressão
  contratual de *"não há campo extra para isso"*.
- **`/registrar-solucao-aplicada`** — `409 TRANSICAO_NAO_PERMITIDA` fora de `em_atendimento` e `pausada`
  (quadro acima). **Não gera registro de transição.**
- **`/resolver`** — aceita `solucaoAplicada` no mesmo corpo, para que o formulário da D22 (campo em foco,
  induzido por UX) seja **uma requisição, não duas**. Enviado aqui, equivale a chamar
  `/registrar-solucao-aplicada` antes — e o registro de transição é um só.
- **`/cancelar`** — `motivo` e `observacao` obrigatórios (D12). Duas checagens de autorização: a partir de
  `em_atendimento` **só o Gestor cancela** (`403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO`); e o motivo é
  filtrado por papel (`422 MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL`) — Solicitante: `desistencia` ·
  `resolvido_por_conta_propria` · `aberta_por_engano` · `duplicada`; Gestor: os sete. **`ocorrenciaOrigemId`
  não é aceito** (`422 CAMPO_NAO_SUPORTADO`): o motivo `duplicada` existe, o vínculo com a original é ⬜.
- **`/avaliar`** — `nota` inteira de 1 a 5, `comentario` opcional (confirmado — `modelo-de-dados.md`, §13).
  `403 SOMENTE_O_AUTOR_PODE_AVALIAR` · `409 AVALIACAO_EXIGE_RESOLVIDA` · `409 JA_AVALIADA`. **Não é um sexto
  estado** (D1): a ocorrência continua `resolvida` depois de avaliada.

### 8.5 Atividade 3 e 7 — leitura da ocorrência

| Endpoint | Quem | Capacidade · origem | Leitura (passo 7) |
|---|---|---|---|
| `GET /ocorrencias` | `ocorrencia.ler_todas` **ou** `ler_propria` | Listar todas da organização · `ENUNCIADO · aberto` (G1) · Filtrar por categoria, status e prioridade · `ENUNCIADO · literal` (G2) · Ver as minhas ocorrências · `ENUNCIADO · aberto` (S7) | *Não triadas* · *Estado da minha ocorrência* |
| `GET /ocorrencias/{id}` | idem, sobre uma | idem | *Quem é o Responsável* · *Onde é, exatamente* |
| `GET /ocorrencias/{id}/linha-do-tempo` | quem pode ler a ocorrência | Ver a linha do tempo · `ENUNCIADO · aberto` (S9) | *Linha do tempo da ocorrência* |
| `GET /ocorrencias/{id}/trilha-de-auditoria` | quem pode ler a ocorrência | Agregado com trilha imutável · `ENUNCIADO · literal` (F4–F6) | — (auditoria, não decisão) |
| `GET /ocorrencias/{id}/anexos/{anexoId}` | quem pode ler a ocorrência | Anexar uma imagem · `ENUNCIADO · aberto` (S6) | *Onde é, exatamente* |

**`GET /ocorrencias` — a mesma URL, conjuntos diferentes.** Não há `/minhas-ocorrencias`. O resultado é
determinado pela permissão de quem pergunta:

| Quem chama | O que vem |
|---|---|
| `ocorrencia.ler_todas` (Gestor) | Todas as ocorrências da organização ativa |
| só `ocorrencia.ler_propria` (Solicitante) | Só aquelas de que ele é **autor** |

Isto **não** é um filtro implícito escondido: é a regra de visibilidade da primeira entrega, e ela está
declarada no `escopo.md` (§3.3): *"na primeira entrega toda ocorrência é visível apenas ao autor e aos Gestores"*.
A resposta devolve `visibilidadeAplicada: "todas" | "apenas_minhas"` para que o cliente possa dizer ao
usuário o que está vendo. O Gestor que também mora no prédio usa `?autor=eu` para ver as próprias — é o caso
do síndico morador (§6.4 do `modelo-de-dados.md`), resolvido por parâmetro e não por segundo vínculo.

- **Filtros:** `status` (múltiplo), `categoriaId` (múltiplo), `prioridade` (múltiplo), `autor=eu`. **São
  exatamente os três de G2, mais um.** `areaId` foi **deliberadamente não incluído**: não está em G2, seria
  `NOSSO` sem justificativa de valor, e não há índice que o sirva (§6.7 do `modelo-de-dados.md`).
- **Ordenação fixa:** `registradaEm DESC`. Não há parâmetro de ordenação, porque só existe um índice de
  listagem e ordenar por outra coluna seria varredura da partição inteira a cada página.
- **Paginação:** cursor (§7.7). Devolve `{ itens: OcorrenciaResumo[], proximoCursor, visibilidadeAplicada }`.

**`GET /ocorrencias/{id}`** devolve `OcorrenciaDetalhe`, que inclui **`acoesDisponiveis`** — a lista dos
comandos que **este** chamador pode executar **agora**. Ex.:
`["atribuir-responsavel", "pausar", "resolver", "alterar-prioridade", "cancelar"]`.

> **A lista aplica *todas* as precondições do comando, não só status × permissão.** Precisão acrescentada
> em 20/08/2026, porque a redação anterior — *"derivada da máquina de estados cruzada com as permissões"* —
> deixava de fora as precondições que a tabela de transições não expressa, e esvaziava a razão de o campo
> existir.
>
> **A fonte da derivação cresceu em 22/08/2026, e são três, não uma:**
>
> | Fonte | O que ela responde |
> |---|---|
> | A **tabela de transições** da `arquitetura.md` (Parte I, §4) | De onde sai cada um dos seis comandos que transicionam |
> | A **tabela companheira**, logo abaixo dela | De onde saem os comandos que **não** transicionam e têm endpoint: `alterarPrioridade`, `avaliar`, `atribuirResponsavel` e `registrarSolucaoAplicada`. Antes desta tabela, as duas primeiras linhas eram lidas aqui como *"invariantes 7 e 8"*, e as duas últimas **não existiam em documento nenhum** |
> | O que **não é status nem permissão** | Sobram três, e só três: a **invariante 9** (`iniciarAtendimento` exige responsável atribuído, D21) · a metade *"uma vez só"* da **invariante 8** (`avaliar` some depois de avaliada) · e as checagens de **relação** com o recurso — ser o autor, em `avaliar` e em `cancelar` |
>
> **O que isso muda na prática: nada na forma da lista, e tudo em quem a mantém.** As duas regras novas
> **são** sobre status, então entram pelo caminho normal da derivação. O que mudou é onde se procura a
> regra quando ela for alterada: dois documentos e uma lista curta, em vez de *"a máquina de estados e
> três invariantes"*.
>
> Se a lista não aplicasse as três fontes, o cliente ou ofereceria um botão que falha sempre, ou
> reimplementaria a regra — que é **exatamente a segunda cópia da máquina de estados** que este campo
> existe para impedir. Um comando ausente de `acoesDisponiveis` é um comando que **vai** responder `409` ou
> `422` se for chamado.
>
> **E a ordem da lista é declarada**, acrescentado em 21/08/2026: ela sai na ordem do enum `Comando`, com os comandos que movem a ocorrência adiante na sequência do ciclo de vida e os que não movem — `alterar-prioridade` e `cancelar` — por último. Isso evita que o cliente mantenha **uma segunda lista só para ordenar botões**, que seria a mesma duplicação por outro caminho. **Não é promessa de destaque:** em `em_atendimento`, `pausar` vem antes de `resolver`. Qual ação ganha ênfase é decisão de tela.

> ### `acoesDisponiveis` pode vir **vazia**, e isso não é erro — 22/08/2026
>
> Em `cancelada` **não há um único comando disponível para ninguém**: os cinco de transição não saem de um
> estado terminal, `alterar-prioridade` cai pela invariante 7, `avaliar` exige `resolvida`, e
> `atribuir-responsavel` e `registrar-solucao-aplicada` são recusados nos terminais pelo quadro da §8.4. A
> resposta é `200` com **`acoesDisponiveis: []`**.
>
> Em `resolvida` a lista é vazia **para todo mundo, menos para o Solicitante autor que ainda não avaliou** —
> para ele é `["avaliar"]`, e volta a ser vazia depois de ele avaliar.
>
> **Por que isto precisava estar escrito:** T-05 renderiza exatamente `acoesDisponiveis` e nada além, então
> a lista vazia é a barra de ações **desaparecendo** — o estado que mais precisa de explicação chegando como
> um `200` silencioso. Sem esta frase, a tela não distingue *"não há o que fazer"* de *"algo falhou ao
> montar a lista"*, e é a mesma classe do `R-15` do `prototipo-low-fi.md`, em que o vazio que é defeito
> chega como `200` com lista vazia.
>
> **O que a tela põe no lugar é decisão do `inventario-de-telas.md`**, não deste documento. O contrato
> garante só que a lista vazia é resposta legítima e prevista, nunca ausência de campo: `acoesDisponiveis`
> é `required` no `OcorrenciaDetalhe` e nunca vem nulo.

> **Por que o contrato carrega isso.** Sem ele, o PWA reimplementa a tabela de transições da
> `arquitetura.md` — e passa a existir uma **segunda cópia da máquina de estados**, na camada que a
> `arquitetura.md` (Parte I, §5) proíbe de conter regra de negócio. Com ele, a interface desenha botões a
> partir do que o domínio respondeu. **Alternativa rejeitada:** cliente com a tabela em código, sincronizada
> por disciplina — o mesmo tipo de acoplamento que a ADR-0001 recusou ao escolher comando em vez de campo.

**Duas leituras sobre os mesmos dados**, e o glossário as separa:

| | `linha-do-tempo` | `trilha-de-auditoria` |
|---|---|---|
| **O que é** | Transições **+** mensagens **+** atribuições, intercaladas por instante | **Só** os registros de transição, na ordem em que ocorreram |
| **Vocabulário** | `rotulo` em linguagem de gente (D19) — *"Parada — esperando você responder"* | `statusAnterior` e `statusNovo` crus, os nomes internos |
| **Para quê** | Acompanhar (S9) | Auditar (F6) — os cinco campos, um por campo |
| **Formato** | `[{ tipo: "transicao"|"mensagem"|"atribuicao", ocorridoEm, … }]` | `[{ statusAnterior, statusNovo, ocorreuEm, autor, observacao, motivoPausa, motivoCancelamento }]` |

**As duas mostram o mesmo conjunto de fatos** — mudam a forma e o vocabulário, não o recorte, e as duas são
legíveis pelo autor e pelos Gestores. **Confirmado** (§13.2, Q-API-3): a
`observacao` de cada transição, o motivo da pausa e o motivo do cancelamento **são visíveis ao
Solicitante**. Negar a trilha crua a ele não protegeria nada — é a mesma informação que a linha do tempo já
apresenta —, e esconder o porquê recriaria a pergunta que o produto veio eliminar.

> ### ⚠️ Restrição de tela que decorre disto — para o inventário de telas herdar
>
> **A tela onde a `observacao` é escrita precisa dizer, no momento da escrita, que o Solicitante vai lê-la.**
> Sem esse aviso, um Gestor escreve nota interna ali por engano — e o erro é **irreversível**, porque o
> registro de transição é imutável (§9.1): não há `PATCH`, não há `DELETE`, e não pode haver.
>
> Não é decisão de contrato — o contrato não desenha tela. É consequência **desta** decisão de contrato, e
> por isso fica escrita aqui: o inventário de telas e o protótipo precisam carregá-la. O lugar do texto que
> o Solicitante não deve ler é a **nota interna** (canal 2), que é evolução prevista — o que significa que,
> **na primeira entrega, não existe lugar nenhum para texto interno entre Gestores**. Isso é agravante, não
> atenuante, e é a razão de o aviso na interface não ser opcional.

**`GET /ocorrencias/{id}/anexos/{anexoId}`** devolve **`302`** para uma URL assinada de leitura, válida por
10 minutos (§10). Não devolve bytes: a API não faz proxy de arquivo. `404 ANEXO_NAO_ENCONTRADO` quando o
anexo não é desta ocorrência ou não existe — **a mesma resposta para os dois**, pela §6.3.

> **Por que o anexo é endereçado, e não singular.** `/ocorrencias/{id}/anexo` teria codificado o escopo na
> própria URL — e URL é a coisa mais cara de trocar num contrato. O `anexoId` endereça a linha, sobrevive
> ao dia em que houver mais de uma, e **o cliente nunca o constrói**: ele chega pronto em
> `OcorrenciaDetalhe.anexos[].url`. A URL continua **estável** (o `anexoId` é imutável), que é a
> propriedade de que o service worker depende para cachear — a razão da §10.4.
>
> **Não existe `GET /ocorrencias/{id}/anexos`.** A lista já vem no detalhe, e uma coleção separada seria um
> segundo caminho para o mesmo dado. A regra da §5.1 pede endpoint para todo **modelo de leitura**; o
> modelo de leitura aqui é a ocorrência, e o anexo é campo dela. Ver §9.9.

### 8.6 Atividade 7 — conversa

| Endpoint | Quem | Capacidade · origem | Comando/Leitura |
|---|---|---|---|
| `GET /ocorrencias/{id}/comentarios` | `ocorrencia.comentar` sobre aquela ocorrência | Comentar com os Gestores · `ENUNCIADO · aberto` (S8, G6) + D9 | *O que já me falaram* |
| `POST /ocorrencias/{id}/comentarios` | idem | idem | `Enviar mensagem no canal` |

**O recurso é `comentarios`, não `canais/{tipo}/mensagens`.** *Comentário* é o **canal 1** (Gestores +
Solicitante) e é termo do glossário; os canais 2 e 3 são ⬜, evolução prevista. Expor a máquina de canais agora
significaria um `tipo` polimórfico com dois valores inalcançáveis. Quando os outros dois entrarem, ganham
caminho próprio (`/notas-internas`, `/atribuicoes/{id}/mensagens`) — §11.

- `POST` recebe `{ texto }`, devolve `201` com `{ id, texto, autor{pessoaId,nome}, criadoEm }`, e atualiza
  `ocorrencias.atualizada_em` (a desnormalização §7.4 do `modelo-de-dados.md`).
- **Participantes derivados, nunca listados:** canal 1 = Gestores da organização + `autorPessoaId` da
  ocorrência (D9). Quem não é nenhum dos dois recebe `404` da ocorrência, não `403` do comentário (§6.2).
- **Sem edição e sem exclusão** — o modelo não tem coluna para isso e nada foi decidido (§6.11 do `modelo-de-dados.md`).

### 8.7 Atividade 8 — gerir

| Endpoint | Quem | Capacidade · origem | Leitura (passo 7) |
|---|---|---|---|
| `GET /dashboard` | `dashboard.ler` — Gestor | Dashboard com indicadores · `ENUNCIADO · aberto` (G8) · Backlog por status e por categoria · `NOSSO` (D19) · Média das avaliações · `NOSSO` (D19) · Recorrência por categoria e por área · `NOSSO` (D19) · **Tempo médio de resolução, mês a mês** · `NOSSO` (D19) | *O dashboard: o que ele muda no mês* |

**Um endpoint, cinco capacidades.** A alternativa — cinco endpoints, um por indicador — foi rejeitada por
uma razão de plataforma: o dashboard é **uma tela**, e numa aplicação com **escala a zero** (RNF5) cinco
requisições podem significar cinco esperas de cold start onde uma bastaria.

Parâmetros: `de` e `ate` (`date`, em America/Sao_Paulo — §7.5), com padrão de **90 dias**. Resposta:

```json
{
  "periodo": { "de": "2026-05-23", "ate": "2026-08-20" },
  "backlogPorStatus":   [{ "status": "aberta", "statusRotulo": "Aberta", "quantidade": 12 }],
  "backlogPorCategoria":[{ "categoria": { "id": "…", "nome": "Vazamentos" }, "quantidade": 8 }],
  "mediaDasAvaliacoes": { "media": 4.3, "avaliadas": 31, "resolvidas": 47 },
  "recorrenciaPorCategoria": [{ "categoria": {…}, "porMes": [{ "mes": "2026-07", "quantidade": 5 }] }],
  "recorrenciaPorArea":      [{ "area": {…},      "porMes": [{ "mes": "2026-07", "quantidade": 5 }] }],
  "tempoMedioDeResolucao": { "porMes": [{ "mes": "2026-07", "horas": 41.5, "resolvidas": 9 }] }
}
```

- **`backlog` é instantâneo** (fotografia de agora, ignora `de`/`ate`); **recorrência é série mensal** dentro
  da janela. São perguntas diferentes e a resposta diz qual é qual.
- **`mediaDasAvaliacoes` respeita a janela, ancorada no instante da RESOLUÇÃO** — é o terceiro caso, e não
  o primeiro nem o segundo: não é fotografia de agora e não é série mensal, é **um número só, sobre um
  recorte de período**. `resolvidas` conta as ocorrências resolvidas dentro de `de`/`ate`; `avaliadas` conta
  quantas **dessas** foram avaliadas; `media` é a média **dessas** notas. É o que mantém
  `avaliadas ≤ resolvidas` verdadeiro por construção — sem o que a frase de tela *"X de Y resolvidas
  avaliadas"* e o objetivo **O4** deixam de fazer sentido — e o que faz `mediaDasAvaliacoes.resolvidas`
  fechar com a soma de `tempoMedioDeResolucao.porMes[].resolvidas` na mesma janela (critério **34.5**).
  A âncora é a resolução e **nunca `avaliada_em`**: avaliação que chega depois do fim da janela conta na
  janela em que a ocorrência foi resolvida.
  *(Acrescentado em 30/08/2026: até esta data a lista classificava dois dos três casos e calava sobre a
  média — quem decidia era um `<em>` no protótipo, o bloco 5 rotulado "no período". Decisão do hub de
  29/08/2026, ao responder a P3 da spec do item 32. Item 27 da fila da frente de documentação.)*
- `mediaDasAvaliacoes` traz `avaliadas` e `resolvidas` juntas de propósito: sem o denominador, a média mente
  quando poucos avaliam — que é o **PA-16**, ainda aberto.
- **`tempoMedioDeResolucao` é série mensal e vem com o denominador**, como a média das avaliações: `horas`
  sem `resolvidas` esconde que o mês teve duas ocorrências. É **tempo de calendário** — do registro à
  resolução, pausas incluídas —, porque a separação entre calendário e tempo ativo é evolução prevista.
  Meses sem nenhuma resolução aparecem com `horas: null` e `resolvidas: 0`, em vez de sumir: buraco na
  série é informação, e omitir o mês faria a linha do gráfico mentir.

> **Este indicador entrou por decisão de 20/08/2026, e a razão vale registrar.** Ele estava na D19 e
> no passo 7, mas **não constava da tabela de capacidades** do `escopo.md` — nem como ✅ nem como ⬜ (era a
> contradição C-4). O que decidiu não foi o enunciado, que aqui é genérico (*"visualizar indicadores em um
> dashboard"*), e sim o `modelo-de-dados.md` §6.8, que justifica o índice `(organizacao_id, ocorreu_em DESC)`
> citando literalmente *"tempo médio de resolução mês a mês"*. Havia um índice **já pago** por uma
> capacidade que não estava no escopo — e o cálculo é uma agregação sobre a trilha, usando esse índice.
> O `escopo.md` passa a 41 itens ✅ de 62 — e a **42 de 63** ainda no mesmo dia, quando o conserto do
> **PA-25** acrescentou *remover vínculo sem histórico*. A §14 já conta os 42.

### 8.8 O que o cliente recebe — os três formatos de ocorrência

| Schema | Onde aparece | Campos |
|---|---|---|
| `OcorrenciaResumo` | `GET /ocorrencias` | `id` · `titulo` · `status` · `statusRotulo` · `motivoPausa\|null` · `prioridade` · `categoria{id,nome}` · `area{id,nome,tipo}` · `autor{pessoaId,nome}` · `responsavel{pessoaId,nome}\|null` · `quantidadeDeAnexos` · `avaliada` · `registradaEm` · `atualizadaEm` |
| `OcorrenciaDetalhe` | `GET /ocorrencias/{id}` e **resposta de todo comando** | tudo do resumo **+** `descricao` · `localizacaoComplemento` · `anexos[]` · `solucaoAplicada\|null` · `avaliacao{nota,comentario,avaliadaEm}\|null` · `ultimaTransicao` · `acoesDisponiveis[]` |
| `RegistroDeTransicao` | trilha e `ultimaTransicao` | `statusAnterior\|null` · `statusNovo` · `ocorreuEm` · `autor{pessoaId,nome}` · `observacao\|null` · `motivoPausa\|null` · `motivoCancelamento\|null` |
| `EventoDaLinhaDoTempo` | `GET /ocorrencias/{id}/linha-do-tempo` | **três formas**, distinguidas por `tipo`, com `tipo` · `ocorridoEm` · `autor{pessoaId,nome}` em todas: `transicao` (+ `rotulo` · `statusAnterior\|null` · `statusNovo` · `observacao\|null` · `motivoPausa\|null` · `motivoCancelamento\|null`) · `mensagem` (+ `texto`) · `atribuicao` (+ `responsavel` · `encerradaEm\|null` · `motivoEncerramento` de `reatribuicao\|recusa\|null`) |

> **A listagem leva a contagem; o detalhe leva a lista.** Uma lista de um elemento em cada item de página é
> verbosidade na leitura mais chamada do produto, e a tela só precisa da marca *"com foto"*, que é
> `quantidadeDeAnexos > 0`. É **contagem e não booleano** porque o número já é a forma final: no dia do
> segundo anexo, esta resposta continua correta **sem mudança de schema**.
>
> E o `RegistroDeTransicao` **não muda**, o que vale dizer em voz alta: **a trilha não conhece anexo**, e é
> bom que continue assim.

> ### Correção — 30/08/2026 — a linha do tempo NÃO devolve `RegistroDeTransicao`, e o resumo tem quatorze campos
>
> **Duas correções na mesma tabela, e as duas são de prosa contra o `openapi.yaml`, que é quem tem
> verificador mecânico.**
>
> **(a) A linha do `RegistroDeTransicao` dizia *"trilha, linha do tempo e `ultimaTransicao`"*.** A linha do
> tempo devolve `EventoDaLinhaDoTempo`, que é um `oneOf` de **três** formas com `tipo` e `ocorridoEm`; o
> `RegistroDeTransicao` tem `ocorreuEm`, **sem** `tipo` e **sem** `rotulo`. A **§8.5 deste mesmo documento
> já descrevia o formato certo** — as duas seções discordavam entre si, e o código do item 29 emite o que o
> YAML publica. A linha passou a dizer *"trilha e `ultimaTransicao`"*, e a tabela ganhou a quarta linha.
> **São três formas e não duas:** os critérios **30.7** e **30.8** dão dono ao `EventoMensagem`, e a partir
> do item 30 as três têm produtor. *(Item 24 da fila da frente de documentação; achado **P-1** do plano do
> item 29, cuja redação dependia da P1 da spec do item 30, respondida em 29/08/2026.)*
>
> **(b) A linha do `OcorrenciaResumo` listava treze campos.** O décimo quarto é **`avaliada`** — booleano,
> obrigatório, `avaliacao_nota is not null` —, e sem ele a lista não consegue oferecer *"Conte como foi"*:
> ela sabe o status e sabe quem é o autor, e não teria como saber se a avaliação já aconteceu (critério
> **27.5**). **É booleano e não contagem**, e o precedente de `quantidadeDeAnexos` não se aplica: ali o
> `0..1` é por escopo, aqui é **do schema** — a invariante 8, com `CHECK` no banco.
> **`OcorrenciaDetalhe` herda o campo pelo `allOf` e passa a carregar `avaliada` e `avaliacao`** — é a
> mesma relação `quantidadeDeAnexos` ↔ `anexos` que a nota acima descreve, e não duplicação acidental.
> **`acoesDisponiveis` continua fora do resumo** (critério 14.5): aqui entra **fato da ocorrência**, nunca
> afazer calculado por leitor. *(Item 21 da fila; decisão do hub de 29/08/2026, P1 da spec do item 27. A
> fila endereçava este conserto à §12, que é* Suposições declaradas *e não descreve schema nenhum — o lugar
> é esta §8.8.)*
>
> **O título da seção continua dizendo *"os três formatos de ocorrência"* e a tabela tem quatro linhas, de
> propósito.** Os três formatos **da ocorrência** são o resumo, o detalhe e o registro de transição — é o
> que a `arquitetura.md` §5.5 conta ao dizer *"quem monta estes três formatos"*, e essa contagem não mudou.
> `EventoDaLinhaDoTempo` **não é formato de ocorrência**: é o envelope dos eventos, e está nesta tabela
> porque a primeira metade do título — *"o que o cliente recebe"* — é onde se procura por ele.

**`statusRotulo` é calculado no servidor e depende de quem pergunta.** O Solicitante lê *"Em execução"*
onde o Gestor lê *"Em atendimento"* — o rótulo é função de (`status`, `motivoPausa`, papel de quem lê).
Pôr essa função no cliente significaria reimplementá-la em cada cliente futuro e deixá-la divergir; pôr no
servidor mantém uma fonte só. **Custo declarado:** é apresentação viajando na API, o que um purista
recusaria.

**A tabela de rótulos é do glossário, não deste contrato** — aprovada na §13.2 (Q-API-2). O contrato define o **campo** e a **regra
de derivação**; o texto de cada rótulo vive onde vive o termo *Rótulo exibido*. Os exemplos do YAML usam exatamente os rótulos aprovados.

**A regra tem uma consequência que muda o schema:** `pausada` não tem **um** rótulo, tem **quatro** — um
por motivo de pausa, e só do lado do Solicitante (*"Parada — esperando material chegar"*). Do lado do
Gestor o rótulo é sempre *"Pausada"*, o que esconderia justamente a informação que a D8 existe para
tornar visível. Por isso **`OcorrenciaResumo` carrega `motivoPausa`**, nulo fora de `pausada`: sem ele, a
lista do Gestor mostraria quatro esperas diferentes com a mesma palavra.

**`RegistroDeTransicao` tem os cinco campos do F5, um por campo, sem serialização.** `autor` é a Pessoa
(*autor da transição*, colisão nº 2 do glossário) — nunca o Usuário.

> **Quem monta estes três formatos.** É a metade adaptadora da camada de Interface, em
> `src/interface/projecoes/` — ver [`arquitetura.md`](arquitetura.md) §5.5. Não é o Domínio, que não
> conhece HTTP; e **não é o route handler**, por causa da §5 deste documento: existem **dois transportes**
> para a mesma leitura, e uma projeção que morasse no handler não existiria para o Server Component — as
> duas estradas deixariam de produzir a mesma resposta, que é exatamente o que a regra *"é a mesma função
> de aplicação, chamada por dois transportes"* existe para impedir. Na Clean Architecture da Fase 5 isso é
> o **Presenter** (aula 5, p.8), adotado como **funções de projeção puras** — o que se adota é o lugar e a
> responsabilidade, não a cerimônia.

---

## 9. O que o contrato **não** expõe

Esta seção existe para ser lida antes de qualquer ferramenta gerar CRUD.

**9.1 · Nada sobre registro de transição, exceto ler.**

> **Não existe `POST /registros-transicao`. Não existe `PATCH`. Não existe `DELETE`. Não existe recurso
> `/registros-transicao` de nível superior.**

Registro de transição é **objeto de valor imutável dentro do limite do agregado** (`arquitetura.md`,
Parte I, §4) e nasce **como efeito** de um comando, na mesma operação — invariante 2 da ADR-0001. As duas
únicas formas de alcançá-lo pela API são `GET .../trilha-de-auditoria` e `GET .../linha-do-tempo`, e o único
jeito de criar um é executar um comando. No banco a mesma regra tem gatilho que recusa `UPDATE` e `DELETE`
(§6.8 do `modelo-de-dados.md`); aqui ela é ausência de rota. **Se um dia aparecer um endpoint de escrita nesse recurso, o
requisito central do desafio foi perdido** — e é isso que esta seção existe para tornar difícil de fazer por
descuido.

**9.2 · `GET /pessoas` — nem ele, nem `/pessoas/{id}`, nem busca de pessoa.** §4.6.

**9.3 · Nenhum `DELETE`, com uma exceção nomeada.** Ocorrência não se apaga (cancela-se); categoria e área
não se apagam (desativam-se); mensagem não se apaga. Decorre do RNF9 e do `ON DELETE RESTRICT` (§2.5 do
`modelo-de-dados.md`): o banco recusaria de qualquer forma, e o contrato nem oferece.

**A exceção é `DELETE /vinculos/{pessoaId}`** (§8.2, P6), e ela cabe exatamente porque o `RESTRICT` a
delimita: só passa o vínculo **sem nenhuma linha dependente**, que é o único caso em que não há histórico a
preservar. Vínculo **com** histórico não se apaga — revoga-se, e revogar é ⬜ evolução prevista.

**9.4 · Nenhum `PATCH` de ocorrência.** §3.5. Em particular, **`status` não aparece em nenhum schema de
entrada** — a verificação é textual e cabe no Definition of Done.

**9.5 · Nada de autenticação.** Criar conta, entrar, sair, redefinir senha: Supabase Auth (§4.1). O contrato
não emite, não renova e não revoga sessão.

**9.6 · Nada de organização na URL.** Não existe `/organizacoes/{id}/…`. `POST /organizacoes` é a única
operação sobre a coleção, e não há `GET /organizacoes` — listar organizações do sistema é a versão
multi-tenant do `GET /pessoas`.

**9.7 · Nada da evolução prevista.** Sem `/notificacoes`, `/adesoes`, `/convites`, `/notas-internas`,
`/atribuicoes/{id}/mensagens`, `/filtros-rapidos`, `reabrir`, `recusar-atribuicao`,
`reportar-execucao-concluida`. **`reabrir` merece nota própria:** ele **não existe e não vai existir** —
`Resolvida` e `Cancelada` são terminais de verdade (D24), e problema que volta é ocorrência nova vinculada à
original. O glossário chegou a listá-lo como comando na definição de *Transição de status*, e foi corrigido em
20/08/2026 — o registro do erro está na contradição C-1 da §13.

**9.8 · Nada de busca textual.** Não há `?q=`. Nenhuma história pede busca por texto, e o índice GIN
correspondente foi deliberadamente não criado (§6.7 do `modelo-de-dados.md`). Acrescentar o parâmetro sem o índice seria
varredura em toda listagem.

**9.9 · Nenhuma coleção de anexos, e nenhum recurso `/anexos` de nível superior.**

> **Existe exatamente uma URL de anexo: `GET /ocorrencias/{id}/anexos/{anexoId}`.** Não há
> `GET /ocorrencias/{id}/anexos`, não há `POST` nessa coleção, não há `DELETE`, e não há
> `/anexos/{id}` fora da ocorrência.

Acrescentado em 21/08/2026, quando o anexo virou tabela (§6.16 do `modelo-de-dados.md`) — porque **é exatamente aqui que
uma ferramenta de scaffolding olharia uma tabela nova e geraria cinco rotas**.

Cada ausência tem motivo próprio: a **coleção de leitura** duplicaria o campo `anexos` que
`OcorrenciaDetalhe` já traz; o **`POST` na coleção** contornaria a reivindicação da §10, que é onde a
validação acontece; o **`DELETE`** violaria o P6 e, pior, apagaria evidência de uma ocorrência viva; e o
**recurso de nível superior** repetiria o erro que a §9.6 já nomeia para organização — é a ocorrência que
decide quem vê o anexo, então o anexo não tem endereço fora dela.

**Anexar depois do registro continua sendo PA-01, em aberto** (§12, S-A8). Quando for decidido, o caminho
é um comando na ocorrência — não um `POST` em coleção de anexo.

---

## 10. Upload do anexo

O requisito manda em duas direções ao mesmo tempo: **RNF6** (registro completo em menos de um minuto pelo
celular, com foto) e **RNF8** (imagem comprimida **no próprio aparelho** para ~400 KB, aceite de até 10 MB no
seletor). E a `arquitetura.md` (tópico 3 e tópico 5) já decidiu o mecanismo: *"upload por URL assinada
emitida pelo servidor"*.

> **Nota de revisão — 21/08/2026.** Esta seção falava em *imagem* porque o anexo era uma coluna chamada
> `imagem_caminho`. Ele passou a ser a tabela **`anexos`** (§6.16 e §7.8 do `modelo-de-dados.md`), e o texto
> passa a falar em *anexo*. **O mecanismo não mudou em nada** — SAS de escrita, ticket assinado, validação
> na reivindicação, etiqueta `pendente`/`confirmado` e faxina por ciclo de vida continuam exatamente como
> estavam, pelas mesmas razões. **O que mudou é que a reivindicação passou a escrever uma linha**, e isso
> tem consequência em dois pontos, os dois marcados abaixo: o passo (3) da §10.2 e o **quarto caminho** da
> §10.3, que não existia.

### 10.1 A decisão

> **O cliente sobe os bytes direto para o Azure Blob Storage, com uma credencial temporária (SAS) emitida
> pela API. A API nunca recebe, nunca repassa e nunca armazena bytes de anexo — ela emite credencial e
> valida o resultado.**

O que pesa contra passar pela API é a plataforma: o Container Apps cobra em **vCPU-segundos e GiB-segundos**
(ADR-0004), e *streaming* de arquivo é exatamente o trabalho que consome franquia sem produzir nada. Com 400
KB por ocorrência e 2.000 ocorrências (RNF3) é pouco em absoluto — mas é pouco em troca de nada, e o desenho
com SAS custa o mesmo em complexidade.

**O que pesa contra o SAS é a validação**, e é aqui que este contrato dá a resposta que o mecanismo sozinho
não dá: **a validação não acontece no upload, acontece na hora de reivindicar o anexo.**

### 10.2 O fluxo, inteiro

```
Solicitante escolhe a foto
   │
   │ (1) o cliente comprime para ~400 KB / 1600px no maior lado  ── RNF8, no aparelho
   ▼
POST /anexos/autorizacoes  { tipoConteudo, tamanhoBytes }
   │   ← 201 { chave, chaveMiniatura, ticket, estado: "pendente",
   │           upload:          { url, metodo: "PUT", cabecalhos, expiraEm },
   │           uploadMiniatura: { url, metodo: "PUT", cabecalhos, expiraEm } }
   ▼
PUT <url do Blob>  (bytes)              ── os DOIS objetos, direto para o Azure, fora da API
PUT <url da miniatura>  (bytes)            um ticket, um slot do limite, dois PUT em paralelo
   │
   │ (2) enquanto isso, o Solicitante ainda está digitando a descrição   ── RNF6
   ▼
POST /ocorrencias  { …, anexos: [ { chave, ticket, titulo? } ] }
   │   (3) o servidor confere o ticket, faz HEAD nos objetos,
   │       marca os objetos como confirmados e, na MESMA transação:
   │          INSERT ocorrencias · INSERT registros_transicao · INSERT anexos
   ▼
201 OcorrenciaDetalhe  — com anexos[] (url e miniaturaUrl) e ultimaTransicao
```

**(1)** A compressão é do cliente. A API **não pode forçá-la** — só recusar o que não couber: a autorização é
emitida com `tamanhoBytes` declarado e é recusada acima de **512 KB** (os 400 KB do RNF8 mais margem) ou com
`tipoConteudo` fora de `image/jpeg` e `image/png`.

> **A miniatura sai do mesmo passe — 22/08/2026.** O cliente já redimensiona para 1600 px e comprime para
> ~400 KB; gerar uma versão de ~200 px e ~15 KB é a mesma operação de canvas, no mesmo momento. **Nenhum
> trabalho novo de servidor, e nenhum byte a mais atravessando o contêiner da aplicação.**
>
> **É opcional.** Cliente que não gerar miniatura simplesmente não usa `uploadMiniatura`; o objeto pendente
> é recolhido pela faxina como qualquer outro, e `anexos.thumbnail_chave` fica nulo. O produto funciona
> igual — só a listagem perde a prévia.
>
> **Por que uma autorização e não duas.** Duas chamadas custariam duas idas e voltas dentro de um orçamento
> de 60 segundos, e consumiriam **dois** slots do limite de 30 por hora. Com uma, continua sendo **um
> ticket, um slot, uma reivindicação, uma transação** — o DG-5 mantém a forma que ele tem hoje.

**(2)** É o passo que faz o RNF6 caber: o upload roda **em paralelo** com o preenchimento do formulário, e o
`POST /ocorrencias` transporta 200 bytes de JSON em vez de 400 KB de foto.

**(3)** É a validação que o SAS supostamente perderia. O `ticket` é um **token assinado pelo servidor**
contendo `chave`, `organizacaoId`, `pessoaId`, `tipoConteudo`, `tamanhoMaximo` e expiração de 15 minutos. Ao
reivindicar, o servidor confere a assinatura, confere que o portador é o mesmo que pediu, e faz um **`HEAD`
no objeto** — que devolve tamanho e tipo reais sem baixar nada. Se o objeto não existe, excede o teto ou tem
outro tipo: `422 ANEXO_NAO_RECONHECIDO` ou `422 ANEXO_ACIMA_DO_LIMITE`, e a ocorrência **não é criada**.
Se passa, o servidor **marca o objeto como confirmado** — é o que a §10.3 explica.

> **O que o passo (3) ganhou com a tabela — 21/08/2026.** Antes ele terminava em *"grava
> `imagem_caminho` = chave"*, uma escrita na mesma linha da ocorrência. Agora ele grava **uma linha em
> `anexos`**, com `tipo` (derivado do `tipoConteudo` autorizado), `tipo_conteudo` e `tamanho_bytes`
> **vindos do `HEAD`, não do que o cliente declarou**, e `anexado_por_pessoa_id`.
>
> **E o que ele ganhou em 22/08/2026:** `fonte` (`azure_blob`, do enum — é o que permite migração
> incremental de provedor), `titulo` (o que o cliente mandou, se mandou), `nome_arquivo` (lido do
> `Content-Disposition` do objeto, se houver) e `thumbnail_chave` — **preenchida só se o `HEAD` da
> miniatura passar**. Miniatura ausente ou inválida **não derruba o registro**: a coluna fica nula, o
> objeto pendente é recolhido pela faxina, e a ocorrência é criada. É a diferença entre um anexo, que é
> evidência, e uma prévia, que é conveniência de listagem.
>
> **As três escritas são uma transação só.** A invariante 2 da ADR-0001 já exigia que ocorrência e registro
> de transição nascessem juntos; o anexo entra no mesmo `BEGIN … COMMIT`. Não é mecanismo novo — é uma
> instrução a mais dentro do que já era atômico.
>
> **E o `tipo` nunca vem do cliente.** É o que mantém `tipo_anexo` fora de todo schema de entrada, e é o
> que torna aceitar um tipo novo uma mudança aditiva pela regra da §11.

> **Por que ticket assinado e não uma tabela de uploads pendentes.** Uma tabela seria o desenho óbvio — e é
> **mudança no modelo de dados**, que este artefato não pode decidir. O token assinado carrega o mesmo
> estado sem linha nenhuma, com uma propriedade extra: expira sozinho.
>
> **A entrada de `anexos` não reabre esta escolha, e vale dizer por quê:** `anexos` guarda o objeto
> **reivindicado**, não o pendente. Ela nasce no `COMMIT` e nunca existe antes dele — que é exatamente o
> oposto de uma tabela de uploads pendentes, que precisaria existir *antes* do upload e ser limpa depois.
> A suposição **S-A13** continua de pé, sem emenda.
>
> **Precisão de 30/08/2026 — e agora há uma segunda tabela que também não é essa.** O item 13a trouxe
> `autorizacoes_de_upload` (§6.18 do `modelo-de-dados.md`), e ela **nasce na emissão**, que é justamente
> quando a tabela recusada existiria. **O que a separa não é o momento, é o leitor:** ela é **livro-caixa
> de emissão**, com um único leitor — `POST /anexos/autorizacoes`, para contar a última hora —, e **nada
> no caminho de reivindicação a lê**. O `ticket` continua sendo token assinado que expira sozinho; o
> `commit` confere assinatura e objeto, nunca a tabela. Ela não guarda `chave`, não guarda estado de
> objeto, e nenhuma consulta a liga a um anexo. **A S-A13 continua de pé pela segunda vez, e o teste que a
> sustenta passou a ser escrito em voz alta** — porque *"a tabela nasce depois"* já não bastaria.

### 10.3 O objeto abandonado — o terceiro caminho

O fluxo acima cobre o caso feliz e o fraudulento. **Falta o abandonado**, e ele é o mais comum dos três:
autorização emitida, objeto enviado, e o `POST /ocorrencias` **nunca acontece** — o Solicitante fechou o
aplicativo, perdeu a rede na garagem, desistiu de reclamar.

O objeto fica no storage **e nada no sistema sabe que ele existe**: não há linha no banco (por desenho, §10.2),
o ticket era token e expirou, e ninguém guarda a chave. **Não é problema de custo** — 400 KB a alguns
centavos por ano é irrelevante. É problema de **ausência de limite**: qualquer pessoa autenticada repete a
chamada quantas vezes quiser, e nada apaga o que ela deixou.

**A decisão, em duas peças:**

> **1 · Todo objeto nasce marcado `estado=pendente`. Reivindicar troca a marca para `estado=confirmado`.
> Uma regra de ciclo de vida do contêiner apaga o que continuar `pendente`.**
>
> **2 · `POST /anexos/autorizacoes` é o único endpoint com limite de chamadas: 30 por Pessoa por hora,
> `429` acima disso.** **Quem conta é uma tabela**, não a memória do processo — `autorizacoes_de_upload`,
> §6.18 do `modelo-de-dados.md`: com `--max-replicas 2`, um contador em processo concederia 60 por hora, e
> a segunda réplica sobe exatamente sob carga. *(A menção à tabela entrou em 30/08/2026; o número não
> mudou.)*

A marca é uma **etiqueta de índice do próprio objeto** (*blob index tag*) **[FONTE EXTERNA]**. **Quem a
escreve é o CLIENTE, no `PUT`** — a SAS é emitida com permissão de etiqueta, e o cabeçalho `x-ms-tags:
estado=pendente` já vai entregue em `upload.cabecalhos`, que é campo obrigatório do destino. **Trocá-la
para `confirmado` é do servidor, na reivindicação**, e é **uma chamada de metadado** — não move bytes, não
passa nada pelo contêiner da aplicação, e portanto **não desfaz a razão de a §10.1 ter escolhido SAS**. A
regra de ciclo de vida filtra por essa etiqueta e apaga o que ficar para trás.

> **Corrigido em 30/08/2026 — a redação anterior descrevia algo impossível.** Ela dizia que a etiqueta era
> *"escrita pelo servidor **na emissão** e trocada na reivindicação"*. **Na emissão o objeto não existe:**
> o servidor só assina a SAS, e quem cria o blob é o `PUT` do cliente, depois. Não há o que etiquetar no
> instante que a frase descrevia.
>
> **A forma do contrato NÃO muda** — `cabecalhos` já era campo obrigatório do destino, e a lista de
> cabeçalhos é aberta. Muda o **autor** da etiqueta, e só. **Isto não é gatilho da variante de prefixo**,
> que esta seção reservou para outro caso: conta de storage sem suporte a etiqueta de índice.
>
> *(Emenda decidida pelo hub em 25/08/2026, ao especificar o item 13a; item 12 da fila da frente de
> documentação.)*

**Por que a etiqueta, e não mover de prefixo.** A alternativa — subir em `pendentes/`, **copiar** para o
prefixo definitivo ao reivindicar e apagar o original — dá o mesmo resultado e é o desenho mais comum. Foi
recusada por três motivos, e o terceiro é o que decidiu:

1. São **três operações** (copiar, apagar, tratar falha no meio) contra **uma**.
2. A cópia é assíncrona do lado do provedor: reivindicar passaria a ter um estado transitório a acompanhar,
   dentro da transação que cria a ocorrência.
3. **A chave mudaria entre a autorização e a reivindicação** — o cliente recebe uma, o banco guarda outra. A
   §2.8 do `modelo-de-dados.md` pede uma **chave opaca**; um valor cujo prefixo codifica o estado do objeto não é
   opaco, é caminho com significado, e volta a acoplar a coluna à organização física do storage.

**Fica declarada a dependência:** a etiqueta de índice existe em conta de storage de uso geral, e **não**
existe em conta com espaço de nomes hierárquico. Se a conta provisionada não a suportar, o caminho de volta
é a variante de prefixo acima — mesmo resultado, três operações, e a chave definitiva passa a ser escrita
pelo servidor no momento da reivindicação.

**O que o prazo realmente significa, sem arredondar para bonito.** A regra de ciclo de vida do provedor tem
granularidade de **dias** e roda uma vez por dia: com `1 dia`, um objeto abandonado vive **entre 24 e 48
horas**. Não há como apertar isso com o mecanismo do provedor, e apertar com código exigiria uma varredura
agendada — que é justamente o tipo de peça que a `arquitetura.md` (tópico 1, componente 7) recusou ao
declarar que não há operação assíncrona no MVP. O ticket expira em 15 minutos, então **um objeto que
sobreviveu 15 minutos sem ser reivindicado já é irrecuperável** — as ~47 horas restantes são espera de
faxina, não janela de risco.

**O limite de 30 por hora é o único do contrato**, e a razão é específica: este é o **único endpoint que
permite a uma pessoa autenticada consumir armazenamento externo sem criar nenhum registro de domínio**.
Todos os demais criam linha em tabela, e portanto já esbarram nas regras do próprio domínio. Não há política
geral de limitação de tráfego no MVP — declarar uma seria fingir uma capacidade operacional que não
construímos.

**O terceiro caso residual, declarado.** A troca da etiqueta para `confirmado` acontece **antes** do
commit da transação que cria a ocorrência. Se a transação falhar depois disso, o objeto fica `confirmado`
**sem nenhuma linha que o referencie**: está fora do banco e fora da faxina, que só recolhe `pendente`. Ele
vive para sempre.

A ordem documentada continua sendo a **mais segura das duas**: se a etiqueta fosse trocada depois do
commit, a falha inversa produziria uma ocorrência **apontando para um objeto que a faxina vai apagar** — e
perder o anexo de uma ocorrência que existe é pior que guardar um objeto que ninguém referencia. Trocar a
ordem move o custo do byte desperdiçado para o dado perdido.

O que falta é isto estar escrito ao lado dos outros dois caminhos, e não é. O volume é desprezível — exige
falha de transação **entre** duas operações que distam milissegundos —, mas *"desprezível"* precisa ser
afirmado, não presumido. Levantado ao desenhar o DG-5 de
[`fluxos-e-diagramas.md`](fluxos-e-diagramas.md).

**E há um quarto residual, irmão deste, que nasce de a etiqueta ser escrita pelo cliente.** Se o cliente
**omitir** o cabeçalho `x-ms-tags`, o objeto sobe **sem etiqueta nenhuma** — e aí ele não casa com a regra
*"apaga `pendente`"* nem com *"mantém `confirmado`"*, porque regra de ciclo de vida filtra por **tag igual
a valor**, nunca por ausência. **Esse objeto não é recolhido nunca.**

O que o torna inofensivo é o **critério 13b.6**: a reivindicação **recusa objeto sem `estado=pendente`**.
Com ele, omitir a etiqueta não compra nada — não vira anexo, não vira ocorrência — e só queima a própria
franquia de 30 por hora de quem omitiu, que é o limite da peça 2 acima. **Custo de estar errado:** se um
dia a reivindicação passar a aceitar objeto sem etiqueta, este residual deixa de ser inofensivo e vira
armazenamento acumulado sem teto — a defesa é o 13b.6, não a faxina.

*(Acrescentado em 30/08/2026, junto com a correção sobre quem escreve a etiqueta. Item 12 da fila da frente
de documentação.)*

> ### Reconferido em 21/08/2026, com a tabela no lugar da coluna — a forma **não** muda, e a janela cresce
> ### uma inserção
>
> **Não muda:** a etiqueta continua sendo trocada antes do `commit`; a falha continua deixando um objeto
> `confirmado` sem referência; a faxina continua só recolhendo `pendente`; o argumento de que esta ordem é
> a mais segura das duas continua valendo, **e continua valendo pelo mesmo motivo** — perder o anexo de uma
> ocorrência viva é pior que guardar um órfão de 400 KB.
>
> **Muda um detalhe, e ele é a favor:** a transação passou de duas inserções para três, então o intervalo
> entre a troca da etiqueta e o `commit` ganhou **uma instrução**. Continua na ordem de milissegundos, e o
> `INSERT` a mais é numa tabela sem gatilho e com duas chaves estrangeiras já validadas. A probabilidade
> muda de desprezível para desprezível.
>
> **O que a tabela dá de novo, e é uma melhoria real:** com a coluna, o objeto órfão era **impossível de
> encontrar** — a única forma de saber quais chaves o banco conhece era varrer `ocorrencias.imagem_caminho`
> linha a linha. Com `anexos.chave` sob índice único, comparar o inventário do contêiner com as chaves
> conhecidas vira uma consulta. **A faxina do órfão continua não existindo**; deixou de ser inviável.

> ### O quarto caminho — apareceu com a tabela, e não existia antes
>
> `UNIQUE (chave)` em `anexos` (§6.16 do `modelo-de-dados.md`) faz o banco recusar a **segunda** reivindicação do mesmo
> objeto. Isso interage com um comportamento que já estava desenhado, e a interação precisa estar escrita.
>
> **A tela reenvia a mesma `chave` quando o `POST /ocorrencias` cai por rede** — é a suposição **S-T7** do
> inventário de telas, e existe para a foto não subir duas vezes dentro dos 15 minutos do ticket. Se a
> primeira chamada tiver **comitado** e apenas a resposta se perdido, o reenvio agora recebe
> **`409 ANEXO_JA_REIVINDICADO`**, com `ocorrenciaId` no corpo.
>
> **Antes, esse mesmo reenvio criava silenciosamente uma segunda ocorrência apontando para a mesma foto** —
> e a saída era o Solicitante cancelar uma delas com `aberta_por_engano`, que a §7.10 declara como o
> desfazer do toque duplo. A restrição converte isso num erro nomeado, com destino: o cliente navega para a
> ocorrência que já existe.
>
> **É idempotência parcial, ganha sem mecanismo de transporte.** A §7.10 recusou chave de idempotência por
> exigir tabela nova; esta não exige nada — é efeito colateral de uma restrição que existe por outra razão
> (fazer `confirmado` significar *reivindicado uma vez*). A resposta à **Q-API-4** não muda: continua não
> havendo `Idempotency-Key`, e o `POST /ocorrencias/{id}/comentarios` continua desprotegido.
>
> **O que isto cobra da interface:** o campo da foto em T-04 precisa de texto para este `409`, e ele é
> diferente dos outros — não é *"escolha a foto de novo"*, é *"isto já foi registrado, ver a ocorrência"*.
> **Não é decisão de contrato e não está desenhado aqui**; fica registrado para o inventário de telas e o
> protótipo herdarem, como a restrição de tela da §8.5.

### 10.4 A leitura

A chave guardada em `anexos.chave` é **opaca** — nunca uma URL, nunca com nome de contêiner
embutido (§2.8 do `modelo-de-dados.md`, agora com um `CHECK` que recusa `://`). E o contêiner **não é público**:
ocorrência de unidade privativa é visível só ao autor e aos Gestores (D10).

> **`GET /ocorrencias/{id}/anexos/{anexoId}` → `302` para uma URL assinada de leitura, válida por 10
> minutos.**

Rejeitados os dois vizinhos:

| Alternativa | Por que não |
|---|---|
| **A API faz proxy dos bytes** | Devolve o custo de *streaming* que a decisão de upload evitou — e agora em **toda leitura**, não só na escrita |
| **URL assinada embutida no payload** de `GET /ocorrencias/{id}` | A URL muda a cada resposta, então **o service worker nunca acerta o cache** — e leitura offline (RNF7) é requisito da evolução prevista. Também espalha credencial por respostas que ficam em log e em histórico |

O endpoint de redirecionamento tem **URL estável** (cacheável pelo PWA), autoriza **em toda leitura** (é a
ocorrência que decide quem vê, não a posse de um link) e não move bytes. `OcorrenciaDetalhe` traz
`anexos[].url` apontando para ele — nunca para o Blob.

**A URL continua estável depois de o anexo virar linha**, e isso não é acidente: o `anexoId` é a chave
primária, imutável, e **não** a `chave` do objeto. Se a URL carregasse a chave do storage, ela mudaria no
dia em que a variante de prefixo da §10.3 fosse necessária — e o cache do service worker, que é a razão de
o endpoint existir, quebraria junto.

**A miniatura é `?variante=miniatura` no mesmo endpoint, e não um caminho novo.** Decidido em 22/08/2026:
ela é outra **representação** do mesmo anexo, não outro recurso. Três consequências, e a terceira é a que
decidiu: a operação continua sendo uma (**37 no total**); a URL continua estável e cacheável, agora em duas
chaves de cache distintas; e **a autorização é a mesma** — quem pode ver o anexo pode ver a prévia dele, sem
um segundo lugar onde a permissão precise ser checada. Um caminho separado teria criado exatamente esse
segundo lugar.

**A `fonte` do objeto não aparece na resposta, e é de propósito.** `anexos.fonte` diz **qual provedor**
resolve a chave, e isso é infraestrutura: o cliente recebe uma URL desta API e segue o `302`. Expor o
provedor daria ao cliente uma informação que ele não pode usar e criaria acoplamento onde a §2.8 do `modelo-de-dados.md`
gastou uma seção para não ter nenhum.

**Custo declarado:** o alvo do `302` é uma URL com token que, uma vez emitida, vale 10 minutos para quem a
tiver. Mitigações: TTL curto, `Referrer-Policy: no-referrer` na resposta, e nenhum registro de *query
string* em log. É a mesma classe de risco que qualquer URL assinada tem, e a razão de o TTL não ser de horas.

**Fora do contrato, declarado:** a exclusão do objeto quando a Pessoa é anonimizada (RNF10). A §10.2 do
`modelo-de-dados.md` **passou a responder isso em 21/08/2026**, e a resposta é *nada acontece*, com o argumento:
o anexo pertence à Ocorrência e não à Pessoa; a tabela não carrega dado de contato; e anonimizar por autor
apagaria o conjunto errado, porque o rosto numa foto costuma ser o de **um terceiro**. O instrumento certo
seria um *takedown* por anexo, que **não existe, não foi decidido e não foi modelado** — é o **PA-05**, que
segue aberto e sem revisão jurídica. Este contrato não o resolve e não o esconde.

---

## 11. Evolução — como os 21 itens da evolução prevista entram

**A regra de compatibilidade, que é o que substitui o `/v1` (§7.8):**

> **Toda evolução é aditiva: endpoint novo, campo opcional novo no corpo, campo novo na resposta, valor novo
> em enum de *saída*. Nunca: campo obrigatório novo, remoção de campo, mudança de tipo, ou valor novo em enum
> de *entrada* que o cliente antigo não saiba produzir.**

| # | Item da evolução prevista (`escopo.md` §4) | O que muda no contrato | Aditivo? |
|---|---|---|---|
| 1 | Identidade da organização — logo e nome (D25) | `PATCH /organizacao` (novo) + campos em `Contexto` | ✅ |
| 2 | Interruptor *exigir solução ao resolver* (D22) | `PATCH /organizacao` + novo `409 SOLUCAO_EXIGIDA_PELA_ORGANIZACAO` em `/resolver` | ✅ |
| 3 | Página pública da organização com código na URL (D25) | `GET /organizacoes/publica?codigo=` — **o único endpoint anônimo do produto**, devolvendo só nome e logo | ✅ |
| 4 | Convite por link de uso único (D25) | `POST /convites` · `GET /convites/{token}` (anônimo) · `POST /convites/{token}/aceitar` | ✅ |
| 5 | Importar pessoas em lote (D25) | `POST /vinculos/importacoes` | ✅ |
| 6 | Revogar vínculo (D4) | `POST /vinculos/{pessoaId}/revogar` — comando, não `DELETE` (P6), porque **revogar preserva o registro**. É a operação para o vínculo **com** histórico, que o `DELETE /vinculos/{pessoaId}` da §8.2 não alcança e nem deve alcançar | ✅ |
| 7 | Ver semelhantes e **aderir** (D11) | `GET /ocorrencias?semelhantesA={id}` + `POST /ocorrencias/{id}/aderir` | ✅ |
| 8 | Filtros rápidos (D15) | `?filtroRapido=nao_triadas\|pausadas_esperando_gestor\|sem_atualizacao\|alta_prioridade` | ✅ |
| 9 | Cancelar por duplicidade com vínculo (D17) | `ocorrenciaOrigemId` no corpo de `/cancelar` — **hoje devolve `422 CAMPO_NAO_SUPORTADO`**, então o campo já tem lugar reservado e comportamento definido | ✅ |
| 10 | Conversa privada da atribuição (D9) | `GET/POST /ocorrencias/{id}/atribuicoes/{atribuicaoId}/mensagens` | ✅ |
| 11 | Encarregado recusa a atribuição | `POST /ocorrencias/{id}/recusar-atribuicao` | ✅ |
| 12 | Encarregado entra e vê a própria lista (P5) | `?responsavel=eu` em `GET /ocorrencias` + permissões novas no mapa da §4.5 | ✅ |
| 13 | **Leitura sem rede** (RNF7) | **Nada.** As leituras já são `GET` com URL estável — inclusive o anexo (§10.4). O service worker cacheia o que já existe | ✅ |
| 14 | Reportar execução concluída (P5) | `POST /ocorrencias/{id}/reportar-execucao-concluida` | ✅ |
| 15 | Nova ocorrência vinculada à original (D24) | `ocorrenciaOrigemId` + `vinculoOrigem` opcionais em `POST /ocorrencias` | ✅ |
| 16 | Ver ocorrências de área comum do meu local (D10) | **Nenhum campo, nenhum endpoint** — o conjunto devolvido por `GET /ocorrencias` **aumenta** | ⚠️ ver abaixo |
| 17 | Sino com as notificações (D14, D15) | `GET /notificacoes` · `POST /notificacoes/{id}/marcar-como-lida` | ✅ |
| 18 | Notificação a cada transição (D14) | Nada — é política (POL-05/06); aparece pelo item 17 | ✅ |
| 19 | Nota interna entre Gestores (D9) | `GET/POST /ocorrencias/{id}/notas-internas` | ✅ |
| 20 | Tempo de calendário × tempo ativo (D19) | Campos novos em `GET /dashboard` | ✅ |
| 21 | Alarme de ocorrência parada (D15) | Campos novos em `/dashboard` + notificações do item 17 | ✅ |

**Vinte dos vinte e um são aditivos. O item 16 é a exceção, e ela merece nome.** Ligar a visibilidade
comunitária **não muda schema nenhum** — muda *quem vê o quê*. Um cliente antigo continua funcionando e
passa a receber mais itens na lista sem ter pedido. É **quebra semântica sem quebra sintática**, o tipo que
nenhum contrato detecta e nenhum teste de schema pega. Duas consequências práticas:

1. Ela exige nota de versão e comunicação ao usuário, não só migração de código.
2. Ela é o único item da evolução prevista que **precisa de teste de isolamento novo**, porque alarga deliberadamente
   um limite de visibilidade que hoje é *"autor e Gestores"*.

**Também previsto e fora dos 21:** `PATCH /ocorrencias` para corrigir título e descrição (§12, S-A7), e a
recuperação de uma organização cujo único Gestor perdeu o acesso (§12, S-A15) — a segunda **não é evolução
de conveniência, é buraco declarado no desenho**.

**Saiu desta lista em 20/08/2026:** `tempoMedioDeResolucao`, que era a contradição C-4 e passou a fazer
parte da primeira entrega por decisão registrada na §8.7.

### 11.1 Ampliar o anexo — fora dos 21, e o motivo de estar aqui

**Mais de um anexo por ocorrência, e anexo de outro tipo, não são itens de escopo** — não estão entre os 21
e **não entram na contagem**: o `escopo.md` segue com 63 itens, 42 na primeira entrega. Estão nesta seção
porque é aqui que este contrato mede aditividade, e porque a tabela `anexos` (§7.8 do `modelo-de-dados.md`) foi
desenhada em 21/08/2026 **exatamente para que estes dois dias custassem pouco**. Se o custo não estiver
escrito, a decisão de modelagem que o barateou vira folclore.

| O que muda | Onde | Aditivo? |
|---|---|---|
| **Mais de um anexo** | `maxItems: 1` → `maxItems: N` em `RegistroDeOcorrencia.anexos` | ✅ — o schema passa a **aceitar mais e nunca menos**. Cliente antigo continua válido |
| | `OcorrenciaDetalhe.anexos[]` e `quantidadeDeAnexos` | ✅ — **nada muda**. Já são lista e contagem; passam a trazer mais de um item e um número maior |
| | Banco | ✅ — **nada muda**. `anexos` nunca teve restrição de quantidade, e a §6.16 do `modelo-de-dados.md` explica por que não deve ter |
| **Outro tipo** (vídeo, PDF, áudio) | `tipoConteudo` em `POST /anexos/autorizacoes` ganha um valor | ✅ — enum de **entrada** ganhando valor é o caso delicado da regra acima, mas aqui é seguro: **nenhum cliente antigo precisa produzir o valor novo**, e os antigos continuam funcionando com os dois que já conhecem |
| | `Anexo.tipo` ganha um valor | ✅ — enum de **saída**, explicitamente aditivo |
| | Banco | `ALTER TYPE tipo_anexo ADD VALUE` — barato, não reescreve tabela |
| | Tela | **Não é aditivo.** Renderizar vídeo não é renderizar imagem, e o `<img>` de T-05 não serve |

**Duas coisas que a tabela não barateia, e por isso a decisão continua sendo de produto:**

1. **A tela.** Cada tipo novo é um jeito novo de exibir e um jeito novo de capturar. É trabalho de
   interface, e não há schema que o evite.
2. **O RNF6 e o custo.** A §11.5 do `modelo-de-dados.md` põe número nisso: vídeo comprimido no aparelho custa
   ~10× o armazenamento de hoje (~US$ 10/ano, 10% do crédito Azure), e **vídeo sem compressão custa mais
   que o crédito inteiro**. Pior: 4 MB em rede móvel derrubam o paralelismo do upload, que é o que faz o
   registro caber em menos de um minuto. **O que impede vídeo hoje não é o esquema — é o RNF6.**

É essa a forma da promessa: *"o esquema não atrapalha; o custo e a tela decidem, e estão medidos"*.

---

## 12. Suposições declaradas

Onde a documentação anterior não respondia, a resposta está aqui — com o que muda se estiver errada. Nenhuma
delas foi resolvida dentro do YAML.

| # | Suposição | O que muda se estiver errada |
|---|---|---|
| **S-A1** | **Linha do tempo e trilha de auditoria mostram o mesmo conjunto de fatos na primeira entrega**, mudando forma e vocabulário, e as duas são legíveis pelo autor e pelos Gestores | Só o schema de resposta de `linha-do-tempo` (recorte de campos por papel). Nenhum endpoint entra ou sai. §13, Q-API-3 |
| **S-A2** | **`POST /vinculos` sempre cria uma Pessoa nova**, sem procurar por e-mail | Se um dia se quiser reaproveitar cadastro, é preciso um mecanismo que **não** consulte `pessoas` globalmente — provavelmente convite (evolução prevista). Custo hoje: linhas duplicadas em `pessoas` |
| **S-A3** | **`PATCH /vinculos/{pessoaId}` só aceita Pessoa sem Usuário** | Se for permitido editar quem tem conta, um Gestor passa a alterar cadastro que vale em outras organizações — e isso precisaria de decisão de produto, não de contrato |
| **S-A4** | **Ocorrência que o chamador não pode ver responde `404`**, mesmo dentro da própria organização | Trocar por `403` tornaria a depuração mais fácil e confirmaria a existência de ocorrências de terceiros — o que a D10 recusa |
| **S-A5** | **`GET /vinculos` exige `vinculo.gerir`**, e é o único lugar onde `contatos[]` aparece | Se o Solicitante precisar ver a lista de gente, o schema ganha uma variante sem contato. Dado de contato é dado pessoal (RNF10) — e desde 22/08/2026 ele é a **tabela global mais sensível** do esquema |
| **S-A17** | **A escrita de `contatos[]` é substituição, não mesclagem**, e não há endpoint próprio de contato — acrescentada em 22/08/2026 | Mesclar por `id` exigiria definir três casos de borda no contrato, e endpoint próprio custaria três operações novas mais uma URL de Pessoa que a §4.6 nega |
| **S-A18** | **`vinculo.area` é a unidade da pessoa naquela organização**, anulável, e não é exposta a quem não tem `vinculo.gerir` | Se a unidade precisar aparecer ao Solicitante — *"ocorrências de área comum do meu local"* (D10, ⬜) —, o campo entra em `GET /contexto`. **Aditivo** |
| **S-A6** | **Vínculo com papel `encarregado` tem `permissoes: []`** na primeira entrega | Se o acesso do Encarregado for antecipado (Q11 do produto), muda o mapa da §4.5 — nenhum endpoint novo, exceto os da evolução prevista |
| **S-A7** | **Não existe edição de ocorrência.** Título, descrição, categoria, área e anexo são escritos uma vez | Editar exige `PATCH /ocorrencias` com uma lista explícita de campos, e reabre a **PA-01** (o anexo pode ser anexado depois?) |
| **S-A8** | **O anexo é anexado apenas no registro** (PA-01 segue aberta) | Um **comando na ocorrência** — não um `POST` em coleção de anexo (§9.9) — e uma decisão sobre substituir/remover, que hoje esbarra em P6. **A tabela `anexos` já comporta o segundo anexo sem migração**, então o custo desse dia é de contrato e de tela, não de esquema |
| **S-A9** | **Autorização de upload: máximo 512 KB, `image/jpeg` ou `image/png`, ticket de 15 min, SAS de leitura de 10 min, 30 autorizações por Pessoa por hora, e ~24–48 h até a faxina do objeto abandonado (§10.3)** | São números, não desenho. Mudam em uma linha do YAML — exceto o prazo da faxina, que é a granularidade de dias do provedor |
| **S-A16** | **`anexos` na resposta é lista; na listagem vai só a contagem** (`quantidadeDeAnexos`) — acrescentada em 21/08/2026 | Se a listagem precisar dos anexos inteiros, o campo vira lista lá também: **aditivo**, mas paga verbosidade na leitura mais chamada. O caminho contrário — voltar a um booleano — é que seria quebra |
| **S-A10** | **`statusRotulo` é calculado no servidor e depende do papel de quem lê** | Se for do cliente, o campo sai da resposta e a tabela de rótulos vira responsabilidade de cada cliente |
| **S-A11** | **`GET /ocorrencias` só ordena por `registradaEm DESC`** | Ordenar por outra coluna exige índice novo (§6.7 do `modelo-de-dados.md`) — é decisão de banco, não de contrato |
| **S-A12** | **Pedido de entrada recusado pode ser refeito** — herdada da suposição S4 do modelo de dados | Índice único absoluto em vez de parcial, e `409` no segundo pedido |
| **S-A13** | **O ticket do anexo é token assinado, não linha em tabela** | Uma tabela `uploads_pendentes` — **mudança no modelo de dados**, que exige decisão de produto. *(A entrada de `anexos` em 21/08/2026 **não** é essa tabela: ela guarda o objeto reivindicado, que nasce no `commit`, e nunca o pendente. §10.2.)* *(E `autorizacoes_de_upload`, em 30/08/2026, também **não** é: ela nasce na emissão, mas **nada no caminho de reivindicação a lê** — é livro-caixa de emissão, lido só pelo `POST /anexos/autorizacoes` para contar as 30/h. §6.18 do `modelo-de-dados.md`.)* |
| **S-A14** | **`POST /organizacoes` gera o `codigoPublico`**; o cliente não escolhe | Se o Gestor puder escolher, precisa de checagem de unicidade global e de proteção contra códigos ofensivos ou adivinháveis |
| **S-A15** | **Organização com um só Gestor que perde o acesso fica inacessível para sempre** — ver abaixo | Sair disso exige uma capacidade nova: promover a Gestor, transferir a organização, ou um segundo Gestor obrigatório na criação |

### S-A15 — a organização sem volta

Três decisões que são certas isoladamente se somam num beco:

| Decisão | O que ela diz |
|---|---|
| **D26** | Quem cria a organização é o **Gestor inicial** — é o bootstrap, e resolve o primeiro vínculo |
| **Q-API-6** (§13.2) | O contrato **não** permite alterar `papel` de um vínculo existente |
| **D25** | Todo vínculo novo nasce da aprovação de **um Gestor** |

Some as três: **se o único Gestor de uma organização perde o acesso — conta apagada, e-mail perdido,
pessoa que saiu do condomínio —, ninguém entra, ninguém aprova pedido de entrada e ninguém promove.** A
organização, com toda a sua trilha de auditoria, fica inalcançável **para sempre**, e não há caminho de
recuperação **dentro do produto**.

**A saída existe, e é fora do produto:** acesso administrativo direto ao banco, que a
[ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md) já declara como o caminho que *"escapa
do isolamento"* — inserir um vínculo de Gestor à mão. Num MVP acadêmico isso é aceitável; num produto real
seria incidente de suporte com procedimento escrito.

**Por que fica assim, e não é preguiça.** As três saídas de dentro do produto custam mais do que parecem:
promover a Gestor abre a pergunta de quem pode promover quem (e não é capacidade ✅); transferir a
organização exige um conceito de propriedade que o modelo não tem; e exigir dois Gestores na criação
contradiz frontalmente a D26, cujo ponto inteiro é que **o primeiro Gestor não tem quem o aprove**.

**O que fica registrado é a fronteira:** o produto tem um estado do qual ele próprio não sai. Está escrito
porque estado sem volta que ninguém documentou é o que vira suporte às três da manhã — e porque o
avaliador reconhece quem sabe onde o próprio desenho não fecha.

---

## 13. As questões que este contrato levantou — e as respostas de 20/08/2026

**Todas foram respondidas em 20/08/2026** — e a data vale para toda esta seção, por isso não se repete em
cada linha dela. As cinco contradições foram conferidas contra os arquivos e **as cinco procedem**, e os
documentos de origem foram corrigidos. Das sete questões, **seis confirmaram o que o contrato
tinha assumido e uma mudou o contrato** — junto com a C-4, que trouxe um indicador novo.

| # | Assunto | Resposta | Efeito neste contrato |
|---|---|---|---|
| Q-API-1 | Comandos de pedido de entrada no Event Storming | **Sim**, foram acrescentados | Nenhum — a rastreabilidade fecha |
| Q-API-2 | Tabela de rótulos exibidos | **Mecanismo aprovado, tabela alterada** | `pausada` desdobra em quatro rótulos → `motivoPausa` entra no `OcorrenciaResumo` (§8.8) |
| Q-API-3 | Recorte da linha do tempo | **(a) — mostra tudo** | Restrição de tela registrada em §8.5, para o inventário de telas herdar |
| Q-API-4 | Chave de idempotência | **(a) — não ter** | Nenhum |
| Q-API-5 | `contexto` vira termo? | **Não; `Organização ativa` vira** | Nenhum — o termo é do glossário |
| Q-API-6 | Promover a Gestor | **(a) — fica como está** | **Nova suposição S-A15**: a organização sem volta |
| Q-API-7 | Contrato sem `/v1` | **Confirmado** | §7.8 ganhou *o dia da quebra* |
| C-4 | Tempo médio de resolução | **Entra na primeira entrega** | **Quinto indicador** em `GET /dashboard` (§8.7) |

**Duas lacunas foram encontradas na revisão deste contrato**, e as duas estão resolvidas aqui: o
**objeto abandonado** no storage (§10.3) e a **organização sem volta** (§12, S-A15).

### 13.1 Contradições e lacunas encontradas na documentação

Registradas, não resolvidas em silêncio. **As cinco foram confirmadas em 20/08/2026 e aplicadas nos
documentos de origem** — este contrato não os tocou, e o fecho registra onde cada uma caiu.

**C-1 · O glossário listava `reabrir` como comando nomeado** na definição de *Transição de status* (`glossario.md` §4),
e a `D24` diz que reabertura não existe. A própria §8 do `glossario.md` registra *"Reabertura | Não existe"*.
É contradição interna de um documento, e o contrato seguiu a D24 e a `arquitetura.md` (Parte I, §4:
*"`Resolvida` e `Cancelada` são terminais de verdade — não existe `reabrir`"*), duas fontes contra uma
linha. **Proposta:** remover `reabrir` da definição de
*Transição de status*.

**C-2 · A `arquitetura.md` dizia, no tópico 8, que o contrato das APIs é *"gerado dos route
handlers"*.** Isso não é possível hoje: route handlers do Next.js **não geram OpenAPI** — não há decorator nem reflexão como em
NestJS ou Spring (§15). A linha descreve um mecanismo que não existe. **Proposta:** trocar por
*"`docs/api/openapi.yaml`, mantido em sincronia por geração a partir dos schemas de validação (§15 do
contrato de API)"*.

**C-3 · A `arquitetura.md` dizia, no tópico 5: *"Upload por URL assinada emitida pelo servidor. Nunca do
cliente direto"*.**
As duas metades se contradizem: uma URL assinada existe **precisamente** para que o cliente suba direto.
O contrato leu a frase como *"nunca do cliente **sem credencial emitida pelo servidor**"*, que é a leitura
que preserva a intenção (o servidor nunca expõe a chave da conta de storage) e é a única compatível com a
justificativa de custo da ADR-0004. **Proposta:** reescrever para *"upload direto do cliente para o Blob,
com SAS de escrita emitida pelo servidor; a chave da conta nunca sai do servidor"*.

**C-4 · O `escopo.md` cita *"tempo médio de resolução mês a mês"* na parte 1, entre o que o Gestor lê no
dashboard, e o indicador não aparecia na tabela de capacidades da atividade 8** — nem como ✅ nem como ⬜.
Ele existe na D19 e no passo 7 do Event Storming.

> **✅ Resolvida em 20/08/2026 — e é a única resposta que mudou este contrato.** O indicador **entra na
> primeira entrega**. O enunciado aqui é genérico (*"visualizar indicadores em um dashboard"*, p.5), então
> cortá-lo teria sido legítimo; o que decidiu foi o `modelo-de-dados.md` §6.8, que justifica o índice
> `(organizacao_id, ocorreu_em DESC)` citando literalmente *"tempo médio de resolução mês a mês"* — havia um
> índice **já pago** por uma capacidade que não estava no escopo, e o cálculo é uma agregação sobre ele.
> `GET /dashboard` passa a devolver **cinco** indicadores (§8.7); o `escopo.md` passa a **41 ✅ de 62**,
> e a **42 de 63** ainda no mesmo dia, com o conserto do **PA-25**.

**C-5 · Lacuna no Event Storming: não existe comando `Aprovar pedido de entrada`.** O passo 5 tem
`Aceitar convite` e a POL-02, escritos antes da D25 criar o caminho do código público. Três endpoints do
contrato (`/pedidos-de-entrada`, `/aprovar`, `/recusar`) realizam capacidades ✅ do escopo **sem comando
correspondente no passo 5**. É lacuna real da documentação anterior, não endpoint inventado.

> **✅ Confirmada.** Os três comandos foram acrescentados ao passo 5 do Event Storming, com
> uma política espelhando a POL-02. **Nada muda no contrato** — os endpoints já estavam certos; o que faltava era a origem.

### 13.2 Questões, com opções e recomendação

**Q-API-1 · Acrescentar os comandos de pedido de entrada ao Event Storming?**
Opções: (a) acrescentar `Pedir entrada`, `Aprovar pedido de entrada`, `Recusar pedido de entrada` ao passo 5,
com uma política *"vínculo estabelecido ao aprovar"* espelhando a POL-02; (b) deixar como está e aceitar que
o contrato tem três endpoints sem origem no passo 5.
**Recomendo (a).** É meia hora de trabalho e fecha a rastreabilidade que a §14 usa como critério.
**✅ Respondida: (a).** Os comandos foram acrescentados; o contrato não muda.

**Q-API-2 · Qual é a tabela de rótulos exibidos?**
A D19 dá **um** exemplo (*"o síndico está avaliando"* para `em_analise`) e o contrato precisa de seis, por
papel. Sem ela, `statusRotulo` sai do YAML ou nasce inventado. Proposta para aprovação:

| `status` | Rótulo ao Solicitante | Rótulo ao Gestor |
|---|---|---|
| `aberta` | "Recebida, aguardando o síndico" | "Aberta" |
| `em_analise` | "O síndico está avaliando" | "Em análise" |
| `em_atendimento` | "Em execução" | "Em atendimento" |
| `pausada` | "Parada, esperando <motivo>" | "Pausada" |
| `resolvida` | "Resolvida — conte como foi" | "Resolvida" |
| `cancelada` | "Cancelada" | "Cancelada" |

**✅ Respondida em 20/08/2026: mecanismo aprovado, tabela alterada.** Os rótulos são propriedade do
**glossário**, calculados no **servidor**, e variam por papel — o contrato fica com o campo e a regra de
derivação. **Três correções na proposta acima, e cada uma vale mais que a linha que corrigiu:**

1. **Fora "síndico".** A palavra trava o produto em condomínio, e a D3 diz que o tenant é condomínio **ou**
   empresa **ou** bairro. O rótulo quebraria no primeiro cliente que não é prédio — e a promessa
   multi-tenant é a adição `NOSSO` mais cara do projeto.
2. **`pausada` são quatro rótulos, não um molde.** *"Parada, esperando &lt;motivo&gt;"* interpolava um valor
   de enum numa frase em português: com `aguardando_peca`, produziria *"Parada, esperando aguardando peça"*.
3. **Fora a chamada para ação.** *"Resolvida — conte como foi"* misturava estado com convite. O rótulo é o
   estado; o convite a avaliar é decisão de tela, e vai para o inventário de telas.

**A tabela aprovada — é a que os exemplos do YAML usam:**

| `status` · `motivo_pausa` | Rótulo ao Solicitante | Rótulo ao Gestor e ao Encarregado |
|---|---|---|
| `aberta` | Recebida — aguardando análise | Aberta |
| `em_analise` | Em análise | Em análise |
| `em_atendimento` | Em execução | Em atendimento |
| `pausada` · `aguardando_informacao_solicitante` | Parada — esperando você responder | Pausada |
| `pausada` · `aguardando_peca` | Parada — esperando material chegar | Pausada |
| `pausada` · `aguardando_autorizacao` | Parada — esperando autorização | Pausada |
| `pausada` · `aguardando_terceiro` | Parada — esperando um terceiro | Pausada |
| `resolvida` | Resolvida | Resolvida |
| `cancelada` | Cancelada | Cancelada |

Os quatro identificadores de motivo foram conferidos contra o `ENUM` `motivo_pausa` da §5 do
`modelo-de-dados.md` e **batem exatamente** — nenhum ajuste foi necessário.

**O efeito no contrato foi maior do que a resposta parece.** A correção 2 fez `pausada` deixar de ter um
rótulo e passar a ter quatro; e como o rótulo do Gestor é sempre *"Pausada"*, a lista dele esconderia
justamente o que a D8 existe para tornar visível. Por isso **`motivoPausa` entrou no `OcorrenciaResumo`**
(§8.8): uma correção de redação de rótulo mudou um schema de resposta.

**Q-API-3 · A linha do tempo do Solicitante esconde alguma coisa?**
Opções: (a) mostra tudo — transições com observação, motivo de pausa e de cancelamento (o que o contrato
assumiu, S-A1); (b) esconde a `observacao` das transições, mostrando só o fato e o motivo codificado.
**Recomendo (a).** O produto existe para que *"o Solicitante saiba o andamento sem precisar perguntar"*, e a
D8 já manda mostrar a ele quando a pausa é *aguardando informação do solicitante*. Esconder o porquê
recriaria a pergunta que o produto veio eliminar. Se houver receio de texto interno vazando, o lugar do
texto interno é a **nota interna** (canal 2, evolução prevista) — não a observação da transição.

**✅ Respondida: (a), mostra tudo.** Com uma restrição que veio junto e que o contrato passa adiante: **a
tela onde a `observacao` é escrita precisa avisar, no momento da escrita, que o Solicitante vai lê-la** —
porque o registro é imutável e o engano é irreversível. Está em §8.5, para o inventário de telas herdar.

**Q-API-4 · Vale uma chave de idempotência em `POST /ocorrencias`?**
Ela exige guardar `chave → resposta`, e **não há tabela para isso** — seria mudança no modelo de dados.
Opções: (a) não ter, confiando no desfazer de domínio (`aberta_por_engano`) e no botão desabilitado do
cliente; (b) acrescentar tabela e o cabeçalho `Idempotency-Key`.
**Recomendo (a)** para a primeira entrega, e reavaliar junto com *ver semelhantes e aderir* (D11), que ataca
o mesmo problema com valor de produto em vez de mecanismo de transporte.
**✅ Respondida: (a).** Mecanismo de transporte não deve resolver o que o produto resolve melhor.

**Q-API-5 · `contexto` vira termo do glossário?**
O nome vem da ADR-0003 (*"o contexto da requisição"*) e agora é recurso de API (`GET /contexto`). Pelo
critério da §9 do `glossario.md` — entra o **conceito**, não o identificador —, ele parece ser nome técnico. Mas
a **distinção** que ele carrega (*organização ativa* ≠ *vínculos da Pessoa*) não está registrada em lugar
nenhum. **Recomendo:** não virar termo, e acrescentar **`Organização ativa`** ao glossário, definida como
*"a organização cuja lente a sessão está usando agora; uma Pessoa com vários vínculos tem uma só de cada
vez"*, com *não confundir com* **Vínculo**.
**✅ Respondida: aprovado.** `contexto` não vira termo; **`Organização ativa`** entra no glossário com essa
redação. É aplicação do critério de 20/08 — entra o conceito, não o identificador.

**Q-API-6 · O Gestor pode promover alguém a Gestor?**
O contrato **não** permite mudar `papel` depois de criado o vínculo (§8.2), porque não é capacidade ✅ do
escopo. Mas a organização nasce com **um** Gestor (D26) e não há como ter um segundo sem novo pedido de
entrada aprovado com papel `gestor`. Opções: (a) fica como está — segundo Gestor só entra por pedido de
entrada; (b) `PATCH /vinculos/{pessoaId}` aceita `papel`.
**Recomendo (a)**, coerente com o corte (nota interna saiu justamente porque o cenário é o do síndico
único). Se a escolha for (b), é um campo — mas vira capacidade nova no escopo.

**✅ Respondida: (a), fica como está — com uma consequência que a pergunta não tinha visto.** (a) + D26 +
D25 fecham um beco: **se o único Gestor perder o acesso, a organização fica inacessível para sempre.**
Entrou na §12 como **S-A15**, com o custo e a saída — que existe, mas é fora do produto.

**Q-API-7 · Confirmam o contrato sem `/v1`?** (§7.8.) Recomendo manter `/api` puro. É a decisão com maior
chance de estranhamento por hábito, e por isso está declarada em vez de escondida.
**✅ Respondida: confirmado**, com um pedido que virou parágrafo — a §7.8 passa a **descrever o dia da
quebra**, que é o que separa decisão de omissão.

---

## 14. Rastreabilidade — as 44 capacidades ✅

Critério: **toda capacidade ✅ tem de ser alcançável pelo contrato**, e todo endpoint tem de derivar de uma.
A verificação nos dois sentidos.

> **Eram 40 até 20/08/2026**, e duas entraram no mesmo dia. A nº 36 — *tempo médio de
> resolução, mês a mês* — ao resolver a contradição C-4; e a nº 10 — *remover vínculo sem histórico* — ao
> resolver o **PA-25**, o beco em que aprovar com o papel errado era irreversível. O `escopo.md` passa a
> **42 ✅ de 63**.

> **E são 44 desde 30/08/2026**, quando a contagem, parada em 42 enquanto o backlog andava, foi reaberta:
> entram a **4b** (escolher o ícone da categoria) e a **7b** (entrar em outra organização tendo uma
> ativa) — as duas entregam comportamento que não existia. **Ficam de fora** o item 43 (semente de
> demonstração: instrumento para tornar o dashboard conferível, não coisa que o produto faz) e o 44 (tema
> visual). O `escopo.md` passa a **44 ✅ de 66**; o denominador sobe **três** porque uma linha ⬜ nasceu
> junto — *"fundar uma segunda organização tendo uma ativa"*, que a API aceita e nenhuma tela oferece.
> **As duas capacidades novas são numeradas `4b` e `7b`, ao lado das que derivam, e nada foi
> renumerado** — os números desta tabela são citados por outros documentos (*"capacidade nº 20"*,
> *"nº 38"*), e renumerar trocaria uma correção de contagem por uma caçada a referências.

| # | Capacidade (escopo) | Origem | Endpoint(s) |
|---|---|---|---|
| **0 · Configurar a organização** |
| 1 | Criar a organização por auto-serviço | `NOSSO` (D26) | `POST /organizacoes` |
| 2 | Categorias-semente | `NOSSO` (D18) | *(efeito da POL-01 em `POST /organizacoes`; verificável em `GET /categorias`)* |
| 3 | Áreas-semente, com os dois tipos | `NOSSO` (D10, D18) | *(efeito da POL-01; verificável em `GET /areas`)* |
| 4 | Editar categorias | `ENUNCIADO · aberto` | `GET/POST /categorias` · `PATCH /categorias/{id}` |
| **4b** | **Escolher o ícone da categoria**, sobre a lista fechada de 25 nomes | `NOSSO` (RNF6) | campo `icone` em `POST /categorias` e `PATCH /categorias/{id}`; lido em `GET /categorias` |
| 5 | Editar áreas | `NOSSO` (D18) | `GET/POST /areas` · `PATCH /areas/{id}` |
| **1 · Entrar na organização** |
| 6 | Criar conta e autenticar-se | `ENUNCIADO · aberto` (S1,S2) | **fora do contrato** — Supabase Auth (§4.1); consumida por `GET /contexto` |
| 7 | Pedir entrada com o código | `NOSSO` (D25) | `POST /pedidos-de-entrada` |
| **7b** | **Entrar em outra organização tendo uma ativa** | `NOSSO` (D25, B-01) | `POST /pedidos-de-entrada` · `PUT /contexto/organizacao` — os mesmos de nº 7 e do menu de troca, e é por isso que a capacidade é nova sem endpoint novo |
| 8 | Gestor aprova ou recusa | `NOSSO` (D25) | `GET /pedidos-de-entrada` · `POST …/aprovar` · `POST …/recusar` |
| 9 | Cadastro de Encarregados, sem conta | `NOSSO` (D27) | `GET/POST /vinculos` · `PATCH /vinculos/{pessoaId}` — desde 22/08/2026 com `contatos[]` e `areaId` no corpo |
| 10 | **Remover vínculo sem histórico, desfazendo papel errado** | `NOSSO` (D25, PA-25) | `DELETE /vinculos/{pessoaId}` |
| **2 · Registrar a ocorrência** |
| 11 | Registrar com título, descrição e categoria | `ENUNCIADO · literal` (S3,S4) | `POST /ocorrencias` |
| 12 | Informar a localização — Área + complemento | `ENUNCIADO · aberto` (S5) + D10 | `POST /ocorrencias` (`areaId`, `localizacaoComplemento`) + `GET /areas` |
| 13 | Anexar uma imagem comprimida no celular | `ENUNCIADO · aberto` (S6) + RNF8 | `POST /anexos/autorizacoes` → `POST /ocorrencias` → `GET /ocorrencias/{id}/anexos/{anexoId}` |
| **3 · Triar** |
| 14 | Listar todas as ocorrências | `ENUNCIADO · aberto` (G1) | `GET /ocorrencias` |
| 15 | Filtrar por categoria, status e prioridade | `ENUNCIADO · literal` (G2) | `GET /ocorrencias?status=&categoriaId=&prioridade=` |
| 16 | Analisar | `ENUNCIADO · literal` (F2) | `POST /ocorrencias/{id}/analisar` |
| 17 | Alterar a prioridade | `ENUNCIADO · aberto` (G3) + D6 | `POST /ocorrencias/{id}/alterar-prioridade` |
| 18 | Cancelar com motivo estruturado | `ENUNCIADO · literal` (F3) + D12 | `POST /ocorrencias/{id}/cancelar` |
| **4 · Atribuir** |
| 19 | Atribuir o responsável | `ENUNCIADO · aberto` (G4) + D21 | `POST /ocorrencias/{id}/atribuir-responsavel` + `GET /vinculos` |
| 20 | Auto-atribuição em um clique — **um clique conta comando, não toque de tela** (§8.4, correção de 30/08/2026); a ação vive no modal de atribuir de **T-05** | `NOSSO` (D21) | mesmo endpoint, com o próprio `pessoaId` |
| 21 | Reatribuir | `NOSSO` | mesmo endpoint, com atribuição vigente |
| **5 · Executar** |
| 22 | Iniciar o atendimento | `ENUNCIADO · literal` (F2) + D21 | `POST /ocorrencias/{id}/iniciar-atendimento` |
| 23 | Pausar com motivo estruturado | `NOSSO` (D8) | `POST /ocorrencias/{id}/pausar` |
| 24 | Retomar | `NOSSO` (D8) | `POST /ocorrencias/{id}/retomar` |
| **6 · Fechar** |
| 25 | Registrar a solução aplicada | `ENUNCIADO · aberto` (G7) + D22 | `POST /ocorrencias/{id}/registrar-solucao-aplicada` (ou no corpo de `/resolver`) |
| 26 | Resolver | `ENUNCIADO · literal` (F2) | `POST /ocorrencias/{id}/resolver` |
| 27 | Avaliar a resolução | `ENUNCIADO · aberto` (S10) + D1 | `POST /ocorrencias/{id}/avaliar` |
| **7 · Acompanhar** |
| 28 | Ver as minhas ocorrências e o status | `ENUNCIADO · aberto` (S7) | `GET /ocorrencias` (`?autor=eu`) |
| 29 | Ver a linha do tempo | `ENUNCIADO · aberto` (S9) | `GET /ocorrencias/{id}/linha-do-tempo` |
| 30 | Comentar com os Gestores | `ENUNCIADO · aberto` (S8,G6) + D9 | `GET/POST /ocorrencias/{id}/comentarios` |
| 31 | Rótulos em linguagem de gente | `NOSSO` (D19) | campo `statusRotulo` em todo payload de ocorrência |
| **8 · Gerir** |
| 32 | Dashboard com indicadores | `ENUNCIADO · aberto` (G8) | `GET /dashboard` |
| 33 | Backlog por status e por categoria | `NOSSO` (D19) | `GET /dashboard` → `backlogPorStatus`, `backlogPorCategoria` |
| 34 | Média das avaliações | `NOSSO` (D19) | `GET /dashboard` → `mediaDasAvaliacoes` |
| 35 | Recorrência por categoria e por área | `NOSSO` (D19) | `GET /dashboard` → `recorrenciaPorCategoria`, `recorrenciaPorArea` |
| 36 | **Tempo médio de resolução, mês a mês** | `NOSSO` (D19) | `GET /dashboard` → `tempoMedioDeResolucao` |
| **Fundação técnica** |
| 37 | Agregado com máquina de estados e trilha imutável | `ENUNCIADO · literal` (F4–F6) | **molda o contrato inteiro**: §3 (comando, não campo), §9.1 (trilha só de leitura), `GET …/trilha-de-auditoria` |
| 38 | Isolamento por organização em ponto único | `NOSSO` (D2,D3,RNF1) | **molda o contrato inteiro**: §4.2 (organização vem da sessão), §4.4 (os quatro endpoints fora do escopo), §6.3 (`404`) |
| 39 | Ambiente executável em contêiner | `ENUNCIADO · literal` (E7) | não é API |
| 40 | Publicação em nuvem, com pipeline | `ENUNCIADO · aberto` (E8) | não é API |
| 41 | Testes de domínio, aplicação, isolamento e ponta a ponta | `ENUNCIADO · aberto` (E6) | não é API — mas §15 acopla o contrato a eles |
| 42 | Documentação e README | `ENUNCIADO · aberto` (E9) | **este documento + `openapi.yaml`** são parte da entrega |

**Fechamento da contagem:**

- **38 capacidades de usuário.** Todas alcançáveis: **35 por endpoint** — 31 com endpoint próprio e
  **quatro dividindo endpoint com outra capacidade** (nº 20 e nº 21 com a nº 19; a **4b** com a nº 4; a
  **7b** com a nº 7) —, e 3 sem endpoint próprio e com motivo declarado: nº 6 (autenticação, realizada
  pelo provedor) e nº 2 e 3 (sementes, efeito de política). *(Eram 36 e 33 até 30/08/2026; a linha dizia
  "33 com endpoint dedicado", e **dedicado já era impreciso** — a nº 20 e a nº 21 sempre dividiram
  endpoint com a nº 19.)*
- **6 de fundação técnica.** Duas (37 e 38) **moldam o contrato inteiro** em vez de virar endpoint; quatro
  não são de API — e a nº 42 é, em parte, este par de arquivos.
- **Nenhuma capacidade ✅ ficou sem caminho.** E no sentido inverso: **nenhum dos 37 endpoints existe sem
  capacidade correspondente** — os três de pedido de entrada têm capacidade (nº 8) e **não têm comando no
  Event Storming**, o que está registrado como lacuna C-5, não como invenção.

---

## 15. Como o contrato deixa de ser verdade — e o que impede isso

**A ressalva técnica:** route handlers do Next.js **não geram OpenAPI**. Não há decorator nem reflexão como
em NestJS ou Spring. Hoje isso é irrelevante — não existe código, e o YAML nasce escrito à mão de qualquer
forma. A decisão real é sobre **depois**.

| Caminho | O que dá | O que custa |
|---|---|---|
| **Spec-first puro** | Simples hoje; o YAML é a fonte da verdade | **A sincronia depende de disciplina.** O handler muda, o YAML não, e ninguém percebe até o consumidor quebrar |
| **JSDoc + `next-swagger-doc`** | O contrato mora ao lado do código | Comentário mente tão facilmente quanto YAML: nada compara o comentário com o que o handler faz |
| **Schema-first com geração** (`zod` + `@asteasolutions/zod-to-openapi`) | **Uma fonte só**: o schema que valida em tempo de execução é o mesmo que gera o YAML | Uma dependência e alguma cerimônia; a migração do YAML escrito à mão custa cerca de meio dia |

### A decisão, em dois tempos

> **Hoje: spec-first. `docs/api/openapi.yaml` é a fonte da verdade e o código conformará a ele.**
>
> **Quando o código chegar: schema-first com geração, e o pipeline falha se o YAML gerado divergir do
> versionado.**

O argumento decisivo é o mesmo que este projeto usou duas vezes: **a ADR-0001 recusou depender da disciplina
do desenvolvedor e pôs a auditabilidade numa invariante; a ADR-0003 recusou depender de revisão e pôs o
isolamento numa regra de lint.** Um contrato mantido por boa vontade é exatamente o que essas duas decisões
recusaram em outros lugares.

**A dependência não é gratuita, mas quase.** `zod` entra de qualquer jeito: é a camada de Interface fazendo
a única coisa que a `arquitetura.md` (Parte I, §5) lhe permite — *"traduzir HTTP, validar formato"*, o `400`
da §6.2. O que se acrescenta é `@asteasolutions/zod-to-openapi` **[FONTE EXTERNA]**, dependência de
desenvolvimento, cuja função é ler os mesmos schemas e escrever o YAML.

**O portão, concretamente:** um passo no GitHub Actions regenera o YAML e roda `git diff --exit-code
docs/api/openapi.yaml`. Divergiu, o *merge* trava. É o mesmo mecanismo da regra de lint de fronteira —
mecânico, não disciplinar.

### O que a geração **não** garante, declarado

Geração cobre **schemas**. Não cobre semântica: se o handler devolve `200` onde o YAML diz `409`, nenhuma
ferramenta reclama. Quem cobre isso é o teste — e o **Definition of Done já exige** *"teste do caminho feliz
e de ao menos uma transição inválida"* por funcionalidade. Essa transição inválida **é** o teste de contrato
do `409`: já está pedida, e agora tem uma segunda razão de existir.

**Quatro verificações mecânicas para o Definition of Done**, todas derivadas deste documento:

1. **`status` não aparece em nenhum schema de entrada do `openapi.yaml`** (§3.5, P1). **Não é uma linha de
   `grep`, e a diferença importa.** A palavra aparece mais de cem vezes no arquivo, e quase todas são
   legítimas: o schema `StatusOcorrencia`, o campo `status` do `Problema` — que é o código HTTP que a RFC
   9457 exige —, os exemplos de resposta e as descrições. Buscar a palavra encontra tudo isso e não
   responde a pergunta. A verificação real **distingue entrada de saída**: percorre o `requestBody` de cada
   operação, segue os `$ref` até os schemas concretos, e confere que a propriedade `status` não existe em
   nenhum deles. São algumas dezenas de linhas sobre o YAML carregado — não uma busca textual.
2. **Nenhum caminho do `openapi.yaml` contém `organizacao`**, exceto `POST /organizacoes` e
   `PUT /contexto/organizacao` (§4.4, P2).
3. **Nenhum caminho contém `pessoas`** (§4.6, P3).
4. **Toda operação com `requestBody.required: false` tem, na rota correspondente, `corpoOpcional` — e
   nenhuma outra o tem.** É a única das quatro que **não** lê só o YAML: ela abre
   `app/api/…/route.ts` pelo caminho da operação (`{param}` vira `[param]`), isola o trecho do método,
   **remove os comentários** e procura a declaração. Remover comentário não é detalhe de implementação —
   cinco `route.ts` escrevem *"SEM `corpoOpcional`"* na própria prosa para dizer que a ausência é
   decidida, e uma busca ingênua leria a explicação como se fosse a declaração.

As quatro falham no dia em que alguém desfizer uma das decisões estruturais deste contrato — que é
exatamente quando se quer saber.

> ### Correção de 30/08/2026 — a quarta verificação, e por que ela faltava
>
> **A redação anterior era *"**Três** verificações mecânicas para o Definition of Done"***, e a lista
> terminava no item 3; a frase de fecho dizia *"As três falham no dia em que alguém desfizer uma das
> **três** decisões estruturais deste contrato"*.
>
> **O que a mudou.** As três primeiras conferem **o que o YAML diz**; nenhuma delas conferia **se o que o
> YAML diz é o que a rota faz**. `POST /pedidos-de-entrada/{pedidoId}/recusar` declarou
> `requestBody: required: false` desde o item 8 e a rota respondia `415 CORPO_NAO_SUPORTADO` a quem não
> mandasse corpo: o portão *"a especificação versionada corresponde ao código"* do
> [`definition-of-done.md`](definition-of-done.md) esteve aberto do item 8 até **27/08/2026**, e nada
> acusou. Hoje são **cinco** as operações com `requestBody.required: false` — `/recusar`, `/analisar`,
> `/iniciar-atendimento`, `/retomar` e `/resolver` —, e as cinco passam.
>
> **A regra é simétrica, e isso é escolha declarada.** O item da fila pedia só um lado — *"para toda
> operação com `required: false`, a rota declara `corpoOpcional`"*. O outro lado custa a mesma leitura e
> descreve o mesmo desencontro: uma rota que aceita corpo ausente sob uma especificação que o declara
> obrigatório. **Custo de estar errado:** se algum dia uma rota precisar aceitar corpo ausente *sem* que
> o contrato o dispense, a regra fica vermelha e obriga a decisão a passar por este documento — que é o
> efeito pretendido, não um efeito colateral.
>
> **O que ela não alcança, declarado:** a comparação é textual sobre o trecho do método. Uma rota que
> ganhasse `corpoOpcional` por variável, por espalhamento de objeto ou por um ajudante intermediário
> passaria sem ser vista. É a mesma limitação que a geração de schema resolveria de vez — ver *A decisão,
> em dois tempos*, acima.
>
> *(Item 15 da fila da frente de documentação, achado em 27/08/2026 ao responder a P2 da spec do item 16.)*

---

## 16. Índice de decisões, com o que foi rejeitado

| # | Decisão | Ficou | Rejeitado |
|---|---|---|---|
| 1 | Comando de domínio em HTTP | `POST /ocorrencias/{id}/<comando>`, verbo no imperativo | `PATCH` com `status` (destrói a ADR-0001) · sub-recurso substantivo (inventa vocabulário) · **recurso `transicoes`** (sugere criar registro de auditoria — perdeu por pouco) |
| 2 | Campos sem regra | Não há `PATCH` de ocorrência; `PATCH` só em `categorias` e `areas` | Híbrido com `PATCH` de título e descrição — editar ocorrência não é capacidade ✅ |
| 3 | Onde vive a organização | Derivada da **sessão**; troca por `PUT /contexto/organizacao` | Organização na URL (validação replicável e esquecível) · cabeçalho como fonte (mantém a organização como entrada do cliente) |
| 4 | Aba esquecida | Cabeçalho **opcional** `X-Organizacao-Id` como **afirmação**, `409` na divergência | Não ter verificação nenhuma |
| 5 | Listar gente | `GET /vinculos`; cadastro por `POST /vinculos` | `GET /pessoas` e busca por e-mail — a consulta que a §4.3 do `modelo-de-dados.md` proíbe |
| 6 | Porta única | HTTP obrigatório na **escrita**; leitura pode ir direto, mas **todo modelo de leitura tem endpoint** | Tudo por HTTP (paga vCPU-s por salto interno) · leitura livre sem endpoint equivalente (contrato mentiria por omissão) |
| 7 | Recurso de outra organização | `404`, com `organizacaoAtiva` e `traceId` no corpo | `403` — confirma existência de identificador, contra o RNF1 |
| 8 | Corpo de erro | RFC 9457 + `codigo` estável + `traceId` | Só mensagem (muda e quebra cliente) · código HTTP sozinho (não distingue 12 casos de `409`) |
| 9 | Transição ilegal | `409` com `statusAtual` e `acoesDisponiveis` | `422` — não é valor inválido, é conflito com o estado |
| 10 | Máquina de estados no cliente | `acoesDisponiveis` na resposta | Tabela de transições duplicada no PWA |
| 11 | Upload | SAS de escrita + **ticket assinado**, validado no `POST /ocorrencias` por `HEAD` | Proxy pela API (queima franquia) · SAS sem validação posterior (aceita qualquer coisa) · tabela de uploads (mudaria o modelo de dados) |
| 12 | Objeto abandonado no storage | Etiqueta `estado=pendente` na emissão, trocada para `confirmado` na reivindicação; ciclo de vida apaga o que sobrar · **30 autorizações por Pessoa por hora** | Mover de prefixo com cópia — três operações em vez de uma, cópia assíncrona dentro da transação, e **a chave mudaria entre autorização e reivindicação**, o que quebra a opacidade que a §2.8 do `modelo-de-dados.md` pede · aceitar o órfão sem prazo — sem limite, qualquer pessoa acumula objetos que ninguém apaga |
| 13 | Leitura do anexo | `GET /ocorrencias/{id}/anexos/{anexoId}` → `302` para SAS de 10 min | Proxy de bytes · URL assinada no payload (quebra o cache do service worker) · `/anexos` singular (codifica o escopo na URL, que é a coisa mais cara de trocar) · coleção `GET /ocorrencias/{id}/anexos` (segundo caminho para o que o detalhe já traz — §9.9) |
| 13b | **Forma do anexo no contrato** *(21/08/2026)* | Lista em `OcorrenciaDetalhe.anexos[]`, **contagem** em `OcorrenciaResumo.quantidadeDeAnexos`, `maxItems: 1` no corpo de entrada | Lista nos três formatos — verbosidade na leitura mais chamada · booleano `temAnexo` — vira quebra no dia do segundo anexo · restrição de quantidade no banco — devolve a migração que a tabela veio evitar |
| 14 | Paginação | Cursor `(registradaEm, id)` | Offset — duplica itens numa lista que recebe inserções |
| 15 | Versionamento | `/api`, sem `/v1` | `/api/v1` por hábito — sem consumidor independente, é custo sem benefício |
| 16 | Concorrência | Sem `ETag`; a máquina de estados é o controle otimista | `If-Match` em todo comando — resolve o que já estava resolvido e piora a mensagem de erro |
| 17 | Idempotência | Não há chave; o desfazer é `aberta_por_engano` | `Idempotency-Key` — exige tabela nova (§13, Q-API-4) |
| 18 | Rótulo de status | `statusRotulo` calculado no servidor, por papel | Mapa no cliente — divergiria entre clientes e tiraria o texto do glossário |
| 19 | Dashboard | Um endpoint, cinco indicadores | Cinco endpoints — cinco cold starts para uma tela |
| 20 | Canal de conversa | Recurso `comentarios` (canal 1) | `/canais/{tipo}/mensagens` — dois dos três tipos são inalcançáveis na primeira entrega |
| 21 | Sincronia contrato ↔ código | Spec-first agora; `zod` + geração com portão no CI depois | Spec-first para sempre (depende de disciplina) · JSDoc (comentário mente igual) |
| 22 | **Contato na superfície** *(22/08/2026)* | `pessoa.contatos[]` embutido em `GET /vinculos`; escrita por **substituição** no corpo do vínculo | `emailContato` + `telefone` soltos — **era a decisão anterior**, e removê-los depois seria quebra (§11) · três endpoints próprios de contato — URL de recurso que a §4.6 nega a `Pessoa` · mesclagem por `id` — três casos de borda em vez de um |
| 23 | **Formato do telefone** | **E.164** em toda a superfície, imposto por schema | Texto livre — impede deduplicação, e obriga a normalizar em cada lugar que monta um link de WhatsApp |
| 24 | **Miniatura do anexo** | Segundo objeto, **na mesma autorização**, lido por `?variante=miniatura` | Duas autorizações — dobra a ida e volta e consome dois slots do limite · caminho separado `/miniatura` — operação nova e um segundo lugar onde checar permissão · sem miniatura, servindo a imagem de 400 KB na listagem — 8 MB por página |
| 25 | **Unidade do morador na superfície** | `vinculo.area` na leitura, `areaId` na escrita, só com `vinculo.gerir` | Não expor — mas então o produto continuaria guardando a unidade dentro do `nome` (*"Morador do 302"*), que era o que acontecia |

---

**As cinco propostas deste contrato a outros documentos foram aplicadas em 20/08/2026**, nos documentos de
origem — não aqui. Onde cada uma caiu:

| Proposta | Onde foi aplicada |
|---|---|
| **C-1** · tirar `reabrir` da definição de *Transição de status* | `docs/glossario.md` §4 |
| **C-2** · o `openapi.yaml` não é gerado dos route handlers | `docs/arquitetura.md`, tópico 8 |
| **C-3** · upload direto do cliente, com credencial emitida pelo servidor | `docs/arquitetura.md`, tópicos 3 e 5 |
| **C-4** · *tempo médio de resolução* entra como capacidade | `docs/escopo.md`, atividade 8 |
| **Q-API-5** · `Organização ativa` vira termo | `docs/glossario.md` §2 |

A sexta — **C-5**, os comandos de pedido de entrada — é do Event Storming, que não é entregável: foi
aplicada no material de processo do projeto. O argumento de cada proposta continua na §13, que é onde ele
vive; esta tabela diz apenas que nenhuma ficou pendente.
