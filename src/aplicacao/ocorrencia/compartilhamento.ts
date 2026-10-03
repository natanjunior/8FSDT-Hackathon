import { PAPEIS, PERMISSOES_POR_PAPEL, type Papel } from "@/dominio/organizacao";

import { participaDaOcorrencia, recusaDeQuemNaoParticipa, type QuemPergunta } from "./consultas";
import { CompartilhamentoDeOutraPessoa, DestinatarioInvalido, OcorrenciaNaoEncontrada } from "./erros";
import type { CompartilhamentoLido, OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  O compartilhamento — item 87
 * ============================================================================
 *
 * **Dado, e não permissão.** Nada aqui toca `Permissao.ts`: quem pode ver é resolvido em
 * `podeLerOcorrencia`, e aqui só se escreve e se apaga a linha. As regras de quem com quem são de
 * PERMISSÃO do vínculo de destino, nunca do papel (contrato §4.5) — o papel entra só como chave de
 * `PERMISSOES_POR_PAPEL`.
 */

export const LIMITE_DE_CANDIDATOS = 20;

export type MotivoDeJaVer = "le_todas" | "autor";

export type CandidatoAoCompartilhamento = {
  pessoaId: string;
  nome: string;
  papel: Papel;
  situacao: "disponivel" | "ja_compartilhada" | "ja_ve";
  motivo: MotivoDeJaVer | null;
};

const pode = (papel: Papel, permissao: "ocorrencia.ler_todas" | "ocorrencia.ler_propria") =>
  PERMISSOES_POR_PAPEL[papel].includes(permissao);

/** Lê, e recusa quem não participa — `403` a quem recebeu, `404` a quem não alcança. */
async function lidaDeQuemParticipa(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  ocorrenciaId: string,
): Promise<OcorrenciaLida> {
  const lida = await repositorio.porId(ocorrenciaId);
  if (lida === null) throw new OcorrenciaNaoEncontrada();
  if (!participaDaOcorrencia(lida.autor.pessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, ocorrenciaId, quem.pessoaId);
  }
  return lida;
}

/**
 * `POST /ocorrencias/{id}/compartilhamentos` — abre a ocorrência, só para leitura, a outra pessoa.
 *
 * **`criado: false` não é erro:** duas abas mandando o mesmo pedido terminam com uma linha e nenhuma vê
 * erro, e é o cenário aprovado *"compartilhar duas vezes com a mesma pessoa"*.
 */
export async function compartilharOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  entrada: { ocorrenciaId: string; pessoaId: string; agora?: string },
): Promise<{ criado: boolean; compartilhamento: CompartilhamentoLido }> {
  const lida = await lidaDeQuemParticipa(repositorio, quem, entrada.ocorrenciaId);

  // Critério 87.4: destino fora desta organização, revogado ou inventado responde como se a
  // ocorrência não existisse. O repositório escopado não tem como ver o vínculo de outra.
  const destino = await repositorio.destinatario(entrada.pessoaId);
  if (destino === null) throw new OcorrenciaNaoEncontrada();

  if (pode(destino.papel, "ocorrencia.ler_todas") || entrada.pessoaId === lida.autor.pessoaId) {
    throw new DestinatarioInvalido("JA_VE_A_OCORRENCIA");
  }
  if (!quem.podeLerTodas && !pode(destino.papel, "ocorrencia.ler_propria")) {
    throw new DestinatarioInvalido("FORA_DO_ALCANCE");
  }

  const resultado = await repositorio.compartilhar(entrada.ocorrenciaId, {
    comPessoaId: entrada.pessoaId,
    porPessoaId: quem.pessoaId,
    em: entrada.agora ?? new Date().toISOString(),
  });
  // A corrida com uma revogação: o `where exists` do `insert` a pega, e a resposta é a mesma do 87.4.
  if (resultado.desfecho === "destinatario-sem-vinculo-ativo") throw new OcorrenciaNaoEncontrada();

  const compartilhamento = await repositorio.compartilhamentoCom(
    entrada.ocorrenciaId,
    entrada.pessoaId,
  );
  if (compartilhamento === null) throw new OcorrenciaNaoEncontrada();
  return { criado: resultado.desfecho === "criado", compartilhamento };
}

/**
 * `DELETE /ocorrencias/{id}/compartilhamentos/{pessoaId}` — apaga a linha, sem histórico.
 *
 * **Idempotente**, porque o cenário aprovado manda *"ninguém vê erro"* com duas abas, e desfazer duas
 * vezes é o mesmo caso.
 */
export async function desfazerCompartilhamento(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  entrada: { ocorrenciaId: string; pessoaId: string },
): Promise<void> {
  await lidaDeQuemParticipa(repositorio, quem, entrada.ocorrenciaId);

  const linha = await repositorio.compartilhamentoCom(entrada.ocorrenciaId, entrada.pessoaId);
  if (linha === null) return;

  // Quem compartilhou desfaz o seu; o Gestor desfaz qualquer um. O autor que tenta desfazer a linha do
  // Gestor leva `403` — é o cenário *"o Solicitante não desfaz o que o Gestor fez"*.
  if (!quem.podeLerTodas && linha.por.pessoaId !== quem.pessoaId) {
    throw new CompartilhamentoDeOutraPessoa();
  }
  await repositorio.desfazerCompartilhamento(entrada.ocorrenciaId, entrada.pessoaId);
}

/**
 * `GET /ocorrencias/{id}/candidatos-ao-compartilhamento` — quem pode receber, e quem já vê.
 *
 * **Quem já vê aparece e vem marcado**, em vez de sumir: o cenário aprovado manda a tela *"recusar
 * dizendo por quê"*, e some quem está fora do alcance de quem pergunta.
 */
export async function buscarCandidatosAoCompartilhamento(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  entrada: { ocorrenciaId: string; busca: string },
): Promise<readonly CandidatoAoCompartilhamento[]> {
  const lida = await lidaDeQuemParticipa(repositorio, quem, entrada.ocorrenciaId);

  // Quem compartilha sem `ler_todas` só alcança quem tem `ler_propria` (a suposição da entrevista, virada
  // regra de permissão). O filtro desce ao SQL: filtrar depois do `limit` devolveria menos que 20.
  const papeis = PAPEIS.filter((papel) => quem.podeLerTodas || pode(papel, "ocorrencia.ler_propria"));

  const linhas = await repositorio.candidatosAoCompartilhamento(entrada.ocorrenciaId, {
    texto: entrada.busca,
    papeis,
    exceto: quem.pessoaId,
    limite: LIMITE_DE_CANDIDATOS,
  });

  return linhas.map((linha) => {
    const motivo: MotivoDeJaVer | null = pode(linha.papel, "ocorrencia.ler_todas")
      ? "le_todas"
      : linha.pessoaId === lida.autor.pessoaId
        ? "autor"
        : null;
    const situacao =
      motivo !== null ? "ja_ve" : linha.jaCompartilhada ? "ja_compartilhada" : "disponivel";
    return { pessoaId: linha.pessoaId, nome: linha.nome, papel: linha.papel, situacao, motivo };
  });
}

/**
 * A leitura de quem abre — itens 88 e 117. **Abrir T-05 grava a leitura de quem abriu, recebida ou não.**
 *
 * **Não confere nada, e a ausência é a autorização.** A instrução só acha ocorrência desta organização, e
 * não diz se ela existe (contrato §6.3). **Não depende de papel nem de permissão.**
 */
export async function registrarLeitura(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "registrarLeitura">,
  ocorrenciaId: string,
  quem: { pessoaId: string },
): Promise<void> {
  await repositorio.registrarLeitura(ocorrenciaId, quem.pessoaId);
}
