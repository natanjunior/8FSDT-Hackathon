---
title: "ADR-0019 · O QR do convite entra com o uqr"
description: "O convite ganha um QR, e o pacote que calcula a matriz dele entra fixado, como a oitava exceção da ADR-0007. O desenho continua nosso."
---

# ADR-0019 — O QR do convite entra com o uqr

**Status:** Aceita · 26/09/2026 · Complementa a [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

O convite por link tem um QR do mesmo link, para o cartaz da portaria e do elevador. O catálogo de
interface não tem componente de QR, e nenhum pacote do projeto sabe gerar um.

Calcular um QR é seguir uma norma: escolher a versão, aplicar a correção de erro, distribuir os módulos e
escolher a máscara. O resultado ou é lido pela câmera ou não é, e um erro no meio do caminho não aparece a
olho — um QR quase certo se parece com um QR certo.

## Decisão

O `uqr` entra instalado, em versão fixa e sem faixa, como a oitava exceção da ADR-0007. Ele faz uma coisa
só: recebe o texto e devolve a matriz de módulos.

O desenho continua nosso. O componente do projeto recebe a matriz e escreve o SVG no servidor, num
caminho só, sem JavaScript de cliente e sem HTML cru. A zona de silêncio é a de quatro módulos que a
norma pede, e é ela que deixa o leitor achar a borda.

O QR é escuro sobre claro em qualquer tema, inclusive no alto contraste, com fundo próprio que não herda
a cor da página. Leitor de câmera falha com o QR invertido, e é a única cor literal da interface.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| O pacote `qrcode` | Traz um analisador de linha de comando e um codificador de PNG que o produto não usa, e o que se quer dele é a matriz |
| Gerar o QR no cliente | JavaScript a mais numa tela que só mostra um link e um desenho, e o desenho não muda depois de pronto |
| Escrever o codificador | A norma do QR é longa, e o erro não aparece a olho: um QR quase certo parece certo e não abre |

## Consequências

Uma dependência a mais, e ela não traz nenhuma dependência transitiva: 79 KB desempacotados, medidos ao
instalar. O QR sai pronto do servidor, então a tela do Gestor continua sem JavaScript próprio além do
botão de copiar.

A cor literal do QR é exceção declarada no componente. Quem mexer no tema não deve levá-la junto: o que a
protege é o leitor de câmera, e não o contraste da página.
