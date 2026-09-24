---
title: "ADR-0007 · Interface com shadcn/ui"
description: "O código dos componentes mora no repositório, e o esquema que valida o campo é o mesmo que gera a especificação."
---

# ADR-0007 — Camada de interface com shadcn/ui sobre Tailwind

**Status:** Aceita em 21/08/2026 · Parcialmente substituída pela
[ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md) · Complementa a
[ADR-0002](0002-stack-e-plataforma.md)

## Contexto

A [ADR-0002](0002-stack-e-plataforma.md) escolheu Next.js e decidiu construir APIs próprias, e não disse
nada sobre como a interface seria construída: nem biblioteca de componentes, nem abordagem de CSS. Esta
decisão fecha essa lacuna.

Três restrições a moldam.

**O risco mais alto do projeto é usabilidade.** Se o morador não registrar em menos de um minuto pelo
celular, ele volta para o grupo de mensagens e o produto morre. O orçamento de tempo medido no protótipo
fecha por sete segundos, margem que qualquer atrito de formulário consome.

**Não há teste de acessibilidade no projeto, e não haverá.** Um controle construído à mão sem foco, sem
navegação por teclado e sem os atributos corretos é dívida que ninguém aqui tem instrumento para detectar.

**Há um implementador e um prazo curto.** Construir combobox com busca, gaveta e diálogo modal com
armadilha de foco é trabalho que não entrega capacidade nenhuma do escopo.

## Decisão

**A interface é construída com `shadcn/ui`, sobre Tailwind CSS.** Três consequências definem o que isso
significa aqui.

**O código dos componentes mora no repositório.** O `shadcn/ui` não se instala como dependência que se
atualiza: a ferramenta copia o código-fonte para dentro do projeto. Trocamos dependência que se atualiza
por código que se mantém, então nada quebra numa atualização que não pedimos, e em contrapartida a
manutenção é nossa.

A frase tem sete exceções, e é honesto nomeá-las: os primitivos, os ícones, a biblioteca de gráfico, o
aviso de retorno de ação, a busca em lista, o campo de código e o calendário de faixa chegam como pacote
instalado. A terceira entrou pela [ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md), a
quarta e a quinta pela [ADR-0011](0011-sonner-e-cmdk-entram-como-pacotes.md), a sexta pela
[ADR-0014](0014-o-campo-de-codigo-entra-com-o-input-otp.md) e a sétima pela
[ADR-0015](0015-o-seletor-de-faixa-entra-com-o-react-day-picker.md). O que vem instalado é a base sobre a
qual o nosso código roda.

**A base de primitivos é escolha explícita, e é o meta-pacote `radix-ui`.** O projeto de origem oferece
mais de uma base, e herdar o padrão sem decidir produziria uma interface com bases misturadas. Quem
escolheu primeiro foi a ferramenta, que instalou o meta-pacote e escreveu as importações contra ele. A
escolha foi aceita: trocar pelos pacotes individuais seria brigar com a ferramenta a cada componente novo,
e essa briga se perde em silêncio — bastaria um comando esquecido para o repositório conviver com duas
convenções. O conjunto de ícones é `lucide` pela mesma razão, e ele chega no primeiro componente
instalado, com ou sem ícone na tela.

O custo fica declarado: o meta-pacote traz a família toda como uma dependência só, então a lista de
dependências deixa de servir como inventário da interface. Em troca há uma versão para atualizar em vez de
uma por primitivo.

**O esquema que valida o campo é o mesmo que gera a especificação.** A integração de formulário
recomendada usa `zod`, que entraria de qualquer forma: é a camada de Interface fazendo a única coisa que a
regra de dependência lhe permite, que é validar formato. O ganho é que a validação no navegador e a
geração da especificação da API passam a ter uma fonte só.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Biblioteca de componentes instalada como dependência | Entrega o mesmo piso de acessibilidade e custa o oposto na manutenção: o código não é nosso, o tema é o dela, e customizar significa lutar contra ela |
| Construir os componentes do zero | Recusada pelo risco, e não pelo prazo. Sem teste de acessibilidade, um controle feito à mão parece pronto e não é, e o defeito só aparece com quem depende de teclado ou de leitor de tela |
| CSS sem framework de utilitários | Defensável com mais de uma pessoa e um sistema de design. Com uma pessoa e sem revisão por pares, a folha global vira o lugar onde regras colidem sem ninguém perceber |
| Componente de gráfico do catálogo | Recusado nesta decisão por trazer uma biblioteca de porte só para o painel. A [ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md) reverteu isso |

Tailwind não é escolha separada: é pré-requisito. E tem consequência própria, porque estilo declarado no
próprio componente elimina a folha de estilo global como lugar onde regras colidem, que é o modo de falha
mais provável de CSS mantido por uma pessoa só.

## Consequências

**O que se ganha**

- Um piso de acessibilidade que não depende de uma verificação que o projeto não tem.
- A margem do tempo de registro protegida no lugar onde ela se perde, que é o formulário.
- Uma fonte só entre formulário, validação e especificação da API.
- Nenhuma atualização de terceiro pode quebrar a interface durante a construção.

**O que custa**

- **A manutenção dos componentes é nossa.** Correção de acessibilidade publicada pelo projeto original não
  chega sozinha: alguém precisa trazê-la.
- **Tailwind entra por consequência**, e não por escolha própria, então quem não o conhece paga a curva.
- **A conferência do catálogo tem data.** O projeto de origem evolui, e um componente pode mudar de nome,
  de base ou deixar de existir.
