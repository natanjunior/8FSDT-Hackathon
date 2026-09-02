import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import { resolverContexto, type EscolhaDaSessao } from "@/aplicacao/contexto";
import { criarConta, entrar } from "@/aplicacao/credenciais";
import {
  alterarPrioridade,
  analisarOcorrencia,
  atribuirResponsavel,
  avaliarOcorrencia,
  cancelarOcorrencia,
  enviarComentario,
  iniciarAtendimento,
  pausarOcorrencia,
  registrarOcorrencia,
  registrarSolucaoAplicada,
  resolverOcorrencia,
  retomarOcorrencia,
} from "@/aplicacao/ocorrencia";
import {
  aprovarPedidoDeEntrada,
  cadastrarVinculo,
  criarArea,
  criarOrganizacao,
  listarAreas,
  listarCategorias,
  pedirEntrada,
} from "@/aplicacao/organizacao";
import {
  montarCredenciais,
  montarPortasEscopadas,
  montarPortasGlobais,
  type ArmazenamentoDeCookies,
} from "@/composicao";
import { PERMISSOES_POR_PAPEL } from "@/dominio/organizacao";

import {
  EMAIL_DE_HELENA,
  EMAIL_DE_MARCOS,
  type ChaveDeOrganizacao,
  type OcorrenciaDoPlano,
  type PlanoDaDemonstracao,
} from "./plano";

/**
 * ============================================================================
 *  A execução — pelos MESMOS caminhos que o produto usa
 * ============================================================================
 *
 * Nenhum `INSERT`, nenhum `UPDATE`, nenhuma exceção à ADR-0001. Todo instante entra por `ctx.agora`, que
 * os dez comandos aceitam desde o item 16, e desce inteiro até a coluna porque o repositório grava
 * `registrada_em`/`atualizada_em` **com o instante do comando, nunca com `now()`**.
 *
 * **O que este arquivo NÃO faz:** decidir o mundo. Ele executa o que `plano.ts` descreve — e por isso o
 * teste do plano prova os critérios sem banco, e este arquivo só pode errar a tradução.
 */

/** O texto da mensagem das seis ocorrências do mês corrente (decisão D-3). */
const TEXTO_DA_MENSAGEM =
  "Registrado. Qualquer novidade, escreva aqui na ocorrência que a gente acompanha por este canal.";

/**
 * A sessão de uma conta, em memória, viva só durante a execução.
 *
 * `montarPortasGlobais` e `montarCredenciais` pedem um armazenamento de cookies porque no produto quem o
 * fornece é o Next. Aqui é um `Map`, e ele some com o processo.
 *
 * **Um por pessoa, e não um só:** duas contas no mesmo armazenamento sobrescreveriam o cookie de sessão
 * uma da outra, e a segunda `resolverContexto` devolveria a Pessoa errada.
 */
function armazenamentoEmMemoria(): ArmazenamentoDeCookies {
  const guardados = new Map<string, string>();
  return {
    todos: () => [...guardados].map(([name, value]) => ({ name, value })),
    definir: (cookies) => {
      for (const cookie of cookies) {
        // O provedor **remove** um cookie definindo-o vazio. Guardar o vazio faria a sessão existir morta.
        if (cookie.value === "") guardados.delete(cookie.name);
        else guardados.set(cookie.name, cookie.value);
      }
    },
  };
}

/** A semente nunca escolhe organização por cookie: ela passa o identificador a `montarPortasEscopadas`. */
const SEM_ESCOLHA: EscolhaDaSessao = { organizacaoEscolhida: () => null };

/**
 * **Nunca chamada**: nenhuma ocorrência da demonstração carrega anexo (§3.8), e a porta só é tocada
 * dentro do laço de `entrada.anexos`. **Estourar é o ponto** — se alguém acrescentar anexo ao roteiro sem
 * pensar, o programa quebra alto em vez de mentir. É o mesmo duplo de
 * `testes/integracao/isolamento-de-organizacao.test.ts:94-109`.
 */
const SEM_ANEXO = {
  conferirTicket: () => {
    throw new Error("A demonstração não registra com anexo (spec §3.8).");
  },
  descrever: () => {
    throw new Error("A demonstração não registra com anexo (spec §3.8).");
  },
  marcarConfirmado: () => {
    throw new Error("A demonstração não registra com anexo (spec §3.8).");
  },
  urlDeLeitura: () => {
    throw new Error("A demonstração não registra com anexo (spec §3.8).");
  },
} as unknown as ArmazenamentoDeAnexos;

export type ResumoDaSemeadura = {
  readonly organizacoes: readonly {
    nome: string;
    codigoPublico: string;
    ocorrencias: number;
    /**
     * **A tabela mensal desta organização** — critério 32.7. Na ordem dos baldes, do mais antigo para o
     * mês corrente, e **só os meses em que ela escreveu alguma coisa**.
     */
    meses: readonly { rotulo: string; registradas: number; resolvidas: number; avaliadas: number }[];
    /** **A linha de status desta organização** — critério 32.7. */
    porStatus: Readonly<Record<string, number>>;
  }[];
  readonly meses: readonly {
    rotulo: string;
    registradas: number;
    resolvidas: number;
    avaliadas: number;
  }[];
  readonly porStatus: Readonly<Record<string, number>>;
  readonly porMotivoDePausa: Readonly<Record<string, number>>;
  readonly contas: readonly { email: string; onde: string }[];
  readonly mensagens: number;
};

type Conta = { readonly pessoaId: string; readonly cookies: ArmazenamentoDeCookies };

/**
 * O destino do link de confirmação para a semeadura — e aqui **constante é a resposta certa**.
 *
 * A semeadura **não é uma requisição**: não há `Origin`, não há `Host`, e não há aplicação publicada de
 * onde tirar origem. O valor é **inerte** nos dois ambientes, porque a confirmação de e-mail está
 * desligada (Q-T9, 22/08/2026) — e num mundo em que ela fosse ligada **a semeadura já quebraria antes de
 * este valor importar**: `criarConta` devolveria `precisaConfirmarEmail` sem sessão, e o
 * `resolverContexto` logo abaixo não teria de onde sair.
 *
 * **Não confundir com o critério 1 do item 6c**, que é sobre o caminho do produto: lá o destino sai da
 * **origem do pedido**, e nunca de constante. Ver `src/interface/http/confirmacao-de-conta.ts`.
 *
 * **Por que não importar `montarDestinoDeConfirmacao`.** Ele mora em `@/interface/http`, cujo `index.ts`
 * reexporta `com-contexto.ts`, que **começa** com `import { cookies, headers } from "next/headers"` — e
 * este programa roda no `tsx`, fora de qualquer requisição. É o mesmo grafo que
 * `testes/interface/credencial.test.ts` precisa simular para não derrubar o arquivo inteiro, e o mesmo
 * que `interface/http/recusa-de-campos.ts` argumenta em voz alta. A regra `SUPERFICIE_PUBLICA` do lint
 * fecha o desvio por `@/interface/http/confirmacao-de-conta`.
 */
const DESTINO_DE_CONFIRMACAO_INERTE = "http://host.docker.internal:3000/confirmar-conta";

/**
 * Cria a conta — ou entra nela, quando a semeadura anterior a deixou.
 *
 * **`criarConta` é o caminho do produto**, o mesmo de T-11, e ele funciona nos dois ambientes porque a
 * **Q-T9 está fechada** desde 22/08/2026: confirmação de e-mail não é obrigatória
 * (`supabase/config.toml:240` no local; o interruptor desligado no painel, no publicado). A alternativa —
 * chave de serviço e `auth.admin.createUser` — foi recusada na spec: exigiria uma quarta variável de
 * ambiente, e essa é a chave que ignora toda a política do provedor.
 *
 * **A Pessoa sai de `resolverContexto`**, que é o mesmo ACL que toda requisição usa — é ele que garante a
 * linha em `pessoas` a partir do usuário do provedor.
 */
async function garantirConta(nome: string, email: string, senha: string): Promise<Conta> {
  const cookies = armazenamentoEmMemoria();
  const credenciais = montarCredenciais(cookies);

  const criada = await criarConta(credenciais, nome, email, senha, DESTINO_DE_CONFIRMACAO_INERTE);
  if (!criada.ok) {
    if (criada.recusa !== "CONTA_JA_EXISTE") {
      throw new Error(`Não foi possível criar a conta ${email}: ${criada.recusa}.`);
    }
    const entrada = await entrar(credenciais, email, senha);
    if (!entrada.ok) {
      throw new Error(
        `A conta ${email} já existe e a senha não confere (${entrada.recusa}). ` +
          `Use a mesma SENHA_DA_DEMONSTRACAO da semeadura anterior, ou troque a senha no provedor.`,
      );
    }
  }

  const resolucao = await resolverContexto(montarPortasGlobais(cookies), SEM_ESCOLHA);
  return { pessoaId: resolucao.sessao.pessoaId, cookies };
}

export async function semear(
  plano: PlanoDaDemonstracao,
  senha: string,
): Promise<ResumoDaSemeadura> {
  // 1 · As duas contas. Cada uma com o próprio armazenamento de cookies.
  const helena = await garantirConta("Helena Rocha", EMAIL_DE_HELENA, senha);
  const marcos = await garantirConta("Marcos Vieira", EMAIL_DE_MARCOS, senha);

  const pessoas = new Map<string, string>([
    ["helena", helena.pessoaId],
    ["marcos", marcos.pessoaId],
  ]);
  const contasPorChave = new Map<string, Conta>([
    ["helena", helena],
    ["marcos", marcos],
  ]);

  // 2 · As duas organizações. Quem cria vira o Gestor inicial (D26), e a POL-01 semeia sete categorias e
  //     duas áreas na mesma transação. O código público é SORTEADO por `criarOrganizacao` — a semente o
  //     lê, nunca o escolhe.
  const organizacoes = new Map<ChaveDeOrganizacao, { id: string; nome: string; codigoPublico: string }>();
  for (const organizacao of plano.organizacoes) {
    const conta = contasPorChave.get(organizacao.fundador);
    if (conta === undefined) throw new Error(`Sem conta para o fundador ${organizacao.fundador}.`);

    const criada = await criarOrganizacao(montarPortasGlobais(conta.cookies).organizacoes, {
      nome: organizacao.nome,
      criadaPorPessoaId: conta.pessoaId,
    });
    organizacoes.set(organizacao.chave, {
      id: criada.id,
      nome: criada.nome,
      codigoPublico: criada.codigoPublico,
    });
  }

  const idDaOrganizacao = (chave: ChaveDeOrganizacao): string => {
    const encontrada = organizacoes.get(chave);
    if (encontrada === undefined) throw new Error(`Organização ${chave} não foi criada.`);
    return encontrada.id;
  };

  const escopadas = new Map(
    [...organizacoes.keys()].map((chave) => [chave, montarPortasEscopadas(idDaOrganizacao(chave))]),
  );
  const portasDe = (chave: ChaveDeOrganizacao) => {
    const encontradas = escopadas.get(chave);
    if (encontradas === undefined) throw new Error(`Sem portas escopadas para ${chave}.`);
    return encontradas;
  };

  // 3 · A Persona 1B, pelo ÚNICO caminho que o produto tem (achado B-01 do backlog): Helena pede entrada
  //     em B com o código público de B, e Marcos aprova como `solicitante`. Nenhum INSERT em `vinculos`.
  for (const vinculo of plano.vinculos.filter((candidato) => candidato.como === "pedido")) {
    const conta = contasPorChave.get(vinculo.pessoa);
    const pessoa = plano.pessoas.find((candidata) => candidata.chave === vinculo.pessoa);
    const destino = organizacoes.get(vinculo.organizacao);
    if (conta === undefined || pessoa === undefined || destino === undefined) {
      throw new Error(`Pedido de entrada mal descrito para ${vinculo.pessoa}.`);
    }

    const globais = montarPortasGlobais(conta.cookies);
    const pedido = await pedirEntrada(
      // **`escritaDePedidosDeEntrada`, não `pedidosDeEntrada`**: o segundo é a leitura global.
      { pedidosDeEntrada: globais.escritaDePedidosDeEntrada },
      { pessoaId: conta.pessoaId, nome: pessoa.nome },
      { codigoPublico: destino.codigoPublico, nome: null, telefone: null },
      // Ela já tem vínculo ativo em A — e é isso que impede o pedido de renomear a Pessoa.
      true,
    );

    const decisor = plano.organizacoes.find((o) => o.chave === vinculo.organizacao)?.fundador;
    const contaDoDecisor = decisor === undefined ? undefined : contasPorChave.get(decisor);
    if (contaDoDecisor === undefined) throw new Error(`Sem Gestor para aprovar em ${vinculo.organizacao}.`);

    await aprovarPedidoDeEntrada(portasDe(vinculo.organizacao).pedidosDeEntrada, {
      pedidoId: pedido.id,
      papel: vinculo.papel,
      areaId: null,
      decididoPorPessoaId: contaDoDecisor.pessoaId,
    });
  }

  // 4 · As áreas acrescentadas. As duas da POL-01 ficam — isto é a §14.2 acontecendo, não a contrariando.
  for (const area of plano.areas) {
    const gestor = plano.organizacoes.find((o) => o.chave === area.organizacao)?.fundador;
    const conta = gestor === undefined ? undefined : contasPorChave.get(gestor);
    if (conta === undefined) throw new Error(`Sem Gestor para criar áreas em ${area.organizacao}.`);

    await criarArea(portasDe(area.organizacao).areas, {
      nome: area.nome,
      tipo: area.tipo,
      ordem: area.ordem,
      porPessoaId: conta.pessoaId,
    });
  }

  // 5 · O de-para de nome para identificador, lido do banco DEPOIS de criar — inclui as duas áreas da
  //     POL-01 e as sete categorias, que a semente não cria e não edita.
  const areasPorNome = new Map<string, string>();
  const categoriasPorNome = new Map<string, string>();
  for (const chave of organizacoes.keys()) {
    for (const area of await listarAreas(portasDe(chave).areas)) {
      areasPorNome.set(`${chave}:${area.nome}`, area.id);
    }
    for (const categoria of await listarCategorias(portasDe(chave).categorias)) {
      categoriasPorNome.set(`${chave}:${categoria.nome}`, categoria.id);
    }
  }
  const exigirArea = (chave: ChaveDeOrganizacao, nome: string): string => {
    const id = areasPorNome.get(`${chave}:${nome}`);
    if (id === undefined) throw new Error(`Área "${nome}" não existe em ${chave}.`);
    return id;
  };

  // 6 · Os seis vínculos sem conta — Encarregados e moradores. `cadastrarVinculo` cria Pessoa e Vínculo na
  //     mesma transação, e é o que dá autor às ocorrências sem inventar seis contas de e-mail.
  for (const vinculo of plano.vinculos.filter((candidato) => candidato.como === "cadastro")) {
    const pessoa = plano.pessoas.find((candidata) => candidata.chave === vinculo.pessoa);
    if (pessoa === undefined) throw new Error(`Pessoa ${vinculo.pessoa} não está no plano.`);

    const cadastrado = await cadastrarVinculo(portasDe(vinculo.organizacao).vinculos, {
      nome: pessoa.nome,
      papel: vinculo.papel,
      areaId: vinculo.area === null ? null : exigirArea(vinculo.organizacao, vinculo.area),
      contatos: [],
    });
    pessoas.set(vinculo.pessoa, cadastrado.pessoa.pessoaId);
  }

  const idDePessoa = (chave: string): string => {
    const id = pessoas.get(chave);
    if (id === undefined) throw new Error(`Pessoa ${chave} não foi criada.`);
    return id;
  };
  const permissoesDe = (chave: string, organizacao: ChaveDeOrganizacao): readonly string[] => {
    const vinculo = plano.vinculos.find(
      (candidato) => candidato.pessoa === chave && candidato.organizacao === organizacao,
    );
    if (vinculo === undefined) throw new Error(`${chave} não tem vínculo em ${organizacao}.`);
    return PERMISSOES_POR_PAPEL[vinculo.papel];
  };

  // 7 · As 36 ocorrências, com o roteiro de cada uma.
  const contagem = {
    porStatus: {} as Record<string, number>,
    porMotivoDePausa: {} as Record<string, number>,
    porMes: new Map<string, { registradas: number; resolvidas: number; avaliadas: number }>(),
    porOrganizacao: new Map<ChaveDeOrganizacao, number>(),
    porMesDaOrganizacao: new Map<
      string,
      { registradas: number; resolvidas: number; avaliadas: number }
    >(),
    porStatusDaOrganizacao: new Map<ChaveDeOrganizacao, Record<string, number>>(),
    mensagens: 0,
  };

  for (const ocorrencia of plano.ocorrencias) {
    const portas = portasDe(ocorrencia.organizacao);
    const autorId = idDePessoa(ocorrencia.autor);

    const lida = await registrarOcorrencia(
      {
        ocorrencias: portas.ocorrencias,
        categorias: portas.categorias,
        areas: portas.areas,
        armazenamento: SEM_ANEXO,
      },
      {
        pessoaId: autorId,
        organizacaoId: idDaOrganizacao(ocorrencia.organizacao),
        // **O instante do passado**, e é a peça inteira do item: o repositório o grava em
        // `registrada_em` e `atualizada_em`, sem `now()`.
        agora: ocorrencia.registradaEm,
      },
      {
        titulo: ocorrencia.titulo,
        descricao: ocorrencia.descricao,
        categoriaId: exigirCategoria(categoriasPorNome, ocorrencia),
        areaId: exigirArea(ocorrencia.organizacao, ocorrencia.area),
        localizacaoComplemento: ocorrencia.localizacaoComplemento,
      },
    );

    await executarRoteiro(portas.ocorrencias, ocorrencia, lida.id, idDePessoa, permissoesDe);

    if (ocorrencia.recebeMensagem) {
      // **Sem instante, e é o achado F-1 do plano.** `enviarComentario` lê o próprio relógio, então só as
      // ocorrências do mês corrente recebem mensagem — nelas, "agora" é a coisa certa.
      const gestor = ocorrencia.organizacao === "a" ? "helena" : "marcos";
      await enviarComentario(
        portas.ocorrencias,
        lida.id,
        { pessoaId: idDePessoa(gestor), podeLerTodas: true },
        { texto: TEXTO_DA_MENSAGEM },
      );
      contagem.mensagens += 1;
    }

    registrarNaContagem(contagem, ocorrencia);
  }

  return montarResumo(plano, organizacoes, contagem);
}

type Escopadas = ReturnType<typeof montarPortasEscopadas>;

/**
 * O roteiro, passo a passo.
 *
 * **Um `switch` exaustivo sobre `PassoDoRoteiro`**: o compilador cobra o dia em que um décimo primeiro
 * comando nascer. E cada chamada recebe `agora: passo.em` — nunca o relógio.
 */
async function executarRoteiro(
  ocorrencias: Escopadas["ocorrencias"],
  ocorrencia: OcorrenciaDoPlano,
  ocorrenciaId: string,
  idDePessoa: (chave: string) => string,
  permissoesDe: (chave: string, organizacao: ChaveDeOrganizacao) => readonly string[],
): Promise<void> {
  for (const passo of ocorrencia.roteiro) {
    const ctx = {
      pessoaId: idDePessoa(passo.por),
      permissoes: permissoesDe(passo.por, ocorrencia.organizacao),
      agora: passo.em,
    };

    switch (passo.comando) {
      case "analisar":
        await analisarOcorrencia(ocorrencias, ctx, { ocorrenciaId, observacao: passo.observacao });
        break;
      case "alterar-prioridade":
        await alterarPrioridade(ocorrencias, ctx, { ocorrenciaId, prioridade: passo.prioridade });
        break;
      case "atribuir-responsavel":
        await atribuirResponsavel(ocorrencias, ctx, {
          ocorrenciaId,
          responsavelPessoaId: idDePessoa(passo.responsavel),
        });
        break;
      case "iniciar-atendimento":
        await iniciarAtendimento(ocorrencias, ctx, { ocorrenciaId, observacao: passo.observacao });
        break;
      case "pausar":
        await pausarOcorrencia(ocorrencias, ctx, {
          ocorrenciaId,
          motivo: passo.motivo,
          observacao: passo.observacao,
        });
        break;
      case "retomar":
        await retomarOcorrencia(ocorrencias, ctx, { ocorrenciaId, observacao: passo.observacao });
        break;
      case "registrar-solucao-aplicada":
        await registrarSolucaoAplicada(ocorrencias, ctx, {
          ocorrenciaId,
          solucaoAplicada: passo.solucaoAplicada,
        });
        break;
      case "resolver":
        await resolverOcorrencia(ocorrencias, ctx, {
          ocorrenciaId,
          observacao: passo.observacao,
          solucaoAplicada: passo.solucaoAplicada,
        });
        break;
      case "avaliar":
        await avaliarOcorrencia(ocorrencias, ctx, {
          ocorrenciaId,
          nota: passo.nota,
          comentario: passo.comentario,
        });
        break;
      case "cancelar":
        await cancelarOcorrencia(ocorrencias, ctx, {
          ocorrenciaId,
          motivo: passo.motivo,
          observacao: passo.observacao,
        });
        break;
    }
  }
}

function exigirCategoria(
  categoriasPorNome: ReadonlyMap<string, string>,
  ocorrencia: OcorrenciaDoPlano,
): string {
  const id = categoriasPorNome.get(`${ocorrencia.organizacao}:${ocorrencia.categoria}`);
  if (id === undefined) {
    throw new Error(`Categoria "${ocorrencia.categoria}" não existe em ${ocorrencia.organizacao}.`);
  }
  return id;
}

type Contagem = {
  porStatus: Record<string, number>;
  porMotivoDePausa: Record<string, number>;
  porMes: Map<string, { registradas: number; resolvidas: number; avaliadas: number }>;
  porOrganizacao: Map<ChaveDeOrganizacao, number>;
  /**
   * A tabela mensal **por organização** — critério 32.7. A chave é `${organizacao}:${balde}`.
   *
   * **Acrescenta em vez de trocar a chave de `porMes`**, e a escolha é deliberada: os critérios 43.1 a
   * 43.5 se conferem no bloco total, que o item 43 fechou. Reaproveitar `porMes` obrigaria a reconstruir
   * o total por soma, e um total reconstruído é um total que pode divergir do que já foi aceito.
   */
  porMesDaOrganizacao: Map<string, { registradas: number; resolvidas: number; avaliadas: number }>;
  /** A linha de status **por organização** — critério 32.7. A chave é a organização. */
  porStatusDaOrganizacao: Map<ChaveDeOrganizacao, Record<string, number>>;
  mensagens: number;
};

/**
 * **Conta o que foi escrito, não o que foi planejado** (decisão D-7).
 *
 * A chamada acontece **depois** de todo o roteiro daquela ocorrência ter passado sem lançar — e todo
 * comando lança quando recusa. Um resumo derivado do plano descreveria o plano; derivado daqui, ele
 * descreve o banco, que é o que a §3.9 da spec quer dele.
 */
function registrarNaContagem(contagem: Contagem, ocorrencia: OcorrenciaDoPlano): void {
  contagem.porStatus[ocorrencia.statusFinal] = (contagem.porStatus[ocorrencia.statusFinal] ?? 0) + 1;
  contagem.porOrganizacao.set(
    ocorrencia.organizacao,
    (contagem.porOrganizacao.get(ocorrencia.organizacao) ?? 0) + 1,
  );

  if (ocorrencia.statusFinal === "pausada") {
    for (const passo of ocorrencia.roteiro) {
      if (passo.comando === "pausar") {
        contagem.porMotivoDePausa[passo.motivo] = (contagem.porMotivoDePausa[passo.motivo] ?? 0) + 1;
      }
    }
  }

  const mes = contagem.porMes.get(ocorrencia.balde) ?? {
    registradas: 0,
    resolvidas: 0,
    avaliadas: 0,
  };
  mes.registradas += 1;
  if (ocorrencia.statusFinal === "resolvida") mes.resolvidas += 1;
  if (ocorrencia.roteiro.some((passo) => passo.comando === "avaliar")) mes.avaliadas += 1;
  contagem.porMes.set(ocorrencia.balde, mes);

  /**
   * **O mesmo que acima, recortado pela organização** — critério 32.7, e é o que torna o critério 32.6
   * conferível: o dashboard é sempre de UMA organização, e o resumo somava as duas.
   *
   * `ocorrencia.organizacao` já chegava aqui e já era usado em `porOrganizacao`; o que muda é a chave.
   */
  const chaveDoMes = `${ocorrencia.organizacao}:${ocorrencia.balde}`;
  const mesDaOrganizacao = contagem.porMesDaOrganizacao.get(chaveDoMes) ?? {
    registradas: 0,
    resolvidas: 0,
    avaliadas: 0,
  };
  mesDaOrganizacao.registradas += 1;
  if (ocorrencia.statusFinal === "resolvida") mesDaOrganizacao.resolvidas += 1;
  if (ocorrencia.roteiro.some((passo) => passo.comando === "avaliar")) {
    mesDaOrganizacao.avaliadas += 1;
  }
  contagem.porMesDaOrganizacao.set(chaveDoMes, mesDaOrganizacao);

  const statusDaOrganizacao = contagem.porStatusDaOrganizacao.get(ocorrencia.organizacao) ?? {};
  statusDaOrganizacao[ocorrencia.statusFinal] = (statusDaOrganizacao[ocorrencia.statusFinal] ?? 0) + 1;
  contagem.porStatusDaOrganizacao.set(ocorrencia.organizacao, statusDaOrganizacao);
}

function montarResumo(
  plano: PlanoDaDemonstracao,
  organizacoes: ReadonlyMap<ChaveDeOrganizacao, { id: string; nome: string; codigoPublico: string }>,
  contagem: Contagem,
): ResumoDaSemeadura {
  return {
    organizacoes: [...organizacoes].map(([chave, organizacao]) => ({
      nome: organizacao.nome,
      codigoPublico: organizacao.codigoPublico,
      ocorrencias: contagem.porOrganizacao.get(chave) ?? 0,
      // **A mesma ordem dos baldes do bloco total**, e o mesmo filtro: mês em que a organização não
      // escreveu nada não vira linha — é o que faz a tabela dela ter o tamanho da história dela.
      meses: plano.baldes
        .filter((balde) => contagem.porMesDaOrganizacao.has(`${chave}:${balde.rotulo}`))
        .map((balde) => {
          const mes = contagem.porMesDaOrganizacao.get(`${chave}:${balde.rotulo}`) ?? {
            registradas: 0,
            resolvidas: 0,
            avaliadas: 0,
          };
          return { rotulo: balde.rotulo, ...mes };
        }),
      porStatus: contagem.porStatusDaOrganizacao.get(chave) ?? {},
    })),
    // Na ordem dos baldes, do mais antigo para o mês corrente — é o que faz a série ser lida como série.
    meses: plano.baldes
      .filter((balde) => contagem.porMes.has(balde.rotulo))
      .map((balde) => {
        const mes = contagem.porMes.get(balde.rotulo) ?? {
          registradas: 0,
          resolvidas: 0,
          avaliadas: 0,
        };
        return { rotulo: balde.rotulo, ...mes };
      }),
    porStatus: contagem.porStatus,
    porMotivoDePausa: contagem.porMotivoDePausa,
    contas: [
      { email: EMAIL_DE_HELENA, onde: "Gestora em A, Solicitante em B" },
      { email: EMAIL_DE_MARCOS, onde: "Gestor em B" },
    ],
    mensagens: contagem.mensagens,
  };
}
