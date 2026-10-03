import type { Papel } from "@/dominio/organizacao";

import type { RepositorioEscopadoDeOcorrencias, SinoLido } from "./portas";

/**
 * ============================================================================
 *  O sino — item 117
 * ============================================================================
 *
 * **A Aplicação traduz quem olha em pergunta, e não decide quem é avisado.** A regra de destinatários
 * mora na consulta, porque é ela que tem de ser a mesma para a lista e para o número (critério 4).
 *
 * **"É Gestor" é o papel do vínculo, e não a permissão** (spec §3.2): é a palavra da decisão 3 da
 * entrevista, e é a única checagem por papel deste módulo. Ler todas é permissão, como no resto.
 */
export const JANELA_DO_SINO_EM_DIAS = 30;
/** Quantas linhas a lista mostra; o número conta todas (spec §3.11). */
export const LIMITE_DO_SINO = 50;

const DIA = 24 * 60 * 60_000;

export type QuemOlhaOSino = { pessoaId: string; permissoes: readonly string[]; papel: Papel };

export async function verSino(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "sino">,
  quem: QuemOlhaOSino,
  agora: Date = new Date(),
): Promise<SinoLido> {
  return repositorio.sino({
    pessoaId: quem.pessoaId,
    podeLerTodas: quem.permissoes.includes("ocorrencia.ler_todas"),
    ehGestor: quem.papel === "gestor",
    desde: new Date(agora.getTime() - JANELA_DO_SINO_EM_DIAS * DIA).toISOString(),
    limite: LIMITE_DO_SINO,
  });
}

/**
 * Abrir, agir ou marcar à mão — itens 88 e 117. **Não confere nada, e a ausência é a autorização**: a
 * instrução só acha ocorrência desta organização, e não diz se ela existe (contrato §6.3). **Não depende
 * de papel nem de permissão.**
 */
export async function registrarLeitura(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "registrarLeitura">,
  ocorrenciaId: string,
  quem: { pessoaId: string },
): Promise<void> {
  await repositorio.registrarLeitura(ocorrenciaId, quem.pessoaId);
}

/** Marcar como não lida apaga a leitura (critério 117.5). */
export async function marcarComoNaoLida(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "desfazerLeitura">,
  ocorrenciaId: string,
  quem: { pessoaId: string },
): Promise<void> {
  await repositorio.desfazerLeitura(ocorrenciaId, quem.pessoaId);
}
