---
title: "Testes"
description: "O que cada tipo de teste protege, a suíte que impede o vazamento entre organizações, os verificadores que rodam sobre a documentação e o portão que bloqueia a entrega."
---

# Testes

A suíte é organizada pelo que cada tipo **protege**, e não por meta de cobertura. A consequência é que o
volume se concentra onde a garantia é frágil, e quase não existe onde ela é estrutural.

## O que cada tipo protege

| Tipo | O que protege | Ferramenta | Precisa de banco |
|---|---|---|---|
| Unitário de domínio | a máquina de estados e a invariante de auditoria: transição ilegal é recusada, e toda transição legal gera exatamente um registro | Vitest | não |
| Unitário de aplicação | a autorização por comando, e as duas regras que atravessam outra tabela e por isso não cabem na entidade | Vitest | não, com o repositório substituído pela porta que a aplicação declara |
| Unitário de interface | os esquemas de validação da borda HTTP, antes de qualquer regra rodar | Vitest | não |
| Unitário de infraestrutura | a camada de tradução do provedor de autenticação, com o SDK simulado | Vitest | não |
| Integração de repositório | o isolamento entre organizações: consulta feita em nome de uma nunca devolve linha de outra | Vitest com o PostgreSQL da CLI do Supabase | sim |
| Ponta a ponta | as jornadas do produto num navegador, com autenticação real: o caminho crítico, o nascimento de uma organização, as interrupções de uma ocorrência, a configuração, a recuperação de senha e o painel | Playwright | sim, com a pilha de pé e a semente aplicada |

As duas primeiras linhas crescem por caso, e é onde o volume vai. A de integração cresce por consulta
nova, e não por arquivo. A de ponta a ponta cresce **por jornada**, com teto de seis arquivos, e cada
arquivo declara quem é dono do mundo que ele usa. A regra anterior mandava que ela nunca crescesse, e o
que a mudou foi medição: a [ADR-0012](adr/0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md) registra o
número que a derrubou e o custo que ela cobra.

## O que a suíte alcança

A cobertura é medida para informar. Não há limite mínimo, `npm run verificar` não a consulta, e nenhum
número desta seção reprova uma mesclagem. O que ela responde é onde a suíte chega e onde não chega.

**Data da medição:** 22/09/2026, por `npm run cobertura`, que roda os testes unitários e os de
integração numa execução só e exige um PostgreSQL de pé.

| Recorte | Arquivos | Instruções cobertas |
|---|---|---|
| O núcleo: domínio, aplicação, esquemas, projeções e infraestrutura | 109 | **91,2%** |
| A borda HTTP | 11 | 37,8% |
| A camada de interface: componentes e ganchos | 100 | 29,2% |
| O roteamento em `app/` | 60 | 0,0% |
| Todo o produto | 282 | **46,8%** |

Os recortes repetem em número a forma que a [ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md)
desenhou antes de qualquer medição existir. O que cresce por caso passa de 90%. O que aquela decisão
declarou como o buraco que ela abria, a camada de interface, fica abaixo de 30%.

**O roteamento marca zero porque nada nesta medição o executa.** As páginas e as rotas de `app/` são
percorridas apenas pelo teste de ponta a ponta, que roda em outro programa e fora desta contagem. O zero
diz que a instrumentação não passou por ali, e não que aquele código nunca rodou.

Ficam de fora da conta os componentes gerados pela biblioteca de interface, a ligação com o motor da
documentação, os arquivos de estrutura do roteamento e a semente de demonstração: código que o projeto
não escreveu, ou que não carrega regra.

Um número sem data envelhece sem avisar. Este é remedido quando o pacote da entrega fecha, junto das
outras medidas feitas à mão.

## O isolamento tem suíte própria

O portão que exige que uma organização não veja o dado de outra é cobrado toda vez que uma tarefa toca
consulta, e são muitas. Se cumpri-lo custasse remontar o cenário, ele passaria a ser marcado sem ser
cumprido, que é pior do que não existir.

Então ele é uma suíte compartilhada, aplicada a cada consulta. Ela recebe três coisas:

| O que a consulta declara | Forma |
|---|---|
| como chamá-la já escopada | uma função que recebe o identificador da organização |
| como ler a organização de uma linha do resultado | uma função que lê a linha |
| o que precisa existir nas duas organizações | a semente do próprio agregado |

E gera sempre os mesmos casos: escopada em uma devolve só a dela, escopada na outra não contém nada da
primeira, e toda linha devolvida carrega a organização pedida. **O custo de uma consulta nova é uma
entrada.**

A armadilha que a suíte precisa preservar é o que decide a forma dela. Semear pessoas distintas por
organização não detecta o erro, porque o vazamento aparece quando a pessoa é comum às duas e a consulta
parte dela. Por isso a suíte é dona das pessoas e das organizações, e cada entrada semeia apenas o próprio
agregado. Uma entrada que criasse a própria pessoa passaria no teste sem exercer a razão de ele existir.

As duas escritas que acontecem fora do funil de escopo não são alcançadas por essa suíte, porque ela
pergunta o que uma consulta devolve. São caso escrito à mão, e são duas para sempre, pela mesma lista
fechada que [Segurança](seguranca.md) descreve.

## O cenário de teste tem dono

Há dois mundos de teste em duas linguagens: linhas de SQL na integração, e objetos em memória na camada de
aplicação. **O mundo é declarado uma vez e escrito nas duas**: duas organizações, a mesma pessoa vinculada
às duas com papéis diferentes, e uma pessoa em só uma delas. É o cenário do síndico profissional, e é o
único que detecta o vazamento.

A regra que impede a divergência: um teste pode acrescentar ao mundo, e nunca alterá-lo. Precisa de uma
área a mais, acrescenta; precisa de uma terceira organização, monta o seu mundo à parte e diz por quê.
Alterar o mundo compartilhado é o caminho pelo qual o ajuste de um teste desarma, sem ninguém perceber, a
armadilha que outro teste existe para acionar.

## Os verificadores

Seis programas conferem o que teste de código não alcança, e todos rodam na esteira.

| Verificador | O que recusa |
|---|---|
| Diagramas | bloco Mermaid que não compila em nenhum arquivo do repositório |
| Contrato | divergência entre a especificação executável e as rotas que a realizam, operação por operação |
| Links e referências | link relativo que não resolve e referência a seção que não existe |
| Tom | os padrões de densidade, de aparato e de estrutura que a reescrita removeu, nos arquivos já reescritos |
| Site publicado | link quebrado, diagrama que não desenhou, busca sem resultado e título repetido, no site de verdade |
| Imagem | segredo assado em qualquer camada da imagem, lido do histórico de construção |

Outros dois olham para a nuvem, e não para o repositório. Um compara a configuração de autenticação
publicada com o que o repositório declara, porque a esteira publica migração e imagem, e nunca
configuração. O outro confere, antes de cada implantação, que toda variável de execução declarada existe
no serviço — uma variável declarada e nunca publicada deixou o envio de imagens quebrado por semanas sem
que nada acusasse.

**Todo verificador prova que discrimina.** Cada um carrega um par de controles: um conteúdo que precisa ser
recusado e outro, equivalente, que precisa passar. Um verificador que aceitasse tudo passaria por bom até
o dia em que precisasse pegar alguma coisa, e o controle negativo é o que impede isso. O verificador do
site, por exemplo, exige que uma página inexistente responda `404`, porque sem isso um link quebrado seria
invisível para ele.

## Como rodar

```
npm run verificar             lint, tipos, testes unitários e verificadores de documentação
npm run teste                 só os unitários, que é o laço curto de quem implementa
npm run teste:integracao      a suíte de isolamento; exige um PostgreSQL
npm run teste:ponta-a-ponta   as jornadas num navegador; exige a pilha, a semente e SENHA_DA_DEMONSTRACAO
npm run cobertura             o número da seção acima; roda os dois primeiros juntos
npm run local                 sobe a pilha inteira em contêiner, para os dois de cima
```

Os dois últimos precisam do ambiente local, que [Infraestrutura](infraestrutura.md) descreve. O teste de
integração derruba e recria o esquema a cada execução, e por isso ele usa um banco separado do de
desenvolvimento, criado pelo próprio `npm run local`.

## O portão

`npm run verificar` é o que quem implementa roda antes de abrir um pull request, e é o mesmo conjunto que
a esteira roda a cada envio. Falha bloqueia a mesclagem.

Além dele, a esteira sobe a pilha inteira do zero num servidor limpo, roda o teste de integração contra um
PostgreSQL de verdade, constrói a imagem, confere que ela não carrega segredo e, depois de publicar,
executa o verificador de site contra a URL que está no ar.

Cada tarefa, para fechar, atravessa estes portões:

| Portão | O defeito que ele previne |
|---|---|
| teste do caminho feliz | funcionalidade que nunca foi executada inteira |
| teste de ao menos uma transição inválida, quando a tarefa toca a máquina de estados | transição proibida que passa sem erro visível |
| transição gerando registro, conferido em teste | transição sem registro, que é a defesa processual da auditabilidade |
| uma entrada na suíte de isolamento, quando a tarefa toca consulta | o vazamento entre organizações |
| custo de teste de um arquivo curto, ou nenhum | a suíte crescer por arquivo, que é o sinal de que a forma foi abandonada |

O registro de ocorrência tem portão próprio: ele é cronometrado três vezes num celular real, em rede
móvel, contra a URL publicada, e o que se anota é a mediana junto do aparelho e da rede. É o único
requisito cronometrado do produto, e medir é o que o separa de um número declarado.

## Fora desta versão

Teste automatizado de desempenho e de segurança. Os dois números são medidos à mão no ambiente
publicado.
