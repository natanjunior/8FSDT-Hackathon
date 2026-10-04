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
 * | *(sem número — não fala de camada)* `semOrganizacao` só nos cinco caminhos da lista fechada do contrato §4.4 | **sim** — `SEM_ORGANIZACAO` |
 * | *(sem número)* `portasDeAnexo` só no único `route.ts` que emite credencial de upload | **sim** — `PORTAS_DE_ANEXO` |
 * | *(sem número)* `armazenamentoDeAnexos` só nos dois `route.ts` que reivindicam ou leem anexo | **sim** — `ARMAZENAMENTO_DE_ANEXOS` |
 * | *(sem número)* `semSessao` e as duas estradas diretas só nas rotas e nas páginas dos dois convites | **sim** — `SEM_SESSAO` |
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
    "@/interface/exportacao/*",
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
 * *"Exatamente cinco operações não passam pelo repositório escopado"* (contrato §4.4), e *"qualquer
 * endpoint acrescentado a esta lista é mudança de contrato que exige revisão explícita"*. Aqui o sexto
 * `route.ts` que tentar importar `semOrganizacao` **não passa no lint** — a revisão explícita passa a ser
 * uma linha neste arquivo, com o caminho do endpoint escrita nela.
 */
const SEM_ORGANIZACAO = {
  group: ["@/interface/http"],
  importNames: ["semOrganizacao"],
  message:
    "semOrganizacao é para as CINCO operações da lista fechada do contrato §4.4 e mais nenhuma: " +
    "GET /contexto, PATCH /contexto/pessoa, PUT /contexto/organizacao, POST /organizacoes, " +
    "POST /pedidos-de-entrada. Acrescentar um sexto é emenda à ADR-0003, e passa por acrescentar o " +
    "caminho em eslint.config.mjs.",
};

/** Os cinco `route.ts` da lista fechada. Os cinco existem. */
const ROTAS_SEM_ORGANIZACAO = [
  "app/api/contexto/route.ts",
  "app/api/contexto/pessoa/route.ts",
  "app/api/contexto/organizacao/route.ts",
  "app/api/organizacoes/route.ts",
  "app/api/pedidos-de-entrada/route.ts",
];

/**
 * **A segunda lista fechada do projeto**, e o motivo é irmão do primeiro.
 *
 * `portasDeAnexo` entrega o emissor de credencial de escrita no storage e o livro-caixa global do limite —
 * duas portas que **não** passam pelo repositório escopado. Um `route.ts` que as alcançasse sem passar
 * pelo `comContexto` poderia assinar SAS sem sessão. Aqui o segundo arquivo que tentar importá-la não
 * passa no lint, e acrescentá-lo é uma linha escrita de propósito.
 */
const PORTAS_DE_ANEXO = {
  group: ["@/interface/http"],
  importNames: ["portasDeAnexo"],
  message:
    "portasDeAnexo é de POST /anexos/autorizacoes e mais nenhum endpoint: ela entrega o emissor de SAS e " +
    "o livro-caixa global do limite de 30/h, que não passam pelo repositório escopado. Acrescentar um " +
    "segundo consumidor passa por acrescentar o caminho em eslint.config.mjs.",
};

/** O único `route.ts` que emite credencial de upload. */
const ROTA_DE_ANEXO = ["app/api/anexos/autorizacoes/route.ts"];

/**
 * **A terceira lista fechada.**
 *
 * `armazenamentoDeAnexos` entrega a porta que lê objeto no storage, troca a etiqueta `estado` e assina
 * **SAS de leitura**. É capacidade diferente da de `portasDeAnexo`, que assina SAS de **escrita** e
 * consome o limite de 30/h — por isso são duas listas, e não uma alargada.
 */
const ARMAZENAMENTO_DE_ANEXOS = {
  group: ["@/interface/http"],
  importNames: ["armazenamentoDeAnexos"],
  message:
    "armazenamentoDeAnexos é de POST /ocorrencias e de GET /ocorrencias/{id}/anexos/{anexoId}, e mais " +
    "nenhum endpoint: ela lê objeto no storage, troca a etiqueta de estado e assina SAS de LEITURA. " +
    "Acrescentar um terceiro consumidor passa por acrescentar o caminho em eslint.config.mjs.",
};

/**
 * Os dois `route.ts` que reivindicam ou leem anexo.
 *
 * **`[[]` e `[]]` no lugar de `[` e `]`, e não é enfeite:** o `files` do ESLint casa por *glob*, e ali
 * `[ocorrenciaId]` é uma **classe de caracteres** — casaria `c`, `o`, `r`… e nunca o diretório literal do
 * App Router. `[[]` é a classe que contém `[`, e `[]]` a que contém `]`; as duas dão o caractere
 * literal, sem contrabarra (que o glob desliga em caminho do Windows).
 */
const ROTAS_DE_ARMAZENAMENTO = [
  "app/api/ocorrencias/route.ts",
  "app/api/ocorrencias/[[]ocorrenciaId[]]/anexos/[[]anexoId[]]/route.ts",
];

/**
 * **A quarta lista fechada** (item 86, ADR-0018; ampliada pelo item 121, ADR-0021).
 *
 * `semSessao` e as duas estradas diretas entregam as duas portas que rodam **sem sessão**: o nome e o
 * código de uma organização a partir do código, e o nome de uma pessoa, o da organização e o papel a
 * partir do token do convite pessoal. Um terceiro consumidor é um terceiro lugar em que alguém sem conta
 * lê o banco, e isso é ADR nova.
 */
const SEM_SESSAO = {
  group: ["@/interface/http"],
  importNames: ["semSessao", "resolverConviteParaTela", "resolverConvitePessoalParaTela"],
  message:
    "semSessao, resolverConviteParaTela e resolverConvitePessoalParaTela são das rotas e das páginas dos " +
    "dois convites (GET /convites/{codigo}, /convite/{codigo}, GET /convites-pessoais/{token} e " +
    "/convite-pessoal/{token}), e de mais nenhum arquivo: são as duas leituras do produto sem sessão " +
    "(ADR-0021). Acrescentar outro consumidor é ADR nova, e passa por acrescentar o caminho em " +
    "eslint.config.mjs.",
};

/** Os quatro arquivos dos dois convites. Os colchetes literais seguem a regra de `ROTAS_DE_ARMAZENAMENTO`. */
const ARQUIVOS_SEM_SESSAO = [
  "app/api/convites/[[]codigo[]]/route.ts",
  "app/convite/[[]codigo[]]/page.tsx",
  "app/api/convites-pessoais/[[]token[]]/route.ts",
  "app/convite-pessoal/[[]token[]]/page.tsx",
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
      // **Saída do Playwright, e a falta destas duas linhas era um defeito com gatilho retardado.**
      //
      // As duas estão no `.gitignore` (`:37-38`) — mas **`.gitignore` não é `eslintignore`**, e o flat
      // config do ESLint 9 só ignora o que está declarado aqui. Então a árvore ficava limpa no git e o
      // `npm run lint` passava a ler o **bundle minificado do relatório de rastro** do Playwright: 257
      // erros de `react-hooks/rules-of-hooks` em colunas de quatro dígitos, sobre uma função chamada `be`.
      //
      // O gatilho é o que tornava isto difícil: só aparece **depois** de alguém rodar
      // `npm run teste:ponta-a-ponta` — que é exatamente o que o README manda fazer. Num clone limpo, e
      // no runner da esteira, os diretórios não existem e o portão fica verde. *(Achado em 02/09/2026,
      // mesclando o Lote 10.)*
      "playwright-report/**",
      "test-results/**",
      // Verificadores de documentação: Node puro, sem TypeScript e sem apelido de módulo.
      "ferramentas/**",
      // Código copiado pelo CLI do shadcn/ui (ADR-0007) — a manutenção é nossa, o estilo é do projeto
      // de origem, e reformatá-lo a cada `add` seria trabalho perpétuo sem retorno.
      "src/interface/componentes/ui/**",
      // **O gancho que o CLI do shadcn copiou, e só ele.** O `components.json` mapeia o apelido `hooks`
      // para `src/interface/ganchos/`, e o `use-mobile.ts` veio junto com o `sidebar` em 13/09/2026:
      // ele chama `setState` no corpo de um efeito, que a regra `react-hooks/set-state-in-effect` reprova
      // com razão para **código escrito**, e reescrevê-lo seria desfeito no próximo `shadcn add sidebar`.
      //
      // **A pasta deixou de ser só de código copiado no item 44g**, que pôs lá os dois ganchos escritos
      // do produto. Ignorar a pasta inteira os deixaria sem regra de fronteira e sem `react-hooks`, que é
      // uma exceção de lint por endereço. Então a exceção nomeia o arquivo, e o próximo gancho que o CLI
      // copiar para cá aparece no lint e entra nesta lista por nome.
      "src/interface/ganchos/use-mobile.ts",
      // Saída do `fumadocs-mdx`: os `.md` de `docs/` transformados em módulos, gerados pelo `postinstall`
      // e regerados a cada build. São três arquivos com `@ts-nocheck` no topo e um `{}` na assinatura,
      // que é exatamente o que duas regras nossas proíbem — e proíbem com razão, para **código escrito**.
      // Pela mesma lógica do `ferramentas/**` acima: o que não escrevemos não seguimos formatando.
      ".source/**",
      // **Ferramenta de quem desenvolve, e o mesmo gatilho retardado do `playwright-report/` acima.**
      //
      // `.claude/` está no `.gitignore` (`:19`), e por isso a árvore fica limpa no git. Mas o flat config
      // só ignora o que está declarado aqui — e um `git worktree` criado em `.claude/worktrees/` traz um
      // `.next/` inteiro junto. Medido em 10/09/2026: **81.264 problemas**, quase todos sobre bundles
      // minificados de uma cópia de trabalho, num clone onde `npm run lint` passava até a véspera.
      //
      // O gatilho é o mesmo de lá: só aparece **depois** de alguém criar uma worktree, e some quando ela
      // é removida. No runner da esteira o diretório não existe, e o portão fica verde sem que nada disto
      // tenha sido conferido.
      ".claude/**",
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
        PORTAS_DE_ANEXO,
        ARMAZENAMENTO_DE_ANEXOS,
        SEM_SESSAO,
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
  // Os cinco `route.ts` da lista fechada do contrato §4.4.
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
        // Estes cinco dispensam `SEM_ORGANIZACAO` — é o que os define. Não
        // dispensam `PORTAS_DE_ANEXO`: são listas fechadas DIFERENTES, e
        // nenhum deles emite credencial de upload.
        //
        // **Sem esta linha a segunda lista não fecharia**, e o furo seria
        // silencioso: cada bloco de `files` SUBSTITUI a regra da linha de base
        // para aqueles arquivos em vez de somar-se a ela, então omiti-la aqui
        // daria a estes cinco `route.ts` acesso livre a `portasDeAnexo` — uma
        // lista de seis arquivos, não de um.
        PORTAS_DE_ANEXO,
        // Pela mesma razão, e é a terceira lista: nenhum destes cinco
        // reivindica nem lê anexo.
        ARMAZENAMENTO_DE_ANEXOS,
        // E a quarta: os cinco resolvem a sessão antes de tudo, e nenhum deles
        // roda sem ela.
        SEM_SESSAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // O único `route.ts` que emite credencial de upload (spec do item 13a §3.1).
  // -------------------------------------------------------------------------
  {
    files: ROTA_DE_ANEXO,
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        // Simétrico ao bloco acima: este dispensa `PORTAS_DE_ANEXO` e mantém
        // `SEM_ORGANIZACAO` — ele é escopado, e passa pelo `comContexto`.
        SEM_ORGANIZACAO,
        // E mantém a terceira: emitir credencial de upload não dá o direito de
        // ler objeto, trocar etiqueta e assinar SAS de leitura.
        ARMAZENAMENTO_DE_ANEXOS,
        // E a quarta: quem assina SAS exige sessão, e sempre exigiu.
        SEM_SESSAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Os dois `route.ts` que alcançam o storage para reivindicar ou ler (item 13b).
  // -------------------------------------------------------------------------
  {
    files: ROTAS_DE_ARMAZENAMENTO,
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        // Estes dois dispensam `ARMAZENAMENTO_DE_ANEXOS` — é o que os define.
        //
        // **E mantêm as OUTRAS DUAS listas fechadas, que são independentes:**
        // `SEM_ORGANIZACAO` porque nenhum dos dois está na lista da §4.4 do
        // contrato — os dois são escopados —, e `PORTAS_DE_ANEXO` porque
        // nenhum dos dois emite credencial de upload. Omitir qualquer uma
        // delas aqui abriria aquela lista em silêncio, que é exatamente o
        // defeito que o bloco dos cinco foi escrito para impedir.
        SEM_ORGANIZACAO,
        PORTAS_DE_ANEXO,
        // E a quarta, pela mesma razão: os dois exigem sessão.
        SEM_SESSAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // Os quatro arquivos dos dois convites, os únicos que rodam sem sessão (item 86, item 121).
  // -------------------------------------------------------------------------
  {
    files: ARQUIVOS_SEM_SESSAO,
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        COMPOSICAO,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        // Dispensam `SEM_SESSAO`, que é o que os define, e mantêm as outras três: nenhum dos quatro está
        // na lista da §4.4, nem emite credencial de upload, nem lê anexo.
        SEM_ORGANIZACAO,
        PORTAS_DE_ANEXO,
        ARMAZENAMENTO_DE_ANEXOS,
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
      "no-restricted-imports": proibir(
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        SEM_ORGANIZACAO,
        PORTAS_DE_ANEXO,
        ARMAZENAMENTO_DE_ANEXOS,
        SEM_SESSAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // `semente/` — o programa de demonstração (item 43).
  //
  // **Ele NÃO está na linha de base** (`app/`, `src/`, `testes/`), então sem
  // este bloco nasceria sem restrição de fronteira nenhuma — que é o oposto do
  // que se quer de um diretório novo que atravessa o domínio inteiro.
  //
  // O que ele dispensa é `COMPOSICAO`, e é o que o define: a semente monta o
  // MESMO grafo que a produção monta, e é o TERCEIRO consumidor do ponto de
  // composição, ao lado de `interface/http` e de `interface/acoes`. Isso não
  // afrouxa a regra 2b — o que ela protege é `app/` não alcançar porta sem
  // passar pelo `comContexto`, e `app/` continua sem alcançar `@/composicao`.
  //
  // `SUPERFICIE_PUBLICA` continua valendo, e é ela que obriga o import a ser
  // `@/composicao` e nunca `@/composicao/index`.
  // -------------------------------------------------------------------------
  {
    files: ["semente/**/*.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        INFRAESTRUTURA,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        SEM_ORGANIZACAO,
        PORTAS_DE_ANEXO,
        ARMAZENAMENTO_DE_ANEXOS,
        SEM_SESSAO,
      ),
    },
  },

  // -------------------------------------------------------------------------
  // ... e `remocao.ts` é o ÚNICO arquivo fora de `src/composicao/` que alcança
  // `infraestrutura/`.
  //
  // **Precisa alcançar, e a razão é que não há capacidade a chamar:** o produto
  // não tem "apagar organização", e não vai ter — apagar dados de negócio não é
  // capacidade de produto. O `--apagar` é DELETE administrativo, e fica num
  // arquivo só para que a exceção seja legível em vez de espalhada.
  //
  // **`SDKS` continua proibido**, e é o que separa esta autorização de uma
  // porta aberta: ela usa `criarConsulta`/`criarTransacao`, nunca o `pg`.
  //
  // **Vem DEPOIS do bloco acima de propósito:** os dois casam este arquivo, e
  // para a mesma regra o último `files` vence. Invertê-los apagaria esta
  // autorização em silêncio.
  // -------------------------------------------------------------------------
  {
    files: ["semente/remocao.ts"],
    rules: {
      "no-restricted-imports": proibir(
        SDKS,
        SUPERFICIE_PUBLICA,
        RELATIVO_PARA_FORA,
        SEM_ORGANIZACAO,
        PORTAS_DE_ANEXO,
        ARMAZENAMENTO_DE_ANEXOS,
        SEM_SESSAO,
      ),
    },
  },
];

export default configuracao;
