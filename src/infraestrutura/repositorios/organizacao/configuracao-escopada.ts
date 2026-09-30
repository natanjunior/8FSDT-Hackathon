import type {
  AlteracaoDeConfiguracao,
  ChaveDeConfiguracao,
  ConfiguracaoLida,
  PedidoDeRotulos,
  RegrasDaOrganizacao,
  RepositorioEscopadoDaConfiguracao,
  RotulosDoSolicitante,
} from "@/aplicacao/organizacao";
import type { LimiteDeCancelamentoDoSolicitante, StatusOcorrencia } from "@/dominio/ocorrencia";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * `GET` e `PATCH /configuracao` — as regras da organização ativa, os textos que quem abriu lê, e a
 * trilha das duas coisas (itens 99 e 100).
 *
 * **O `where` é `id = $1` em `organizacoes` e `organizacao_id = $1` nas outras duas**, e `$1` é injetado
 * pelo ponto único: este arquivo não recebe o identificador.
 *
 * **A trilha tem dois caminhos, e a diferença é quem sabe o valor anterior.** A mudança de regra é
 * gravada pelo gatilho da migração 017, com o `OLD` da linha travada — é o que faz a segunda de duas
 * escritas simultâneas registrar o valor que a primeira deixou; e `atualizado_por_pessoa_id` vai sempre
 * na instrução, porque é dele que o gatilho tira o autor. A mudança de rótulo é gravada **aqui**, na
 * mesma transação: um gatilho na tabela dos rótulos não saberia quem apagou uma linha.
 *
 * **A leitura das mudanças parte de `vinculos`** para chegar ao nome, como toda leitura de gente.
 */
export function repositorioEscopadoDaConfiguracao(
  consulta: ConsultaEscopada,
  transacao: TransacaoEscopada,
): RepositorioEscopadoDaConfiguracao {
  async function lerRotulos(consultar: ConsultaEscopada): Promise<RotulosDoSolicitante> {
    const linhas = await consultar<LinhaDoRotulo>(
      `select estado, rotulo from rotulos_de_status where organizacao_id = $1`,
    );
    return Object.fromEntries(linhas.map((linha) => [linha.estado, linha.rotulo]));
  }

  /**
   * **Uma linha de `organizacoes`, e nada de `mudancas_de_configuracao`** (item 101). É a leitura que
   * T-03 faz em toda abertura da lista; a trilha é de T-15.
   *
   * **Ela e `lerCom` partilham o `select` e o mapeamento** de propósito: duas cópias divergem na
   * primeira regra nova, e a regra nova é justamente o que este item acrescentou.
   */
  async function lerRegrasCom(consultar: ConsultaEscopada): Promise<RegrasDaOrganizacao> {
    const linhas = await consultar<LinhaDasRegras>(
      `select exigir_solucao_ao_resolver, limite_cancelamento_solicitante, dias_para_parada
         from organizacoes
        where id = $1`,
    );
    const linha = linhas[0];
    // **Zero linhas não é desfecho de domínio.** `$1` é a organização da sessão, e a sessão só existe
    // porque um vínculo dela foi lido. Sem linha, o banco está em outro estado.
    if (linha === undefined) throw new Error("a organização da sessão não devolveu linha");

    return {
      exigirSolucaoAoResolver: linha.exigir_solucao_ao_resolver,
      limiteDeCancelamentoDoSolicitante: linha.limite_cancelamento_solicitante,
      diasParaParada: linha.dias_para_parada,
    };
  }

  async function lerCom(consultar: ConsultaEscopada): Promise<ConfiguracaoLida> {
    const regras = await lerRegrasCom(consultar);

    const mudancas = await consultar<LinhaDaMudanca>(
      `select m.chave, m.valor_anterior, m.valor_novo, m.ocorrida_em, m.autor_pessoa_id, p.nome as autor_nome
         from mudancas_de_configuracao m
         join vinculos v on v.pessoa_id = m.autor_pessoa_id and v.organizacao_id = m.organizacao_id
         join pessoas  p on p.id = v.pessoa_id
        where m.organizacao_id = $1
        order by m.ocorrida_em desc, m.chave`,
    );

    return {
      regras,
      rotulos: await lerRotulos(consultar),
      mudancas: mudancas.map((m) => ({
        chave: m.chave,
        valorAnterior: m.valor_anterior,
        valorNovo: m.valor_novo,
        autor: { pessoaId: m.autor_pessoa_id, nome: m.autor_nome },
        ocorridaEm: m.ocorrida_em.toISOString(),
      })),
    };
  }

  return {
    ler: () => lerCom(consulta),

    lerRegras: () => lerRegrasCom(consulta),

    rotulosDoSolicitante: () => lerRotulos(consulta),

    async alterar(alteracao: AlteracaoDeConfiguracao): Promise<ConfiguracaoLida> {
      const valores: unknown[] = [];
      // `$1` é a organização, amarrado pelo ponto único — os parâmetros de quem chama começam em `$2`.
      const marcador = (valor: unknown): string => {
        valores.push(valor);
        return `$${String(valores.length + 1)}`;
      };

      const atribuicoes: string[] = [];
      if (alteracao.exigirSolucaoAoResolver !== undefined) {
        atribuicoes.push(`exigir_solucao_ao_resolver = ${marcador(alteracao.exigirSolucaoAoResolver)}`);
      }
      if (alteracao.limiteDeCancelamentoDoSolicitante !== undefined) {
        atribuicoes.push(
          `limite_cancelamento_solicitante = ${marcador(
            alteracao.limiteDeCancelamentoDoSolicitante,
          )}::status_ocorrencia`,
        );
      }
      if (alteracao.diasParaParada !== undefined) {
        atribuicoes.push(`dias_para_parada = ${marcador(alteracao.diasParaParada)}`);
      }
      const mudouRegra = atribuicoes.length > 0;
      atribuicoes.push(`atualizado_por_pessoa_id = ${marcador(alteracao.atualizadaPorPessoaId)}`);

      return transacao(async (consultar) => {
        /**
         * **A trava, e ela é o mecanismo.** O `for update` na linha da organização serializa as escritas
         * de configuração dela: a segunda lê como anterior o que a primeira gravou, e a trilha registra
         * duas mudanças em vez de duas vezes a mesma. Para as regras isso já vinha do `update`; para os
         * rótulos, que moram em outra tabela e podem **não ter linha**, não havia o que travar — não se
         * trava uma linha que não existe.
         */
        await consultar(`select 1 from organizacoes where id = $1 for update`);

        // **Sem regra a mudar, nenhum `update organizacoes`.** Emiti-lo assim mesmo não teria o que
        // alterar e gravaria rastro de escrita que não houve.
        if (mudouRegra) {
          await consultar(`update organizacoes set ${atribuicoes.join(", ")} where id = $1`, valores);
        }
        if (alteracao.rotulos !== undefined) {
          await aplicarRotulos(consultar, alteracao.rotulos, alteracao.atualizadaPorPessoaId);
        }
        return lerCom(consultar);
      });
    },
  };
}

/**
 * **Rótulo e trilha, juntos** (item 100). Não é gatilho porque um gatilho não sabe quem apagou: a linha
 * que o `delete` remove carrega o autor da escrita anterior. O valor anterior é lido aqui dentro, com a
 * organização já travada.
 *
 * **O padrão é o texto vazio nas duas pontas**, e `''` nunca é um rótulo gravado — o `check` da migração
 * 018 exige ao menos um caractere. Escrita que não muda valor nenhum não deixa linha.
 */
async function aplicarRotulos(
  consultar: ConsultaEscopada,
  pedido: PedidoDeRotulos,
  autorPessoaId: string,
): Promise<void> {
  const atuais = await consultar<LinhaDoRotulo>(
    `select estado, rotulo from rotulos_de_status where organizacao_id = $1`,
  );
  const anteriorDe = new Map(atuais.map((linha) => [linha.estado, linha.rotulo]));

  for (const [estado, pedida] of Object.entries(pedido)) {
    const anterior = anteriorDe.get(estado as StatusOcorrencia) ?? "";
    const novo = pedida ?? "";
    if (novo === anterior) continue;

    if (novo === "") {
      await consultar(`delete from rotulos_de_status where organizacao_id = $1 and estado = $2`, [
        estado,
      ]);
    } else {
      await consultar(
        `insert into rotulos_de_status (organizacao_id, estado, rotulo) values ($1, $2, $3)
           on conflict (organizacao_id, estado) do update set rotulo = excluded.rotulo`,
        [estado, novo],
      );
    }

    await consultar(
      `insert into mudancas_de_configuracao
         (organizacao_id, chave, valor_anterior, valor_novo, autor_pessoa_id)
       values ($1, $2, $3, $4, $5)`,
      [`rotulo_${estado}`, anterior, novo, autorPessoaId],
    );
  }
}

type LinhaDasRegras = {
  exigir_solucao_ao_resolver: boolean;
  limite_cancelamento_solicitante: LimiteDeCancelamentoDoSolicitante;
  dias_para_parada: number;
};

type LinhaDoRotulo = {
  estado: StatusOcorrencia;
  rotulo: string;
};

type LinhaDaMudanca = {
  chave: ChaveDeConfiguracao;
  valor_anterior: string;
  valor_novo: string;
  ocorrida_em: Date;
  autor_pessoa_id: string;
  autor_nome: string;
};
