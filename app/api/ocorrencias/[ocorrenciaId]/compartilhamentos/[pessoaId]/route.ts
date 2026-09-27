import { desfazerCompartilhamento } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";

/**
 * **`DELETE /ocorrencias/{id}/compartilhamentos/{pessoaId}` — desfazer, item 87.**
 *
 * **`DELETE`, e não `POST …/desfazer`.** O compartilhamento é um recurso com identidade — o par ocorrência
 * e pessoa — e desfazer apaga a linha, sem histórico. A regra *"a escrita é comando"* do contrato vale
 * para os comandos de domínio do agregado, e este não é um deles.
 *
 * **`204` também quando a linha não existe.** Duas abas desfazendo o mesmo não veem erro, e desfazer duas
 * vezes é o mesmo caso.
 *
 * **Quem desfaz:** quem compartilhou, ou quem tem `ocorrencia.ler_todas`. O autor que tenta desfazer a
 * linha do Gestor leva `403`, e é a Aplicação que decide isso.
 */
export const DELETE = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros }) => {
    await desfazerCompartilhamento(
      repos.ocorrencias,
      { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        pessoaId: parametros["pessoaId"] ?? "",
      },
    );
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
