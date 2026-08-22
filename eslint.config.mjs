import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ============================================================================
 *  As regras de fronteira da ADR-0006, como configuração
 * ============================================================================
 *
 * A `arquitetura.md` (Parte I, §5.2) diz que a regra de dependência é *"garantida por inversão; o lint é a
 * verificação"*, e a ADR-0006 dá três regras de importação. **Duas delas não existem sem configuração** —
 * são parágrafo até alguém escrevê-las aqui. Este arquivo escreve.
 *
 * O Definition of Done cobra: *"`lint` passando, sem exceção adicionada para fazer passar"*. Não há um
 * `eslint-disable` neste projeto. As permissões abaixo são **escopo declarado por diretório**, não
 * silenciamento de violação: cada bloco reafirma a lista inteira menos o que aquele diretório tem direito
 * de fazer — que é o que torna a autorização legível em vez de implícita.
 *
 * ---------------------------------------------------------------------------
 *  Ferramenta escolhida, e por quê
 * ---------------------------------------------------------------------------
 *
 * `no-restricted-imports`, a regra **do próprio ESLint**, com `files` por diretório. Nenhum plugin de
 * fronteira. Três razões:
 *
 * 1. **Zero dependência nova.** `eslint-plugin-boundaries` expressaria as mesmas três regras com menos
 *    repetição, e custa uma dependência a mais numa esteira que precisa continuar verde por cinco semanas,
 *    mantida por uma pessoa. A repetição aqui é visível e não quebra numa atualização de terceiro.
 * 2. **A regra opera sobre o especificador do `import`, não sobre o caminho resolvido** — o que é
 *    limitação, e a limitação está fechada: importação relativa que sai do diretório (`../…`) é **proibida
 *    em todo o `src/` e `app/`**, então toda travessia de módulo passa pelo apelido `@/`, que é
 *    determinístico e casável por padrão.
 * 3. Ela pega **`import type` também**, que é exatamente o que se quer: um tipo do driver de banco subindo
 *    para a Aplicação é o vazamento que a ADR-0005 chama de erro estrutural, e ele viaja como tipo.
 *
 * ---------------------------------------------------------------------------
 *  O que o lint alcança, e o que não
 * ---------------------------------------------------------------------------
 *
 * | Regra da ADR-0006 | Vira lint? |
 * |---|---|
 * | 1 · importação só para dentro | **sim** — `PARA_FORA_DO_*` |
 * | 2 · `infraestrutura/` só é importada por `composicao/` | **sim** — `INFRAESTRUTURA` |
 * | 2b · `composicao/` só é importada por `interface/http/` | **sim** — `COMPOSICAO` |
 * | 3 · só pela superfície pública do módulo | **sim** — `SUPERFICIE_PUBLICA` |
 * | *(sem número — não fala de camada)* `semOrganizacao` só nos quatro caminhos da lista fechada do contrato §4.4 | **sim** — `SEM_ORGANIZACAO` |
 *
 * E uma que **não é regra numerada da ADR-0006** — vem da §5.2 da `arquitetura.md`,
 * que é onde a inversão de dependência mora:
 *
 * | Origem | Vira lint? |
 * |---|---|
 * | `arquitetura.md` §5.2 · nada fora de `infraestrutura/clientes/` importa um SDK | **sim** — `SDKS` |
 *
 * A distinção importa: a numeração daqui **tem de bater com a da ADR**, senão duas
 * fontes discordam sobre o que é "a regra 1" e alguém perde meia hora daqui a três
 * semanas descobrindo qual das duas manda.
 *
 * **O que o lint não alcança, e continua sendo teste ou revisão:**
 *
 * - *"o repositório devolve agregado, nunca linha de banco"* — a assinatura é legítima; só devolve a coisa
 *   errada. O DoD já diz que a defesa é a revisão do tipo.
 * - *"consulta que envolva pessoas parte de `vinculos`"* — a consulta é legítima, só parte da tabela
 *   errada. O DoD já diz que a defesa é teste, e ele existe.
 * - *"toda consulta nova passa pelo repositório escopado"* — a defesa primária é estrutural (`app/` não
 *   alcança o cliente de banco) e há um alarme em tempo de execução em `infraestrutura/contexto/escopo.ts`.
 * - *`src/interface/componentes/`* não é tratado como módulo com superfície pública: o código dos
 *   componentes é **copiado** para o repositório pelo CLI do `shadcn/ui` (ADR-0007), e a convenção de
 *   importação um-componente-um-arquivo é a do projeto de origem. Reescrevê-la seria manter um de-para para
 *   sempre.
 */

// ---------------------------------------------------------------------------
// Os grupos proibidos, uma vez cada, para que as permissões sejam diferenças
// legíveis em vez de listas paralelas que divergem.
// ---------------------------------------------------------------------------

/** **Regra 1.** O conjunto autorizado é *um diretório*, não uma camada (ADR-0006, justificativa 2). */
const SDKS = {
  group: [
    "pg",
    "pg/*",
    "@supabase/*",
    "@supabase/*/**",
    "@azure/*",
    "@azure/*/**",
  ],
  message:
    "SDK só em src/infraestrutura/clientes/ (ADR-0006, regra 1). Banco, storage e autenticação entram por " +
    "porta declarada pela Aplicação; quem consome recebe a implementação, não o cliente (ADR-0005).",
};

/** **Regra 2.** */
const INFRAESTRUTURA = {
  group: ["@/infraestrutura", "@/infraestrutura/**"],
  message:
    "src/infraestrutura/ é importada apenas por src/composicao/ (ADR-0006, regra 2). A Aplicação declara a " +
    "porta e RECEBE a implementação — ela não tem o que importar, e é isso que torna a inversão estrutural.",
};

/**
 * **Regra 2b — nossa, acrescentada no esqueleto.** A ADR-0005 diz que quem monta é *"o route handler, a
 * camada mais externa, através de um único ponto de composição"*. Restringir o ponto de composição ao
 * ajudante de `interface/http` é mais estrito que a letra da ADR e serve exatamente ao propósito dela: um
 * `route.ts` novo **não tem como** obter porta sem passar pelo `comContexto`, e portanto não tem como
 * esquecer de resolver o contexto. É a defesa estrutural do risco nº 1 da ADR-0003.
 */
const COMPOSICAO = {
  group: ["@/composicao", "@/composicao/**"],
  message:
    "src/composicao/ é importada apenas por src/interface/http/ (regra 2b do esqueleto). Um route handler " +
    "alcança dado só pelo comContexto/semOrganizacao — que sempre resolve o contexto (ADR-0003).",
};

/** **Regra 3, primeira metade: só para dentro.** O Domínio é o anel interno: nada entra nele. */
const PARA_FORA_DO_DOMINIO = {
  group: [
    "@/aplicacao",
    "@/aplicacao/**",
    "@/interface",
    "@/interface/**",
    "next",
    "next/*",
    "next/**",
    "react",
    "react-dom",
    "server-only",
    "zod",
    "zod/*",
  ],
  message:
    "O Domínio não importa camada externa, framework nem biblioteca de validação (arquitetura.md §5: ele " +
    "não persiste e não conhece HTTP, token ou SQL). Se precisou, a regra está na camada errada.",
};

/** **Regra 3, primeira metade:** a Aplicação orquestra; ela não conhece transporte. */
const PARA_FORA_DA_APLICACAO = {
  group: [
    "@/interface",
    "@/interface/**",
    "next",
    "next/*",
    "next/**",
    "react",
    "react-dom",
  ],
  message:
    "A camada de Aplicação não importa Interface nem o framework (arquitetura.md §5). Ela resolve contexto, " +
    "orquestra e transaciona — traduzir HTTP é da camada de fora.",
};

/** A Infraestrutura implementa portas e persiste. Ela não conhece a camada de Interface. */
const PARA_A_INTERFACE = {
  group: ["@/interface", "@/interface/**"],
  message:
    "A Infraestrutura não importa Interface (arquitetura.md §5). Ela implementa a porta que a Aplicação " +
    "declarou; quem traduz HTTP e projeta resposta é a camada de fora.",
};

/**
 * **Regra 3, segunda metade: só pela superfície pública do módulo.**
 *
 * Cada módulo expõe um `index.ts`; ninguém alcança arquivo interno de outro módulo. É a regra que a
 * ADR-0006 registra como **[FONTE EXTERNA]** — nenhuma das aulas ensina princípios de componente —, e ela
 * se sustenta por mérito próprio: sem ela, `index.ts` é decoração.
 */
const SUPERFICIE_PUBLICA = {
  group: [
    "@/dominio/*/*",
    "@/dominio/*/*/**",
    "@/aplicacao/*/*",
    "@/aplicacao/*/*/**",
    "@/infraestrutura/clientes/*",
    "@/infraestrutura/contexto/*",
    "@/infraestrutura/repositorios/*/*",
    "@/composicao/*",
    "@/composicao/**",
    "@/interface/http/*",
    "@/interface/schemas/*",
    "@/interface/projecoes/*",
    "@/interface/acoes/*",
  ],
  message:
    "Importe a superfície pública do módulo, não um arquivo de dentro dele (ADR-0006, regra 3). " +
    "Ex.: @/dominio/organizacao, não @/dominio/organizacao/Vinculo.",
};

/**
 * O que fecha o buraco da nota 2 acima: sem importação relativa para fora do diretório, **toda** travessia
 * de módulo usa o apelido `@/` — e o apelido é o que os padrões acima sabem conferir.
 */
const RELATIVO_PARA_FORA = {
  group: ["../*", "../**"],
  message:
    "Sem importação relativa para fora do diretório: use o apelido @/ (ADR-0006, regra 3). É o que faz as " +
    "regras de fronteira serem conferíveis — o lint lê o especificador, não o caminho resolvido.",
};

/**
 * **A lista fechada da ADR-0003, virada mecanismo.**
 *
 * *"Exatamente quatro operações não passam pelo repositório escopado"* (contrato §4.4), e *"qualquer
 * endpoint acrescentado a esta lista é mudança de contrato que exige revisão explícita"*. Aqui o quinto
 * `route.ts` que tentar importar `semOrganizacao` **não passa no lint** — a revisão explícita passa a ser
 * uma linha neste arquivo, com o caminho do endpoint escrita nela.
 */
const SEM_ORGANIZACAO = {
  group: ["@/interface/http"],
  importNames: ["semOrganizacao"],
  message:
    "semOrganizacao é para as QUATRO operações da lista fechada do contrato §4.4 e mais nenhuma: " +
    "GET /contexto, PUT /contexto/organizacao, POST /organizacoes, POST /pedidos-de-entrada. " +
    "Acrescentar um quinto é emenda à ADR-0003, e passa por acrescentar o caminho em eslint.config.mjs.",
};

/** Os quatro `route.ts` da lista fechada. Três deles ainda não existem — e o caminho já está reservado. */
const ROTAS_SEM_ORGANIZACAO = [
  "app/api/contexto/route.ts",
  "app/api/contexto/organizacao/route.ts",
  "app/api/organizacoes/route.ts",
  "app/api/pedidos-de-entrada/route.ts",
];

const proibir = (...grupos) => ["error", { patterns: grupos }];

const configuracao = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // Verificadores de documentação: Node puro, sem TypeScript e sem apelido de módulo.
      "ferramentas/**",
      // Código copiado pelo CLI do shadcn/ui (ADR-0007) — a manutenção é nossa, o estilo é do projeto
      // de origem, e reformatá-lo a cada `add` seria trabalho perpétuo sem retorno.
      "src/interface/componentes/ui/**",
    ],
  },

  // -------------------------------------------------------------------------
  // A linha de base: vale para todo o código de produção.
  // -------------------------------------------------------------------------
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}", "testes/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        SEM_ORGANIZACAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Domínio — o anel interno. Só sai; nada entra.
  // -------------------------------------------------------------------------
  {
    files: ["src/dominio/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        PARA_FORA_DO_DOMINIO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Aplicação — declara as portas; não conhece transporte nem infraestrutura.
  // -------------------------------------------------------------------------
  {
    files: ["src/aplicacao/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        PARA_FORA_DA_APLICACAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Infraestrutura — implementa as portas. Pode importar-se a si mesma.
  // -------------------------------------------------------------------------
  {
    files: ["src/infraestrutura/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        PARA_A_INTERFACE,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // ... e `clientes/` é o único diretório do repositório que importa um SDK.
  // -------------------------------------------------------------------------
  {
    files: ["src/infraestrutura/clientes/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        PARA_A_INTERFACE,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Composição — o único lugar que importa `infraestrutura/`.
  // -------------------------------------------------------------------------
  {
    files: ["src/composicao/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        PARA_A_INTERFACE,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // `interface/http` — o ajudante do anel externo, e o único que compõe.
  // -------------------------------------------------------------------------
  {
    files: ["src/interface/http/**/*.ts", "src/interface/acoes/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(SDKS, INFRAESTRUTURA, SUPERFICIE_PUBLICA, RELATIVO_PARA_FORA),
    },
  },

  // -------------------------------------------------------------------------
  // Os quatro `route.ts` da lista fechada do contrato §4.4.
  // -------------------------------------------------------------------------
  {
    files: ROTAS_SEM_ORGANIZACAO,
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Testes — podem montar o grafo à mão, que é o ponto de existir a porta
  // (ADR-0005: substituir o repositório é passar outro argumento).
  // -------------------------------------------------------------------------
  {
    files: ["testes/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(SUPERFICIE_PUBLICA, RELATIVO_PARA_FORA, SEM_ORGANIZACAO),
    },
  },
];

export default configuracao;
