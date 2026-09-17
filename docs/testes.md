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
| Ponta a ponta | o caminho crítico inteiro num navegador, com a troca de organização no meio do percurso | Playwright | sim, com a pilha de pé |

As duas primeiras linhas crescem por caso, e é onde o volume vai. A de integração cresce por consulta
nova, e não por arquivo. A de ponta a ponta não cresce: é uma só, por decisão registrada na
[ADR-0008](adr/0008-a-suite-de-testes-segue-a-garantia.md).

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
aplicação. **Um mundo declarado, dois desenhistas**: duas organizações, a mesma pessoa vinculada às duas
com papéis diferentes, e uma pessoa em só uma delas. É o cenário do síndico profissional, e é o único que
detecta o vazamento.

A regra que impede a divergência: um teste pode acrescentar ao mundo, e nunca alterá-lo. Precisa de uma
área a mais, acrescenta; precisa de uma terceira organização, monta o seu mundo à parte e diz por quê.
Alterar o mundo compartilhado é como o ajuste de um teste desarma em silêncio a armadilha de outro.

## Os verificadores

Seis programas conferem o que teste de código não alcança, e todos rodam na esteira.

| Verificador | O que recusa |
|---|---|
| Diagramas | bloco Mermaid que não compila, porque diagrama que não renderiza é documentação que não existe |
| Contrato | divergência entre a especificação executável e as rotas que a realizam, operação por operação |
| Links e referências | link relativo que não resolve e referência a seção que não existe |
| Tom | os padrões de densidade, de aparato e de estrutura que a reescrita removeu, nos arquivos já reescritos |
| Site publicado | link quebrado, diagrama que não desenhou, busca sem resultado e título repetido, no site de verdade |
| Imagem | segredo assado em qualquer camada da imagem, lido do histórico de construção |

Um sétimo compara a configuração de autenticação publicada com o que o repositório declara, porque a
esteira publica migração e imagem, e nunca configuração.

**Todo verificador prova que discrimina.** Cada um carrega um par de controles: um conteúdo que precisa ser
recusado e outro, equivalente, que precisa passar. Um verificador que aceitasse tudo passaria por bom até
o dia em que precisasse pegar alguma coisa, e o controle negativo é o que impede isso. O verificador do
site, por exemplo, exige que uma página inexistente responda `404`, porque sem isso um link quebrado seria
invisível para ele.

## O portão

```
npm run verificar     lint · tipos · testes unitários · verificadores de documentação
```

É o comando que quem implementa roda antes de abrir um pull request, e é o mesmo conjunto que a esteira
roda a cada envio. Falha bloqueia a mesclagem.

Além dele, a esteira sobe a pilha inteira do zero num servidor limpo, roda o teste de integração contra um
PostgreSQL de verdade, constrói a imagem, confere que ela não carrega segredo e, depois de publicar,
executa o verificador de site contra a URL que está no ar. O que roda na máquina de quem desenvolve é o
que roda em produção, e a esteira é quem prova isso a cada entrega.

O detalhe de quais portões cobram o quê está em
[Definition of Done](definition-of-done.md).

## O que não é verificado por máquina

Desempenho e segurança não têm teste automatizado nesta versão: os dois números são medidos à mão no
ambiente publicado. Fica nomeado para que a ausência seja escolha visível.
