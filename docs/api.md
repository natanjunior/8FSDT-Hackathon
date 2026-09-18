---
title: "A API"
description: "As convenções da superfície HTTP: de onde vem a organização, por que a escrita é comando e não campo, o modelo de erros, o upload em duas etapas e o que a API não expõe."
---

# A API

A superfície HTTP tem 41 operações, e todas elas estão navegáveis na
[referência executável](/documentacao/api/referencia), com os campos de entrada e de saída de cada uma.
Esta página não repete essa lista: ela explica as convenções que valem para todas, e as decisões que a
referência mostra sem justificar.

## De onde vem a organização

**Da sessão. Nunca do caminho, nunca de um cabeçalho, nunca do corpo.**

O caminho com o identificador da organização foi considerado e recusado. Se o cliente informa a
organização, o servidor precisa validar o vínculo em cada endereço, e o dia em que alguém escrever um
endereço novo sem essa validação é o dia do vazamento entre organizações. Derivada da sessão, o
esquecimento deixa de ser improvável e passa a ser impossível: não existe valor a esquecer de validar.

O mesmo argumento recusou um cabeçalho com o identificador. Ele manteria a organização como entrada do
cliente, e entrada do cliente é superfície de ataque.

O que se perde fica declarado: a URL deixa de ser autodescritiva. `/ocorrencias/{id}` não diz de quem é a
ocorrência, e quem abre a referência precisa entender que há um contexto ativo antes de clicar.

**Cinco operações rodam sem organização ativa**, e a lista é fechada:

| Operação | Por que fica fora |
|---|---|
| ler o contexto | precisa listar os vínculos de todas as organizações da pessoa |
| escolher a organização ativa | é o ato de escolher o escopo |
| criar uma organização | cria o escopo; não há quem aprove o primeiro Gestor |
| pedir entrada numa organização | acontece antes de existir vínculo, e recebe o código público |
| editar os próprios dados | a tabela de pessoas é global, e a escrita é da própria pessoa sobre si |

Acrescentar uma sexta é mudança de contrato que exige revisão explícita. O que qualifica uma operação a
entrar é ler ou escrever tabela global pela chave da sessão.

## A escrita é comando, e não campo

Todo comando de domínio é `POST /ocorrencias/{id}/<comando>`, com o caminho no imperativo e idêntico ao
nome do comando no domínio. **A ocorrência não tem `PATCH` nenhum**, e `PATCH` existe apenas em recursos de
configuração, como categorias e áreas.

Três razões decidiram.

O vocabulário já existe e é do domínio: `analisar`, `iniciarAtendimento`, `pausar`, `retomar`, `resolver` e
`cancelar` são a linguagem do produto. A alternativa exigiria inventar substantivos técnicos para obter
ortodoxia REST, trocando a linguagem do negócio por uma convenção de transporte.

Um esquema por comando transforma regra condicional em regra estática. A observação é obrigatória em
`pausar` e em `cancelar`, e opcional no avanço rotineiro; com um endereço por comando isso deixa de ser
condicional, e a regra de domínio vira validação de formato — que é a única coisa que a camada de
Interface pode fazer. Com um corpo genérico, a validação condicional seria o lugar onde a regra de negócio
começa a morar na rota.

E um caminho genérico de transições convidaria a tratar o registro de auditoria como coleção de escrita,
quando ele é a entidade que precisa ser inescrevível.

**Toda resposta de comando traz o registro que acabou de ser gravado.** É a forma de a API afirmar, de
fora, que não existe transição sem registro: se o comando respondeu e não trouxe a última transição, isso
é um defeito visível sem olhar o banco.

O custo fica declarado: a metade de escrita não é REST ortodoxa. A de leitura é, que é onde a uniformidade
de recursos paga.

## Quem pode o quê

A autorização pergunta pela permissão, e nunca pelo papel. O contexto devolve a lista de permissões de
quem está logado, e o cliente desenha a tela a partir dela.

**Toda ocorrência que o chamador não pode ler responde `404`, e não `403`** — inclusive dentro da própria
organização. Um `403` confirmaria a existência de uma ocorrência de terceiro, e essa confirmação é
informação que não se deve dar. A depuração é compensada pelo identificador de rastreio que toda resposta
de erro carrega.

## Erros

Formato `application/problem+json`, com três acréscimos nossos: `codigo`, `traceId` e, em erro de
validação, a lista de campos.

**O contrato de verdade é o `codigo`**, estável e em maiúsculas. O título e o detalhe são texto em
português para mostrar na tela, e podem mudar sem aviso.

A taxonomia cabe numa escada, e a primeira linha que se aplica vence:

| Situação | Código |
|---|---|
| não posso **ler** o recurso | `404` |
| posso ler, mas não posso **executar** este comando | `403` |
| posso executar, mas o **estado atual** não permite | `409` |
| requisição bem formada, com **valor inválido** no domínio | `422` |
| requisição **mal formada** | `400` |

A fronteira entre `400` e `422` é se o servidor conseguiu entender o pedido. Campo faltando, tipo errado e
tamanho fora do limite são forma, recusados contra o esquema antes de o domínio existir. Um corpo válido
cujo identificador de categoria aponta para uma categoria desativada é significado, e só a aplicação sabe.

**O `409` de transição carrega o estado atual e as ações disponíveis**, então o cliente descobre pelo erro
o que pode fazer, sem reimplementar a máquina de estados.

## Convenções

| | |
|---|---|
| Idioma | pt-BR em recurso e em campo, sem exceção. `status` é o único termo estrangeiro, porque é palavra do desafio |
| Caixa | `snake_case` no banco, `camelCase` no JSON, e o mesmo vocábulo nos dois |
| Valores de enumeração | idênticos aos do banco, em minúsculo e sem acento. O rótulo que a pessoa lê é um campo à parte, e nunca uma tradução do valor |
| Datas | ISO 8601, sempre em UTC na saída. Converter é do cliente. A janela do painel é a exceção, e é interpretada no fuso de São Paulo, porque agregar mês a mês em UTC partiria o mês brasileiro em dois |
| Identificadores | UUID em texto |
| Ordenação | a listagem de ocorrências tem uma ordem só, da mais recente para a mais antiga. Ordenar por outra coluna exigiria índice novo |

Na paginação, um item pode ser pulado quando alguém age no sentido inverso entre duas páginas. A fila de
triagem é exata, porque nenhuma transição leva de volta ao estado inicial; onde há reentrada, o resíduo
fica declarado em vez de escondido.

## O que o cliente recebe

A ocorrência aparece em três formatos: o resumo da listagem, o detalhe, e a linha do tempo. O detalhe traz
**as ações disponíveis para quem está lendo**, já cruzadas com o estado e com as permissões, e é isso que
permite à interface desenhar botões sem manter uma segunda cópia da máquina de estados. A lista pode vir
vazia, e isso não é erro: é uma ocorrência terminal, ou alguém sem permissão de agir sobre ela.

A trilha de auditoria e a linha do tempo partem dos mesmos fatos: a trilha mostra os campos crus, e a
linha do tempo os apresenta em linguagem de gente, reunindo transições, atribuições e mensagens. Na
listagem vai apenas a contagem de anexos; no detalhe, a lista.

## O upload é em duas etapas

O servidor não transporta os bytes da imagem.

1. O cliente pede autorização e recebe uma credencial de escrita temporária, restrita àquele objeto, mais
   um comprovante assinado.
2. O aparelho envia a imagem direto para o armazenamento.
3. O registro da ocorrência apresenta o comprovante, e é esse passo que faz o objeto passar a existir para
   o sistema.

O comprovante é um token assinado que viaja com o cliente: não há tabela de uploads pendentes. A
credencial de escrita vale quinze minutos, e a de leitura, dez. Os números, os tipos aceitos e o teto por
hora estão na referência.

## O que a API não expõe

- **Não há endereço para listar pessoas.** A leitura de gente parte sempre do vínculo, porque a tabela de
  pessoas é global e não tem organização a filtrar. O contato é dado pessoal, e só aparece para quem tem
  permissão de gerir vínculos.
- **Não há edição de ocorrência.** Título, descrição, categoria e área são escritos uma vez; o que muda
  depois é estado, prioridade, responsável e solução aplicada.
- **A foto entra no registro**, e não há endereço para anexá-la depois.
- **Cadastrar alguém cria sempre uma pessoa nova**, sem procurar por e-mail. Reaproveitar cadastro
  existente exigiria convite, que está fora desta versão.
- **Enviar contatos substitui a lista inteira**, e não há endereço próprio de contato.
- **Um pedido de entrada recusado pode ser refeito**: a unicidade vale enquanto ele está pendente.

## O contrato não pode deixar de ser verdade

A especificação é escrita à mão, e um verificador a compara com as rotas a cada envio, operação por
operação. Ele recusa quatro coisas em particular: que o estado apareça em algum esquema de entrada, que
algum caminho exponha pessoas, que a organização volte a ser informada pelo cliente fora dos dois casos
permitidos, e que a especificação prometa um corpo que a rota recusa.

A última nasceu de um defeito real, que ficou aberto por semanas sem que nada acusasse, porque era a
primeira verificação a comparar os dois lados.

Gerar a especificação a partir dos esquemas de validação continua sendo o destino, e é dívida declarada
com o portão que a cobre nomeado.
