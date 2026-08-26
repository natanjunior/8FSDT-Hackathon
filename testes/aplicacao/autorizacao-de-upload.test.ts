import { describe, expect, it } from "vitest";

import {
  autorizarUploadDeAnexo,
  JANELA_EM_SEGUNDOS,
  LIMITE_POR_HORA,
  LimiteDeAutorizacoesDeUpload,
  type PortasDeAnexo,
} from "@/aplicacao/anexo";

import { emissorFalso, livroEmMemoria } from "./duplos";

/**
 * **O caso de uso, sem banco e sem nuvem.** É o que a ADR-0005 comprou: substituir o livro-caixa e o
 * emissor é passar outro argumento.
 *
 * O que este arquivo prova, e nenhum outro prova: que o orçamento é contado **pela Pessoa**, e que a
 * organização não entra na conta — que é a decisão mais consequente da spec (§3.1).
 */
const PEDIDO = {
  organizacaoId: "org-1",
  pessoaId: "pessoa-1",
  tipoConteudo: "image/jpeg",
  tamanhoBytes: 391_244,
} as const;

function portas(livro = livroEmMemoria()): PortasDeAnexo {
  return { livro, emissor: emissorFalso() };
}

describe("autorizarUploadDeAnexo", () => {
  it("emite os dois destinos, com um ticket só", async () => {
    const emitida = await autorizarUploadDeAnexo(portas(), PEDIDO);

    expect(emitida.chave).not.toBe(emitida.chaveMiniatura);
    expect(emitida.ticket).not.toBe("");
    expect(emitida.upload.metodo).toBe("PUT");
    expect(emitida.uploadMiniatura.metodo).toBe("PUT");
  });

  it("a etiqueta `estado=pendente` viaja nos cabeçalhos dos dois destinos", async () => {
    const emitida = await autorizarUploadDeAnexo(portas(), PEDIDO);

    expect(emitida.upload.cabecalhos["x-ms-tags"]).toBe("estado=pendente");
    expect(emitida.uploadMiniatura.cabecalhos["x-ms-tags"]).toBe("estado=pendente");
  });

  it("consome exatamente um slot por autorização", async () => {
    const livro = livroEmMemoria();
    const p = portas(livro);

    await autorizarUploadDeAnexo(p, PEDIDO);
    await autorizarUploadDeAnexo(p, PEDIDO);

    expect(livro.emissoesDe("pessoa-1")).toBe(2);
  });

  it("a 31ª da mesma Pessoa na janela é recusada, com o tempo até liberar", async () => {
    const p = portas();

    for (let i = 0; i < LIMITE_POR_HORA; i += 1) await autorizarUploadDeAnexo(p, PEDIDO);

    await expect(autorizarUploadDeAnexo(p, PEDIDO)).rejects.toMatchObject({
      codigo: "LIMITE_DE_AUTORIZACOES_DE_UPLOAD",
      extensoes: { segundosAteLiberar: expect.any(Number) },
    });
  });

  it("o orçamento é da Pessoa, não do par Pessoa+organização", async () => {
    const p = portas();

    for (let i = 0; i < LIMITE_POR_HORA; i += 1) await autorizarUploadDeAnexo(p, PEDIDO);

    // A MESMA Pessoa, em OUTRA organização. Se o orçamento fosse escopado, esta passaria — e "entrar em
    // outra organização" viraria o jeito de dobrar a franquia de armazenamento, que é uma conta só.
    await expect(
      autorizarUploadDeAnexo(p, { ...PEDIDO, organizacaoId: "org-2" }),
    ).rejects.toBeInstanceOf(LimiteDeAutorizacoesDeUpload);
  });

  it("pessoas diferentes têm orçamentos independentes", async () => {
    const p = portas();

    for (let i = 0; i < LIMITE_POR_HORA; i += 1) await autorizarUploadDeAnexo(p, PEDIDO);

    await expect(
      autorizarUploadDeAnexo(p, { ...PEDIDO, pessoaId: "pessoa-2" }),
    ).resolves.toMatchObject({ ticket: expect.any(String) });
  });

  it("a janela declarada é de uma hora", () => {
    expect(JANELA_EM_SEGUNDOS).toBe(60 * 60);
  });
});
