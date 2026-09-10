---
title: "Escopo"
description: "O que o produto é quando completo, o que entra na primeira entrega, e o que está projetado para depois."
---

# Escopo — Resolve Aí

## A primeira entrega, em uma passada

Antes das tabelas, o produto contado como quem o usa o encontra. Esta parte é a porta; o resto do
documento é a versão verificável dela.

Alguém cria conta com e-mail e senha e não pertence a organização nenhuma. Cai numa tela com dois
caminhos: **digitar o código** que está no cartaz do elevador, ou **criar uma organização**. Quem cria
vira o Gestor inicial, e a organização nasce já povoada, com as sete categorias do desafio e um conjunto
inicial de áreas, porque uma organização vazia não deixa ninguém registrar nada.

Quem digitou o código abre um **pedido de entrada** e vê uma tela dizendo que está aguardando, e dizendo
também que ninguém vai avisá-lo, porque nesta entrega não existe notificação de espécie alguma. O Gestor
encontra o pedido, aprova e escolhe o papel de quem entra. Código vazado não vira acesso: vira um pedido
esperando decisão.

O morador **registra uma ocorrência**: foto, título, descrição, categoria, a área onde foi e um
complemento em texto, como *"ao lado da vaga 34"*. O alvo é que isso caiba em **menos de um minuto pelo
celular**, com a foto subindo enquanto ele ainda digita. Depois ele acompanha: vê as ocorrências que são
dele, com o status em linguagem de gente, e conversa com os Gestores dentro da própria ocorrência.

O Gestor vê **todas** as da organização e filtra por categoria, status e prioridade. Analisa, ajusta a
prioridade, **atribui um responsável**, que pode ser ele mesmo num clique, inicia o atendimento, **pausa
com motivo** e retoma de onde parou, ou cancela com motivo. No fim, registra a **solução aplicada** e
resolve. Quem decide que acabou é sempre ele. O morador então **avalia**.

Cada uma dessas mudanças grava um registro imutável com os cinco campos que o desafio exige — status
anterior, novo status, data e hora, autor e observação —, e existe uma tela só para isso: a **trilha de
auditoria**, separada da linha do tempo que o morador lê. E o Gestor tem um **dashboard** com o backlog
por status e por categoria, a média das avaliações, a recorrência por categoria e por área, e o tempo
médio de resolução mês a mês.

### O que não existe nesta entrega

A lista importa tanto quanto a de cima, e os dois maiores cortes têm o mesmo motivo.

**O Encarregado não tem acesso próprio ao sistema.** Ele existe como cadastro, aparece como responsável e
recebe o trabalho pessoalmente; o Gestor age em nome dele. Caem junto a lista do que é dele, a leitura sem
rede, o reporte de execução concluída, a recusa de atribuição e a conversa privada da atribuição. O
critério não foi tempo: essas capacidades se apoiam na persona do síndico profissional, que foi narrada de
fora e nunca validada. Construir cinco itens grandes sobre uma persona não confirmada é o pior
investimento disponível. **Custa dois preços declarados:** quando o Gestor age em nome do Encarregado, a
trilha registra o Gestor mesmo quando o trabalho foi de outra pessoa, e isso toca o requisito central do
desafio; e o requisito de leitura sem rede não é exercido.

**Não existe aviso automático de nenhum tipo:** nem notificação, nem sino, nem alarme de ocorrência
parada, nem entrega por e-mail, push ou WhatsApp. Quem quiser saber, abre o sistema. O acompanhamento que
o desafio exige continua inteiro, porque o Solicitante vê a lista das próprias ocorrências e a linha do
tempo de cada uma; o que muda é que o sistema não vai até ele. **É o corte que mais pesa sobre os
objetivos do produto:** o aviso automático era metade da resposta ao problema de a ocorrência sumir quando
trava, e o alarme de ocorrência parada era a outra metade. A primeira entrega entrega `Pausada` sem a
camada que a vigia. O e-mail transacional de acesso permanece, porque é infraestrutura da conta e sem ele
ninguém entra.

Também ficam de fora: **convite por link**, **página pública da organização** e **importação de pessoas em
lote**; **filtros rápidos**, que são o corte de maior custo operacional, porque são o que o Gestor faz
todo dia; **adesão** a uma ocorrência parecida em vez de abrir outra igual; **nota interna entre
Gestores**, o que significa que nesta entrega não há lugar nenhum para texto que o morador não deva ler;
**ver as ocorrências de área comum do vizinho**; e **editar uma ocorrência** depois de registrada.

**Tudo que o desafio exige está na primeira entrega.** Todo o corte recaiu sobre adições do projeto, e a
parte 2 mostra item a item onde cada uma delas caiu.

### Por que este problema vale um produto

A gestão de ocorrências em condomínio é trabalho de coordenação sem ferramenta própria: acontece em grupo
de mensagens, e quem coordena mantém a memória do processo na cabeça e num caderno. Não é falta de
disciplina de quem administra, e sim ausência de um lugar onde o estado de cada pedido possa ser
consultado por quem pediu. O produto aposta que **dar endereço a esse estado é o suficiente para mudar a
rotina**, sem exigir que ninguém aprenda um processo novo: quem registra faz o que já fazia, escrevendo o
problema, e quem coordena para de transcrever.

---

Este documento responde a três perguntas, nesta ordem: **o que o Resolve Aí é** quando estiver completo,
**o que entra na primeira entrega**, e **o que está projetado para depois**.

A parte 1 é autossuficiente: dá para entender o produto sem ter lido nenhum outro documento. As partes 2 e
3 dependem do vocabulário fixado no [Glossário](glossario.md) e citam as decisões de produto pelo
identificador (`D1` a `D27`), as premissas por `P1` a `P6` e os pontos de atenção por `PA-nn`.

---

## 1 · O produto

O Resolve Aí é a plataforma onde uma **Organização** — um condomínio, uma empresa, um bairro — registra e
acompanha **ocorrências**: iluminação queimada, vazamento, limpeza, equipamento quebrado, falta de
acessibilidade, segurança, manutenção. Cada ocorrência percorre um ciclo de vida definido, e **cada
mudança de status fica registrada de forma imutável**, com quem fez, quando e por quê.

Hoje esse trabalho acontece em grupo de WhatsApp, e-mail e planilha. O pedido chega como texto solto e
alguém o transcreve à mão; o andamento vive fora do canal em que o pedido nasceu, então responder exige
procurar duas vezes; e é quando a ocorrência trava esperando por alguém que ela desaparece. As duas
jornadas que descrevem isso em detalhe, uma por variante da persona do Gestor, estão na
[Documentação da Demanda](documentacao-da-demanda.md). O produto existe para que **o Solicitante saiba o
andamento sem precisar perguntar** e **o Gestor não perca ocorrências em espera**.

Três papéis, nomeados pela função que exercem dentro de uma Organização:

| Papel | Quem é | O que faz |
|---|---|---|
| Solicitante | Morador, funcionário ou membro da Organização | Registra a ocorrência e acompanha até saber que acabou |
| Gestor | Síndico ou administrador, quem responde pela operação | Analisa, prioriza, atribui, acompanha e decide que a ocorrência está resolvida |
| Encarregado | Zelador, técnico, prestador, quem executa o trabalho | Recebe atribuições e executa. Pode ou não ter acesso ao sistema |

Uma mesma pessoa pode ter papéis diferentes em organizações diferentes: o vínculo é sempre com uma
Organização, e é ele que carrega o papel.

### 1.1 O que o Solicitante faz

- **Registra uma ocorrência** com título, descrição e categoria, indica onde foi, com uma Área configurada
  da Organização mais um complemento em texto, e anexa uma imagem. O registro inteiro cabe em menos de um
  minuto pelo celular, com foto.
- **Vê as ocorrências de área comum** do seu local e, em vez de abrir outra igual, declara adesão: *"também
  estou com esse problema"*. Ocorrências em unidade privativa aparecem só para o autor e para os Gestores.
- **Acompanha as próprias ocorrências** pelo status atual e pela linha do tempo de cada uma, com
  transições, mensagens e atribuições na ordem em que aconteceram. Os status aparecem com rótulo em
  linguagem de gente: *"Parada — esperando você responder"*, e não *"Pausada"*. A tabela completa está no
  [glossário](glossario.md).
- **Comenta** dentro da ocorrência, num espaço que é dele com os Gestores.
- **É avisado a cada mudança de status**, inclusive quando a ocorrência é pausada esperando uma informação
  dele.
- **Avalia a resolução** depois que a ocorrência é resolvida. É a única medida de qualidade que o produto
  tem.
- **Cancela a própria ocorrência** com motivo, seja desistência, resolução por conta própria ou abertura
  por engano, enquanto ninguém tiver começado a trabalhar nela. Depois disso, pede o cancelamento pelo
  comentário e quem cancela é o Gestor.

### 1.2 O que o Gestor faz

- **Vê todas as ocorrências da sua Organização** e filtra por categoria, status e prioridade.
- Alcança em poucos cliques os **filtros rápidos**, que são as visões que respondem *o que eu preciso fazer
  agora*: não triadas, pausadas esperando por ele, alta prioridade, sem atualização há muito tempo.
  Ocorrências que envelhecem ficam destacadas, e nada sobe de prioridade sozinho: quem decide é ele.
- **Analisa** a ocorrência e **altera a prioridade**, que nasce normal e fica travada quando a ocorrência
  chega a um estado terminal, para que o dashboard não responda coisas diferentes conforme o dia da
  pergunta.
- **Atribui um responsável pela ocorrência**: qualquer Pessoa com vínculo na Organização, inclusive ele
  mesmo em um clique. Reatribuir é um clique também.
- **Inicia o atendimento**, que exige alguém atribuído, porque *quem está fazendo* é o que hoje se perde;
  **pausa com motivo** (aguardando informação do solicitante, peça, autorização ou terceiro) e **retoma**,
  voltando ao status em que estava.
- **Cancela** com motivo estruturado e observação. Quando o motivo é duplicidade, a ocorrência cancelada
  fica vinculada à original: nada é mesclado, nada é apagado.
- **Registra a solução aplicada** e **resolve**. Quem decide que acabou é sempre o Gestor, nas duas
  variantes da persona.
- **Conversa em três espaços separados**, todos dentro da ocorrência: com o Solicitante, só entre Gestores,
  e com o responsável atribuído. Trocar de responsável abre uma conversa nova e arquiva a anterior, que
  segue visível aos Gestores.
- **Configura a Organização**: as categorias, que nascem com as sete do desafio e são ajustáveis, as Áreas
  e o tipo de cada uma, e quem entra.
- **Lê o dashboard**, que responde o que a lista não responde, ou seja, padrão e tendência: recorrência por
  categoria e por área, tempo médio de resolução mês a mês, tempo de calendário contra tempo ativo, e média
  das avaliações. A recorrência é o indicador que distingue oito ordens de serviço de **uma obra**.

### 1.3 O que o Encarregado faz

O Encarregado é cadastrado pelo Gestor e pode receber atribuições tenha ele acesso ao sistema ou não. A
regra que atravessa o produto é uma só: **para agir no sistema, é preciso ter conta**.

- **Sem conta:** existe como cadastro, aparece como responsável pela ocorrência e recebe o trabalho
  pessoalmente. O Gestor age em nome dele no sistema. É o caso do zelador que não usa celular.
- **Com conta:** vê só o que é dele, com a localização exata e a foto; abre a lista e o detalhe sem rede,
  porque o trabalho acontece em subsolo, casa de máquinas e garagem; conversa com os Gestores no espaço da
  própria atribuição; pausa com motivo em um toque; reporta a execução concluída, e a decisão de que está
  resolvido continua sendo do Gestor; e pode recusar uma atribuição.

Não existe conversa direta entre Solicitante e Encarregado: o nome de quem está cuidando é visível ao
Solicitante, e a comunicação passa pelo Gestor.

### 1.4 O ciclo de vida e a trilha de auditoria

Uma ocorrência nasce **Aberta** e caminha por **Em análise**, **Em atendimento** e **Resolvida**.
**Cancelada** é alcançável a partir dos três primeiros. A esses cinco o produto acrescenta **Pausada**, com
motivo obrigatório: é onde o trabalho se perde hoje, e nomear a espera é o que permite vigiá-la.

`Resolvida` e `Cancelada` são terminais de verdade: nenhuma ocorrência volta atrás. Se o problema retorna,
com a lâmpada nova já piscando ou o vazamento reaparecendo, o Solicitante abre uma nova ocorrência
vinculada à original, e o vínculo é o que faz "voltou a acontecer" aparecer como recorrência no dashboard.

Cada transição grava um **registro imutável** com cinco campos: status anterior, novo status, data e
horário, autor da transição, e observação da alteração. A observação é obrigatória onde há uma decisão a
justificar, que são pausar e cancelar, e opcional no avanço rotineiro. **Ninguém edita o status
diretamente:** só existem comandos nomeados, e é por isso que é impossível mudar o status sem deixar
registro. A sequência completa desses registros é a trilha de auditoria; a linha do tempo que o Solicitante
lê é a apresentação dela, somada às mensagens e às atribuições.

### 1.5 Uma instância, várias organizações

O produto atende várias organizações na mesma instância, e **a Organização é o limite de isolamento**:
nenhuma consulta atravessa a fronteira de uma. A Organização é criada por auto-serviço, e quem a cria vira
o Gestor inicial, o que resolve o primeiro vínculo, que não teria quem o aprovasse.

Depois disso, todo vínculo nasce por ação de um Gestor, por um de três caminhos: ele cadastra a pessoa
diretamente, que é como o Encarregado sem conta entra; ou convida por um link de uso único; ou aprova um
pedido de entrada feito com o código público da Organização, aquele que vive no cartaz do elevador. Código
vazado não vira acesso: vira um pedido aguardando aprovação.

Dos três, o cadastro direto e o pedido de entrada estão na primeira entrega, e o convite é evolução
prevista.

---

## 2 · O recorte da primeira entrega

**66 itens de escopo mapeados. 44 entram na primeira entrega; 22 são evolução prevista.**

| Atividade | Entra | Evolução prevista |
|---|---|---|
| 0 · Configurar a organização | 6 | 3 |
| 1 · Entrar na organização | 6 | 4 |
| 2 · Registrar a ocorrência | 3 | 1 |
| 3 · Triar | 5 | 2 |
| 4 · Atribuir | 3 | 2 |
| 5 · Executar | 3 | 3 |
| 6 · Fechar | 3 | 1 |
| 7 · Acompanhar | 4 | 4 |
| 8 · Gerir | 5 | 2 |
| Fundação técnica | 6 | — |
| **Total** | **44** | **22** |

**Os 24 itens exigidos pelo desafio estão inteiros na primeira entrega.** Todo o corte recaiu sobre as 42
adições do projeto: 20 entraram e 22 ficaram para depois.

Os 20 que entraram não estão lá por gosto: cada um é a cola sem a qual um requisito do desafio não
funciona. Sem Organização não há onde registrar; sem categorias e áreas semeadas, a Organização nasce vazia
e nada pode ser registrado; sem pedido de entrada e aprovação, ninguém além de quem criou consegue entrar;
sem cadastro de Encarregados não há a quem atribuir; sem rótulo amigável o Solicitante lê *"Em análise"* e
não sabe se aquilo é bom ou ruim; e sem a recorrência o dashboard exigido pelo desafio responderia o que a
lista já responde. **A única escolha de verdade no corte foi `Pausada`:** ela não é exigida pelo desafio e
poderia sair, e é a resposta direta à dor mais forte das duas personas, *"acabo me perdendo e a ocorrência
some dentre outras"*. Sem ela, a primeira entrega cumpre o desafio e não resolve o problema que o produto
veio resolver.

Nas tabelas abaixo, ✅ entra na primeira entrega e ⬜ é evolução prevista. A coluna do meio diz onde a
capacidade foi decidida.

### 0 · Configurar a organização

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Criar a organização por auto-serviço; quem cria vira o Gestor inicial | D26 | ✅ |
| Categorias-semente, as sete do desafio, criadas junto com a organização | D18 | ✅ |
| Áreas-semente, com os tipos *comum* e *privativa* | D10, D18 | ✅ |
| Editar categorias | Desafio | ✅ |
| Editar áreas | D18 | ✅ |
| Escolher o ícone da categoria, sobre uma lista fechada de 25 nomes | RNF6 | ✅ |
| Identidade da organização na página de cadastro, com logo e nome | D25 | ⬜ |
| Interruptor *"exigir descrição da solução ao resolver"* | D22 | ⬜ |
| Fundar uma segunda organização tendo uma ativa | D25, D26 | ⬜ |

**A última linha é ⬜ por escopo, e não por limitação técnica.** O `POST /organizacoes` aceita a chamada, e
o `Set-Cookie` já ativaria a organização nova. O que falta é tela: nenhuma oferece o caminho. O contorno
existe e é usado, que é criar outra conta, e é o que o roteiro de validação do grupo faz.

### 1 · Entrar na organização

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Criar conta e autenticar-se | Desafio | ✅ |
| Pedir entrada com o código da organização, aguardando aprovação | D25 | ✅ |
| Gestor aprova ou recusa o pedido de entrada | D25 | ✅ |
| Cadastro de Encarregados, sem conta | D27 | ✅ |
| Remover vínculo sem histórico, desfazendo papel aprovado por engano | D25, PA-25 | ✅ |
| Entrar em outra organização tendo uma ativa: pedir entrada numa segunda e trocar qual está ativa | D25 | ✅ |
| Página pública da organização, com o código embutido na URL | D25 | ⬜ |
| Convite por link de uso único, com dados pré-preenchidos e editáveis | D25 | ⬜ |
| Importar pessoas em lote | D25 | ⬜ |
| Revogar vínculo | D4 | ⬜ |

> **Um estado sem capacidade, que ainda assim precisa aparecer na interface.** Como o acesso próprio do
> Encarregado ficou de fora, o vínculo com esse papel tem nenhuma permissão na primeira entrega. Se uma
> pessoa com conta for aprovada assim, ela autentica, tem organização ativa e não pode fazer nada, nem
> registrar ocorrência. Isso não é capacidade nova e não entra na contagem, porque não há nada a construir
> além de texto. Mas a tela tem de existir e dizer o que houve, porque tela vazia sem explicação é defeito,
> e porque é essa pessoa que precisa procurar o Gestor: o conserto é dele, e não dela. Está especificada
> como T-10 em [inventario-de-telas.md](inventario-de-telas.md).

### 2 · Registrar a ocorrência

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Registrar com título, descrição e categoria | Desafio | ✅ |
| Informar a localização: uma Área mais complemento em texto | Desafio, D10 | ✅ |
| Anexar uma imagem, comprimida no próprio celular | Desafio, RNF8 | ✅ |
| Ver ocorrências semelhantes no mesmo local e aderir | D11 | ⬜ |

Duas restrições de qualidade atravessam esta atividade e valem desde a primeira entrega: o registro
completo cabe em **menos de um minuto pelo celular**, com foto (RNF6), e a imagem é comprimida no próprio
aparelho antes de subir (RNF8), que é o que faz o anexo caber nesse tempo. Não são itens de escopo: são o
alvo de qualidade sobre os itens acima.

> **O esquema comporta mais do que a linha do anexo promete, e a diferença é deliberada.** A capacidade é
> uma imagem, e continua sendo. O que mudou foi o modelo de dados: a imagem deixou de ser uma coluna da
> ocorrência e passou a ser a tabela `anexos`, porque o conceito do domínio é evidência — foto hoje,
> possivelmente vídeo, orçamento em PDF ou áudio depois — e uma coluna modelava o exemplo do desafio em vez
> do conceito. A tabela suporta muitos anexos e mais de um tipo; a primeira entrega grava um, de um tipo, e
> o limite mora no contrato de API e na aplicação, nunca no banco. Isso não é capacidade nova e não entra
> na contagem. Fica registrado porque quem ler esta tabela e depois o esquema encontraria um banco que
> aceita o que a capacidade não promete. O dia da ampliação é decisão de produto com preço: o
> `modelo-de-dados.md` §11.5 mede vídeo em cerca de dez vezes o armazenamento de hoje se comprimido no
> aparelho, e acima do crédito Azure inteiro se não for.

### 3 · Triar

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Listar todas as ocorrências da organização | Desafio | ✅ |
| Filtrar por categoria, status e prioridade | Desafio | ✅ |
| Analisar, com a transição `Aberta → Em análise` | Desafio | ✅ |
| Alterar a prioridade | Desafio, D6 | ✅ |
| Cancelar com motivo estruturado e observação | Desafio, D12 | ✅ |
| Filtros rápidos: não triadas, pausadas esperando o Gestor, sem atualização | D15 | ⬜ |
| Cancelar por duplicidade, com vínculo à ocorrência original | D17 | ⬜ |

### 4 · Atribuir

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Atribuir o responsável pela ocorrência: qualquer Pessoa com vínculo | Desafio, D21 | ✅ |
| Auto-atribuição do Gestor, em um clique | D21 | ✅ |
| Reatribuir | D21 | ✅ |
| Conversa privada da atribuição, entre Gestores e responsável | D9 | ⬜ |
| Encarregado recusa a atribuição | D9 | ⬜ |

**O que *"em um clique"* conta.** Conta comando, e não toque de tela: sem a auto-atribuição, um Gestor que
queira assumir uma ocorrência `Aberta` precisaria de `analisar` e `atribuir`, que são dois comandos. A ação
acontece no detalhe da ocorrência (T-05), e não na lista, e medida lá dentro custa quatro toques. Levar a
ação para a lista é evolução declarada.

### 5 · Executar

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Iniciar o atendimento, que exige responsável atribuído | Desafio, D21 | ✅ |
| Pausar com motivo estruturado | D8 | ✅ |
| Retomar, voltando ao status anterior à pausa | D8 | ✅ |
| Encarregado entra no sistema e vê a própria lista | P5 | ⬜ |
| Leitura sem rede da lista e do detalhe | RNF7, P5 | ⬜ |
| Encarregado reporta a execução concluída | P5 | ⬜ |

### 6 · Fechar

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Registrar a solução aplicada | Desafio, D22 | ✅ |
| Resolver, com a transição para `Resolvida` | Desafio | ✅ |
| Avaliar a resolução | Desafio, D1 | ✅ |
| Abrir nova ocorrência vinculada à original, quando o problema volta | D24 | ⬜ |

### 7 · Acompanhar — o Solicitante

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Ver as minhas ocorrências e o status atual | Desafio | ✅ |
| Ver a linha do tempo da ocorrência | Desafio | ✅ |
| Comentar com os Gestores dentro da ocorrência | Desafio, D9 | ✅ |
| Rótulos em linguagem de gente no lugar dos nomes internos de status | D19 | ✅ |
| Ver as ocorrências de área comum do meu local | D10 | ⬜ |
| Sino com as notificações do próprio usuário | D14, D15 | ⬜ |
| Notificação a cada transição de status | D14 | ⬜ |
| Nota interna entre Gestores | D9 | ⬜ |

### 8 · Gerir

| Capacidade | Decidido em | 1ª entrega |
|---|---|---|
| Dashboard com indicadores | Desafio | ✅ |
| Backlog por status e por categoria | D19 | ✅ |
| Média das avaliações | D19 | ✅ |
| Recorrência por categoria e por área | D19 | ✅ |
| Tempo médio de resolução, mês a mês | D19 | ✅ |
| Tempo de calendário contra tempo ativo | D19 | ⬜ |
| Alarme de ocorrência parada há muito tempo | D15 | ⬜ |

A recorrência entra porque é ela que faz o dashboard responder o que a lista não responde. Sem ela, o
indicador exigido pelo desafio mostraria o mesmo que a listagem já mostra, e oito vazamentos no mesmo bloco
em três meses continuariam parecendo oito ordens de serviço, em vez de uma obra.

**O tempo médio de resolução entra por um motivo mais prosaico.** O desafio não o exige: pede apenas
*"visualizar indicadores em um dashboard"*, sem dizer quais, e por isso o item é adição do projeto e
poderia ser cortado. O que decidiu foi o custo já pago: o `modelo-de-dados.md` §6.8 justifica o índice
`(organizacao_id, ocorreu_em DESC)` citando literalmente *"tempo médio de resolução mês a mês"*. O índice
existe, foi dimensionado na estimativa de volume, e o indicador é uma agregação sobre ele. Deixá-lo de fora
manteria o custo e descartaria o retorno.

Ele mede tempo de calendário, com as pausas incluídas. Separar calendário de tempo ativo continua sendo ⬜,
e é essa separação que o objetivo O5 da Documentação da Demanda espera, o que significa que **O5 segue não
medido na primeira entrega**.

### Fundação técnica

Não são capacidades de usuário: atravessam todas as atividades e entram inteiras.

| Item | Decidido em | 1ª entrega |
|---|---|---|
| Agregado `Ocorrência` com máquina de estados e trilha imutável | Desafio, ADR-0001 | ✅ |
| Isolamento por organização em ponto único, com verificação automatizada | D2, D3, RNF1, ADR-0003 | ✅ |
| Ambiente executável em contêiner | Desafio | ✅ |
| Publicação em nuvem, com pipeline | Desafio | ✅ |
| Testes de domínio, de aplicação, de isolamento e de ponta a ponta | Desafio | ✅ |
| Documentação e README | Desafio | ✅ |

---

## 3 · Evolução prevista

Tudo aqui está **projetado e não implementado**: cada item tem decisão registrada, com o que foi rejeitado
no caminho e o custo assumido. Não implementar não é o mesmo que não ter pensado.

Esta seção diz *o que* cada evolução é. *Como* cada uma seria construída é assunto do documento de
[arquitetura](arquitetura.md).

**Aviso e comunicação**
- Notificação a cada transição de status e sino com o que aconteceu comigo (D14).
- Entrega por canal externo, com e-mail, push e WhatsApp, que é a primeira feature de plano pago (D13).
- Nota interna entre Gestores e conversa privada da atribuição, que se arquiva quando o responsável muda
  (D9).

**O Encarregado como usuário do sistema**
- Acesso próprio, com a lista do que é dele na ordem que o Gestor definiu.
- Leitura sem rede da lista e do detalhe (RNF7).
- Reporte de execução concluída e recusa de atribuição.

**Comunidade**
- Visibilidade das ocorrências de área comum aos demais moradores do local (D10).
- Adesão, o *"também estou com esse problema"*, como sinal contável de impacto, no lugar de uma segunda
  ocorrência igual (D11).
- Vínculo de duplicidade, com o impacto calculado sobre o grupo (D17).

**Operação do Gestor**
- Filtros rápidos: não triadas, pausadas esperando por ele, alta prioridade, sem atualização há muito
  tempo (D15).
- Alarme de ocorrência parada há tempo demais (D15).

**Entrada na organização**
- Convite por link de uso único, com os dados da pessoa pré-preenchidos e editáveis, em que o cadastro
  vira recadastramento (D25).
- Página pública da organização, com identidade própria e código embutido na URL, servindo também de QR
  code no hall (D25).
- Importação de pessoas em lote (D25) e revogação de vínculo (D4).

**Medição**
- Tempo de calendário e tempo ativo, publicados lado a lado, para separar atraso externo de lentidão do
  gestor (D19).
- Nova ocorrência vinculada à original, que é o vínculo que faz *"voltou a acontecer"* aparecer na
  recorrência (D24).

**Configuração**
- Interruptor por organização para exigir a descrição da solução ao resolver (D22).

**Alcance do produto**, projetado sem desenho de implementação:
- Um nível acima da Organização, para a administradora que responde por vários condomínios, com a visão do
  Gestor atravessando organizações (D3, PA-19).
- Mais de um responsável por ocorrência, que é mudança de modelo e não configuração, e exige redecidir a
  conversa da atribuição (D21).
- Classificação assistida a partir do texto livre da descrição, para organizações de alto volume (D7).
- Planos comercial gratuito e pago, com cadastro aberto (D13, D26).

---

As premissas assumidas e as questões que seguem em aberto estão em
[Premissas e Questões Abertas](premissas-e-questoes-abertas.md). Os requisitos completos, com as personas
e os requisitos não funcionais quantificados, estão na
[Documentação da Demanda](documentacao-da-demanda.md).
