---
title: "ADR-0017 · O compartilhamento é dado"
description: "Abrir uma ocorrência a outra pessoa da organização nasce como linha numa tabela fora do agregado, e não como permissão nova: a leitura muda num lugar só, e a escrita passa a perguntar outra coisa."
---

# ADR-0017 — O compartilhamento é dado

**Status:** Aceita · 27/09/2026 · Defende a [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

O produto ganhou um gesto novo: o autor e quem lê todas abrem uma ocorrência específica, só para leitura, a
outra pessoa da mesma organização, que a encontra numa aba própria, vê tudo e não age. Havia duas formas de
dizer isso no código, e elas levam a lugares diferentes.

A autorização deste produto é uma **lista de permissões resolvida na porta**: o invólucro de contexto
recusa o pedido antes de ler o recurso, comparando a permissão exigida com a lista do vínculo.

Uma permissão nova, `ocorrencia.ler_compartilhada`, caberia no enum sem esforço. O custo dela não é o
enum: é que a pergunta *"esta pessoa recebeu ESTA ocorrência?"* não é respondível na porta, porque a
porta conhece o vínculo e não o recurso. A permissão seria concedida a todo Solicitante e negada caso a
caso dentro de cada leitura, espalhando o conceito pela fronteira inteira.

Havia também uma armadilha, e é a razão de esta decisão ter duas metades. A regra *"posso ver esta
ocorrência?"* era a mesma função que dez comandos de escrita usavam como portão. Estendê-la sem separar
as duas perguntas daria a quem recebeu o poder de cancelar a ocorrência de outra pessoa, porque até aqui
passar pelo portão já significava ser autor ou Gestor.

## Decisão

O compartilhamento é **dado**: uma linha numa tabela nova, fora do agregado `Ocorrência`. Nenhuma permissão
nasce, e o enum continua com 18.

A tabela vive fora do agregado porque o compartilhamento não muda status, não grava trilha e não toca o
relógio da ocorrência. A linha diz quem pode ler hoje, e tirar a leitura é tirar a linha.

**A leitura muda num lugar só.** A função que responde *"posso ver esta ocorrência?"* passa a considerar,
além de ser autor e de ler todas, estar na lista de compartilhamento. É o único lugar do produto onde o
compartilhamento entra na definição de leitura.

**A escrita passa a perguntar outra coisa.** Nasce uma segunda função, *"posso agir sobre esta
ocorrência?"*, com a regra de sempre: autor ou quem lê todas. O compilador forçou a escolha, porque a
função de leitura passou a exigir a lista de compartilhamentos e os onze escritores deixaram de compilar.
Cada um foi obrigado a escolher, e nenhum escolheu por esquecimento.

**A recusa de escrita a quem recebeu é `403`, e não `404`.** Quem recebeu pode ler, e a escada de erros diz
que poder ler sem poder executar é `403`. O escritor que falha pergunta, **só no caminho da recusa**, se a
ocorrência está compartilhada com quem pediu. O caminho feliz não paga consulta a mais.

**O isolamento continua por construção.** A tabela carrega `organizacao_id` em três chaves estrangeiras
compostas, e uma linha que ligasse a ocorrência de uma organização ao vínculo de outra não grava. É defesa
em profundidade: a primária continua sendo o repositório escopado, que a
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) protege.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Uma permissão `ocorrencia.ler_compartilhada` no enum | A porta não conhece o recurso: seria concedida a todos e negada caso a caso dentro de cada leitura, espalhando o conceito pela fronteira |
| Estender a leitura sem separar a escrita | Quem recebeu passaria a cancelar ocorrência alheia, porque o comando de cancelar não confere autoria depois do portão |
| O compartilhamento dentro do agregado `Ocorrência` | Compartilhar viraria transição, e gravaria registro na trilha — que existe para a mudança de estado, e não para quem olha |
| Uma coluna de estado na linha, em vez de apagar | Guardaria histórico que ninguém pediu, e faria o pedido repetido distinguir três casos onde há dois |
| Copiar a lista de quem pode ler para dentro da ocorrência | Seria a segunda cópia da resposta, e no dia em que divergissem a tela mostraria uma coisa e a API outra |
| Um papel novo, *"observador"* | Papel é vínculo com a organização, e isto é relação com uma ocorrência |

## Consequências

A leitura do detalhe paga uma consulta a mais, no disparo paralelo que já buscava a trilha.

A aba *Compartilhadas comigo* troca o conjunto da página em vez de estreitá-lo, e por isso não conta como
filtro: o vazio dela tem frase própria, e limpar filtros não tira ninguém da aba.

**Quem recebeu vê a conversa do autor com os Gestores**, e fica registrado porque é a única parte da
ocorrência que não foi escrita para todo mundo. O que ele não tem é o campo de escrever.

**Um Solicitante passa a poder descobrir nomes de outros participantes**, e até aqui ele não tinha leitura
nenhuma de gente. A busca de quem pode receber devolve nome e papel, exige 2 letras e devolve no máximo
20, sem contato nem unidade: limita a enumeração, sem impedi-la.

O vínculo de quem recebeu apaga em cascata; o de quem compartilhou, não, porque o que ela compartilhou
conta como histórico. O caminho, aí, é revogar, que não apaga linha nenhuma e faz a pessoa readmitida
voltar a ver o que já estava compartilhado com ela.

O produto passa a ter **2** caminhos de exclusão na API, onde havia 1, e a licença dos dois é estreita pela
mesma razão: nenhum apaga ocorrência, mensagem, categoria, área ou registro de transição. Um teste prende
essa lista.
