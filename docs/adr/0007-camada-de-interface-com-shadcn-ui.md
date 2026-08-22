# ADR-0007 — Camada de interface com shadcn/ui sobre Tailwind

**Status:** Aceita · 21/08/2026 · **Complementa a [ADR-0002](0002-stack-e-plataforma.md)**

> A ADR-0002 escolheu Next.js com PWA e decidiu construir APIs próprias, mas **não disse nada sobre como a
> interface seria construída** — nem biblioteca de componentes, nem abordagem de CSS. As duas escolhas
> chegaram à tabela de tecnologias de `arquitetura.md` §2 sem decisão registrada, e é essa lacuna que esta
> ADR fecha.

## Contexto

O produto tem **dez telas** e trinta interações mapeadas no inventário de telas. Três restrições moldam a
decisão:

**O risco mais alto do projeto é usabilidade.** A análise de riscos da Documentação da Demanda o classifica
assim, e a razão é direta: *"se o morador não registrar em menos de um minuto pelo celular, ele volta para
o WhatsApp e o produto morre"*. O **RNF6** existe para mitigá-lo, e o orçamento de tempo do protótipo
mostrou que ele **fecha por sete segundos** — margem que qualquer atrito de formulário consome.

**Não há teste de acessibilidade no projeto, e não haverá.** Está declarado como limitação. Um `select`
construído à mão sem foco, sem navegação por teclado e sem `aria-*` correto é dívida que ninguém neste
projeto tem instrumento para detectar.

**Há um implementador e seis semanas.** Construir controles acessíveis do zero — combobox com busca,
gaveta, diálogo modal com armadilha de foco — é trabalho que não entrega capacidade nenhuma do escopo.

E há uma restrição de projeto que já estava decidida e que se conecta a esta: a §15 do contrato de API
determina que, quando houver código, o `openapi.yaml` passa a ser **gerado a partir dos schemas de
validação**, com portão de pipeline que falha se divergir.

## Decisão

**A interface é construída com `shadcn/ui`, sobre Tailwind CSS.**

Três consequências que definem o que isso significa aqui:

**1 · O código dos componentes mora no repositório.** `shadcn/ui` não é uma dependência que se instala e se
atualiza: o CLI **copia o código-fonte** para dentro do projeto. Trocamos *"dependência que se atualiza"*
por *"código que se mantém"* — nada quebra numa atualização que não pedimos, e em contrapartida a
manutenção é nossa.

**2 · A base de primitivos é escolha explícita, por componente.** O projeto oferece mais de uma base, e
herdar o padrão sem decidir produziria uma interface com bases misturadas. Onde um componente exigir uma
base diferente da predominante, isso é decisão registrada, não acidente.

> ### Emenda de 22/08/2026 — a base predominante tem nome: o meta-pacote `radix-ui`
>
> **O parágrafo acima ficou sem sujeito.** Ele exige que a base seja escolha explícita e não diz qual é a
> predominante — e, no esqueleto, **quem escolheu foi o CLI**: `shadcn add` instalou o meta-pacote
> `radix-ui` e escreveu os imports contra ele (`import { Slot } from "radix-ui"` em `button.tsx`), em vez
> dos pacotes individuais por primitivo.
>
> **Decidido: aceitar, e é isto que torna a escolha explícita.** Trocar pelos pacotes individuais seria
> brigar com o CLI a cada `shadcn add` — briga que se perde, e que se perde **em silêncio**: bastaria um
> `add` esquecido para o repositório passar a conviver com as duas convenções, que é precisamente a
> *"interface com bases misturadas"* que a regra 2 existe para impedir. **A base predominante deste projeto
> é a base predominante do projeto de origem.**
>
> **A regra 2 continua inteira**, e é só ela que muda de estado: deixa de ter um lugar em branco. Componente
> que exigir base diferente segue sendo decisão registrada.
>
> **O custo, declarado:** o meta-pacote traz a família toda como uma dependência só, então o `package.json`
> deixa de mostrar quais primitivos estão realmente em uso — a lista de dependências para de servir como
> inventário da interface. Em troca há **uma versão para atualizar em vez de uma por primitivo**, o que num
> projeto de dez telas mantido por uma pessoa é o lado certo da troca.

**3 · O schema que valida o campo é o mesmo que gera a especificação.** A integração de formulário
recomendada é `react-hook-form` com `zod`, e `zod` **já entraria de qualquer forma**: é a camada de
Interface fazendo a única coisa que a regra de dependência lhe permite — validar formato. O que se ganha é
que a validação do campo no navegador e a geração do `openapi.yaml` passam a ter **uma fonte só**, do
formulário até a documentação da API.

É o mesmo princípio das [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) e
[ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md): garantia mecânica em lugar de disciplina,
aplicada à borda que ainda não tinha.

## Justificativa

| Restrição | Como esta decisão responde |
|---|---|
| Risco de usabilidade, o mais alto | Controles com comportamento de foco, teclado e leitor de tela corretos **sem construí-los** |
| **RNF6**, com margem de sete segundos | O atrito de formulário é onde a margem se perde, e é exatamente o que a biblioteca resolve |
| Acessibilidade sem instrumento de verificação | A base de primitivos dá um **piso**. Não é conformidade, e o protótipo declara os compromissos que dependem de nós — ordem de foco, alvo de toque, contraste que não dependa só de cor |
| Um implementador, seis semanas | Nenhuma hora gasta construindo combobox, gaveta ou armadilha de foco |
| Contrato e código sincronizados (§15) | `zod` no formulário **e** na geração da especificação |

**Tailwind não é escolha separada:** é pré-requisito. E tem uma consequência própria que vale registrar —
estilo declarado no próprio componente elimina a folha de estilo global como lugar onde regras colidem, que
é o modo de falha mais provável de CSS mantido por uma pessoa só.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **Biblioteca de componentes convencional** (instalada como dependência) | Entrega o mesmo piso de acessibilidade, e custa o oposto na manutenção: o código não é nosso, o tema é o dela, e customizar significa lutar contra ela. A troca que fizemos — código nosso, atualização nenhuma — é a que cabe num projeto que termina em seis semanas e cuja manutenção depois é incerta |
| **Construir os componentes do zero** | Recusada pelo risco, não pelo prazo. Sem teste de acessibilidade no projeto, um controle feito à mão **parece pronto e não é**, e o defeito só aparece com quem depende de teclado ou leitor de tela — que é exatamente quem não vai estar na demonstração |
| **CSS sem framework de utilitários** | Defensável com mais de uma pessoa e um sistema de design. Com uma pessoa e sem revisão de código por pares, a folha global vira o lugar onde regras colidem sem ninguém perceber |
| **Componente de gráfico da própria biblioteca** | **Recusado para a primeira entrega**, e é a exceção que confirma a regra 1: ele traz uma biblioteca de terceiro de verdade, e seria a única dependência do pacote que contradiz *"o CLI copia o código"*. O painel entrega os cinco indicadores sem ele — a recorrência por área tem cerca de trinta itens e é lista ordenada, não gráfico. Se o painel se provar ilegível, entra depois: é aditivo |

## Consequências

**Positivas**

- O piso de acessibilidade existe sem depender de uma verificação que o projeto não tem.
- A margem do RNF6 é protegida no lugar onde ela se perde.
- `zod` fecha o círculo entre formulário, validação e especificação.
- Nenhuma atualização de terceiro pode quebrar a interface durante as seis semanas.

**Negativas, declaradas**

- **A manutenção dos componentes é nossa.** Correção de acessibilidade publicada pelo projeto original não
  chega sozinha: alguém precisa trazê-la.
- **Tailwind entra no projeto por consequência**, não por escolha própria — e quem não o conhece paga a
  curva.
- **A verificação do catálogo tem data.** O mapeamento das trinta interações foi conferido em 21/08/2026, e
  o projeto evolui: um componente pode mudar de nome, de base ou deixar de existir. Duas ressalvas já foram
  encontradas nessa conferência, e estão registradas na tabela de tecnologias.

## Fontes

- `docs/documentacao-da-demanda.md` — análise de riscos e os requisitos não funcionais.
- `docs/prototipo-low-fi.md` — o orçamento de tempo do RNF6, o mapeamento das trinta interações e os
  compromissos de acessibilidade.
- `docs/contrato-de-api.md` §15 — a geração da especificação a partir dos schemas.
- **[FONTE EXTERNA]** — nenhuma das nove aulas de DDD nem das oito de Clean Architecture trata de biblioteca
  de componentes, acessibilidade ou abordagem de CSS. Esta decisão se sustenta pelo próprio argumento.
