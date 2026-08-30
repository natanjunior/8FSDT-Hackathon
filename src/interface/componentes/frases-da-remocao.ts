/**
 * ============================================================================
 *  As frases da remoção de vínculo — a metade conferível do item 10
 * ============================================================================
 *
 * **Nenhum `import`, e é de propósito** — o mesmo desenho de `busca-de-candidatos.ts`. O arquivo não
 * conhece React, não conhece `next` e não conhece o Domínio, e é isso que permite testá-lo com
 * `environment: "node"`, que é o único ambiente que a suíte tem.
 *
 * **Três das cinco frases são literais de entregável**, e as duas restantes foram decididas em 30/08/2026
 * ao responder as perguntas da spec (`respostas.md`, achados **A-1** e **A-2**). A fonte do texto é a §3.6
 * da spec — **não** a §2 dela, que transcreveu o critério 10.4 antes da emenda.
 *
 * **O que estas frases NÃO são:** o corpo `problem+json`. Aquele é do `openapi.yaml`, mora em
 * `aplicacao/organizacao/erros.ts`, e a tela nunca o mostra — nos dois `409` a razão substitui o botão.
 */

/** As duas razões pelas quais um vínculo não pode sair. Espelha `ImpedimentoDeRemocao` da Aplicação. */
export type ImpedimentoNaTela = "historico" | "ultimo-gestor";

/**
 * **A razão que substitui o botão** (critério 10.4, `prototipo-low-fi.md:919`).
 *
 * A do histórico deixou de enumerar três rastros e passou a dizer *"já deixou rastro"*, com cinco
 * exemplos que cobrem os **nove** destinos do esquema. A palavra vem do glossário — verbete **Remover
 * vínculo** (`glossario.md:37`): *"Apagar um vínculo que **não deixou rastro**"* —, e não de invenção:
 * *"registro"* estava fora de questão, porque **Registro de transição** é termo definido e significa
 * outra coisa, e *"histórico"* sozinho **não é termo do projeto** (`glossario.md:182`).
 *
 * **É função e não constante porque o critério 10.4 emendado começa a frase pelo nome** —
 * *"{nome} já deixou rastro nesta organização…"* (`backlog.md:621`), e a §3.6 da spec escreve o mesmo.
 * A do último Gestor **não** leva nome: é **verbatim** de `inventario-de-telas.md:1502`, e a frase fala
 * da organização, não da pessoa.
 */
export function razaoDoImpedimento(
  nome: string,
  impedimento: ImpedimentoNaTela,
): { titulo: string; complemento: string | null } {
  if (impedimento === "ultimo-gestor") {
    return {
      titulo:
        "Esta é a única pessoa com poder de gestão nesta organização. Removê-la deixaria a organização sem ninguém que possa aprovar entradas.",
      complemento: null,
    };
  }

  return {
    titulo: `${nome} já deixou rastro nesta organização: ocorrência, mensagem, atribuição, decisão de entrada ou configuração. Um vínculo com histórico não pode ser removido — o histórico não se apaga.`,
    // O caminho correto é **revogar**, que é ⬜ e continua sem nenhum escritor de `vinculos.revogado_em`.
    complemento: "Encerrar o acesso preservando o registro é uma função que ainda não existe.",
  };
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

/** A frase genérica, para quando a rede cai antes de haver resposta ou o código não é conhecido. */
const RECUSA_GENERICA = "Não foi possível remover agora. Tente de novo.";

/**
 * A linha de recusa da spec §3.10.
 *
 * **O desenho diz que o erro não acontece; a concorrência diz que acontece.** Entre a página renderizar e
 * o Gestor clicar, a pessoa pode registrar uma ocorrência, ou o outro Gestor pode sair. Isto **não
 * contradiz o critério 10.4**: o botão continua não aparecendo quando a tela sabe que o vínculo não pode
 * sair — o que esta função cobre é o instante entre saber e clicar.
 *
 * **Os dois `409` reusam a MESMA frase da razão**, e não uma variante: é o mesmo fato, e duas frases para
 * o mesmo fato são duas coisas para manter.
 */
export function textoDaRecusa(codigo: string | undefined, nome: string): string {
  if (codigo === "VINCULO_COM_HISTORICO") return razaoDoImpedimento(nome, "historico").titulo;
  if (codigo === "ULTIMO_GESTOR") return razaoDoImpedimento(nome, "ultimo-gestor").titulo;
  if (codigo === "VINCULO_NAO_ENCONTRADO") return "Este vínculo não existe mais.";
  return RECUSA_GENERICA;
}
