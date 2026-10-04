import { describe, expect, it } from "vitest";

import { dataEHoraDoArquivo, diaDoArquivo } from "@/interface/componentes/datas";
import { BOM, montarCsv, nomeDoArquivo, type ColunaDoArquivo } from "@/interface/exportacao";

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
