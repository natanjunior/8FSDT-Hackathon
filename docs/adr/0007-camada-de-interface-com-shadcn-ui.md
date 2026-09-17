---
title: "ADR-0007 · Interface com shadcn/ui"
description: "O código dos componentes mora no repositório, e o schema que valida o campo é o mesmo que gera a especificação."
---

# ADR-0007 — Camada de interface com shadcn/ui sobre Tailwind

**Status:** Parcialmente substituída pela
[ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md) · 21/08/2026 · Complementa a
[ADR-0002](0002-stack-e-plataforma.md)

A ADR-0002 escolheu Next.js com PWA e decidiu construir APIs próprias, e não disse nada sobre como a
interface seria construída: nem biblioteca de componentes, nem abordagem de CSS. As duas escolhas
chegaram à tabela de tecnologias da `arquitetura.md` §2 sem decisão registrada, e é essa lacuna que esta
ADR fecha.

## Contexto

O produto tem as telas desta entrega e trinta interações mapeadas no inventário de telas. Três
restrições moldam a decisão.

**O risco mais alto do projeto é usabilidade.** A análise de riscos da Documentação da Demanda o
classifica assim, e a razão é direta: se o morador não registrar em menos de um minuto pelo celular, ele
volta para o WhatsApp e o produto morre. O RNF6 existe para mitigar isso, e o orçamento de tempo do
protótipo mostrou que ele fecha por sete segundos, margem que qualquer atrito de formulário consome.

**Não há teste de acessibilidade no projeto, e não haverá.** Está declarado como limitação. Um `select`
construído à mão sem foco, sem navegação por teclado e sem `aria-*` correto é dívida que ninguém neste
projeto tem instrumento para detectar.

**Há um implementador e seis semanas.** Construir controles acessíveis do zero, como combobox com busca,
gaveta e diálogo modal com armadilha de foco, é trabalho que não entrega capacidade nenhuma do escopo.

E há uma restrição já decidida que se conecta a esta: a §15 do `contrato-de-api.md` determina que, quando
houver código, o `openapi.yaml` passe a ser gerado a partir dos schemas de validação, com portão de
pipeline que falha se divergir.

## Decisão

**A interface é construída com `shadcn/ui`, sobre Tailwind CSS.**

Três consequências que definem o que isso significa aqui.

**1 · O código dos componentes mora no repositório.** O `shadcn/ui` não é uma dependência que se instala e
se atualiza: o CLI copia o código-fonte para dentro do projeto. Trocamos dependência que se atualiza por
código que se mantém, então nada quebra numa atualização que não pedimos, e em contrapartida a manutenção
é nossa.

A frase tem **cinco exceções conhecidas, e é honesto nomeá-las**: os primitivos, os ícones, a biblioteca
de gráfico, o aviso de retorno de ação e a busca em lista chegam como pacote instalado, e não como código
copiado. A terceira entrou pela [ADR-0010](0010-o-componente-de-grafico-entra-com-o-recharts.md), e as
duas últimas pela [ADR-0011](0011-sonner-e-cmdk-entram-como-pacotes.md). A regra continua verdadeira no
que importa, que é o código dos componentes ser nosso; o que vem instalado é a base sobre a qual ele roda.

**2 · A base de primitivos é escolha explícita, e a predominante é o meta-pacote `radix-ui`.** O projeto
de origem oferece mais de uma base, e herdar o padrão sem decidir produziria uma interface com bases
misturadas. Quem escolheu primeiro foi o CLI: o `shadcn add` instalou o meta-pacote `radix-ui` e escreveu
os imports contra ele, com `import { Slot } from "radix-ui"` no `button.tsx`, em vez dos pacotes
individuais por primitivo. **A escolha foi aceita, e passa a ser desta ADR.** Trocar pelos pacotes
individuais seria brigar com o CLI a cada `shadcn add`, briga que se perde em silêncio: bastaria um `add`
esquecido para o repositório conviver com duas convenções, que é a interface de bases misturadas que esta
regra existe para impedir. Componente que exigir base diferente segue sendo decisão registrada.

O custo, declarado: o meta-pacote traz a família toda como uma dependência só, então o `package.json`
deixa de mostrar quais primitivos estão em uso, e a lista de dependências para de servir como inventário
da interface. Em troca há uma versão para atualizar em vez de uma por primitivo, o que num projeto deste
porte mantido por uma pessoa é o lado certo da troca.

**O conjunto de ícones é `lucide`, pela mesma razão.** É o conjunto do projeto de origem, e trocá-lo seria
a mesma briga perdida a cada `shadcn add`. Ele não é dependência que uma tarefa de ícone introduz: o
`lucide-react` chega no primeiro `shadcn add` de um `Select` ou de um `Dialog`, com ou sem ícone de
categoria na tela, porque os componentes do projeto de origem já importam de lá.

**3 · O schema que valida o campo é o mesmo que gera a especificação.** A integração de formulário
recomendada é `react-hook-form` com `zod`, e `zod` já entraria de qualquer forma: é a camada de Interface
fazendo a única coisa que a regra de dependência lhe permite, que é validar formato. O que se ganha é que
a validação do campo no navegador e a geração do `openapi.yaml` passam a ter uma fonte só, do formulário
até a documentação da API.

É o mesmo princípio das [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) e
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md): garantia mecânica em lugar de boa
vontade, aplicada à borda que ainda não tinha.

## Justificativa

| Restrição | Como esta decisão responde |
|---|---|
| Risco de usabilidade, o mais alto | Controles com comportamento de foco, teclado e leitor de tela corretos, sem construí-los |
| RNF6, com margem de sete segundos | O atrito de formulário é onde a margem se perde, e é o que a biblioteca resolve |
| Acessibilidade sem instrumento de verificação | A base de primitivos dá um piso. Não é conformidade, e o protótipo declara os compromissos que dependem de nós: ordem de foco, alvo de toque, contraste que não dependa só de cor |
| Um implementador, seis semanas | Nenhuma hora gasta construindo combobox, gaveta ou armadilha de foco |
| Contrato e código sincronizados | `zod` no formulário e na geração da especificação |

**Tailwind não é escolha separada:** é pré-requisito. E tem uma consequência própria: estilo declarado no
próprio componente elimina a folha de estilo global como lugar onde regras colidem, que é o modo de falha
mais provável de CSS mantido por uma pessoa só.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Biblioteca de componentes convencional, instalada como dependência | Entrega o mesmo piso de acessibilidade, e custa o oposto na manutenção: o código não é nosso, o tema é o dela, e customizar significa lutar contra ela. A troca que fizemos, código nosso e atualização nenhuma, é a que cabe num projeto que termina em seis semanas e cuja manutenção depois é incerta |
| Construir os componentes do zero | Recusada pelo risco, e não pelo prazo. Sem teste de acessibilidade no projeto, um controle feito à mão parece pronto e não é, e o defeito só aparece com quem depende de teclado ou leitor de tela, que é quem não vai estar na demonstração |
| CSS sem framework de utilitários | Defensável com mais de uma pessoa e um sistema de design. Com uma pessoa e sem revisão de código por pares, a folha global vira o lugar onde regras colidem sem ninguém perceber |
| Componente de gráfico da própria biblioteca | Recusado para esta entrega. Ele traz uma biblioteca de terceiro de porte, e só para o painel. O painel entrega os cinco indicadores sem ele: a recorrência por área tem cerca de trinta itens e é lista ordenada, não gráfico. Se o painel se provar ilegível, entra depois, porque é aditivo |

## Consequências

**Positivas**

- O piso de acessibilidade existe sem depender de uma verificação que o projeto não tem.
- A margem do RNF6 é protegida no lugar onde ela se perde.
- O `zod` fecha o círculo entre formulário, validação e especificação.
- Nenhuma atualização de terceiro pode quebrar a interface durante as seis semanas.

**Negativas, declaradas**

- **A manutenção dos componentes é nossa.** Correção de acessibilidade publicada pelo projeto original não
  chega sozinha: alguém precisa trazê-la.
- **Tailwind entra no projeto por consequência**, e não por escolha própria, então quem não o conhece paga
  a curva.
- **A verificação do catálogo tem data.** O mapeamento das trinta interações foi conferido em 21/08/2026, e
  o projeto de origem evolui: um componente pode mudar de nome, de base ou deixar de existir. Duas
  ressalvas já apareceram nessa conferência, e estão registradas na tabela de tecnologias.

## Fontes

- `docs/documentacao-da-demanda.md`, a análise de riscos e os requisitos não funcionais.
- `docs/prototipo-low-fi.md`, o orçamento de tempo do RNF6, o mapeamento das trinta interações e os
  compromissos de acessibilidade.
- `docs/contrato-de-api.md` §15, a geração da especificação a partir dos schemas.
- `components.json`, onde a base de primitivos e o conjunto de ícones ficam declarados para o CLI.
