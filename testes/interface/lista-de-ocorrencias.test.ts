/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListaDeOcorrencias, ParDeDatas } from "@/interface/componentes/lista-de-ocorrencias";
import type { OcorrenciaResumoProjetada } from "@/interface/projecoes";

/**
 * ============================================================================
 *  Item 102 — a lista de T-03, renderizada
 * ============================================================================
 *
 * **O segundo arquivo do projeto que renderiza componente React**, no idioma do primeiro
 * (`titulo-e-fronteira.test.ts`): `jsdom` por diretiva, `react-dom/client`, sem `@testing-library`.
 *
 * **Dois módulos são substituídos, e só eles.** `next/link` precisa do roteador do App Router, que não
 * existe aqui; vira uma âncora. `navegacao-da-lista` dá o `pendente` e o `navegar`; vira um valor que o
 * teste controla. O resto — projeção, rótulos, tempos — é o código de verdade.
 *
 * **Os componentes entram por importação estática**, e não por `await import` dentro do caso: o primeiro
 * `import` do módulo custa segundos na suíte paralela, e dentro do caso ele estourava os 5 s do Vitest.
 * O `vi.mock` é içado acima das importações, então as substituições valem do mesmo jeito.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navegacao = vi.hoisted(() => ({ pendente: false }));

vi.mock("next/link", async () => {
  const { createElement: criar } = await import("react");
  return {
    default: ({ href, children, ...resto }: { href: string; children?: unknown } & Record<string, unknown>) =>
      criar("a", { href, ...resto }, children as never),
  };
});

vi.mock("@/interface/componentes/navegacao-da-lista", () => ({
  useNavegacaoDaLista: () => ({ navegar: () => undefined, pendente: navegacao.pendente }),
}));

/** A raiz sai de `dirname`, e não de `new URL`: o motivo está em `titulo-e-fronteira.test.ts:27-32`. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8").replace(/\r\n/gu, "\n");
}

let conteiner: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  navegacao.pendente = false;
  conteiner = document.createElement("div");
  document.body.appendChild(conteiner);
  raiz = createRoot(conteiner);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  conteiner.remove();
});

function desenhar(elemento: ReactElement): void {
  act(() => {
    raiz.render(elemento);
  });
}

/** O instante de referência dos casos: 30/09/2026, 12h UTC. */
const AGORA = Date.parse("2026-09-30T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const antes = (dias: number) => new Date(AGORA - dias * DIA).toISOString();

describe("o par de datas nomeia os dois valores — critérios 102.1 e 102.12", () => {
  it("empilhado (a tabela): cada valor com a palavra, sem ↻ e sem sr-only", async () => {
    desenhar(createElement(ParDeDatas, { registradaEm: antes(27), atualizadaEm: antes(2), agora: AGORA, empilhado: true }));

    expect(conteiner.textContent).toBe("27 dregistrada2 datualizada");
    expect(conteiner.textContent).not.toContain("↻");
    expect(conteiner.querySelector(".sr-only")).toBeNull();
  });

  it("em fileira (o celular): a mesma palavra, e o separador da linha de meta", async () => {
    desenhar(createElement(ParDeDatas, { registradaEm: antes(25), atualizadaEm: antes(0.55), agora: AGORA }));

    expect(conteiner.textContent).toBe("25 d registrada · 13 h atualizada");
    expect(conteiner.querySelector(".sr-only")).toBeNull();
  });

  it("instantes iguais: só registrada, nas duas formas, sem célula vazia na grade", async () => {
    const mesmo = antes(89);

    desenhar(createElement(ParDeDatas, { registradaEm: mesmo, atualizadaEm: mesmo, agora: AGORA, empilhado: true }));
    expect(conteiner.textContent).toBe("89 dregistrada");
    expect(conteiner.firstElementChild?.children).toHaveLength(2);

    desenhar(createElement(ParDeDatas, { registradaEm: mesmo, atualizadaEm: mesmo, agora: AGORA }));
    expect(conteiner.textContent).toBe("89 d registrada");
  });
});

function item(parcial: Partial<OcorrenciaResumoProjetada>): OcorrenciaResumoProjetada {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    titulo: "Motor do portão da garagem parado",
    status: "pausada",
    statusRotulo: "Pausada",
    motivoPausa: "aguardando_peca",
    prioridade: "normal",
    categoria: { id: "c-1", nome: "Equipamentos quebrados" },
    area: { id: "a-1", nome: "Garagem", tipo: "comum" },
    autor: { pessoaId: "p-1", nome: "Marcos Vieira" },
    responsavel: { pessoaId: "p-2", nome: "Beatriz Nunes" },
    quantidadeDeAnexos: 1,
    avaliada: false,
    paradaHaDias: null,
    registradaEm: antes(89),
    atualizadaEm: antes(74),
    ...parcial,
  };
}

async function desenharLista(itens: readonly OcorrenciaResumoProjetada[]): Promise<void> {
  desenhar(
    createElement(ListaDeOcorrencias, {
      primeiraPagina: {
        itens,
        total: itens.length,
        pagina: 1,
        limite: 20,
        ate: new Date(AGORA).toISOString(),
        totalNoCorte: itens.length,
        saidasDesdeOCorte: 0,
        novasDesdeOCorte: 0,
        contagens: {},
        visibilidadeAplicada: "todas",
      } as never,
      consultaAtual: "",
      iconePorCategoria: {},
      mostrarPrioridade: true,
      mostrarParada: true,
      agora: AGORA,
    }),
  );
}

describe("a tabela: o motivo desce, as colunas têm teto, e ela nasce em lg — critérios 102.2, 102.3 e 102.12", () => {
  it("o motivo está na linha de apoio do título, depois da categoria, e não na célula de Status", async () => {
    await desenharLista([item({})]);
    const celulas = conteiner.querySelectorAll("tbody tr td");

    expect(celulas[0]?.textContent).toBe("Pausada");
    expect(celulas[1]?.textContent).toContain(
      "Equipamentos quebrados · Parada — esperando material chegar · 1 foto",
    );
  });

  it("pela lente do Solicitante sem customização o rótulo já tem o motivo, e a linha de apoio não o repete", async () => {
    await desenharLista([item({ statusRotulo: "Parada — esperando material chegar" })]);
    const titulo = conteiner.querySelectorAll("tbody tr td")[1];

    expect(titulo?.textContent).not.toContain("Parada — esperando material chegar");
  });

  it("Onde e Responsável quebram dentro de uma caixa de 180 px", async () => {
    await desenharLista([item({})]);
    const celulas = conteiner.querySelectorAll("tbody tr td");

    for (const indice of [2, 4]) {
      const celula = celulas[indice];
      expect(celula?.className).toContain("whitespace-normal");
      expect(celula?.firstElementChild?.className).toContain("max-w-[180px]");
    }
  });

  it("a forma de tabela nasce em lg, e a linha do celular vai até lá", async () => {
    await desenharLista([item({})]);

    expect(conteiner.querySelector("ul")?.className).toContain("lg:hidden");
    expect(conteiner.querySelector("table")?.closest("div.hidden")?.className).toContain("lg:block");
    expect(conteiner.querySelector("ul")?.className).not.toContain("md:hidden");
  });
});
