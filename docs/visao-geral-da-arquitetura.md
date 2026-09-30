---
title: "Visão geral da arquitetura"
description: "O sistema no contexto, os blocos que o compõem, a stack escolhida contra cada requisito, e a regra de dependência entre as camadas."
---

# Visão geral da arquitetura

Uma aplicação Next.js em contêiner, com PostgreSQL e autenticação gerenciados, publicada no Azure
Container Apps. A interface e a API sobem no mesmo contêiner, e a documentação que você está lendo é
servida por ele.

## O sistema no contexto

```mermaid
flowchart TB
    SOL["Solicitante<br/>morador, funcionário"]
    GES["Gestor<br/>síndico, administrador"]

    APP["Resolve Aí<br/>Next.js em contêiner<br/>no Azure Container Apps"]

    AUTH["Supabase Auth<br/>contas e sessões"]
    BD[("Supabase PostgreSQL<br/>ocorrências e trilha")]
    BLOB["Azure Blob Storage<br/>as imagens anexadas"]

    SOL -->|registra e acompanha| APP
    GES -->|tria, atribui e fecha| APP
    APP -->|valida a sessão| AUTH
    APP -->|lê e grava| BD
    APP -->|emite credencial temporária| BLOB
    SOL -->|envia a foto direto| BLOB
```

**A foto não passa pela aplicação.** O servidor emite uma credencial de escrita temporária e restrita, e o
aparelho envia a imagem direto para o armazenamento. Os bytes nunca atravessam o contêiner, o que preserva
a franquia gratuita de processamento, e a chave da conta de armazenamento nunca sai do servidor.

## Os blocos que compõem a aplicação

```mermaid
flowchart TB
    subgraph NAVEGADOR["No aparelho"]
        PWA["Aplicação instalável<br/>telas e formulários"]
    end

    subgraph CONTAINER["No contêiner"]
        TELAS["Interface<br/>rotas, telas e tradução de HTTP"]
        APLIC["Aplicação<br/>contexto da requisição, orquestração, transação"]
        DOM["Domínio<br/>o agregado Ocorrência e as regras"]
        INFRA["Infraestrutura<br/>repositórios, clientes e o ponto único de escopo"]
        DOCS["Documentação<br/>as páginas que você está lendo"]
    end

    PWA -->|HTTP| TELAS
    TELAS --> APLIC
    APLIC --> DOM
    APLIC --> INFRA
    INFRA --> DOM
```

As setas são a **regra de dependência**: tudo aponta para dentro, e o Domínio não aponta para nada. A
Infraestrutura depende do Domínio porque implementa portas que o Domínio declara, e não o contrário.

| Camada | O que pode | O que não pode |
|---|---|---|
| Interface | traduzir HTTP, validar formato, montar a resposta | conter regra de negócio, tocar o banco |
| Aplicação | resolver o contexto, orquestrar, transacionar | conter regra de negócio |
| Domínio | todas as regras, incluindo a máquina de estados | persistir, conhecer HTTP, token ou SQL |
| Infraestrutura | persistência, armazenamento, chamada externa | decidir regra |

**A regra é conferida por máquina.** Cinco regras de importação no `eslint.config.mjs` recusam o que a
tabela proíbe: importação só para dentro e só pela superfície pública do módulo, nenhum pacote de terceiro
fora da pasta de clientes, o escopo por organização dispensado apenas pelos seis endereços da lista fechada
do contrato, e a sessão dispensada apenas pelo convite. Uma importação que desrespeite a tabela falha o
build.

## Os dois contextos do domínio

| Contexto | O que abriga | Por que é separado |
|---|---|---|
| **Ocorrências** | a `Ocorrência` com o ciclo de vida e a trilha, e a conversa dentro dela | é o coração do produto, e onde toda a modelagem foi gasta |
| **Organização e acesso** | a `Organização`, a `Pessoa`, o vínculo entre as duas, e o usuário do provedor | resolve quem é quem e o que cada um pode, sem valor próprio |

A fronteira entre os dois é o momento em que a ocorrência é registrada. Antes dele a pergunta é *quem é
você e onde você está*; depois, *o que acontece com este problema*. É uma fronteira do domínio, e não de
organização de código: os dois lados falam línguas diferentes, e a mesma palavra muda de sentido ao
atravessá-la. "Responsável" em um deles é o papel de quem executa; no outro, a pessoa a quem esta
ocorrência foi atribuída.

O detalhe do modelo está em [Domínio e regras](dominio.md).

## A stack, contra o requisito que a escolheu

| Tecnologia | O requisito que a justifica |
|---|---|
| Next.js com TypeScript | interface e API na mesma entrega, sem CORS nem tipos duplicados entre as duas |
| Aplicação instalável, com trabalhador de serviço | o registro em menos de um minuto pelo celular, que depende de a aplicação abrir do atalho na tela inicial, e a volta a ela, que pinta uma casca guardada enquanto o contêiner inicia |
| Rotas de API próprias, em Next.js | as APIs são entregável, e o mesmo servidor as serve à interface |
| Supabase PostgreSQL | a auditabilidade exige gravar a transição e o registro na mesma transação |
| Supabase Auth | contas e sessões são problema resolvido por terceiros, comprado em vez de construído |
| Azure Blob Storage | a imagem por ocorrência, sem teto de arquivo e sem custo relevante |
| Docker, com a mesma imagem em produção | a conteinerização que o desafio exige, sem ambiente de desenvolvimento diferente do publicado |
| Azure Container Apps | publicação em nuvem dentro de uma franquia gratuita permanente |
| GitHub Actions e GitHub Container Registry | a esteira e o registro da imagem, no mesmo lugar onde o código mora |
| Tailwind CSS com shadcn/ui | o risco de usabilidade: foco, teclado e leitores de tela corretos sem construí-los |
| Vitest e Playwright | a máquina de estados testável em milissegundos, e o caminho crítico exercido num navegador |

A partida a frio tem duas metades, cobertas por peças diferentes. A primeira visita depende de o contêiner
já estar acordado, e é a sonda descrita em [Infraestrutura](infraestrutura.md) que o mantém assim nos dias
em que alguém de fora vai abrir a aplicação. No retorno pelo mesmo navegador, o trabalhador de serviço
pinta a casca guardada na hora e a troca pela tela quando o servidor responde. A espera pelo servidor
continua a mesma; o que muda é a tela em que ela acontece
([ADR-0020](adr/0020-o-navegador-guarda-so-a-casca.md)).

Cada escolha tem alternativa rejeitada registrada nas
[decisões de arquitetura](adr/), que são a leitura seguinte para quem quer o porquê.

## Da máquina ao ar

```mermaid
flowchart TB
    DEV["Máquina de quem implementa<br/>o mesmo Dockerfile"]
    CI["GitHub Actions<br/>verificações e migrações"]
    REG["GitHub Container Registry<br/>a imagem publicada"]
    ACA["Azure Container Apps<br/>uma revisão nova por entrega"]

    DEV --> CI
    CI --> REG
    REG --> ACA
```

**Publicar é mesclar.** A esteira verifica, aplica as migrações do banco, constrói a imagem, publica e cria
uma revisão nova, nessa ordem — porque voltar atrás na aplicação é imediato e no banco não é. Voltar atrás
é reapontar o tráfego para a revisão anterior, sem reconstruir nada.

**O ambiente local sobe a pilha inteira em contêiner**, com o mesmo `Dockerfile` que vai para a produção. O
que roda na máquina de quem desenvolve é o que roda no ar, e é a esteira quem prova isso, subindo a pilha
do zero num servidor limpo a cada entrega.

A ordem dos passos, o caminho de volta e o que a franquia gratuita impõe estão em
[Infraestrutura](infraestrutura.md).

O passo a passo de como rodar está no
[README do repositório](https://github.com/natanjunior/8FSDT-Hackathon#como-rodar).
