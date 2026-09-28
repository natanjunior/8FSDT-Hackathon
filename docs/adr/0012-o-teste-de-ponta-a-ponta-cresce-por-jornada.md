---
title: "ADR-0012 · O teste de ponta a ponta cresce por jornada"
description: "A maior superfície do produto não tinha prova de execução; o teste de ponta a ponta passa a crescer por jornada de validação, com teto medido e a regra que diz quando ele para de subir."
---

# ADR-0012 — O teste de ponta a ponta cresce por jornada de validação, com teto medido

**Status:** Aceita · 22/09/2026 · Substitui parcialmente a
[ADR-0008](0008-a-suite-de-testes-segue-a-garantia.md)

## Contexto

A [ADR-0008](0008-a-suite-de-testes-segue-a-garantia.md) decidiu que existe um teste de ponta a ponta e um
só, e declarou o que estava aceitando perder: *"a camada de Interface fica praticamente sem cobertura, e é
o buraco desta decisão"*. O argumento que sustentava o risco era que essa camada *"está restrita a
traduzir HTTP e validar formato"*.

Três coisas aconteceram desde então, e as três são medidas.

**O buraco é maior do que o argumento supunha.** A cobertura passou a ser medida, e o roteamento da
aplicação marca 0% de instruções executadas, em 60 arquivos. Dentro deles estão a composição das páginas,
a escolha do rótulo por papel, o despacho de comando e as fronteiras de carregamento. Não é tradução de
HTTP: é a maior superfície do produto sem prova de execução.

**O único teste de ponta a ponta nunca tinha passado contra a pilha em contêiner.** Ele morria no primeiro
passo, por um cookie de sessão que o navegador descartava fora de `localhost`. Enquanto essa falha
existiu, discutir quantos testes ter era teórico, porque nenhum deles rodava.

**A conferência à mão não aconteceu.** O roteiro de validação tem 173 itens, e a maior parte nunca foi
percorrida. A ADR-0008 apostou que a conferência humana cobriria o que o desenho deixou sem teste, e a
aposta não se realizou.

## Decisão

**O teste de ponta a ponta cresce por jornada do roteiro de validação, com teto de 7 arquivos.** Uma
jornada é um percurso contínuo que um ator faz de ponta a ponta, e não uma tela nem um item do backlog.

**O teto sai de duas medições, e são elas que dizem quando ele para de subir:**

| O que mede | Onde está hoje | Quando o teto para |
|---|---|---|
| O tempo da suíte inteira | 2 min 54 s | ao passar de 10 minutos, porque acima disso ela deixa de ser rodada antes de abrir um pedido |
| A taxa de reescrita | 6 itens de produto reescreveram um arquivo num sprint | ao ser remedida e vir maior, porque é ela que decide se a manutenção cabe |

**Quem propuser o oitavo arquivo traz as duas medições refeitas.** Sem elas, o teto vale como está — e é
isso que separa esta decisão da pirâmide que a ADR-0008 recusou com razão.

Três regras completam o desenho.

**Os localizadores compartilhados moram num módulo só.** Uma troca de rótulo passa a ser uma edição, e não
sete. Sem isso a manutenção multiplica pelo número de arquivos, que é o mecanismo pelo qual uma suíte de
ponta a ponta é abandonada.

**Cada arquivo declara no cabeçalho quem é dono do mundo que ele usa.** Um teste acrescenta ao mundo
compartilhado e nunca o altera, que é a regra que [Testes](../testes.md) já descreve.

**Nada disso entra no portão.** A verificação de cada envio continua sem navegador, e a execução continua
sendo pedida à mão contra a pilha local.

O que a ADR-0008 decidiu fora disso continua valendo inteiro: o agregado exaustivo em memória, uma prova
por garantia estrutural, e a recusa de um teste de integração por endereço da API.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter um arquivo só, e acrescentar asserções | Os mundos são diferentes: a recuperação de senha vive noutro host, dois percursos precisam de organização própria e dois precisam da semente. E uma execução longa em que o primeiro vermelho cega o resto é pior que sete curtas |
| Um arquivo por atividade do escopo | É o que a ADR-0008 rejeitou por nome, e a recusa continua de pé. 7 jornadas não são 39 itens |
| Encher o teste do caminho crítico | Ele responde uma pergunta binária: as camadas se falam. Enchê-lo faria uma troca de palavra numa tela quebrar o teste mais importante do projeto, por motivo que não é defeito |
| Cobrir o roteamento com teste de unidade de componente | Mediria a montagem de cada peça sem provar que elas se falam. O que falta prova é a fiação entre camadas, e ela só aparece de fora |
| Tirar o teto | Sem teto, crescer por jornada vira a pirâmide clássica em dois sprints. O teto é o que separa as duas |

## Consequências

**O que se ganha**

- A maior superfície sem prova de execução passa a ter prova, e ela roda de fora, pelo caminho do produto.
- A cobertura do roteiro vai a 131 dos 173 itens. Dos 42 que sobram, 21 estão fora de alcance por decisão
  já registrada, e o resto fica nomeado: e-mail real, aparelho celular, painel do provedor, e o
  julgamento visual que não vira asserção.

**O que custa, e os números são medidos**

- **O artefato mais lento do projeto passa de 23 s para 2 min 54 s**, e de 1 arquivo para 7. O mais longo
  leva 46 s, contra um limite de 180 s por teste.
- **A manutenção tem taxa conhecida**, e o módulo de localizadores decide o multiplicador.
- **Nenhum deles roda sozinho**, e continuam dependendo da pilha local de pé e da semente aplicada. Um dos
  7 só roda na máquina de quem desenvolve, porque lê a caixa de e-mail local que a esteira não sobe.
- 6 itens do roteiro continuam sem prova, porque alcançá-los exigiria repetir a espinha do caminho crítico.
