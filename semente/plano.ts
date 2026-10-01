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

import type { ContatoParaEscrita } from "@/aplicacao/organizacao";
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
  /**
   * Os contatos com que o vínculo nasce (item 106, critério 13). Ausente é *nenhum*, e é a maioria: a tela
   * de Participantes precisa mostrar também o estado vazio.
   */
  readonly contatos?: readonly ContatoParaEscrita[];
  /**
   * **O vínculo nasce sem unidade e a recebe numa segunda escrita**, pelo comando de correção. É o único
   * jeito de a coluna *Última atualização* ter data na demonstração: o relógio é carimbo de gatilho e só
   * anda numa alteração em outra transação (item 68b). A unidade final é a de `area`, então o mundo
   * termina igual.
   */
  readonly unidadeDepois?: true;
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
  /**
   * O que o Gestor escreve no canal da ocorrência, ou `null`. Decisão D-3 do 43: só as do mês corrente,
   * porque `enviarComentario` não aceita instante. Uma por ocorrência (item 77), para nenhuma se repetir.
   */
  readonly mensagem: string | null;
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
  // **Beatriz fica sem contato e sem atualização** (critério 106.13): a tela também mostra o vazio.
  { pessoa: "beatriz", organizacao: "a", papel: "encarregado", area: null, como: "cadastro" },
  {
    pessoa: "rafael", organizacao: "a", papel: "encarregado", area: null, como: "cadastro",
    contatos: [
      { tipo: "telefone", valor: "+5511987650202", finalidade: "trabalho", temWhatsapp: true, observacao: null },
    ],
  },
  {
    pessoa: "claudia", organizacao: "a", papel: "solicitante", area: "Apartamento 101", como: "cadastro",
    unidadeDepois: true,
    contatos: [
      { tipo: "email", valor: "claudia.meireles@example.com", finalidade: "pessoal", temWhatsapp: false, observacao: null },
    ],
  },
  {
    pessoa: "jorge", organizacao: "a", papel: "solicitante", area: "Apartamento 302", como: "cadastro",
    unidadeDepois: true,
    contatos: [
      { tipo: "telefone", valor: "+5511987650303", finalidade: "pessoal", temWhatsapp: false, observacao: null },
    ],
  },
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
  /** A mensagem do Gestor. Só as do mês corrente a recebem, e nelas ela é obrigatória. */
  readonly mensagem?: string;
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
    titulo: "Garagem escura perto da vaga 12",
    descricao:
      "A lâmpada que fica em cima da vaga 12 queimou na quinta-feira. À noite não dá para ver o degrau da " +
      "rampa de pedestres, e ontem uma vizinha quase caiu com as compras. Se puderem olhar logo, agradeço.",
    categoria: ILUMINACAO, area: "Garagem", complemento: "Vaga 12", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "Lâmpada trocada por LED e reator conferido. A luminária da vaga 14 também estava fraca e foi trocada junto.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 5, comentario: "Resolvido no mesmo dia. Obrigada!" } },
  },
  {
    chave: "a-02", organizacao: "a", distancia: 4,
    titulo: "Controle do portão tendo que apertar duas vezes",
    descricao: "o portão fecha até a metade e para, aí tem que apertar o controle de novo. acontece quase toda manhã",
    categoria: EQUIPAMENTOS, area: "Garagem", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "Trilho limpo e sensor de fim de curso realinhado. O portão fechou dez vezes seguidas sem parar.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 4, comentario: null } },
  },
  {
    chave: "a-03", organizacao: "a", distancia: 4,
    titulo: "Lixeira do hall sem tampa",
    descricao: "A tampa da lixeira ao lado do elevador sumiu. O cheiro fica forte no fim do dia.",
    categoria: LIMPEZA, area: "Hall de entrada", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "Lixeira trocada por uma com tampa de pedal.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-04", organizacao: "a", distancia: 4,
    titulo: "Tomada do salão de festas solta da parede",
    descricao: "a tomada perto da bancada tá solta, balança toda vez que liga alguma coisa",
    categoria: MANUTENCAO, area: "Salão de festas", complemento: "Bancada da copa", autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "desistencia", por: "autor", apos: "aberta",
      observacao: "Desisti por enquanto, vou usar a tomada do outro lado. Se piorar abro de novo.",
    },
  },
  {
    chave: "a-05", organizacao: "a", distancia: 4,
    titulo: "Corrimão solto na escada de emergência",
    descricao:
      "O corrimão do segundo lance da escada de emergência está solto na fixação da parede. Ainda segura, " +
      "mas balança bastante, e quem desce com criança no colo se apoia nele.",
    categoria: ACESSIBILIDADE, area: "Área comum", complemento: "Escada de emergência", autor: "claudia",
    responsavel: "beatriz", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  // ---- M-4 · organização B ----------------------------------------------
  {
    chave: "b-01", organizacao: "b", distancia: 4,
    titulo: "Descarga do banheiro do térreo vazando",
    descricao:
      "A descarga do banheiro coletivo do térreo fica soltando água sem parar. Dá para ouvir do corredor, e " +
      "é água indo embora o dia inteiro.",
    categoria: VAZAMENTOS, area: "Área comum", complemento: "Banheiro coletivo do térreo", autor: "helena",
    responsavel: "sonia",
    solucao: "Reparo da válvula de descarga trocado e registro regulado.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 3, comentario: "Demorou, mas resolveu." } },
  },
  {
    chave: "b-02", organizacao: "b", distancia: 4,
    titulo: "Interfone sem áudio",
    descricao: "interfone chama mas não sai som nenhum",
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
    titulo: "Luminárias do deque piscando",
    descricao: "As três luminárias do deque piscam quando a bomba da piscina liga.",
    categoria: ILUMINACAO, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-3 · organização A ----------------------------------------------
  {
    chave: "a-06", organizacao: "a", distancia: 3,
    titulo: "Água pingando dentro do elevador social",
    descricao:
      "Quando chove forte pinga água pelo teto da cabine do elevador social, bem no canto do painel. Já " +
      "aconteceu três vezes este mês. Hoje de manhã tinha uma poça no piso e alguém pôs papelão para não " +
      "escorregar. Fico preocupada com a parte elétrica.",
    categoria: VAZAMENTOS, area: "Elevador social", complemento: null, autor: "claudia",
    responsavel: "rafael",
    solucao: "Calha da casa de máquinas desobstruída e vedação da laje refeita. Cabine seca nas duas últimas chuvas.",
    receita: {
      desfecho: "resolvida",
      comPausa: { motivo: "aguardando_terceiro", observacao: "Aguardando a empresa de elevadores liberar o acesso à casa de máquinas." },
      avaliacao: { nota: 5, comentario: null },
    },
  },
  {
    chave: "a-07", organizacao: "a", distancia: 3,
    titulo: "Rampa da entrada lisa quando chove",
    descricao: "com chuva a rampa vira sabão, minha mãe usa andador e não consegue subir sozinha",
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
    descricao: "sinto cheiro de gás perto da porta de serviço no fim da tarde, hoje tava mais forte",
    categoria: SEGURANCA, area: "Área comum", complemento: "Corredor do térreo", autor: "jorge",
    responsavel: "beatriz",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "improcedente", por: "gestor", apos: "em_analise",
      observacao: "A vistoria da concessionária não encontrou vazamento. O cheiro vinha da lixeira externa, que já foi lavada.",
    },
  },
  {
    chave: "a-10", organizacao: "a", distancia: 3,
    titulo: "Fechadura da porta do 302 emperrando",
    descricao: "A chave gira com muita dificuldade na fechadura da porta social. Hoje quase fiquei trancado do lado de fora.",
    categoria: MANUTENCAO, area: "Apartamento 302", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  // ---- M-3 · organização B ----------------------------------------------
  {
    chave: "b-04", organizacao: "b", distancia: 3,
    titulo: "Câmera da entrada sem imagem",
    descricao:
      "O monitor da portaria mostra sinal ausente na câmera da entrada de pedestres desde segunda. Hoje " +
      "entrou um entregador sem ninguém ver pela câmera, e o porteiro só percebeu quando ele já estava no " +
      "elevador.",
    categoria: SEGURANCA, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Fonte da câmera substituída e gravação conferida por 24 horas.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 2, comentario: "Ficou dias sem imagem antes de alguém olhar." } },
  },
  {
    chave: "b-05", organizacao: "b", distancia: 3,
    titulo: "Ar da sala de reuniões desligando sozinho",
    descricao:
      "O ar-condicionado da sala de reuniões do térreo desliga sozinho depois de uns vinte minutos. Liga de " +
      "novo pelo controle, mas logo desliga outra vez. Aconteceu nas duas reuniões desta semana.",
    categoria: EQUIPAMENTOS, area: "Área comum", complemento: "Sala de reuniões do térreo", autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_informacao_solicitante",
      observacao: "Precisamos saber em que horário costuma acontecer, para o técnico vir acompanhar.",
    },
  },
  // ---- M-2 · organização A · o balde sem nenhuma resolução ---------------
  {
    chave: "a-11", organizacao: "a", distancia: 2,
    titulo: "Motor do portão da garagem parado",
    descricao:
      "Desde ontem à noite o portão da garagem não abre pelo controle, só no manual. O porteiro está abrindo " +
      "para cada carro, e de manhã formou fila na rua. Ouvi um estalo no motor antes de parar.",
    categoria: EQUIPAMENTOS, area: "Garagem", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_peca",
      observacao: "Placa do motor pedida ao fornecedor, com prazo de duas semanas. Até lá o porteiro abre no manual.",
    },
  },
  {
    chave: "a-12", organizacao: "a", distancia: 2,
    titulo: "Piso do hall soltando",
    descricao: "duas placas do piso perto da porta tão soltas e fazem barulho quando pisa",
    categoria: MANUTENCAO, area: "Hall de entrada", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_terceiro",
      observacao: "Orçamento da empresa de pisos em análise pelo conselho.",
    },
  },
  {
    chave: "a-13", organizacao: "a", distancia: 2,
    titulo: "Vidro da guarita trincado",
    descricao:
      "O vidro da frente da guarita está trincado de canto a canto. O porteiro colou fita, mas com vento ele " +
      "vibra, e tenho medo de cair em alguém.",
    categoria: MANUTENCAO, area: "Área comum", complemento: "Guarita", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "Vidro trocado. A pintura da guarita entra na próxima etapa, com o tempo firme.",
    receita: { desfecho: "em_atendimento", comSolucao: true },
  },
  {
    chave: "a-14", organizacao: "a", distancia: 2,
    titulo: "Carro estranho na vaga 07",
    descricao: "Tem um carro que não é de morador parado na vaga 07 há dois dias.",
    categoria: SEGURANCA, area: "Garagem", complemento: "Vaga 07", autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "sem_informacao_suficiente", por: "gestor", apos: "aberta",
      observacao: "Sem placa nem foto não dá para identificar o veículo. Se ele voltar, registre de novo com esses dados.",
    },
  },
  {
    chave: "a-15", organizacao: "a", distancia: 2,
    titulo: "Corredor do 1º andar no escuro",
    descricao: "A lâmpada do corredor do primeiro andar, entre o 101 e o 102, está queimada.",
    categoria: ILUMINACAO, area: "Área comum", complemento: "Corredor do 1º andar", autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-2 · organização B ----------------------------------------------
  {
    chave: "b-06", organizacao: "b", distancia: 2,
    titulo: "Grade do deque solta",
    descricao: "a grade que separa o deque da rua tá solta em dois pontos, dá pra passar a mão por baixo",
    categoria: SEGURANCA, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia", prioridade: "alta",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
  {
    chave: "b-07", organizacao: "b", distancia: 2,
    titulo: "Laudo da caixa d'água vencido",
    descricao: "O laudo da última limpeza da caixa d'água, que fica colado na portaria, venceu há mais de um mês.",
    categoria: LIMPEZA, area: "Área comum", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "em_analise" },
  },
  {
    chave: "b-08", organizacao: "b", distancia: 2,
    titulo: "Placa de saída de emergência apagada",
    descricao: "a placa de saída em cima da porta da portaria não acende",
    categoria: ILUMINACAO, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "aberta" },
  },
  // ---- M-1 · organização A ----------------------------------------------
  {
    chave: "a-16", organizacao: "a", distancia: 1,
    titulo: "Água descendo pela coluna da área de serviço",
    descricao:
      "tá escorrendo água pela coluna da área de serviço, do teto até o chão. já coloquei balde e toalha mas " +
      "enche rápido. acho que vem do apartamento de cima porque piora quando eles usam a máquina de lavar",
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
    titulo: "Piso tátil gasto na entrada",
    descricao: "O piso tátil da entrada está tão desgastado que quase não se distingue do resto.",
    categoria: ACESSIBILIDADE, area: "Hall de entrada", complemento: null, autor: "claudia",
    responsavel: "beatriz",
    solucao: "Piso tátil refeito em toda a faixa da entrada.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 3, comentario: null } },
  },
  {
    chave: "a-18", organizacao: "a", distancia: 1,
    titulo: "Salão sujo depois da festa de sábado",
    descricao: "o salão ficou com lixo e copo no chão depois da festa, hoje de manhã ainda tava assim",
    categoria: LIMPEZA, area: "Salão de festas", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "Salão limpo e taxa de limpeza lançada para quem reservou.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "a-19", organizacao: "a", distancia: 1,
    titulo: "Quadro de luz do térreo desarmando",
    descricao:
      "O disjuntor geral do térreo desarma sempre que a bomba e o portão ligam ao mesmo tempo. Já aconteceu " +
      "quatro vezes esta semana, e em duas o elevador parou junto. O zelador religa, mas ninguém sabe dizer " +
      "por que acontece.",
    categoria: MANUTENCAO, area: "Área comum", complemento: "Quadro do térreo", autor: "claudia",
    responsavel: "beatriz", prioridade: "alta",
    solucao: "",
    receita: {
      desfecho: "pausada", motivo: "aguardando_autorizacao",
      observacao: "A troca do quadro passa do limite de gasto do síndico e depende de aprovação em assembleia.",
    },
  },
  {
    chave: "a-20", organizacao: "a", distancia: 1,
    titulo: "Espelho do elevador trincado",
    descricao: "espelho da cabine trincou no canto de baixo, pode soltar um pedaço",
    categoria: EQUIPAMENTOS, area: "Elevador social", complemento: null, autor: "jorge",
    responsavel: "rafael",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
  // ---- M-1 · organização B ----------------------------------------------
  {
    chave: "b-09", organizacao: "b", distancia: 1,
    titulo: "Porta de vidro da portaria raspando",
    descricao: "A porta raspa no batente e não fecha sozinha.",
    categoria: MANUTENCAO, area: "Portaria", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Dobradiças reguladas e mola de fechamento ajustada.",
    receita: { desfecho: "resolvida" },
  },
  {
    chave: "b-10", organizacao: "b", distancia: 1,
    titulo: "Mancha de umidade no forro do 4º andar",
    descricao:
      "Apareceu uma mancha escura no forro do corredor do 4º andar, perto da copa. Está do tamanho de um " +
      "prato e parece úmida ao toque.",
    categoria: VAZAMENTOS, area: "Área comum", complemento: "Corredor do 4º andar", autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: {
      desfecho: "cancelada", motivo: "resolvido_por_conta_propria", por: "autor", apos: "em_analise",
      observacao: "Era a máquina de café da copa vazando. A empresa do andar já consertou.",
    },
  },
  // ---- M-0 · organização A · as que recebem mensagem ---------------------
  {
    chave: "a-21", organizacao: "a", distancia: 0,
    titulo: "Refletor do pátio dos fundos apagado",
    descricao: "O refletor do pátio dos fundos não acende desde o fim de semana.",
    categoria: ILUMINACAO, area: "Área comum", complemento: "Pátio dos fundos", autor: "claudia",
    responsavel: "beatriz",
    solucao: "Refletor substituído e temporizador reprogramado.",
    receita: { desfecho: "resolvida", avaliacao: { nota: 5, comentario: null } },
    mensagem: "Cláudia, o refletor foi trocado hoje à tarde. Se ele não acender às 18h, me avise por aqui.",
  },
  {
    chave: "a-22", organizacao: "a", distancia: 0,
    titulo: "Barulho de metal na bomba d'água",
    descricao: "a bomba faz um barulho de metal quando liga de madrugada, acorda o bloco todo",
    categoria: EQUIPAMENTOS, area: "Área comum", complemento: "Casa de bombas", autor: "jorge",
    responsavel: "rafael",
    solucao: "Rolamento trocado; fica em observação por uma semana antes de encerrar.",
    receita: { desfecho: "em_atendimento", comSolucao: true },
    mensagem:
      "Jorge, o rolamento já foi trocado. Vamos deixar a bomba em observação até sexta. Se o barulho voltar " +
      "de madrugada, anote o horário aqui.",
  },
  {
    chave: "a-23", organizacao: "a", distancia: 0,
    titulo: "Contêineres da coleta seletiva sem placa",
    descricao: "Os contêineres da coleta seletiva perderam as placas, e o reciclável está indo misturado com o lixo comum.",
    categoria: LIMPEZA, area: "Área comum", complemento: "Depósito de lixo", autor: "claudia",
    responsavel: "beatriz", prioridade: "baixa",
    solucao: "",
    receita: { desfecho: "em_analise" },
    mensagem: "Cláudia, vou ver com a administradora se ainda temos as placas antigas ou se precisamos encomendar novas.",
  },
  {
    chave: "a-24", organizacao: "a", distancia: 0,
    titulo: "Luz de emergência da escada não acendeu",
    descricao:
      "Na queda de energia de terça, a luz de emergência da escada não acendeu, e desci os dois andares no " +
      "escuro, com a lanterna do celular.",
    categoria: SEGURANCA, area: "Área comum", complemento: "Escada, 2º andar", autor: "claudia",
    responsavel: "beatriz",
    solucao: "",
    receita: { desfecho: "aberta" },
    mensagem: "Obrigada pelo aviso. Vamos testar todas as luzes de emergência do prédio, não só a da escada.",
  },
  // ---- M-0 · organização B ----------------------------------------------
  {
    chave: "b-11", organizacao: "b", distancia: 0,
    titulo: "Bebedouro do deque sem água",
    descricao: "bebedouro não sai água desde segunda",
    categoria: EQUIPAMENTOS, area: "Área de lazer", complemento: null, autor: "diego",
    responsavel: "sonia",
    solucao: "Filtro trocado e registro de entrada reaberto.",
    receita: { desfecho: "resolvida" },
    mensagem: "Diego, o filtro foi trocado. Pode conferir quando descer.",
  },
  {
    chave: "b-12", organizacao: "b", distancia: 0,
    titulo: "Rampa da portaria sem corrimão",
    descricao:
      "A rampa de acesso à portaria não tem corrimão de nenhum lado. Um senhor que vem à sala 210 toda " +
      "semana precisa de ajuda para subir.",
    categoria: ACESSIBILIDADE, area: "Portaria", complemento: null, autor: "helena",
    responsavel: "sonia",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
    mensagem: "Helena, o serralheiro vem medir na quinta. O corrimão sai nos dois lados da rampa.",
  },
];

// ---------------------------------------------------------------------------
// Do rascunho ao roteiro
// ---------------------------------------------------------------------------

/**
 * **As observações de transição variam, e pela posição do rascunho** (item 77). Com uma frase só, a trilha
 * de toda ocorrência resolvida dizia as mesmas quatro coisas. A escolha é `indice % tamanho`, e **não** o
 * sorteio: consumir o sorteio aqui mudaria a sequência e, com ela, todos os instantes da semente.
 */
const OBS_ANALISE: readonly string[] = [
  "Triado e encaminhado para atendimento.",
  "Conferido no local; segue para atendimento.",
  "Recebido. Vamos verificar e já encaminho.",
  "Visto com o zelador e encaminhado.",
];
const OBS_INICIO: readonly string[] = [
  "Atendimento iniciado com o responsável em campo.",
  "Responsável a caminho.",
  "Serviço começou hoje de manhã.",
];
const OBS_RETOMADA: readonly string[] = [
  "Impedimento resolvido; atendimento retomado.",
  "Liberado para continuar; serviço retomado.",
];
const OBS_RESOLUCAO: readonly string[] = [
  "Serviço concluído e conferido no local.",
  "Concluído. Conferi pessoalmente.",
  "Finalizado e conferido com quem abriu.",
];

function variante(lista: readonly string[], indice: number): string {
  return exigir(lista[indice % lista.length], "a variante de observação");
}

/** Um passo ainda sem instante. O instante só existe depois de sabermos **quantos** passos há. */
type Molde = (em: string) => PassoDoRoteiro;

function gestorDe(organizacao: ChaveDeOrganizacao): string {
  return organizacao === "a" ? "helena" : "marcos";
}


/**
 * ---------------------------------------------------------------------------
 *  As ocorrências de relógio — item 101
 * ---------------------------------------------------------------------------
 *
 * **Datadas por dias antes de `hoje`, e não por balde.** O filtro de paradas precisa de uma ocorrência
 * com idade exata para o vídeo mostrar o recorte funcionando; um balde mensal não sabe dizer *"há nove
 * dias"*, porque a idade dele muda com o dia em que a semente roda.
 *
 * **Todos os instantes cabem no MESMO mês**, e é o que mantém a invariante de `plano.test.ts`: uma
 * ocorrência não atravessa o mês em que foi registrada. O roteiro inteiro cabe em duas horas e meia,
 * então a história também fica boa — triada e atribuída de uma vez, e depois nada por nove dias, que é
 * exatamente o que o filtro existe para achar.
 *
 * **Sem mensagem, e a receita não passa por `atribuir` depois do último instante** — senão o cenário
 * dependeria de um detalhe invisível. A atribuição que o desfecho `em_atendimento` exige entra **dentro**
 * do bloco, antes do último passo.
 */
type RascunhoAncorado = Omit<Rascunho, "distancia"> & {
  /** Quantos dias antes de `hoje` cai o ÚLTIMO passo do roteiro. */
  readonly paradaHaDias: number;
};

const RASCUNHOS_ANCORADOS: readonly RascunhoAncorado[] = [
  {
    chave: "p-01", organizacao: "a", paradaHaDias: 9,
    titulo: "Bomba de recalque desarmando toda madrugada",
    descricao:
      "Desde a semana passada a bomba desarma por volta das três da manhã e a caixa da coluna dois amanhece " +
      "vazia. Quem mora do décimo andar para cima fica sem água até alguém religar no quadro.",
    categoria: EQUIPAMENTOS, area: "Garagem", complemento: "Casa de bombas, ao lado da vaga 20",
    autor: "claudia", responsavel: "beatriz", prioridade: "alta",
    solucao: "",
    receita: { desfecho: "em_atendimento" },
  },
];

/** Uma hora, na unidade que o arquivo já tem. */
const UMA_HORA = 60 * UM_MINUTO;

/**
 * `quantos` instantes crescentes terminando **`paradaHaDias` dias e uma hora antes de `hoje`**.
 *
 * **A conta é de tempo decorrido, e não de dia de calendário, porque é assim que a leitura mede.** O
 * destaque diz `floor((corte − atualizada_em) / 24 h)`. Ancorar numa hora fixa do dia `hoje − 9` daria
 * um piso de **oito** dias sempre que `hoje` fosse mais cedo que essa hora.
 *
 * **A hora de folga é o que dá validade ao número por um dia inteiro.** Semeado às 10h, o decorrido nasce
 * em 9 d 1 h e só vira 10 dias 23 horas depois — tempo de sobra para gravar. Sem ela, o piso viraria 10
 * no primeiro minuto.
 *
 * **O bloco inteiro cabe num mês só**, que é a invariante que `plano.test.ts` cobra de toda ocorrência.
 * Quando o recuo o faria atravessar a virada, ele desce inteiro para o fim do mês anterior. Isso só
 * **acrescenta** horas ao decorrido, e o piso em dias não muda.
 */
function instantesAncorados(hoje: Date, quantos: number, paradaHaDias: number): readonly string[] {
  const passo = EMPURRAO * UM_MINUTO;
  const mesDe = (instante: number): string => new Date(instante).toISOString().slice(0, 7);

  let fim = hoje.getTime() - paradaHaDias * UM_DIA - UMA_HORA;
  if (mesDe(fim - (quantos - 1) * passo) !== mesDe(fim)) {
    const virada = new Date(fim);
    fim = Date.UTC(virada.getUTCFullYear(), virada.getUTCMonth(), 1) - UMA_HORA;
  }

  return Array.from({ length: quantos }, (_, indice) =>
    new Date(fim - (quantos - 1 - indice) * passo).toISOString(),
  );
}

/**
 * A ordem obrigatória, e ela é a da §8 da spec:
 * `registrar` → `analisar` → `atribuir` → `iniciar` → (`pausar` → `retomar`) → (`registrar-solucao`) →
 * `resolver` → `avaliar`. `iniciarAtendimento` exige responsável (invariante 9), e `cancelar` sai só das
 * três primeiras — aqui, das duas que `ESTADOS_DE_CANCELAMENTO_DO_AUTOR` também admite.
 */
function moldesDoRoteiro(
  rascunho: Omit<Rascunho, "distancia">,
  indice: number,
): readonly Molde[] {
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
    moldes.push((em) => ({ comando: "analisar", em, por: gestor, observacao: variante(OBS_ANALISE, indice) }));
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
  moldes.push((em) => ({
    comando: "iniciar-atendimento", em, por: gestor, observacao: variante(OBS_INICIO, indice),
  }));

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
    moldes.push((em) => ({ comando: "retomar", em, por: gestor, observacao: variante(OBS_RETOMADA, indice) }));
  }

  moldes.push((em) => ({
    comando: "resolver", em, por: gestor, observacao: variante(OBS_RESOLUCAO, indice),
    solucaoAplicada: rascunho.solucao,
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

  for (const [indice, rascunho] of RASCUNHOS.entries()) {
    const balde = porDistancia.get(rascunho.distancia);
    // O balde do mês corrente some quando a semente roda no dia 1 (§3.5). As seis ocorrências dele
    // simplesmente não nascem — e os cinco critérios continuam verdadeiros com quatro baldes.
    if (balde === undefined) continue;

    const moldes = moldesDoRoteiro(rascunho, indice);
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
      mensagem:
        rascunho.distancia === 0 ? exigir(rascunho.mensagem, `a mensagem de ${rascunho.chave}`) : null,
    });
  }

  for (const [indice, rascunho] of RASCUNHOS_ANCORADOS.entries()) {
    const moldes = moldesDoRoteiro(rascunho, RASCUNHOS.length + indice);
    const instantes = instantesAncorados(hoje, moldes.length + 1, rascunho.paradaHaDias);
    const registro = exigir(instantes[0], `o instante de registro de ${rascunho.chave}`);
    const rotulo = registro.slice(0, 7);

    // **O balde é o do mês do registro, e ele tem de existir.** Com nove dias de âncora e um roteiro de
    // um dia, o registro cai sempre no mês corrente ou no anterior, e os dois têm balde — no dia 1,
    // quando o mês corrente não nasce, nove dias atrás já é o mês anterior. Falhar alto se a conta mudar.
    if (!baldes.some((balde) => balde.rotulo === rotulo)) {
      throw new Error(`A ocorrência ancorada ${rascunho.chave} caiu no mês ${rotulo}, que não tem balde.`);
    }

    ocorrencias.push({
      chave: rascunho.chave,
      organizacao: rascunho.organizacao,
      balde: rotulo,
      titulo: rascunho.titulo,
      descricao: rascunho.descricao,
      categoria: rascunho.categoria,
      area: rascunho.area,
      localizacaoComplemento: rascunho.complemento,
      autor: rascunho.autor,
      registradaEm: registro,
      roteiro: moldes.map((molde, passo) =>
        molde(exigir(instantes[passo + 1], `o instante ${String(passo + 1)} de ${rascunho.chave}`)),
      ),
      statusFinal: rascunho.receita.desfecho,
      // **Sem mensagem, e é o ponto da ocorrência:** `enviarComentario` carimba o relógio real, e uma
      // mensagem aqui zeraria justamente o relógio que ela existe para mostrar parado.
      mensagem: null,
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
