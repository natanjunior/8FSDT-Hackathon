import type { CategoriaLida, RepositorioEscopadoDeCategorias } from "@/aplicacao/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

import { reordenarNaTransacao } from "./reordenacao";

/**
 * `GET /categorias` — a leitura que precede o registro, e onde se confirma que a semente nasceu. **E, do
 * lote 3 em diante, as duas escritas de T-09** — `POST /categorias` e `PATCH /categorias/{id}`. E, do
 * item 50 em diante, `PUT /categorias/ordem`, que é a única escrita desta porta que precisa de transação.
 *
 * Note o que este arquivo **não** contém: um valor de organização. `$1` é injetado pelo ponto de
 * estrangulamento, e este repositório **não tem como saber** qual organização é (ADR-0003). Os parâmetros
 * de quem chama começam em `$2`.
 *
 * **Ordem: `ordem`, com desempate alfabético** (contrato §8.1). O `COLLATE "pt-BR-x-icu"` da coluna é o
 * que põe *"Área"* antes de *"Balcão"* — em collation C, o acento iria para o fim.
 */
export function repositorioEscopadoDeCategorias(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeCategorias {
  return {
    listar({ apenasAtivas }) {
      return lerCategorias(consulta, apenasAtivas);
    },

    async criar(nova) {
      try {
        // `atualizado_por_pessoa_id` fica **nulo na criação**, de propósito: a coluna é *"o último a
        // escrever"*, e na criação ninguém alterou nada ainda. Quem criou está em `criado_por`.
        //
        // **`$4` nulo é a intenção *no fim*** (item 50, spec §4.3): a maior `ordem` da organização mais
        // um, contando as inativas, e 1 na lista vazia. Calculada na própria instrução: ler o máximo antes
        // seria uma segunda ida ao banco e uma corrida a mais. Duas criações simultâneas podem empatar; a
        // leitura desempata pelo nome, e a próxima reordenação desfaz.
        const linhas = await consulta<LinhaDeCategoria>(
          `insert into categorias (organizacao_id, nome, icone, ordem, criado_por_pessoa_id)
                values ($1, $2, $3,
                        coalesce($4::smallint,
                                 (select coalesce(max(c.ordem), 0) + 1
                                    from categorias c
                                   where c.organizacao_id = $1)),
                        $5)
             returning id, nome, icone, ativa, ordem`,
          [
            nova.nome,
            nova.icone,
            nova.ordem === "no-fim" ? null : nova.ordem,
            nova.criadaPorPessoaId,
          ],
        );

        const linha = linhas[0];
        // `insert ... returning` sem linha é o banco em outro estado, não um desfecho de domínio.
        if (linha === undefined) throw new Error("o insert de categoria não devolveu linha");
        return { desfecho: "criada", categoria: paraCategoria(linha) };
      } catch (erro) {
        if (ehNomeDuplicado(erro)) return { desfecho: "nome-duplicado" };
        throw erro;
      }
    },

    async corrigir(correcao) {
      const valores: unknown[] = [];
      // `$1` é a organização, amarrado pelo ponto único — os parâmetros de quem chama começam em `$2`.
      const marcador = (valor: unknown): string => {
        valores.push(valor);
        return `$${String(valores.length + 1)}`;
      };

      const atribuicoes: string[] = [];
      if (correcao.nome !== undefined) atribuicoes.push(`nome = ${marcador(correcao.nome)}`);
      if (correcao.icone !== undefined) atribuicoes.push(`icone = ${marcador(correcao.icone)}`);
      if (correcao.ordem !== undefined) atribuicoes.push(`ordem = ${marcador(correcao.ordem)}`);
      if (correcao.ativa !== undefined) atribuicoes.push(`ativa = ${marcador(correcao.ativa)}`);

      // **O carimbo e o autor entram na própria instrução, sem gatilho** (spec §2.7). O relógio é o do
      // banco de qualquer forma; o *quem* não teria como vir de lá.
      atribuicoes.push("atualizado_em = now()");
      atribuicoes.push(`atualizado_por_pessoa_id = ${marcador(correcao.atualizadaPorPessoaId)}`);

      const idDaCategoria = marcador(correcao.categoriaId);

      try {
        const linhas = await consulta<LinhaDeCategoria>(
          `update categorias
              set ${atribuicoes.join(", ")}
            where organizacao_id = $1
              and id = ${idDaCategoria}
        returning id, nome, icone, ativa, ordem`,
          valores,
        );

        // **Zero linhas é `nao-encontrada`, e cobre os dois casos com a mesma resposta:** a categoria não
        // existe, ou existe em outra organização e o `$1` a torna inalcançável (contrato §6.3).
        const linha = linhas[0];
        if (linha === undefined) return { desfecho: "nao-encontrada" };
        return { desfecho: "corrigida", categoria: paraCategoria(linha) };
      } catch (erro) {
        if (ehNomeDuplicado(erro)) return { desfecho: "nome-duplicado" };
        throw erro;
      }
    },

    reordenar(reordenacao) {
      return reordenarNaTransacao(emTransacao, "categorias", reordenacao, (dentro) =>
        lerCategorias(dentro, false),
      );
    },
  };
}

/** A leitura da lista, servida a `listar` e à releitura de dentro da transação da reordenação. */
async function lerCategorias(consulta: ConsultaEscopada, apenasAtivas: boolean): Promise<CategoriaLida[]> {
  const linhas = await consulta<LinhaDeCategoria>(
    `select id, nome, icone, ativa, ordem
       from categorias
      where organizacao_id = $1
        and (ativa or not $2::boolean)
      order by ordem, nome`,
    [apenasAtivas],
  );

  return linhas.map(paraCategoria);
}

type LinhaDeCategoria = {
  id: string;
  nome: string;
  icone: string;
  ativa: boolean;
  ordem: number;
};

function paraCategoria(linha: LinhaDeCategoria): CategoriaLida {
  return {
    id: linha.id,
    nome: linha.nome,
    icone: linha.icone,
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
  return comCodigo.code === "23505" && comCodigo.constraint === "categorias_organizacao_nome_uk";
}
