import { defineConfig, devices } from "@playwright/test";

/**
 * ============================================================================
 *  O teste de ponta a ponta — a configuração, e o que ela recusa
 * ============================================================================
 *
 * **Ele é UM, e para sempre** (ADR-0008): o que prova é binário — ou as camadas se falam, ou não se
 * falam. Um segundo só entra se provar **outro transporte**, nunca outro fluxo.
 *
 * **Na raiz porque é onde o runner a procura sem `--config`.**
 *
 * **`testDir` restrito a `testes/ponta-a-ponta`, e o motivo é espelhado ao do `vitest.config.mts`:** sem
 * isso o Playwright varreria `testes/` inteiro e tentaria rodar as suítes do Vitest. O sufixo `.spec.ts`
 * é a segunda barreira, do outro lado: os projetos do Vitest incluem `*.test.ts`, então um glob amplo que
 * alguém acrescente um dia não alcança este arquivo.
 */
export default defineConfig({
  testDir: "./testes/ponta-a-ponta",
  testMatch: "**/*.spec.ts",

  /**
   * **Zero repetição.** *"Falha intermitente com um implementador é esteira abandonada, não consertada"*
   * (ADR-0008). Repetir esconderia justamente o que este teste existe para achar.
   */
  retries: 0,

  /**
   * **Um trabalhador, em série.** São dois atores no MESMO mundo — Helena e Marcos agindo sobre a mesma
   * ocorrência —, e paralelismo produziria corrida entre eles.
   */
  workers: 1,
  fullyParallel: false,

  /**
   * **Folgado, e o número tem origem.** A pilha é Docker local com `supabase start` de pé, o percurso são
   * onze passos com duas sessões, e a primeira abertura de cada rota paga o cold start do RNF5 — que foi
   * **medido em 20,7 s** na publicação real (`arquitetura.md` §10, critério A7). Um limite apertado
   * produziria vermelho que não é defeito, que é o que a ADR-0008 recusa por nome.
   */
  timeout: 180_000,
  expect: { timeout: 20_000 },

  /**
   * **Uma falha tem de ser diagnosticável SEM rodar de novo** — rodar de novo custa a pilha inteira. Por
   * isso rastro, imagem e vídeo ficam ligados **só na falha**: no verde não custam nada.
   */
  use: {
    /**
     * **`host.docker.internal`, e NÃO `localhost`.** O `@supabase/ssr` deriva o nome do cookie de sessão
     * do host do provedor: com `127.0.0.1` grava `sb-127-auth-token`, com `host.docker.internal` grava
     * `sb-host-auth-token` (README `:96-103`). Um navegador que abrisse por `localhost` **autenticaria e
     * a sessão simplesmente não existiria do lado de dentro, sem erro nenhum** — é o modo de falha mais
     * provável deste teste, e ele é evitado por esta linha.
     */
    baseURL: process.env["URL_DA_APLICACAO"] ?? "http://host.docker.internal:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },

  /**
   * **Só Chromium.** Três navegadores multiplicariam por três o artefato mais lento do projeto para
   * provar três vezes a mesma coisa — é o mesmo argumento com que a ADR-0008 recusou quatro E2E, um por
   * atividade.
   *
   * **A viewport é a de tela grande (o padrão do `Desktop Chrome`, 1280×720)**, e é decisão: T-06 é *"a
   * única tela do inventário projetada para uma tabela larga"*, e a tabela é o que o compromisso **A-7**
   * cobra. O recorte de celular carrega a mesma informação, por construção, e é o M-3 quem o confere.
   */
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  reporter: [["list"], ["html", { open: "never" }]],

  /**
   * **Não há `webServer`, e a ausência é decisão.** A pilha é `npm run local` — `supabase start`, escrita
   * do `.env.local`, `supabase migration up` e `docker compose up --build` —, que **não é um processo**.
   * Enfiá-la num `webServer` duplicaria o procedimento do README numa segunda cópia que diverge, e
   * esconderia a falha de subida dentro do relatório do teste. **A pilha é pré-requisito declarado**, e o
   * teste falha alto quando ela não está de pé.
   */
});
