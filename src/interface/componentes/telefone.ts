import { paraE164Brasileiro } from "@/dominio/pessoa";
import { MENSAGEM_DE_TELEFONE } from "@/interface/schemas";

/**
 * O telefone digitado, virando E.164, e o gravado, virando texto de gente — a mesma regra em T-02 (item
 * 7a) e em T-08 (itens 9b e 44j).
 *
 * **Não é componente, e a razão é honesta:** o campo do 7a é **não-controlado** (`defaultValue` lido por
 * `FormData`) e o do 9b é **controlado** (o valor mora no array de contatos). Um componente que servisse
 * aos dois teria dois modos. O que os dois de fato compartilham é esta função e as duas constantes.
 *
 * **A conversão acontece no cliente, antes de enviar** (§2.5-e da spec do 9b): quem digitou nove dígitos
 * merece a frase, não um `400` genérico do servidor. O schema confere de novo do outro lado — o `400` do
 * critério 3 existe de verdade, para quem chama a API sem passar pela tela.
 */

/** O campo nasce com isto dentro. O país não é escolha nesta entrega — ver o achado A-9b-3 da spec. */
export const PREFIXO_BR = "+55 ";

export type TelefoneConvertido =
  | { situacao: "vazio" }
  | { situacao: "convertido"; valor: string }
  | { situacao: "recusado"; mensagem: string };

/**
 * **O caso `"+55"` é vazio, não erro.** O campo nasce com o prefixo; quem não quis informar telefone
 * deixa-o como está, e tratar isso como número malformado transformaria um campo opcional numa recusa.
 */
export function converterTelefoneDigitado(digitado: string): TelefoneConvertido {
  const aparado = digitado.trim();
  if (aparado === "" || aparado === PREFIXO_BR.trim()) return { situacao: "vazio" };

  const convertido = paraE164Brasileiro(aparado);
  if (convertido === null) return { situacao: "recusado", mensagem: MENSAGEM_DE_TELEFONE };

  return { situacao: "convertido", valor: convertido };
}

const BRASILEIRO = /^\+55(\d{2})(\d{4,5})(\d{4})$/u;

/**
 * **`(11) 98877-6655`**, como a tabela de T-08, o modal de responder e a leitura de quem tem conta
 * escrevem (item 44j). O número de fora sai como veio, em vez de sair mutilado.
 */
export function telefoneLegivel(e164: string): string {
  const partes = BRASILEIRO.exec(e164);
  return partes === null ? e164 : `(${partes[1] ?? ""}) ${partes[2] ?? ""}-${partes[3] ?? ""}`;
}

/**
 * O telefone gravado, como o campo o mostra ao editar: **`+55 (11) 98123-4567`**. A conversão de volta é
 * `converterTelefoneDigitado`, que aceita a forma. O número de fora entra no campo como veio.
 */
export function telefoneNoCampo(e164: string): string {
  return BRASILEIRO.test(e164) ? `${PREFIXO_BR}${telefoneLegivel(e164)}` : e164;
}
