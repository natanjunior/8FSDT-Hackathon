import { OcorrenciaNaoEncontrada, verOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";

/**
 * **`GET /ocorrencias/{id}`** — o endereço próprio da ocorrência, e o inventário é enfático sobre o que
 * ele é: *"o link que substitui descrever a ocorrência por WhatsApp — o comportamento exato que o
 * produto veio substituir"*.
 *
 * **A visibilidade da primeira entrega:** o autor, ou quem tem `ocorrencia.ler_todas`. Quem não alcança
 * recebe `404 OCORRENCIA_NAO_ENCONTRADA` — **idêntico** ao de inexistente, que é a §6.3: *"não confirmar
 * a existência do que você não pode alcançar"*.
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros }) => {
    const lida = await verOcorrencia(repos.ocorrencias, parametros.ocorrenciaId ?? "");

    // O `escopo.md` §3.3 fixa a regra: *"na primeira entrega toda ocorrência é visível apenas ao autor e
    // aos Gestores"*. `area_tipo` está gravado desde o primeiro registro, mas a visibilidade derivada
    // dele é evolução prevista — o dado entra, o comportamento não é exercido.
    const podeLer =
      ctx.vinculo.pode("ocorrencia.ler_todas") || lida.autor.pessoaId === ctx.pessoaId;
    if (!podeLer) throw new OcorrenciaNaoEncontrada();

    return projetarOcorrenciaDetalhe(lida, {
      pessoaId: ctx.pessoaId,
      permissoes: ctx.vinculo.permissoes,
    });
  },
);

export const dynamic = "force-dynamic";
