---
title: "Glossário"
description: "A linguagem do produto: uma definição por termo, e o que não confundir com o quê."
---

# Glossário

Uma definição por termo. Onde uma palavra carregava dois sentidos, ela foi quebrada em termos distintos,
cada um com definição própria. Estas palavras viram nome de tabela, de endereço da API e de classe, e é
por isso que elas são fixadas aqui.

Atores são nomeados por função, e nunca por nome próprio.

## Quem é quem

| Termo | Definição | Não confundir com |
|---|---|---|
| Pessoa | O ser humano no sistema: nome e contato. Existe mesmo sem conseguir entrar | Usuário |
| Usuário | A credencial de acesso de uma Pessoa. Uma Pessoa tem zero ou um | Pessoa |
| Vínculo | A ligação entre uma Pessoa, um Papel e uma Organização. A mesma Pessoa pode ter vários, com papéis diferentes | Papel, que o vínculo carrega |
| Papel | O que a Pessoa é dentro de uma Organização: Solicitante, Gestor ou Encarregado | Permissão, que é o que o papel autoriza |
| Solicitante | Papel de quem registra e acompanha ocorrências | — |
| Gestor | Papel de quem tria, conduz e encerra as ocorrências da Organização | Encarregado |
| Encarregado | Papel de quem executa o trabalho: zelador, técnico, prestador. Nesta versão existe como cadastro, sem acesso próprio | Responsável, que é a atribuição e não o papel |
| Responsável | A Pessoa designada para resolver uma ocorrência. É uma relação, e alcança qualquer Pessoa com vínculo | Encarregado; e o autor da transição, que é quem executou o comando |
| Pedido de entrada | A solicitação de uma Pessoa para se vincular a uma Organização, apresentando o Código, e que aguarda decisão do Gestor | Vínculo, que só passa a existir depois da aprovação |

## O lugar

| Termo | Definição | Não confundir com |
|---|---|---|
| Organização | O condomínio, a empresa ou o bairro que usa o produto. É o limite de isolamento de dados | Área |
| Organização ativa | A Organização pela qual a sessão está enxergando agora. Quem tem vários vínculos tem uma de cada vez, e trocar é operação explícita | Vínculo, que é o conjunto de todas |
| Código da Organização | Identificador público que permite pedir entrada. Vive em cartaz, mensagem ou etiqueta | — |
| Área | Uma subdivisão da Organização: bloco B, garagem, apartamento 302. Tem um tipo, comum ou privativa | Localização, que aponta para uma Área |
| Localização | Onde dentro da Organização a ocorrência aconteceu: uma Área mais um complemento em texto | Geolocalização: não há mapa nem coordenada |
| Categoria | A natureza da ocorrência: iluminação, vazamento, limpeza. Configurável por Organização | Prioridade: a categoria é o que é, a prioridade é quanto corre |

## A ocorrência

| Termo | Definição | Não confundir com |
|---|---|---|
| Ocorrência | O problema registrado por um Solicitante e acompanhado até a resolução. É o objeto central | chamado, ticket ou demanda, que não são termos do produto |
| Anexo | A evidência que acompanha a ocorrência. Nesta versão é uma foto, enviada no registro | Solução aplicada; Comentário |
| Prioridade | O quanto a ocorrência corre, definida pelo Gestor. Nasce normal, e muda enquanto a ocorrência não terminou | Categoria |
| Solução aplicada | O registro do que foi feito para resolver, escrito pelo Gestor | Observação, que justifica uma mudança de estado |
| Avaliação | A nota de 1 a 5 que o autor dá à resolução, depois de a ocorrência estar `Resolvida`. Não é um estado | `Em análise`, que é o estado em que o Gestor avalia a ocorrência |
| Comentário | A conversa dentro da ocorrência, entre quem abriu e quem gere | Observação; Solução aplicada |

## O ciclo de vida

| Termo | Definição | Não confundir com |
|---|---|---|
| Status | O ponto do ciclo de vida em que a ocorrência está | "estado": o produto usa Status como termo único |
| `Aberta` | Registrada e ainda não analisada | — |
| `Em análise` | O Gestor está avaliando a ocorrência | Avaliação, que é do Solicitante |
| `Em atendimento` | O trabalho está em execução | `Pausada` |
| `Pausada` | Parada esperando alguém, com motivo obrigatório. Ao retomar, volta ao estado anterior | `Cancelada`, que é terminal |
| `Resolvida` | O Gestor conferiu e declarou concluída. Terminal | `Cancelada` |
| `Cancelada` | Encerrada sem solução, com motivo obrigatório. Terminal | `Resolvida` |
| `Em aberto` | O conjunto dos quatro status não terminais: `Aberta`, `Em análise`, `Em atendimento` e `Pausada`. É o que o painel conta por categoria | `Aberta`, que é um dos quatro |
| Transição | A operação de negócio que muda o status, e que só acontece por comando nomeado | "atualizar o campo status", que não existe |
| Registro de transição | O registro imutável de cada transição, com os cinco campos: status anterior, novo status, data e hora, quem fez, e observação | Trilha de auditoria, que é o conjunto deles |
| Observação | O texto que quem executa a transição escreve no momento do comando, explicando o porquê | Comentário; Solução aplicada |
| Trilha de auditoria | A sequência completa e imutável dos registros de transição de uma ocorrência | Linha do tempo |
| Linha do tempo | A leitura que quem abriu consulta ao acompanhar: transições, atribuições e mensagens, em linguagem de gente | Trilha de auditoria, que é a fonte e mostra os campos crus |
| Rótulo | O texto mostrado para um status, que depende de quem lê. Calculado no servidor | Os nomes dos estados, que não mudam |

## Medição

| Termo | Definição | Não confundir com |
|---|---|---|
| Tempo de resolução | Do registro até a resolução, em tempo de calendário, incluindo o período pausado | Tempo de trabalho, que descontaria as pausas e não é o que o painel mostra |
| Mediana e p90 | Os dois números com que o painel resume o tempo de resolução de um mês: a mediana é o caso do meio, e o p90 é o décimo pior atendimento | Média, que a cauda longa dos casos arrastados puxa para cima do caso típico |
| Recorrência | Volume de ocorrências por Categoria e por Área ao longo do tempo. É o que distingue oito chamados avulsos de uma obra que falta | Duplicidade, que é o mesmo problema relatado duas vezes |
