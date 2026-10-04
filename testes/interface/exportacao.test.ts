import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { OcorrenciaExportadaLida } from "@/aplicacao/ocorrencia";
import type { VinculoLido } from "@/aplicacao/organizacao";
import { dataEHoraDoArquivo, diaDoArquivo } from "@/interface/componentes/datas";
import {
  BOM,
  COLUNAS_DE_AREAS,
  COLUNAS_DE_CATEGORIAS,
  COLUNAS_DE_OCORRENCIAS,
  COLUNAS_DE_PARTICIPANTES,
  montarCsv,
  nomeDoArquivo,
  type Celula,
  type ColunaDoArquivo,
} from "@/interface/exportacao";
import { nomeDoStatus } from "@/interface/projecoes";

/** O inverso de `montarCsv`, só para a prova da ida e volta (RFC 4180 com `;`). */
function lerCsv(texto: string): string[][] {
  const corpo = texto.startsWith(BOM) ? texto.slice(BOM.length) : texto;
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i]!;
    if (entreAspas) {
      if (c === '"' && corpo[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') entreAspas = false;
      else celula += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ";") {
      linha.push(celula);
      celula = "";
    } else if (c === "\r" && corpo[i + 1] === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
      i++;
    } else celula += c;
  }
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas;
}

type Linha = { texto: string | null; numero: number | null };
const COLUNAS: readonly ColunaDoArquivo<Linha>[] = [
  { titulo: "Texto", celula: (l) => l.texto },
  { titulo: "Número", celula: (l) => l.numero },
];

describe("o formato do arquivo — critérios 4, 5 e 10", () => {
  it("começa pelo BOM UTF-8 e separa por ponto e vírgula, com CRLF", () => {
    const csv = montarCsv(COLUNAS, [{ texto: "Ocorrência", numero: 1 }]);
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toStrictEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toBe(`${BOM}Texto;Número\r\nOcorrência;1\r\n`);
  });

  it("separador, aspas e quebra de linha dentro da célula voltam inteiros", () => {
    const perigosa = 'Vazamento; no 3º andar\r\ncom "aspas"\ne LF solto';
    const csv = montarCsv(COLUNAS, [
      { texto: perigosa, numero: 2 },
      { texto: "depois", numero: 3 },
    ]);
    expect(lerCsv(csv)).toStrictEqual([
      ["Texto", "Número"],
      [perigosa, "2"],
      ["depois", "3"],
    ]);
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("texto que começa com %j sai neutralizado", (inicio) => {
    const valor = `${inicio}HIPERLINK("x")`;
    const [, linha] = lerCsv(montarCsv(COLUNAS, [{ texto: valor, numero: null }]));
    expect(linha![0]).toBe(`'${valor}`);
  });

  it("número não é neutralizado, e vazio é vazio", () => {
    const [, linha] = lerCsv(montarCsv(COLUNAS, [{ texto: null, numero: -1 }]));
    expect(linha).toStrictEqual(["", "-1"]);
  });
});

describe("o nome do arquivo e as datas", () => {
  it("recurso, organização sem acento e o dia de São Paulo", () => {
    // 02:30 UTC de 04/10 ainda é 03/10 em São Paulo.
    expect(nomeDoArquivo("ocorrencias", "Condomínio Jardim das Flores!", "2026-10-04T02:30:00Z")).toBe(
      "ocorrencias-condominio-jardim-das-flores-2026-10-03.csv",
    );
    expect(nomeDoArquivo("areas", "  ---  ", "2026-10-03T12:00:00Z")).toBe("areas-organizacao-2026-10-03.csv");
  });

  it("data e hora sem o ponto médio, no fuso de São Paulo", () => {
    expect(dataEHoraDoArquivo("2026-10-03T17:32:00Z")).toBe("03/10/2026 14:32");
    expect(diaDoArquivo("2026-10-04T02:30:00Z")).toBe("2026-10-03");
  });
});

describe("as colunas são fixas e declaradas — critério 2", () => {
  const titulos = (colunas: readonly { titulo: string }[]) => colunas.map((c) => c.titulo);

  it("Ocorrências", () => {
    expect(titulos(COLUNAS_DE_OCORRENCIAS)).toStrictEqual([
      "ID",
      "Título",
      "Descrição",
      "Status",
      "Prioridade",
      "Categoria",
      "Área",
      "Tipo da área",
      "Solicitante",
      "Responsável",
      "Motivo da pausa",
      "Solução aplicada",
      "Nota da avaliação",
      "Anexos",
      "Registrada em",
      "Atualizada em",
    ]);
  });
  it("Participantes", () => {
    expect(titulos(COLUNAS_DE_PARTICIPANTES)).toStrictEqual([
      "Nome",
      "Papel",
      "Área",
      "Tem conta",
      "E-mail",
      "Telefone",
      "Etiquetas",
      "Participa desde",
      "Atualizado em",
    ]);
  });
  it("Áreas", () => {
    expect(titulos(COLUNAS_DE_AREAS)).toStrictEqual(["Ordem", "Nome", "Tipo", "Ativa"]);
  });
  it("Categorias", () => {
    expect(titulos(COLUNAS_DE_CATEGORIAS)).toStrictEqual(["Ordem", "Nome", "Ativa"]);
  });
});

/** A linha como o arquivo a escreve, coluna por coluna: `{ "Status": "Pausada", … }`. */
function celulas<L>(colunas: readonly ColunaDoArquivo<L>[], linha: L): Record<string, Celula> {
  return Object.fromEntries(colunas.map((coluna) => [coluna.titulo, coluna.celula(linha)]));
}

describe("valores para gente — respostas P1", () => {
  it("uma ocorrência pausada vira palavras, Sim/Não e hora de São Paulo", () => {
    const pausada: OcorrenciaExportadaLida = {
      id: "0f8c7a1e-0000-4000-8000-000000000001",
      titulo: "Portão da garagem",
      descricao: "Não fecha sozinho.",
      status: "pausada",
      prioridade: "alta",
      categoria: { id: "c", nome: "Portaria" },
      area: { id: "a", nome: "Garagem", tipo: "privativa" },
      autor: { pessoaId: "p", nome: "Marcos" },
      responsavel: null,
      quantidadeDeAnexos: 2,
      motivoPausa: "aguardando_peca",
      registradaEm: "2026-10-03T17:32:00Z",
      atualizadaEm: "2026-10-03T18:00:00Z",
      solucaoAplicada: null,
      notaDaAvaliacao: null,
    };
    const linha = celulas(COLUNAS_DE_OCORRENCIAS, pausada);

    expect(linha["Status"]).toBe(nomeDoStatus("pausada"));
    expect(linha["Prioridade"]).toBe("Alta");
    expect(linha["Tipo da área"]).toBe("Unidade privativa");
    expect(linha["Motivo da pausa"]).toBe("Aguardando peça");
    expect(linha["Responsável"]).toBeNull();
    expect(linha["Nota da avaliação"]).toBeNull();
    expect(linha["Anexos"]).toBe(2);
    expect(linha["Registrada em"]).toBe("03/10/2026 14:32");
    for (const [titulo, valor] of Object.entries(linha)) {
      expect(typeof valor === "string" && valor.includes("_"), titulo).toBe(false);
    }
  });

  it("um participante com dois e-mails e um telefone", () => {
    const contato = (id: string, tipo: "email" | "telefone", valor: string, ordem: number) => ({
      id,
      tipo,
      valor,
      finalidade: "pessoal" as const,
      temWhatsapp: false,
      ordem,
      observacao: null,
    });
    const participante: VinculoLido = {
      pessoa: {
        pessoaId: "p",
        nome: "Helena",
        contatos: [
          contato("1", "email", "a@exemplo.test", 1),
          contato("2", "telefone", "+55 11 91234-5678", 2),
          contato("3", "email", "b@exemplo.test", 3),
        ],
      },
      papel: "gestor",
      area: null,
      temConta: true,
      criadoEm: "2026-10-03T17:32:00Z",
      atualizadoEm: null,
      etiquetas: [
        { id: "e1", nome: "A" },
        { id: "e2", nome: "B" },
      ],
    };
    const linha = celulas(COLUNAS_DE_PARTICIPANTES, participante);

    expect(linha["E-mail"]).toBe("a@exemplo.test, b@exemplo.test");
    // A neutralização é do `montarCsv`, e não do conversor.
    expect(linha["Telefone"]).toBe("+55 11 91234-5678");
    expect(linha["Etiquetas"]).toBe("A, B");
    expect(linha["Tem conta"]).toBe("Sim");
    expect(linha["Papel"]).toBe("Gestor");
    expect(linha["Área"]).toBeNull();
    expect(linha["Atualizado em"]).toBeNull();
  });
});

describe("nenhuma dependência nova — critério 7", () => {
  it("o módulo de exportação só importa o próprio projeto", () => {
    const pasta = fileURLToPath(new URL("../../src/interface/exportacao/", import.meta.url));
    const arquivos = readdirSync(pasta);
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos) {
      const fonte = readFileSync(`${pasta}${arquivo}`, "utf8");
      for (const [, especificador] of fonte.matchAll(/from "([^"]+)"/gu)) {
        expect(
          especificador!.startsWith("@/") || especificador!.startsWith("./"),
          `${arquivo}: ${especificador}`,
        ).toBe(true);
      }
    }
  });
});

describe("as quatro rotas — critério 3", () => {
  const RAIZ_DA_API = fileURLToPath(new URL("../../app/api/", import.meta.url));
  const ROTAS = {
    "ocorrencias/exportacao/route.ts": "ocorrencia.ler_todas",
    "vinculos/exportacao/route.ts": "vinculo.gerir",
    "areas/exportacao/route.ts": "organizacao.configurar",
    "categorias/exportacao/route.ts": "organizacao.configurar",
  } as const;

  it.each(Object.entries(ROTAS))("%s exige %s, só GET, e não lê a URL", (rota, permissao) => {
    const fonte = readFileSync(`${RAIZ_DA_API}${rota}`, "utf8");
    expect(fonte.match(/exige: "([^"]+)"/gu)).toStrictEqual([`exige: "${permissao}"`]);
    expect(fonte).toMatch(/^export const GET = comContexto\(/mu);
    expect(fonte).not.toMatch(/^export const (POST|PUT|PATCH|DELETE)\b/mu);
    // Sem filtro, sem ordem, sem página (critério 1): a rota nem olha a consulta.
    expect(fonte).not.toMatch(/searchParams|requisicao\.url|lerFiltro|lerPaginacao|lerBooleanoDaUrl/u);
  });
});
