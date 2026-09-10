---
title: "ADR-0009 · Documentação como páginas do produto"
description: "Os mesmos arquivos .md de docs/ compilados em páginas navegáveis pelo Fumadocs, sem deixar de ser legíveis no GitHub."
---

# ADR-0009 — A documentação vira páginas do produto, sem deixar de ser markdown

**Status:** Aceita · 10/09/2026

## Contexto

A documentação da solução são 22 arquivos markdown em `docs/`, e a única forma de lê-los é abrir o
repositório e rolar arquivos de até 3.300 linhas. Não há barra lateral, sumário, breadcrumb, navegação
entre páginas nem busca. Quem avalia o trabalho recebe um endereço da aplicação publicada e um link do
repositório, e hoje as duas superfícies não se encontram: o produto não sabe que a documentação existe.

A restrição que decide o desenho: **a entrega tem duas superfícies, e as duas precisam funcionar**. Um
avaliador pode clonar o repositório, e outro pode abrir a URL publicada. Qualquer solução que faça a
documentação existir só enquanto o container estiver de pé perde metade da entrega.

E há um fato que fecha uma porta: **o GitHub não renderiza `.mdx`**. A lista de formatos que ele processa
inclui `.md`, `.markdown`, `.rst`, `.adoc` e outros, e não `.mdx`, que aparece como código-fonte com
realce de sintaxe. O mesmo vale para `.tsx`.

## Decisão

**Os arquivos continuam `.md` e continuam em `docs/`.** O Fumadocs aponta o `dir` da coleção para lá e
compila os mesmos arquivos em páginas sob `/documentacao`, em tempo de build.

Uma fonte, duas superfícies, sem cópia que possa divergir. O `source.config.ts` na raiz é onde isso está
escrito, e é uma linha.

Três consequências que definem o que a decisão significa aqui.

**1 · O CSS do Fumadocs vive numa entrada de Tailwind separada.** O `app/documentacao/documentacao.css`
é importado apenas pelo layout da rota, e nunca pelo layout raiz. Isso não é organização: é o que impede
dois vazamentos concretos, medidos e descritos na seção de consequências.

**2 · Os adaptadores moram em `src/interface/documentacao/`.** O carregador da árvore de páginas, o
mapeamento de componentes markdown e o renderizador de diagramas são código de adaptação da camada de
Interface, e a regra 3 da [ADR-0006](0006-organizacao-de-modulos.md) proíbe importação relativa para fora
do diretório. Deixá-los ao lado da rota obrigaria a rota a fazer `../mdx`, e é isso que a regra recusa.

**3 · A saída gerada não é versionada.** O `fumadocs-mdx` transforma os `.md` em módulos dentro de
`.source/`, e esse diretório entra no `.gitignore` e nos ignorados do ESLint. Ele é regerado pelo próprio
`next build`, então um clone limpo não precisa de passo extra.

## Justificativa

**1 · O argumento decisivo é que o arquivo não muda.** Qualquer motor que exigisse converter o conteúdo
para `.mdx` ou para componentes trocaria uma superfície pela outra. Com o arquivo intacto, os cinco
verificadores de documentação continuam olhando exatamente os mesmos caminhos, sem uma linha de mudança,
e o `git diff` de uma revisão continua sendo markdown legível.

**2 · O que a decisão compra é navegação, e ela custa horas que não temos.** Barra lateral hierárquica,
sumário da página, breadcrumb, anterior e próximo, árvore de páginas e busca. Um renderizador próprio
custaria o mesmo trabalho e não teria busca.

**3 · A compatibilidade foi conferida, e não suposta.** O `fumadocs-mdx` declara `next: ^15.3.0 || ^16.0.0`
e `react: ^19.2.0`; o projeto está em Next 16.3.2 e React 19.2.8. O Tailwind 4, que o preset exige, já era
o do projeto.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Deixar como está, lendo no GitHub | É o estado anterior. Funciona para quem clona, e some para quem recebe a URL. E um documento de 3.300 linhas sem sumário é lido pela primeira página |
| Nextra | Descartado por incompatibilidade declarada: há relato aberto de que nenhuma versão publicada suporta a linha do Next que o projeto usa |
| Docusaurus | É um programa longevo, com versões, muitos contribuidores e equipe dedicada. Aqui a entrega é única, sem versionamento e com um implementador, e ele traria um segundo aplicativo para manter |
| Renderizador próprio, lendo `docs/` na rota | Custa entre 19 e 26 horas para entregar menos: sem busca, e com a barra lateral, o sumário e o breadcrumb escritos à mão. O Fumadocs entrega isso e a busca por menos |
| Converter os documentos para `.mdx` ou `.tsx` | Perde a leitura no GitHub, que é metade da entrega. É a porta que o parágrafo do contexto fecha |
| Publicar numa wiki externa | Artefato órfão depois da entrega, e uma segunda fonte para envelhecer sozinha |

## Consequências

**Positivas**

- A documentação passa a ter navegação, sumário e busca, e continua sendo markdown no repositório.
- O `README.md` da raiz continua sendo a porta de entrada, e agora tem para onde apontar.
- O arquivo de especificação `docs/api/openapi.yaml` é servido por uma rota que lê o original, em vez de
  uma cópia em `public/` que divergiria na primeira alteração.
- Os diagramas Mermaid do markdown passam a ser desenhados na página, usando a dependência que o
  `verificar:mermaid` já trazia.

**Negativas e custos assumidos**

- **Há duas passadas de Tailwind, e portanto CSS duplicado entre as duas entradas.** É o preço de trazer
  um segundo sistema de design, e é pago só por quem abre a documentação. Medido: 48 KB no pacote do
  produto e 100 KB no da documentação.
- **O `docs` saiu do `.dockerignore`.** O build precisa dos arquivos dentro da imagem. Nada é lido em
  tempo de execução, e por isso a mudança não afeta o que o container faz depois de subir.
- **Cada arquivo ganhou frontmatter YAML** com título e resumo. O GitHub renderiza isso como uma tabela
  no topo, o que é aceitável, e o conteúdo dela são o título e o resumo.
- **O valor do frontmatter precisa de aspas.** Metade dos resumos tem dois-pontos no meio, e sem aspas o
  YAML os lê como mapa aninhado e o build falha. É armadilha para quem acrescentar um documento.
- **`/documentacao` sozinho não é página.** Nenhum documento se chama `index.md`, porque o índice da pasta
  é o `README.md`, que é assim para o GitHub. Um redirecionamento na configuração resolve, e não dá para
  resolver com um `page.tsx`, que teria a mesma especificidade do catch-all opcional ao lado.

## O que se descobriu ao fazer, e não estava previsto

**A colisão de variáveis que se temia não existe.** A preocupação registrada antes de começar era o CSS do
Fumadocs redefinir os onze nomes do tema do produto. Ele não redefine: todas as cores dele são prefixadas
`--color-fd-`, e não encostam nos nossos nomes.

**O vazamento real é outro, e é mais perigoso.** O preset declara `@variant dark (&:where(.dark, .dark *))`,
e o `app/globals.css` declara `@custom-variant dark (&:is(.dark *))`. São diferentes em duas coisas: a do
Fumadocs alcança o próprio elemento `.dark` além dos descendentes, e usa `:where`, que tem especificidade
zero. Numa entrada única de Tailwind, a última declaração venceria e **toda utilidade `dark:` do produto
passaria a resolver por outra regra, com outra especificidade** — e a falha apareceria nas telas do
produto, que é onde ninguém olha depois de aprovar a documentação.

Como `@variant` é construção de tempo de build, duas entradas separadas mantêm cada definição na sua. A
prova está no resultado do build: o pacote de CSS do produto tem `:is(.dark *)` e nenhuma regra do
Fumadocs; o da documentação tem `:where(.dark,.dark *)` e nenhum token do tema do produto. Uma tela do
produto carrega só o primeiro.

**O preset também aplica reset global em `body` e em `*`**, definindo cor de fundo, cor de texto e cor de
borda. A mesma separação o contém: essas regras chegam ao documento apenas nas páginas que carregam o
arquivo da rota.

**A especificação OpenAPI entrou na coleção sem ser convidada.** A coleção de metadados do Fumadocs casa
`.json` e `.yaml` por padrão, e `docs/api/openapi.yaml` foi lido como se fosse a configuração de uma pasta
da barra lateral. Restringir o padrão ao nome `meta.json` resolve, e de quebra fixa a convenção.

## O que esta ADR não decide

- **Não decide quebrar os documentos grandes em subpáginas.** Três deles passam de 2.500 linhas, e a
  quebra depende de resolver as referências de seção entre páginas irmãs. É trabalho próprio.
- **Não decide o tema visual da documentação.** Ela usa o preset neutro do Fumadocs, e ter cara própria é
  consequência aceita: a documentação é coisa à parte do produto, ainda que integrada.
- **Não decide a busca.** Ela vem com o motor e ainda não foi ligada.
