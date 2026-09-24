---
title: "ADR-0014 · O campo de código entra com o input-otp"
description: "O código da organização passa a ser digitado em oito casas, e o pacote que as desenha entra fixado, como a sexta exceção da ADR-0007."
---

# ADR-0014 — O campo de código entra com o input-otp

**Status:** Aceita · 24/09/2026 · Complementa a [ADR-0007](0007-camada-de-interface-com-shadcn-ui.md)

## Contexto

O código da organização tem oito caracteres de um alfabeto sem as letras e os números que a transcrição
confunde. A pessoa o lê num cartaz e o digita num campo de texto comum, que aceita qualquer caractere e só
reclama depois do envio. A validação de tela pediu que o campo tivesse a forma do código: oito casas,
em dois grupos de quatro, que recusam o que está fora do alfabeto enquanto a pessoa digita.

O catálogo tem esse componente, e ele depende do pacote `input-otp`. A mesma peça, desabilitada, passa a
mostrar o código na tela de configuração, onde o Gestor o lê para escrever no cartaz.

## Decisão

O `input-otp` entra como dependência instalada, em versão fixa, sem faixa. É a sexta exceção à regra de que
o código dos componentes mora no repositório.

As regras do código na tela (o alfabeto, a limpeza do que se cola e a conferência de oito caracteres) moram
num módulo puro da camada de interface, com teste de unidade. Um teste prende o alfabeto da tela ao do
sorteio, para que os dois não divirjam.

A tela passa a ser mais estrita que a API: o servidor continua aceitando de seis a doze caracteres, como o
contrato declara, e a tela aceita os oito que o sorteio produz.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Oito campos de texto escritos no projeto | Foco que avança, colagem que se espalha pelas casas e anúncio ao leitor de tela, mantidos à mão e sem instrumento que confira acessibilidade, o mesmo argumento da ADR-0007 |
| Manter o campo único, com máscara | Não mostra quantos caracteres faltam, e é a forma que a validação recusou |
| Aceitar de seis a doze na tela, como o servidor | Nenhum código gerado sai fora de oito, e as casas deixariam de ter número fixo |

## Consequências

Uma dependência a mais para atualizar por decisão, e não por acidente. A cópia do código na configuração
deixa de poder selecionar o texto das casas, e a falha da área de transferência passa a mostrar o código
em texto, selecionado.
