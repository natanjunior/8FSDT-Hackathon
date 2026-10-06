---
title: "ADR-0016 · O relógio de atualização passa a ser do banco"
description: "As seis tabelas que carregam criado_em e atualizado_em passam a ter o segundo escrito por gatilho, e a aplicação para de carimbá-lo à mão em sete lugares."
---

# ADR-0016 — O relógio de atualização passa a ser do banco

**Status:** Aceita · 24/09/2026 · Complementa a [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md)

## Contexto

Seis tabelas do esquema carregam o par `criado_em` e `atualizado_em`: `pessoas`, `organizacoes`,
`vinculos`, `categorias`, `areas` e `contatos`. A primeira migração registrou que nenhum documento
decidia quem mantém o segundo, o banco ou a aplicação, e deixou a questão aberta porque naquela fatia
nada dava `UPDATE`. As duas migrações seguintes repetiram a nota.

Enquanto a questão ficou aberta, a resposta se acumulou por omissão: a aplicação passou a escrever
`atualizado_em = now()` dentro de cada instrução, em sete lugares diferentes. Sete lugares é o número de
vezes que alguém precisou lembrar, e o oitavo escritor é quem esquece.

A tabela de participantes passou a precisar de uma coluna que mostra quando aquele participante mudou
pela última vez. Participante é pessoa dentro de organização, e isso são duas tabelas, então a coluna lê
dois relógios. Um relógio mantido por sete instruções espalhadas não serve de base para uma coluna que
alguém olha.

## Decisão

O relógio de atualização é do banco. Uma função em `plpgsql` atribui `now()` à coluna, e um gatilho
`before update` por tabela a chama, nas seis. As sete escritas à mão saem do código, e com elas os
comentários que as justificavam.

`ocorrencias.atualizada_em` fica de fora, por nome. Ela responde outra pergunta: houve atividade nesta
ocorrência, o que inclui uma mensagem nova numa tabela vizinha. Quem a escreve é o agregado, com o
instante do comando, e a semente de demonstração depende disso para montar um mundo com datas antigas.

`vinculos` ganha a coluna anulável, sem valor padrão. Nulo quer dizer que nenhuma alteração foi
registrada, e a tela mostra um traço. Preencher as linhas existentes com a data de entrada seria mostrar
a criação vestida de atualização, que é o defeito que a coluna existe para não ter.

O gatilho de `pessoas` é o único com guarda. A resolução do primeiro login grava a mesma linha de volta,
por meio de um `on conflict do update` cujo único papel é devolver a linha que já existia. Sem a guarda,
entrar no sistema carimbaria a pessoa, e a coluna da tela passaria a responder quando foi o último
acesso. Os outros cinco gatilhos não têm guarda, e isso também é decidido: a tela de editar participante
manda a unidade em todo salvamento, então a linha de vínculo é reescrita com o mesmo valor quando só os
contatos mudam, e uma guarda ali congelaria o relógio logo depois de uma edição de verdade. Quem garante
que não há carimbo à toa é a tela, que não envia requisição quando nada mudou.

A última atualização de um participante é a maior entre o relógio da pessoa e o do vínculo.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| A aplicação continua escrevendo o relógio | São sete lugares a lembrar, e o oitavo escritor esquece |
| Gatilho só nas três tabelas de que a coluna precisa | Deixaria dois regimes no mesmo esquema, sem nada que dissesse qual vale onde, e manteria aberta nas outras migrações a questão que a primeira abriu |
| Guarda de igualdade em todas as seis tabelas | Congela o relógio do vínculo no salvamento que muda só contatos, porque a linha é reescrita com a mesma unidade |
| Gatilho também no relógio de `ocorrencias` | Recusado por nome: carimbo de domínio, escrito pelo agregado com o instante do comando, e a semente depende dele |
| A coluna nova com valor padrão e sem nulos | Tornaria "nunca alterada" indistinguível de "criada agora", e a tela mostraria a entrada como se fosse alteração |
| Preencher as linhas existentes | Não há de onde tirar o valor, e o que houvesse seria a data de criação com outro nome |
| Registrar também quem alterou | O autor não tem como vir de um gatilho, e nenhuma tela mostra essa resposta hoje. O lugar dela é o histórico de alterações do vínculo, que não existe |

## Consequências

O esquema passa a ter uma segunda função, e com ela a segunda dependência de gatilho do repositório. A
primeira, que proíbe alterar a trilha de transições, continua como está.

Isto não contradiz a [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md). Aquela decisão
recusa o gatilho como mecanismo de captura do histórico, porque a diferença entre duas linhas nunca
produz a observação escrita por quem executou o comando, e ela própria abre a porta: auditoria genérica
pode ser acrescentada depois como defesa em profundidade, sem alterá-la. Este gatilho não captura
história: ele carimba um instante.

**O relógio da pessoa é global.** A tabela de pessoas não tem organização, então quem troca o próprio
nome, ou tem o nome trocado por quem gere outra organização, move a última atualização em toda
organização onde participa. É o desejado: o nome é o mesmo em todas elas, então a alteração muda de fato
o que cada uma vê. O custo é que a data aparece sem explicação, porque nenhuma tela mostra quem mexeu.

Uma chamada direta à API que mandasse apenas contatos não moveria relógio nenhum, porque contatos moram
numa terceira tabela. Nenhum caminho do produto manda esse corpo, e fica declarado em vez de escondido.

Na demonstração a coluna mostra o traço em todas as linhas, porque a semente só cria e nunca altera.
