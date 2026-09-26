/**
 * ============================================================================
 *  O plano da demonstração — PURO, e é o que torna o item conferível sem banco
 * ============================================================================
 *
 * Este arquivo devolve **o mundo inteiro como dado**: quem existe, onde, e uma lista de ocorrências com
 * data de registro, roteiro de transições e desfecho. Ele não conhece porta, não conhece banco e não lê
 * relógio — quem lhe dá o `hoje` é a linha de comando.
 *
 * **Ele importa `type`, e só `type`** (decisão D-1 do plano). A §3.2 da spec previa "nada"; um
 * `"aguardando_peça"` com cedilha no roteiro, porém, só falharia contra o banco, no meio de uma
 * semeadura. Com os tipos do Domínio o compilador cobra os motivos, os papéis e os tipos de área — e
 * `import type` é apagado na compilação, então o arquivo continua puro e continua rodando no laço curto.
 */

import type {
  MotivoCancelamento,
  MotivoPausa,
  Prioridade,
  StatusOcorrencia,
} from "@/dominio/ocorrencia";
import type { Papel, TipoArea } from "@/dominio/organizacao";

export const UM_MINUTO = 60 * 1000;
export const UM_DIA = 24 * 60 * UM_MINUTO;

/**
 * Um mês da série.
 *
 * **`ultimoDia` é o último dia que o balde pode carimbar** — o fim do mês, exceto no mês corrente, onde é
 * **ontem**: a semente nunca escreve no futuro, e "hoje de manhã" seria futuro para metade das
 * transições que ela grava.
 */
export type Balde = {
  /** `0` é o mês corrente; `4` é quatro meses atrás. */
  readonly distancia: number;
  /** `2026-04` — o rótulo da série mensal, e a chave do resumo impresso. */
  readonly rotulo: string;
  /** Dia 1 do mês, 00:00 UTC. */
  readonly inicio: Date;
  /** O último dia utilizável, 00:00 UTC. */
  readonly ultimoDia: Date;
  /** Quantos dias o balde tem, contando o primeiro e o último. Nunca menor que 1. */
  readonly dias: number;
};

/**
 * Os cinco baldes mensais: `M-4` a `M-0`.
 *
 * **Cinco e não três**, embora o critério 43.1 peça "pelo menos três": com três, o mês sem resolução do
 * critério 43.2 seria um terço da série e leria como defeito. Com cinco, ele lê como o que é.
 *
 * **Tudo em UTC** (decisão D-2). Fuso do sistema não pode decidir em qual mês uma ocorrência cai — o mesmo
 * plano rodado em duas máquinas produziria séries diferentes.
 */
export function baldesDaDemonstracao(hoje: Date): readonly Balde[] {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const diaDeHoje = hoje.getUTCDate();

  const baldes: Balde[] = [];

  for (let distancia = 4; distancia >= 0; distancia -= 1) {
    const inicio = new Date(Date.UTC(ano, mes - distancia, 1));
    // `Date.UTC(ano, m + 1, 0)` é o último dia do mês `m`. No mês corrente o teto é ONTEM.
    const ultimoDia =
      distancia === 0
        ? new Date(Date.UTC(ano, mes, diaDeHoje - 1))
        : new Date(Date.UTC(ano, mes - distancia + 1, 0));

    const dias = Math.round((ultimoDia.getTime() - inicio.getTime()) / UM_DIA) + 1;

    // **A semente rodada no dia 1**: o mês corrente não tem um único dia no passado, e o balde não nasce.
    // Sobram quatro — ainda acima do mínimo de três do critério 43.1. Não é erro, e o teste o prova.
    if (dias < 1) continue;

    baldes.push({ distancia, rotulo: rotuloDoMes(inicio), inicio, ultimoDia, dias });
  }

  return baldes;
}

function rotuloDoMes(inicio: Date): string {
  const mes = String(inicio.getUTCMonth() + 1).padStart(2, "0");
  return `${String(inicio.getUTCFullYear())}-${mes}`;
}

// ---------------------------------------------------------------------------
// O sorteio — determinístico, e de dez linhas
// ---------------------------------------------------------------------------

/**
 * A constante do arquivo. Duas execuções no mesmo dia produzem **o mesmo mundo**; a única variável é o
 * `hoje`. Sem isso, *"a semente está certa?"* não tem resposta reproduzível — e um gerador congruente
 * linear de dez linhas custa menos que uma dependência.
 */
export const SEMENTE_DO_SORTEIO = 20_260_929;

/** Congruente linear, os parâmetros de *Numerical Recipes*. Devolve `[0, 1)`. */
function sorteio(inicial: number): () => number {
  let estado = inicial >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}

// ---------------------------------------------------------------------------
// Os instantes de um roteiro
// ---------------------------------------------------------------------------

/** 11:00 UTC — 08:00 em UTC−3, que é o fuso de quem vai olhar a demonstração (decisão D-2). */
const JANELA_INICIO = 11 * 60;
/** Dez horas: até 20:59 UTC, ou 17:59 em UTC−3. */
const JANELA_MINUTOS = 10 * 60;
/** O empurrão que garante ordem estrita quando dois passos caem no mesmo minuto. */
const EMPURRAO = 37;
/** 23:59 do último dia do balde. Teto absoluto: nenhum instante sai do mês. */
const FIM_DO_DIA = 23 * 60 + 59;

/**
 * `quantos` instantes **estritamente crescentes** dentro do balde, em horário comercial de UTC−3.
 *
 * **O que ele garante, e é o que o teste cobra:** todos caem dentro do balde; nenhum é igual ao anterior;
 * o primeiro é o `registradaEm` e os demais são as transições. A ordem estrita não é enfeite — dois
 * registros de transição com o mesmo `ocorreu_em` fazem a linha do tempo de T-06 depender do desempate
 * por `sequencia`, e a demonstração ficaria mostrando a exceção em vez da regra.
 */
function instantesDoRoteiro(balde: Balde, quantos: number, proximo: () => number): readonly string[] {
  const ultimoMinuto = (balde.dias - 1) * 24 * 60 + FIM_DO_DIA;
  // Um passo em dias que faça o roteiro inteiro caber no balde.
  const passoMaximo = Math.max(1, Math.floor((balde.dias - 1) / quantos));
  const folga = Math.max(1, balde.dias - passoMaximo * quantos);

  const instantes: string[] = [];
  let dia = Math.min(Math.floor(proximo() * folga), balde.dias - 1);
  let anterior = -1;

  for (let passo = 0; passo < quantos; passo += 1) {
    if (passo > 0) {
      dia = Math.min(dia + Math.floor(proximo() * (passoMaximo + 1)), balde.dias - 1);
    }

    // **O teto por passo, e ele é o que impede o roteiro de bater na parede do balde.** Reserva 37 min
    // para cada passo que ainda vem, de modo que o passo atual nunca ocupe o minuto de que o próximo
    // precisa. Sem ele, um balde de **um dia** — a semente rodada no dia 2 do mês, quando `M-0` tem um
    // único dia utilizável — estoura com roteiros de 7 passos ou mais: a janela de 11:00 a 23:59 dá
    // 780 min de partida e 1.439 de teto, e 6 empurrões de 37 já não cabem quando o sorteio começa
    // tarde. *(Achado da revisão, 29/08/2026: o comentário anterior dizia "inalcançável", e não era.)*
    const teto = ultimoMinuto - (quantos - 1 - passo) * EMPURRAO;
    const desejado = Math.min(
      dia * 24 * 60 + JANELA_INICIO + Math.floor(proximo() * JANELA_MINUTOS),
      teto,
    );
    const minuto = Math.min(Math.max(desejado, anterior + EMPURRAO), ultimoMinuto);

    if (minuto > ultimoMinuto || minuto <= anterior) {
      // **Agora sim inalcançável** para todo balde de pelo menos um dia e roteiros de até 8 passos:
      // 1.439 ≥ 7 × 37. Fica como rede para o dia em que um roteiro mais longo nascer — e o que ele
      // faz é **falhar alto**, em vez de produzir um plano que sai do mês ou instantes empatados.
      throw new Error(
        `O roteiro de ${String(quantos)} passos não cabe no balde ${balde.rotulo}, de ${String(balde.dias)} dia(s).`,
      );
    }

    anterior = minuto;
    instantes.push(new Date(balde.inicio.getTime() + minuto * UM_MINUTO).toISOString());
  }

  return instantes;
}

// ---------------------------------------------------------------------------
// As formas do mundo
// ---------------------------------------------------------------------------

export type ChaveDeOrganizacao = "a" | "b";

export const NOME_DA_ORGANIZACAO_A = "Condomínio Recanto Azul";
export const NOME_DA_ORGANIZACAO_B = "Edifício Aurora";
export const EMAIL_DE_HELENA = "helena.rocha@example.com";
export const EMAIL_DE_MARCOS = "marcos.vieira@example.com";

/** O que identifica um mundo: os dois nomes de organização e as duas contas que as fundam. */
export type Perfil = {
  /** Como as mensagens da linha de comando se referem a ele. */
  readonly rotulo: string;
  readonly organizacoes: Readonly<Record<ChaveDeOrganizacao, string>>;
  readonly contas: { readonly helena: string; readonly marcos: string };
  /**
   * Os nomes e as contas que este mundo já teve (item 77). **O reconhecimento os aceita, a semeadura nunca
   * os usa.** É o que deixa o `--apagar` de hoje remover a demonstração semeada antes da troca de nome, que
   * foi fundada pelas contas de então.
   */
  readonly anteriores: { readonly organizacoes: readonly string[]; readonly contas: readonly string[] };
};

export const PERFIL_DA_DEMONSTRACAO: Perfil = {
  rotulo: "a demonstração",
  organizacoes: { a: NOME_DA_ORGANIZACAO_A, b: NOME_DA_ORGANIZACAO_B },
  contas: { helena: EMAIL_DE_HELENA, marcos: EMAIL_DE_MARCOS },
  anteriores: {
    organizacoes: ["Condomínio Recanto Azul (demonstração)", "Edifício Aurora (demonstração)"],
    contas: ["helena.demo@example.com", "marcos.demo@example.com"],
  },
};

/**
 * O gêmeo dos testes de ponta a ponta (item 63): o mesmo plano, com outros nomes e outras contas, para
 * que nenhuma corrida escreva na demonstração. Os nomes de pessoa ficam iguais de propósito.
 */
export const PERFIL_DE_TESTE: Perfil = {
  rotulo: "o mundo de teste",
  organizacoes: { a: "Condomínio Recanto Azul (teste)", b: "Edifício Aurora (teste)" },
  contas: { helena: "helena.teste@example.com", marcos: "marcos.teste@example.com" },
  anteriores: { organizacoes: [], contas: [] },
};

/**
 * Os nomes e as contas pelos quais o mundo é reconhecido: os de hoje primeiro, depois os anteriores. **Uma
 * definição só para as duas pontas**, a recusa antes de semear e o `--apagar` (item 74).
 */
export function reconhecimentoDo(perfil: Perfil): {
  readonly nomes: readonly string[];
  readonly emails: readonly string[];
} {
  return {
    nomes: [...Object.values(perfil.organizacoes), ...perfil.anteriores.organizacoes],
    emails: [...Object.values(perfil.contas), ...perfil.anteriores.contas],
  };
}

export type OrganizacaoDoPlano = {
  readonly chave: ChaveDeOrganizacao;
  readonly nome: string;
  /** Quem a funda — e vira Gestor pela D26, porque o primeiro Gestor não tem quem o aprove. */
  readonly fundador: string;
};

export type PessoaDoPlano = {
  readonly chave: string;
  readonly nome: string;
  /** `null` quando a Pessoa nasce por `cadastrarVinculo` — sem conta, e é a maioria. */
  readonly email: string | null;
};

/**
 * **Sem `ordem`:** a posição é a da lista abaixo. Quem é criado entra no fim (item 50), e `ordem` saiu do
 * comando de criação com o item 44k — declarar um número aqui seria uma segunda fonte para a mesma coisa.
 */
export type AreaDoPlano = {
  readonly chave: string;
  readonly organizacao: ChaveDeOrganizacao;
  readonly nome: string;
  readonly tipo: TipoArea;
};

export type VinculoDoPlano = {
  readonly pessoa: string;
  readonly organizacao: ChaveDeOrganizacao;
  readonly papel: Papel;
  /** A unidade da pessoa nesta organização. `null` para Gestor e Encarregado. */
  readonly area: string | null;
  /**
   * Como o vínculo nasce. **`pedido` é o único caminho que o produto tem** para a mesma Pessoa ganhar um
   * segundo vínculo (achado B-01 do backlog): `POST /vinculos` sempre cria Pessoa nova.
   */
  readonly como: "fundacao" | "cadastro" | "pedido";
};

export type PassoDoRoteiro =
  | { readonly comando: "analisar"; readonly em: string; readonly por: string; readonly observacao: string }
  | { readonly comando: "alterar-prioridade"; readonly em: string; readonly por: string; readonly prioridade: Prioridade }
  | { readonly comando: "atribuir-responsavel"; readonly em: string; readonly por: string; readonly responsavel: string }
  | { readonly comando: "iniciar-atendimento"; readonly em: string; readonly por: string; readonly observacao: string }
  | { readonly comando: "pausar"; readonly em: string; readonly por: string; readonly motivo: MotivoPausa; readonly observacao: string }
  | { readonly comando: "retomar"; readonly em: string; readonly por: string; readonly observacao: string }
  | { readonly comando: "registrar-solucao-aplicada"; readonly em: string; readonly por: string; readonly solucaoAplicada: string }
  | { readonly comando: "resolver"; readonly em: string; readonly por: string; readonly observacao: string; readonly solucaoAplicada: string }
  | { readonly comando: "avaliar"; readonly em: string; readonly por: string; readonly nota: number; readonly comentario: string | null }
  | { readonly comando: "cancelar"; readonly em: string; readonly por: string; readonly motivo: MotivoCancelamento; readonly observacao: string };

export type OcorrenciaDoPlano = {
  readonly chave: string;
  readonly organizacao: ChaveDeOrganizacao;
  /** O rótulo do balde — `2026-06`. É por ele que o resumo agrupa. */
  readonly balde: string;
  readonly titulo: string;
  readonly descricao: string;
  /** O **nome** da categoria-semente. `mundo.ts` resolve para identificador. */
  readonly categoria: string;
  /** O **nome** da área. Idem. */
  readonly area: string;
  readonly localizacaoComplemento: string | null;
  readonly autor: string;
  readonly registradaEm: string;
  readonly roteiro: readonly PassoDoRoteiro[];
  /** Onde a ocorrência PARA. É o que o teste conta e o que o resumo imprime. */
  readonly statusFinal: StatusOcorrencia;
  /** Decisão D-3: só as do mês corrente, porque `enviarComentario` não aceita instante. */
  readonly recebeMensagem: boolean;
};

export type PlanoDaDemonstracao = {
  readonly hoje: string;
  /** O mundo que o plano grava: a demonstração ou o gêmeo de teste (item 63). */
  readonly perfil: Perfil;
  readonly baldes: readonly Balde[];
  readonly organizacoes: readonly OrganizacaoDoPlano[];
  readonly pessoas: readonly PessoaDoPlano[];
  readonly areas: readonly AreaDoPlano[];
  readonly vinculos: readonly VinculoDoPlano[];
  readonly ocorrencias: readonly OcorrenciaDoPlano[];
};

// ---------------------------------------------------------------------------
// O mundo, literal
// ---------------------------------------------------------------------------

function organizacoesDo(perfil: Perfil): readonly OrganizacaoDoPlano[] {
  return [
    { chave: "a", nome: perfil.organizacoes.a, fundador: "helena" },
    { chave: "b", nome: perfil.organizacoes.b, fundador: "marcos" },
  ];
}

function pessoasDo(perfil: Perfil): readonly PessoaDoPlano[] {
  return [
    { chave: "helena", nome: "Helena Rocha", email: perfil.contas.helena },
    { chave: "marcos", nome: "Marcos Vieira", email: perfil.contas.marcos },
    { chave: "beatriz", nome: "Beatriz Nunes", email: null },
    { chave: "rafael", nome: "Rafael Antunes", email: null },
    { chave: "claudia", nome: "Cláudia Meireles", email: null },
    { chave: "jorge", nome: "Jorge Tavares", email: null },
    { chave: "sonia", nome: "Sônia Prado", email: null },
    { chave: "diego", nome: "Diego Fontes", email: null },
  ];
}

/**
 * As áreas que a demonstração **acrescenta**. As duas da POL-01 — `Área comum` e `Unidade` — ficam, e
 * isto não contradiz a §14.2 do modelo: é a §14.2 acontecendo. *"Uma organização que nunca edite a
 * semente é uma organização mal configurada."*
 */
const AREAS: readonly AreaDoPlano[] = [
  { chave: "a-garagem", organizacao: "a", nome: "Garagem", tipo: "comum" },
  { chave: "a-hall", organizacao: "a", nome: "Hall de entrada", tipo: "comum" },
  { chave: "a-salao", organizacao: "a", nome: "Salão de festas", tipo: "comum" },
  { chave: "a-elevador", organizacao: "a", nome: "Elevador social", tipo: "comum" },
  { chave: "a-101", organizacao: "a", nome: "Apartamento 101", tipo: "privativa" },
  { chave: "a-302", organizacao: "a", nome: "Apartamento 302", tipo: "privativa" },
  { chave: "b-portaria", organizacao: "b", nome: "Portaria", tipo: "comum" },
  { chave: "b-lazer", organizacao: "b", nome: "Área de lazer", tipo: "comum" },
  { chave: "b-405", organizacao: "b", nome: "Sala 405", tipo: "privativa" },
];

const VINCULOS: readonly VinculoDoPlano[] = [
  { pessoa: "helena", organizacao: "a", papel: "gestor", area: null, como: "fundacao" },
  { pessoa: "marcos", organizacao: "b", papel: "gestor", area: null, como: "fundacao" },
  // **A Persona 1B, construída pelo único caminho que o produto tem.** Helena pede entrada em B com o
  // código público de B, e Marcos aprova como `solicitante`. Nenhum INSERT em `vinculos`.
  { pessoa: "helena", organizacao: "b", papel: "solicitante", area: null, como: "pedido" },
  { pessoa: "beatriz", organizacao: "a", papel: "encarregado", area: null, como: "cadastro" },
  { pessoa: "rafael", organizacao: "a", papel: "encarregado", area: null, como: "cadastro" },
  { pessoa: "claudia", organizacao: "a", papel: "solicitante", area: "Apartamento 101", como: "cadastro" },
  { pessoa: "jorge", organizacao: "a", papel: "solicitante", area: "Apartamento 302", como: "cadastro" },
  { pessoa: "sonia", organizacao: "b", papel: "encarregado", area: null, como: "cadastro" },
  { pessoa: "diego", organizacao: "b", papel: "solicitante", area: "Sala 405", como: "cadastro" },
];

// ---------------------------------------------------------------------------
// As receitas de desfecho, e os 36 rascunhos
// ---------------------------------------------------------------------------

type Receita =
  | { readonly desfecho: "aberta" }
  | { readonly desfecho: "em_analise" }
  | { readonly desfecho: "em_atendimento"; readonly comSolucao?: true }
  | { readonly desfecho: "pausada"; readonly motivo: MotivoPausa; readonly observacao: string }
  | {
      readonly desfecho: "resolvida";
      /** Quando presente, a ocorrência passa por `pausar` → `retomar` antes de resolver. */
      readonly comPausa?: { readonly motivo: MotivoPausa; readonly observacao: string };
      readonly avaliacao?: { readonly nota: number; readonly comentario: string | null };
    }
  | {
      readonly desfecho: "cancelada";
      readonly motivo: MotivoCancelamento;
      readonly observacao: string;
      /** `autor` exercita `cancelar_propria`; `gestor`, `cancelar_qualquer` (decisão D-5). */
      readonly por: "autor" | "gestor";
      /** De onde se cancela. Os dois estados são os de `ESTADOS_DE_CANCELAMENTO_DO_AUTOR`. */
      readonly apos: "aberta" | "em_analise";
    };

type Rascunho = {
  readonly chave: string;
  readonly organizacao: ChaveDeOrganizacao;
  /** Qual balde: `4` é `M-4`, `0` é o mês corrente. */
  readonly distancia: number;
  readonly titulo: string;
  readonly descricao: string;
  readonly categoria: string;
  readonly area: string;
  readonly complemento: string | null;
  readonly autor: string;
  /** Quem recebe a atribuição, quando a receita chega a `atribuir`. */
  readonly responsavel: string;
  /** Quando presente, entra um `alterar-prioridade` logo depois de `analisar`. */
  readonly prioridade?: Prioridade;
  /** O texto de `resolver` / `registrar-solucao-aplicada`. */
  readonly solucao: string;
  readonly receita: Receita;
};

const ILUMINACAO = "Problemas de iluminação";
const EQUIPAMENTOS = "Equipamentos quebrados";
const ACESSIBILIDADE = "Falta de acessibilidade";
const LIMPEZA = "Problemas de limpeza";
const VAZAMENTOS = "Vazamentos";
const SEGURANCA = "Problemas de segurança";
const MANUTENCAO = "Solicitações de manutenção";

const RASCUNHOS: readonly Rascunho[] = [
  // ---- M-4 · organização A ----------------------------------------------
  {
    chave: "a-01", organizacao: "a", distancia: 4,
    titulo: "Lâmpada queimada na vaga 12",
    descricao: "A lâmpada sobre a vaga 12 está queimada há alguns dias e a área fica escura à noite.",
    categoria: ILUMINACAO, area: "Garagem", complemento: "Vaga 12", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "Lâmpada substituída por modelo LED e reator conferido.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 5, comentario: "Resolvido no mesmo dia. Obrigada!" } },
  },
  {
    chave: "a-02", organizacao: "a", distancia: 4,
    titulo: "Portão da garagem travando ao fechar",
    descricao: "O portão para no meio do curso e precisa de um segundo comando para fechar.",
    categoria: EQUIPAMENTOS, area: "Garagem", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "Trilho limpo e sensor de fim de curso realinhado.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 4, comentario: null } },
  },
  {
    chave: "a-03", organizacao: "a", distancia: 4,
    titulo: "Lixeira do hall sem tampa",
    descricao: "A tampa da lixeira do hall sumiu e o cheiro incomoda quem espera o elevador.",
    categoria: LIMPEZA, area: "Hall de entrada", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "Lixeira substituída por uma com tampa com pedal.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-04", organizacao: "a", distancia: 4,
    titulo: "Barulho de arrastar no salão de festas",
    descricao: "Ouve-se arrastar de móveis no salão fora do horário permitido.",
    categoria: MANUTENCAO, area: "Salão de festas", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "desistencia", por: "autor", apos: "aberta",
      observacao: "O barulho não se repetiu; prefiro acompanhar antes de abrir de novo.",
    },
  },
  {
    chave: "a-05", organizacao: "a", distancia: 4,
    titulo: "Corrimão solto na escada de emergência",
    descricao: "O corrimão do segundo lance está solto na fixação da parede.",
    categoria: ACESSIBILIDADE, area: "Área comum", complemento: "Escada de emergência", autor: "claudia",
    responsavel: "beatriz", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  // ---- M-4 · organização B ----------------------------------------------
  {
    chave: "b-01", organizacao: "b", distancia: 4,
    titulo: "Infiltração na parede da sala",
    descricao: "Mancha de umidade crescendo na parede que dá para a fachada.",
    categoria: VAZAMENTOS, area: "Sala 405", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "Rejunte externo refeito e parede tratada com impermeabilizante.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 3, comentario: "Demorou, mas resolveu." } },
  },
  {
    chave: "b-02", organizacao: "b", distancia: 4,
    titulo: "Interfone da portaria sem áudio",
    descricao: "O interfone chama, mas ninguém ouve do outro lado.",
    categoria: EQUIPAMENTOS, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "duplicada", por: "gestor", apos: "em_analise",
      observacao: "Mesmo defeito já registrado em outra ocorrência, que segue em atendimento.",
    },
  },
  {
    chave: "b-03", organizacao: "b", distancia: 4,
    titulo: "Luz da área de lazer piscando",
    descricao: "As três luminárias do deque piscam quando a bomba da piscina liga.",
    categoria: ILUMINACAO, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-3 · organização A ----------------------------------------------
  {
    chave: "a-06", organizacao: "a", distancia: 3,
    titulo: "Vazamento no teto do elevador social",
    descricao: "Pinga água sobre o teto da cabine quando chove forte.",
    categoria: VAZAMENTOS, area: "Elevador social", complemento: null, autor: "claudia",
    responsavel: "rafael",
    solucao: "Calha da casa de máquinas desobstruída e vedação da laje refeita.",
    receita: {
      desfecho: "resolvida",
      comPausa: { motivo: "aguardando_terceiro", observacao: "Aguardando a empresa de elevadores liberar o acesso à casa de máquinas." },
      avaliacao: { nota: 5, comentario: null },
    },
  },
  {
    chave: "a-07", organizacao: "a", distancia: 3,
    titulo: "Rampa de acesso escorregadia quando molha",
    descricao: "O piso da rampa fica liso com chuva e não tem faixa antiderrapante.",
    categoria: ACESSIBILIDADE, area: "Área comum", complemento: "Rampa da entrada", autor: "jorge",
    responsavel: "beatriz",
    solucao: "Fitas antiderrapantes aplicadas em toda a extensão da rampa.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-08", organizacao: "a", distancia: 3,
    titulo: "Torneira do salão pingando",
    descricao: "A torneira da pia do salão pinga o dia inteiro.",
    categoria: VAZAMENTOS, area: "Salão de festas", complemento: null, autor: "claudia",
    responsavel: "rafael", prioridade: "baixa",
    solucao: "Reparo da torneira trocado.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-09", organizacao: "a", distancia: 3,
    titulo: "Cheiro de gás no corredor do térreo",
    descricao: "Sinto cheiro de gás perto da porta de serviço no fim da tarde.",
    categoria: SEGURANCA, area: "Área comum", complemento: "Corredor do térreo", autor: "jorge",
    responsavel: "beatriz",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "improcedente", por: "gestor", apos: "em_analise",
      observacao: "Vistoria da concessionária não encontrou vazamento; o odor vinha da lixeira externa.",
    },
  },
  {
    chave: "a-10", organizacao: "a", distancia: 3,
    titulo: "Fechadura do 302 emperrando",
    descricao: "A chave gira com muita dificuldade na fechadura da porta social.",
    categoria: MANUTENCAO, area: "Apartamento 302", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  // ---- M-3 · organização B ----------------------------------------------
  {
    chave: "b-04", organizacao: "b", distancia: 3,
    titulo: "Câmera da portaria fora do ar",
    descricao: "O monitor mostra sinal ausente na câmera que cobre a entrada de pedestres.",
    categoria: SEGURANCA, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Fonte da câmera substituída e gravação conferida por 24 horas.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 2, comentario: "Ficou dias sem imagem antes de alguém olhar." } },
  },
  {
    chave: "b-05", organizacao: "b", distancia: 3,
    titulo: "Ar-condicionado da sala 405 sem gelar",
    descricao: "O aparelho liga, mas o ar sai na temperatura ambiente.",
    categoria: EQUIPAMENTOS, area: "Sala 405", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_informacao_solicitante",
      observacao: "Precisamos do horário em que a sala fica livre para o técnico entrar.",
    },
  },
  // ---- M-2 · organização A · o balde sem nenhuma resolução ---------------
  {
    chave: "a-11", organizacao: "a", distancia: 2,
    titulo: "Motor do portão social parado",
    descricao: "O portão social só abre no manual desde ontem.",
    categoria: EQUIPAMENTOS, area: "Garagem", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_peca",
      observacao: "Placa do motor pedida ao fornecedor; prazo de entrega de duas semanas.",
    },
  },
  {
    chave: "a-12", organizacao: "a", distancia: 2,
    titulo: "Piso do hall soltando na junta",
    descricao: "Duas placas do piso do hall estão soltas e balançam ao pisar.",
    categoria: MANUTENCAO, area: "Hall de entrada", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_terceiro",
      observacao: "Orçamento com a empresa de pisos em análise pelo conselho.",
    },
  },
  {
    chave: "a-13", organizacao: "a", distancia: 2,
    titulo: "Reforma da guarita",
    descricao: "A guarita precisa de pintura e troca do vidro trincado.",
    categoria: MANUTENCAO, area: "Área comum", complemento: "Guarita", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "Vidro trocado; a pintura entra na próxima etapa, com o tempo firme.",
    receita: { desfecho: "em_atendimento", comSolucao: true },
  },
  {
    chave: "a-14", organizacao: "a", distancia: 2,
    titulo: "Vaga de garagem ocupada por veículo desconhecido",
    descricao: "Um carro que não é de morador está na vaga 07 há dois dias.",
    categoria: SEGURANCA, area: "Garagem", complemento: "Vaga 07", autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "sem_informacao_suficiente", por: "gestor", apos: "aberta",
      observacao: "Sem placa nem foto não há como identificar o veículo. Reabra com esses dados.",
    },
  },
  {
    chave: "a-15", organizacao: "a", distancia: 2,
    titulo: "Lâmpada do 101 queimada no corredor",
    descricao: "A lâmpada do corredor em frente ao 101 está queimada.",
    categoria: ILUMINACAO, area: "Apartamento 101", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-2 · organização B ----------------------------------------------
  {
    chave: "b-06", organizacao: "b", distancia: 2,
    titulo: "Grade da área de lazer solta",
    descricao: "A grade que separa o deque da rua está solta em dois pontos.",
    categoria: SEGURANCA, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia", prioridade: "alta",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
  {
    chave: "b-07", organizacao: "b", distancia: 2,
    titulo: "Limpeza da caixa d'água atrasada",
    descricao: "O laudo da última limpeza está vencido há mais de um mês.",
    categoria: LIMPEZA, area: "Área comum", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  {
    chave: "b-08", organizacao: "b", distancia: 2,
    titulo: "Sinalização de saída apagada",
    descricao: "A luminária de saída de emergência sobre a porta da portaria não acende.",
    categoria: ILUMINACAO, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-1 · organização A ----------------------------------------------
  {
    chave: "a-16", organizacao: "a", distancia: 1,
    titulo: "Vazamento na coluna do 302",
    descricao: "Água escorrendo pela coluna da área de serviço, do teto para o chão.",
    categoria: VAZAMENTOS, area: "Apartamento 302", complemento: "Área de serviço", autor: "jorge",
    responsavel: "rafael",
    solucao: "Trecho da coluna substituído e teste de estanqueidade feito com o prédio abastecido.",
    receita: {
      desfecho: "resolvida",
      comPausa: { motivo: "aguardando_peca", observacao: "Conexão de PVC de 100 mm em falta no fornecedor." },
      avaliacao: { nota: 4, comentario: "Ficou bom. Só faltou avisar quando a água voltaria." },
    },
  },
  {
    chave: "a-17", organizacao: "a", distancia: 1,
    titulo: "Piso tátil apagado na entrada",
    descricao: "O piso tátil da entrada está tão desgastado que quase não se distingue.",
    categoria: ACESSIBILIDADE, area: "Hall de entrada", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "Piso tátil refeito em toda a faixa da entrada.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 3, comentario: null } },
  },
  {
    chave: "a-18", organizacao: "a", distancia: 1,
    titulo: "Limpeza do salão após evento",
    descricao: "O salão ficou sujo depois da festa do fim de semana.",
    categoria: LIMPEZA, area: "Salão de festas", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "Salão limpo e cobrança da taxa de limpeza lançada ao responsável pela reserva.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-19", organizacao: "a", distancia: 1,
    titulo: "Troca do quadro de energia do térreo",
    descricao: "O quadro do térreo desarma sempre que a bomba e o portão ligam juntos.",
    categoria: MANUTENCAO, area: "Área comum", complemento: "Quadro do térreo", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_autorizacao",
      observacao: "Obra acima do limite de alçada; depende de aprovação em assembleia.",
    },
  },
  {
    chave: "a-20", organizacao: "a", distancia: 1,
    titulo: "Espelho do elevador trincado",
    descricao: "O espelho da cabine está trincado num canto e pode soltar lasca.",
    categoria: EQUIPAMENTOS, area: "Elevador social", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
  // ---- M-1 · organização B ----------------------------------------------
  {
    chave: "b-09", organizacao: "b", distancia: 1,
    titulo: "Porta da portaria desalinhada",
    descricao: "A porta raspa no batente e não fecha sozinha.",
    categoria: MANUTENCAO, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Dobradiças reguladas e mola de fechamento ajustada.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "b-10", organizacao: "b", distancia: 1,
    titulo: "Mancha de umidade no corredor do quarto andar",
    descricao: "Mancha escura no forro do corredor, perto da caixa de inspeção.",
    categoria: VAZAMENTOS, area: "Área comum", complemento: "Corredor do 4º andar", autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "resolvido_por_conta_propria", por: "autor", apos: "em_analise",
      observacao: "Era o registro do meu andar. Já mandei consertar por conta.",
    },
  },
  // ---- M-0 · organização A · as que recebem mensagem ---------------------
  {
    chave: "a-21", organizacao: "a", distancia: 0,
    titulo: "Refletor do pátio queimado",
    descricao: "O refletor que ilumina o pátio dos fundos não acende desde o fim de semana.",
    categoria: ILUMINACAO, area: "Área comum", complemento: "Pátio dos fundos", autor: "claudia",
    responsavel: "beatriz",
    solucao: "Refletor substituído e temporizador reprogramado.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 5, comentario: null } },
  },
  {
    chave: "a-22", organizacao: "a", distancia: 0,
    titulo: "Bomba d'água com ruído alto",
    descricao: "A bomba faz um ruído metálico quando liga de madrugada.",
    categoria: EQUIPAMENTOS, area: "Área comum", complemento: "Casa de bombas", autor: "jorge",
    responsavel: "rafael",
    solucao: "Rolamento trocado; ficará em observação por uma semana antes de encerrar.",
    receita: { desfecho: "em_atendimento", comSolucao: true },
  },
  {
    chave: "a-23", organizacao: "a", distancia: 0,
    titulo: "Coleta seletiva sem identificação",
    descricao: "Os contêineres da coleta seletiva perderam as placas e ninguém sabe qual é qual.",
    categoria: LIMPEZA, area: "Área comum", complemento: "Depósito de lixo", autor: "claudia",
    responsavel: "beatriz", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  {
    chave: "a-24", organizacao: "a", distancia: 0,
    titulo: "Corredor do 101 sem iluminação de emergência",
    descricao: "A luminária de emergência do corredor não acendeu na última queda de energia.",
    categoria: SEGURANCA, area: "Apartamento 101", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-0 · organização B ----------------------------------------------
  {
    chave: "b-11", organizacao: "b", distancia: 0,
    titulo: "Bebedouro da área de lazer sem água",
    descricao: "O bebedouro do deque não solta água desde segunda-feira.",
    categoria: EQUIPAMENTOS, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Filtro trocado e registro de entrada reaberto.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "b-12", organizacao: "b", distancia: 0,
    titulo: "Rampa da portaria sem corrimão",
    descricao: "A rampa de acesso à portaria não tem corrimão de nenhum lado.",
    categoria: ACESSIBILIDADE, area: "Portaria", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
];

// ---------------------------------------------------------------------------
// Do rascunho ao roteiro
// ---------------------------------------------------------------------------

const OBS_ANALISE = "Triado e encaminhado para atendimento.";
const OBS_INICIO = "Atendimento iniciado com o responsável em campo.";
const OBS_RETOMADA = "Impedimento resolvido; atendimento retomado.";
const OBS_RESOLUCAO = "Serviço concluído e conferido no local.";
// **O texto da mensagem NÃO mora aqui.** Ele é da tarefa 4 (`mundo.ts`), porque `enviarComentario` não
// aceita instante e a mensagem não é passo do roteiro — `plano.ts` só marca `recebeMensagem`. Uma cópia
// aqui seria constante não usada, e o `no-unused-vars` a acusaria em todo `npm run lint`.
// *(Achado da revisão, 29/08/2026: a primeira redação tinha as duas cópias.)*

/** Um passo ainda sem instante. O instante só existe depois de sabermos **quantos** passos há. */
type Molde = (em: string) => PassoDoRoteiro;

function gestorDe(organizacao: ChaveDeOrganizacao): string {
  return organizacao === "a" ? "helena" : "marcos";
}

/**
 * A ordem obrigatória, e ela é a da §8 da spec:
 * `registrar` → `analisar` → `atribuir` → `iniciar` → (`pausar` → `retomar`) → (`registrar-solucao`) →
 * `resolver` → `avaliar`. `iniciarAtendimento` exige responsável (invariante 9), e `cancelar` sai só das
 * três primeiras — aqui, das duas que `ESTADOS_DE_CANCELAMENTO_DO_AUTOR` também admite.
 */
function moldesDoRoteiro(rascunho: Rascunho): readonly Molde[] {
  const gestor = gestorDe(rascunho.organizacao);
  const { prioridade, receita } = rascunho;
  const moldes: Molde[] = [];

  // `alterar-prioridade` é admitido em `aberta`, `em_analise`, `em_atendimento` e `pausada`
  // (invariante 7). Entra logo depois de `analisar` — ou logo depois do registro, quando não há análise.
  const comPrioridade = (): void => {
    if (prioridade !== undefined) {
      moldes.push((em) => ({ comando: "alterar-prioridade", em, por: gestor, prioridade }));
    }
  };
  const comAnalise = (): void => {
    moldes.push((em) => ({ comando: "analisar", em, por: gestor, observacao: OBS_ANALISE }));
  };

  if (receita.desfecho === "aberta") {
    comPrioridade();
    return moldes;
  }

  if (receita.desfecho === "cancelada") {
    if (receita.apos === "em_analise") comAnalise();
    comPrioridade();
    const quem = receita.por === "autor" ? rascunho.autor : gestor;
    moldes.push((em) => ({
      comando: "cancelar", em, por: quem, motivo: receita.motivo, observacao: receita.observacao,
    }));
    return moldes;
  }

  comAnalise();
  comPrioridade();

  if (receita.desfecho === "em_analise") return moldes;

  moldes.push((em) => ({
    comando: "atribuir-responsavel", em, por: gestor, responsavel: rascunho.responsavel,
  }));
  moldes.push((em) => ({ comando: "iniciar-atendimento", em, por: gestor, observacao: OBS_INICIO }));

  if (receita.desfecho === "em_atendimento") {
    if (receita.comSolucao === true) {
      // **O escritor de T-05** — o campo no corpo da tela, item 25. O outro escritor, o corpo do
      // `resolver`, é exercitado pelas resolvidas: o critério 25.3 declara os dois equivalentes, e a
      // demonstração usa os dois (decisão D-4).
      moldes.push((em) => ({
        comando: "registrar-solucao-aplicada", em, por: gestor, solucaoAplicada: rascunho.solucao,
      }));
    }
    return moldes;
  }

  if (receita.desfecho === "pausada") {
    moldes.push((em) => ({
      comando: "pausar", em, por: gestor, motivo: receita.motivo, observacao: receita.observacao,
    }));
    return moldes;
  }

  if (receita.comPausa !== undefined) {
    const pausa = receita.comPausa;
    moldes.push((em) => ({
      comando: "pausar", em, por: gestor, motivo: pausa.motivo, observacao: pausa.observacao,
    }));
    // `retomar` volta ao `statusAnterior` do registro da pausa (invariante 6) — que aqui é
    // `em_atendimento`, de onde `resolver` sai.
    moldes.push((em) => ({ comando: "retomar", em, por: gestor, observacao: OBS_RETOMADA }));
  }

  moldes.push((em) => ({
    comando: "resolver", em, por: gestor, observacao: OBS_RESOLUCAO, solucaoAplicada: rascunho.solucao,
  }));

  if (receita.avaliacao !== undefined) {
    const { nota, comentario } = receita.avaliacao;
    // **Só o autor avalia** (invariante 8), e o autor é sempre um Solicitante — que tem
    // `ocorrencia.avaliar` no mapa de permissões.
    moldes.push((em) => ({ comando: "avaliar", em, por: rascunho.autor, nota, comentario }));
  }

  return moldes;
}

function exigir<T>(valor: T | undefined, oQue: string): T {
  if (valor === undefined) throw new Error(`${oQue} não existe — o plano está inconsistente.`);
  return valor;
}

/**
 * O plano inteiro, a partir de um `hoje`.
 *
 * **Determinístico:** duas chamadas com o mesmo `hoje` devolvem o mesmo objeto. A única variável é o
 * `hoje` — e o teste prova as duas coisas.
 */
export function planoDaDemonstracao(hoje: Date, perfil: Perfil = PERFIL_DA_DEMONSTRACAO): PlanoDaDemonstracao {
  const baldes = baldesDaDemonstracao(hoje);
  const porDistancia = new Map(baldes.map((balde) => [balde.distancia, balde]));
  const proximo = sorteio(SEMENTE_DO_SORTEIO);

  const ocorrencias: OcorrenciaDoPlano[] = [];

  for (const rascunho of RASCUNHOS) {
    const balde = porDistancia.get(rascunho.distancia);
    // O balde do mês corrente some quando a semente roda no dia 1 (§3.5). As seis ocorrências dele
    // simplesmente não nascem — e os cinco critérios continuam verdadeiros com quatro baldes.
    if (balde === undefined) continue;

    const moldes = moldesDoRoteiro(rascunho);
    const instantes = instantesDoRoteiro(balde, moldes.length + 1, proximo);

    ocorrencias.push({
      chave: rascunho.chave,
      organizacao: rascunho.organizacao,
      balde: balde.rotulo,
      titulo: rascunho.titulo,
      descricao: rascunho.descricao,
      categoria: rascunho.categoria,
      area: rascunho.area,
      localizacaoComplemento: rascunho.complemento,
      autor: rascunho.autor,
      registradaEm: exigir(instantes[0], `o instante de registro de ${rascunho.chave}`),
      roteiro: moldes.map((molde, indice) =>
        molde(exigir(instantes[indice + 1], `o instante ${String(indice + 1)} de ${rascunho.chave}`)),
      ),
      statusFinal: rascunho.receita.desfecho,
      // **Decisão D-3:** `enviarComentario` não aceita instante e carimba o relógio real. Só as
      // ocorrências do mês corrente recebem mensagem, porque só nelas "agora" é a coisa certa.
      recebeMensagem: rascunho.distancia === 0,
    });
  }

  return {
    hoje: hoje.toISOString(),
    perfil,
    baldes,
    organizacoes: organizacoesDo(perfil),
    pessoas: pessoasDo(perfil),
    areas: AREAS,
    vinculos: VINCULOS,
    ocorrencias,
  };
}
