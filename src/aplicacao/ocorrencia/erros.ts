import { AreaInvalida } from "@/aplicacao/organizacao";
import { ErroDeDominio } from "@/dominio/erros";
import {
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
  type Comando,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

/** Reexportadas, nao redefinidas — ver as notas abaixo. */
export { AreaInvalida, PrioridadeImutavelEmEstadoTerminal, TransicaoNaoPermitida };

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
 * **`TransicaoNaoPermitida` também não nasce aqui**, e por outro motivo: ela é do **Domínio**
 * (`src/dominio/ocorrencia/erros.ts`), porque é recusa da máquina de estados — não erro transversal.
 * Redefini-la aqui criaria duas classes com o mesmo `codigo` de contrato e textos divergentes, e é o
 * `codigo` que o cliente compara. Este módulo a reexporta e o `index.ts` a repassa: mesmo caminho de
 * `AreaInvalida`, na direção oposta.
 *
 * **E `PrioridadeImutavelEmEstadoTerminal` chega pelo mesmo caminho, no item 17.** Ela é a **segunda**
 * recusa da máquina de estados, e a primeira do produto que não é `TRANSICAO_NAO_PERMITIDA`: a invariante 7
 * é normatizada pela tabela companheira, que mora no Domínio. **Não é o caso de `ResponsavelNaoAtribuido`**,
 * logo abaixo, que nasceu aqui porque a invariante 9 atravessa outra tabela.
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

/**
 * `422 RESPONSAVEL_SEM_VINCULO_ATIVO` — a pessoa indicada **não tem vínculo ativo nesta organização**.
 *
 * **Três casos, uma resposta**, e é a §6.3: nunca teve vínculo · teve e foi revogado · tem vínculo em
 * **outra** organização. Separar o terceiro dos dois primeiros confirmaria que a pessoa existe em algum
 * lugar do sistema — que é exatamente o vazamento que o `404` genérico existe para impedir.
 *
 * **O texto é o do `openapi.yaml`**, literal: o `detail` é contrato publicado, não frase nova.
 */
export class ResponsavelSemVinculoAtivo extends ErroDeDominio {
  constructor() {
    super(
      "RESPONSAVEL_SEM_VINCULO_ATIVO",
      "Pessoa sem vínculo ativo",
      "Só é possível atribuir a quem tem vínculo ativo nesta organização.",
    );
  }
}

/**
 * `409 RESPONSAVEL_NAO_ATRIBUIDO` — a **invariante 9** recusando (critério 22.2).
 *
 * **Nasce aqui e não no Domínio, ao contrário de `TransicaoNaoPermitida`.** Aquela mora em
 * `dominio/ocorrencia/erros.ts` *"porque é recusa da máquina de estados"*. **Esta não é**: é a recusa da
 * invariante que a `arquitetura.md` §4 classifica como *do comando de aplicação*, *"porque atravessa
 * outra tabela no momento em que o comando roda"*. O lugar dela é ao lado de `ResponsavelSemVinculoAtivo`,
 * que nasceu aqui pela mesma razão, no item 19.
 *
 * **É a única recusa do produto que não olha `status`** — e mesmo assim carrega `statusAtual`, porque a
 * tela que monta a frase precisa dele tanto quanto no outro `409`.
 *
 * **Os textos são os do `openapi.yaml:1782-1784`, literais**: `detail` publicado é contrato, não frase
 * nova. E o `codigo` **já está mapeado para 409** em `problema.ts` — nada muda lá.
 */
export class ResponsavelNaoAtribuido extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "RESPONSAVEL_NAO_ATRIBUIDO",
      "Ninguém atribuído",
      "Atribua um responsável antes de iniciar o atendimento.",
      { statusAtual, acoesDisponiveis },
    );
  }
}
