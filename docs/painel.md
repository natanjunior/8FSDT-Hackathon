---
title: "O painel"
description: "Os três números do topo, os sete quadros e a pergunta de decisão que cada um responde, a forma de cada gráfico, e como se lê cada número."
---

# O painel

A tela que responde se o problema está melhorando ou piorando, e onde. Ela não oferece ação nenhuma:
tudo nela é leitura, e a única navegação sai da lista das ocorrências mais velhas.

Quem a vê é quem tem permissão de ler o painel. As telas e a navegação até aqui estão em
[Telas](telas.md).

## Os três números do topo

O painel abre com três números, em coluna ao lado do primeiro quadro: quantas ocorrências estão em aberto
agora, o saldo do período e a idade da mais velha em aberto. Cada um traz embaixo o segundo termo que o
explica: quantas estavam em aberto no início do período, quantas entraram e quantas saíram, e o título da
mais velha. **O saldo responde à pergunta da página**, se a fila está crescendo ou encolhendo, pelo sinal
escrito e nunca pela cor, porque saldo positivo pode ser a organização começando a usar o produto. Saiu
quer dizer resolvida ou cancelada.

## Os sete quadros

Abaixo vêm sete quadros, e cada um escreve a pergunta de decisão que responde:

| # | Quadro | A pergunta |
|---|---|---|
| 1 | Entradas e saídas por mês | Está melhorando ou piorando? |
| 2 | Em aberto por idade | O que está esperando demais, e qual ocorrência? |
| 3 | Tempo de resolução | Quanto demora, e quanto demora para quem espera mais? |
| 4 | O que está voltando | Onde vale atacar a causa em vez de abrir outra ordem de serviço? |
| 5 | Em aberto por categoria | Onde está o trabalho que não terminou? |
| 6 | Ocorrências por status | Como se distribui tudo o que já foi registrado? |
| 7 | Satisfação | Quem foi atendido ficou satisfeito? |

## A forma de cada gráfico

Cada gráfico tem a forma que a medida pede. Entradas e saídas e o tempo de resolução são linhas, mês a mês;
a idade, o que está voltando, a categoria e o status são barras com o número escrito na ponta; a satisfação
é a média em número grande, com as cinco notas em barras. Nenhuma cor diz nada sozinha.

Os dois quadros de linha e o da idade têm o botão *Ver dados*, que abre a tabela do quadro num modal. A
tabela é a alternativa em texto do gráfico, e a frase que resume o quadro fica fora dela, visível. Nos
outros quadros de barra cada barra já traz o número, e o leitor de tela lê as mesmas linhas numa lista.

## Como se lê cada quadro

No primeiro quadro, a linha de cima conta o que entrou e a de baixo o que saiu. Registradas acima das
saídas em meses seguidos é fila crescendo, e o contrário é fila encolhendo. A frase do quadro fala do
último mês completo do período. O mês que o período corta leva um asterisco no rótulo, e uma nota explica
que o número dele não se compara com o de um mês inteiro: sem isso, a janela de noventa dias exageraria a
rampa nas duas pontas.

O quadro da idade começa pelas mais velhas. A frase diz quantas esperam há mais de um mês e, quando há
alguma acima de três meses, quantas são; a lista mostra as cinco que esperam há mais tempo, com o estado e
a idade de cada uma; as quatro faixas vêm depois, sempre, mesmo a zero, para que uma organização que está
começando veja o que vai ser medido. O título de cada uma leva à ocorrência, e é a única navegação do
painel.

O tempo de resolução mostra, por mês, a mediana e o p90. A mediana diz como foi o caso do meio; o p90 diz
como foi o décimo pior atendimento, e é nele que há o que corrigir. Mês com três resoluções ou menos não
tem p90, porque um percentil sobre três pontos descreveria mais do que três pontos sustentam, e as
durações dele aparecem uma a uma na tabela.

O que está voltando mostra as duplas de área e categoria que se repetiram no período, da maior para a
menor, as cinco primeiras e as que empatam com a quinta. O que passa disso vira uma frase, e o corte nunca
separa um empate. Embaixo, o quadro diz de quantas ocorrências registradas no período as duplas são parte,
e o comprimento de cada barra é essa parte. Uma ocorrência não é recorrência, então a dupla só aparece da segunda em diante; sem
nenhuma, o quadro escreve o que vai aparecer ali.

O quadro por status conta todas as ocorrências da organização, inclusive as resolvidas e as canceladas, na
ordem do ciclo. O quadro por categoria conta só o que está em aberto, e escreve ao lado de cada número
quantas passaram de uma semana. Os dois não somam o mesmo número, e cada um diz na tela o que conta,
porque um leitor que somasse os dois chegaria a uma conclusão que os dados não sustentam.

O quadro da satisfação escreve o denominador ao lado da média, sempre: sem ele a média engana quando poucos
avaliam, porque a média de duas notas ocupa a mesma tela que a média de duzentas. Sem nenhuma avaliação no
período, o número grande fica num traço, nunca num zero, e a frase ao lado diz quantas resolvidas o período
tem e que nenhuma delas foi avaliada.

## O período

No painel, o período se escolhe num controle único, que mostra o intervalo aplicado e abre um calendário
com quatro atalhos de uso corrente: últimos 7, 30 e 90 dias, e este mês. O atalho do período aplicado
aparece marcado, e o rótulo do controle só muda depois de aplicar. Se a data de início vier depois da
de fim, a tela troca as duas e diz que trocou, em vez de recusar o pedido. A API continua recusando a
mesma consulta, porque para um programa a ordem errada é defeito de quem chamou.

## A unidade do tempo

No painel, a API devolve o tempo de resolução em horas, e **a unidade que se lê é escolha da
tela**: abaixo de um minuto ela escreve *menos de 1 min*, abaixo de uma hora escreve minutos, de uma a 48
horas escreve horas inteiras, e acima disso escreve dias com uma casa. Assim uma ocorrência resolvida em
nove minutos aparece em minutos, e uma resolvida em dez segundos não aparece como zero.
