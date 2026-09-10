# Glossário — Linguagem Ubíqua do Resolve Aí

Este documento fixa uma definição por termo. Onde um termo carrega dois significados, ele é quebrado em
termos distintos, cada um com definição própria.

A razão de existir é prática: **estes termos viram nome de tabela, de endpoint e de classe.** Resolver a
ambiguidade antes custa horas; depois custa refatoração.

Duas regras de vocabulário valem para todo o projeto:

1. **Atores são nomeados por função, nunca por nome próprio:** `Solicitante`, `Gestor`, `Encarregado`, e
   nunca "João", "Admin" ou "User".
2. **Vocabulário de ferramenta não entra.** "Fila" veio do Jira e foi retirada; o termo do negócio é
   *filtro rápido*. A linguagem vem do negócio, e não da ferramenta.

A quarta coluna diz onde o termo foi decidido. `Dn` remete às decisões de produto; `PA-nn`, aos pontos de
atenção; e "Enunciado" marca o que vem do desafio e não é escolha nossa.

---

## 1. Atores e vínculos

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Pessoa | A entidade de domínio que representa um ser humano no sistema: nome e contato. Existe independentemente de conseguir entrar no sistema. O e-mail de contato da Pessoa não é a credencial: são campos distintos e podem divergir, porque o condomínio tem um e-mail da pessoa e ela entra no sistema com outro | Usuário, porque Pessoa pode existir sem Usuário | D4 |
| Usuário | A credencial de acesso de uma Pessoa. Uma Pessoa tem zero ou um Usuário | Pessoa; Vínculo; e o e-mail de contato, que é da Pessoa e não daqui | Enunciado |
| Pedido de entrada | A solicitação de uma Pessoa para se vincular a uma Organização, feita com o código público, e que aguarda decisão do Gestor. Só depois da aprovação o Vínculo passa a existir | ⚠️ "fila de aprovação", descrição usada antes de o termo existir, e "fila" é termo retirado. E Convite, que dispensa aprovação | D25 |
| Vínculo | A ligação entre uma Pessoa, um Papel e uma Organização. Uma Pessoa pode ter vários vínculos, em organizações diferentes e com papéis diferentes | Papel: o vínculo carrega um papel, e não é o papel | D4 |
| Papel | O que a Pessoa é dentro de uma Organização: `Solicitante`, `Gestor` ou `Encarregado` | Permissão: papel é do vínculo, e permissão é o que o papel autoriza | D4 |
| Remover vínculo | Apagar um vínculo que não deixou rastro, sem nenhuma ocorrência, atribuição, mensagem ou transição. Existe para desfazer um papel dado por engano: o vínculo não deveria ter existido | ⚠️ Revogar vínculo, abaixo. E não apaga a Pessoa, que é global | D25, PA-25 |
| Revogar vínculo | Encerrar o acesso de quem tem histórico na Organização. O vínculo existiu e terminou, e o registro permanece, que é o que o RNF9 exige | ⚠️ Remover vínculo. Os dois não são a mesma operação com nomes diferentes: um apaga o que não aconteceu, o outro encerra o que aconteceu | D4 |
| Solicitante | Papel de quem registra e acompanha ocorrências | Observador | Enunciado |
| Gestor | Papel de quem analisa e administra as ocorrências de uma Organização. É sempre quem decide que uma ocorrência está resolvida | Encarregado | Enunciado |
| Encarregado | Papel de quem executa o trabalho: zelador, técnico, prestador. Pode ou não ter Usuário, porque o Gestor cadastra encarregados sem conta apenas para fins de gerenciamento. Há CRUD de Encarregados | ⚠️ Responsável pela ocorrência, que é a atribuição e não o papel. Ver a colisão 2 | D27 |
| Responsável pela ocorrência | A atribuição: qual Pessoa foi designada para resolver aquela ocorrência. É uma relação, e não um papel, e aponta para qualquer Pessoa com vínculo na Organização, tenha ela papel de Encarregado ou de Gestor | ⚠️ Encarregado (o papel) e autor da transição (o campo do histórico). Ver a colisão 2 | Enunciado |
| Observador | Quem lê uma ocorrência de área comum sem ser autor nem gestor dela. Pode aderir, e não comenta | Solicitante: o observador não é autor daquela ocorrência | D11 |
| Agir no sistema | Executar qualquer comando. Invariante: para agir, o vínculo precisa de um Usuário | — | D4 |

---

## 2. Organização e lugar

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Organização | O condomínio, a empresa, o bairro ou a organização que usa o Resolve Aí. É o limite de isolamento de dados e o cliente do produto | `tenant`, que é o termo técnico para o mesmo limite, usado só ao falar de isolamento. Nunca é nome de domínio | Enunciado |
| Área | Uma subdivisão configurada da Organização: bloco B, garagem, salão de festas, apartamento 302. Toda Área tem um tipo | Localização | D10 |
| Área comum | Tipo de Área acessível a todos. Ocorrências nela são visíveis aos demais moradores da Organização, conforme o tipo vigente quando a ocorrência foi registrada, e não o tipo atual da Área | Unidade privativa | D10 |
| Unidade privativa | Tipo de Área de uso exclusivo. Ocorrências nela são visíveis só ao autor e aos Gestores, conforme o tipo vigente quando a ocorrência foi registrada. Reclassificar a Área depois não muda a visibilidade do que já foi registrado | Área comum | D10 |
| Localização | A indicação de onde, dentro da Organização, a ocorrência aconteceu: uma referência a uma Área mais um complemento em texto livre, como "ao lado da vaga 34" | Área, porque Localização aponta para uma Área. E não é geolocalização: não há mapa nem coordenada | Enunciado |
| Categoria | A natureza da ocorrência: iluminação, vazamento, limpeza. Configurável por Organização, com semente das sete do enunciado | Prioridade: categoria é o que é, prioridade é quanto corre | Enunciado |
| Código da Organização | Identificador público e persistente que permite pedir entrada numa Organização. Vive em cartaz, QR code no elevador, mensagem de grupo. Quem usa abre um Pedido de entrada, que o Gestor decide | Convite, que é privado e de uso único | D25 |
| Convite | Token de uso único, vinculado a uma Pessoa específica e com validade, que leva à página de cadastro com os dados dela pré-preenchidos e editáveis. Entrar por convite dispensa o Pedido de entrada, porque o Gestor já criou aquela Pessoa. É um link, e não um e-mail: pode ir por e-mail, WhatsApp ou QR | Código da Organização | D25 |
| Organização ativa | A Organização cuja lente a sessão está usando agora. Uma Pessoa com vários vínculos tem uma só de cada vez, e trocar é operação explícita | Vínculo: os vínculos são todos os que a Pessoa tem, e a organização ativa é o que ela está enxergando neste momento | ADR-0003 |
| Whitelabel | Personalização da página pública de cadastro de uma Organização: logo e nome | — | D25 |

> **Termo retirado: "Local".** Existiu enquanto considerávamos uma hierarquia acima do condomínio. Com a
> D3, em que a Organização é o próprio condomínio, ficou redundante, e colidia foneticamente com
> *Localização*. Não usar.

---

## 3. A ocorrência

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Ocorrência | O problema registrado por um Solicitante e acompanhado até a resolução. É o objeto central do sistema | "solicitação", "chamado", "demanda", "ticket". O enunciado usa "solicitações" ao descrever o contexto, e o termo do domínio é Ocorrência, e só ele. Ver a colisão 2 | Enunciado |
| Anexo | A evidência que acompanha uma Ocorrência: foto hoje, outros tipos depois. Tem tipo, autor e ciclo de vida próprio no storage, e o objeto só passa a existir para o sistema quando é reivindicado no registro da ocorrência | Solução aplicada, que é o texto do Gestor sobre o que foi feito; e Comentário, que é conversa | Enunciado |
| Prioridade | O quanto uma ocorrência corre, definido pelo Gestor. Nasce normal, e é alterável enquanto a ocorrência não estiver em estado terminal | Urgência (termo não usado) e Categoria | Enunciado |
| Solução aplicada | O registro do que foi efetivamente feito para resolver a ocorrência, escrito pelo Gestor | Observação da alteração | Enunciado |
| Avaliação | A nota que o Solicitante autor dá à resolução, depois de a ocorrência estar `Resolvida`. Não é um estado do ciclo de vida | ⚠️ `Em análise`, que é o estado em que o Gestor avalia a ocorrência. Ver a colisão 3 | Enunciado |
| Adesão | A ação de um Observador declarar *"também estou com esse problema"* numa ocorrência de área comum. É a única ação dele | Comentário: adesão é um clique contável, e não texto | D11 |
| Duplicidade | A relação entre uma ocorrência cancelada com motivo `duplicada` e a ocorrência original, registrada como vínculo. Nada é migrado | Mesclagem, que não existe no produto. Ver a §8 | D17 |

---

## 4. Ciclo de vida e auditoria

Os cinco estados e os cinco campos do registro vêm do enunciado, no quê e no como, e não podem ser
renomeados nem removidos. `Pausada` é acréscimo nosso, autorizado pelo *"no mínimo"* do enunciado.

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Status | O ponto do ciclo de vida em que a ocorrência está | "Estado": o enunciado alterna os dois, e adotamos Status como termo único | Enunciado |
| Aberta | Registrada e ainda não analisada por nenhum Gestor | — | Enunciado |
| Em análise | O Gestor está avaliando a ocorrência | ⚠️ Avaliação, que é do Solicitante. Ver a colisão 3 | Enunciado |
| Em atendimento | O trabalho está em execução | Pausada | Enunciado |
| Resolvida | O Gestor conferiu e declarou concluída. Estado terminal | Cancelada, que não é "resolvida com resultado ruim" | Enunciado |
| Cancelada | Encerrada sem resolução, com motivo obrigatório. Estado terminal | Resolvida; e Pausada | Enunciado |
| Pausada | Parada esperando alguém, com motivo obrigatório: aguardando informação do solicitante, peça, autorização ou terceiro. Sai da lista de em andamento, e ao retomar volta ao status anterior | Cancelada, que é terminal, e "Impedimento", termo absorvido | D8 |
| Transição de status | A operação de negócio que muda o status. Só acontece por comando nomeado, e são exatamente seis: `analisar`, `iniciarAtendimento`, `pausar`, `retomar`, `resolver` e `cancelar` | "Atualizar o campo status", que não existe, porque ninguém de fora escreve status. E os comandos que não transicionam, como `alterarPrioridade`, `atribuirResponsavel`, `registrarSolucaoAplicada` e `avaliar`, que agem sobre a ocorrência sem mudar o status; a lista está na `arquitetura.md`, Parte I §4. E `reabrir`, porque reabertura não existe (ver a §8) | Enunciado |
| Registro de transição | O registro imutável gerado por cada transição, com os cinco campos: status anterior, novo status, data e horário, usuário responsável, e observação da alteração | Histórico. Ver a colisão 1 | Enunciado |
| Observação da alteração | O texto que o autor da transição escreve no momento do comando, explicando o porquê. É intenção humana, e não diferença de dados | Comentário e Solução aplicada | Enunciado |
| Trilha de auditoria | A sequência completa e imutável dos registros de transição de uma ocorrência. É o que satisfaz *"cada transição de status deve ser auditável"* | Linha do tempo | Enunciado |
| Linha do tempo | A visão que o Solicitante consulta ao acompanhar o andamento: transições, mensagens e atribuições. É modelo de leitura derivado, e não tabela | Trilha de auditoria: a trilha é só transições e é a fonte, e a linha do tempo é a apresentação | Nossa |
| Rótulo exibido | O texto mostrado a uma pessoa para um status. Depende de quem lê: o Solicitante vê linguagem de gente, e o Gestor e o Encarregado veem o nome interno, porque operam a máquina. Calculado no servidor, nunca no cliente | Os nomes dos estados, que são literais do enunciado e não mudam | D19 |

### Os rótulos exibidos, na íntegra

Esta tabela é a fonte: o contrato de API a consome, e nenhum rótulo nasce fora daqui.

| `status` e motivo da pausa | Ao Solicitante | Ao Gestor e ao Encarregado |
|---|---|---|
| `aberta` | Recebida — aguardando análise | Aberta |
| `em_analise` | Em análise | Em análise |
| `em_atendimento` | Em execução | Em atendimento |
| `pausada` · aguardando informação do solicitante | Parada — esperando você responder | Pausada |
| `pausada` · aguardando peça | Parada — esperando material chegar | Pausada |
| `pausada` · aguardando autorização | Parada — esperando autorização | Pausada |
| `pausada` · aguardando terceiro | Parada — esperando um terceiro | Pausada |
| `resolvida` | Resolvida | Resolvida |
| `cancelada` | Cancelada | Cancelada |

Quatro regras que a tabela carrega e que valem para qualquer rótulo novo:

1. **Nenhum rótulo nomeia o Gestor por profissão.** A D19 nasceu de uma entrevista com um síndico, e a
   redação original dizia *"o síndico está avaliando"*. Isso trava o produto em condomínio, enquanto a D3
   admite empresa e bairro como Organização, e a promessa de múltiplas organizações é a adição mais cara
   do projeto para ser desmentida por uma palavra de interface.
2. **`Pausada` tem quatro rótulos, e não um molde com o motivo interpolado.** Frase montada em tempo de
   execução produz *"Parada, esperando aguardando peça"*. O motivo é enumerado; a frase é escrita.
3. **Rótulo é estado, e não convite.** *"Resolvida — conte como foi"* mistura o que a ocorrência é com o
   que se pede de quem lê. O convite a avaliar pertence à tela.
4. **Nenhum rótulo trava o produto numa das três formas de Organização.** É a regra 1 aplicada ao lugar em
   vez de à pessoa, e ela já mordeu: o rótulo de `fora_de_escopo` foi proposto como *"Fora do escopo do
   condomínio"*. Observação livre é texto de um Gestor sobre o próprio lugar, e ali a palavra é dele;
   rótulo de enum é a mesma string para condomínio, empresa e bairro. Por isso ficou *"Fora do escopo da
   organização"*.

**Consequência para quem exibe uma lista ao Gestor:** os quatro motivos de pausa colapsam num único
rótulo, "Pausada". Como nomear a espera é o que permite vigiá-la (D8), o motivo precisa viajar como campo
próprio ao lado do rótulo, e não embutido nele.

### Os motivos, na íntegra — o segundo vocabulário

**Esta tabela é irmã da de cima e responde outra pergunta.** A de cima diz o que aconteceu com a
ocorrência; esta diz o que você está escolhendo, dentro de um formulário chamado Motivo:

| A pergunta | Qual tabela responde | Exemplo |
|---|---|---|
| *O que está acontecendo com esta ocorrência?* | os rótulos exibidos, acima | *"Parada — esperando material chegar"* |
| *O que ela está esperando?*, no seletor do modal | esta | *"Aguardando peça"* |

**Isto não é a segunda cópia que a regra 2 proíbe.** A regra 2 proíbe frase montada em tempo de execução;
um segundo vocabulário declarado é o que a coluna do Gestor da tabela de cima já é. *"Parada — esperando
material chegar"* dentro de um seletor chamado *Motivo* é uma frase respondendo a outra pergunta.

**Os quatro motivos de `pausar`**, que são a invariante 5 (D8, D23):

| Valor | Rótulo de escolha |
|---|---|
| `aguardando_informacao_solicitante` | Aguardando informação do solicitante |
| `aguardando_peca` | Aguardando peça |
| `aguardando_autorizacao` | Aguardando autorização |
| `aguardando_terceiro` | Aguardando um terceiro |

**Os sete motivos de `cancelar`**, que são um conjunto só, e não dois: a divisão da D5 é por autorização, e
não por domínio de valor. O `duplicada` está nas duas listas, e modelar dois enums duplicaria o valor comum.

| Valor | Rótulo de escolha | Quem pode escolher |
|---|---|---|
| `desistencia` | Desistência | o Solicitante autor e quem tem `ocorrencia.cancelar_qualquer` |
| `resolvido_por_conta_propria` | Resolvido por conta própria | idem |
| `aberta_por_engano` | Aberta por engano | idem |
| `duplicada` | Duplicada | idem |
| `improcedente` | Improcedente | só quem tem `ocorrencia.cancelar_qualquer` |
| `fora_de_escopo` | Fora do escopo da organização | idem |
| `sem_informacao_suficiente` | Sem informação suficiente | idem |

**Origem dos onze.** As duas listas de motivo de cancelamento vêm da D5, refinadas pela D12: o enunciado
impõe que `Cancelada` exista e de onde ela sai, e não diz quem aciona nem por quê. Os motivos de pausa são
da D8. Os rótulos são todos nossos: os quatro de pausa e os quatro do Solicitante são transcrição literal
do protótipo renderizado, e os três de Gestor foram decididos em 28/08/2026, com a palavra do meio trocada
para *organização* pela regra 4 acima.

**Quem pode escolher é checagem da camada de aplicação, e não domínio de valor**, pela mesma regra que faz
toda autorização perguntar `vinculo.pode(X)` e nunca `vinculo.papel == GESTOR`. A tela oferece a lista já
filtrada; se um `422` de motivo não permitido chegar ao Solicitante, é defeito de tela.

Uma nota para quem redesenhar: a forma curta *"esperando peça"*, sem o *"Parada — "*, não está autorizada
por nenhuma das duas tabelas.

---

## 5. Comunicação

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Canal de conversa | Um espaço de mensagens escopado a uma Ocorrência, com um lado fixo (os Gestores) e um lado variável. Existem exatamente três | Notificação | D9 |
| Comentário | O canal 1: Gestores e Solicitante. É o que o enunciado chama de "adicionar comentários" | Nota interna e Mensagem da atribuição | Enunciado |
| Nota interna | O canal 2: só Gestores | Comentário | D9 |
| Mensagem da atribuição | O canal 3: Gestores e o responsável atribuído. A identidade dele é a atribuição, e não a pessoa, e por isso um novo responsável não vê a conversa do anterior | Comentário; e Notificação | D9 |
| Arquivar | Fechar um canal para novas mensagens, preservando o conteúdo e a visibilidade aos Gestores. Arquivado nunca é apagado | Apagar, que não existe no produto | D9 |
| Notificação | O aviso gerado a cada transição de status, para o Solicitante autor e para o responsável atribuído que tenha Usuário | Mensagem: mensagem é conversa, notificação é aviso de fato | D14 |
| Sino | A apresentação em lista das notificações do próprio Usuário | Filtro rápido: o sino responde *"o que aconteceu comigo?"*, e o filtro responde *"o que preciso fazer?"* | D15 |
| Filtro rápido | Visão pré-definida da listagem de ocorrências, alcançável em poucos cliques: não triadas, pausadas esperando o Gestor, alta prioridade, sem atualização há muito tempo | ⚠️ "Fila", termo do Jira, retirado. Ver a colisão 5 | D15 |

---

## 6. Tempo, medição e plano

| Termo | Definição | Não confundir com | Decidido em |
|---|---|---|---|
| Tempo de calendário | Do registro até a resolução, incluindo as pausas. É o que o Solicitante sente | Tempo ativo | Nossa |
| Tempo ativo | O mesmo intervalo excluindo as pausas. Mede o trabalho de Gestor e Encarregado. É derivado da trilha de auditoria, e não um campo | Tempo de calendário | Nossa |
| Envelhecimento | Há quanto tempo uma ocorrência está aberta, agrupado em faixas de 0 a 2 dias, 3 a 5, e 6 ou mais. Sinaliza, e nunca altera prioridade sozinho | Prioridade | D15, D16 |
| Recorrência | Volume de ocorrências por Categoria e por Área ao longo do tempo. É o indicador que distingue oito ordens de serviço de uma obra | Duplicidade: recorrência é padrão no tempo, duplicidade é o mesmo problema relatado duas vezes | D19 |
| Plano gratuito e plano pago | Os planos comerciais do produto. No gratuito, notificação só dentro do app; no pago, também e-mail, push e WhatsApp | ⚠️ Free tier de infraestrutura, que é a restrição de custo zero do projeto. Duas coisas diferentes. Ver a colisão 4 | D13 |
| Free tier de infraestrutura | O limite gratuito do provedor de nuvem onde o Resolve Aí é publicado. Restrição do trabalho, invisível ao cliente | Plano gratuito do produto | Restrição do projeto |
| Primeira entrega | O recorte que é construído agora: as capacidades marcadas como entregues no [escopo](escopo.md) | Evolução prevista | Nossa |
| Evolução prevista | O que está projetado e não implementado: as capacidades adiadas do escopo, cada uma com decisão registrada, alternativa rejeitada e custo assumido. Não implementar não é o mesmo que não ter pensado | ⚠️ "fatia 2", nome retirado (ver a §8). E primeira entrega | Nossa |

---

## 7. As cinco colisões que este glossário resolve

Estas não são hipóteses: **os termos já colidiam nas fontes do enunciado** antes de nós escrevermos
qualquer coisa.

**1. "Histórico" tinha três significados.** No `fluxograma-1` aparece como atributo da Ocorrência; no
`fluxograma-2` e no `-3`, como registro de auditoria da transição; e o Solicitante deve "consultar o
histórico", sem o enunciado dizer qual dos dois. Quebrado em três termos: Registro de transição, que é a
unidade; Trilha de auditoria, que é a sequência imutável; e Linha do tempo, que é a visão que o
Solicitante vê. **"Histórico" sozinho não é termo do projeto.**

**2. "Responsável" tinha três significados, e foi quebrado em três termos.** O Gestor *"atribui um
responsável"*; o registro de transição tem *"usuário responsável"*, que é quem fez a mudança de status; e
nós tínhamos criado um papel com esse nome. Três conceitos, um nome, nas duas pontas do sistema.

A quebra:

| Conceito | Termo adotado |
|---|---|
| O papel de quem executa o trabalho | Encarregado |
| A atribuição numa ocorrência específica | responsável pela ocorrência, que mantém a palavra do enunciado no lugar exato em que ele a usa |
| O campo do registro de transição | autor da transição |

A observação que destravou isso: *"responsável nunca foi um papel — na prática ele só existe como
atribuição dentro de uma ocorrência"*. O Solicitante tem responsabilidades sobre a solicitação e o Gestor
tem outras, e chamar um terceiro de "o responsável" não diz o que ele faz. Transformar "responsável" em
ator foi decisão nossa, na D4: o enunciado só exige a capacidade de atribuir.

**3. "Avaliação" colide com "Em análise".** A avaliação é do Solicitante sobre o resultado; `Em análise` é
o Gestor examinando a ocorrência. Em português os dois viram "análise" na conversa. A regra: avaliação é
sempre do Solicitante, e análise é sempre do Gestor.

**4. "Gratuito" tinha dois significados** que nasceram na mesma semana: o plano gratuito do produto, que é
decisão comercial, e o free tier de infraestrutura, que é restrição do trabalho. Sempre qualificar.

**5. "Fila" nunca foi termo do negócio.** Entrou por empréstimo do Jira e foi retirada, porque carrega
FIFO e distribuição de trabalho, que não existem aqui. O termo é filtro rápido.

---

## 8. Termos que decidimos não usar

Registrar o que não é vocabulário do projeto evita que ele volte por descuido.

| Termo | Por que não |
|---|---|
| Urgência | Decidimos não ter campo de urgência declarada pelo Solicitante: o campo sofre inflação e vira ruído. A intenção dele vive na `descrição`, guiada por UX (D7) |
| Fila | Vocabulário de ferramenta. É filtro rápido (D15) |
| Local | Redundante depois da D3, e colidia com *Localização* |
| Impedimento | Absorvido por Pausada com motivo (D8) |
| Mesclar, ou merge | O produto não mescla ocorrências: vincula duplicadas (D17). Merge destruiria uma das trilhas de auditoria |
| SLA | Não há contrato nem prazo acordado. Existe envelhecimento, que sinaliza sem prometer |
| Ticket, chamado, demanda | O termo é Ocorrência |
| Admin, User, João | Atores são nomeados por função |
| Reabertura | Não existe. Problema que volta é nova ocorrência vinculada à original (D24), porque `Resolvida` e `Cancelada` são terminais de verdade |
| "Responsável" como papel | O papel é Encarregado (D27). "Responsável" ficou reservado para a atribuição |
| Fatia 2 | Vocabulário de material de processo, que não é entregável. O termo é evolução prevista, na §6 |

---

## 9. Notas de método

**Duas operações parecidas com um efeito diferente merecem dois termos.** *Remover* e *revogar* um vínculo
fazem, de longe, a mesma coisa: a pessoa deixa de ter acesso. A distinção que os separa é o que sobra
depois, porque remover apaga um vínculo que não deixou rastro, e revogar encerra um que deixou e preserva
o registro. Chamar os dois de "revogar" não seria simplificação: faria a operação da primeira entrega
parecer a operação inteira, e a decisão de adiar a segunda ficaria invisível. **O nome carrega a
fronteira.**

**Nome técnico não é automaticamente termo de linguagem ubíqua.** Critério estabelecido em 20/08/2026, ao
modelar os dados, e que vale para nome de coluna, de tabela, de endpoint e de recurso: entra no glossário
o conceito, e não o identificador. A coluna ou o endpoint herda o nome do conceito quando houver um, e
quando não houver o nome é decisão técnica, desde que a distinção que ele representa esteja no glossário.

O caso que fixou o critério: `email_contato` é nome de coluna e não virou termo, e a distinção que ele
carrega, a de que o e-mail de contato da Pessoa não é a credencial e os dois podem divergir, entrou na
definição de Pessoa, que é onde faz falta. Já `Pedido de entrada` virou termo, porque é conceito: é uma
coisa que existe no domínio, aguardando decisão de alguém.

**Duas definições deste glossário nasceram de análise, e não de coleta**, e por isso são as mais frágeis:
a separação entre Área e Localização, e a distinção entre Trilha de auditoria e Linha do tempo. As duas
resolvem ambiguidade real das fontes, e nenhuma foi validada com um síndico de verdade.
