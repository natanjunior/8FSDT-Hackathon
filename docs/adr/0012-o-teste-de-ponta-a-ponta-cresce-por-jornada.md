---
title: "ADR-0012 · O teste de ponta a ponta cresce por jornada"
description: "A medição de cobertura mostrou que a maior superfície do produto não tinha prova de execução, e o teste de ponta a ponta passa a crescer por jornada de validação, com teto."
---

# ADR-0012 — O teste de ponta a ponta cresce por jornada de validação, com teto

**Status:** Aceita · 22/09/2026 · Parcialmente substituída pela
[ADR-0013](0013-o-teto-da-suite-de-ponta-a-ponta-passa-a-ser-medido.md) · Substitui parcialmente a
[ADR-0008](0008-a-suite-de-testes-segue-a-garantia.md)

## Contexto

A [ADR-0008](0008-a-suite-de-testes-segue-a-garantia.md) decidiu que existe um teste de ponta a ponta e
um só, e que ele *"não cresce: ganha asserção, nunca ganha arquivo"*. A decisão abriu uma exceção
estreita: *"Um segundo só entra se provar algo que o primeiro não pode, e isso quer dizer outro
transporte, e não outro fluxo."*

Ela também declarou o que estava aceitando perder: *"A camada de Interface fica praticamente sem
cobertura, e é o buraco desta decisão."* O argumento que sustentava o risco era que essa camada *"está
restrita a traduzir HTTP e validar formato"*.

Três coisas aconteceram desde então, e as três são medidas.

**A primeira é o tamanho do buraco.** A cobertura passou a ser medida, e o roteamento da aplicação marca
zero por cento de instruções executadas, em sessenta arquivos. Dentro deles estão a composição das
páginas, a escolha do rótulo por papel, o despacho de comando e as fronteiras de carregamento. Não é
tradução de HTTP: é a maior superfície do produto sem prova de execução. [Testes](../testes.md) traz o
número e a data.

**A segunda é que o único teste de ponta a ponta nunca tinha passado contra a pilha em contêiner.** Ele
morria no primeiro passo, e a causa só foi isolada agora: o cookie que guarda a organização ativa sai com
o atributo de transporte seguro, e o navegador o descarta sobre conexão simples quando o host não é
local. Enquanto essa falha existiu, qualquer discussão sobre quantos testes de ponta a ponta ter era
teórica, porque nenhum deles rodava.

**A terceira é o estado da conferência à mão.** O produto tem um roteiro de validação com nove partes, e
a maior parte dele nunca foi percorrida. A ADR-0008 apostou que a conferência humana cobriria o que o
desenho deixou sem teste. A aposta não se realizou, e faltam sete dias para a entrega.

## Decisão

**O teste de ponta a ponta cresce por jornada do roteiro de validação, com teto de seis arquivos nesta
entrega.** Uma jornada é um percurso contínuo que um ator faz de ponta a ponta, e não uma tela nem um
item do backlog.

Quatro regras fixam o que isso significa.

**O teto é parte da decisão.** Seis arquivos, e o sétimo exige registro novo. Sem teto, esta decisão
vira a pirâmide que a ADR-0008 recusou com razão.

**Os localizadores compartilhados moram num módulo só.** Uma troca de rótulo passa a ser uma edição, e
não seis. Sem isso o custo de manutenção multiplica pelo número de arquivos, que é o mecanismo pelo qual
uma suíte de ponta a ponta é abandonada.

**Cada arquivo declara no cabeçalho quem é dono do mundo que ele usa.** Um teste acrescenta ao mundo
compartilhado e nunca o altera, que é a regra que [Testes](../testes.md) já descreve. Quem precisa
alterar cria o próprio mundo e diz por quê.

**Nada disso entra no portão.** A verificação de cada envio continua sem navegador, e a execução continua
sendo pedida à mão contra a pilha local. A ausência de repetição automática e o trabalhador único também
ficam, porque os arquivos dividem o mesmo mundo semeado.

O que a ADR-0008 decidiu fora disso continua valendo inteiro: o agregado exaustivo em memória, uma prova
por garantia estrutural, e a recusa de um teste de integração por endereço da API.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter um arquivo só, e acrescentar asserções | Os mundos são diferentes, e um arquivo teria de escolher um: a recuperação de senha vive noutro host por causa do endereço que o provedor escreve no e-mail, dois percursos precisam de organização própria e dois precisam da semente. Além disso, uma execução de quatro minutos em que o primeiro vermelho cega os noventa por cento seguintes é pior do que seis execuções curtas |
| Um arquivo por atividade do escopo | É o que a ADR-0008 rejeitou por nome, e a recusa continua de pé. Seis jornadas não são trinta e nove itens |
| Cobrir o roteamento com teste de unidade de componente | Mediria a montagem de cada peça sem provar que elas se falam. O que falta prova é a fiação entre camadas, e ela só aparece de fora |
| Nenhum teste novo, e confiar na conferência à mão | É a aposta da ADR-0008, e ela foi feita quando havia cinco semanas. Com sete dias, a conferência à mão cobre menos ainda do que cobriu |

## Consequências

**O que se ganha**

- A maior superfície sem prova de execução passa a ter prova, e ela roda de fora, pelo caminho do produto.
- Quarenta e dois critérios do roteiro saem da fila da conferência à mão.
- O que sobra na fila fica nomeado, com o motivo de cada item: entrega de e-mail real, aparelho celular,
  painel do provedor, e o julgamento visual que não vira asserção.

**O que custa, e os números são medidos**

- **O artefato mais lento do projeto passa de vinte e três segundos para cerca de quatro minutos**, e de
  um arquivo para seis.
- **A manutenção tem taxa conhecida:** o único teste de ponta a ponta foi reescrito por seis itens de
  produto num sprint. Com seis arquivos, a mesma taxa multiplica, e o módulo compartilhado de
  localizadores é o que decide se o multiplicador fica perto de um ou perto de seis.
- **Nenhum deles roda sozinho.** Continuam dependendo da pilha local de pé e da semente aplicada. Se
  ninguém os executar, eles nunca executaram.
- Um dos seis só roda na máquina de quem desenvolve, porque lê a caixa de e-mail local que a esteira não
  sobe.
