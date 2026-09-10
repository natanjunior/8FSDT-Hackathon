# Documentação da Demanda — Resolve Aí

Persona, problema e jornada atual, objetivo com métrica, jornada da solução, e requisitos funcionais e
não funcionais. Antes de tudo isso, os riscos do produto, porque são eles que explicam por que o recorte
da primeira entrega é o que é.

As personas e a jornada atual vêm do relato de um integrante do time, que é síndico do condomínio onde
mora. Onde há aspas, a citação é literal desse relato. O que não foi validado com pessoas de fora está
registrado em [premissas-e-questoes-abertas.md](premissas-e-questoes-abertas.md).

---

## 0. Riscos do produto

Quatro riscos ameaçam um produto: técnico, de usabilidade, de valor e de negócio. Neste projeto o técnico
domina, e é o que as decisões abaixo mitigam.

| Risco | Aplica aqui? | Como se manifesta e como mitigamos |
|---|---|---|
| **Técnico**, a possibilidade de o time não ter recursos para desenvolver | Dominante | Um implementador e cerca de seis semanas. Mitigado por três decisões: stack já conhecida pelo implementador (ADR-0002); pipeline de deploy como primeira tarefa de implementação, para publicar antes de ter domínio e fazer de "está no ar" uma verdade desde o primeiro commit; e escopo cortável, com toda adição do projeto identificada como tal |
| **Usabilidade**, o produto não ser adotado por dificuldade de experiência | Alto | Se o morador não registrar em menos de um minuto pelo celular, ele volta para o WhatsApp e o produto morre. Mitigação: priorizar o fluxo de registro sobre o dashboard, e leitura offline para o Encarregado, que trabalha em subsolo e casa de máquinas |
| **Valor**, o cliente não precisar do produto | Médio, em versão degradada | Não há cliente pagante nem mercado a validar. A pergunta que resta é real: o Gestor prefere isto ao grupo de WhatsApp? Mitigação: as três entrevistas que não foram feitas |
| **Negócio**, conflito com objetivo estratégico, viabilidade ou risco legal | Descartado, com uma exceção | Não há empresa, receita nem risco jurídico relevante, e o produto guarda foto e localização de pessoas, o que o coloca sob a LGPD. Tratado nos requisitos não funcionais |

---

## 1. Persona

**Persona primária: o Gestor.** Aparece em duas variantes, e as duas foram narradas.

**1A · Síndico amador.** Mora no condomínio que administra; prédio único, cerca de dez apartamentos. Não é
sua profissão. Tem um zelador, senhor de idade que não usa celular, um porteiro, e contrata terceiros para
o que foge da alçada do zelador. Gerencia tudo em papel e planilhas próprias. Quer duas coisas: parar de
se perder, e dar publicidade aos condôminos sobre o andamento.

**1B · Síndico profissional.** Trabalha para uma imobiliária e responde por vários condomínios. Zeladores
e porteiros são de empresa terceirizada, e prestadores externos entram para serviços específicos.
Organiza-se em Trello, fala com os zeladores por WhatsApp em número próprio. Presta contas à imobiliária.

**Personas secundárias:**

- **Solicitante**, morador ou funcionário que registra a ocorrência e quer saber se foi resolvida. Sempre
  tem conta: sem ela não consegue registrar.
- **Encarregado**, quem executa. Pode ou não ter conta. Na Persona 1A tipicamente não tem, porque o
  zelador não usa celular, e o Gestor age em nome dele; na 1B costuma ter, e é usuário mobile-first.

---

## 2. Problema e jornada atual

O enunciado descreve o problema em uma frase: *"as solicitações chegam por mensagens, e-mails ou conversas
informais, dificultando a priorização e o acompanhamento."* As duas jornadas abaixo são a versão vivida
disso.

### 2.1 Jornada atual — Persona 1A (síndico amador)

1. O condômino registra a ocorrência no grupo de WhatsApp do condomínio: *"eles só escrevem algo"*.
2. O síndico lê tudo e transcreve para papel e planilhas próprias.
3. Toda manhã há uma reunião presencial com o zelador, em que o síndico passa o que ele tem que fazer.
4. O síndico anota nos próprios papéis o que o zelador está executando.
5. Quando algo trava, ele anota a ocorrência como pausada e tenta avisar o solicitante por WhatsApp.
6. No dia seguinte, o zelador diz o que fez; o síndico confere e decide se acabou.

**Problemas declarados:** *"sempre me perco na bagunça"*; *"tenho dificuldade de deixar os condôminos a
par do que está sendo feito e do que já acabou"*; e, no passo 5, *"muitas vezes acabo me perdendo e a
ocorrência some dentre outras"*.

### 2.2 Jornada atual — Persona 1B (síndico profissional)

1. A ocorrência chega por e-mail.
2. O síndico a leva para o Trello, verificando na própria organização a prioridade e se é duplicada.
3. Fica esperando algum zelador do prédio ficar livre, e então passa a ocorrência por WhatsApp, em áudio
   ou texto, do número pessoal.
4. O zelador avisa quando terminou e manda fotos e vídeos; às vezes o síndico vai ao condomínio conferir
   pessoalmente. Ele sempre decide se acabou.
5. Depois de pronto, procura no Trello o item para fechá-lo.
6. Procura o e-mail que originou a ocorrência para responder ao solicitante.
7. Quando trava, move para a coluna de impedimentos, anota o motivo para não esquecer, e de novo procura o
   e-mail para avisar que vai demorar.

**Problema declarado:** *"percebo que às vezes as ocorrências têm um tempo mais elevado devido a problemas
de comunicação"*.

### 2.3 O que as duas jornadas têm em comum

- **O registro chega sem estrutura**, como texto solto em WhatsApp ou e-mail, e o Gestor transcreve à mão.
- **O estado da ocorrência vive fora do canal em que ela nasceu**, em planilha, papel ou Trello, então
  responder ao solicitante exige procurar duas vezes.
- **A espera é onde o trabalho se perde.** Nas duas personas, é no momento em que a ocorrência trava que
  ela desaparece.
- **Nenhuma das duas mede nada.** Não existe tempo médio, volume por categoria nem taxa de reincidência, o
  que torna impossível argumentar em assembleia ou perante a imobiliária.

---

## 3. Objetivo

**Objetivo geral.** Centralizar o registro, o acompanhamento e a resolução de ocorrências numa única
plataforma, com trilha auditável de cada mudança de status, de modo que o solicitante saiba o andamento
sem precisar perguntar e o gestor não perca ocorrências em espera.

**Objetivos específicos, com métrica:**

| # | Objetivo | Métrica | Meta |
|---|---|---|---|
| O1 | Nenhuma ocorrência se perde na espera | Ocorrências pausadas há mais de 15 dias sem atualização | 0 |
| O2 | O solicitante para de cobrar retorno | Mensagens de cobrança de status fora do sistema, medidas por declaração do Gestor | redução de 50% |
| O3 | O gestor responde rápido ao que chega | Tempo até a primeira resposta, do registro a `Em análise` | ≤ 2 dias úteis em 90% dos casos |
| O4 | Passamos a saber se resolvemos bem | Ocorrências resolvidas que receberam avaliação | ≥ 60% |
| O5 | O atraso externo deixa de ser confundido com lentidão do gestor | Diferença entre tempo de calendário e tempo ativo, publicada no dashboard | medida e visível |
| O6 | Toda transição é auditável | Transições de status com registro completo dos cinco campos | 100%, garantido por invariante do agregado (ADR-0001) |

**As metas de O1 a O5 são hipóteses, e é honesto dizer por quê.** Não existe linha de base: a jornada
atual não mede nada, em nenhuma das duas personas. Os números são para calibrar depois das primeiras
semanas de uso, e **produzir a linha de base é, ele próprio, o primeiro resultado do produto**. O O6 é
diferente: não é meta, e sim consequência estrutural do desenho.

**Estes são objetivos do produto, e não da primeira entrega.** O recorte em [escopo.md](escopo.md)
instrumenta O3, O4 e O6 desde o início. O O5 não é medido na primeira entrega, porque a comparação entre
tempo de calendário e tempo ativo depende de indicadores adiados; e O1 e O2 são mensuráveis mas não
assistidos, porque o alarme de ocorrência parada e o aviso automático ficaram para depois. A distinção
está declarada para que a ausência não seja lida como esquecimento.

---

## 4. Jornada da solução

| # | Etapa | Persona | Sistema | Observações |
|---|---|---|---|---|
| 01 | Registra a ocorrência: título, descrição, categoria, localização, imagem | Solicitante | Resolve Aí | A localização aponta para uma Área configurada, com complemento em texto |
| 02 | Vê ocorrências abertas semelhantes no mesmo local e pode aderir em vez de abrir outra | Solicitante | Resolve Aí | Converte duplicata em sinal de impacto |
| 03 | Encontra a ocorrência no filtro de não triadas | Gestor | Resolve Aí | Substitui o passo 2 das duas jornadas atuais, o de transcrever à mão |
| 04 | Analisa, ajusta prioridade se preciso e atribui um responsável | Gestor | Resolve Aí | Prioridade nasce normal |
| 05 | Toma ciência da atribuição | Encarregado | Resolve Aí ou reunião presencial | Com conta, notificação no app. Sem conta, registro silencioso, e a comunicação segue presencial (Persona 1A) |
| 06 | Executa e reporta a conclusão | Encarregado | Resolve Aí | Sem conta, quem registra é o Gestor em nome dele |
| 07 | Se trava, pausa com motivo, e o solicitante é notificado | Gestor ou Encarregado | Resolve Aí | Automatiza o passo em que as duas jornadas atuais falham |
| 08 | Confere o resultado, registra a solução aplicada e resolve | Gestor | Resolve Aí | Quem resolve é sempre o Gestor |
| 09 | É notificado da resolução | Solicitante | Resolve Aí | Elimina os passos 5 e 6 da jornada 1B, procurar no Trello e procurar o e-mail |
| 10 | Avalia a resolução | Solicitante | Resolve Aí | Única métrica de qualidade do produto |
| 11 | Acompanha recorrência, tempos e avaliações | Gestor | Resolve Aí | O que a jornada atual não permite em nenhuma das personas |

**Onde a jornada da solução ataca cada problema declarado:** o passo 03 elimina a transcrição manual; o 07
e o 09 eliminam o *"procurar o e-mail para responder"*; o 07 ataca o *"a ocorrência some dentre outras"*;
e o 02 e o 11 entregam o que nenhuma das jornadas atuais tem.

---

## 5. Requisitos

### 5.1 Requisitos funcionais

**Do Solicitante**, todos exigidos pelo enunciado: criar conta; autenticar-se; registrar ocorrência com
título, descrição e categoria; informar localização; anexar imagem; acompanhar o andamento; adicionar
comentários; consultar o histórico; avaliar a resolução.

**Do Gestor**, todos exigidos pelo enunciado: visualizar todas as ocorrências da sua organização; filtrar
por categoria, status e prioridade; alterar prioridade; atribuir um responsável; atualizar o status;
adicionar comentários; registrar a solução aplicada; visualizar indicadores em um dashboard.

**Do ciclo de vida**, definido pelo enunciado no quê e no como: os cinco status (`Aberta`, `Em análise`,
`Em atendimento`, `Resolvida`, `Cancelada`); `Cancelada` alcançável a partir dos três primeiros; toda
mudança de status gera registro com status anterior, novo status, data e horário, usuário responsável e
observação; cada transição é auditável.

**Adições do projeto.** Não vêm do enunciado, e por isso são as primeiras candidatas a corte:

| Requisito | Decisão |
|---|---|
| Múltiplas organizações isoladas na mesma instância | D2, D3 |
| `Encarregado` como papel próprio, com conta opcional | D4, D21, D27 |
| Página única de cadastro com três comportamentos: convite por token, código público da organização, e código digitado | D25 |
| Criação de organização por auto-serviço, com quem cria virando Gestor inicial | D26 |
| Status `Pausada` com motivo obrigatório | D8 |
| Canais de conversa: comentário, nota interna, conversa da atribuição | D9 |
| Visibilidade derivada do tipo de área | D10 |
| Adesão a ocorrência existente | D11 |
| Cancelamento com motivo estruturado e vínculo à duplicada | D12, D17 |
| Planos comerciais e canais externos de notificação | D13 |
| Notificação a cada transição | D14 |
| Filtros rápidos e alarme de ocorrência parada | D15 |
| Categorias e áreas configuráveis por organização, com semente | D18 |

### 5.2 Requisitos não funcionais

Com número, e não com adjetivo. Requisito que não se mede não se verifica.

| # | Requisito | Alvo |
|---|---|---|
| RNF1 | **Isolamento entre organizações** | Nenhuma consulta retorna dado de outra organização. 100%, verificado por teste automatizado, com o isolamento aplicado num único ponto de estrangulamento |
| RNF2 | **Auditabilidade** | 100% das transições com os cinco campos preenchidos; registro imutável; impossível mudar status sem gerar registro |
| RNF3 | **Escala** | 50 organizações, 200 pessoas por organização, 2.000 ocorrências no total, 20 usuários simultâneos. O modelo de dados mede esse alvo em cerca de 26 MB, perto de 5% dos 500 MB do free tier do banco |
| RNF4 | **Desempenho** | p95 ≤ 1 s em requisição morna |
| RNF5 | **Disponibilidade** | Sem SLA de produção. O serviço usa escala a zero para caber na franquia gratuita, então cold start na primeira requisição após ociosidade é esperado e declarado, e medido: 20,7 s na primeira publicação real, contra 0,30 s com a aplicação quente. O banco no free tier também pausa após sete dias sem atividade |
| RNF6 | **Registro em menos de 1 minuto** pelo celular | Do toque no atalho à resposta `201` do envio, incluindo foto, num aparelho já autenticado e com o aplicativo aquecido. Mitiga o risco de usabilidade. O cenário de medição está fixado abaixo; sem ele o requisito não é verificável |
| RNF7 | **Leitura offline** para o Encarregado | A lista de atribuições e o detalhe devem abrir sem rede. Escrita offline não é requisito |
| RNF8 | **Imagem** | Uma por ocorrência, JPEG ou PNG, comprimida no cliente para no máximo 400 KB, redimensionada para 1600 px no maior lado. O aceite no seletor é de até 10 MB; o que sobe é o comprimido |
| RNF9 | **Retenção** | O histórico não expira: ele é o produto |
| RNF10 | **LGPD** | Foto e localização são dados pessoais. Base legal declarada; dado acessível apenas dentro da organização; exclusão de conta preserva a trilha de auditoria com o autor anonimizado |
| RNF11 | **Publicação em container** | A aplicação sobe por Docker, como o enunciado exige, e o mesmo container é o que executa em produção, e não apenas em desenvolvimento |

#### Por que a imagem é comprimida, e por que isso não mudou quando o teto de storage caiu

A compressão entrou porque **upload de 5 MB em rede móvel quebra o RNF6**, que é o requisito que mitiga o
risco de usabilidade. O storage foi apenas o segundo argumento, e ele desapareceu: com a
[ADR-0004](adr/0004-execucao-em-container-no-azure.md) os anexos passaram para o Azure Blob Storage, onde
o limite prático nesta escala é o custo, cerca de US$ 1 por ano. O gargalo do free tier voltou a ser o
banco, com folga de aproximadamente trinta vezes sobre o alvo. O RNF3 permanece em 2.000 por ser meta
declarada, e não por ser teto.

#### O RNF5 e o RNF6 medem janelas diferentes

O RNF6 mede a **interação**, ou seja, quanto tempo a pessoa gasta. O RNF5 mede a **plataforma**, quanto
tempo ela gasta antes de responder. Somar os dois num número só tornava os dois inverificáveis: nenhum
aparelho abriria o aplicativo frio e registraria em menos de um minuto, porque a escala a zero sozinha
come 20,7 segundos.

**O pior caso combinado fica declarado, porque é ele que o morador vive:** primeira ocorrência do dia,
aplicativo frio, cerca de 75 segundos. Não é o alvo, e não se esconde.

Há uma confirmação vinda do protótipo. A §2.5 do [protótipo](prototipo-low-fi.md) calculou que um cold
start de até cerca de 24 segundos é invisível ao Solicitante, porque os dois únicos campos que dependem da
rede são os dois últimos. Os 20,7 s medidos cabem nos 24 s, com 3,3 s de folga, e a ordem dos campos da
tela de registro, decidida por três argumentos independentes, sobreviveu ao primeiro número real.

#### Cenário de medição do RNF6

Sem cenário fixado, o mesmo requisito dá resultados que variam mais que o próprio alvo: o protótipo mediu
49 segundos de diferença entre cenários, o que é mais de 80% do orçamento.

| | |
|---|---|
| **Começa** | No toque no atalho do aplicativo já instalado, com sessão válida e organização ativa |
| **Termina** | Na resposta `201` do registro |
| **Inclui** | Tirar e confirmar a foto, e a compressão no aparelho (RNF8) |
| **Exclui** | Cold start da plataforma (RNF5) e o primeiro carregamento do aplicativo, declarados à parte |
| **Conteúdo** | Título curto e descrição de até cerca de 40 caracteres, que é o que o orçamento comporta |
| **Quem mede** | Alguém que não é o implementador, num aparelho real, em rede móvel |

**A descrição é a variável que decide.** O orçamento fecha em 53 s com uma descrição de cerca de 40
caracteres e estoura em 69 s com os 79 caracteres do exemplo do próprio contrato de API. O texto do campo
tem de pedir brevidade; se as pessoas escreverem mais que isso, o requisito falha por comportamento e não
por desenho, e é isso que a medição vai dizer.

Os números de RNF4 e RNF5 eram metas a fechar no primeiro deploy real, que já aconteceu; o RNF5 está
medido acima.
