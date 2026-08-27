import type {
  AnexoLido,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  RepositorioEscopadoDeOcorrencias,
  ResultadoDoRegistro,
  TransicaoLida,
} from "@/aplicacao/ocorrencia";
import type { Ocorrencia } from "@/dominio/ocorrencia";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  O agregado em SQL — duas escritas, um `COMMIT`
 * ============================================================================
 *
 * **`$1` é sempre a organização ativa**, amarrado pelo `escoparConsulta`/`escoparTransacao`. Este arquivo
 * **não recebe** o identificador: não tem como escrever o filtro errado porque não tem o valor
 * (ADR-0003).
 *
 * **Não existe `atualizar` nem `apagar` para `registros_transicao`, e a ausência é a invariante 3.** O
 * gatilho do banco é a defesa em profundidade; o mecanismo primário é esta porta não ter a operação.
 *
 * **A leitura de pessoa parte de `vinculos`, nunca de `pessoas`** — item do DoD que o lint não alcança,
 * porque a consulta seria legítima: ela apenas partiria da tabela errada, e `pessoas` é global.
 */

/** As colunas da ocorrência mais o que o `join` traz. Fica junto do SQL, que é quem a produz. */
type LinhaDeOcorrencia = {
  id: string;
  titulo: string;
  descricao: string;
  status: OcorrenciaLida["status"];
  prioridade: OcorrenciaLida["prioridade"];
  categoria_id: string;
  categoria_nome: string;
  categoria_icone: string;
  area_id: string;
  area_nome: string;
  area_tipo: OcorrenciaLida["area"]["tipo"];
  localizacao_complemento: string | null;
  autor_pessoa_id: string;
  autor_nome: string;
  solucao_aplicada: string | null;
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliada_em: Date | null;
  registrada_em: Date;
  atualizada_em: Date;
};

type LinhaDeTransicao = {
  sequencia: number;
  status_anterior: TransicaoLida["statusAnterior"];
  status_novo: TransicaoLida["statusNovo"];
  ocorreu_em: Date;
  autor_pessoa_id: string;
  autor_nome: string;
  observacao: string | null;
  motivo_pausa: TransicaoLida["motivoPausa"];
  motivo_cancelamento: TransicaoLida["motivoCancelamento"];
};

type LinhaDeAnexo = {
  id: string;
  tipo: AnexoLido["tipo"];
  titulo: string | null;
  nome_arquivo: string | null;
  tipo_conteudo: string;
  tamanho_bytes: number;
  tem_miniatura: boolean;
  anexado_em: Date;
};

/**
 * O `select` da ocorrência. **O `join` de autor começa em `vinculos`** e só então alcança `pessoas` —
 * é o que impede a consulta de enxergar o cadastro do sistema inteiro.
 */
const SELECT_DA_OCORRENCIA = `
  select o.id,
         o.titulo,
         o.descricao,
         o.status,
         o.prioridade,
         o.categoria_id,
         c.nome  as categoria_nome,
         c.icone as categoria_icone,
         o.area_id,
         a.nome  as area_nome,
         o.area_tipo,
         o.localizacao_complemento,
         o.autor_pessoa_id,
         pa.nome as autor_nome,
         o.solucao_aplicada,
         o.avaliacao_nota,
         o.avaliacao_comentario,
         o.avaliada_em,
         o.registrada_em,
         o.atualizada_em
    from ocorrencias o
    join categorias c on c.id = o.categoria_id and c.organizacao_id = o.organizacao_id
    join areas      a on a.id = o.area_id       and a.organizacao_id = o.organizacao_id
    join vinculos  va on va.pessoa_id = o.autor_pessoa_id and va.organizacao_id = o.organizacao_id
    join pessoas   pa on pa.id = va.pessoa_id
   where o.organizacao_id = $1`;

const SELECT_DA_TRILHA = `
  select r.sequencia,
         r.status_anterior,
         r.status_novo,
         r.ocorreu_em,
         r.autor_pessoa_id,
         pt.nome as autor_nome,
         r.observacao,
         r.motivo_pausa,
         r.motivo_cancelamento
    from registros_transicao r
    join vinculos vt on vt.pessoa_id = r.autor_pessoa_id and vt.organizacao_id = r.organizacao_id
    join pessoas  pt on pt.id = vt.pessoa_id
   where r.organizacao_id = $1 and r.ocorrencia_id = $2
   order by r.sequencia`;

/**
 * Os anexos de uma ocorrência, pelo índice `(organizacao_id, ocorrencia_id)`.
 *
 * **`thumbnail_chave` não sai — sai se ela existe.** A projeção monta as duas URLs a partir do `id`, que
 * é a chave primária e é o que torna a URL estável (contrato §10.4); a chave do storage não participa.
 */
const SELECT_DOS_ANEXOS = `
  select a.id,
         a.tipo,
         a.titulo,
         a.nome_arquivo,
         a.tipo_conteudo,
         a.tamanho_bytes,
         (a.thumbnail_chave is not null) as tem_miniatura,
         a.anexado_em
    from anexos a
   where a.organizacao_id = $1 and a.ocorrencia_id = $2
   order by a.anexado_em, a.id`;

function montarAnexo(linha: LinhaDeAnexo): AnexoLido {
  return {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    nomeArquivo: linha.nome_arquivo,
    tipoConteudo: linha.tipo_conteudo,
    tamanhoBytes: linha.tamanho_bytes,
    temMiniatura: linha.tem_miniatura,
    anexadoEm: linha.anexado_em.toISOString(),
  };
}

function montarTransicao(linha: LinhaDeTransicao): TransicaoLida {
  return {
    sequencia: linha.sequencia,
    statusAnterior: linha.status_anterior,
    statusNovo: linha.status_novo,
    ocorreuEm: linha.ocorreu_em.toISOString(),
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    observacao: linha.observacao,
    motivoPausa: linha.motivo_pausa,
    motivoCancelamento: linha.motivo_cancelamento,
  };
}

function montarOcorrencia(
  linha: LinhaDeOcorrencia,
  ultima: TransicaoLida,
  anexos: readonly AnexoLido[],
): OcorrenciaLida {
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    status: linha.status,
    prioridade: linha.prioridade,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome, icone: linha.categoria_icone },
    area: { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo },
    localizacaoComplemento: linha.localizacao_complemento,
    anexos,
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    // `atribuicoes` é do item 19: hoje não há quem preencha, e `null` é a verdade.
    responsavel: null,
    solucaoAplicada: linha.solucao_aplicada,
    avaliacao:
      linha.avaliacao_nota === null || linha.avaliada_em === null
        ? null
        : {
            nota: linha.avaliacao_nota,
            comentario: linha.avaliacao_comentario,
            avaliadaEm: linha.avaliada_em.toISOString(),
          },
    // O motivo da pausa vigente vem do último registro; fora de `pausada` é nulo por construção.
    motivoPausa: ultima.statusNovo === "pausada" ? ultima.motivoPausa : null,
    ultimaTransicao: ultima,
    registradaEm: linha.registrada_em.toISOString(),
    atualizadaEm: linha.atualizada_em.toISOString(),
  };
}

/** As colunas do resumo. **Menos que as do detalhe, de propósito** — sem `descricao` e sem a trilha. */
type LinhaDeResumo = {
  id: string;
  titulo: string;
  status: OcorrenciaResumoLida["status"];
  prioridade: OcorrenciaResumoLida["prioridade"];
  categoria_id: string;
  categoria_nome: string;
  area_id: string;
  area_nome: string;
  area_tipo: OcorrenciaResumoLida["area"]["tipo"];
  autor_pessoa_id: string;
  autor_nome: string;
  motivo_pausa: OcorrenciaResumoLida["motivoPausa"];
  quantidade_de_anexos: number;
  registrada_em: Date;
  atualizada_em: Date;
};

/**
 * O `select` da listagem.
 *
 * **Três coisas para reparar, e nenhuma é estilo:**
 *
 * 1. **`o.area_tipo`, nunca `a.tipo`.** É a cópia congelada no instante do registro (modelo §7.5):
 *    reclassificar a Área **não** muda o que a lista mostra para as ocorrências antigas. É o critério
 *    12.3 se completando aqui.
 * 2. **O `join` do autor começa em `vinculos`** e só então alcança `pessoas` — item do DoD que o lint não
 *    alcança, porque a consulta seria legítima; ela apenas partiria da tabela global.
 * 3. **O `LATERAL` do motivo da pausa.** O `status` é coluna desnormalizada justamente para a lista não
 *    precisar da trilha (modelo §7.2); o **motivo** não é. Uma linha por ocorrência, pelo índice único
 *    `(ocorrencia_id, sequencia)`. Hoje devolve `null` sempre, porque nada pode estar `pausada` antes do
 *    item 23 — e entra assim mesmo, para o 23 não herdar uma dívida que nenhum critério dele nomeia.
 */
const SELECT_DO_RESUMO = `
  select o.id,
         o.titulo,
         o.status,
         o.prioridade,
         o.categoria_id,
         c.nome  as categoria_nome,
         o.area_id,
         a.nome  as area_nome,
         o.area_tipo,
         o.autor_pessoa_id,
         pa.nome as autor_nome,
         ult.motivo_pausa,
         (select count(*)
            from anexos ax
           where ax.ocorrencia_id = o.id
             and ax.organizacao_id = o.organizacao_id)::int as quantidade_de_anexos,
         o.registrada_em,
         o.atualizada_em
    from ocorrencias o
    join categorias c on c.id = o.categoria_id and c.organizacao_id = o.organizacao_id
    join areas      a on a.id = o.area_id       and a.organizacao_id = o.organizacao_id
    join vinculos  va on va.pessoa_id = o.autor_pessoa_id and va.organizacao_id = o.organizacao_id
    join pessoas   pa on pa.id = va.pessoa_id
    left join lateral (
      select r.motivo_pausa
        from registros_transicao r
       where r.ocorrencia_id = o.id
         and r.organizacao_id = o.organizacao_id
       order by r.sequencia desc
       limit 1
    ) ult on true
   where o.organizacao_id = $1`;

function montarResumo(linha: LinhaDeResumo): OcorrenciaResumoLida {
  return {
    id: linha.id,
    titulo: linha.titulo,
    status: linha.status,
    prioridade: linha.prioridade,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome },
    area: { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo },
    autor: { pessoaId: linha.autor_pessoa_id, nome: linha.autor_nome },
    // `atribuicoes` é do item 19: hoje não há quem preencha, e `null` é a verdade.
    responsavel: null,
    // **Subconsulta correlacionada e não coluna materializada.** O índice `(organizacao_id,
    // ocorrencia_id)` existe exatamente para as duas leituras deste arquivo, e `ocorrencias
    // .total_anexos` está na lista dos recusados (modelo §7.1): desnormaliza-se o que é **filtrado ou
    // ordenado**, nunca o que é só projetado.
    quantidadeDeAnexos: linha.quantidade_de_anexos,
    // Fora de `pausada` o motivo é nulo por construção — o `CHECK` da migração 005 garante o par.
    motivoPausa: linha.status === "pausada" ? linha.motivo_pausa : null,
    registradaEm: linha.registrada_em.toISOString(),
    atualizadaEm: linha.atualizada_em.toISOString(),
  };
}

/**
 * **Lê `code` e `constraint` de um objeto desconhecido, sem importar o driver** — a mesma técnica de
 * `categorias-escopadas.ts` e `organizacoes.ts`. Confere as **duas**, porque `23505` sozinho pegaria
 * qualquer unicidade da transação.
 *
 * **As duas constraints de `anexos`, e não só a da chave** (decisão D-P4 do plano): `chave` e
 * `thumbnail_chave` vêm do **mesmo ticket**, então a segunda reivindicação viola as duas, e qual índice o
 * Postgres reporta primeiro não é contratual. Conferir só a primeira transformaria metade das corridas
 * em `500`.
 */
function ehAnexoJaReivindicado(erro: unknown): boolean {
  const comCodigo = erro as { code?: unknown; constraint?: unknown };
  return (
    comCodigo.code === "23505" &&
    (comCodigo.constraint === "anexos_chave_uk" ||
      comCodigo.constraint === "anexos_thumbnail_chave_uk")
  );
}

export function repositorioEscopadoDeOcorrencias(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeOcorrencias {
  async function lerPorId(executar: ConsultaEscopada, id: string): Promise<OcorrenciaLida | null> {
    const linhas = await executar<LinhaDeOcorrencia>(`${SELECT_DA_OCORRENCIA} and o.id = $2`, [id]);
    const linha = linhas[0];
    if (linha === undefined) return null;

    // As duas leituras filhas em paralelo — é uma ida e volta, não duas.
    const [trilha, anexos] = await Promise.all([
      executar<LinhaDeTransicao>(SELECT_DA_TRILHA, [id]),
      executar<LinhaDeAnexo>(SELECT_DOS_ANEXOS, [id]),
    ]);

    const ultima = trilha[trilha.length - 1];
    if (ultima === undefined) {
      // Ocorrência sem trilha é a invariante 2 violada. Não se conserta lendo: grita.
      throw new Error(`Ocorrência ${id} sem registro de transição — invariante 2 violada.`);
    }

    return montarOcorrencia(linha, montarTransicao(ultima), anexos.map(montarAnexo));
  }

  return {
    /**
     * **Ocorrência + registro, num `COMMIT` só** — a invariante 2.
     *
     * **Este método transcreve o agregado; ele não decide nada.** `status`, `prioridade` e todo o
     * conteúdo do registro saem de `ocorrencia`, e são escritos **explicitamente** — não deixados para
     * o `default` da coluna. Os `default` da migração 005 continuam lá como rede para escrita
     * administrativa; **o escritor do caminho normal é o agregado**, e é o que faz a invariante 1 ser
     * estrutural.
     */
    async registrar(ocorrencia: Ocorrencia): Promise<ResultadoDoRegistro> {
      try {
        const lida = await emTransacao(async (executar) => {
          const criadas = await executar<{ id: string }>(
            `insert into ocorrencias
               (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo,
                localizacao_complemento, prioridade, status, autor_pessoa_id, registrada_em, atualizada_em)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
             returning id`,
            [
              ocorrencia.titulo,
              ocorrencia.descricao,
              ocorrencia.categoriaId,
              ocorrencia.areaId,
              ocorrencia.areaTipo,
              ocorrencia.localizacaoComplemento,
              ocorrencia.prioridade,
              ocorrencia.status,
              ocorrencia.autorPessoaId,
              ocorrencia.registradaEm,
            ],
          );

          const criada = criadas[0];
          if (criada === undefined) {
            throw new Error("insert ... returning não devolveu linha — invariante violada");
          }

          // **A premissa P1**, e ela vem do agregado — não de literais escritos aqui. Os `CHECK` da
          // migração 005 conferem os três fatos nos dois sentidos: `sequencia` 1, `status_anterior` nulo,
          // destino `aberta`.
          const primeira = ocorrencia.ultimaTransicao;
          await executar(
            `insert into registros_transicao
               (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo,
                ocorreu_em, autor_pessoa_id, observacao, motivo_pausa, motivo_cancelamento)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              criada.id,
              primeira.sequencia,
              primeira.statusAnterior,
              primeira.statusNovo,
              primeira.ocorreuEm,
              primeira.autorPessoaId,
              primeira.observacao,
              primeira.motivoPausa,
              primeira.motivoCancelamento,
            ],
          );

          /**
           * **A terceira escrita, no mesmo `COMMIT`.** O caso de uso NÃO chama
           * `repos.anexos.gravar(...)`: seriam duas transações, a invariante 2 cairia, e o anexo passaria
           * a ser escrito por fora do agregado — o defeito que a ADR-0001 recusa em uma frase. O
           * repositório continua transcritor: `tipo`, `chave`, `tipo_conteudo` e `tamanho_bytes` saem do
           * objeto de valor, e `fonte` fica no `default` do enum, que é o único provedor que existe.
           */
          for (const anexo of ocorrencia.anexos) {
            await executar(
              `insert into anexos
                 (organizacao_id, ocorrencia_id, tipo, chave, thumbnail_chave, nome_arquivo,
                  titulo, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id, anexado_em)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                criada.id,
                anexo.tipo,
                anexo.chave,
                anexo.thumbnailChave,
                anexo.nomeArquivo,
                anexo.titulo,
                anexo.tipoConteudo,
                anexo.tamanhoBytes,
                anexo.anexadoPorPessoaId,
                anexo.anexadoEm,
              ],
            );
          }

          const relida = await lerPorId(executar, criada.id);
          if (relida === null) {
            throw new Error("Ocorrência recém-gravada não foi relida — transação inconsistente.");
          }
          return relida;
        });

        return { desfecho: "registrada", ocorrencia: lida };
      } catch (erro) {
        if (!ehAnexoJaReivindicado(erro)) throw erro;

        const chave = ocorrencia.anexos[0]?.chave;
        if (chave === undefined) throw erro;

        /**
         * **A consulta que monta o corpo do `409` é ESCOPADA**, e é o que impede o `ocorrenciaId` de
         * apontar para fora da organização. A conferência 2 da reivindicação já provou que o ticket é
         * desta organização e desta Pessoa; se a linha existisse em outra — o que aquela conferência
         * torna inalcançável —, esta consulta devolveria nada e a resposta degradaria para `500` em vez
         * de vazar. O ponto de estrangulamento da D2 continua único.
         *
         * **Note que o `catch` envolve o `emTransacao` inteiro, e não o `insert`:** esta consulta precisa
         * rodar **depois** do `rollback` — de dentro da transação abortada, o Postgres recusa qualquer
         * comando com `25P02`.
         */
        const linhas = await consulta<{ ocorrencia_id: string }>(
          `select ocorrencia_id from anexos where organizacao_id = $1 and chave = $2`,
          [chave],
        );

        const linha = linhas[0];
        if (linha === undefined) throw erro;

        return { desfecho: "anexo-ja-reivindicado", ocorrenciaId: linha.ocorrencia_id };
      }
    },

    porId: (id) => lerPorId(consulta, id),

    /**
     * **A única leitura do produto que devolve `chave`.** O tipo de retorno é estreito de propósito: ele
     * não serve para montar payload nenhum, e é o que transforma *"a chave nunca sai"* de disciplina em
     * tipo.
     */
    async objetoDoAnexo(ocorrenciaId, anexoId) {
      const linhas = await consulta<{ chave: string; thumbnail_chave: string | null }>(
        `select a.chave, a.thumbnail_chave
           from anexos a
          where a.organizacao_id = $1 and a.ocorrencia_id = $2 and a.id = $3`,
        [ocorrenciaId, anexoId],
      );

      const linha = linhas[0];
      if (linha === undefined) return null;
      return { chave: linha.chave, thumbnailChave: linha.thumbnail_chave };
    },

    /**
     * A página da listagem.
     *
     * **`$1` é a organização, e os parâmetros de quem chama começam em `$2`** — por isso o contador
     * começa em 2. O SQL é montado por partes porque as duas condições são opcionais, e **não há
     * interpolação de valor em lugar nenhum**: o que entra no texto é sempre `$n`.
     *
     * **Os `::` não são decoração.** Numa comparação de linha `(a, b) < ($2, $3)` o Postgres não infere
     * o tipo dos parâmetros, e sem a marcação ele recusa a consulta.
     */
    async listar(filtro) {
      const valores: unknown[] = [];
      const condicoes: string[] = [];
      const proximo = () => `$${valores.length + 2}`;

      if (filtro.autorPessoaId !== undefined) {
        condicoes.push(`o.autor_pessoa_id = ${proximo()}::uuid`);
        valores.push(filtro.autorPessoaId);
      }

      if (filtro.cursor !== null) {
        const data = proximo();
        valores.push(filtro.cursor.registradaEm);
        const id = proximo();
        valores.push(filtro.cursor.id);
        condicoes.push(`(o.registrada_em, o.id) < (${data}::timestamptz, ${id}::uuid)`);
      }

      const limite = proximo();
      valores.push(filtro.limite);

      const linhas = await consulta<LinhaDeResumo>(
        `${SELECT_DO_RESUMO}
           ${condicoes.map((condicao) => `and ${condicao}`).join("\n           ")}
         order by o.registrada_em desc, o.id desc
         limit ${limite}::int`,
        valores,
      );

      return linhas.map(montarResumo);
    },

    async trilha(ocorrenciaId) {
      const linhas = await consulta<LinhaDeTransicao>(SELECT_DA_TRILHA, [ocorrenciaId]);
      return linhas.map(montarTransicao);
    },
  };
}
