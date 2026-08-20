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
- ADR não se edita depois de aceita: se a decisão mudar, escreve-se **outra** ADR que a substitui, e a
  antiga passa a `Status: Substituída por ADR-NNNN`. O histórico da decisão é o valor do artefato.
- Status possíveis: `Proposta` · `Aceita` · `Substituída por ADR-NNNN` · `Descartada`.

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) | Histórico de transições é conceito de domínio, não auditoria de infraestrutura | Aceita |
| [0002](0002-stack-e-plataforma.md) | Next.js com PWA, APIs próprias, Vercel e Supabase | **Parcialmente substituída pela 0004** |
| [0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) | Isolamento entre organizações na camada de aplicação; RLS como defesa em profundidade | Aceita |
| [0004](0004-execucao-em-container-no-azure.md) | Execução em container no Azure Container Apps, com registro no GitHub Container Registry | Aceita |
