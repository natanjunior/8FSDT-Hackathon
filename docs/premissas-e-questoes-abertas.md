# Premissas e Questões Abertas

Este documento existe por uma característica estrutural do projeto: **ninguém de fora do time validou o
domínio**. A fonte mais forte disponível é um integrante do time que é síndico do próprio condomínio, e
todo o resto foi construído a partir do relato dele.

A consequência é que **toda decisão de domínio aqui é uma suposição**, e o instrumento correto é registrar
em vez de esconder. Um leitor que encontra a lista sabe onde o modelo pode estar errado e o que muda em
cada caso; um que não a encontra descobre isso no pior momento possível.

> **Nota de vocabulário.** O papel de quem executa o trabalho chama-se `Encarregado`. "Responsável" ficou
> reservado para a atribuição, *"o responsável por esta ocorrência"*, que é a palavra do enunciado no lugar
> exato em que ele a usa. Ver a decisão de produto D27 e o glossário.

---

## 1. Premissas assumidas

Decisões tomadas sem confirmação de fonte de domínio. Cada uma diz **o que muda se estiver errada**, que é
a informação útil.

### P1 — A criação da ocorrência gera o primeiro registro de histórico

Com `status anterior` nulo.

**Por que assumimos.** Os dois fluxogramas oficiais do enunciado divergem: o `fluxograma-2` liga todos os
cinco estados ao bloco de Histórico, sugerindo registro já em `Aberta`; o `fluxograma-3` liga o histórico
apenas às transições. Adotamos a leitura mais informativa, porque uma trilha de auditoria sem a origem é
incompleta, e ela custa praticamente nada.

**Se estiver errada:** sobra um registro por ocorrência. Impacto baixo, e reversível.

### ~~P2~~ — resolvida

`iniciarAtendimento` exige responsável atribuído. Era premissa derivada da jornada, e virou a decisão D21,
com auto-atribuição em um clique. A justificativa: "quem está fazendo" é o que o Gestor não sabe hoje.

### P3 — A avaliação do Solicitante não é um sexto estado

Formalizada na decisão D1. A imagem do ciclo de vida da segunda página do PDF mostra um nó "Avaliação do
solicitante" após `Resolvida`, que não existe na lista textual dos cinco estados, nem no `fluxograma-2`,
nem na segunda imagem do ciclo de vida, que traz os cinco estados e nada mais. Prevaleceu o texto, e o
placar é de três fontes contra uma.

**Se estiver errada:** a máquina de estados ganha um sexto estado terminal cuja transição depende de ação
do Solicitante, e o enunciado não diz o que fazer se ele nunca avaliar. Impacto alto no modelo, e é a
divergência mais estruturante do enunciado.

### P4 — "Solução aplicada" é atributo da Ocorrência

O `fluxograma-1` não lista "Solução aplicada" entre os atributos; a imagem renderizada no PDF lista.
Tratamos a imagem como a versão mais recente.

**Se estiver errada:** provavelmente nada, porque a capacidade de registrar a solução aplicada exige que o
dado exista de algum jeito.

### P5 — As personas secundárias não foram validadas

`Solicitante` e `Encarregado` foram construídos a partir do relato de um integrante do time. E a Persona
1B, a do síndico profissional, foi narrada de fora, por quem é síndico amador.

**Se estiver errada:** a 1B sustenta os requisitos mais caros, que são o Encarregado com conta, os canais
de conversa e vários condomínios por gestor. **É o maior risco de escopo do projeto:** se a persona não se
confirma, boa parte do que foi acrescentado por nós perde justificativa.

**Como reduzir esta premissa a evidência:** uma entrevista com um síndico profissional. Ela não foi feita.
É a única premissa deste documento que se resolveria com uma conversa curta, e a que mais escopo
destrava, e por isso segue registrada como pendência em vez de resolvida.

### P6 — Em filtro cujo valor pode voltar, a compensação de deslocamento reduz o pulo mas não o elimina

A compensação de deslocamento ([contrato §7.7](contrato-de-api.md)) é exata quando nada reentra no
conjunto filtrado dentro do corte. Na fila de triagem, `?status=aberta`, isso é garantido pela máquina de
estados: nenhuma transição leva a `aberta`, e nascimento novo está fora do corte. Se, entre duas páginas,
reentrarem mais itens do que saíram depois da posição do leitor, um item pode ser pulado.

**Onde há reentrada.** A lista é fechada e sai da máquina de estados e das dez setas:

| Recorte | Por onde reentra |
|---|---|
| `?status=pausada` | `retomar` tira, `pausar` devolve |
| `?status=em_analise` · `?status=em_atendimento` | `pausar` tira, e `retomar` devolve, porque o retorno é ao status anterior à pausa, e os dois únicos anteriores possíveis são estes |
| `?prioridade=` (qualquer valor) | `alterarPrioridade` é livre nos dois sentidos, sem trilha e sem terminal. É a dimensão com mais reentrada das três |
| `?status=aberta` · `?status=resolvida` · `?status=cancelada` · `?categoriaId=` | Nenhuma. `aberta` é estado de nascimento, os dois terminais não têm saída (decisão D24), e a categoria não muda depois do registro |

**Por que assumimos.** A alternativa que elimina o resíduo é o cursor, e ele não sustenta salto para página
arbitrária, que foi o que a decisão do dono do produto pediu em 09/09/2026. E o recorte que o §7.7 existia
para proteger, a fila de triagem, é o que fica exato. Os recortes com reentrada são listas curtas
(pausadas, em análise, em atendimento) ou dimensão que ninguém pagina de cima esperando ter visto tudo
(`?prioridade=`), e a reentrada exige que alguém aja no sentido inverso, no mesmo minuto, na mesma
organização.

**Se estiver errada:** uma ocorrência some da navegação de quem estava paginando naquele instante. Ela
continua alcançável por qualquer outra leitura, sem filtro, por outra página, pelo detalhe ou pelo painel
de contagens. O conserto, se o caso aparecer, é a navegação por cursor sob rótulo numérico para os
recortes com reentrada, e o desenho já existe, no que o §7.7 recusou.

---

## 2. Suposições que sustentam os documentos

Diferente das premissas acima, que são sobre o domínio, estas são sobre **o que um documento assumiu para
poder ser escrito**. Cada linha traz três coisas: o que se supôs, em que documento a suposição sustenta
uma afirmação, e o que muda se ela estiver errada.

| O que se supôs | Onde sustenta | Se estiver errada |
|---|---|---|
| **As metas de O1 a O5 são calibráveis sem linha de base.** Elas foram escritas por analogia, porque a jornada atual não mede nada em nenhuma das duas personas | [documentacao-da-demanda.md](documentacao-da-demanda.md) §3, os objetivos específicos | As metas não são atingíveis nem absurdas: são desconhecidas. Produzir a linha de base é o primeiro resultado do produto, e é o que permite recalibrar |
| **O piso de acessibilidade da biblioteca de componentes basta**, porque não há teste de usabilidade nem de acessibilidade no projeto e não haverá | [ADR-0007](adr/0007-camada-de-interface-com-shadcn-ui.md), a escolha de `shadcn/ui`, e o risco de usabilidade da demanda §0 | O defeito aparece com quem depende de teclado ou de leitor de tela, que é quem não estará na demonstração. É o risco classificado como alto sem instrumento de medida |

---

## 3. Questões abertas

Numeração herdada do registro de decisões de produto. Das catorze, doze foram resolvidas, por decisão
direta ou por consequência de outra decisão.

**Não resta nenhuma.** As duas últimas eram corte de escopo, e foram fechadas pelo recorte da primeira
entrega, registrado em [escopo.md](escopo.md):

| # | Resolução |
|---|---|
| Q10 | O aviso automático não entra na primeira entrega, em nenhum canal, nem externo nem dentro do aplicativo. O Solicitante acompanha pela lista e pela linha do tempo, que são requisitos do enunciado. O e-mail transacional de acesso permanece, por ser infraestrutura de conta e não notificação |
| Q11 | O acesso próprio do Encarregado não entra na primeira entrega, e com ele saem a leitura offline, o reporte de execução, a recusa de atribuição e a conversa da atribuição. O critério não foi prazo: os itens se apoiam na persona do síndico profissional, que é a premissa P5, não validada |

### Resolvidas, para rastreabilidade

| # | Resolvida por |
|---|---|
| Q1 · Q2 | D4, D5 — modelo de atores e cancelamento |
| Q3 | D10 — localização estruturada, por consequência da visibilidade derivada |
| Q4 | D18 — categorias configuráveis com semente |
| Q5 | D19 — dashboard é gestão; operação fica nos filtros rápidos |
| Q6 | D9 — nota interna é o canal 2 |
| Q7 | D22 — solução aplicada opcional, induzida por UX, com interruptor por organização |
| Q8 | D24 — sem reabertura; nova ocorrência vinculada à original |
| Q9 | D25 — uma página de cadastro, três comportamentos |
| Q12 | D23 — `observação` obrigatória onde há decisão a justificar |
| Q13 | D21 — papel e atribuição ortogonais |
| Q14 | D26 — organização por auto-serviço; quem cria é o Gestor inicial |

---

## 4. Pontos de atenção

Um ponto de atenção é uma pergunta cuja resposta muda o produto, e que ninguém de fora do time respondeu.
A maioria saiu do Event Storming; alguns apareceram depois, ao desenhar, e a origem de cada um está dita.
**Nenhum foi resolvido em silêncio.**

### Ainda abertos

| # | Ponto de atenção |
|---|---|
| PA-01 | **O anexo pode ser adicionado depois do registro?** Na vida real o morador fotografa depois de abrir. O enunciado exige poder anexar, e não diz quando. O preço da resposta caiu em 21/08/2026: enquanto a imagem era uma coluna da ocorrência, anexar depois exigia mudança de esquema; com a tabela `anexos` (`modelo-de-dados.md` §6.16), o dia daquela decisão custa um endpoint e uma tela, e não uma migração. O corte continua sendo de escopo, e não de modelo, e é por isso que a pergunta segue aberta |
| PA-02 | **Em ocorrência de área comum, o nome do autor aparece para os vizinhos?** A pesquisa cívica registra que cidadãos hesitam por medo de retaliação, e reclamar de algo que envolve um vizinho é rotina em condomínio |
| PA-03 | **Quem pode aderir?** Qualquer pessoa com vínculo no local, ou só quem tem papel de Solicitante? O autor pode aderir à própria? |
| PA-05 | **LGPD**, com foto e localização de pessoas. Tratado no RNF10, e sem revisão jurídica |
| PA-06 | **Se "aguardando conferência" virar status**, o nome não pode ser `Em análise`, que já é do Gestor. Hoje é apenas o evento `Execução reportada como concluída`, sem status próprio |
| PA-07 | **Na Persona 1A, quem dispara as transições?** Seu Antônio não tem conta, e o Gestor age em nome dele. O campo `autor da transição` registra o Gestor, mesmo quando o trabalho foi do zelador. A trilha fica correta e incompleta, e isso toca o requisito central do enunciado |
| PA-08 | **Um Encarregado pode servir várias organizações?** Seu Antônio é de empresa terceirizada, lotado no Céu Azul. Se ela atende cinco condomínios, são cinco vínculos ou uma entidade acima da organização? |
| PA-11 | **Quanto tempo é "muito tempo" sem primeira resposta?** Precisa de número para a política POL-09 existir. O objetivo O3 propõe dois dias úteis, ainda não confirmado |
| PA-12 | **Pausada por muito tempo, e o alarme funciona?** Metade resolvida pelas decisões D14 e D15. É o modo de falha confirmado por pesquisa independente: *"ON HOLD ou PARKED podem ser status úteis, mas também podem ser lugares onde itens acumulam e são ignorados"*. Se falhar aqui, o produto reproduz a dor que veio consertar |
| PA-13 | **Quem são "os Gestores da organização" no canal 1?** Todos, sempre? Um condomínio com síndico e subsíndico teria os dois em toda conversa? |
| PA-16 | **O que acontece se o Solicitante nunca avaliar?** Pela decisão D1 nada trava, e o indicador de satisfação fica cego, sendo ele a única métrica de qualidade do produto. Na primeira entrega o convite a avaliar aparece no detalhe e na lista, mas a lista ordena só por data de registro e não filtra *resolvida e não avaliada*, então a resolução envelhece, afunda, e o convite afunda com ela. O que traria de volta são o sino e os filtros rápidos, os dois fora da primeira entrega. **O objetivo O4, de pelo menos 60% avaliadas, fica sem instrumento**, e este é um custo do corte do aviso automático que a §3.2 do `escopo.md` não previu. Desde o item 14b, `GET /ocorrencias` devolve `total` sob os filtros aplicados, então `?status=resolvida` responde quantas resolvidas existem; o que falta é a outra metade, porque *"e não avaliada"* não tem filtro próprio. A linha de chamada continua fora da primeira entrega, e a condição que a desbloqueia é o dia em que `GET /ocorrencias` souber responder *"resolvida e não avaliada"*, que é o item 27. **O instrumento que sobra para o O4 é a marca no item da lista.** Levantado no inventário de telas em 20/08/2026 |
| PA-17 | **A avaliação é visível ao Encarregado?** Ele executou o serviço, e a nota é sobre o trabalho dele |
| PA-21 | **Cinco eventos não couberam na linha do tempo:** comentário, nota interna, alteração de prioridade, reatribuição e mensagem na atribuição. O método usado no Event Storming não trata de evento transversal, e a limitação ficou registrada em vez de forçá-los |
| PA-22 | **Pausar para melhorar o número.** O material de ITSM alerta que a classe *on-hold* *"não deve ser mal utilizada para atingir o SLA intencionalmente"*. Na Persona 1B o Gestor presta contas à imobiliária, então o incentivo existe |
| PA-24 | **A Organização com um Gestor só não tem caminho de volta.** Três decisões corretas isoladamente se fecham num beco: a organização nasce com um Gestor (D26), o papel de um vínculo não pode ser alterado depois de criado, e só um Gestor aprova pedido de entrada (D25). Se esse único Gestor perder o acesso, ninguém entra, ninguém aprova e ninguém promove, e a organização fica inacessível para sempre. A saída existe só fora do produto, por acesso direto ao banco, que é o caminho que a ADR-0003 declara como o que escapa do isolamento. Aceitável num MVP acadêmico, e não aceitável sem estar escrito. Levantado na revisão do contrato de API, 20/08/2026 |
| PA-26 | **Quem tem conta não corrige o próprio nome depois de entrar.** A tabela `pessoas` é global, e por isso `PATCH /vinculos/{pessoaId}` recusa quem tem Usuário: um Gestor não pode alterar o cadastro de alguém em todas as outras organizações. A regra está certa, e o que faltava era o outro lado. Na primeira entrega o nome nasce do cadastro da conta e é corrigível uma vez, no pedido de entrada. Depois disso não há caminho. **A consequência é permanente:** o registro de transição é imutável, então o nome vigente em cada transição fica na trilha de auditoria para sempre. Não há tela de perfil porque ela não teria o que salvar. Encontrado ao montar o inventário de telas, pela pergunta *"o que uma tela de perfil salvaria?"*, 20/08/2026 |
| PA-27 | **O Gestor não consegue ver o que o Solicitante lê.** Os rótulos de status dependem de quem lê, e são calculados no servidor para o chamador, então nenhum endpoint devolve o rótulo do outro lado. Na prática, um Gestor escrevendo a observação de uma transição não tem como conferir na tela dele o texto que o morador vai receber, e a observação é imutável depois de gravada. O protótipo contornou mostrando o texto cru na pré-visualização, em vez do rótulo, o que ajuda e não é a mesma coisa. Levantado no protótipo low-fi, 21/08/2026 |
| PA-28 | **A mensagem de uma regra de lint enuncia menos do que a regra faz.** A constante `COMPOSICAO` do `eslint.config.mjs` diz que `src/composicao/` é importada apenas por `src/interface/http/`, e o conjunto declarado no `files` da regra tem três consumidores: `src/interface/http/`, `src/interface/acoes/` e `semente/`. A regra funciona, porque quem decide é o `files`; o que engana é o texto que aparece quando o lint falha. A mitigação já está aplicada do lado da documentação, com a ADR-0006 apontando o `eslint.config.mjs` como fonte da verdade em vez de repetir a lista, e o que falta é a linha de código. Dono: frente de código. Levantado ao reescrever as ADRs, 09/09/2026 |

Quatro destes não vieram do Event Storming, e é informação saber como apareceram: o PA-24 saiu da revisão
do contrato de API, o PA-25 do desenho do fluxo de entrada na Organização, e o PA-26 e o PA-27 de montar o
inventário de telas e desenhar o protótipo. Nos quatro casos foi a mesma circunstância, a de decisões
tomadas em momentos diferentes lidas juntas pela primeira vez. **Nenhuma das decisões envolvidas erra
sozinha**, e o instrumento que as pegou não foi revisão de texto: foi desenhar e listar.

O PA-24 e o PA-25 compartilhavam a causa raiz, a de que o papel de um vínculo é imutável e não havia como
desfazer um vínculo. O PA-25 foi resolvido, e o PA-24 não foi resolvido pelo mesmo conserto: remover um
vínculo não cria Gestor, então a Organização cujo único Gestor perde o acesso segue sem caminho de volta
dentro do produto. O conserto do PA-25 abriria uma segunda porta para o PA-24 se não tivesse a guarda do
último Gestor, porque o Gestor inicial de uma Organização recém-criada não tem histórico e poderia remover
a si mesmo.

### Resolvidos

| # | Resolvido por |
|---|---|
| PA-04 | D18 — semente das sete categorias do enunciado |
| PA-09 | D16 — nenhuma política altera prioridade |
| PA-10 | D17 — nada migra; impacto calculado sobre o grupo de duplicadas |
| PA-14 | D22 — é a Q7 |
| PA-15 | D24 — não há reabertura |
| PA-18 | D23 — é a Q12 |
| PA-19 | **Decidido em 22/08/2026: não haverá visão do Gestor atravessando organizações.** O sistema opera sempre no escopo de um vínculo, e a pessoa escolhe a organização e vê o produto filtrado por ela, sem lista unificada. Custa zero, porque é o que já está construído: `GET /contexto` resolve por vínculo, e a [ADR-0003](adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md) estrangula tudo num ponto só porque toda requisição pertence a uma organização. **O que a decisão custa:** na Persona 1B, o Gestor de três condomínios troca de organização para ver cada um, e fica sem um *"o que precisa da minha atenção hoje"* unificado. É a perda real, e ela é aceita. **O que ela exige em troca:** que trocar de organização seja barato e visível, ou a decisão fica ruim na demonstração, que é onde a Persona 1B aparece. As telas sustentam: o [inventário de telas](inventario-de-telas.md) define a troca como menu do cabeçalho e não tela, com o nome da organização ativa permanentemente visível ao lado, porque num produto em que a organização vem da sessão e não da URL o endereço não diz onde você está; o [protótipo](prototipo-low-fi.md) a materializa como `DropdownMenu`; o [contrato](contrato-de-api.md) §4.4 lhe reserva dois dos quatro endpoints da lista fechada; e a tela de `404` oferece a troca quando há outro vínculo, que é o caminho pelo qual o erro mais provável se conserta sozinho |
| PA-20 | D13 e D14, mais a decisão sobre e-mail transacional. Resta só o corte de escopo, que é a Q10 |
| PA-23 | D26 — auto-serviço; quem cria a organização é o Gestor inicial |
| PA-25 | **`DELETE /vinculos/{pessoaId}`**, remover vínculo sem histórico, capacidade entregue na atividade 1 do [escopo](escopo.md). Foi preciso ceder em uma de três regras corretas — nada é apagado, papel imutável, um vínculo por pessoa por organização — e cedeu a primeira, porque o `ON DELETE RESTRICT` do esquema já delimita a exceção: só passa o vínculo sem dependente, que é o único sem histórico a preservar. Detalhe em [contrato-de-api.md](contrato-de-api.md) §8.2 |

---

## 5. Divergências nas fontes do enunciado

Já mapeadas. **Não redescobrir, não resolver em silêncio.**

| Divergência | Resolução |
|---|---|
| O `.md` do enunciado truncou Docker, Deploy em Cloud e Documentação, que só aparecem no PDF | Em dúvida sobre requisito, o PDF manda. Foi o que motivou o inventário completo do enunciado |
| A imagem do ciclo de vida mostra "Avaliação do solicitante" após `Resolvida`; a lista textual e o `fluxograma-2` têm só cinco estados | P3, e a decisão D1 |
| `fluxograma-2` liga todos os estados ao histórico; `fluxograma-3` liga só as transições | P1 |
| `fluxograma-1` não lista "Solução aplicada" entre os atributos; a imagem renderizada lista | P4 |
| O `fluxograma-1` desenha as capacidades de cada perfil como sequência encadeada | Não é fluxo: é lista de capacidades desenhada como fluxo por conveniência visual. Não modelamos como ordem obrigatória |

---

## 6. Como este documento é mantido

O Definition of Done exige, em toda funcionalidade, que ponto de atenção resolvido seja riscado e ponto de
atenção novo seja registrado. E o Definition of Ready exige, antes de começar, que não haja ponto de
atenção em aberto que mude o comportamento daquela tarefa.

Ou seja, este arquivo não é anexo: ele é consultado antes de cada tarefa e atualizado depois de cada uma.
