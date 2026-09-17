import { mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  As frases da remoção de vínculo — item 10, e a forma do item 44j
 * ============================================================================
 *
 * **A única importação é a do retorno de ação**, e ela chegou com o item 44j: a recusa do servidor passa
 * pela mesma escolha de mensagem do resto do produto (a frase da tela ganha do `detail`, e o `detail`
 * ganha da genérica). O arquivo continua sem conhecer React, `next` e o Domínio.
 *
 * **Três das cinco frases são literais de entregável**, e as duas restantes foram decididas em
 * 30/08/2026 ao responder as perguntas da spec do item 10.
 *
 * **O que estas frases NÃO são:** o corpo `problem+json`. Aquele é do `openapi.yaml` e mora em
 * `aplicacao/organizacao/erros.ts`.
 *
 * **O que saiu, no item 44j (critério 5):** o complemento sobre encerrar o acesso preservando o
 * registro. Era frase que explicava o que o produto não faz, e o guia a recusa; o caminho correto —
 * revogar — continua ⬜, sem nenhum escritor de `vinculos.revogado_em`.
 *
 * **O que entrou:** os títulos do aviso e da confirmação, que o `alert-dialog` pede.
 */

/** As duas razões pelas quais um vínculo não pode sair. Espelha `ImpedimentoDeRemocao` da Aplicação. */
export type ImpedimentoNaTela = "historico" | "ultimo-gestor";

/** O título do aviso que o clique em *Remover da organização* abre quando o vínculo não pode sair. */
export function tituloDoImpedimento(nome: string): string {
  return `${nome} não pode sair da organização`;
}

/** O título da confirmação, quando o vínculo pode sair. */
export function tituloDaConfirmacao(nome: string): string {
  return `Remover ${nome} da organização?`;
}

/**
 * **A razão, no corpo do aviso** (critério 10.4, e a forma do critério 44j.4).
 *
 * A do histórico deixou de enumerar três rastros e passou a dizer *"já deixou rastro"*, com cinco
 * exemplos que cobrem os **nove** destinos do esquema. A palavra vem do glossário — verbete **Remover
 * vínculo**: *"Apagar um vínculo que não deixou rastro"* —, e não de invenção: *"registro"* estava fora
 * de questão, porque **Registro de transição** é termo definido e significa outra coisa, e *"histórico"*
 * sozinho não é termo do projeto.
 *
 * **É função e não constante porque o critério 10.4 emendado começa a frase pelo nome.** A do último
 * Gestor **não** leva nome: é verbatim do inventário, e a frase fala da organização, não da pessoa.
 */
export function razaoDoImpedimento(nome: string, impedimento: ImpedimentoNaTela): string {
  if (impedimento === "ultimo-gestor") {
    return "Esta é a única pessoa com poder de gestão nesta organização. Removê-la deixaria a organização sem ninguém que possa aprovar entradas.";
  }
  return `${nome} já deixou rastro nesta organização: ocorrência, mensagem, atribuição, decisão de entrada ou configuração. Um vínculo com histórico não pode ser removido — o histórico não se apaga.`;
}

/**
 * A confirmação, **em dois ramos condicionados a `temConta`** — o achado **A-2** da spec.
 *
 * O ramo `true` é verbatim de `inventario-de-telas.md:1193`. O ramo `false` foi escrito em 30/08/2026, e
 * existe porque a frase verbatim é **falsa** para quem não tem conta: pedir entrada exige sessão, e a
 * Pessoa criada por `POST /vinculos` nasce sem conta e **nunca passa a ter** — o único escritor de
 * `usuario_id` cria linha nova por usuário e não adota Pessoa nenhuma. `temConta: false` é estado final.
 *
 * **A menção aos contatos não é enfeite:** o cadastro que fica não é o cadastro que volta. Re-cadastrar
 * cria **outra** linha em `pessoas`, e `contatos` não tem listagem por Pessoa — o Gestor redigita. É o
 * único custo real do clique, e confirmação existe para dizer o custo do clique.
 *
 * **A segunda linha é adição `NOSSO`, declarada** (spec §3.8), e só aparece no próprio vínculo. Não colide
 * com o ramo `false`: quem remove o próprio vínculo está autenticado, então `temConta` é sempre `true`
 * para si mesmo.
 */
export function textoDaConfirmacao(dados: {
  nome: string;
  temConta: boolean;
  ehMeuProprioVinculo: boolean;
}): readonly string[] {
  const primeira = dados.temConta
    ? `Remover o vínculo de ${dados.nome}. O cadastro da pessoa não é apagado, e ela pode pedir entrada de novo.`
    : `Remover o vínculo de ${dados.nome}. O cadastro da pessoa não é apagado, mas ela não tem conta e não pode pedir entrada: para voltar, precisa ser cadastrada de novo, com os contatos.`;

  return dados.ehMeuProprioVinculo
    ? [primeira, "Este é o seu próprio vínculo. Ao remover, você perde o acesso a esta organização."]
    : [primeira];
}

/** Os textos dos dois `alert-dialog` da remoção. */
export const TEXTOS_DA_REMOCAO = {
  cancelar: "Cancelar",
  remover: "Remover",
  removendo: "Removendo…",
  entendi: "Entendi",
} as const;

/**
 * A mensagem que a confirmação mostra quando o `DELETE` recusa.
 *
 * **O desenho diz que o erro não acontece; a concorrência diz que acontece.** Entre a página renderizar
 * e o Gestor clicar, a pessoa pode registrar uma ocorrência, ou o outro Gestor pode sair.
 *
 * **Os dois `409` reusam a MESMA frase da razão**, e não uma variante: é o mesmo fato. Código que a tela
 * não conhece mostra o texto do servidor, e o resto cai na frase genérica do produto — a escolha é a de
 * `mensagemDoProblema`, desde o item 44j.
 */
export function textoDaRecusa(corpo: unknown, nome: string): string {
  return mensagemDoProblema(corpo, {
    VINCULO_COM_HISTORICO: razaoDoImpedimento(nome, "historico"),
    ULTIMO_GESTOR: razaoDoImpedimento(nome, "ultimo-gestor"),
    VINCULO_NAO_ENCONTRADO: "Este vínculo não existe mais.",
  });
}
