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
     * **`localhost`, e o alvo MUDOU — em 22/09/2026, por medição.** Até aqui esta linha apontava para
     * `host.docker.internal:3000`, e o teste **morria no passo 1**: a escolha de organização não
     * acontecia e a página voltava para T-02. É o achado A-10.
     *
     * **A causa, e ela não é do teste.** O cookie de organização sai com `Secure`
     * (`cookie-de-organizacao.ts`, `NODE_ENV=production` também no contêiner local), e o Chromium
     * **descarta `Secure` sobre `http://` em host que não é loopback**. `host.docker.internal` não é
     * loopback; `localhost` é.
     *
     * **O que esta linha antes afirmava era falso, e foi medido.** A versão anterior dizia que o
     * `@supabase/ssr` derivaria o nome do cookie de sessão da origem do navegador, e que por isso
     * `localhost` perderia a sessão. O nome vem do **host da URL do provedor** — `SUPABASE_URL`, que é
     * variável do servidor. Sonda de 22/09/2026, Helena entrando e escolhendo organização nas três
     * origens:
     *
     * | Origem | Cookie de sessão | Cookie de organização | Desfecho |
     * |---|---|---|---|
     * | `host.docker.internal:3000` | `sb-host-auth-token` | descartado | preso em T-02 |
     * | `localhost:3000` | `sb-host-auth-token` | guardado | chega em `/ocorrencias` |
     * | `127.0.0.1:3000` | `sb-host-auth-token` | guardado | chega em `/ocorrencias` |
     *
     * **O mesmo nome nas três.** A origem do navegador não decide o nome do cookie de sessão.
     *
     * **O que este teste deixou de exercitar, e está dito em voz alta:** ele não passa mais pelo host
     * que o README manda usar para navegar à mão. O `Secure` sobre `http://` em host não-loopback
     * continua descartado, e **nada aqui conserta isso** — produção usa HTTPS e não é afetada. Quem
     * navegar à mão por `host.docker.internal` continua esbarrando no A-10.
     */
    baseURL: process.env["URL_DA_APLICACAO"] ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    /**
     * **O trabalhador de serviço bloqueado por padrão** (item 98). As jornadas provam outra coisa, e uma
     * casca intercalada numa navegação lenta da pilha local viraria recarga no meio de uma afirmação:
     * vermelho que não é defeito, o que a ADR-0012 recusa. Só o teste do retorno, em
     * `nascimento-de-organizacao.spec.ts`, abre contexto com `serviceWorkers: "allow"`.
     */
    serviceWorkers: "block",
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

  /**
   * **O `json` existe para uma coisa só, e ela não é gente lendo.** O `npm run mapa:roteiro` lê esse
   * arquivo para descobrir quais itens do roteiro de validação cada teste afirma cobrir — a declaração
   * vive em `annotations`, e o `list` e o `html` não a devolvem em forma que uma ferramenta leia.
   *
   * **Ele cai em `test-results/`, que o `.gitignore` já cobre.** O mapa é gerado, nunca versionado, e
   * ninguém precisa do relatório depois que o mapa existe.
   */
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "test-results/relatorio.json" }],
  ],

  /**
   * **Não há `webServer`, e a ausência é decisão.** A pilha é `npm run local` — `supabase start`, escrita
   * do `.env.local`, `supabase migration up` e `docker compose up --build` —, que **não é um processo**.
   * Enfiá-la num `webServer` duplicaria o procedimento do README numa segunda cópia que diverge, e
   * esconderia a falha de subida dentro do relatório do teste. **A pilha é pré-requisito declarado**, e o
   * teste falha alto quando ela não está de pé.
   */
});
