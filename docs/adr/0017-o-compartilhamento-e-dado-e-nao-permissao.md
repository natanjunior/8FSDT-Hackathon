---
title: "ADR-0017 · O compartilhamento é dado, e não permissão"
description: "Abrir uma ocorrência a outra pessoa da organização nasce como linha numa tabela fora do agregado, e não como permissão nova: a leitura muda num lugar só, e a escrita passa a perguntar outra coisa."
---

# ADR-0017 — O compartilhamento é dado, e não permissão

**Status:** Aceita · 27/09/2026 · Defende a [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)

## Contexto

O produto ganhou um gesto novo: o autor e quem lê todas abrem uma ocorrência específica, só para leitura,
a outra pessoa da mesma organização. Quem recebe a encontra numa aba própria, vê tudo e não age.

Havia duas formas de dizer isso no código, e elas levam a lugares diferentes.

A autorização deste produto é uma **lista de permissões resolvida na porta**: o invólucro de contexto
recusa o pedido antes de ler o recurso, comparando a permissão exigida com a lista do vínculo. Ser autor
já concede ler a própria ocorrência sem nenhuma condição sobre autoria escrita à mão. E o isolamento entre
organizações é um ponto único de estrangulamento, que é o que a [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md)
protege: o repositório recebe o contexto já escopado e não tem como enxergar outra organização.

Uma permissão nova, `ocorrencia.ler_compartilhada`, caberia no enum sem esforço. O custo dela não é o enum:
é que a pergunta *"esta pessoa recebeu ESTA ocorrência?"* não é respondível na porta. A porta conhece o
vínculo, não o recurso. A permissão passaria a ser concedida a todo Solicitante e negada caso por caso
depois, dentro de cada leitura — e o conceito se espalharia pela fronteira inteira, num produto cuja
garantia central é que ele mora num lugar.

Havia também uma armadilha, e ela é a razão de esta decisão ter duas metades. A regra *"posso ver esta
ocorrência?"* era a mesma função usada por dez comandos de escrita e pelo envio de mensagem, como portão.
Estendê-la sem separar as duas perguntas daria a quem recebeu o poder de cancelar a ocorrência de outra
pessoa: o comando de cancelar não confere autoria depois do portão, porque até aqui passar pelo portão já
significava ser autor ou Gestor.

## Decisão

O compartilhamento é **dado**: uma linha numa tabela nova, fora do agregado `Ocorrência`. Nenhuma permissão
nasce, e o enum continua com dezoito.

A tabela vive fora do agregado porque o compartilhamento não muda status, não grava trilha e não toca o
relógio de atualização da ocorrência. Desfazer apaga a linha, sem histórico: ela diz quem pode ler a
ocorrência hoje, e tirar a leitura é tirar a linha.

**A leitura muda num lugar só.** A função que responde *"posso ver esta ocorrência?"* passa a considerar,
além de ser autor e de ler todas, estar na lista de com quem a ocorrência está compartilhada. É o único
lugar do produto onde o compartilhamento entra na definição de leitura.

**A escrita passa a perguntar outra coisa.** Nasce uma segunda função, *"posso agir sobre esta
ocorrência?"*, com a regra de sempre — autor ou quem lê todas —, e são os dez comandos, o envio de mensagem
e o próprio compartilhar que a chamam. O compilador forçou a escolha: a função de leitura passou a exigir a
lista de compartilhamentos, e os onze escritores, que tinham só o autor na mão, deixaram de compilar. Cada
um foi obrigado a escolher, e nenhum escolheu por esquecimento.

**A recusa de escrita a quem recebeu é `403`, e não `404`.** A escada de erros do contrato diz que não
poder ler é `404` e poder ler sem poder executar é `403`. Quem recebeu pode ler. O escritor que falha
pergunta, **só no caminho da recusa**, se a ocorrência está compartilhada com quem pediu: se está, `403`
com texto próprio; se não, o `404` de sempre. O caminho feliz não paga consulta nenhuma a mais.

**O isolamento continua por construção.** A tabela carrega `organizacao_id` em três chaves estrangeiras
compostas, e uma linha que ligasse a ocorrência de uma organização ao vínculo de outra não grava. Isso é
defesa em profundidade: a defesa primária continua sendo o repositório escopado não ter o identificador da
outra organização.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Uma permissão `ocorrencia.ler_compartilhada` no enum | A porta não conhece o recurso: a permissão seria concedida a todos e negada caso por caso dentro de cada leitura, espalhando o conceito pela fronteira inteira |
| Estender a leitura sem separar a escrita | Quem recebeu passaria a cancelar a ocorrência de outra pessoa, porque o comando de cancelar não confere autoria depois do portão |
| O compartilhamento dentro do agregado `Ocorrência` | Compartilhar viraria transição, e cada compartilhamento gravaria registro na trilha de auditoria — que existe para a mudança de estado, e não para quem olha |
| Uma coluna de estado na linha, em vez de apagar | Guardaria um histórico que ninguém pediu e que nenhuma tela mostra, e faria o pedido repetido precisar distinguir três casos onde há dois |
| Copiar a lista de quem pode ler para dentro da ocorrência | Seria a segunda cópia da resposta, e o dia em que as duas divergissem a tela mostraria uma coisa e a API responderia outra |
| Um papel novo, *"observador"* | Papel é vínculo com a organização, e isto é relação com uma ocorrência. A pessoa continua sendo o que era |

## Consequências

A leitura do detalhe paga uma consulta a mais: a lista de compartilhamentos entra no mesmo disparo paralelo
que já buscava a trilha e os anexos, então é a mesma ida e volta, com um resultado a mais.

A aba *Compartilhadas comigo* é um terceiro valor do recorte que a listagem devolve, e o filtro desce até a
cláusula da consulta como os outros. Ela troca o conjunto da página em vez de estreitá-lo, e por isso não
conta como filtro: o vazio dela tem frase própria, e limpar filtros não tira ninguém da aba. As contagens do
painel continuam medindo o que mediam.

**Quem recebeu vê a conversa do autor com os Gestores.** É consequência de *"vê o que o autor vê"*, e não
descuido: fica registrado porque é a única parte da ocorrência que não foi escrita para todo mundo. O que
ele não tem é o campo de escrever.

**Um Solicitante passa a poder descobrir nomes de outros participantes.** Até aqui ele não tinha leitura
nenhuma de gente. A busca de quem pode receber uma ocorrência devolve nome e papel, exige duas letras e
devolve no máximo vinte, e não traz contato nem unidade. Ela limita, sem impedir, a enumeração, e isso está
declarado na página de segurança em vez de escondido.

O vínculo de quem recebeu apaga em cascata; o de quem compartilhou, não. Remover um vínculo sem histórico
leva o que a pessoa recebeu, que não é rastro; o que ela compartilhou aparece nomeado na tela, conta como
histórico, e a remoção é recusada — o caminho é revogar. Revogar não apaga linha nenhuma, e é isso que faz
a pessoa readmitida voltar a ver o que já estava compartilhado com ela.

O produto passa a ter **dois** caminhos de exclusão na API, onde havia um. O outro é a remoção de vínculo
sem histórico, e a licença dos dois é estreita pela mesma razão: nenhum deles apaga ocorrência, mensagem,
categoria, área ou registro de transição. Um teste prende essa lista em dois, e o terceiro `DELETE` não
chega sem alguém decidir que ele podia existir.
