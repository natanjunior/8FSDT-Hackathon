/**
 * **O código da organização em grupos de quatro** — critério 44i.3, e a nota do canvas *"T-15 · FECHADA
 * EM 16/09"*: *"em dois grupos de quatro para ser lido do outro lado da mesa"*.
 *
 * **Os grupos contam a partir do começo.** O sorteio dá oito caracteres (`CodigoPublico.ts`), e o caso
 * real é 4 + 4. O formato aceita de 6 a 12, e para outro comprimento a regra continua: 6 vira 4 + 2, e 12
 * vira 4 + 4 + 4.
 *
 * **Unidos, os grupos devolvem o código.** O espaço entre eles é margem no componente, e não caractere:
 * selecionar à mão e copiar pelo botão dão o mesmo texto.
 */
const TAMANHO_DO_GRUPO = 4;

export function gruposDoCodigo(codigo: string): string[] {
  const grupos: string[] = [];
  for (let inicio = 0; inicio < codigo.length; inicio += TAMANHO_DO_GRUPO) {
    grupos.push(codigo.slice(inicio, inicio + TAMANHO_DO_GRUPO));
  }
  return grupos;
}
