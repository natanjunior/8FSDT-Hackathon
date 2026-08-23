/**
 * O telefone, em **E.164** — `modelo-de-dados.md` §6.17 e `contrato-de-api.md` §7.11.
 *
 * **Duas metades, e elas rodam em lugares diferentes.** `paraE164Brasileiro` é o que a tela chama antes de
 * enviar; `ehE164` é o que o schema de entrada chama ao receber. **Não são duas cópias da regra** — são
 * produzir e conferir, e o `CHECK` de `contatos` é a terceira barreira, que já existe por construção.
 *
 * **Sem biblioteca, e isso é decisão declarada.** `libphonenumber` foi recusada no modelo: seria a única
 * dependência de terceiro sem saída barata, num projeto que já recusou o componente de gráfico pelo mesmo
 * critério. O que se perde está dito: **número estrangeiro não é registrável nesta entrega.** A coluna
 * aceita — o `CHECK` é E.164 completo, não `^\+55` —, o formulário não produz, e no dia em que precisar a
 * biblioteca entra sem tocar o esquema.
 */

/** O formato que o `CHECK` de `contatos` exige. Um `+`, país sem zero à esquerda, 8 a 15 dígitos ao todo. */
const E164 = /^\+[1-9][0-9]{7,14}$/u;

/** Quantos dígitos um número brasileiro tem **sem** o código do país: fixo com 10, celular com 11. */
const DIGITOS_NACIONAIS = new Set([10, 11]);

/** Confere se um valor já está em E.164. É o que o schema de entrada pergunta. */
export function ehE164(valor: string): boolean {
  return E164.test(valor);
}

/**
 * Converte o que a pessoa digitou em E.164 brasileiro, ou devolve `null` se não der.
 *
 * A regra é a da §6.17: *"remove tudo que não é dígito, exige 10 ou 11 deles, e prefixa `+55`"*.
 *
 * **O `> 11` não é detalhe.** `55999990000` é um celular do **DDD 55** — Santa Maria —, não um número já
 * prefixado com o código do país. Só um número com **mais** de onze dígitos pode estar carregando o `55`
 * do país, porque nenhum número nacional passa de onze.
 */
export function paraE164Brasileiro(digitado: string): string | null {
  const digitos = digitado.replace(/\D/gu, "");

  const nacional =
    digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;

  if (!DIGITOS_NACIONAIS.has(nacional.length)) return null;

  const valor = `+55${nacional}`;
  return ehE164(valor) ? valor : null;
}
