---
title: "ADR-0023 · Uma réplica sempre de pé"
description: "Mínimo de uma réplica no Container Apps enquanto a avaliação durar, pago pelo crédito de estudante, e a esteira desativando a revisão anterior."
---

# ADR-0023 — Uma réplica fica sempre de pé enquanto a avaliação durar, paga pelo crédito de estudante

**Status:** Aceita · 05/10/2026 · Substitui parcialmente a [ADR-0004](0004-execucao-em-container-no-azure.md)

## Contexto

A [ADR-0004](0004-execucao-em-container-no-azure.md) escolheu o Container Apps pela franquia gratuita com
escala a zero. O preço declarado era a partida a frio: sem tráfego, a aplicação dorme cerca de cinco
minutos depois da última requisição, e a primeira chamada seguinte leva por volta de 20 segundos.

A mitigação era uma sonda no GitHub Actions, numa faixa agendada de dias úteis, das 9h às 18h, e numa
janela disparada à mão. As duas cobrem horário marcado. A avaliação não tem horário: ela começa quando o
trabalho é enviado, termina numa data que ninguém conhece, e acontece fora do expediente, à noite, de
madrugada e no fim de semana. A faixa cobre justamente as horas menos prováveis.

O crédito de estudante estava intacto, com US$ 100 e validade até agosto de 2027, numa assinatura com
limite de gasto, que desliga em vez de cobrar quando o crédito acaba.

Um teste ligou o mínimo de uma réplica por 3 h 47 min. A réplica ficou de pé o tempo
todo, inclusive por 2 h 15 min sem requisição nenhuma, e a resposta mais lenta do período levou 652 ms.
Sem tráfego, a CPU ficou em 0,13 mVCPU, abaixo do limite de 10 mVCPU que a plataforma usa para cobrar a
tarifa ociosa. O período inteiro coube na franquia.

## Decisão

| O quê | Como |
|---|---|
| Mínimo de réplicas | 1, do envio do trabalho até o fim da avaliação |
| Quem paga | a franquia mensal primeiro, o crédito de estudante depois |
| Revisão anterior | desativada pela esteira depois de cada entrega, quando não tem tráfego e segura réplica |
| Sonda de aquecimento | removida |

O mínimo mora na configuração do Container App e se ajusta por linha de comando. A entrega só troca a
imagem, e a revisão nova herda o mínimo que estiver valendo.

O passo novo da esteira roda depois da conferência de que a URL pública responde. Se a revisão nova não
responde, a anterior continua ativa e o caminho de volta segue como era.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter a faixa e a janela | Cobrem horário comercial em dias úteis, e a avaliação acontece fora dele |
| Estender a faixa para o dia inteiro | Uma chamada a cada cinco minutos gasta 288 minutos de Actions por dia e esgota a cota mensal do repositório privado em cerca de uma semana. É a mesma cota que mantém o banco acordado, e sem ela o banco pausa |
| Mínimo de uma réplica só no horário da faixa | Custa zero, mas exige ligar e desligar todo dia, e cobre o mesmo horário que a faixa já cobria |
| Manter a revisão anterior ativa | Preserva a volta instantânea, mas cada revisão velha com mínimo 1 segura uma réplica a mais e dobra o custo |

## Consequências

**O que se ganha**

- A partida a frio deixa de existir enquanto o mínimo valer. Quem abre a aplicação pela primeira vez, a
  qualquer hora, recebe a tela em menos de um segundo.
- A cota do Actions fica inteira para as rotinas que mantêm o banco acordado e copiam os dados.

**O que custa**

- Dinheiro do crédito. Uma réplica de 0,5 vCPU e 1 GiB usa a franquia mensal inteira em cerca de 100
  horas, pouco mais de quatro dias. Depois disso, na tarifa ociosa medida, custa US$ 0,0216 por hora:
  cerca de US$ 13 num mês inteiro, dentro de um crédito de US$ 100.
- Com limite de gasto, o crédito zerado desliga a assinatura e tira a aplicação do ar, sem fatura. Na
  taxa medida, isso levaria mais de seis meses.
- Voltar atrás deixa de ser um comando só. A revisão anterior fica guardada e desativada, e voltar é
  reativá-la e apontar o tráfego para ela, ainda sem reconstruir nada, mas com a partida dela no meio.
- Desligar o mínimo devolve o comportamento da ADR-0004 inteiro, partida a frio incluída, e sem sonda.

## Fontes

- [Billing in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/billing)
- [Scaling in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [Revisions in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
