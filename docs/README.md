---
title: "Início"
description: "O que é o Resolve Aí, para quem serve, e por onde começar a leitura — o caminho do produto e o caminho técnico."
---

# Resolve Aí

Plataforma de gestão de ocorrências para lugares coletivos. Um morador, um funcionário ou um vizinho
registra um problema — uma lâmpada queimada, um vazamento, uma falta de limpeza — e acompanha até a
resolução. Quem responde pelo lugar vê tudo numa lista só, atribui responsável e fecha. Cada mudança de
estado fica gravada com quem fez, quando e por quê.

| | |
|---|---|
| **Abrir a aplicação** | [ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io](https://ca-resolve-ai.jollypebble-46a227ca.chilecentral.azurecontainerapps.io) |
| **Ver o código** | [github.com/natanjunior/8FSDT-Hackathon](https://github.com/natanjunior/8FSDT-Hackathon) |
| **Referência da API** | [a especificação executável, no Swagger](/documentacao/api/referencia) |

## Conheça o produto

Para quem quer saber **o que o sistema faz**, sem entrar no como.

| | |
|---|---|
| [O produto](produto.md) | O problema que ele resolve, quem usa, o que cada perfil faz, o ciclo de vida da ocorrência, e o que está e o que não está nesta versão |
| [Glossário](glossario.md) | As palavras do negócio, uma definição cada |

## Documentação técnica

Para quem vai **manter, avaliar ou estender** a solução.

| | |
|---|---|
| [Atendimento ao enunciado](atendimento-ao-enunciado.md) | Cada exigência do desafio, onde ela está descrita, o endereço que a realiza e a tela onde acontece |
| [Visão geral da arquitetura](visao-geral-da-arquitetura.md) | O sistema no contexto, os blocos, a stack contra cada requisito, e a regra de dependência |
| [Domínio e regras](dominio.md) | O agregado `Ocorrência`, a máquina de estados, o histórico e as invariantes |
| [Modelo de dados](modelo-de-dados.md) | O esquema em PostgreSQL, com cada índice justificado por uma consulta |
| [Contrato de API](contrato-de-api.md) | As convenções da superfície HTTP: sessão, organização, erros e upload |
| [Telas](inventario-de-telas.md) | O que cada tela responde, o que oferece e qual endereço chama |
| [Decisões de arquitetura](adr/) | Uma decisão por arquivo, com o contexto, as alternativas rejeitadas e as consequências |
| [Definition of Done](definition-of-done.md) | Os portões de qualidade, cada um justificado pelo defeito que previne |

## Se a pergunta for específica

| A pergunta | Onde ela é respondida |
|---|---|
| *O desafio foi atendido?* | [Atendimento ao enunciado](atendimento-ao-enunciado.md), exigência por exigência |
| *Como a auditabilidade é garantida?* | [Domínio e regras](dominio.md), na máquina de estados e nas invariantes |
| *Como um condomínio não vê o dado do outro?* | [Visão geral da arquitetura](visao-geral-da-arquitetura.md), e o ponto único de escopo |
| *O que a API expõe?* | A [referência da API](/documentacao/api/referencia), com as operações navegáveis |
| *Como rodo o projeto?* | O [README do repositório](https://github.com/natanjunior/8FSDT-Hackathon#como-rodar) |

---

Trabalho acadêmico de conclusão da Fase 5 da pós-graduação em Full Stack Development da FIAP. Sem uso
comercial.
