# Escopo — Resolve Aí

Este documento responde a quatro perguntas, nesta ordem: **o que o Resolve Aí é** quando estiver
completo, **o que entra na primeira entrega**, **o que ficou de fora e por quê**, e **o que está
projetado para depois**.

A parte 1 é autossuficiente: dá para entender o produto sem ter lido nenhum outro documento. As partes
2 a 4 dependem do vocabulário fixado no [Glossário](glossario.md) e citam as decisões de produto pelo
identificador (`D1` a `D27`), as premissas por `P1` a `P5` e os pontos de atenção por `PA-nn`.

## Como ler

Todo item de escopo carrega a **origem**, e é ela que torna o corte verificável:

| Marcador | Significado | Pode ser cortado? |
|---|---|---|
| `ENUNCIADO · literal` | O desafio define o quê **e** o como | **Não** |
| `ENUNCIADO · aberto` | A existência é imposta; a forma é decisão do projeto | **Não** (a existência) |
| `NOSSO` | Adição do projeto — justificada em valor contra custo | **Sim** |

Duas convenções de leitura:

- **Nenhum item `ENUNCIADO` ficou de fora da primeira entrega.** Os 21 itens adiados são `NOSSO`, sem
  exceção — a proporção está na tabela de origem da parte 2.
- Quando um item cobre mais de um requisito do desafio, o marcador é o **mais restritivo** dos dois.
  *Registrar com título, descrição e categoria* é `ENUNCIADO · literal` porque os três campos são
  literais, ainda que o fluxo de registro seja aberto.

---

## 1 · O produto

O Resolve Aí é a plataforma onde uma **Organização** — um condomínio, uma empresa, um bairro — registra
e acompanha **ocorrências**: iluminação queimada, vazamento, limpeza, equipamento quebrado, falta de
acessibilidade, segurança, manutenção. Cada ocorrência percorre um ciclo de vida definido, e **cada
mudança de status fica registrada de forma imutável**, com quem fez, quando e por quê.

Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha. O pedido chega como texto solto e
alguém o transcreve à mão; o andamento vive fora do canal em que o pedido nasceu, então responder exige
procurar duas vezes; e é justamente quando a ocorrência trava esperando por alguém que ela desaparece.
O produto existe para que **o Solicitante saiba o andamento sem precisar perguntar** e **o Gestor não
perca ocorrências em espera**.

Três papéis, nomeados pela função que exercem dentro de uma Organização:

| Papel | Quem é | O que faz |
|---|---|---|
| **Solicitante** | Morador, funcionário ou membro da Organização | Registra a ocorrência e acompanha até saber que acabou |
| **Gestor** | Síndico ou administrador — quem responde pela operação | Analisa, prioriza, atribui, acompanha e **decide que a ocorrência está resolvida** |
| **Encarregado** | Zelador, técnico, prestador — quem executa o trabalho | Recebe atribuições e executa. **Pode ou não ter acesso ao sistema** |

Uma mesma pessoa pode ter papéis diferentes em organizações diferentes: o vínculo é sempre com uma
Organização, e é ele que carrega o papel.

### 1.1 O que o Solicitante faz

- **Registra uma ocorrência** com título, descrição e categoria, indica **onde** foi — uma Área
  configurada da Organização mais um complemento em texto, como *"ao lado da vaga 34"* — e anexa uma
  imagem. O registro inteiro cabe em menos de um minuto pelo celular, com foto.
- **Vê as ocorrências de área comum** do seu local e, em vez de abrir outra igual, declara **adesão**:
  *"também estou com esse problema"*. Ocorrências em unidade privativa aparecem só para o autor e para
  os Gestores.
- **Acompanha as próprias ocorrências** pelo status atual e pela **linha do tempo** de cada uma —
  transições, mensagens e atribuições na ordem em que aconteceram. Os status aparecem com rótulo em
  linguagem de gente: *"o síndico está avaliando"*, não *"Em análise"*.
- **Comenta** dentro da ocorrência, num espaço que é dele com os Gestores.
- **É avisado a cada mudança de status**, inclusive quando a ocorrência é pausada esperando uma
  informação dele.
- **Avalia a resolução** depois que a ocorrência é resolvida. É a única medida de qualidade que o
  produto tem.
- **Cancela a própria ocorrência** com motivo — desistiu, resolveu por conta própria, abriu por engano
  — enquanto ninguém tiver começado a trabalhar nela. Depois disso, pede o cancelamento pelo comentário
  e quem cancela é o Gestor.

### 1.2 O que o Gestor faz

- **Vê todas as ocorrências da sua Organização** e filtra por categoria, status e prioridade.
- Alcança em poucos cliques os **filtros rápidos** — as visões que respondem *o que eu preciso fazer
  agora*: não triadas · pausadas esperando por ele · alta prioridade · sem atualização há muito tempo.
  Ocorrências que envelhecem ficam destacadas; **nada sobe de prioridade sozinho**, quem decide é ele.
- **Analisa** a ocorrência e **altera a prioridade**, que nasce normal e fica travada quando a
  ocorrência chega a um estado terminal — para que o dashboard não responda coisas diferentes conforme
  o dia da pergunta.
- **Atribui um responsável pela ocorrência**: qualquer Pessoa com vínculo na Organização, inclusive ele
  mesmo em um clique. Reatribuir é um clique também.
- **Inicia o atendimento** — que exige alguém atribuído, porque *quem está fazendo* é exatamente o que
  hoje se perde —, **pausa com motivo** (aguardando informação do solicitante · peça · autorização ·
  terceiro) e **retoma**, voltando ao status em que estava.
- **Cancela** com motivo estruturado e observação. Quando o motivo é duplicidade, a ocorrência cancelada
  fica **vinculada à original** — nada é mesclado, nada é apagado.
- **Registra a solução aplicada** e **resolve**. Quem decide que acabou é sempre o Gestor, nas duas
  variantes da persona.
- **Conversa em três espaços separados**, todos dentro da ocorrência: com o Solicitante (o comentário),
  só entre Gestores (a nota interna) e com o responsável atribuído. Trocar de responsável abre uma
  conversa nova e **arquiva** a anterior, que segue visível aos Gestores.
- **Configura a Organização**: as categorias — que nascem com as sete do desafio e são ajustáveis —, as
  Áreas e o tipo de cada uma (comum ou privativa), e quem entra.
- **Lê o dashboard**, que responde o que a lista não responde — padrão e tendência: recorrência por
  categoria e por área, tempo médio de resolução mês a mês, **tempo de calendário × tempo ativo**
  (com e sem as pausas) e média das avaliações. A recorrência é o indicador que distingue oito ordens
  de serviço de **uma obra**.

### 1.3 O que o Encarregado faz

O Encarregado é cadastrado pelo Gestor e pode receber atribuições **tenha ele acesso ao sistema ou
não** — a regra que atravessa o produto é uma só: **para agir no sistema, é preciso ter conta**.

- **Sem conta:** existe como cadastro, aparece como responsável pela ocorrência e recebe o trabalho
  pessoalmente. O Gestor age em nome dele no sistema. É o caso do zelador que não usa celular.
- **Com conta:** vê **só o que é dele**, com a localização exata e a foto; abre a lista e o detalhe
  **sem rede**, porque o trabalho acontece em subsolo, casa de máquinas e garagem; conversa com os
  Gestores no espaço da própria atribuição; **pausa com motivo** em um toque; **reporta a execução
  concluída** — e a decisão de que está resolvido continua sendo do Gestor; e pode **recusar uma
  atribuição**.

Não existe conversa direta entre Solicitante e Encarregado: o nome de quem está cuidando é visível ao
Solicitante, mas a comunicação passa pelo Gestor.

### 1.4 O ciclo de vida e a trilha de auditoria

Uma ocorrência nasce **Aberta** e caminha por **Em análise**, **Em atendimento** e **Resolvida**.
**Cancelada** é alcançável a partir dos três primeiros. A esses cinco o produto acrescenta **Pausada**,
com motivo obrigatório: é onde o trabalho se perde hoje, e nomear a espera é o que permite vigiá-la.

`Resolvida` e `Cancelada` são **terminais de verdade**: nenhuma ocorrência volta atrás. Se o problema
retorna — a lâmpada nova já pisca, o vazamento reaparece —, o
Solicitante abre uma **nova ocorrência vinculada à original**, e o vínculo é o que faz "voltou a
acontecer" aparecer como recorrência no dashboard.

Cada transição grava um **registro imutável** com cinco campos: status anterior · novo status · data e
horário · autor da transição · observação da alteração. A observação é obrigatória onde há uma decisão
a justificar — pausar e cancelar — e opcional no avanço rotineiro. **Ninguém edita o status
diretamente**: só existem comandos nomeados, e é por isso que é impossível mudar o status sem deixar
registro. A sequência completa desses registros é a **trilha de auditoria**; a **linha do tempo** que o
Solicitante lê é a apresentação dela, somada às mensagens e às atribuições.

### 1.5 Uma instância, várias organizações

O produto atende várias organizações na mesma instância, e **a Organização é o limite de isolamento**:
nenhuma consulta atravessa a fronteira de uma. A Organização é criada por auto-serviço, e quem a cria
vira o Gestor inicial — é o que resolve o primeiro vínculo, que não teria quem o aprovasse.

Depois disso, **todo vínculo nasce aprovado por um Gestor**: ou porque ele convidou por um link de uso
único, ou porque aprovou um pedido de entrada feito com o código público da Organização — aquele que
vive no cartaz do elevador. Código vazado não vira acesso: vira um pedido aguardando aprovação.

---

## 2 · O recorte da primeira entrega

**61 itens de escopo mapeados. 40 entram na primeira entrega; 21 são evolução prevista.**

| Atividade | Entra | Evolução prevista |
|---|---|---|
| 0 · Configurar a organização | **5** | 2 |
| 1 · Entrar na organização | **4** | 4 |
| 2 · Registrar a ocorrência | **3** | 1 |
| 3 · Triar | **5** | 2 |
| 4 · Atribuir | **3** | 2 |
| 5 · Executar | **3** | 3 |
| 6 · Fechar | **3** | 1 |
| 7 · Acompanhar | **4** | 4 |
| 8 · Gerir | **4** | 2 |
| Fundação técnica | **6** | — |
| **Total** | **40** | **21** |

E a proporção que importa para o critério de corte:

| Origem | Entra | Evolução prevista | Total |
|---|---|---|---|
| `ENUNCIADO · literal` | **8** | 0 | 8 |
| `ENUNCIADO · aberto` | **16** | 0 | 16 |
| `NOSSO` | **16** | **21** | 37 |
| **Total** | **40** | **21** | **61** |

**Os 24 itens `ENUNCIADO` estão inteiros na primeira entrega.** Todo o corte recaiu sobre adições do
projeto: dos 37 itens `NOSSO`, 16 entraram e 21 ficaram para depois.

Os 16 `NOSSO` que entraram não estão lá por gosto — cada um é a cola sem a qual um requisito do desafio
não funciona. Sem Organização não há onde registrar; sem categorias e áreas semeadas, a Organização
nasce vazia e nada pode ser registrado; sem pedido de entrada e aprovação, ninguém além de quem criou
consegue entrar; sem cadastro de Encarregados não há a quem atribuir; sem rótulo amigável o Solicitante
lê *"Em análise"* e não sabe se aquilo é bom ou ruim; e sem a recorrência o dashboard exigido pelo
desafio responderia o que a lista já responde. **A única escolha de verdade no corte foi `Pausada`** — ela não é exigida
pelo desafio e poderia sair, mas é a resposta direta à dor mais forte das duas personas: *"acabo me
perdendo e a ocorrência some dentre outras"*. Sem ela, a primeira entrega cumpre o desafio e não
resolve o problema que o produto veio resolver.

> **Legenda das tabelas abaixo:** ✅ entra na primeira entrega · ⬜ evolução prevista.

### 0 · Configurar a organização

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Criar a organização por auto-serviço; quem cria vira o Gestor inicial | `NOSSO` (D26) | ✅ |
| Categorias-semente — as sete do desafio, criadas junto com a organização | `NOSSO` (D18) | ✅ |
| Áreas-semente, com os tipos *comum* e *privativa* | `NOSSO` (D10, D18) | ✅ |
| Editar categorias | `ENUNCIADO · aberto` | ✅ |
| Editar áreas | `NOSSO` (D18) | ✅ |
| Identidade da organização na página de cadastro — logo e nome | `NOSSO` (D25) | ⬜ |
| Interruptor *"exigir descrição da solução ao resolver"* | `NOSSO` (D22) | ⬜ |

### 1 · Entrar na organização

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Criar conta e autenticar-se | `ENUNCIADO · aberto` (S1, S2) | ✅ |
| Pedir entrada com o código da organização, aguardando aprovação | `NOSSO` (D25) | ✅ |
| Gestor aprova ou recusa o pedido de entrada | `NOSSO` (D25) | ✅ |
| Cadastro de Encarregados, sem conta | `NOSSO` (D27) | ✅ |
| Página pública da organização, com o código embutido na URL | `NOSSO` (D25) | ⬜ |
| Convite por link de uso único, com dados pré-preenchidos e editáveis | `NOSSO` (D25) | ⬜ |
| Importar pessoas em lote | `NOSSO` (D25) | ⬜ |
| Revogar vínculo | `NOSSO` (D4) | ⬜ |

### 2 · Registrar a ocorrência

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Registrar com título, descrição e categoria | `ENUNCIADO · literal` (S3, S4) | ✅ |
| Informar a localização: uma Área mais complemento em texto | `ENUNCIADO · aberto` (S5) + D10 | ✅ |
| Anexar uma imagem, comprimida no próprio celular | `ENUNCIADO · aberto` (S6) + RNF8 | ✅ |
| Ver ocorrências semelhantes no mesmo local e **aderir** | `NOSSO` (D11) | ⬜ |

Duas restrições de qualidade atravessam esta atividade e valem desde a primeira entrega: o registro
completo cabe em **menos de um minuto pelo celular**, com foto (RNF6), e a imagem é **comprimida no
próprio aparelho** antes de subir (RNF8) — é ela que faz o anexo caber nesse tempo. Não são itens de
escopo: são o alvo de qualidade sobre os itens acima.

### 3 · Triar

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Listar todas as ocorrências da organização | `ENUNCIADO · aberto` (G1) | ✅ |
| Filtrar por categoria, status e prioridade | `ENUNCIADO · literal` (G2) | ✅ |
| Analisar — transição `Aberta → Em análise` | `ENUNCIADO · literal` (F2) | ✅ |
| Alterar a prioridade | `ENUNCIADO · aberto` (G3) + D6 | ✅ |
| Cancelar com motivo estruturado e observação | `ENUNCIADO · literal` (F3) + D12 | ✅ |
| Filtros rápidos — não triadas · pausadas esperando o Gestor · sem atualização | `NOSSO` (D15) | ⬜ |
| Cancelar por duplicidade, com vínculo à ocorrência original | `NOSSO` (D17) | ⬜ |

### 4 · Atribuir

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Atribuir o responsável pela ocorrência — qualquer Pessoa com vínculo | `ENUNCIADO · aberto` (G4) + D21 | ✅ |
| Auto-atribuição do Gestor, em um clique | `NOSSO` (D21) | ✅ |
| Reatribuir | `NOSSO` | ✅ |
| Conversa privada da atribuição, entre Gestores e responsável | `NOSSO` (D9) | ⬜ |
| Encarregado recusa a atribuição | `NOSSO` | ⬜ |

### 5 · Executar

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Iniciar o atendimento — exige responsável atribuído | `ENUNCIADO · literal` (F2) + D21 | ✅ |
| Pausar com motivo estruturado | `NOSSO` (D8) | ✅ |
| Retomar, voltando ao status anterior à pausa | `NOSSO` (D8) | ✅ |
| Encarregado entra no sistema e vê a própria lista | `NOSSO` (P5) | ⬜ |
| Leitura sem rede da lista e do detalhe | `NOSSO` (RNF7, P5) | ⬜ |
| Encarregado reporta a execução concluída | `NOSSO` (P5) | ⬜ |

### 6 · Fechar

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Registrar a solução aplicada | `ENUNCIADO · aberto` (G7) + D22 | ✅ |
| Resolver — transição para `Resolvida` | `ENUNCIADO · literal` (F2) | ✅ |
| Avaliar a resolução | `ENUNCIADO · aberto` (S10) + D1 | ✅ |
| Abrir nova ocorrência vinculada à original, quando o problema volta | `NOSSO` (D24) | ⬜ |

### 7 · Acompanhar — o Solicitante

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Ver as minhas ocorrências e o status atual | `ENUNCIADO · aberto` (S7) | ✅ |
| Ver a linha do tempo da ocorrência | `ENUNCIADO · aberto` (S9) | ✅ |
| Comentar com os Gestores dentro da ocorrência | `ENUNCIADO · aberto` (S8, G6) + D9 | ✅ |
| Rótulos em linguagem de gente no lugar dos nomes internos de status | `NOSSO` (D19) | ✅ |
| Ver as ocorrências de área comum do meu local | `NOSSO` (D10) | ⬜ |
| Sino com as notificações do próprio usuário | `NOSSO` (D14, D15) | ⬜ |
| Notificação a cada transição de status | `NOSSO` (D14) | ⬜ |
| Nota interna entre Gestores | `NOSSO` (D9) | ⬜ |

### 8 · Gerir

| Capacidade | Origem | 1ª entrega |
|---|---|---|
| Dashboard com indicadores | `ENUNCIADO · aberto` (G8) | ✅ |
| Backlog por status e por categoria | `NOSSO` (D19) | ✅ |
| Média das avaliações | `NOSSO` (D19) | ✅ |
| **Recorrência por categoria e por área** | `NOSSO` (D19) | ✅ |
| Tempo de calendário × tempo ativo | `NOSSO` (D19) | ⬜ |
| Alarme de ocorrência parada há muito tempo | `NOSSO` (D15) | ⬜ |

A recorrência entra porque é ela que faz o dashboard responder o que a lista não responde. Sem ela, o
indicador exigido pelo desafio mostraria o mesmo que a listagem já mostra — e oito vazamentos no mesmo
bloco em três meses continuariam parecendo oito ordens de serviço, em vez de **uma obra**.

### Fundação técnica

Não são capacidades de usuário; atravessam todas as atividades e entram inteiras. A origem indicada é a
do requisito que cada uma realiza.

| Item | Origem | 1ª entrega |
|---|---|---|
| Agregado `Ocorrência` com máquina de estados e trilha imutável | `ENUNCIADO · literal` (F4, F5, F6) · ADR-0001 | ✅ |
| Isolamento por organização em ponto único, com verificação automatizada | `NOSSO` (D2, D3, RNF1) · ADR-0003 | ✅ |
| Ambiente executável em contêiner | `ENUNCIADO · literal` (E7) | ✅ |
| Publicação em nuvem, com pipeline | `ENUNCIADO · aberto` (E8) | ✅ |
| Testes de domínio, de aplicação, de isolamento e de ponta a ponta | `ENUNCIADO · aberto` (E6) | ✅ |
| Documentação e README | `ENUNCIADO · aberto` (E9) | ✅ |

---

## 3 · Por que cada corte

### 3.1 O maior corte: o Encarregado sem acesso próprio ao sistema

Cinco itens caem juntos — o **acesso do Encarregado**, a **lista do que é dele**, a **leitura sem
rede**, o **reporte de execução concluída**, a **recusa de atribuição** — e com eles a **conversa
privada da atribuição**. É o maior bloco de corte do recorte, e o critério **não foi tempo**.

A capacidade que o desafio exige — *atribuir um responsável* (G4) — entra inteira: o Encarregado é
cadastrado, é atribuído, aparece como responsável pela ocorrência e a atribuição fica registrada. O que
fica de fora é ele **agir por si** dentro do sistema.

A razão é que essas capacidades se apoiam numa persona que **nunca foi validada**. A variante do Gestor
que funciona sem elas é o síndico amador, e ela funciona inteira: o zelador não usa celular, e o Gestor
age em nome dele — foi assim que a jornada foi narrada. Quem precisaria do acesso próprio é o síndico
profissional, que responde por vários condomínios e trabalha com equipe terceirizada — e essa é
exatamente a persona **narrada de fora**, por quem é síndico amador, e registrada como premissa não
confirmada (**P5**). Construir três itens grandes sobre uma persona não confirmada é o pior
investimento disponível.

A conversa da atribuição cai por construção, não por escolha: ela só existe entre os Gestores e um
responsável **que tenha conta** — sem conta, não há ninguém do outro lado para ler (D9).

**Dois custos declarados.** Quando o Gestor age em nome do Encarregado, o campo *autor da transição*
registra o Gestor, mesmo quando o trabalho foi de outra pessoa: a trilha fica correta e **incompleta**,
e isso toca o requisito central do desafio (**PA-07**). E o requisito de leitura sem rede (RNF7), que
existe para quem trabalha em subsolo e casa de máquinas, não é exercido na primeira entrega.

### 3.2 O segundo corte: o aviso automático

Ficam de fora a **notificação a cada transição** e o **sino**. Também não entra a entrega por canal
externo — e-mail, push e WhatsApp —, que por decisão de produto é feature de plano pago (D13).

O acompanhamento exigido pelo desafio continua inteiro: o Solicitante vê a lista das próprias
ocorrências com o status atual (S7) e a linha do tempo de cada uma (S9). O que muda é que ele precisa
**abrir o sistema** para saber — o sistema não vai até ele.

O **e-mail transacional de acesso** — confirmar conta, redefinir senha — permanece: é infraestrutura da
conta, não notificação de ocorrência, e sem ele ninguém entra (emenda à D13).

**Custo declarado.** O aviso automático era metade da resposta ao problema de a ocorrência sumir quando
trava (D14) — a outra metade, o alarme de ocorrência parada, também ficou de fora. A primeira entrega
entrega `Pausada` **sem a camada que a vigia**, e o risco está registrado: a classe *em espera* é
útil, mas também é onde itens se acumulam e são ignorados (**PA-12**). É o corte que mais pesa sobre os
objetivos do produto: os de não perder ocorrência na espera e de reduzir a cobrança de retorno fora do
sistema seguem **mensuráveis, mas não assistidos** — a ressalva está na
[Documentação da Demanda](documentacao-da-demanda.md).

### 3.3 Os demais

Uma linha por item, com a razão registrada.

| O que ficou de fora | Por quê |
|---|---|
| Identidade da organização na página de cadastro (D25) | Personaliza a página pública de entrada, que também ficou de fora. A primeira entrega usa o código informado manualmente |
| Página pública com o código embutido na URL (D25) | É o mesmo caminho de entrada já implementado, sem precisar digitar o código: conveniência sobre capacidade entregue |
| Convite por link de uso único (D25) | O caminho do código com aprovação já satisfaz sozinho a invariante da D25 — nenhum vínculo nasce sem aprovação do Gestor. O convite acrescenta a dispensa da aprovação e o pré-preenchimento dos dados |
| Importar pessoas em lote (D25) | Serve à carga inicial vinda de uma administradora, que é a persona não validada (P5) |
| Revogar vínculo (D4) | É manutenção administrativa, sem papel no ciclo da ocorrência: numa primeira entrega os vínculos são criados e usados, não revogados. A limitação já registrada — readmitir alguém apaga o registro da revogação anterior — só passa a importar quando houver revogação de fato |
| Interruptor *"exigir descrição da solução ao resolver"* (D22) | A decisão registra que a indução por interface entrega quase todo o valor sem rigidez; o interruptor serve a quem precisa de prestação de contas formal — de novo, a persona não validada |
| Ver semelhantes e **aderir** (D11) | Depende da visibilidade comunitária, que também ficou de fora, e é o maior item `NOSSO` fora do bloco do Encarregado |
| Ver as ocorrências de área comum do meu local (D10) | **Os dados da D10 entram; o comportamento dela não é exercido.** O tipo da área entra porque é o que dá sentido à localização exigida pelo desafio, e cada ocorrência já grava a qual Área pertence — mas a visibilidade derivada disso fica para depois. Consequência: na primeira entrega toda ocorrência é visível apenas ao autor e aos Gestores. Não há nada a migrar quando a visibilidade for ligada: a informação para derivá-la está gravada desde o primeiro registro |
| Filtros rápidos (D15) | A filtragem por categoria, status e prioridade que o desafio exige entra; as visões pré-definidas sobre ela são `NOSSO`. **É o corte de maior custo operacional**: são o que o Gestor faz todo dia (D19) |
| Alarme de ocorrência parada (D15) | Cai junto com o aviso automático — ver 3.2 |
| Cancelar por duplicidade com vínculo à original (D17) | O cancelamento com motivo entra; o vínculo serve ao cálculo de impacto sobre o grupo de duplicadas, que depende da adesão — também de fora |
| Nota interna entre Gestores (D9) | Pressupõe **mais de um Gestor** na organização. O cenário da primeira entrega é o do síndico único: o espaço existiria sem ninguém do outro lado. Faz sentido junto com a organização que tem equipe de gestão, e é lá que ele está |
| Nova ocorrência vinculada à original (D24) | Os estados terminais valem desde a primeira entrega: `Resolvida` e `Cancelada` não voltam atrás, e o problema que retorna já é registrado como uma nova ocorrência. O que fica de fora é o **vínculo** entre ela e a original — a recorrência entra medindo volume por categoria e área, e é o vínculo que depois permitiria separar *"voltou a acontecer"* de duas ocorrências apenas parecidas |
| Tempo de calendário × tempo ativo (D19) | O dado não se perde: os dois tempos são **derivados da trilha de auditoria**, que entra inteira. Fica de fora a apresentação deles — e com ela o objetivo de separar atraso externo de lentidão do gestor, que a primeira entrega não mede |

---

## 4 · Evolução prevista

Tudo aqui está **projetado e não implementado**: cada item tem decisão registrada, com o que foi
rejeitado no caminho e o custo assumido. Não implementar não é o mesmo que não ter pensado.

Esta seção diz **o que** cada evolução é. **Como** cada uma seria construída é assunto do documento de
[arquitetura](arquitetura.md).

**Aviso e comunicação**
- Notificação a cada transição de status e sino com o que aconteceu comigo (D14).
- Entrega por canal externo — e-mail, push e WhatsApp —, que é a primeira feature de plano pago (D13).
- Nota interna entre Gestores e conversa privada da atribuição, que se arquiva quando o responsável
  muda (D9).

**O Encarregado como usuário do sistema**
- Acesso próprio, com a lista do que é dele na ordem que o Gestor definiu.
- Leitura sem rede da lista e do detalhe (RNF7).
- Reporte de execução concluída e recusa de atribuição.

**Comunidade**
- Visibilidade das ocorrências de área comum aos demais moradores do local (D10).
- **Adesão** — *"também estou com esse problema"* — como sinal contável de impacto, no lugar de uma
  segunda ocorrência igual (D11).
- Vínculo de duplicidade, com o impacto calculado sobre o grupo (D17).

**Operação do Gestor**
- Filtros rápidos: não triadas · pausadas esperando por ele · alta prioridade · sem atualização há
  muito tempo (D15).
- Alarme de ocorrência parada há tempo demais (D15).

**Entrada na organização**
- Convite por link de uso único, com os dados da pessoa pré-preenchidos e editáveis — o cadastro vira
  recadastramento (D25).
- Página pública da organização, com identidade própria e código embutido na URL, servindo também de
  QR code no hall (D25).
- Importação de pessoas em lote (D25) e revogação de vínculo (D4).

**Medição**
- Tempo de calendário × tempo ativo, publicados lado a lado, para separar atraso externo de lentidão
  do gestor (D19).
- Nova ocorrência vinculada à original — o vínculo que faz *"voltou a acontecer"* aparecer na
  recorrência, que já entra medindo volume por categoria e por área (D24).

**Configuração**
- Interruptor por organização para exigir a descrição da solução ao resolver (D22).

**Alcance do produto** — projetado, sem desenho de implementação:
- Um nível acima da Organização, para a administradora que responde por vários condomínios, com a
  visão do Gestor atravessando organizações (D3, PA-19).
- Mais de um responsável por ocorrência — que é mudança de modelo, não configuração, e exige redecidir
  a conversa da atribuição (D21).
- Classificação assistida a partir do texto livre da descrição, para organizações de alto volume (D7).
- Planos comercial gratuito e pago, com cadastro aberto (D13, D26).

---

As premissas assumidas e as questões que seguem em aberto estão em
[Premissas e Questões Abertas](premissas-e-questoes-abertas.md). Os requisitos completos, com as
personas e os requisitos não funcionais quantificados, estão na
[Documentação da Demanda](documentacao-da-demanda.md).
