import { verLinhaDoTempo } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarEventoDaLinhaDoTempo } from "@/interface/projecoes";

/**
 * **`GET /ocorrencias/{id}/linha-do-tempo`** — transições e atribuições intercaladas por instante, com o
 * status em **rótulo de linguagem de gente**. É a capacidade S9 do enunciado: o Solicitante acompanha sem
 * precisar perguntar.
 *
 * **Não confundir com a trilha de auditoria.** A trilha é só transições, com os nomes internos, e é a
 * **fonte**; a linha do tempo é a apresentação dela somada às atribuições — e, no dia do item 30, à
 * conversa. Duas leituras sobre os mesmos fatos, com vocabulários diferentes (`contrato-de-api.md` §8.5).
 *
 * **Sem `POST`, sem `PATCH`, sem `DELETE`, e a ausência é a §9.1:** esta é uma das duas únicas formas de
 * alcançar um registro de transição pela API, e as duas são somente leitura. Se um dia aparecer escrita
 * aqui, a garantia central do produto terá sido perdida.
 *
 * **Três linhas, e é o ponto.** `verLinhaDoTempo` recebe `quem` e faz **um** `porId` — o endpoint irmão
 * da trilha faz dois, e é o achado A-2 da spec do item 29, que esta rota não repete.
 *
 * **O `404` de quem não pode ler vem de dentro**, idêntico ao de inexistente (§6.3). A conferência do
 * `X-Organizacao-Id` é do `comContexto` e vale para os trinta e três endpoints escopados (item 7b).
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros }) => ({
    itens: (
      await verLinhaDoTempo(repos.ocorrencias, parametros.ocorrenciaId ?? "", {
        pessoaId: ctx.pessoaId,
        podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas"),
      })
    ).map(projetarEventoDaLinhaDoTempo),
  }),
);

export const dynamic = "force-dynamic";
