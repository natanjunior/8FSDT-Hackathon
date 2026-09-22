---
title: "Registros de Decisão"
description: "O índice das decisões de arquitetura, com o status de cada uma e as regras do formato."
---

# Registros de Decisão de Arquitetura

Cada arquivo aqui registra **uma** decisão: o contexto em que foi tomada, o que foi decidido, as
alternativas rejeitadas e as consequências, inclusive as ruins.

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-historico-de-transicoes-como-conceito-de-dominio.md) | O histórico de transições é conceito de domínio, e não auditoria de infraestrutura | Aceita |
| [0002](0002-stack-e-plataforma.md) | Next.js com aplicação instalável, APIs próprias e Supabase | Parcialmente substituída pela 0004 |
| [0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) | Isolamento entre organizações na camada de aplicação, com RLS como defesa em profundidade | Aceita |
| [0004](0004-execucao-em-container-no-azure.md) | Execução em contêiner no Azure Container Apps, com registro no GitHub Container Registry | Aceita |
| [0005](0005-regra-de-dependencia-por-inversao.md) | A regra de dependência é garantida por inversão, e o lint é a verificação | Aceita |
| [0006](0006-organizacao-de-modulos.md) | Organização de módulos: camada no primeiro nível, agregado no segundo | Aceita |
| [0007](0007-camada-de-interface-com-shadcn-ui.md) | Camada de interface com shadcn/ui sobre Tailwind, com o código dos componentes no repositório | Parcialmente substituída pela 0010 |
| [0008](0008-a-suite-de-testes-segue-a-garantia.md) | A suíte de testes segue onde mora a garantia, e não a pirâmide | Parcialmente substituída pela 0012 |
| [0009](0009-documentacao-como-paginas-do-produto.md) | A documentação vira páginas do produto, sem deixar de ser markdown | Aceita |
| [0010](0010-o-componente-de-grafico-entra-com-o-recharts.md) | O componente de gráfico do catálogo entra, e com ele o Recharts | Aceita |
| [0011](0011-sonner-e-cmdk-entram-como-pacotes.md) | O aviso de retorno de ação e a busca em lista entram como pacotes instalados | Aceita |
| [0012](0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md) | O teste de ponta a ponta cresce por jornada de validação, com teto | Aceita |

A 0005 e a 0006 se leem melhor em par: a primeira decide como a dependência é invertida, e a segunda
decide onde os arquivos ficam para que essa inversão vire caminho de arquivo que uma regra de lint sabe
conferir.

## Formato

Seguimos Michael Nygard, *Documenting Architecture Decisions* (2011), com as seções **Contexto ·
Decisão · Consequências**, mais uma tabela de **alternativas rejeitadas**. A tabela existe porque boa
parte do valor de um registro está em mostrar por que as outras opções não foram escolhidas.

## Regras

- Uma decisão por arquivo, numerada e nunca renumerada.
- **Mudar de decisão exige registro novo.** Um registro aceito não é reescrito para dizer outra coisa:
  escreve-se outro que o substitui, e o antigo passa a `Substituída por`. O histórico da decisão é o valor
  do artefato.
- **Correção de texto se aplica ao texto.** Quando a decisão continua a mesma e o que estava errado é a
  redação, a correção entra no lugar em que o erro estava, e o documento passa a afirmar apenas o que é
  verdade hoje. O que mudou e quando fica no histórico do repositório.
- Status possíveis: `Proposta` · `Aceita` · `Substituída por` · `Descartada`.
