import { dataCurta, dataEHora } from "@/interface/componentes/datas";
import type { AvisoDeConclusao, FrasesDaTela } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  As frases de T-08 · Participantes — item 44j
 * ============================================================================
 *
 * **Uma frase, um lugar.** O papel com a consequência estava escrito duas vezes (no bloco de aprovação e
 * no formulário de vínculo); os textos das duas faces do modal de responder, os avisos, as mensagens de
 * campo e as frases dos códigos de erro moram aqui, com teste em `testes/interface/vinculo.test.ts`. As
 * frases da remoção continuam em `frases-da-remocao.ts`.
 *
 * **Nenhum texto supõe gênero** (A-03 da spec): o produto não sabe o de ninguém, e onde a prancheta
 * escreve *"Ele"* a tela escreve o primeiro nome.
 *
 * **As datas moram em `datas.ts` desde 21/09/2026** (item 44p, critério 17), e este arquivo as reexporta
 * para os chamadores que já apontavam para cá. Elas levam o fuso escrito, montadas por partes nomeadas —
 * a tabela renderiza no servidor, que roda em UTC, e hidrata no navegador.
 *
 * **A importação de tipo é em instrução inteira:** `retorno-de-acao.ts` traz o pacote de avisos.
 */

export { dataCurta, dataEHora };

export type Papel = "solicitante" | "gestor" | "encarregado";

export type OpcaoDePapel = {
  readonly papel: Papel;
  readonly rotulo: string;
  readonly consequencia: string;
  /** A frase que teria evitado o PA-25, em destaque no produto (inventário, restrição herdada nº 3). */
  readonly alerta: string | null;
};

export const PAPEIS: readonly OpcaoDePapel[] = [
  {
    papel: "solicitante",
    rotulo: "Solicitante",
    consequencia: "Registra e acompanha as próprias ocorrências.",
    alerta: null,
  },
  {
    papel: "gestor",
    rotulo: "Gestor",
    consequencia:
      "Analisa, atribui, resolve e cancela qualquer ocorrência. Configura a organização e aprova quem entra.",
    alerta: null,
  },
  {
    papel: "encarregado",
    rotulo: "Encarregado",
    consequencia: "Aparece como responsável pela ocorrência.",
    alerta: "Não consegue fazer nada dentro do sistema.",
  },
];

export function papelDoValor(valor: string): Papel | null {
  return PAPEIS.find((opcao) => opcao.papel === valor)?.papel ?? null;
}

/** O papel em palavra. Um valor que o produto não conhece sai como veio. */
export function rotuloDoPapel(papel: string): string {
  return PAPEIS.find((opcao) => opcao.papel === papel)?.rotulo ?? papel;
}

/** O que a coluna Papel diz na linha de um pedido. */
export const ROTULO_SEM_PAPEL = "a decidir";

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/u)[0] ?? "";
}

// ---------------------------------------------------------------------------
// O cabeçalho
// ---------------------------------------------------------------------------

export function palavraDeParticipantes(quantos: number): string {
  return quantos === 1 ? "participante" : "participantes";
}

export function palavraDePedidos(quantos: number): string {
  return quantos === 1 ? "pedido de entrada aguardando decisão" : "pedidos de entrada aguardando decisão";
}

export const SEM_PEDIDOS = "Nenhum pedido de entrada aguardando.";

/** O fato do cabeçalho, inteiro. A página desenha as mesmas palavras com os números em mono. */
export function fraseDoFato(participantes: number, pedidos: number): string {
  const inicio = `${String(participantes)} ${palavraDeParticipantes(participantes)}`;
  return pedidos === 0
    ? `${inicio}. ${SEM_PEDIDOS}`
    : `${inicio} e ${String(pedidos)} ${palavraDePedidos(pedidos)}.`;
}

/** O fato da página de editar. A página desenha a data em mono. */
export function fraseDoFatoDeEdicao(nome: string, papel: string, criadoEm: string): string {
  return `${nome}, ${rotuloDoPapel(papel)} desde ${dataCurta(criadoEm)}.`;
}

// ---------------------------------------------------------------------------
// A tabela
// ---------------------------------------------------------------------------

export const TEXTOS_DA_TABELA = {
  filtrar: "Filtrar participantes",
  buscar: "Buscar pelo nome",
  exemploDaBusca: "Ex.: Beatriz",
  editar: "Editar participante",
  remover: "Remover da organização",
  desde: "Desde",
  acoes: "Ações",
  seloDePedido: "pedido de entrada",
  seloSemConta: "sem conta",
  seloVoce: "você",
} as const;

/** O nome do botão de contato na tabela: o tipo, no plural quando há mais de um, e de quem é (item 68a). */
export function rotuloDoContato(tipo: "telefone" | "email", quantos: number, nome: string): string {
  const palavra = tipo === "telefone" ? "Telefone" : "E-mail";
  return `${palavra}${quantos > 1 ? "s" : ""} de ${nome}`;
}

// ---------------------------------------------------------------------------
// Responder um pedido: as duas faces do modal
// ---------------------------------------------------------------------------

export const TEXTOS_DA_RESPOSTA = {
  gatilho: "Responder",
  titulo: "Responder pedido de entrada",
  legenda: "Entra como",
  unidade: "Unidade",
  semUnidade: "Sem unidade",
  ajudaDaUnidade: "Para quem mora ou trabalha numa unidade.",
  semTelefone: "Sem telefone informado no pedido.",
  aprovando: "Aprovando…",
  recusar: "Recusar pedido",
  recusando: "Recusando…",
  voltar: "Voltar",
  motivo: "Motivo",
  ajudaDoMotivo: "Opcional. Fica registrado para os Gestores; quem pediu não vê.",
} as const;

/** O teto do motivo: o `max(500)` de `recusaDePedidoSchema`. */
export const TETO_DO_MOTIVO = 500;

export function descricaoDoPedido(criadoEm: string): string {
  return `Pedido feito em ${dataEHora(criadoEm)}.`;
}

/** **O botão diz o papel** (critério 6): é o trabalho que a confirmação separada fazia. */
export function rotuloDeAprovar(papel: Papel | null): string {
  return papel === null ? "Aprovar" : `Aprovar como ${rotuloDoPapel(papel)}`;
}

export function erroDoPapelNaResposta(nome: string): string {
  return `Escolha o papel com que ${primeiroNome(nome)} entra.`;
}

export function avisoDoEncarregado(nome: string): { readonly destaque: string; readonly resto: string } {
  return {
    destaque: `${primeiroNome(nome)} não vai conseguir fazer nada dentro do sistema.`,
    resto:
      "Aparece como responsável e recebe o trabalho fora do aplicativo. O papel não muda depois: para corrigir, é preciso remover o vínculo e pedir entrada de novo.",
  };
}

export function tituloDaRecusa(nome: string): string {
  return `Recusar o pedido de ${nome}?`;
}

export function descricaoDaRecusa(nome: string): string {
  return `${primeiroNome(nome)} pode pedir entrada de novo quando quiser.`;
}

/** As frases que T-08 escreve para os códigos do pedido (inventário, §7). */
export const FRASES_DO_PEDIDO: FrasesDaTela = {
  PEDIDO_JA_DECIDIDO: "Este pedido já foi decidido por outro Gestor.",
  JA_VINCULADO: "Esta pessoa já tem vínculo nesta organização.",
  AREA_INVALIDA: "Esta área não existe nesta organização ou está desativada.",
  PEDIDO_NAO_ENCONTRADO: "Este pedido não existe mais.",
};

// ---------------------------------------------------------------------------
// Cadastrar e editar
// ---------------------------------------------------------------------------

export const TEXTOS_DO_FORMULARIO = {
  cartaoPessoa: "Pessoa",
  cartaoContatos: "Contatos",
  nome: "Nome",
  ajudaDoNome: "A unidade tem campo próprio; não a escreva aqui.",
  papel: "Papel",
  erroDoPapel: "Escolha o papel desta pessoa.",
  semMudanca: "Altere algum dado antes de salvar.",
  cancelar: "Cancelar",
  cadastrar: "Cadastrar",
  cadastrando: "Cadastrando…",
  salvar: "Salvar",
  salvando: "Salvando…",
  apoioComAlca: "O contato 1 é para onde se liga primeiro. Arraste ou use as setas para mudar a preferência.",
  apoioSemAlca: "O contato 1 é para onde se liga primeiro. Use as setas para mudar a preferência.",
  adicionar: "Adicionar contato",
  semContatos: "Nenhum contato cadastrado.",
} as const;

/** As frases que T-08 escreve para os códigos de `POST` e `PATCH /vinculos` (inventário, §7). */
export const FRASES_DO_FORMULARIO: FrasesDaTela = {
  AREA_INVALIDA: "Esta área não existe nesta organização ou está desativada.",
  PESSOA_COM_CONTA_NAO_EDITAVEL:
    "Esta pessoa tem conta no Resolve Aí e edita os próprios dados. O cadastro de quem tem conta vale em todas as organizações dela.",
  VINCULO_NAO_ENCONTRADO: "Este vínculo não existe mais nesta organização.",
  CAMPO_NAO_SUPORTADO: "Um dos campos enviados não é aceito por esta operação.",
  FORMATO_INVALIDO: "Confira os campos indicados.",
  CONTATO_DUPLICADO: "Este contato já está na lista. Confira os contatos marcados.",
};

// ---------------------------------------------------------------------------
// O retorno de ação (critério 10)
// ---------------------------------------------------------------------------

/** **O título da falha diz o que foi tentado**; a razão fica no modal ou no formulário (44g). */
export const FALHA = {
  aprovar: "Não foi possível aprovar o pedido",
  recusar: "Não foi possível recusar o pedido",
  remover: "Não foi possível remover o vínculo",
  cadastrar: "Não foi possível cadastrar a pessoa",
  salvar: "Não foi possível salvar os dados",
} as const;

export function avisoDeAprovado(nome: string, papel: string, unidade: string | null): AvisoDeConclusao {
  return {
    titulo: `${nome} entrou como ${rotuloDoPapel(papel)}`,
    descricao: unidade === null ? "Sem unidade registrada." : `Na unidade ${unidade}.`,
  };
}

export function avisoDeRecusado(nome: string): AvisoDeConclusao {
  return { titulo: `Pedido de ${nome} recusado`, descricao: "Pode pedir entrada de novo quando quiser." };
}

export function avisoDeRemovido(nome: string): AvisoDeConclusao {
  return { titulo: `Vínculo de ${nome} removido`, descricao: "O cadastro da pessoa não é apagado." };
}

export function avisoDeCadastrado(nome: string, papel: string): AvisoDeConclusao {
  return {
    titulo: `${nome} entrou como ${rotuloDoPapel(papel)}`,
    descricao: "Sem conta: recebe atribuições e aparece como responsável.",
  };
}

export function avisoDeSalvo(nome: string): AvisoDeConclusao {
  return { titulo: `Dados de ${nome} salvos` };
}
