# Registros de Decisão de Arquitetura (ADR)

Cada arquivo aqui registra **uma** decisão de arquitetura: o contexto em que foi tomada, o que foi
decidido, as alternativas rejeitadas e as consequências — inclusive as ruins.

## Formato

Seguimos o formato de **Michael Nygard** (*Documenting Architecture Decisions*, 2011): `Contexto ·
Decisão · Consequências`, com duas seções acrescentadas por nós — *Justificativa* e *Alternativas
consideradas* — porque o valor deste projeto está justamente em mostrar por que **não** escolhemos as
outras opções.

**ADR é [FONTE EXTERNA]:** não foi ensinado em nenhuma das 9 aulas da disciplina de DDD. Adotamos
porque o enunciado exige "Documentação" como entregável e porque o tópico 2 do Documento de Requisito
Técnico (aula 8, p.7–9) pede justificar cada escolha técnica "em relação aos requisitos e desafios
técnicos identificados" — que é exatamente o que uma ADR faz. Onde uma ADR se apoiar no material da
disciplina, a citação vem como `aula N, p.X`.

## Regras

- Uma decisão por arquivo, numerada e nunca renumerada.
- **Mudar de decisão exige ADR nova.** Uma ADR aceita não é reescrita para dizer outra coisa: escreve-se
  **outra** que a substitui, e a antiga passa a `Status: Substituída por ADR-NNNN`. O histórico da decisão
  é o valor do artefato.
- **Emenda é permitida, e tem forma.** Quando a decisão continua a mesma e o que estava errado é o texto —
  uma palavra que aponta para a camada errada, uma lacuna que o desenho expôs depois —, a correção entra
  **no próprio arquivo**, em bloco datado, dizendo o que estava escrito antes e por que mudou. O que a
  emenda não pode fazer é mudar o que foi decidido sem que se veja. Quatro ADRs já têm emendas assim — a
  [0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md), a [0004](0004-execucao-em-container-no-azure.md),
  a [0006](0006-organizacao-de-modulos.md) e a [0007](0007-camada-de-interface-com-shadcn-ui.md) —, e todas
  dizem qual era a redação anterior.
- Status possíveis: `Proposta` · `Aceita` · `Substituída por ADR-NNNN` · `Descartada`.

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) | Histórico de transições é conceito de domínio, não auditoria de infraestrutura | Aceita |
| [0002](0002-stack-e-plataforma.md) | Next.js com PWA, APIs próprias, Vercel e Supabase | **Parcialmente substituída pela 0004** |
| [0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) | Isolamento entre organizações na camada de aplicação; RLS como defesa em profundidade | Aceita |
| [0004](0004-execucao-em-container-no-azure.md) | Execução em container no Azure Container Apps, com registro no GitHub Container Registry | Aceita |
| [0005](0005-regra-de-dependencia-por-inversao.md) | A regra de dependência é garantida por inversão; o lint é a verificação | Aceita |
| [0006](0006-organizacao-de-modulos.md) | Organização de módulos: camada no primeiro nível, agregado no segundo | Aceita |
| [0007](0007-camada-de-interface-com-shadcn-ui.md) | Camada de interface com shadcn/ui sobre Tailwind: o código dos componentes mora no repositório | Aceita |
| [0008](0008-a-suite-de-testes-segue-a-garantia.md) | A suíte de testes segue onde mora a garantia, não a pirâmide | Aceita |

> **A 0005 e a 0006 são as duas decisões de estrutura interna do código**, escritas em 21/08/2026 ao
> confrontar o pacote com a disciplina de **Clean Architecture da Fase 5**. As duas são a primeira vez em
> que a documentação cita essa disciplina: até então, onze documentos citavam DDD (Fase 1) e Banco de
> Dados (Fase 2), e nenhum citava a fase que está sendo entregue. **Quando uma ADR se apoiar no material
> da Fase 5, a citação vem como `aula N, p.X` — e, quando vier da fala, `aula N, transcrição NN`.**
