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
| [Segurança](seguranca.md) | O isolamento entre organizações, quem entra, o que cada um pode, e o que acontece com foto, localização e conta excluída |
| [Infraestrutura](infraestrutura.md) | Onde cada peça roda, o que a imagem contém, a ordem da esteira e como subir a pilha na própria máquina |
| [Testes](testes.md) | O que cada tipo de teste protege, os verificadores e o portão que bloqueia a entrega |
| [Banco de dados](banco-de-dados.md) | As catorze tabelas, e o que o esquema garante sozinho |
| [A API](api.md) | As convenções da superfície HTTP: sessão, organização, erros e upload |
| [Telas](telas.md) | O que cada tela responde, o que oferece e como se navega entre elas |
| [Decisões de arquitetura](adr/) | Uma decisão por arquivo, com o contexto, as alternativas rejeitadas e as consequências |
| [Como contribuir](https://github.com/natanjunior/8FSDT-Hackathon/blob/main/CONTRIBUTING.md) | O que uma tarefa precisa cumprir para entrar e para fechar |

## Se a pergunta for específica

| A pergunta | Onde ela é respondida |
|---|---|
| *O desafio foi atendido?* | [Atendimento ao enunciado](atendimento-ao-enunciado.md), exigência por exigência |
| *Como a auditabilidade é garantida?* | [Domínio e regras](dominio.md), na máquina de estados e nas invariantes |
| *Como um condomínio não vê o dado do outro?* | [Segurança](seguranca.md), no ponto único por onde toda requisição passa |
| *Como isso é publicado, e como se volta atrás?* | [Infraestrutura](infraestrutura.md), na ordem da esteira |
| *O que a API expõe?* | A [referência da API](/documentacao/api/referencia), com as operações navegáveis |
| *Como rodo o projeto?* | O [README do repositório](https://github.com/natanjunior/8FSDT-Hackathon#como-rodar) |

---

Trabalho acadêmico de conclusão da Fase 5 da pós-graduação em Full Stack Development da FIAP. Sem uso
comercial.
