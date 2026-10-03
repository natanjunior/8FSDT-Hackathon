import { registrarLeitura, type RepositorioEscopadoDeOcorrencias } from "@/aplicacao/ocorrencia";

import { registrarFalha } from "./com-contexto";
import { novoTraceId } from "./traco";

/**
 * **Agir marca como lida** — item 117, spec §3.5.
 *
 * **Mora aqui, e não nos casos de uso nem num gatilho**: três comandos não gravam evento, e a falha precisa
 * de `registrarFalha`, que é da Interface. Todo escritor de ocorrência é um `route.ts` da mesma pasta, e
 * um teste de fonte os enumera.
 *
 * **Chamado depois do caso de uso**: o comando já gravou, e `now()` da leitura é posterior ao instante do
 * evento que ele produziu. **Falha não derruba a resposta**: o comando aconteceu, e a ocorrência fica não
 * lida até a próxima abertura.
 */
export async function registrarLeituraDeQuemAgiu(
  repositorio: Pick<RepositorioEscopadoDeOcorrencias, "registrarLeitura">,
  ocorrenciaId: string,
  pessoaId: string,
  caminho: string,
): Promise<void> {
  try {
    await registrarLeitura(repositorio, ocorrenciaId, { pessoaId });
  } catch (erro) {
    registrarFalha(erro, caminho, "POST", novoTraceId());
  }
}
