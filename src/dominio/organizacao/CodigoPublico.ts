import { randomInt } from "node:crypto";

/**
 * O **Código da Organização** — o do cartaz do elevador (D25).
 *
 * Ele mora no Domínio porque é regra de formação, não detalhe de armazenamento: o contrato §8.1 diz que
 * *"é gerado pelo servidor e não é aceito no corpo"*, e a razão é dita — deixar o cliente escolher abriria
 * disputa por códigos bonitos e **permitiria adivinhação dirigida**. É por isso que ele é sorteado, e não
 * derivado do nome da organização.
 *
 * `node:crypto` não é SDK: é biblioteca padrão da plataforma, do mesmo tipo que `Math` ou `Date`. A regra
 * de fronteira nomeia banco, storage e autenticação (ADR-0006, regra 1) — e um sorteio previsível aqui
 * **é** o buraco que a §8.1 quer fechar.
 */

/**
 * Trinta e dois símbolos, **sem `I`, `O`, `0` e `1`**.
 *
 * O `CHECK (codigo_publico ~ '^[A-Z0-9]{6,12}$')` do banco aceita os quatro — ele confere maiúscula, não
 * ambiguidade. A §6.3 do modelo dá as duas razões juntas (*"sem minúscula e sem caractere ambíguo"*), e a
 * segunda metade só existe se este alfabeto a garantir: quem lê `RECANT0` do cartaz e digita `RECANTO`
 * recebe `404 CODIGO_PUBLICO_NAO_ENCONTRADO`, cuja frase de tela não tem como dizer que foi confusão de
 * caractere.
 */
export const ALFABETO_DO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Oito, e não os seis do mínimo do contrato.
 *
 * Oito posições em 32 símbolos dão ~1,1 × 10¹² códigos — varredura inviável — ao custo de dois toques a
 * mais no elevador. Continua dentro do `varchar(12)` e do `{6,12}` do formato.
 */
export const COMPRIMENTO_DO_CODIGO = 8;

/** O formato do contrato §8.1 e do `CHECK` da §6.3, num lugar só. */
export const FORMATO_DO_CODIGO = /^[A-Z0-9]{6,12}$/u;

/**
 * Sorteia um código. **A unicidade não é garantida aqui** — quem a garante é o
 * `UNIQUE (codigo_publico)` do banco, e quem repete o sorteio na colisão é a camada de Aplicação. Uma
 * checagem prévia perderia a corrida entre duas criações simultâneas.
 */
export function gerarCodigoPublico(): string {
  let codigo = "";
  for (let i = 0; i < COMPRIMENTO_DO_CODIGO; i += 1) {
    codigo += ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)];
  }
  return codigo;
}
