---
title: "ADR-0008 · A suíte segue a garantia"
description: "A quantidade de teste segue a natureza do que ele protege, e não o nível de uma pirâmide."
---

# ADR-0008 — A suíte de testes segue onde mora a garantia, não a pirâmide

**Status:** Aceita · 22/08/2026 · Parcialmente substituída pela
[ADR-0012](0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md) · Complementa a
[ADR-0005](0005-regra-de-dependencia-por-inversao.md), que é o que a tornou possível

## Contexto

O esqueleto da aplicação estabeleceu a realidade de testes do projeto sem tê-la desenhado, e os quarenta
itens seguintes de trabalho carregam testes cada um. O que estiver decidido agora é herdado quarenta
vezes.

Três restrições moldam a decisão, e nenhuma delas é sobre teste. Há um implementador, prazo curto e
nenhuma revisão de código por pares. A maior parte da regra está num agregado testável em memória em
milissegundos, porque a [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) a pôs lá. E
três garantias do projeto já são estruturais, e não processuais: só o agregado escreve o estado, o escopo
é aplicado numa função só, e a camada interna não tem o que importar.

## Decisão

**A quantidade de teste segue a natureza da garantia que ele protege.** São três grupos, e o que os separa
é a regra de crescimento:

| Grupo | O que protege | Como cresce |
|---|---|---|
| O agregado, exaustivo, em memória | a máquina de estados e a invariante de auditoria | **por caso**, e é onde o volume vai, porque é combinatório e custa milissegundos |
| Uma prova por garantia estrutural | o ponto único de escopo, a substituição do repositório pela porta, as invariantes do esquema | **não cresce com funcionalidade**; cresce com migração nova e com porta nova |
| Um teste de ponta a ponta | que as camadas, o artefato publicado, a autenticação real e o navegador se falam | **não cresce**: ganha asserção, nunca ganha arquivo |

Três consequências fixam o que isso significa.

**Existe um teste de ponta a ponta, e um só.** O que ele prova é binário: ou as camadas se falam, ou não.
Ele percorre o caminho crítico do desafio, de registrar a avaliar, com o histórico conferido na interface,
mais uma asserção que troca de organização no meio do percurso. Um segundo só entra se provar algo que o
primeiro não pode, e isso quer dizer outro transporte, e não outro fluxo.

**Ele não é portão por envio.** Roda contra a pilha em contêiner, a mesma que a conteinerização exige, e
acrescenta zero segundo à verificação de cada envio.

**Não há teste de integração por endereço da API.** São dezenas, e um teste por endereço seria o maior
artefato do projeto e testaria sobretudo o framework. O que tem teste de integração é a consulta escopada,
porque é ela que carrega o risco, por uma suíte compartilhada que [Testes](../testes.md) descreve.

O que decidiu contra a pirâmide: ela pressupõe uma equipe com revisão por pares e a regra espalhada por
várias camadas. Aqui a regra está concentrada num agregado, e uma garantia estrutural não precisa de um
teste por instância, e sim de um teste que prove que a estrutura vale. O escopo é aplicado numa função só,
e um teste de vazamento por consulta testaria a mesma função dezenas de vezes.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| A pirâmide clássica, com faixa de integração larga | Produziria uma faixa média grande testando o framework. É a herança por hábito que a [ADR-0006](0006-organizacao-de-modulos.md) já recusou uma vez |
| Um teste de ponta a ponta por atividade do escopo | Multiplica por quatro o artefato mais lento e mais frágil para provar quatro vezes a mesma coisa. Com um implementador, esteira vermelha por motivo que não é defeito é abandonada, e não consertada |
| O teste de ponta a ponta contra o ambiente publicado | Há um ambiente só. O teste escreveria dado de teste onde a revisão funcional acontece, e a partida a frio produziria falha que não é defeito |
| O teste de ponta a ponta com a autenticação trocada por uma porta falsa | É o mais fácil de todos, e seria um caminho de produção existente só para teste, ligado por variável de ambiente. Variável que finge autenticação é a pior de todas para existir numa imagem pública. A autenticação real é a única coisa que esse teste prova e que nenhum outro alcança |
| Meta de cobertura em porcentagem | Mede linha executada, e não garantia protegida. Premiaria testar projeção e rota, que é onde o desenho proíbe que haja regra |

## Consequências

**O que se ganha**

- O custo por tarefa é um arquivo curto ou nenhum.
- A verificação de cada envio continua em torno de um minuto, porque nada do que é caro entrou nela.
- O portão do isolamento deixa de depender de alguém reescrever o cenário, que é a forma pela qual um
  portão passa a ser marcado sem ser cumprido.

**O que custa**

- **A camada de Interface fica praticamente sem cobertura**, e é o buraco desta decisão. O que o limita é
  desenho: essa camada traduz HTTP e valida formato, e nada mais.
- **Um defeito de integração entre duas camadas pode chegar até o teste de ponta a ponta.** É o preço de
  não haver faixa média. O que o reduz é que as fronteiras entre camadas aqui são poucas e declaradas.
- **O teste de ponta a ponta só pôde existir quando o caminho crítico existiu**, porque o último elo do
  percurso é avaliar.
