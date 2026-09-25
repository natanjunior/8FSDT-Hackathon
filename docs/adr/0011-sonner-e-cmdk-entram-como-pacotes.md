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
interface decididas depois pedem peças que o catálogo entrega como pacote.

A primeira é o retorno de ação. Todo salvamento passa a responder com um aviso flutuante de sucesso, de
erro ou de atenção, e o aviso precisa sobreviver ao modal que o disparou: o modal fecha, a página se
atualiza, e o aviso continua na tela. O componente do catálogo para isso é o `sonner`, que o próprio
catálogo adotou no lugar do componente de aviso construído sobre os primitivos.

A segunda é a busca em lista. A área da ocorrência deixa de ser uma lista nativa e passa a ser um campo
com busca, que abre num painel ancorado na tela grande e numa gaveta no celular. O componente do catálogo
para isso depende do pacote `cmdk`.

## Decisão

**O `sonner` e o `cmdk` entram como dependências instaladas, em versões fixas, sem faixa.** As duas
entradas ficam no mesmo registro porque têm a mesma natureza e foram decididas na mesma revisão.

**O arquivo do catálogo do aviso é editado.** Ele usa um pacote de tema para descobrir o modo escuro, e o
produto não tem seletor de tema: a variante escura segue a preferência do sistema. O arquivo passa a pedir
o tema ao próprio pacote de aviso, e o pacote de tema fica fora do projeto. A edição precisa ser refeita se
alguém rodar a ferramenta de novo sobre o arquivo.

**O aviso é montado uma vez, no layout raiz, e nenhum componente chama o pacote direto.** As três formas
do aviso e a frase genérica de falha moram num módulo da camada de interface, e é esse módulo que as telas
importam. É o que faz o aviso viver fora da tela que o dispara: um modal pode fechar e a página pode se
atualizar sem que ele se perca, e a mesma chamada serve a toda tela, construída ou futura.

**O estado de formulário tocado é escrito no projeto, sem biblioteca.** Nenhum campo mostra problema antes
de a pessoa sair dele ou tentar enviar. O estado que isso exige cabe em poucos fatos: se houve tentativa de
envio, quais campos perderam o foco e quais mudaram desde a última resposta do servidor. A validação
continua sendo a dos esquemas que a ação e a rota já usam, e o mesmo esquema confere o campo no navegador e
a requisição no servidor.

A busca em lista tem navegação por teclado, anúncio da opção ativa e filtragem enquanto se digita. São
comportamentos que a ADR-0007 recusou construir à mão, porque o projeto não tem instrumento que verifique
acessibilidade.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| O componente de aviso dos primitivos, já instalado | Ele é declarativo: cada aviso é um componente montado por alguém, e o aviso de um modal que fecha morre com o modal. Evitar isso exige escrever a fila e o provedor, que é o que o pacote já é |
| Um aviso escrito no projeto | Região viva, fila, tempo de exibição e gesto de dispensar, mantidos por uma pessoa, sem instrumento que confira o anúncio ao leitor de tela |
| Manter a faixa de desfecho lida do endereço | Ela só existe nas telas que recarregam depois de gravar, e um erro dentro de um modal aberto não tem endereço |
| O pacote de tema que o catálogo pede | Um pacote e um provedor para ler uma preferência que o pacote de aviso já sabe ler do sistema |
| Uma biblioteca de formulário para o estado tocado | Traria um pacote para um estado de poucos fatos, sobre esquemas que já existem e já são compartilhados entre a tela e o servidor |
| Busca em lista escrita sobre o painel ancorado | O mesmo argumento da ADR-0007 contra controle acessível feito à mão sem instrumento de verificação |

## Consequências

**O que se ganha**

- Um desenho só de aviso em todo o produto, com as três formas decididas num lugar.
- O aviso sobrevive ao modal que o disparou e à atualização da página.
- A busca de área chega com o comportamento de teclado e de leitor de tela que o catálogo já entrega.
- O mecanismo de formulário tocado tem a decisão numa função pura, testada sem biblioteca de componente.

**O que custa**

- As exceções à regra de que o código dos componentes mora no repositório passam de três a cinco.
- Uma atualização de terceiro pode quebrar o retorno de ação e a busca. As versões fixas fazem da
  atualização uma decisão.
- O pacote injeta a própria folha de estilo sem camada, e ela vence as classes utilitárias. O que o produto
  muda no aviso passa por variável, por estilo em linha e por classe marcada como importante.
- O ícone de sucesso e o de atenção ficam na cor do texto, porque o tema não tem cor própria para os dois
  e o aviso não é razão para abrir cor nova.
- O arquivo copiado do aviso tem edição nossa, que uma reinstalação desfaz.
