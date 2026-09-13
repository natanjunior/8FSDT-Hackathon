import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Ocorrencia } from "@/dominio/ocorrencia";
import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";

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

/** Um corte que inclui tudo — este caso não é sobre paginação, e um corte real o tornaria frágil. */
const NO_FUTURO = "2099-01-01T00:00:00.000Z";

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

function repositorio() {
  return repositorioEscopadoDeOcorrencias(
    escoparConsulta(criarConsulta(), organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

/** Um agregado com anexo, montado direto — a reivindicação já foi provada com duplo. */
function agregadoComAnexo(chave: string, thumbnailChave: string | null) {
  return Ocorrencia.registrar({
    titulo: "Lâmpada queimada na garagem",
    descricao: "Está escuro à noite.",
    categoriaId,
    areaId,
    areaTipo: "comum",
    localizacaoComplemento: null,
    autorPessoaId: pessoaId,
    ocorreuEm: new Date().toISOString(),
    anexos: [
      {
        tipo: "imagem",
        chave,
        thumbnailChave,
        nomeArquivo: null,
        titulo: "Lâmpada da vaga 34",
        tipoConteudo: "image/jpeg",
        tamanhoBytes: 391_244,
        anexadoPorPessoaId: pessoaId,
        anexadoEm: new Date().toISOString(),
      },
    ],
  });
}

describe("as TRÊS escritas são uma transação só", () => {
  it("ocorrência, registro de transição e anexo nascem no mesmo COMMIT", async () => {
    const chave = `anx_${SUFIXO}_trio`;
    const resultado = await repositorio().registrar(agregadoComAnexo(chave, `${chave}_mini`));

    expect(resultado.desfecho).toBe("registrada");
    const id = resultado.desfecho === "registrada" ? resultado.ocorrencia.id : "";

    const [transicoes] = await consultaCrua<{ total: string }>(
      `select count(*) as total from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    const [anexos] = await consultaCrua<{ total: string }>(
      `select count(*) as total from anexos where ocorrencia_id = $1`,
      [id],
    );

    expect(transicoes!.total).toBe("1");
    expect(anexos!.total).toBe("1");
  });

  it("anexo que viola a FK derruba as TRÊS — nenhuma linha sobra", async () => {
    const antes = await consultaCrua<{ total: string }>(`select count(*) as total from ocorrencias`);

    const agregado = Ocorrencia.registrar({
      titulo: "Com anexo impossível",
      descricao: "A chave é uma URL, e o CHECK recusa.",
      categoriaId,
      areaId,
      areaTipo: "comum",
      localizacaoComplemento: null,
      autorPessoaId: pessoaId,
      ocorreuEm: new Date().toISOString(),
      anexos: [
        {
          tipo: "imagem",
          chave: "https://conta.blob.core.windows.net/anexos/x",
          thumbnailChave: null,
          nomeArquivo: null,
          titulo: null,
          tipoConteudo: "image/jpeg",
          tamanhoBytes: 1,
          anexadoPorPessoaId: pessoaId,
          anexadoEm: new Date().toISOString(),
        },
      ],
    });

    await expect(repositorio().registrar(agregado)).rejects.toThrow();

    const depois = await consultaCrua<{ total: string }>(`select count(*) as total from ocorrencias`);
    // É a invariante 2 da ADR-0001 valendo para a terceira escrita: ou as três, ou nenhuma.
    expect(depois[0]!.total).toBe(antes[0]!.total);
  });
});

describe("a segunda reivindicação da mesma chave", () => {
  it("devolve o desfecho `anexo-ja-reivindicado`, com o ocorrenciaId da PRIMEIRA", async () => {
    const chave = `anx_${SUFIXO}_repetida`;
    const primeira = await repositorio().registrar(agregadoComAnexo(chave, `${chave}_mini`));
    const idDaPrimeira = primeira.desfecho === "registrada" ? primeira.ocorrencia.id : "";

    const segunda = await repositorio().registrar(agregadoComAnexo(chave, `${chave}_mini`));

    expect(segunda).toStrictEqual({
      desfecho: "anexo-ja-reivindicado",
      ocorrenciaId: idDaPrimeira,
    });
  });

  it("e NÃO cria a segunda ocorrência", async () => {
    const chave = `anx_${SUFIXO}_repetida2`;
    await repositorio().registrar(agregadoComAnexo(chave, null));
    const antes = await consultaCrua<{ total: string }>(`select count(*) as total from ocorrencias`);

    await repositorio().registrar(agregadoComAnexo(chave, null));

    const depois = await consultaCrua<{ total: string }>(`select count(*) as total from ocorrencias`);
    expect(depois[0]!.total).toBe(antes[0]!.total);
  });
});

describe("as leituras do anexo", () => {
  it("o detalhe traz o anexo inteiro — e NUNCA a chave", async () => {
    const chave = `anx_${SUFIXO}_detalhe`;
    const criada = await repositorio().registrar(agregadoComAnexo(chave, `${chave}_mini`));
    const id = criada.desfecho === "registrada" ? criada.ocorrencia.id : "";

    const lida = await repositorio().porId(id);

    expect(lida!.anexos).toHaveLength(1);
    expect(lida!.anexos[0]).toMatchObject({
      tipo: "imagem",
      titulo: "Lâmpada da vaga 34",
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 391_244,
      temMiniatura: true,
    });
    // A propriedade é de TIPO, e este caso a prova em tempo de execução também.
    expect(JSON.stringify(lida!.anexos)).not.toContain(chave);
  });

  it("sem anexo, a lista é vazia — nunca `null`", async () => {
    const agregado = Ocorrencia.registrar({
      titulo: "Sem foto",
      descricao: "Nada anexado.",
      categoriaId,
      areaId,
      areaTipo: "comum",
      localizacaoComplemento: null,
      autorPessoaId: pessoaId,
      ocorreuEm: new Date().toISOString(),
    });
    const criada = await repositorio().registrar(agregado);
    const id = criada.desfecho === "registrada" ? criada.ocorrencia.id : "";

    expect((await repositorio().porId(id))!.anexos).toStrictEqual([]);
  });

  it("a listagem traz a contagem REAL, e não o zero forçado", async () => {
    const chave = `anx_${SUFIXO}_contagem`;
    const criada = await repositorio().registrar(agregadoComAnexo(chave, null));
    const id = criada.desfecho === "registrada" ? criada.ocorrencia.id : "";

    const pagina = await repositorio().listar({ limite: 50, deslocamento: 0, ate: NO_FUTURO });
    const item = pagina.find((linha) => linha.id === id);

    expect(item!.quantidadeDeAnexos).toBe(1);
    expect(pagina.some((linha) => linha.quantidadeDeAnexos === 0)).toBe(true);
  });

  it("`objetoDoAnexo` devolve a chave e a da miniatura, e só isso", async () => {
    const chave = `anx_${SUFIXO}_objeto`;
    const criada = await repositorio().registrar(agregadoComAnexo(chave, `${chave}_mini`));
    const id = criada.desfecho === "registrada" ? criada.ocorrencia.id : "";
    const anexoId = (await repositorio().porId(id))!.anexos[0]!.id;

    expect(await repositorio().objetoDoAnexo(id, anexoId)).toStrictEqual({
      chave,
      thumbnailChave: `${chave}_mini`,
    });
  });

  it("`objetoDoAnexo` de anexo que não é desta ocorrência devolve `null`", async () => {
    const chave = `anx_${SUFIXO}_alheio`;
    const criada = await repositorio().registrar(agregadoComAnexo(chave, null));
    const id = criada.desfecho === "registrada" ? criada.ocorrencia.id : "";
    const anexoId = (await repositorio().porId(id))!.anexos[0]!.id;

    const outra = await repositorio().registrar(agregadoComAnexo(`anx_${SUFIXO}_alheio2`, null));
    const idDaOutra = outra.desfecho === "registrada" ? outra.ocorrencia.id : "";

    expect(await repositorio().objetoDoAnexo(idDaOutra, anexoId)).toBeNull();
  });
});
