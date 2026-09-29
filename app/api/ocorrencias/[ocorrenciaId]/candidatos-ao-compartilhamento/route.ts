import { buscarCandidatosAoCompartilhamento } from "@/aplicacao/ocorrencia";
import { comContexto, lerBuscaDeCandidatosDaUrl } from "@/interface/http";
import { projetarCandidato } from "@/interface/projecoes";

/**
 * **`GET /ocorrencias/{id}/candidatos-ao-compartilhamento` — quem pode receber, item 87.**
 *
 * **A busca é no servidor, e a lista inteira não desce ao navegador.** O Gestor já tem essa lista pelo
 * modal de atribuição; o Solicitante não tem, e passa a ter o nome de participantes por este gesto. O
 * mínimo de duas letras e o teto de vinte não impedem quem queira enumerar — isso está escrito em
 * `docs/seguranca.md`. O que eles impedem é mandar os duzentos nomes para todo celular que abre o painel.
 *
 * **Não traz contato nem área.** Contato é *"só para quem gere vínculos"*, regra do contrato; área é a
 * unidade de moradia de um vizinho, e o gesto não precisa dela.
 *
 * **O caminho não contém `pessoas`** de propósito: não existe endereço global de Pessoa, e a leitura parte
 * do vínculo dentro da ocorrência.
 */
export const GET = comContexto(
  { exige: "ocorrencia.ler_propria" },
  async ({ ctx, repos, parametros, requisicao }) => {
    const candidatos = await buscarCandidatosAoCompartilhamento(
      repos.ocorrencias,
      { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        busca: lerBuscaDeCandidatosDaUrl(new URL(requisicao.url).searchParams),
      },
    );

    return { itens: candidatos.map(projetarCandidato) };
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
