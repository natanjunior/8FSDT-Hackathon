import { verAnexoDaOcorrencia } from "@/aplicacao/ocorrencia";
import { armazenamentoDeAnexos, comContexto, lerVarianteDaUrl, resposta } from "@/interface/http";

/**
 * **`GET /ocorrencias/{id}/anexos/{anexoId}`** — `302` para uma URL assinada de **10 minutos**.
 *
 * **Nunca bytes.** Fazer proxy devolveria o custo de *streaming* que a decisão de upload evitou — e agora
 * em toda leitura, não só na escrita (contrato §10.4). E nenhuma URL de storage aparece em payload
 * nenhum: ela muda a cada resposta, e a credencial ficaria em log e em histórico.
 *
 * **A autorização acontece AQUI, a cada leitura** — é a ocorrência que decide quem vê, nunca a posse de um
 * link. Quem não alcança recebe `404`, idêntico ao de inexistente (§6.3).
 *
 * **`?variante=miniatura` é a mesma operação, com a mesma autorização.** Um caminho separado teria criado
 * um segundo lugar onde a permissão precisaria ser checada.
 *
 * **`Referrer-Policy: no-referrer` não é enfeite:** a URL assinada não deve vazar pelo cabeçalho de
 * origem da requisição seguinte. É a mitigação declarada no contrato, junto do TTL curto.
 *
 * *Permissão: `ocorrencia.ler_propria` — o Gestor acumula (§4.5), e qual dos dois conjuntos ele alcança é
 * decidido por `ler_todas`, dentro da consulta.*
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros, requisicao }) => {
    const url = await verAnexoDaOcorrencia(
      repos.ocorrencias,
      armazenamentoDeAnexos(),
      { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
      {
        ocorrenciaId: parametros.ocorrenciaId ?? "",
        anexoId: parametros.anexoId ?? "",
        variante: lerVarianteDaUrl(requisicao),
      },
    );

    // `montarResposta` preserva o status quando o corpo é nulo, então `302` chega inteiro — nada novo
    // é preciso em `com-contexto.ts`.
    return resposta(null, {
      status: 302,
      cabecalhos: { Location: url, "Referrer-Policy": "no-referrer" },
    });
  },
);

export const dynamic = "force-dynamic";
