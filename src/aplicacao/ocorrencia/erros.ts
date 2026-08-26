import { AreaInvalida } from "@/aplicacao/organizacao";
import { ErroDeDominio } from "@/dominio/erros";

/** Reexportada, nao redefinida — ver a nota abaixo. */
export { AreaInvalida };

/**
 * `422 CATEGORIA_INVALIDA` — inexistente **nesta** organização **ou** desativada.
 *
 * **A mesma resposta para os dois casos**, e é a §6.3 do contrato: confirmar que a categoria existe mas
 * está em outra organização é exatamente o vazamento que o `404` genérico existe para impedir.
 */
export class CategoriaInvalida extends ErroDeDominio {
  constructor() {
    super(
      "CATEGORIA_INVALIDA",
      "Categoria inválida",
      "Esta categoria não existe nesta organização ou não está mais ativa.",
    );
  }
}

/**
 * **`AreaInvalida` NAO nasce aqui — ela ja existe**, em `src/aplicacao/organizacao/erros.ts`, com o mesmo
 * codigo `AREA_INVALIDA` e o mesmo argumento (*"a mesma resposta para os dois casos"*, contrato §6.3).
 * Foi escrita pelo item 9a, para o `areaId` do cadastro de vinculo.
 *
 * **Reescreve-la aqui criaria duas classes com o mesmo codigo de contrato e textos divergentes** — e e o
 * `codigo` que o cliente compara. Este modulo a **reexporta** (a linha do topo deste arquivo), e o
 * `index.ts` a repassa.
 *
 * O lint permite: `@/aplicacao/organizacao` e superficie publica de modulo irmao da mesma camada, e nao
 * cria ciclo — `aplicacao/organizacao` nao importa `aplicacao/ocorrencia`.
 */

/**
 * `404 OCORRENCIA_NAO_ENCONTRADA` — **não existe nesta organização OU não é visível a quem pediu**.
 *
 * As duas causas dão a mesma resposta, de propósito (§6.3): *"não confirmar a existência do que você não
 * pode alcançar"*. É a mesma escolha que T-05 faz ao não mostrar ação indisponível.
 */
export class OcorrenciaNaoEncontrada extends ErroDeDominio {
  constructor() {
    super(
      "OCORRENCIA_NAO_ENCONTRADA",
      "Ocorrência não encontrada",
      "Não há ocorrência com este identificador nesta organização.",
    );
  }
}
