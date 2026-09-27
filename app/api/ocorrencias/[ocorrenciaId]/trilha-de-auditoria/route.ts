import {
  OcorrenciaNaoEncontrada,
  podeLerOcorrencia,
  verOcorrencia,
  verTrilhaDeAuditoria,
} from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarTransicao } from "@/interface/projecoes";

/**
 * **`GET /ocorrencias/{id}/trilha-de-auditoria`** — a sequência completa dos registros de transição,
 * cada um com os cinco campos exigidos pelo desafio.
 *
 * **É a única forma de alcançar um registro de transição pela API, e é somente leitura.** Não existe
 * `POST`, `PATCH` nem `DELETE` neste recurso: registro de transição é objeto de valor imutável dentro do
 * agregado e nasce como **efeito** de um comando. Se um dia aparecer escrita aqui, a garantia central do
 * produto terá sido perdida.
 *
 * **A tela T-06 não existe nesta fatia**, e o endpoint entra assim mesmo: é o instrumento que o critério
 * 11.2 nomeia, e é o requisito central do desafio ganhando prova acessível de fora.
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros }) => {
    const id = parametros.ocorrenciaId ?? "";
    const lida = await verOcorrencia(repos.ocorrencias, id);

    // **A regra de leitura estava copiada aqui em linha**, e o item 87 a devolveu a `podeLerOcorrencia`
    // — o único lugar onde ela mora. Sem isto, quem recebeu a ocorrência compartilhada veria a trilha em
    // T-06 e levaria `404` nesta rota, e *"a leitura muda num lugar só"* seria falso.
    const quem = { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") };
    if (!podeLerOcorrencia(lida, quem)) throw new OcorrenciaNaoEncontrada();

    return { itens: (await verTrilhaDeAuditoria(repos.ocorrencias, id)).map(projetarTransicao) };
  },
);

export const dynamic = "force-dynamic";
