import type { AreaLida, RepositorioEscopadoDeAreas } from "@/aplicacao/organizacao";
import { ehTipoDeArea } from "@/dominio/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

import { reordenarNaTransacao } from "./reordenacao";

/**
 * `GET /areas` — a segunda leitura que precede o registro. *Localização* é uma Área mais um complemento
 * em texto (D10), e é da Área que a visibilidade deriva. **E, do lote 3 em diante, as duas escritas de
 * T-14** — `POST /areas` e `PATCH /areas/{id}`. E, do item 50 em diante, `PUT /areas/ordem`.
 *
 * **`ordem` existe por medição:** o campo de Área custa ~12 s do orçamento de 60 do RNF6, e é o único
 * conserto que atua no **primeiro** registro de cada pessoa — busca e *"usadas recentemente"* só ajudam do
 * segundo em diante.
 */
export function repositorioEscopadoDeAreas(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeAreas {
  return {
    listar({ apenasAtivas }) {
      return lerAreas(consulta, apenasAtivas);
    },

    async criar(nova) {
      try {
        // **`$4` nulo é a intenção *no fim*** (item 50, spec §4.3), calculada na própria instrução. Ver o
        // comentário irmão em `categorias-escopadas.ts`.
        const linhas = await consulta<LinhaDeArea>(
          `insert into areas (organizacao_id, nome, tipo, ordem, criado_por_pessoa_id)
                values ($1, $2, $3::tipo_area,
                        coalesce($4::smallint,
                                 (select coalesce(max(a.ordem), 0) + 1
                                    from areas a
                                   where a.organizacao_id = $1)),
                        $5)
             returning id, nome, tipo, ativa, ordem`,
          [nova.nome, nova.tipo, nova.ordem === "no-fim" ? null : nova.ordem, nova.criadaPorPessoaId],
        );

        const linha = linhas[0];
        if (linha === undefined) throw new Error("o insert de área não devolveu linha");
        return { desfecho: "criada", area: paraArea(linha) };
      } catch (erro) {
        if (ehNomeDuplicado(erro)) return { desfecho: "nome-duplicado" };
        throw erro;
      }
    },

    async corrigir(correcao) {
      const valores: unknown[] = [];
      const marcador = (valor: unknown): string => {
        valores.push(valor);
        return `$${String(valores.length + 1)}`;
      };

      // **Quem escreve, reservado antes**, porque aparece em dois lugares: na última escrita, sempre, e
      // no par da reclassificação, quando o tipo muda.
      const autor = marcador(correcao.atualizadaPorPessoaId);

      const atribuicoes: string[] = [];
      if (correcao.nome !== undefined) atribuicoes.push(`nome = ${marcador(correcao.nome)}`);
      if (correcao.tipo !== undefined) {
        // O `::tipo_area` é necessário: o driver manda texto, e a coluna é o `ENUM` da migração 002.
        const tipo = `${marcador(correcao.tipo)}::tipo_area`;
        atribuicoes.push(`tipo = ${tipo}`);
        // **O par da reclassificação (item 50, migração 011) só anda quando o VALOR muda.** No `set` de
        // um `update`, o `tipo` do lado direito é o valor antigo da linha, então a comparação é contra o
        // vigente. Mandar o mesmo tipo de novo não é reclassificar (spec §4.2).
        atribuicoes.push(
          `tipo_alterado_em = case when tipo is distinct from ${tipo} then now() else tipo_alterado_em end`,
        );
        atribuicoes.push(
          `tipo_alterado_por_pessoa_id = case when tipo is distinct from ${tipo} then ${autor}::uuid else tipo_alterado_por_pessoa_id end`,
        );
      }
      if (correcao.ativa !== undefined) atribuicoes.push(`ativa = ${marcador(correcao.ativa)}`);

      atribuicoes.push("atualizado_em = now()");
      atribuicoes.push(`atualizado_por_pessoa_id = ${autor}`);

      const idDaArea = marcador(correcao.areaId);

      try {
        const linhas = await consulta<LinhaDeArea>(
          `update areas
              set ${atribuicoes.join(", ")}
            where organizacao_id = $1
              and id = ${idDaArea}
        returning id, nome, tipo, ativa, ordem`,
          valores,
        );

        const linha = linhas[0];
        if (linha === undefined) return { desfecho: "nao-encontrada" };

        return {
          desfecho: "corrigida",
          area: { ...paraArea(linha), ocorrenciasComTipoAnterior: OCORRENCIAS_COM_TIPO_ANTERIOR },
        };
      } catch (erro) {
        if (ehNomeDuplicado(erro)) return { desfecho: "nome-duplicado" };
        throw erro;
      }
    },

    reordenar(reordenacao) {
      return reordenarNaTransacao(emTransacao, "areas", reordenacao, (dentro) => lerAreas(dentro, false));
    },
  };
}

/**
 * ⚠️ **DÍVIDA NOMEADA — achado A-4a-1 da spec dos itens 4a e 5, e ela é do item 11.**
 *
 * `ocorrenciasComTipoAnterior` é *"quantas ocorrências já registradas mantêm o tipo antigo"*. **A tabela
 * `ocorrencias` não existe** — é do item 11 —, então não há de onde contar, e **zero é verdade**: não há
 * ocorrência nenhuma no sistema.
 *
 * **No item 11 esta constante vira a consulta**, e a forma é:
 *
 * ```sql
 * select count(*)::int as total from ocorrencias
 *  where organizacao_id = $1 and area_id = $2 and area_tipo <> $3::tipo_area
 * ```
 *
 * Deixar de trocá-la faz a frase de T-14 mentir a partir do primeiro registro.
 */
const OCORRENCIAS_COM_TIPO_ANTERIOR = 0;

/** A leitura da lista, servida a `listar` e à releitura de dentro da transação da reordenação. */
async function lerAreas(consulta: ConsultaEscopada, apenasAtivas: boolean): Promise<AreaLida[]> {
  const linhas = await consulta<LinhaDeArea>(
    `select id, nome, tipo, ativa, ordem
       from areas
      where organizacao_id = $1
        and (ativa or not $2::boolean)
      order by ordem, nome`,
    [apenasAtivas],
  );

  return linhas.map(paraArea);
}

type LinhaDeArea = {
  id: string;
  nome: string;
  tipo: string;
  ativa: boolean;
  ordem: number;
};

function paraArea(linha: LinhaDeArea): AreaLida {
  if (!ehTipoDeArea(linha.tipo)) {
    // O tipo `tipo_area` do banco e o do domínio saíram da mesma decisão (D10, D18). Se divergirem, é
    // migração aplicada sem código — falha alto, não em silêncio. Mesmo tratamento de `ehPapel`.
    throw new Error(`tipo de área desconhecido vindo do banco: ${linha.tipo}`);
  }
  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    ativa: linha.ativa,
    ordem: linha.ordem,
  };
}

/**
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — a mesma técnica de
 * `organizacoes.ts` e `pedidos-de-entrada.ts`. Confere as **duas**: `23505` sozinho pegaria qualquer
 * unicidade.
 */
function ehNomeDuplicado(erro: unknown): boolean {
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return comCodigo.code === "23505" && comCodigo.constraint === "areas_organizacao_nome_uk";
}
