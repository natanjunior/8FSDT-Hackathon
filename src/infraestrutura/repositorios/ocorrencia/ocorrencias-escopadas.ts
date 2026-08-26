import type {
  OcorrenciaLida,
  RepositorioEscopadoDeOcorrencias,
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

function montarOcorrencia(linha: LinhaDeOcorrencia, ultima: TransicaoLida): OcorrenciaLida {
  return {
    id: linha.id,
    titulo: linha.titulo,
    descricao: linha.descricao,
    status: linha.status,
    prioridade: linha.prioridade,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome, icone: linha.categoria_icone },
    area: { id: linha.area_id, nome: linha.area_nome, tipo: linha.area_tipo },
    localizacaoComplemento: linha.localizacao_complemento,
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

export function repositorioEscopadoDeOcorrencias(
  consulta: ConsultaEscopada,
  emTransacao: TransacaoEscopada,
): RepositorioEscopadoDeOcorrencias {
  async function lerPorId(executar: ConsultaEscopada, id: string): Promise<OcorrenciaLida | null> {
    const linhas = await executar<LinhaDeOcorrencia>(`${SELECT_DA_OCORRENCIA} and o.id = $2`, [id]);
    const linha = linhas[0];
    if (linha === undefined) return null;

    const trilha = await executar<LinhaDeTransicao>(SELECT_DA_TRILHA, [id]);
    const ultima = trilha[trilha.length - 1];
    if (ultima === undefined) {
      // Ocorrência sem trilha é a invariante 2 violada. Não se conserta lendo: grita.
      throw new Error(`Ocorrência ${id} sem registro de transição — invariante 2 violada.`);
    }

    return montarOcorrencia(linha, montarTransicao(ultima));
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
    async registrar(ocorrencia: Ocorrencia): Promise<OcorrenciaLida> {
      return emTransacao(async (executar) => {
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

        const lida = await lerPorId(executar, criada.id);
        if (lida === null) {
          throw new Error("Ocorrência recém-gravada não foi relida — transação inconsistente.");
        }
        return lida;
      });
    },

    porId: (id) => lerPorId(consulta, id),

    async trilha(ocorrenciaId) {
      const linhas = await consulta<LinhaDeTransicao>(SELECT_DA_TRILHA, [ocorrenciaId]);
      return linhas.map(montarTransicao);
    },
  };
}
