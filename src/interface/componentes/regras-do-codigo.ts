/**
 * ============================================================================
 *  As regras do código da organização na tela — item 65
 * ============================================================================
 *
 * **Oito casas, e o alfabeto do sorteio.** O banco aceita de 6 a 12 caracteres, e nada gerado sai fora de
 * 8 (`CodigoPublico.ts:33`). A tela confere o que o sorteio produz, e o servidor continua conferindo o que o
 * contrato declara. É a primeira vez que a tela é mais estrita que a API, e é de propósito: o que ela
 * recusa, nenhum código gerado teria (achado A4 da spec).
 *
 * **O alfabeto é repetido aqui, e um teste o prende ao do Domínio.** O de lá mora num arquivo que importa
 * `node:crypto`, e o campo é componente de cliente.
 *
 * Puro, sem React: é o que tem teste de unidade. O componente só monta as casas em cima destas funções.
 */

import { gruposDoCodigo } from "@/interface/componentes/grupos-do-codigo";

export const ALFABETO_DA_TELA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CASAS_DO_CODIGO = 8;

/**
 * **O que a digitação aceita, conferido pelo `input-otp` no valor inteiro a cada tecla.** Minúscula entra,
 * porque o componente a converte no `onChange`; sem ela no padrão, a tecla seria recusada antes de virar
 * maiúscula. `I`, `O`, `0` e `1` não entram, em nenhuma caixa.
 */
export const PADRAO_DA_DIGITACAO = "^[A-HJ-NP-Za-hj-np-z2-9]*$";

export const FRASE_DO_CODIGO_INCOMPLETO = "O código tem 8 letras e números.";

/** Maiúscula, só o alfabeto, no máximo oito. Serve à colagem, que chega com espaço, hífen e minúscula. */
export function limparCodigo(texto: string): string {
  return [...texto.toUpperCase()]
    .filter((caractere) => ALFABETO_DA_TELA.includes(caractere))
    .join("")
    .slice(0, CASAS_DO_CODIGO);
}

/** A conferência antes do envio: oito caracteres do alfabeto, ou a frase. */
export function erroDoCodigo(codigo: string): string | undefined {
  return codigo.length === CASAS_DO_CODIGO && limparCodigo(codigo) === codigo
    ? undefined
    : FRASE_DO_CODIGO_INCOMPLETO;
}

/**
 * Os índices das casas, **pela divisão de `gruposDoCodigo`**, e não por uma cópia dela: para 8 são dois
 * grupos; para 6, um de quatro e um de dois. A entrada ainda não tem código, então a divisão é feita sobre
 * um texto do comprimento pedido, e só o tamanho de cada grupo importa.
 */
export function casasDosGrupos(comprimento: number): number[][] {
  let inicio = 0;
  return gruposDoCodigo("#".repeat(comprimento)).map((grupo) => {
    const casas = Array.from({ length: grupo.length }, (_, i) => inicio + i);
    inicio += grupo.length;
    return casas;
  });
}
