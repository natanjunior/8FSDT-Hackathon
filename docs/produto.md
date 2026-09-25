---
title: "O produto"
description: "O que o Resolve Aí resolve, quem usa, o que cada perfil faz, o ciclo de vida da ocorrência, e o que está e o que não está nesta versão."
---

# O produto

O Resolve Aí registra e acompanha ocorrências de um lugar coletivo — um condomínio, uma empresa, um bairro
— até a resolução, com trilha auditável de cada mudança de estado.

## O problema

Hoje esse trabalho acontece em grupo de mensagens, e-mail e planilha. O pedido chega como texto solto,
alguém transcreve à mão, e é quando a ocorrência trava esperando por alguém que ela some: ninguém sabe em
que pé está, quem ficou de resolver, nem há quanto tempo parou. No fim do mês não existe um número sobre o
que aconteceu.

O produto troca isso por um registro com dono, estado e histórico. Quem abre acompanha sem precisar
perguntar; quem gere vê tudo numa lista só e responde pelos prazos; e cada mudança de estado fica gravada
com quem fez, quando e por quê.

## Quem usa

**Solicitante.** Mora, trabalha ou frequenta o lugar. Abre a ocorrência com foto e localização, acompanha
o andamento, conversa com quem gere e avalia a resolução.

**Gestor.** Responde pelo lugar: o síndico, o administrador, o responsável pela manutenção. Vê todas as
ocorrências, tria, define prioridade, atribui responsável, acompanha a execução e fecha.

**Encarregado.** Executa o trabalho: o zelador, o eletricista, a empresa terceirizada. Nesta versão ele
existe como cadastro e aparece como responsável; quem registra o andamento em nome dele é o Gestor.

**Uma pessoa pode pertencer a mais de uma organização**, com papel diferente em cada uma, e troca de
organização sem sair da sessão. Uma organização nunca vê o dado da outra.

## O que cada perfil faz

| O Solicitante | O Gestor |
|---|---|
| Cria conta e entra numa organização pelo código | Cria a organização e vira o primeiro Gestor |
| Registra a ocorrência com título, descrição, categoria, área e foto | Vê todas as ocorrências e filtra por categoria, estado e prioridade |
| Acompanha as próprias ocorrências e a linha do tempo de cada uma | Analisa, define prioridade e atribui um responsável |
| Conversa com o Gestor, dentro da ocorrência | Inicia o atendimento, pausa com motivo e retoma |
| Avalia a resolução, com nota e comentário | Registra a solução aplicada e resolve |
| | Cancela com motivo, e aprova quem pede para entrar |
| | Lê os indicadores no painel |

## O ciclo de vida da ocorrência

O Solicitante registra a ocorrência, que nasce `Aberta`. O Gestor a coloca `Em análise`, atribui um
responsável e inicia o atendimento; ao terminar, registra a solução aplicada e a marca como `Resolvida`. A
ocorrência pode ficar `Pausada` enquanto se espera por alguém, e pode terminar `Cancelada` enquanto o
trabalho não acabou.

O que governa esse caminho:

- **Só o Gestor move a ocorrência adiante.** O Solicitante acompanha, comenta, avalia e cancela a própria
  enquanto ninguém começou a atendê-la. Depois que o atendimento começa, cancelar é decisão do Gestor.
- **Pausar exige motivo**, escolhido numa lista curta: esperando resposta do Solicitante, esperando
  material, esperando autorização, esperando um terceiro. Retomar devolve a ocorrência ao estado em que ela
  estava antes da pausa.
- **Cancelar exige observação escrita**, e fica registrado como coisa diferente de resolver.
- **A avaliação é uma ação do Solicitante** sobre uma ocorrência já resolvida, com nota de 1 a 5 e
  comentário opcional. Ela não é uma etapa do caminho.
- **Toda mudança de estado grava um registro** com o estado anterior, o novo, a data e a hora, quem fez e a
  observação. O registro não se altera nem se apaga.
- **Não existe reabrir.** Problema que volta é ocorrência nova, ligada à original.

O desenho da máquina, a tabela de transições permitidas e quem pode executar cada uma estão em
[Domínio e regras](dominio.md), que é onde essa regra mora.

## O que o Gestor vê no painel

Três números no topo, numa tela só: o que está em aberto agora, o saldo do período e a mais velha em
aberto. Abaixo, sete quadros: entradas e saídas por mês, a idade do que está em aberto, o tempo de
resolução, o que se repete, o que está em aberto por categoria, o total por estado e a satisfação. Cada
quadro escreve a pergunta que responde.

O que eles respondem é o que não se sabe hoje: **o que está parado, onde o problema se repete, se a fila
cresce ou encolhe, e se quem abriu ficou satisfeito.**

O primeiro quadro mostra, mês a mês, quantas ocorrências foram registradas e quantas saíram, resolvidas
ou canceladas, e os números de cada mês ficam numa tabela ao alcance de um botão. Outro quadro mostra as
duplas de área e categoria que voltaram no período, porque é a combinação que aponta causa, e não a
contagem de cada dimensão em separado.

A média das avaliações vem vazia enquanto ninguém tiver avaliado. Ao lado dela o painel mostra quantas
ocorrências foram resolvidas e quantas dessas receberam nota, que é o que diz se a média tem base, e
embaixo quantas avaliações deram cada nota.

**O tempo de resolução é de calendário**: conta do registro até a resolução e inclui o período em que a
ocorrência ficou pausada. Pausar não melhora o número. O painel o resume em dois números por mês: a
mediana, que é o caso do meio, e o p90, que é o décimo pior atendimento.

**O painel conta também a idade do que está em aberto**, em faixas de dias, e aponta as cinco ocorrências
que esperam há mais tempo, com o link de cada uma. O tempo de resolução só existe depois que a ocorrência
acabou, e sem este quadro o painel melhoraria quando os casos difíceis fossem deixados de lado.

## O escopo desta versão

**Está entregue:** o ciclo de vida inteiro com trilha auditável, o registro com foto e localização, a
conversa dentro da ocorrência, a avaliação, o painel de indicadores, o cadastro de categorias,
áreas e pessoas, a entrada na organização por código com aprovação do Gestor, e várias organizações
isoladas na mesma instalação.

**Fora desta versão:**

- acesso próprio do Encarregado, e com ele a leitura sem rede, o reporte de execução e a recusa de
  atribuição;
- avisos automáticos de qualquer tipo — sem notificação, sem sino, sem alarme de ocorrência parada, sem
  e-mail ou mensagem;
- convite por link e página pública da organização;
- filtros rápidos salvos;
- aderir a uma ocorrência parecida em vez de abrir outra igual;
- nota interna entre Gestores;
- editar uma ocorrência depois de registrada, ou anexar uma foto depois do registro;
- uma visão única do Gestor atravessando as organizações em que ele atua: o produto opera sempre no
  escopo de uma, e trocar de organização é como se vê a outra.

**Nenhuma exigência do desafio ficou de fora.** O
[Atendimento ao enunciado](atendimento-ao-enunciado.md) mostra exigência por exigência onde cada uma é
cumprida.

## O que a solução promete, com número

| | O alvo |
|---|---|
| Isolamento entre organizações | Nenhuma consulta devolve dado de outra organização, verificado por teste automatizado |
| Auditabilidade | Toda transição grava os cinco campos, e é impossível mudar o estado sem gerar o registro |
| Escala | 50 organizações, 200 pessoas por organização, 2.000 ocorrências e 20 pessoas usando ao mesmo tempo |
| Desempenho | Resposta em até 1 segundo em 95% das requisições |
| Registro pelo celular | Menos de 1 minuto do toque no atalho à confirmação, com foto |
| Imagem | Uma por ocorrência, comprimida no próprio aparelho para no máximo 400 KB |
| Retenção | O histórico não expira |
| Dados pessoais | Foto e localização ficam dentro da organização, e excluir a conta preserva a trilha com o autor anonimizado |
