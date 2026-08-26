import { LimiteDeAutorizacoesDeUpload } from "./erros";
import type { AutorizacaoEmitida, PedidoDeAutorizacao, PortasDeAnexo } from "./portas";

/** Trinta por Pessoa por hora — contrato §10.3, critério 13a.3. */
export const LIMITE_POR_HORA = 30;

/** **Janela deslizante**, e não hora de calendário: esta permitiria 60 em dois minutos sobre a virada. */
export const JANELA_EM_SEGUNDOS = 60 * 60;

/**
 * Emite a autorização de upload: conta a janela, grava a emissão, e só então assina as credenciais.
 *
 * **A ordem é contar-antes-de-emitir, e ela erra para o lado seguro.** Se a assinatura falhar depois da
 * contagem, um slot foi queimado sem credencial emitida — o cliente recebe `500` e perdeu uma das 30. A
 * ordem inversa deixaria uma sequência de falhas mintando SAS acima do limite, que é justamente o que o
 * limite existe para impedir.
 *
 * **A corrida fica declarada, não engenheirada.** Duas requisições simultâneas, nas duas réplicas, podem
 * ambas ver 30 e ambas gravar, concedendo **uma** autorização a mais. É uma, não trinta, e fechá-la
 * custaria transação serializável no caminho quente de um orçamento de 60 segundos.
 */
export async function autorizarUploadDeAnexo(
  portas: PortasDeAnexo,
  pedido: PedidoDeAutorizacao,
): Promise<AutorizacaoEmitida> {
  const limite = await portas.livro.registrarSeCouber(
    pedido.pessoaId,
    LIMITE_POR_HORA,
    JANELA_EM_SEGUNDOS,
  );

  if (!limite.concedida) throw new LimiteDeAutorizacoesDeUpload(limite.segundosAteLiberar);

  return portas.emissor.emitir(pedido);
}
