import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { registrarOcorrencia } from "@/aplicacao/ocorrencia";
import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
} from "@/infraestrutura/repositorios/organizacao";

import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O grupo 2 da ADR-0008 — o que só o Postgres prova
 * ============================================================================
 *
 * A ADR diz que este grupo *"cresce com migração nova e com porta nova"*, e esta fatia traz as duas.
 * Quatro coisas aqui **não têm duplo**:
 *
 * 1. **O `COMMIT` de duas escritas.** Ocorrência e primeiro registro juntos, ou nenhum dos dois.
 * 2. **A premissa P1 no banco.** O `CHECK ((sequencia = 1) = (status_anterior is null))` vale nos DOIS
 *    sentidos, e um duplo não o exerce.
 * 3. **O gatilho *append-only*.** `update` e `delete` na trilha são recusados pelo banco.
 * 4. **A FK composta do autor**, que aponta para `vinculos` e não para `pessoas`.
 */

const URL_DO_BANCO = process.env.BANCO_URL_TESTE ?? process.env.BANCO_URL;
const SUFIXO = `${Date.now()}`;

let pool: Pool;
let consultaCrua: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let organizacaoId: string;
let pessoaId: string;
let categoriaId: string;
let areaId: string;

function portas() {
  const consulta = escoparConsulta(criarConsulta(), organizacaoId);
  return {
    ocorrencias: repositorioEscopadoDeOcorrencias(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    categorias: repositorioEscopadoDeCategorias(consulta),
    areas: repositorioEscopadoDeAreas(consulta),
  };
}

beforeAll(async () => {
  if (URL_DO_BANCO === undefined || URL_DO_BANCO === "") {
    throw new Error(
      "BANCO_URL_TESTE não definida. Este teste exige Postgres — o que ele mede é o COMMIT e os CHECK. " +
        "Suba com `npm run local` e rode `npm run teste:integracao`.",
    );
  }
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

  // **Sem `criada_por_pessoa_id`**, e é o que a suíte de isolamento já faz: a FK
  // `organizacoes_criada_por_vinculo_fk` é `DEFERRABLE INITIALLY DEFERRED` e só é conferida no `COMMIT`
  // — fora de uma transação explícita, cada `insert` é a própria transação, e o vínculo do criador ainda
  // não existe quando ela fecha. A coluna é anulável exatamente por isto: *"organizações semeadas em
  // ambiente de teste não têm criador"* (migração 001). O que este arquivo mede é o agregado
  // `Ocorrência`, não a POL-01 — essa é a `politica-de-semente.test.ts`.
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
  await pool?.end();
});

describe("o registro contra Postgres", () => {
  it("grava ocorrência E primeiro registro no mesmo COMMIT", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId },
      {
        titulo: "Lâmpada queimada na garagem",
        descricao: "Queimada faz três dias, corredor escuro.",
        categoriaId,
        areaId,
        localizacaoComplemento: "ao lado da vaga 34",
      },
    );

    const registros = await consultaCrua<{ sequencia: number; status_anterior: string | null }>(
      `select sequencia, status_anterior from registros_transicao where ocorrencia_id = $1`,
      [lida.id],
    );

    expect(lida.status).toBe("aberta");
    expect(lida.prioridade).toBe("normal");
    expect(registros).toHaveLength(1);
    expect(registros[0]?.sequencia).toBe(1);
    expect(registros[0]?.status_anterior).toBeNull();
  });

  it("a trilha da ocorrência recém-criada tem EXATAMENTE um registro, com os cinco campos", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId },
      {
        titulo: "Infiltração na parede",
        descricao: "Mancha crescendo depois da chuva.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    const trilha = await portas().ocorrencias.trilha(lida.id);

    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({
      statusAnterior: null,
      statusNovo: "aberta",
      autor: { pessoaId, nome: `Helena ${SUFIXO}` },
      observacao: null,
    });
    expect(typeof trilha[0]?.ocorreuEm).toBe("string");
  });

  it("area_tipo é gravado como cópia congelada, e reclassificar a Área não o muda", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId },
      {
        titulo: "Portão emperrado",
        descricao: "Não fecha sozinho.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    await consultaCrua(`update areas set tipo = 'privativa' where id = $1`, [areaId]);

    const depois = await portas().ocorrencias.porId(lida.id);
    expect(depois?.area.tipo).toBe("comum");

    await consultaCrua(`update areas set tipo = 'comum' where id = $1`, [areaId]);
  });
});

describe("o que o banco recusa", () => {
  it("um segundo registro com status_anterior nulo viola o CHECK de P1", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId },
      {
        titulo: "Lixeira quebrada",
        descricao: "Tampa solta.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    // **`status_novo = 'aberta'`, e não `'em_analise'`, para o alvo ser um só.** Uma linha com destino
    // `em_analise` e `status_anterior` nulo viola **dois** `CHECK` — o de P1 e o
    // `registros_transicao_origem_ck` (*"a criação nasce aberta"*) —, e o Postgres relata o primeiro que
    // avaliar. Com destino `aberta` o `origem_ck` é satisfeito e sobra exatamente a premissa P1:
    // `sequencia` 2 não pode ter `status_anterior` nulo.
    await expect(
      consultaCrua(
        `insert into registros_transicao
           (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
         values ($1, $2, 2, null, 'aberta', $3)`,
        [organizacaoId, lida.id, pessoaId],
      ),
    ).rejects.toThrow(/registros_transicao_p1_ck/u);
  });

  it("o gatilho append-only recusa update e delete na trilha (ADR-0001)", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId },
      {
        titulo: "Corrimão solto",
        descricao: "Balança ao apoiar.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    await expect(
      consultaCrua(`update registros_transicao set observacao = 'editado' where ocorrencia_id = $1`, [
        lida.id,
      ]),
    ).rejects.toThrow(/append-only/u);

    await expect(
      consultaCrua(`delete from registros_transicao where ocorrencia_id = $1`, [lida.id]),
    ).rejects.toThrow(/append-only/u);
  });

  it("título só de espaços é recusado pelo CHECK, não só pelo NOT NULL", async () => {
    await expect(
      consultaCrua(
        `insert into ocorrencias
           (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
         values ($1, '   ', 'x', $2, $3, 'comum', $4)`,
        [organizacaoId, categoriaId, areaId, pessoaId],
      ),
    ).rejects.toThrow(/ocorrencias_texto_ck/u);
  });
});
