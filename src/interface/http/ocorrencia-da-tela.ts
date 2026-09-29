import { cache } from "react";

import {
  OcorrenciaNaoEncontrada,
  podeLerOcorrencia,
  verOcorrencia,
  type OcorrenciaLida,
} from "@/aplicacao/ocorrencia";

import { resolverEscopoParaTela } from "./com-contexto";

/**
 * **A leitura da ocorrência para T-05 e T-06, uma vez por requisição** (item 90, spec §4.3).
 *
 * `generateMetadata` e a página chamam esta função com o mesmo id, e o `cache()` do React devolve a mesma
 * promessa às duas: o título de aba não custa ida ao banco. É o que a documentação instalada indica para
 * leitura que não passa por `fetch`
 * (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:113`).
 *
 * **A autorização é a da página, inteira.** O que `podeLerOcorrencia` recusa volta `null`, igual ao
 * inexistente (§6.3 do contrato), e o título de aba não confirma a existência que a tela esconde. Sem
 * organização ativa e sem a permissão de leitura também volta `null`.
 *
 * **`NaoAutenticado` e qualquer outro erro sobem.** Quem decide o destino é a página, que redireciona; um
 * ajudante de transporte que redirecionasse esconderia navegação dentro de leitura.
 */
export const lerOcorrenciaDaTela = cache(async function lerOcorrenciaDaTela(
  ocorrenciaId: string,
): Promise<OcorrenciaLida | null> {
  const escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  if (escopo.situacao !== "pronto") return null;

  let lida;
  try {
    lida = await verOcorrencia(escopo.repos.ocorrencias, ocorrenciaId);
  } catch (erro) {
    if (erro instanceof OcorrenciaNaoEncontrada) return null;
    throw erro;
  }

  const quem = {
    pessoaId: escopo.ctx.pessoaId,
    podeLerTodas: escopo.ctx.vinculo.pode("ocorrencia.ler_todas"),
  };
  return podeLerOcorrencia(lida, quem) ? lida : null;
});

/**
 * **O título de aba nunca derruba a página.** Sem sessão, sem organização, sem permissão ou com o banco
 * fora, sai o recuo; quem decide o que fazer com cada caso é a página, que roda depois e tem os mesmos
 * dados. Uma exceção em `generateMetadata` daria a tela de erro antes de a página poder redirecionar.
 */
export async function tituloDeAbaDaOcorrencia(ocorrenciaId: string, recuo: string): Promise<string> {
  try {
    const lida = await lerOcorrenciaDaTela(ocorrenciaId);
    return lida?.titulo ?? recuo;
  } catch {
    return recuo;
  }
}
