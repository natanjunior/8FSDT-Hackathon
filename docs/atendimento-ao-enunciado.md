---
title: "Atendimento ao enunciado"
description: "Cada exigência do desafio, onde ela está descrita, o endereço da API que a realiza e a tela onde ela acontece."
---

# Atendimento ao enunciado

Cada linha é uma exigência do desafio. A coluna do meio diz onde a solução está descrita; a da direita, o
endereço da API que a realiza e a tela onde ela acontece. Onde a exigência não vira endereço nem tela, a
coluna diz o que a cumpre.

## O que o Solicitante faz

| Exigência | Onde está descrita | Onde acontece |
|---|---|---|
| Criar conta | [O produto](produto.md) | `Criar conta` · autenticação pelo provedor |
| Autenticar-se | [O produto](produto.md) | `Entrar` |
| Registrar ocorrência com título, descrição e categoria | [Domínio e regras](dominio.md) | `POST /ocorrencias` · `Registrar ocorrência` |
| Informar a localização | [Domínio e regras](dominio.md) | mesma chamada, com a área e o complemento em texto |
| Anexar imagem | [Domínio e regras](dominio.md) | `POST /anexos/autorizacoes`, depois `POST /ocorrencias` · `Registrar ocorrência` |
| Acompanhar o andamento | [O produto](produto.md) | `GET /ocorrencias?autor=eu` · `Ocorrências` |
| Adicionar comentários | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/comentarios` · `Ocorrência` |
| Consultar o histórico | [Domínio e regras](dominio.md) | `GET /ocorrencias/{id}/linha-do-tempo` · `Ocorrência` |
| Avaliar a resolução | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/avaliar` · `Ocorrência` |

## O que o Gestor faz

| Exigência | Onde está descrita | Onde acontece |
|---|---|---|
| Visualizar todas as ocorrências | [O produto](produto.md) | `GET /ocorrencias` · `Ocorrências` |
| Filtrar por categoria, status e prioridade | [O produto](produto.md) | mesma chamada, com os três filtros · `Ocorrências` |
| Alterar a prioridade | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/alterar-prioridade` · `Ocorrência` |
| Atribuir responsável | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/atribuir-responsavel` · `Ocorrência` |
| Atualizar status | [Domínio e regras](dominio.md) | um comando por transição, nunca um campo · `Ocorrência` |
| Adicionar comentários | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/comentarios` · `Ocorrência` |
| Registrar a solução aplicada | [Domínio e regras](dominio.md) | `POST /ocorrencias/{id}/registrar-solucao-aplicada` · `Ocorrência` |
| Visualizar indicadores em um dashboard | [O produto](produto.md) | `GET /dashboard` · `Dashboard` |

## O ciclo de vida e o histórico

| Exigência | Onde está descrita | Onde acontece |
|---|---|---|
| Os cinco estados que o desafio exige, no mínimo | [Domínio e regras](dominio.md) | a máquina de estados do agregado `Ocorrência`, que acrescenta um sexto |
| Cancelar a partir dos estados em que o trabalho ainda não terminou | [Domínio e regras](dominio.md) | a tabela de transições permitidas diz de quais, e quem pode |
| Toda mudança de status gera registro com status anterior, novo status, data e horário, usuário responsável e observação | [Domínio e regras](dominio.md) | `registros_transicao`, escrita na mesma operação do comando |
| Cada transição é auditável | [Domínio e regras](dominio.md) | `GET /ocorrencias/{id}/trilha-de-auditoria` · `Trilha de auditoria` |

**A auditabilidade é a exigência que molda o desenho inteiro.** Nenhum caminho de escrita permite mudar o
status sem gravar o registro, porque o status não é campo que se edita: é resultado de um comando. O
mecanismo está em [Domínio e regras](dominio.md), e a decisão que o fixou, na
[ADR-0001](adr/0001-historico-de-transicoes-como-conceito-de-dominio.md).

## Os entregáveis técnicos

| Exigência | Onde está descrita | Como se confere |
|---|---|---|
| Descoberta do domínio | [Domínio e regras](dominio.md) | os eventos, comandos e agregados que saíram do workshop |
| Arquitetura | [Visão geral da arquitetura](visao-geral-da-arquitetura.md) | os diagramas de contexto e de blocos, e as decisões registradas |
| Backend | [Visão geral da arquitetura](visao-geral-da-arquitetura.md) | `src/dominio/`, `src/aplicacao/`, `src/infraestrutura/` |
| APIs | [referência da API](/documentacao/api/referencia) | 41 operações, conferidas contra as rotas a cada publicação |
| Banco de dados | [Banco de dados](banco-de-dados.md) | catorze tabelas em `supabase/migrations/` |
| Frontend | [Telas](telas.md) | as telas da aplicação, em `app/` |
| Testes | [Testes](testes.md) | domínio e aplicação sem banco, isolamento contra Postgres, e um de ponta a ponta num navegador |
| Docker | [Infraestrutura](infraestrutura.md) | o mesmo `Dockerfile` sobe o ambiente local e a produção |
| Deploy em cloud | [Infraestrutura](infraestrutura.md) | a aplicação publicada, com uma revisão nova por entrega |
| Documentação | esta documentação | os verificadores do portão de entrega, um deles contra o site publicado |

## O que o enunciado não fixou

O desafio deixa seis pontos em aberto, e cada um virou regra escrita:

| Em aberto no enunciado | Onde está a regra |
|---|---|
| De quais estados se pode cancelar | [Domínio e regras](dominio.md) |
| Se a avaliação é um estado | [Domínio e regras](dominio.md) |
| Quem pode cancelar | [Domínio e regras](dominio.md) |
| Quem é o responsável | [Domínio e regras](dominio.md) |
| Quais indicadores entram no dashboard | [O produto](produto.md) |
| Quais categorias existem | [Domínio e regras](dominio.md) |
