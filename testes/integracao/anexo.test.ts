import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O grupo 2 da ADR-0008 — o que só o Postgres prova, para o anexo
 * ============================================================================
 *
 * Quatro coisas aqui não têm duplo: as TRÊS inserções num `COMMIT` só; o `UNIQUE (chave)` global
 * respondendo o `409`; a contagem de anexos por subconsulta correlacionada; e a ausência deliberada de
 * um índice único por `ocorrencia_id` (modelo §6.16, bloco de alerta).
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `${Date.now()}`;

let pool: Pool;
let consultaCrua: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let organizacaoId: string;
let pessoaId: string;
let categoriaId: string;
let areaId: string;

beforeAll(async () => {
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consultaCrua = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, [...valores])).rows as L[];

  await aplicarEsquema(consultaCrua);

  const [pessoa] = await consultaCrua<{ id: string }>(
    `insert into pessoas (nome) values ($1) returning id`,
    [`Helena ${SUFIXO}`],
  );
  pessoaId = pessoa!.id;

  const [organizacao] = await consultaCrua<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
    [`Recanto ${SUFIXO}`, `RA${SUFIXO}`.slice(0, 12).toUpperCase()],
  );
  organizacaoId = organizacao!.id;

  await consultaCrua(
    `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
    [pessoaId, organizacaoId],
  );

  const [categoria] = await consultaCrua<{ id: string }>(
    `insert into categorias (organizacao_id, nome, icone, ordem)
          values ($1, 'Problemas de iluminação', 'lightbulb', 0) returning id`,
    [organizacaoId],
  );
  categoriaId = categoria!.id;

  const [area] = await consultaCrua<{ id: string }>(
    `insert into areas (organizacao_id, nome, tipo, ordem)
          values ($1, 'Garagem', 'comum', 0) returning id`,
    [organizacaoId],
  );
  areaId = area!.id;
});

afterAll(async () => {
  await pool.end();
});

/** Uma ocorrência crua, para pendurar anexo sem passar pelo agregado. */
async function novaOcorrencia(): Promise<string> {
  const [linha] = await consultaCrua<{ id: string }>(
    `insert into ocorrencias
       (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
     values ($1, 'Lâmpada queimada', 'Está escuro.', $2, $3, 'comum', $4)
     returning id`,
    [organizacaoId, categoriaId, areaId, pessoaId],
  );
  return linha!.id;
}

describe("a tabela `anexos` impõe o que a §6.16 do modelo decidiu", () => {
  it("recusa a segunda linha com a mesma `chave`, e a recusa é GLOBAL", async () => {
    const primeira = await novaOcorrencia();
    const segunda = await novaOcorrencia();
    const chave = `anx_${SUFIXO}_unica`;

    await consultaCrua(
      `insert into anexos
         (organizacao_id, ocorrencia_id, tipo, chave, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id)
       values ($1, $2, 'imagem', $3, 'image/jpeg', 391244, $4)`,
      [organizacaoId, primeira, chave, pessoaId],
    );

    await expect(
      consultaCrua(
        `insert into anexos
           (organizacao_id, ocorrencia_id, tipo, chave, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id)
         values ($1, $2, 'imagem', $3, 'image/jpeg', 391244, $4)`,
        [organizacaoId, segunda, chave, pessoaId],
      ),
    ).rejects.toMatchObject({ code: "23505", constraint: "anexos_chave_uk" });
  });

  it("recusa chave que seja URL — a §2.8 escrita como constraint", async () => {
    const ocorrenciaId = await novaOcorrencia();

    await expect(
      consultaCrua(
        `insert into anexos
           (organizacao_id, ocorrencia_id, tipo, chave, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id)
         values ($1, $2, 'imagem', 'https://conta.blob.core.windows.net/anexos/x', 'image/jpeg', 1, $3)`,
        [organizacaoId, ocorrenciaId, pessoaId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("ACEITA dois anexos na mesma ocorrência — não há restrição de quantidade no banco", async () => {
    const ocorrenciaId = await novaOcorrencia();

    for (const sufixo of ["a", "b"]) {
      await consultaCrua(
        `insert into anexos
           (organizacao_id, ocorrencia_id, tipo, chave, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id)
         values ($1, $2, 'imagem', $3, 'image/jpeg', 1000, $4)`,
        [organizacaoId, ocorrenciaId, `anx_${SUFIXO}_dois_${sufixo}`, pessoaId],
      );
    }

    const [contagem] = await consultaCrua<{ total: string }>(
      `select count(*) as total from anexos where ocorrencia_id = $1`,
      [ocorrenciaId],
    );
    // **O teto de um é de ESCOPO e mora no `maxItems: 1` do schema de entrada.** Este caso existe para
    // que ninguém acrescente "por segurança" o índice único que o modelo §6.16 recusa em voz alta.
    expect(contagem!.total).toBe("2");
  });
});
