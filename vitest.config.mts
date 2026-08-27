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
 */
const apelido = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias: apelido },
  test: {
    // Uma suíte vazia é indistinguível de uma suíte que não roda.
    passWithNoTests: false,
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
