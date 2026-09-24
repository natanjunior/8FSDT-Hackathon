---
title: "ADR-0015 · O seletor de faixa entra com o react-day-picker"
description: "O período do painel passa a ser escolhido num calendário de faixa, e o pacote que o desenha entra fixado, como a sétima exceção da ADR-0007."
---

# ADR-0015 — O seletor de faixa entra com o react-day-picker

**Status:** Aceita · 24/09/2026 · Complementa a [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

O painel recorta os indicadores por um período, e até aqui esse período se escolhia em dois campos de data
nativos do navegador. Cada navegador desenha o seu, o formato muda com a configuração do aparelho, e os
dois campos não sabem que são as pontas de um mesmo intervalo: nada mostra quantos dias o recorte tem, e
nada impede escolher um fim anterior ao começo.

A validação de tela pediu um controle único, que mostre o intervalo aplicado e abra um calendário de dois
meses com os atalhos de uso corrente. O catálogo tem esse componente, e ele depende do pacote
`react-day-picker`.

## Decisão

O `react-day-picker` entra como dependência instalada, em versão fixa, sem faixa. É a sétima exceção à
regra de que o código dos componentes mora no repositório.

A gramática do endereço não muda: o recorte continua sendo dois parâmetros de data na URL, e o painel
continua compartilhável por link. O que muda é a peça que os escreve.

A tradução entre a data do calendário e a data do endereço mora num módulo puro da camada de interface,
com teste de unidade. Ela monta o instante ao meio-dia local e lê o dia pelas partes locais, porque a
meia-noite em tempo universal cai no dia anterior em todo fuso a oeste, que é o do produto inteiro.

Os quatro atalhos são calculados na camada de aplicação, que é quem já sabe o que são noventa dias e em
que fuso o dia vira. A interface escreve as palavras e compara o que veio.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Manter os dois campos nativos | É a forma que a validação recusou, e ela não mostra o intervalo como um intervalo |
| Escrever o calendário no projeto | Grade navegável por teclado, faixa com duas pontas e anúncio ao leitor de tela, mantidos à mão e sem instrumento que confira acessibilidade, o mesmo argumento da ADR-0007 |
| Limitar o calendário aos dias passados | O painel responde a faixa no futuro com os quadros vazios, e o teto exigiria uma segunda noção de hoje, escrita no relógio de quem abre |

## Consequências

Uma dependência a mais para atualizar por decisão. Ela traz duas transitivas, `date-fns` e `@date-fns/tz`,
que aparecem no arquivo de trava e não são importadas pelo nosso código. O peso cai só na rota do painel,
e a tela de registro de ocorrência, que é a cronometrada, não o carrega.

Sem JavaScript o período deixa de ser escolhível na tela. O endereço continua respondendo ao recorte que
se escrever nele, e é a mesma saída de sempre.
