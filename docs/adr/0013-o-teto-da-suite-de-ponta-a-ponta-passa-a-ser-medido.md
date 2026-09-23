---
title: "ADR-0013 · O teto da suíte de ponta a ponta passa a ser medido"
description: "O teto de seis arquivos saiu do tamanho de uma lista e não de uma medição; com a capacidade e a cobertura medidas, ele sobe para sete e ganha a regra que diz quando parar."
---

# ADR-0013 — O teto da suíte de ponta a ponta sobe para sete, e passa a ter origem medida

**Status:** Aceita · 22/09/2026 · Substitui parcialmente a
[ADR-0012](0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md)

## Contexto

A [ADR-0012](0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md) foi aceita no mesmo dia que esta, e
fixou que a suíte de ponta a ponta cresce por jornada com teto de seis arquivos. O teto existia para que
a decisão não virasse a pirâmide que a [ADR-0008](0008-a-suite-de-testes-segue-a-garantia.md) recusou.

**O número seis veio do tamanho da lista que estava sobre a mesa, e não de uma medição.** Quem escreveu a
decisão não tinha, naquele momento, nenhum dado sobre quanto custa escrever um desses arquivos nem sobre
quanto a suíte demora com eles dentro. Subir um teto no dia seguinte ao de fixá-lo é o tipo de gesto que
esvazia tetos, e esta decisão só se sustenta porque o que mudou foram dois números que antes não
existiam.

**A capacidade, medida na execução do lote.** Os seis arquivos foram escritos numa corrida de cento e
seis minutos, com a verificação completa rodada depois de cada um e verde em todas. A suíte inteira
executa em dois minutos e trinta e seis segundos, contra os quatro minutos que a decisão anterior
estimou. O arquivo mais longo levou quarenta e seis segundos, contra um limite de cento e oitenta por
teste.

**A cobertura, medida contra o roteiro de validação.** Os seis arquivos fecham noventa e cinco dos cento
e setenta e três itens que o roteiro enumera. Dos setenta e oito que sobram, vinte e um estão fora de
alcance por decisão já registrada, e **trinta e nove estão concentrados num trecho só**: o percurso de
registrar, listar e conduzir uma ocorrência. É o trecho que o teste do caminho crítico atravessa pelo
caminho feliz, sem afirmar nada sobre o que está em volta.

## Decisão

**O teto sobe de seis para sete arquivos**, e o sétimo é o que cobre aquele trecho concentrado.

**O teto deixa de ser um número escolhido e passa a sair de duas medições**, que são as que dizem quando
ele para de subir:

| O que mede | Onde está hoje | Quando o teto para |
|---|---|---|
| O tempo da suíte inteira | dois minutos e trinta e seis segundos | ao passar de dez minutos, porque acima disso ela deixa de ser rodada antes de abrir um pedido |
| A taxa de reescrita | seis itens de produto reescreveram um arquivo num sprint | ao ser remedida e vir maior, porque é ela que decide se a manutenção cabe |

**Quem propuser o oitavo traz as duas medições refeitas.** Sem elas, o teto vale como está. Esta é a parte
da decisão que impede que a próxima subida use o argumento que esta usou.

O que a ADR-0012 decidiu fora do número continua valendo inteiro: crescer por jornada e nunca por tela,
os localizadores compartilhados num módulo só, o dono do mundo declarado por arquivo, e nada disso dentro
do portão de cada envio.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Acrescentar as asserções ao teste do caminho crítico | Ele responde uma pergunta binária: as camadas se falam. Enchê-lo de afirmação sobre rótulo faria uma troca de palavra numa tela quebrar o teste mais importante do projeto, por motivo que não é defeito. O teto ficaria intocado e o custo apareceria noutro lugar |
| Acrescentar ao arquivo das interrupções, que já visita as mesmas telas | Produziria um arquivo de cerca de setecentas e cinquenta linhas e cento e cinquenta segundos, com o primeiro vermelho cegando o resto. É a alternativa que a ADR-0012 recusou por nome quando recusou o arquivo único |
| Deixar como está | Trinta e nove itens ficariam sem prova num trecho só, e a máquina que os cobriria já está construída e paga. O custo de não fazer é maior que o de fazer |
| Tirar o teto | Sem teto, a decisão de crescer por jornada vira a pirâmide clássica em dois sprints. O teto é o que a separa dela |

## Consequências

**O que se ganha**

- A cobertura do roteiro passa de noventa e cinco para cento e trinta e um dos cento e setenta e três
  itens. O que sobra fica quase inteiramente no que já está declarado como conferência humana.
- O trecho com mais itens sem prova deixa de ser o trecho que parecia coberto por ser atravessado.

**O que custa**

- **A suíte passa de dois minutos e meio para dois minutos e cinquenta e quatro segundos**, medidos com o
  sétimo arquivo dentro. A estimativa feita antes de escrevê-lo falava em quatro a cinco minutos, e errou
  para cima: o arquivo fechou em trinta e três segundos contra os noventa a cento e vinte previstos. O
  limite de dez minutos que faz o teto parar de subir continua distante.
- **Um teto subiu no dia seguinte ao de nascer**, e isso fica no registro. A defesa é que ele subiu com
  medição e ganhou a regra que exige medição da próxima vez; a acusação é que um teto que se move é mais
  fraco que um que não se move, e ela é justa.
- Seis itens do roteiro continuam sem prova mesmo com o sétimo arquivo, porque alcançá-los exigiria
  repetir a espinha do caminho crítico.
