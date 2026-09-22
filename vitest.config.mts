import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

/**
 * Vitest — a ferramenta que a `arquitetura.md` (Parte II, §2 e §7) escolheu, por um motivo concreto: *"o
 * RNF2 e a máquina de estados testáveis **sem banco**, em milissegundos"*.
 *
 * O apelido `@/` é o mesmo do `tsconfig.json`: sem ele o teste importaria por caminho relativo, e a regra de
 * fronteira do lint — que lê o especificador do `import` — deixaria de valer dentro de `testes/`.
 *
 * **Dois projetos, e a separação é a da §7.** `unitario` roda em qualquer clone, sem nada instalado.
 * `integracao` exige Postgres, e é onde vive o teste do critério A4 — *organização A não vê dado de B* —,
 * que **não pode** ser feito em memória: o que ele mede é a consulta que vai ao banco. Os dois rodam no
 * pipeline; só o primeiro está no `npm run teste`, que é o laço curto de quem implementa.
 *
 * **As quatro pastas de `unitario` espelham as quatro camadas de `src/`**, e nenhuma delas toca banco:
 * `interface/` confere schema, `infraestrutura/` confere o ACL com o SDK do provedor **simulado**. Pasta de
 * teste que não estiver nesta lista **não é executada e não falha** — que é a pior forma de um portão ser
 * marcado sem ser cumprido.
 *
 * **E há UMA pasta de teste fora desta lista de propósito, desde o item 41b: `testes/ponta-a-ponta/`.**
 * Ela tem outro runner — Playwright, `playwright.config.ts` na raiz, `npm run teste:ponta-a-ponta` — e
 * exige a pilha de pé, então não pode entrar no laço curto. O sufixo dela é `.spec.ts`, e não `.test.ts`,
 * para que um glob amplo acrescentado um dia continue não a alcançando.
 */
const apelido = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias: apelido },
  test: {
    // Uma suíte vazia é indistinguível de uma suíte que não roda.
    passWithNoTests: false,

    /**
     * **Cobertura é medição, e nunca portão.** Não há `thresholds` aqui, e a ausência é decisão: a
     * ADR-0008 recusou *"meta de cobertura em porcentagem"* por medir linha executada em vez de garantia
     * protegida, e esse argumento continua de pé. O que ela não recusou foi **saber o número**, que é
     * outra coisa e é o que este bloco produz. Por isso a cobertura mora em `npm run cobertura`, e não
     * em `npm run teste`: o laço curto e o portão não pagam os segundos a mais.
     *
     * **`include` nomeia o que é produto, e a lista curta é o ponto.** Sem ela o `v8` conta apenas o
     * arquivo que algum teste importou — recorte que apaga os arquivos sem teste nenhum e devolve um
     * número alto por construção. Com ela, o que ninguém cobre aparece como zero, que é o dado útil.
     *
     * **`app/**` entra de propósito, e vai marcar perto de zero.** É produto, e o zero é a afirmação
     * verdadeira de que só o Playwright o percorre, fora desta instrumentação. Escondê-lo inflaria o
     * número escondendo justamente onde o risco mora.
     *
     * **`semente/` fica de fora** por omissão do `include`: é dado de demonstração. O que nela é regra
     * (`semente/plano.ts`) já tem teste no portão.
     */
    coverage: {
      provider: "v8",
      reportsDirectory: ".cobertura",
      reporter: ["text-summary", "json-summary"],
      include: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: [
        // Gerado pelo shadcn (`components.json`, estilo `new-york`). O projeto não o escreveu e não o
        // mantém; contá-lo mediria a régua de outra pessoa.
        "src/interface/componentes/ui/**",
        // Ligação com o Fumadocs, sem regra própria.
        "src/interface/documentacao/**",
        // Estrutura do App Router, sem regra própria.
        "app/**/loading.tsx",
        "app/**/layout.tsx",
      ],
    },

    projects: [
      {
        resolve: { alias: apelido },
        test: {
          name: "unitario",
          include: [
            "testes/dominio/**/*.test.ts",
            "testes/aplicacao/**/*.test.ts",
            "testes/interface/**/*.test.ts",
            "testes/infraestrutura/**/*.test.ts",
            // **Arquivo avulso, e a exceção é declarada.** As quatro pastas acima espelham as quatro
            // camadas de `src/`; este teste não é de camada nenhuma — ele prova a função que decide onde a
            // suíte de integração escreve. Mora em `testes/integracao/` porque o lint proíbe importar por
            // `../` dentro de `testes/` (ADR-0006, regra 3), então módulo e teste ficam lado a lado. Mas o
            // que ele prova é **puro**, e tem de rodar no laço curto — por isso entra aqui, e sai do
            // projeto `integracao` logo abaixo.
            "testes/integracao/banco.test.ts",
            // **O segundo arquivo avulso, e pela mesma razão que o primeiro.** `semente/` não é camada
            // de `src/` e não tem apelido `@/` próprio, então módulo e teste ficam lado a lado — e o que
            // ele prova é **puro**: a forma do plano, sem banco nenhum. Estar aqui significa estar dentro
            // do `npm run teste`, logo dentro do `npm run verificar`: **plano quebrado trava merge de
            // qualquer item**, não só deste.
            "semente/plano.test.ts",
          ],
          environment: "node",
        },
      },
      {
        resolve: { alias: apelido },
        test: {
          name: "integracao",
          include: ["testes/integracao/**/*.test.ts"],
          // Ele já roda no projeto `unitario`, e é puro. Sem esta linha rodaria duas vezes, a segunda
          // exigindo um Postgres de que não precisa. `configDefaults.exclude` vem junto porque `exclude`
          // **substitui** o padrão do Vitest em vez de complementá-lo — sem o spread, os
          // `**/node_modules/**` do default deixariam de valer para este projeto.
          exclude: [...configDefaults.exclude, "testes/integracao/banco.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // **Um banco só, e cada arquivo derruba e recria o esquema.** Em paralelo, o `beforeAll` de um
          // arquivo apagaria as tabelas que o outro está usando — falha intermitente que não é defeito, e
          // falha intermitente com um implementador é esteira abandonada, não consertada (ADR-0008).
          fileParallelism: false,
        },
      },
    ],
  },
});
