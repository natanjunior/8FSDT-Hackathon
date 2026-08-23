import { CodigoPublicoNaoEncontrado, JaVinculado, PedidoDeEntradaPendente } from "./erros";
import type { PedidoDeEntradaRegistrado, RepositorioDePedidosDeEntrada } from "./portas";

/**
 * **Pedir entrada com o Código da Organização** — item 7a, capacidade `NOSSO` (D25).
 *
 * *"Código vazado não vira acesso: vira um pedido aguardando aprovação"* é o comportamento inteiro deste
 * comando. **Ele nunca cria vínculo**, e o que garante isso não é uma checagem: é a porta não ter caminho
 * de escrita em `vinculos`.
 *
 * **Sem checagem de permissão.** Sessão válida basta — quem chega aqui pode não ter vínculo nenhum, e é
 * esse justamente o caso comum.
 */
export type ComandoDePedirEntrada = {
  /** Já conferido contra `^[A-Z0-9]{6,12}$` pelo schema de entrada. */
  codigoPublico: string;
  /** O que veio do campo pré-preenchido. `null` quando o corpo não o trouxe. */
  nome: string | null;
  /** Já em E.164. `null` quando o corpo não o trouxe. */
  telefone: string | null;
};

export async function pedirEntrada(
  portas: { pedidosDeEntrada: RepositorioDePedidosDeEntrada },
  sessao: { pessoaId: string; nome: string },
  comando: ComandoDePedirEntrada,
): Promise<PedidoDeEntradaRegistrado> {
  const resultado = await portas.pedidosDeEntrada.registrar({
    pessoaId: sessao.pessoaId,
    codigoPublico: comando.codigoPublico,
    nome: correcaoDeNome(sessao.nome, comando.nome),
    telefone: comando.telefone,
  });

  switch (resultado.desfecho) {
    case "codigo-nao-encontrado":
      throw new CodigoPublicoNaoEncontrado();
    case "ja-vinculado":
      throw new JaVinculado();
    case "ja-pendente":
      throw new PedidoDeEntradaPendente();
    case "registrado":
      return resultado.pedido;
  }
}

/**
 * **O último ponto em que o nome da Pessoa é corrigível** (contrato §8.2; critério 5 do item 7a). Depois
 * daqui nenhuma tela o altera: `PATCH /vinculos/{pessoaId}` recusa Pessoa com conta.
 *
 * Devolve `null` quando não há correção a fazer. O campo chega **pré-preenchido com o nome atual**, então
 * o caso mais comum é receber de volta exatamente o que se mandou — e isso é o formulário devolvendo o
 * que recebeu, não uma pessoa pedindo para mudar o próprio nome para o mesmo nome.
 */
function correcaoDeNome(atual: string, enviado: string | null): string | null {
  if (enviado === null) return null;
  const limpo = enviado.trim();
  return limpo === "" || limpo === atual ? null : limpo;
}
