import { OcorrenciaNaoEncontrada, verOcorrencia, verTrilhaDeAuditoria } from "@/aplicacao/ocorrencia";
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

    if (!ctx.vinculo.pode("ocorrencia.ler_todas") && lida.autor.pessoaId !== ctx.pessoaId) {
      throw new OcorrenciaNaoEncontrada();
    }

    return { itens: (await verTrilhaDeAuditoria(repos.ocorrencias, id)).map(projetarTransicao) };
  },
);

export const dynamic = "force-dynamic";
