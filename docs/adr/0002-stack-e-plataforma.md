---
title: "ADR-0002 · Stack e plataforma"
description: "Next.js com aplicação instalável, APIs próprias e Supabase, com as alternativas rejeitadas e o que a ADR-0004 substituiu."
---

# ADR-0002 — Next.js com aplicação instalável, APIs próprias e Supabase

**Status:** Parcialmente substituída pela [ADR-0004](0004-execucao-em-container-no-azure.md) · 20/08/2026
· Status original: Aceita · 18/08/2026

> A [ADR-0004](0004-execucao-em-container-no-azure.md) substitui daqui a plataforma de execução e o
> armazenamento de anexo. Permanecem válidos o Next.js com TypeScript, a aplicação instalável, as rotas
> de API próprias, o GitHub com GitHub Actions, e o Supabase para PostgreSQL e autenticação.

## Contexto

O desafio exige arquitetura, backend, APIs, banco, frontend, testes, contêiner, publicação em nuvem e
documentação. As restrições do projeto são um implementador, prazo curto e nuvem de custo zero
obrigatório.

A escolha foi adiada até depois do desenho estratégico, e chegou a este ponto com o espaço já bastante
fechado: dois contextos delimitados e um implementador pedem monolito modular; as políticas levantadas na
descoberta rodam todas no mesmo processo, o que dispensa mensageria, fila e cache distribuído; e a escala
pedida é pequena o bastante para que qualquer stack a atenda. Restavam três exigências com peso: camada de
domínio explícita, imposta pela [ADR-0001](0001-historico-de-transicoes-como-conceito-de-dominio.md),
leitura sem rede para quem executa o trabalho em subsolo, e registro em menos de um minuto pelo celular.

## Decisão

Next.js como aplicação única, com TypeScript, aplicação instalável para o registro rápido pelo celular,
rotas de API próprias, e Supabase como plataforma de dados.

| Peça | Escolha | Por quê |
|---|---|---|
| Aplicação | Next.js com TypeScript | uma entrega só, sem CORS nem tipos duplicados entre interface e API |
| Instalação no aparelho | manifesto de aplicação web | põe o atalho na tela inicial do aparelho sem desenvolvimento móvel nativo |
| APIs | rotas próprias | as APIs são entregável, e são o que a aplicação instalada consome |
| Banco e contas | Supabase | PostgreSQL gerenciado na franquia gratuita, com autenticação pronta |
| Ambiente local | Docker, com a aplicação dentro | a conteinerização exigida vale para a aplicação, e não só para as dependências |

**A fronteira é a camada de aplicação, e não o HTTP.** Em Next.js um componente de servidor pode consultar
o banco direto e pular a API inteira, e aí metade do sistema deixaria de passar pelo que se entrega como
API. A regra que fecha isso: nem servidor nem cliente tocam o banco ou o SDK, e os dois chamam a camada de
aplicação. É o que a [ADR-0005](0005-regra-de-dependencia-por-inversao.md) transforma em regra de lint.

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| API em NestJS com interface em Angular | Separação mais canônica, e Angular é o terreno profissional de quem implementa. Custa duas aplicações, dois deploys, dois pipelines, CORS e tipos duplicados. O argumento que a justificaria é trabalho paralelo de time, que não existe aqui |
| Spring Boot com Angular | Máximo alinhamento com o dia a dia de quem implementa, e o custo de publicação é o mais penoso: Java em franquia gratuita é o pior em memória e em partida a frio |
| Supabase como plataforma de serviços, com a regra no banco | Caminho mais curto até funcionar, e poria a máquina de estados em SQL, contra a ADR-0001. A [ADR-0003](0003-isolamento-de-tenant-na-camada-de-aplicacao.md) detalha o descarte |
| Aplicativo nativo para quem executa o trabalho | Resolveria o uso sem rede, ao custo de uma segunda base de código e uma segunda esteira |
| Armazenamento de imagem em outro provedor | Franquia generosa, e um serviço, uma credencial e um fluxo a mais. Com a compressão no aparelho, o volume cabe onde já está |

## Consequências

**O que se ganha**

- Uma entrega, uma esteira, uma linguagem, o que pesa muito com um implementador.
- A aplicação instalável abre do atalho na tela inicial e ajuda o registro rápido pelo celular.
- A compressão de imagem no aparelho atende ao mesmo tempo o armazenamento e o tempo de registro.

**O que custa**

- **O `Dockerfile` não era o que rodava em produção**, porque a plataforma original executava funções. Era
  divergência declarada entre ambientes, e é a consequência que a ADR-0004 derruba.
- **O projeto de banco na franquia gratuita pausa por inatividade.** Se houver demonstração ao vivo, ele
  precisa ser acordado antes, e a mitigação é uma consulta agendada.
- **Next.js facilita dissolver a camada de domínio.** Sem a regra de fronteira sustentada por lint, a
  lógica vaza para o componente de tela sob pressão de prazo. É o risco de execução mais provável desta
  escolha.
- **Dependência do provedor de autenticação.** Mitigada pela camada de tradução que mantém a `Ocorrência`
  sem conhecimento de token ou de claim.
