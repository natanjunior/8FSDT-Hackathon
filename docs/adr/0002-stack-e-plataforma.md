# ADR-0002 — Next.js com PWA, APIs próprias, Vercel e Supabase

**Status:** **Parcialmente substituída pela [ADR-0004](0004-execucao-em-container-no-azure.md)** · 20/08/2026

> **O que foi substituído:** a plataforma de **execução** (Vercel → Azure Container Apps) e o **storage de
> anexo** (Supabase Storage → Azure Blob Storage), com o acréscimo de um **registro de imagem**
> (`ghcr.io`). O motivo está na ADR-0004: a consequência negativa registrada abaixo — *"o `Dockerfile` não
> é o que roda em produção"* — deixou de ser aceitável quando se verificou que a disciplina de DevOps da
> Fase 5 ensina exatamente esse caminho, e que ele cabe no custo zero.
>
> **O que permanece válido:** Next.js com TypeScript, PWA, route handlers como APIs, GitHub e GitHub
> Actions, e **Supabase para PostgreSQL e autenticação**. O restante deste documento — inclusive as
> alternativas rejeitadas de NestJS+Angular, Spring+Angular, BaaS com regra no banco e app nativo —
> continua sendo a justificativa vigente dessas escolhas.

**Status original:** Aceita · 18/08/2026

## Contexto

O enunciado exige arquitetura, backend, APIs, banco, frontend, testes, **Docker**, **deploy em cloud** e
documentação. As restrições do projeto: **um implementador**, prazo 29/09/2026, **cloud de custo zero
obrigatório**.

A decisão foi deliberadamente adiada até depois do design estratégico, porque o curso posiciona a
escolha de tecnologia no **Design Tático** (aula 5, p.3 e p.5). Chegando aqui, o espaço já estava
bastante fechado pelas decisões de produto e pela descoberta:

- **Monolito modular** — são 2 contextos delimitados (Event Storming, passo 10), com um implementador; a
  aula 3 (p.9) autoriza explicitamente poucos contextos em solução pequena.
- **Sem mensageria, fila ou cache distribuído** — as 10 políticas do passo 6 são todas in-process e
  nenhuma escreve no agregado. A arquitetura de referência da aula 8 (microsserviços, API Gateway,
  Kafka, ELK) foi descartada componente a componente no documento de curadoria de DDD.
- **Escala não é critério** — RNF3 pede 50 organizações e 2.000 ocorrências. Qualquer stack atende.
- **Camada de domínio explícita é obrigatória** — imposta pela ADR-0001.
- **Leitura offline para o Encarregado** (RNF7), porque zelador trabalha em subsolo e casa de máquinas.
- **Registro em menos de um minuto pelo celular** (RNF6), que mitiga o risco de usabilidade — o segundo
  mais alto, segundo a análise de Cagan.

## Decisão

**Next.js** como aplicação única, com **PWA** para a leitura offline, **APIs próprias** em route
handlers, publicada na **Vercel**, com **Supabase** (PostgreSQL, Auth e Storage) como plataforma de
dados. **Ambiente de desenvolvimento local inteiramente conteinerizado**, incluindo a aplicação.

| Peça | Escolha | Por quê |
|---|---|---|
| Aplicação | Next.js (TypeScript) | Deploy único, sem CORS, sem tipos duplicados entre front e back. É a stack em que o implementador já entregou um projeto |
| Offline | **PWA** com service worker | Atende o RNF7 **sem desenvolvimento mobile nativo**. Cacheia a lista de atribuições e o detalhe do Encarregado; escrita offline não é requisito |
| APIs | Route handlers próprios | Satisfaz E3 como entregável real, e são o que o PWA consome |
| Banco · Auth · Storage | Supabase | Postgres gerenciado no free tier; `auth.users` serve como nosso agregado `Usuário` |
| Publicação | Vercel Hobby | Custo zero, e **ao bater o limite pausa em vez de cobrar** — o que transforma "custo zero" de promessa em garantia mecânica |
| Local | Docker (app + Supabase CLI) | O CLI do Supabase sobe Postgres, auth e storage em containers; acrescentamos o `Dockerfile` da aplicação |

## Duas regras que a decisão carrega

**1. A fronteira é a camada de aplicação, não o HTTP.** Em Next.js, um server component pode consultar
o banco direto e pular a API inteira — e aí metade do sistema não passa pelo que entregamos como E3.
Regra: **nem servidor nem cliente tocam o banco ou o SDK do Supabase**; os dois chamam a camada de
aplicação. Mutações e tudo que o PWA precisa passam por route handlers de verdade. Isso satisfaz E3,
respeita a ADR-0001 e evita salto HTTP desnecessário dentro do servidor.

**2. Docker inclui a aplicação, não só as dependências.** O CLI do Supabase sobe *os containers dele*.
Se E7 for lido como "a aplicação está conteinerizada", ter só as dependências em container é fino. Então
há `Dockerfile` da aplicação e um `docker compose` que levanta app + Supabase.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| **NestJS (API) + Angular (SPA)** | Separação mais "de livro", e Angular é o domínio profissional do implementador. Mas custa dois apps, dois deploys, dois pipelines, CORS e tipos duplicados — e o argumento que justificaria isso era trabalho paralelo do time, que não se aplica: a implementação é de uma pessoa. Backend Node em free tier costuma hibernar, com cold start na casa do minuto |
| **Spring Boot + Angular** | Máximo alinhamento com o dia a dia do implementador. Descartado pelo custo de deploy: Java em free tier é o mais penoso em memória e cold start, e consumiria semanas do prazo |
| **Supabase como BaaS, com a regra no banco (RLS + triggers)** | Caminho mais curto até funcionar. Mas colocaria a máquina de estados em SQL, o que **contradiz a ADR-0001** — e a auditoria com `observação` não é derivável de trigger. Ver ADR-0003 para o descarte de RLS como mecanismo primário |
| **App nativo ou React Native para o Encarregado** | Resolveria offline melhor, e custaria uma segunda base de código e uma segunda esteira de build, num projeto de um implementador. PWA atende o requisito, que é **leitura** offline |
| **Cloudflare R2 para as imagens** | 10 GB grátis e egress zero, mas é serviço, credencial e fluxo de URL assinada a mais. Com compressão no cliente para 400 KB, o storage do Supabase comporta o RNF3 recalculado. Fica registrado como caminho pronto, fora do escopo |

## Consequências

**Positivas**

- Um deploy, um pipeline, uma linguagem — o que importa muito com um implementador e seis semanas.
- PWA fecha o RNF7 e ainda ajuda o RNF6, porque service worker melhora o carregamento em rede ruim.
- A compressão de imagem no cliente atende storage **e** o requisito de registro em menos de um minuto.
- O comportamento de **pausar ao invés de cobrar** da Vercel garante mecanicamente a restrição de custo
  zero.

**Negativas e custos assumidos**

- **O `Dockerfile` não é o que roda em produção.** A Vercel executa funções, não o nosso container.
  Docker cobre desenvolvimento e build; a produção é serverless. É uma divergência real entre ambientes
  e está declarada, não disfarçada. Ler E7 como "a aplicação em produção roda no seu container" exigiria
  outra plataforma, ao custo de cold start na casa do minuto.
- **O projeto Supabase free pausa após 7 dias de inatividade.** Menos grave do que parece, porque o
  entregável é código mais documentação do deploy, e não um sistema em produção — mas se houver
  demonstração ao vivo, o banco precisa ser acordado antes. Mitigação barata: um cron semanal.
- **A Vercel Hobby proíbe uso comercial.** Não afeta a entrega acadêmica, mas é incompatível com os
  planos pagos da D13. Se o produto virar real, a plataforma muda.
- **Next.js facilita dissolver a camada de domínio.** Sem a regra 1 acima, sustentada por lint, a lógica
  vaza para o componente de tela sob pressão de prazo. É o risco de execução mais provável desta escolha.
- **Lock-in em Supabase Auth.** `auth.users` passa a ser a nossa credencial. Mitigado pelo padrão
  **Conformista + ACL** (aula 4, p.9 e p.12), que mantém `Ocorrência` sem conhecimento de token ou claim.

## Fontes

- **aula 5, p.3 e p.5** — escolha de tecnologia pertence ao Design Tático (material da disciplina).
- **aula 3, p.9** — contexto único é legítimo em solução pequena.
- **aula 4, p.9 e p.12** — Conformista e ACL para provedor externo.
- [FONTE EXTERNA] Limites verificados em 18/08/2026: [Supabase free tier](https://www.itpathsolutions.com/supabase-free-tier-limits) · [Vercel Hobby](https://www.promptstoproduct.com/vercel-free-tier-limits). As fontes divergem entre 500 MB e 1 GB de file storage no Supabase — confirmar no painel antes de fechar o RNF8.
