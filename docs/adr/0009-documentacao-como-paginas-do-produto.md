---
title: "ADR-0009 · Documentação como páginas do produto"
description: "Os mesmos arquivos markdown compilados em páginas navegáveis, sem deixar de ser legíveis no repositório."
---

# ADR-0009 — A documentação vira páginas do produto, sem deixar de ser markdown

**Status:** Aceita · 10/09/2026

## Contexto

A documentação da solução são mais de vinte arquivos markdown, e a única forma de lê-los era abrir o
repositório e rolar arquivos de milhares de linhas. Não havia barra lateral, sumário, navegação entre
páginas nem busca. Quem avalia recebe um endereço da aplicação publicada e um link do repositório, e as
duas superfícies não se encontravam.

A restrição que decide o desenho: **a entrega tem duas superfícies, e as duas precisam funcionar**. Um
avaliador pode clonar o repositório, e outro pode abrir a URL publicada. Qualquer solução que faça a
documentação existir só enquanto o contêiner estiver de pé perde metade da entrega.

E há um fato que fecha uma porta: o GitHub não renderiza `.mdx`, que aparece como código-fonte.

## Decisão

**Os arquivos continuam markdown e continuam onde estavam.** O Fumadocs aponta a coleção para aquele
diretório e compila os mesmos arquivos em páginas, em tempo de construção. Uma fonte, duas superfícies,
sem cópia que possa divergir.

Três consequências definem o que isso significa aqui.

**O CSS da documentação vive numa entrada de Tailwind separada**, importada apenas pelo layout daquela
rota e nunca pelo layout raiz. Isso não é organização: é o que impede o vazamento descrito nas
consequências.

**Os adaptadores moram na camada de Interface**, junto do resto dela. O carregador da árvore de páginas, o
mapeamento de componentes e o renderizador de diagramas são código de adaptação, e a regra de fronteira da
[ADR-0006](0006-organizacao-de-modulos.md) proíbe importação relativa para fora do diretório, o que
descarta deixá-los ao lado da rota.

**A saída gerada não é versionada.** Ela é regerada pela própria construção, então um clone limpo não
precisa de passo extra.

O argumento decisivo é que o arquivo não muda. Qualquer motor que exigisse converter o conteúdo trocaria
uma superfície pela outra; com o arquivo intacto, os verificadores continuam olhando os mesmos caminhos, e
a revisão de uma alteração continua sendo markdown legível.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Deixar como estava, lendo no repositório | Funciona para quem clona, e some para quem recebe a URL. E um documento de milhares de linhas sem sumário é lido pela primeira página |
| Nextra | Incompatibilidade declarada com a linha do Next que o projeto usa |
| Docusaurus | Traria um segundo aplicativo para manter, e é feito para documentação versionada com equipe dedicada |
| Renderizador próprio, lendo os arquivos na rota | Custa mais para entregar menos: sem busca, e com barra lateral, sumário e trilha escritos à mão |
| Converter os documentos para outro formato de componente | Perde a leitura no repositório, que é metade da entrega |
| Publicar numa wiki externa | Artefato órfão depois da entrega, e uma segunda fonte para envelhecer sozinha |

## Consequências

**O que se ganha**

- A documentação passa a ter navegação, sumário e busca, e continua sendo markdown no repositório.
- A especificação da API é servida por uma rota que lê o arquivo original, em vez de uma cópia que
  divergiria na primeira alteração.
- Os diagramas do markdown passam a ser desenhados na página, com a dependência que o verificador de
  diagramas já trazia.

**O que custa**

- **Há duas passadas de Tailwind, e portanto CSS duplicado entre as duas entradas.** É o preço de trazer
  um segundo sistema de design, e é pago só por quem abre a documentação.
- **Os arquivos de documentação entram na imagem**, porque a construção precisa deles. Nada é lido em
  tempo de execução.
- **Cada arquivo ganhou um cabeçalho com título e resumo**, que o repositório renderiza como uma tabela no
  topo. O valor precisa de aspas quando contém dois-pontos, e sem elas a construção falha.
- **O endereço raiz da documentação não é uma página**, porque o índice do diretório é o `README`, que é
  assim para o repositório. Um redirecionamento resolve.

**Dois vazamentos entre as superfícies, e um deles a separação de CSS não alcança.**

O primeiro é de tempo de construção: o preset da documentação declara a variante de tema escuro de um
jeito que venceria a do produto numa entrada única de Tailwind, e toda utilidade de modo escuro das telas
passaria a resolver por outra regra — com a falha aparecendo no produto, que é onde ninguém olha depois de
aprovar a documentação. Duas entradas separadas mantêm cada definição na sua.

O segundo é de tempo de execução. O provedor de tema da documentação escreve uma classe no elemento raiz
do documento, que é compartilhado pelas duas superfícies, e separar o CSS não resolve, porque o que
atravessa é um atributo no DOM. A saída foi o produto deixar de depender daquela classe e passar a
responder a uma chave própria.

**A navegação deixou de ser o diretório.** Quem decide quais páginas a barra lateral mostra é um arquivo
de índice, e não a listagem da pasta. Oito arquivos continuam compilados e alcançáveis por link direto
sem aparecer nela, porque as páginas que os citam ainda existem e os links precisam resolver. A busca
segue a navegação, e não o diretório: o que saiu da barra lateral saiu do índice de busca, para que ela
não devolva ao leitor um endereço que a navegação não oferece mais.

Esta decisão não quebra os documentos grandes em subpáginas nem escolhe tema visual para a documentação,
que usa o preset neutro.
