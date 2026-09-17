---
title: "ADR-0011 · O sonner e o cmdk entram como pacotes"
description: "O aviso de retorno de ação e a busca em lista chegam como pacote instalado, e o estado de formulário tocado fica com um mecanismo do próprio projeto."
---

# ADR-0011 — O sonner e o cmdk entram como pacotes instalados

**Status:** Aceita · 17/09/2026 · Complementa a [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

A [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md) decidiu que o código dos componentes mora no
repositório e nomeou as exceções: os primitivos, os ícones e, desde a
[ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md), a biblioteca de gráfico. Duas regras de
interface decididas na revisão de desenho de 16/09/2026 pedem peças que o catálogo entrega como pacote.

A primeira é o retorno de ação. Todo salvamento que a pessoa pede passa a responder com um aviso
flutuante de sucesso, de erro ou de atenção, e o aviso precisa sobreviver ao modal que o disparou: o modal
fecha, a página se atualiza, e o aviso continua na tela. O componente do catálogo para isso é o `sonner`,
que o catálogo adotou no lugar do próprio componente de aviso feito sobre os primitivos.

A segunda é a busca em lista. A área da ocorrência deixa de ser uma lista nativa e passa a ser um campo
com busca, que abre num painel ancorado na tela grande e numa gaveta no celular. O componente do catálogo
para isso é o `command`, e ele depende do pacote `cmdk`.

## Decisão

**O `sonner` e o `cmdk` entram como dependências instaladas, fixadas em `2.0.8` e `1.1.1`, sem acento
circunflexo.**

O `sonner` entra com o item que leva as regras de formulário e de retorno às telas já construídas. O
`cmdk` entra com o item que reconstrói o registro de ocorrência. As duas entradas ficam no mesmo registro
porque têm a mesma natureza e foram decididas na mesma revisão.

Três coisas vêm junto com a decisão.

**O arquivo do catálogo do `sonner` é editado.** O registro declara o pacote `next-themes` como segunda
dependência, e o arquivo copiado o usa para descobrir o tema. O produto não tem seletor de tema: a
variante escura segue a preferência do sistema, sem classe e sem provedor. O arquivo passa a pedir ao
próprio pacote o tema do sistema, e o `next-themes` fica fora do projeto. A edição precisa ser refeita se
alguém rodar o CLI de novo sobre o arquivo, como a do gráfico.

**O aviso é montado uma vez, no layout raiz, e nenhum componente chama o pacote direto.** As três formas
do aviso e a frase genérica de falha moram num módulo da camada de interface, e é esse módulo que as telas
importam.

**O estado de formulário tocado é escrito no projeto, sem biblioteca.** Nenhum campo mostra problema antes
da primeira interação, e depois dela todos mostram. O estado que isso exige cabe em poucos fatos: se houve
interação, quais campos perderam o foco e quais mudaram desde a última resposta do servidor. A validação
continua sendo a dos schemas de `zod` que a ação e a rota já usam, e o mesmo schema confere o campo no
navegador e a requisição no servidor.

## Justificativa

O aviso precisa viver fora da tela que o dispara. Com o componente montado no layout raiz e o aviso
emitido por uma chamada de função, um modal pode fechar e a página pode se atualizar sem que o aviso se
perca. A mesma chamada serve a toda tela, construída ou futura.

A compatibilidade foi conferida no registro do npm em 17/09/2026. O `sonner` 2.0.8 não tem dependências e
declara `react` e `react-dom` 18 ou 19 como pares. O `cmdk` 1.1.1 declara os mesmos pares e depende de
quatro primitivos que o projeto já tem em versão que satisfaz a faixa: `@radix-ui/react-dialog` 1.1.23,
`@radix-ui/react-id` 1.1.4, `@radix-ui/react-primitive` 2.1.10 e `@radix-ui/react-compose-refs` 1.1.5.
O projeto está em React 19.2.8.

A busca em lista tem navegação por teclado, anúncio da opção ativa e filtragem enquanto se digita. São
comportamentos que a ADR-0007 recusou construir à mão, porque o projeto não tem instrumento que verifique
acessibilidade.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O componente de aviso dos primitivos, que já está instalado | Ele é declarativo: cada aviso é um componente montado por alguém, e o aviso de um modal que fecha morre com o modal. Evitar isso exige escrever a fila e o provedor, que é o que o `sonner` já é. O próprio catálogo trocou esse componente pelo `sonner` |
| Um aviso escrito no projeto | Região viva, fila, tempo de exibição e gesto de dispensar, construídos e mantidos por uma pessoa, sem instrumento que confira o anúncio ao leitor de tela |
| Manter a faixa de desfecho lida do endereço | Ela só existe nas telas que recarregam depois de gravar, cada tela lê o próprio parâmetro, e um erro dentro de um modal aberto não tem endereço |
| O `next-themes` que o catálogo pede | Um pacote e um provedor para ler uma preferência que o `sonner` já sabe ler do sistema |
| `react-hook-form` para o estado de formulário tocado | A ADR-0007 o cita como a integração que o catálogo recomenda, e ele nunca foi instalado. Ele traria um pacote para um estado de poucos fatos, sobre schemas que já existem e já são compartilhados entre a tela e o servidor |
| Para a busca em lista, uma lista com busca escrita sobre o painel ancorado | O mesmo argumento da ADR-0007 contra controle acessível feito à mão sem instrumento de verificação |

## Consequências

**Positivas**

- Um desenho só de aviso em todo o produto, com as três formas decididas num lugar.
- O aviso sobrevive ao modal que o disparou e à atualização da página.
- A busca de área chega com o comportamento de teclado e de leitor de tela que o catálogo já entrega.
- O mecanismo de formulário tocado tem a decisão numa função pura, testada sem biblioteca de componente.

**Negativas, declaradas**

- A frase da ADR-0007 sobre o código dos componentes morar no repositório passa de três exceções a cinco.
- Uma atualização de terceiro pode quebrar o retorno de ação e a busca. As versões fixadas fazem da
  atualização uma decisão.
- Toda página ganha uma região viva, a do aviso, inclusive as que não gravam nada, como a documentação.
- O pacote injeta a própria folha de estilo sem camada, e ela vence as classes utilitárias. O que o
  produto muda no aviso passa por variável, por estilo em linha e por classe marcada como importante.
- O ícone de sucesso e o de atenção ficam na cor do texto: o tema não tem cor própria para os dois, e o
  aviso não é razão para abrir cor nova.
- O arquivo copiado do `sonner` tem edição nossa, que um novo `add` desfaz.

## Fontes

- [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md), as exceções e a integração de formulário
  recomendada.
- [ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md), a exceção anterior e o precedente da
  edição no arquivo copiado.
- `docs/inventario-de-telas.md`, as telas e os erros que aparecem para o usuário.
- O registro do npm, para as versões, os pares e as dependências, conferidos em 17/09/2026.
