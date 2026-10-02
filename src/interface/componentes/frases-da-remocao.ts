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
 * registro. Era frase que explicava o que o produto não fazia, e o guia a recusa.
 *
 * **O que entrou, no item 84:** a confirmação de encerrar o acesso, que é o que o produto passou a fazer.
 * Quem tem rastro não recebe mais o aviso *"não pode sair"*: recebe esta confirmação. O aviso ficou só
 * para o último Gestor, que nem remover nem encerrar alcançam.
 *
 * **O que entrou:** os títulos do aviso e da confirmação, que o `alert-dialog` pede.
 */

/** As duas razões pelas quais um vínculo não pode sair. Espelha `ImpedimentoDeRemocao` da Aplicação. */
export type ImpedimentoNaTela = "historico" | "ultimo-gestor";

/**
 * **O que o clique em *Remover da organização* abre** (item 84, spec §3.6): a confirmação de remover, a de
 * encerrar o acesso, ou o aviso do último Gestor. Um ponto de entrada só, e a face sai do que a tela já
 * sabe antes do clique.
 */
export type FaceDaRemocao = "remover" | "encerrar" | "aviso";

export function faceInicial(impedimento: ImpedimentoNaTela | null): FaceDaRemocao {
  if (impedimento === "ultimo-gestor") return "aviso";
  return impedimento === "historico" ? "encerrar" : "remover";
}

/**
 * **A troca de face no meio do caminho** (spec §3.8). A confirmação de remover só abre para quem não tinha
 * rastro; se a pessoa deixou rastro entre a tela renderizar e o Gestor clicar, o `409
 * VINCULO_COM_HISTORICO` leva à confirmação de encerrar, **sem fechar**, porque é o caminho que a recusa
 * aponta. Nenhuma outra recusa troca nada.
 */
export function faceDepoisDaRecusa(face: FaceDaRemocao, corpo: unknown): FaceDaRemocao {
  if (face !== "remover" || typeof corpo !== "object" || corpo === null) return face;
  return (corpo as { codigo?: unknown }).codigo === "VINCULO_COM_HISTORICO" ? "encerrar" : face;
}

/** O título da confirmação de encerrar o acesso. */
export function tituloDoEncerramento(nome: string): string {
  return `Encerrar o acesso de ${nome}?`;
}

/**
 * **A confirmação de encerrar o acesso, em até três linhas** (spec §3.6): o rastro que fica, com dois ramos
 * por `temConta`; quantas ocorrências continuam atribuídas, só quando há alguma; e o aviso do próprio
 * vínculo.
 *
 * **O ramo sem conta tem *"a pessoa"* como sujeito**, e não o nome: com o nome, *"cadastrada"* suporia um
 * gênero que o produto não conhece.
 *
 * **A linha do responsável existe porque essas ocorrências somem da vista do Gestor**: elas têm atribuição
 * vigente, então não entram na fila *sem responsável* (`respostas.md` P2 do item 84).
 */
export function textoDoEncerramento(dados: {
  nome: string;
  temConta: boolean;
  ehMeuProprioVinculo: boolean;
  responsavelEmAberto: number;
}): readonly string[] {
  const rastro = `${dados.nome} já deixou rastro nesta organização, então o vínculo não é apagado: as ocorrências, as mensagens e o nome na trilha continuam.`;
  const primeira = dados.temConta
    ? `${rastro} ${dados.nome} deixa de entrar na organização, e pode pedir entrada de novo.`
    : `${rastro} Sem conta, a pessoa não pede entrada: para voltar, precisa ser cadastrada de novo, com os contatos.`;

  const linhas = [primeira];
  if (dados.responsavelEmAberto > 0) linhas.push(fraseDoResponsavel(dados.nome, dados.responsavelEmAberto));
  if (dados.ehMeuProprioVinculo) {
    linhas.push("Este é o seu próprio vínculo. Ao encerrar, você perde o acesso a esta organização.");
  }
  return linhas;
}

function fraseDoResponsavel(nome: string, quantas: number): string {
  return quantas === 1
    ? `${nome} é responsável por 1 ocorrência em aberto. Ela continua atribuída a ${nome} até alguém reatribuir.`
    : `${nome} é responsável por ${String(quantas)} ocorrências em aberto. Elas continuam atribuídas a ${nome} até alguém reatribuir.`;
}

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
  return `${nome} já deixou rastro nesta organização: ocorrência, mensagem, atribuição, etiqueta, decisão de entrada ou configuração. Um vínculo com histórico não pode ser removido — o histórico não se apaga.`;
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
  encerrar: "Encerrar acesso",
  encerrando: "Encerrando…",
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
