---
title: "ADR-0002 · Stack e plataforma"
description: "Next.js com PWA, APIs próprias e Supabase, com as alternativas rejeitadas e o que a ADR-0004 substituiu."
---

# ADR-0002 — Next.js com PWA, APIs próprias, Vercel e Supabase

**Status:** Parcialmente substituída pela [ADR-0004](0004-execucao-em-container-no-azure.md) · 20/08/2026
· Status original: Aceita · 18/08/2026

> A ADR-0004 substitui daqui a plataforma de execução (Vercel deu lugar ao Azure Container Apps) e o
> storage de anexo (Supabase Storage deu lugar ao Azure Blob Storage), com o acréscimo de um registro de
> imagem em `ghcr.io`. O motivo está lá: a consequência negativa registrada abaixo, a de que o
> `Dockerfile` não é o que roda em produção, deixou de ser aceitável quando se verificou que executar o
> próprio container cabe no custo zero.
>
> Permanecem válidos Next.js com TypeScript, PWA, route handlers como APIs, GitHub e GitHub Actions, e
> Supabase para PostgreSQL e autenticação. O restante deste documento, inclusive as alternativas
> rejeitadas, continua sendo a justificativa vigente dessas escolhas.

## Contexto

O enunciado exige arquitetura, backend, APIs, banco, frontend, testes, Docker, deploy em cloud e
documentação. As restrições do projeto: um implementador, prazo 29/09/2026, e cloud de custo zero
obrigatório.

A decisão foi deliberadamente adiada até depois do design estratégico. Tecnologia escolhida antes de
saber quais são os contextos delimitados vira restrição em vez de consequência, e chegando aqui o espaço
já estava bastante fechado pelas decisões de produto e pela descoberta:

- **Monolito modular.** São dois contextos delimitados, com um implementador. Poucos contextos numa
  solução deste porte é o desenho certo, e não uma concessão.
- **Sem mensageria, fila ou cache distribuído.** As dez políticas levantadas no Event Storming são todas
  in-process, e nenhuma escreve no agregado. A arquitetura de referência de microsserviços com API
  Gateway, Kafka e ELK foi descartada componente a componente.
- **Escala não é critério.** O RNF3 pede 50 organizações e 2.000 ocorrências. Qualquer stack atende.
- **Camada de domínio explícita é obrigatória**, imposta pela ADR-0001.
- **Leitura offline para o Encarregado** (RNF7), porque zelador trabalha em subsolo e casa de máquinas.
- **Registro em menos de um minuto pelo celular** (RNF6), que mitiga o risco de usabilidade, o segundo
  mais alto do projeto.

## Decisão

Next.js como aplicação única, com PWA para a leitura offline, APIs próprias em route handlers, publicada
na Vercel, com Supabase (PostgreSQL, Auth e Storage) como plataforma de dados. Ambiente de
desenvolvimento local inteiramente conteinerizado, incluindo a aplicação.

| Peça | Escolha | Por quê |
|---|---|---|
| Aplicação | Next.js (TypeScript) | Deploy único, sem CORS, sem tipos duplicados entre front e back. É a stack em que o implementador já entregou um projeto |
| Offline | PWA com service worker | Atende o RNF7 sem desenvolvimento mobile nativo. Cacheia a lista de atribuições e o detalhe do Encarregado; escrita offline não é requisito |
| APIs | Route handlers próprios | Satisfaz o requisito de APIs como entregável real, e são o que o PWA consome |
| Banco · Auth · Storage | Supabase | Postgres gerenciado no free tier; `auth.users` serve como nosso agregado `Usuário` |
| Publicação | Vercel Hobby | Custo zero, e ao bater o limite pausa em vez de cobrar, o que transforma custo zero de promessa em garantia mecânica |
| Local | Docker (app e Supabase CLI) | O CLI do Supabase sobe Postgres, auth e storage em containers; acrescentamos o `Dockerfile` da aplicação |

## Duas regras que a decisão carrega

**1. A fronteira é a camada de aplicação, e não o HTTP.** Em Next.js, um server component pode consultar
o banco direto e pular a API inteira, e aí metade do sistema não passa pelo que entregamos como API.
A regra: nem servidor nem cliente tocam o banco ou o SDK do Supabase, e os dois chamam a camada de
aplicação. Mutações e tudo que o PWA precisa passam por route handlers de verdade. Isso entrega a API
como requisito, respeita a ADR-0001 e evita salto HTTP desnecessário dentro do servidor.

**2. Docker inclui a aplicação, e não só as dependências.** O CLI do Supabase sobe os containers dele.
Se o requisito de conteinerização for lido como "a aplicação está conteinerizada", ter só as
dependências em container é fino. Então há `Dockerfile` da aplicação e um `docker compose` que levanta
os dois.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| NestJS (API) com Angular (SPA) | Separação mais canônica, e Angular é o domínio profissional do implementador. Mas custa dois apps, dois deploys, dois pipelines, CORS e tipos duplicados. O argumento que justificaria isso era trabalho paralelo do time, que não se aplica: a implementação é de uma pessoa. Backend Node em free tier costuma hibernar, com cold start na casa do minuto |
| Spring Boot com Angular | Máximo alinhamento com o dia a dia do implementador. Descartado pelo custo de deploy: Java em free tier é o mais penoso em memória e cold start, e consumiria semanas do prazo |
| Supabase como BaaS, com a regra no banco (RLS e triggers) | Caminho mais curto até funcionar. Mas colocaria a máquina de estados em SQL, o que contradiz a ADR-0001, e a auditoria com `observação` não é derivável de trigger. A ADR-0003 detalha o descarte de RLS como mecanismo primário |
| App nativo ou React Native para o Encarregado | Resolveria offline melhor, ao custo de uma segunda base de código e uma segunda esteira de build, num projeto de um implementador. PWA atende o requisito, que é leitura offline |
| Cloudflare R2 para as imagens | 10 GB grátis e egress zero, mas é serviço, credencial e fluxo de URL assinada a mais. Com compressão no cliente para 400 KB, o storage do Supabase comporta o RNF3 recalculado. Fica registrado como caminho pronto, fora do escopo |

## Consequências

**Positivas**

- Um deploy, um pipeline, uma linguagem, o que importa muito com um implementador e seis semanas.
- PWA fecha o RNF7 e ainda ajuda o RNF6, porque service worker melhora o carregamento em rede ruim.
- A compressão de imagem no cliente atende storage e o requisito de registro em menos de um minuto.
- O comportamento de pausar em vez de cobrar, na Vercel, garante mecanicamente a restrição de custo zero.

**Negativas e custos assumidos**

- **O `Dockerfile` não é o que roda em produção.** A Vercel executa funções, e não o nosso container.
  Docker cobre desenvolvimento e build; a produção é serverless. É uma divergência real entre ambientes,
  declarada e não disfarçada. Ler o requisito como "a aplicação em produção roda no seu container"
  exigiria outra plataforma, ao custo de cold start na casa do minuto. *(É esta consequência que a
  ADR-0004 derruba.)*
- **O projeto Supabase free pausa após 7 dias de inatividade.** Menos grave do que parece, porque o
  entregável é código mais documentação do deploy, e não um sistema em produção. Mas se houver
  demonstração ao vivo, o banco precisa ser acordado antes. Mitigação barata: um cron semanal.
- **A Vercel Hobby proíbe uso comercial.** Não afeta a entrega acadêmica, e é incompatível com os planos
  pagos previstos na decisão de produto D13. Se o produto virar real, a plataforma muda.
- **Next.js facilita dissolver a camada de domínio.** Sem a regra 1 acima, sustentada por lint, a lógica
  vaza para o componente de tela sob pressão de prazo. É o risco de execução mais provável desta escolha.
- **Lock-in em Supabase Auth.** O `auth.users` passa a ser a nossa credencial. Mitigado pelos padrões
  Conformista e Camada Anticorrupção, que mantêm `Ocorrência` sem conhecimento de token ou claim.

## Fontes

Limites verificados em 18/08/2026: [Supabase free tier](https://www.itpathsolutions.com/supabase-free-tier-limits)
· [Vercel Hobby](https://www.promptstoproduct.com/vercel-free-tier-limits). As fontes divergem entre
500 MB e 1 GB de file storage no Supabase; confirmar no painel antes de fechar o RNF8.
