# Glossário — Linguagem Ubíqua do Resolve Aí

Este documento fixa **uma definição por termo**. A instrução vem da disciplina: a linguagem ubíqua é
*"a linguagem que utiliza as terminologias da realidade do negócio"*, e onde um termo carrega dois
significados a orientação é *"quebrar esses termos e lhes dar definições únicas e específicas para
evitar problemas futuros"* (aula 3, p.6).

A razão de existir é prática: **estes termos viram nome de tabela, de endpoint e de classe.** Resolver
a ambiguidade antes custa horas; depois custa refatoração.

## Como ler

Cada termo traz a **origem**:

- **`ENUNCIADO · literal`** — o enunciado define o termo e o seu conteúdo. Não temos liberdade.
- **`ENUNCIADO · aberto`** — o termo vem do enunciado; a definição precisa é nossa.
- **`NOSSO`** — termo nosso, criado durante a descoberta.

Duas regras de vocabulário que valem para todo o projeto:

1. **Atores são nomeados por função, nunca por nome próprio** (aula 2, p.7): `Solicitante`, `Gestor`,
   `Encarregado` — nunca "João", "Admin" ou "User".
2. **Vocabulário de ferramenta não entra.** "Fila" veio do Jira e foi retirada; o termo do negócio é
   *filtro rápido*. A linguagem vem do negócio, não da ferramenta.

---

## 1. Atores e vínculos

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Pessoa** | A entidade de domínio que representa um ser humano no sistema: nome e **contato**. Existe independentemente de conseguir entrar no sistema. O **e-mail de contato** da Pessoa **não é a credencial** — são campos distintos, e podem divergir: o condomínio tem um e-mail da pessoa, e ela entra no sistema com outro. | **Usuário** — Pessoa pode existir sem Usuário | `NOSSO` (D4) |
| **Usuário** | A credencial de acesso de uma Pessoa. Uma Pessoa tem zero ou um Usuário. | **Pessoa**; e **Vínculo**; e o **e-mail de contato**, que é da Pessoa e não daqui | `ENUNCIADO · aberto` (S1, S2) |
| **Pedido de entrada** | A solicitação de uma Pessoa para se vincular a uma Organização, feita com o código público, e que **aguarda decisão do Gestor**. Só depois da aprovação o Vínculo passa a existir. | ⚠️ **"fila de aprovação"** — descrição usada antes de o termo existir; **"fila" é termo retirado** do projeto. E **Convite**, que dispensa aprovação | `NOSSO` (D25) |
| **Vínculo** | A ligação entre uma Pessoa, um **Papel** e uma **Organização**. Uma Pessoa pode ter vários vínculos, em organizações diferentes e com papéis diferentes. | **Papel** — o vínculo *carrega* um papel, não é o papel | `NOSSO` (D4) |
| **Papel** | O que a Pessoa é dentro de uma Organização: `Solicitante`, `Gestor` ou `Encarregado`. | **Permissão** — papel é do vínculo; permissão é o que o papel autoriza | `NOSSO` (D4) |
| **Solicitante** | Papel de quem registra e acompanha ocorrências. | **Observador** | `ENUNCIADO · literal` |
| **Gestor** | Papel de quem analisa e administra as ocorrências de uma Organização. É **sempre** quem decide que uma ocorrência está resolvida. | **Encarregado** | `ENUNCIADO · literal` |
| **Encarregado** | Papel de quem executa o trabalho — zelador, técnico, prestador. **Pode ou não ter Usuário**: o Gestor cadastra encarregados sem conta apenas para fins de gerenciamento. Há CRUD de Encarregados. | ⚠️ **Responsável pela ocorrência** — que é a *atribuição*, não o papel. Ver colisão nº 2 | `NOSSO` (D27) |
| **Responsável pela ocorrência** | A **atribuição**: qual Pessoa foi designada para resolver *aquela* ocorrência. **É uma relação, não um papel** — aponta para qualquer Pessoa com vínculo na Organização, tenha ela papel de Encarregado **ou de Gestor**. | ⚠️ **Encarregado** (o papel) e **autor da transição** (o campo do histórico). Ver colisão nº 2 | `ENUNCIADO · literal` (G4) |
| **Observador** | Quem **lê** uma ocorrência de área comum sem ser autor nem gestor dela. Pode aderir; **não** comenta. | **Solicitante** — o observador não é autor daquela ocorrência | `NOSSO` (D11) |
| **Agir no sistema** | Executar qualquer comando. **Invariante: para agir, o vínculo precisa de um Usuário.** | — | `NOSSO` (D4) |

---

## 2. Organização e lugar

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Organização** | O condomínio, a empresa, o bairro ou a organização que usa o Resolve Aí. **É o limite de isolamento de dados** e o cliente do produto. | **`tenant`** — termo técnico para o mesmo limite, usado só ao falar de isolamento. **Nunca é nome de domínio.** | `ENUNCIADO · aberto` |
| **Área** | Uma subdivisão configurada da Organização — bloco B, garagem, salão de festas, apartamento 302. Toda Área tem um **tipo**. | **Localização** | `NOSSO` (D10) |
| **Área comum** | Tipo de Área acessível a todos. Ocorrências nela são **visíveis aos demais moradores** da Organização — conforme o tipo **vigente quando a ocorrência foi registrada**, não o tipo atual da Área. | **Unidade privativa** | `NOSSO` (D10) |
| **Unidade privativa** | Tipo de Área de uso exclusivo. Ocorrências nela são visíveis **só ao autor e aos Gestores** — conforme o tipo **vigente quando a ocorrência foi registrada**. Reclassificar a Área depois **não muda** a visibilidade do que já foi registrado. | **Área comum** | `NOSSO` (D10) |
| **Localização** | A indicação de **onde, dentro da Organização**, a ocorrência aconteceu: uma referência a uma **Área** mais um complemento em texto livre ("ao lado da vaga 34"). | **Área** — Localização *aponta para* uma Área. E não é geolocalização: não há mapa nem coordenada. | `ENUNCIADO · aberto` (S5) |
| **Categoria** | A natureza da ocorrência — iluminação, vazamento, limpeza. **Configurável por Organização**, com semente das 7 do enunciado. | **Prioridade** — categoria é *o que é*; prioridade é *quanto corre* | `ENUNCIADO · aberto` |
| **Código da Organização** | Identificador **público e persistente** que permite pedir entrada numa Organização. Vive em cartaz, QR code no elevador, mensagem de grupo. Quem usa abre um **Pedido de entrada**, que o Gestor decide. | **Convite** — o convite é privado e de uso único | `NOSSO` (D25) |
| **Convite** | **Token de uso único**, vinculado a uma Pessoa específica e com validade, que leva à página de cadastro com os dados dela pré-preenchidos e editáveis. Entrar por convite **dispensa o Pedido de entrada**, porque o Gestor já criou aquela Pessoa. É um **link**, não um e-mail — pode ir por e-mail, WhatsApp ou QR. | **Código da Organização** | `NOSSO` (D25) |
| **Whitelabel** | Personalização da página pública de cadastro de uma Organização: logo e nome. | — | `NOSSO` (D25) |

> **Termo retirado: "Local".** Existiu enquanto considerávamos uma hierarquia acima do condomínio. Com
> a D3 (`Organização` é o próprio condomínio), ficou redundante — e colidia foneticamente com
> *Localização*. **Não usar.**

---

## 3. A ocorrência

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Ocorrência** | O problema registrado por um Solicitante e acompanhado até a resolução. É o objeto central do sistema. | **"solicitação"**, **"chamado"**, **"demanda"**, **"ticket"** — o enunciado usa "solicitações" ao descrever o contexto, mas o termo do domínio é **Ocorrência**, e só ele. Ver colisão nº 2 | `ENUNCIADO · literal` |
| **Prioridade** | O quanto uma ocorrência corre, definido **pelo Gestor**. Nasce "normal"; alterável enquanto a ocorrência não estiver em estado terminal. | **Urgência** (termo não usado) e **Categoria** | `ENUNCIADO · aberto` (G3) |
| **Solução aplicada** | O registro do que foi efetivamente feito para resolver a ocorrência, feito pelo Gestor. | **Observação da alteração** | `ENUNCIADO · aberto` (G7) |
| **Avaliação** | A nota que o Solicitante autor dá à resolução, depois de a ocorrência estar `Resolvida`. **Não é um estado** do ciclo de vida. | ⚠️ **`Em análise`**, que é o estado em que o **Gestor** avalia a ocorrência. Ver colisão nº 3 | `ENUNCIADO · aberto` (S10) |
| **Adesão** | A ação de um Observador declarar *"também estou com esse problema"* numa ocorrência de área comum. É a única ação dele. | **Comentário** — adesão é um clique contável, não texto | `NOSSO` (D11) |
| **Duplicidade** | A relação entre uma ocorrência cancelada com motivo `duplicada` e a ocorrência original, registrada como **vínculo**. Nada é migrado. | **Mesclagem (merge)** — não existe no produto. Ver "termos que não usamos" | `NOSSO` (D17) |

---

## 4. Ciclo de vida e auditoria

Os cinco estados e os cinco campos do registro são `ENUNCIADO · literal` — não podem ser renomeados
nem removidos. `Pausada` é acréscimo nosso, autorizado pelo *"no mínimo"* do enunciado.

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Status** | O ponto do ciclo de vida em que a ocorrência está. | **"Estado"** — o enunciado alterna os dois; adotamos **Status** como termo único | `ENUNCIADO · literal` |
| **Aberta** | Registrada e ainda não analisada por nenhum Gestor. | — | `ENUNCIADO · literal` |
| **Em análise** | O Gestor está avaliando a ocorrência. | ⚠️ **Avaliação** (do Solicitante). Ver colisão nº 3 | `ENUNCIADO · literal` |
| **Em atendimento** | O trabalho está em execução. | **Pausada** | `ENUNCIADO · literal` |
| **Resolvida** | O Gestor conferiu e declarou concluída. Estado terminal. | **Cancelada** — não é "resolvida com resultado ruim" | `ENUNCIADO · literal` |
| **Cancelada** | Encerrada sem resolução, com **motivo obrigatório**. Estado terminal. | **Resolvida**; e **Pausada** | `ENUNCIADO · literal` |
| **Pausada** | Parada esperando alguém, com **motivo obrigatório** (aguardando informação do solicitante · peça · autorização · terceiro). Sai da lista de em andamento; ao retomar, volta ao status anterior. | **Cancelada** (terminal) e **"Impedimento"** (termo absorvido) | `NOSSO` (D8) |
| **Transição de status** | A operação de negócio que muda o status. Só acontece por **comando nomeado** (`analisar`, `iniciarAtendimento`, `pausar`, `retomar`, `resolver`, `cancelar`, `reabrir`). | **Atualizar o campo status** — não existe; ninguém de fora escreve status | `ENUNCIADO · aberto` |
| **Registro de transição** | O registro imutável gerado por **cada** transição, com os cinco campos: status anterior · novo status · data e horário · usuário responsável · observação da alteração. | **Histórico** (ver colisão nº 1) | `ENUNCIADO · literal` |
| **Observação da alteração** | O texto que o autor da transição escreve **no momento do comando**, explicando o porquê. É intenção humana, não diferença de dados. | **Comentário** e **Solução aplicada** | `ENUNCIADO · literal` |
| **Trilha de auditoria** | A sequência completa e imutável dos registros de transição de uma ocorrência. É o que satisfaz *"cada transição de status deve ser auditável"*. | **Linha do tempo** | `ENUNCIADO · aberto` |
| **Linha do tempo** | A visão que o Solicitante consulta ao acompanhar o andamento: transições **mais** mensagens **mais** atribuições. É **modelo de leitura derivado**, não tabela. | **Trilha de auditoria** — a trilha é só transições e é a fonte; a linha do tempo é a apresentação | `NOSSO` |
| **Rótulo exibido** | O texto mostrado ao Solicitante para um status ("o síndico está avaliando"). Diferente do nome interno, que é fixo. | Os nomes dos estados, que são literais do enunciado | `NOSSO` (D19) |

---

## 5. Comunicação

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Canal de conversa** | Um espaço de mensagens escopado a uma Ocorrência, com um lado fixo (os Gestores) e um lado variável. Existem exatamente três. | **Notificação** | `NOSSO` (D9) |
| **Comentário** | O **canal 1**: Gestores + Solicitante. É o que o enunciado chama de "adicionar comentários". | **Nota interna** e **Mensagem da atribuição** | `ENUNCIADO · literal` (S8, G6) |
| **Nota interna** | O **canal 2**: só Gestores. | **Comentário** | `NOSSO` (D9) |
| **Mensagem da atribuição** | O **canal 3**: Gestores + o **responsável atribuído**. Sua identidade é a **atribuição**, não a pessoa — por isso um novo responsável não vê a conversa do anterior. | **Comentário**; e **Notificação** | `NOSSO` (D9) |
| **Arquivar** | Fechar um canal para novas mensagens, preservando o conteúdo e a visibilidade aos Gestores. **Arquivado nunca é apagado.** | **Apagar** — não existe no produto | `NOSSO` (D9) |
| **Notificação** | O aviso gerado a cada transição de status, para o Solicitante autor e para o responsável atribuído **que tenha Usuário**. | **Mensagem** — mensagem é conversa; notificação é aviso de fato | `NOSSO` (D14) |
| **Sino** | A apresentação em lista das notificações do próprio Usuário. | **Filtro rápido** — o sino responde *"o que aconteceu comigo?"*; o filtro responde *"o que preciso fazer?"* | `NOSSO` (D15) |
| **Filtro rápido** | Visão pré-definida da listagem de ocorrências, alcançável em poucos cliques: não triadas · pausadas esperando o Gestor · alta prioridade · sem atualização há muito tempo. | ⚠️ **"Fila"** — termo do Jira, retirado. Ver colisão nº 5 | `NOSSO` (D15) |

---

## 6. Tempo, medição e plano

| Termo | Definição | Não confundir com | Origem |
|---|---|---|---|
| **Tempo de calendário** | Do registro até a resolução, **incluindo** as pausas. É o que o Solicitante sente. | **Tempo ativo** | `NOSSO` (passo 4) |
| **Tempo ativo** | O mesmo intervalo **excluindo** as pausas. Mede o trabalho de Gestor e Encarregado. É **derivado da trilha de auditoria**, não um campo. | **Tempo de calendário** | `NOSSO` (passo 4) |
| **Envelhecimento** | Há quanto tempo uma ocorrência está aberta, agrupado em faixas (0–2 dias · 3–5 · 6+). Sinaliza; **nunca altera prioridade sozinho**. | **Prioridade** | `NOSSO` (D15, D16) |
| **Recorrência** | Volume de ocorrências por Categoria e por Área ao longo do tempo. É o indicador que distingue oito ordens de serviço de **uma obra**. | **Duplicidade** — recorrência é padrão no tempo; duplicidade é o mesmo problema relatado duas vezes | `NOSSO` (D19) |
| **Plano gratuito** · **plano pago** | Os planos comerciais **do produto**. No gratuito, notificação só dentro do app; no pago, também e-mail, push e WhatsApp. | ⚠️ **Free tier de infraestrutura** — a restrição de custo zero do *projeto*. Duas coisas diferentes. Ver colisão nº 4 | `NOSSO` (D13) |
| **Free tier de infraestrutura** | O limite gratuito do provedor de nuvem onde o Resolve Aí é publicado. Restrição do trabalho acadêmico, invisível ao cliente. | **Plano gratuito** do produto | `NOSSO` (restrição do projeto) |

---

## 7. As cinco colisões que este glossário resolve

Estas não são hipóteses — **os termos já colidiam nas fontes do enunciado** antes de nós escrevermos
qualquer coisa.

**1. "Histórico" tinha três significados.** No `fluxograma-1` aparece como *atributo da Ocorrência*; no
`fluxograma-2` e `-3`, como *registro de auditoria da transição*; e o Solicitante deve "consultar o
histórico" (S9), sem o enunciado dizer qual dos dois. Quebrado em três termos: **Registro de
transição** (a unidade), **Trilha de auditoria** (a sequência imutável) e **Linha do tempo** (a visão
que o Solicitante vê). **"Histórico" sozinho não é termo do projeto** — não usar.

**2. "Responsável" tinha três significados, e foi quebrado em três termos.** O Gestor *"atribui um
responsável"* (G4); o registro de transição tem *"usuário responsável"* (F5), que é **quem fez a mudança
de status**; e nós tínhamos criado um **papel** com esse nome. Três conceitos, um nome, nas duas pontas do
sistema.

A quebra:

| Conceito | Termo adotado |
|---|---|
| O **papel** de quem executa o trabalho | **Encarregado** |
| A **atribuição** numa ocorrência específica | **responsável pela ocorrência** — mantém a palavra do enunciado exatamente onde ele a usa |
| O **campo do registro de transição** (F5) | **autor da transição** |

A observação que destravou isso: *"responsável nunca foi um papel — na prática ele só existe como
atribuição dentro de uma ocorrência"*. O Solicitante tem responsabilidades sobre a solicitação e o Gestor
tem outras; chamar um terceiro de "o responsável" não diz o que ele faz. **Transformar "responsável" em
ator foi decisão nossa (D4), não do enunciado** — o enunciado só exige a capacidade de atribuir.

**3. "Avaliação" colide com "Em análise".** A avaliação é do Solicitante sobre o resultado; `Em
análise` é o Gestor examinando a ocorrência. Em português os dois viram "análise" na conversa. Regra:
**avaliação é sempre do Solicitante; análise é sempre do Gestor.**

**4. "Gratuito" tinha dois significados** que nasceram na mesma semana: o **plano gratuito do produto**
(decisão comercial) e o **free tier de infraestrutura** (restrição do trabalho). Sempre qualificar.

**5. "Fila" nunca foi termo do negócio.** Entrou por empréstimo do Jira e foi retirada, porque carrega
FIFO e distribuição de trabalho, que não existem aqui. O termo é **filtro rápido**.

---

## 8. Termos que decidimos não usar

Registrar o que **não** é vocabulário do projeto evita que ele volte por descuido.

| Termo | Por que não |
|---|---|
| **Urgência** | Decidimos não ter campo de urgência declarada pelo Solicitante: o campo sofre inflação e vira ruído. A intenção dele vive na `descrição`, guiada por UX (D7) |
| **Fila** | Vocabulário de ferramenta. É **filtro rápido** (D15) |
| **Local** | Redundante depois da D3, e colidia com *Localização* |
| **Impedimento** | Absorvido por **Pausada** com motivo (D8) |
| **Mesclar / merge** | O produto não mescla ocorrências — vincula duplicadas (D17). Merge destruiria uma das trilhas de auditoria |
| **SLA** | Não há contrato nem prazo acordado. Existe **envelhecimento**, que sinaliza sem prometer |
| **Ticket / chamado / demanda** | O termo é **Ocorrência** |
| **Admin / User / João** | Atores são nomeados por função (aula 2, p.7) |
| **Reabertura** | Não existe. Problema que volta é **nova ocorrência vinculada à original** (D24) — `Resolvida` e `Cancelada` são terminais de verdade |
| **"Responsável" como papel** | O papel é **Encarregado** (D27). "Responsável" ficou reservado para a atribuição |
| **Fila de trabalho** | Ver "Fila" acima. O termo é **filtro rápido** |

---

## 9. Notas de método

**A taxonomia "Termos Ambíguos vs Termos Sinônimos" da aula 3 (p.6) não foi usada.** As duas definições
do professor são praticamente idênticas e as orientações que ele dá são opostas, e ambos os exemplos
são de ambiguidade, não de sinonímia. Adotamos a orientação operante do mesmo trecho: **um termo, uma
definição.**

**Nome técnico não é automaticamente termo de linguagem ubíqua.** Critério estabelecido em 20/08/2026, ao
modelar os dados, e que vale para nome de coluna, de tabela, de endpoint e de recurso: **entra no glossário
o conceito**, não o identificador. A coluna ou o endpoint herda o nome do conceito quando houver um; quando
não houver, o nome é decisão técnica — desde que **a distinção que ele representa** esteja no glossário.

O caso que fixou o critério: `email_contato` é nome de coluna e **não** virou termo, mas a distinção que
ele carrega — o e-mail de contato da Pessoa não é a credencial, e os dois podem divergir — entrou na
definição de **Pessoa**, que é onde faz falta. Já `Pedido de entrada` virou termo, porque é conceito: é
uma coisa que existe no domínio, aguardando decisão de alguém.

**Duas definições deste glossário nasceram de análise, não de coleta** — e por isso são as mais
frágeis: a separação entre **Área** e **Localização**, e a distinção entre **Trilha de auditoria** e
**Linha do tempo**. Ambas resolvem ambiguidade real das fontes, mas nenhuma foi validada com um síndico
de verdade.

**Fonte das definições.** Onde há citação do enunciado, ela é literal (`refs/Desafio Full Stack
Development.pdf`). O restante vem das decisões registradas em `trabalho/produto/decisoes-de-produto.md`
e do Event Storming em `trabalho/produto/event-storming.md`, produzidos com o assistente no papel de
**Domain Expert por proxy** — fonte mais fraca que um especialista de domínio real.
