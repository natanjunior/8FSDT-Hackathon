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
 * `X-Organizacao-Id` é do `comContexto` e vale para os trinta e seis endpoints escopados (item 7b).
 *
 * **O `rotulo` sai na coluna de quem lê** (critério 31.7), pela mesma permissão que decide o recorte —
 * `ocorrencia.ler_todas`. É a descrição do campo `rotulo` do `EventoTransicao` no `openapi.yaml`.
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros, lente }) => {
    const eventos = await verLinhaDoTempo(repos.ocorrencias, parametros.ocorrenciaId ?? "", {
      pessoaId: ctx.pessoaId,
      podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas"),
    });

    // **A lente é a MESMA permissão que decide o recorte, e vem resolvida do ponto único** — critério
    // 31.7, e o item 100, que lhe deu os textos da organização. O Gestor lê "Aberta", "Em atendimento" e
    // "Pausada" onde o Solicitante lê as frases dele.
    return { itens: eventos.map((evento) => projetarEventoDaLinhaDoTempo(evento, lente)) };
  },
);

export const dynamic = "force-dynamic";
