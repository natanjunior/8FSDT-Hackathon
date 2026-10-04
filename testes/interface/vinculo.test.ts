import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  faceDepoisDaRecusa,
  faceInicial,
  razaoDoImpedimento,
  textoDaConfirmacao,
  textoDaRecusa,
  textoDoEncerramento,
  tituloDaConfirmacao,
  tituloDoEncerramento,
  tituloDoImpedimento,
} from "@/interface/componentes/frases-da-remocao";
import {
  FALHA,
  PAPEIS,
  avisoDeAcessoEncerrado,
  avisoDeAprovado,
  avisoDeCadastrado,
  avisoDeRecusado,
  avisoDeRemovido,
  avisoDeSalvo,
  avisoDoEncarregado,
  dataCurta,
  dataEHora,
  descricaoDaRecusa,
  descricaoDoPedido,
  erroDoPapelNaResposta,
  fatoDeEdicao,
  fraseDoFato,
  fraseDoFatoDeEdicao,
  papelDoValor,
  primeiroNome,
  rotuloDeAprovar,
  rotuloDoContato,
  rotuloDoPapel,
  TEXTOS_DA_TABELA,
  tituloDaRecusa,
} from "@/interface/componentes/frases-de-participantes";
import {
  ENDERECO_PADRAO,
  VAZIO_DO_FILTRO,
  ariaSort,
  comEtiqueta,
  comFiltro,
  comOrdem,
  contagensDeEtiquetas,
  contagensDoFiltro,
  escreverEndereco,
  etiquetaVigente,
  estadoDaTabela,
  faixaDaPagina,
  filtrarPeloNome,
  lerEndereco,
  linhaDoPedido,
  linhaDoVinculo,
  montarLinhas,
  naPagina,
  ordenarLinhas,
  paginar,
  pertenceAEtiqueta,
  pertenceAoFiltro,
  type Filtro,
  type LinhaDeParticipante,
  type PedidoNaTabela,
} from "@/interface/componentes/linhas-de-participantes";
import {
  anuncioDeMovimento,
  destinoDoArrasto,
  destinoDoVao,
  moverItem,
  vaoDoArrasto,
} from "@/interface/componentes/ordem-manual";
import {
  SEM_ORDENACAO,
  ariaSortDa,
  escreverOrdenacao,
  lerOrdenacao,
  proximaOrdenacao,
  rotuloDoCabecalho,
  type Ordenacao,
} from "@/interface/componentes/ordenacao-em-tres-estados";
import {
  SEM_UNIDADE,
  areaDoSeletor,
  campoDoContato,
  comTipo,
  contatoEmLeitura,
  contatoNovo,
  contatoVindoDaApi,
  corpoDaCorrecao,
  corpoDoCadastro,
  edicaoMudou,
  erroDoContato,
  errosDoFormularioDeVinculo,
  errosDoServidorNoFormulario,
  indicesDuplicados,
  listaMudou,
  paraCorpo,
  seletorDaArea,
  type ContatoEmEdicao,
} from "@/interface/componentes/regras-do-vinculo";
import {
  PREFIXO_BR,
  converterTelefoneDigitado,
  telefoneLegivel,
  telefoneNoCampo,
} from "@/interface/componentes/telefone";
import type { VinculoProjetado } from "@/interface/projecoes";
import {
  MENSAGEM_DE_TELEFONE,
  cadastroDeVinculoSchema,
  correcaoDeVinculoSchema,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os corpos de `POST` e `PATCH /vinculos` (item 9b)
 * ============================================================================
 *
 * **O que este arquivo prova são os critérios 2 e 3**, e a decisão 2.1 da spec: que a forma é recusada
 * antes de o domínio existir, que `[]` e ausente são coisas diferentes, e que `ordem` divergente da
 * posição é `400` — não um campo aceito e jogado fora.
 *
 * **O que ele deliberadamente NÃO prova:** par repetido. Duplicata é `409 CONTATO_DUPLICADO`, do banco
 * (critério 4) — pegá-la aqui a transformaria em `400`, que é outro código e outro significado.
 */

const TELEFONE = {
  tipo: "telefone",
  valor: "+5511955217788",
  finalidade: "trabalho",
  temWhatsapp: true,
};

const CADASTRO_VALIDO = { nome: "Sebastião Alves de Moura", papel: "encarregado" };

/** Um vínculo como `GET /vinculos` o projeta. */
function VINCULO(
  pessoaId: string,
  nome: string,
  papel: string,
  extras: Partial<Omit<VinculoProjetado, "pessoa" | "papel">> & {
    contatos?: VinculoProjetado["pessoa"]["contatos"];
  } = {},
): VinculoProjetado {
  const { contatos = [], ...resto } = extras;
  return {
    pessoa: { pessoaId, nome, contatos },
    papel,
    area: null,
    temConta: true,
    criadoEm: "2026-03-02T12:00:00.000Z",
    atualizadoEm: null,
    etiquetas: [],
    ...resto,
  };
}

/** Um pedido pendente, com o que a tabela lê de `PedidoDeEntradaDetalhe`. */
function PEDIDO(
  id: string,
  nome: string,
  criadoEm = "2026-09-14T21:42:00.000Z",
  telefoneInformado: string | null = "+5511988776655",
): PedidoNaTabela {
  return { id, pessoa: { nome, telefoneInformado }, criadoEm };
}

const CONTEXTO = { euPessoaId: "p-helena", impedimentos: {} } as const;

function CONTATO(
  id: string,
  tipo: "telefone" | "email",
  valor: string,
  extras: { finalidade?: string; temWhatsapp?: boolean; observacao?: string | null } = {},
) {
  return {
    id,
    tipo,
    valor,
    finalidade: extras.finalidade ?? "pessoal",
    temWhatsapp: extras.temWhatsapp ?? false,
    ordem: 1,
    observacao: extras.observacao ?? null,
  };
}

describe("contatos — a forma, recusada antes do domínio", () => {
  it("aceita a lista e resolve os opcionais do contrato", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([
      {
        tipo: "email",
        valor: "zelador@exemplo.test",
        finalidade: "pessoal",
        temWhatsapp: false,
        observacao: null,
      },
    ]);
  });

  it("omitir contatos no cadastro vira lista vazia — Pessoa nova sem contato é permitido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse(CADASTRO_VALIDO);

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("telefone fora de E.164 é recusado, e o campo culpado é apontado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "telefone", valor: "(11) 95521-7788" }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "valor"]);
  });

  it("temWhatsapp true num e-mail é recusado — WhatsApp é indicação sobre um NÚMERO", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test", temWhatsapp: true }],
    });

    expect(conferido.success).toBe(false);
  });

  it("e-mail malformado é recusado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador-arroba-exemplo" }],
    });

    expect(conferido.success).toBe(false);
  });

  it("observação vazia vira null — não uma observação em branco", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, observacao: "   " }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos[0]?.observacao).toBeNull();
  });
});

describe("ordem — a posição decide, e a divergente é recusada (decisão 2.1)", () => {
  it("sem ordem nenhuma é o caso BOM — é o corpo natural", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [TELEFONE, { tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que bate com a posição é aceita — o exemplo do contrato continua válido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [
        { ...TELEFONE, ordem: 1 },
        { tipo: "email", valor: "zelador@exemplo.test", ordem: 2 },
      ],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que NÃO bate é 400, no campo — nunca aceita e descartada em silêncio", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 5 }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "ordem"]);
  });

  it("ordem nunca chega à porta — quem a grava é o servidor, pela posição", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 1 }],
    });

    expect(conferido.success).toBe(true);
    expect(Object.hasOwn(conferido.data?.contatos[0] ?? {}, "ordem")).toBe(false);
  });
});

describe("correcaoDeVinculoSchema — ausente e vazio são instruções diferentes", () => {
  it("lista vazia é um valor: remova todos", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ contatos: [] });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("omitir NÃO vira lista vazia — a chave não existe no resultado", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ nome: "Nome novo" });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toBeUndefined();
  });
});

/**
 * ============================================================================
 *  O critério 10.5 — a lista fechada dos `DELETE`
 * ============================================================================
 *
 * **Um critério de aceitação sem nada que o confira é um critério que ninguém confere.** O 10.5 afirma
 * que não há caminho que apague ocorrência, mensagem, categoria nem área — e o custo de conferir isso é
 * uma varredura de doze linhas.
 *
 * **A lista tem dois desde o item 87, e a asserção continua fechada.** O segundo `DELETE` desfaz um
 * compartilhamento, que por decisão não tem histórico: a linha diz quem pode ler a ocorrência hoje, e
 * desfazer é tirar isso. Nenhum dos dois toca as quatro coisas que o 10.5 nomeia. **O que a guarda pega é
 * o terceiro**, que chegaria sem ninguém decidir que ele podia existir.
 *
 * **Quatro desde o item 115.** Os dois novos apagam uma etiqueta e tiram uma etiqueta de uma pessoa: rótulo
 * de gestão, sem trilha, que nenhuma das quatro coisas do 10.5 alcança. A asserção continua fechada.
 *
 * **Não é o mesmo que o portão do contrato:** aquele roda sobre o `openapi.yaml`, e este roda sobre o
 * **código**. O dia em que os dois discordarem é o dia em que alguém escreveu endpoint sem publicar.
 */
describe("os DELETE do produto, e são quatro", () => {
  it("existem exatamente quatro export const DELETE em app/api/, e a lista é a decidida", () => {
    const raiz = fileURLToPath(new URL("../../app/api/", import.meta.url));

    const rotas = readdirSync(raiz, { recursive: true, encoding: "utf8" })
      .filter((caminho) => caminho.endsWith("route.ts"))
      .filter((caminho) => /^export const DELETE\b/mu.test(readFileSync(`${raiz}${caminho}`, "utf8")))
      // O `readdirSync` recursivo devolve separador do sistema; a asserção é sobre o caminho lógico.
      .map((caminho) => caminho.replace(/\\/gu, "/"));

    expect(rotas.sort()).toStrictEqual(
      [
        "etiquetas-de-participante/[etiquetaId]/route.ts",
        "ocorrencias/[ocorrenciaId]/compartilhamentos/[pessoaId]/route.ts",
        "vinculos/[pessoaId]/etiquetas/[etiquetaId]/route.ts",
        "vinculos/[pessoaId]/route.ts",
      ].sort(),
    );
  });
});

/**
 * ============================================================================
 *  As frases da remoção — item 10, a metade conferível da tela
 * ============================================================================
 *
 * **O produto não tem biblioteca de teste de componente React** — `jsdom` está instalado, mas não há
 * `@testing-library`, e o `vitest.config.mts` roda as quatro pastas com `environment: "node"`. Então o
 * que fica dentro do `.tsx` **não tem teste nenhum**, e é por isso que a escolha de frase mora num módulo
 * puro. É o precedente literal de `busca-de-candidatos.ts` e de `vazio-da-lista.ts`.
 */
describe("textoDaConfirmacao — os dois ramos de temConta, e o aviso de auto-remoção", () => {
  it("com conta, a segunda oração é a verbatim do inventário", () => {
    const linhas = textoDaConfirmacao({
      nome: "Helena Rocha",
      temConta: true,
      ehMeuProprioVinculo: false,
    });

    expect(linhas).toStrictEqual([
      "Remover o vínculo de Helena Rocha. O cadastro da pessoa não é apagado, e ela pode pedir entrada de novo.",
    ]);
  });

  /**
   * **O achado A-2 da spec**: *"ela pode pedir entrada de novo"* é **falso** para quem não tem conta.
   * Pedir entrada exige sessão, e a Pessoa criada por `POST /vinculos` nasce sem conta e **nunca passa a
   * ter** — `repositorios/pessoa/index.ts` cria linha nova por usuário e não adota Pessoa nenhuma.
   */
  it("sem conta, a frase diz o que o Gestor precisa fazer — inclusive os contatos", () => {
    const linhas = textoDaConfirmacao({
      nome: "Sebastião Alves",
      temConta: false,
      ehMeuProprioVinculo: false,
    });

    expect(linhas).toStrictEqual([
      "Remover o vínculo de Sebastião Alves. O cadastro da pessoa não é apagado, mas ela não tem conta e não pode pedir entrada: para voltar, precisa ser cadastrada de novo, com os contatos.",
    ]);
  });

  /**
   * **O aviso da §3.8 só aparece sobre o ramo verbatim, e não é coincidência:** quem remove o próprio
   * vínculo está autenticado, então `temConta` é sempre `true` para si mesmo.
   */
  it("no próprio vínculo, uma segunda linha diz o que se perde", () => {
    const linhas = textoDaConfirmacao({
      nome: "Marina Gestora",
      temConta: true,
      ehMeuProprioVinculo: true,
    });

    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe(
      "Este é o seu próprio vínculo. Ao remover, você perde o acesso a esta organização.",
    );
  });
});

describe("razaoDoImpedimento — a razão que o aviso mostra", () => {
  it("a razão do histórico COMEÇA PELO NOME, fala em rastro e enumera as seis famílias — nunca só três", () => {
    const razao = razaoDoImpedimento("Helena Rocha", "historico");

    expect(razao.startsWith("Helena Rocha já deixou rastro nesta organização")).toBe(true);
    expect(razao).toContain("ocorrência, mensagem, atribuição, etiqueta, decisão de entrada ou configuração");
    expect(razao).not.toContain("registrou ocorrências");
  });

  /**
   * **Critério 44j.5.** A frase que explicava o que o produto não fazia saiu da tela. Desde o item 84 o
   * caminho existe, e quem tem rastro recebe a confirmação de encerrar o acesso no lugar do aviso.
   */
  it("a frase do revogar não existe mais no módulo", () => {
    const fonte = readFileSync(
      fileURLToPath(new URL("../../src/interface/componentes/frases-da-remocao.ts", import.meta.url)),
      "utf8",
    );
    expect(fonte).not.toContain("ainda não existe");
  });

  it("a razão do último Gestor é a verbatim do inventário, e não leva nome", () => {
    expect(razaoDoImpedimento("Helena Rocha", "ultimo-gestor")).toBe(
      "Esta é a única pessoa com poder de gestão nesta organização. Removê-la deixaria a organização sem ninguém que possa aprovar entradas.",
    );
  });

  it("o título do aviso é neutro: o produto não sabe o gênero de ninguém", () => {
    expect(tituloDoImpedimento("Beatriz Nunes")).toBe("Beatriz Nunes não pode sair da organização");
    expect(tituloDaConfirmacao("Beatriz Nunes")).toBe("Remover Beatriz Nunes da organização?");
  });
});

describe("textoDaRecusa — o instante entre a tela saber e o Gestor clicar", () => {
  it("os dois 409 reusam a MESMA frase da razão — duas frases para o mesmo fato seriam duas coisas para manter", () => {
    expect(textoDaRecusa({ codigo: "VINCULO_COM_HISTORICO" }, "Helena Rocha")).toBe(
      razaoDoImpedimento("Helena Rocha", "historico"),
    );
    expect(textoDaRecusa({ codigo: "ULTIMO_GESTOR" }, "Helena Rocha")).toBe(
      razaoDoImpedimento("Helena Rocha", "ultimo-gestor"),
    );
  });

  it("o 404 é o caso de dois Gestores removendo o mesmo vínculo", () => {
    expect(textoDaRecusa({ codigo: "VINCULO_NAO_ENCONTRADO" }, "Helena Rocha")).toBe(
      "Este vínculo não existe mais.",
    );
  });

  it("código que a tela não conhece mostra o texto do servidor", () => {
    expect(
      textoDaRecusa({ codigo: "ORGANIZACAO_DIVERGENTE", detail: "A organização mudou em outra aba." }, "Helena Rocha"),
    ).toBe("A organização mudou em outra aba.");
  });

  it("sem código e sem resposta, a frase genérica do produto", () => {
    expect(textoDaRecusa({}, "Helena Rocha")).toBe("Não foi possível realizar a ação.");
    expect(textoDaRecusa(null, "Helena Rocha")).toBe("Não foi possível realizar a ação.");
  });
});

/**
 * ============================================================================
 *  Encerrar o acesso — item 84, a metade conferível da tela
 * ============================================================================
 *
 * O componente não é montável aqui (sem biblioteca de teste de componente), então a decisão mora em
 * funções puras: qual face o clique abre, para qual face a recusa leva, e o que a confirmação diz.
 */
describe("faceInicial — o que o clique em Remover da organização abre", () => {
  it("sem impedimento, a confirmação de remover; com histórico, a de encerrar; último Gestor, o aviso", () => {
    expect(faceInicial(null)).toBe("remover");
    expect(faceInicial("historico")).toBe("encerrar");
    expect(faceInicial("ultimo-gestor")).toBe("aviso");
  });
});

describe("faceDepoisDaRecusa — o 409 que chega entre a tela saber e o Gestor clicar (spec §3.8)", () => {
  it("VINCULO_COM_HISTORICO na confirmação de remover troca para a de encerrar", () => {
    expect(faceDepoisDaRecusa("remover", { codigo: "VINCULO_COM_HISTORICO" })).toBe("encerrar");
  });

  it("as outras recusas não trocam a face", () => {
    expect(faceDepoisDaRecusa("remover", { codigo: "ULTIMO_GESTOR" })).toBe("remover");
    expect(faceDepoisDaRecusa("remover", { codigo: "VINCULO_NAO_ENCONTRADO" })).toBe("remover");
    expect(faceDepoisDaRecusa("remover", null)).toBe("remover");
    expect(faceDepoisDaRecusa("encerrar", { codigo: "ULTIMO_GESTOR" })).toBe("encerrar");
    expect(faceDepoisDaRecusa("encerrar", { codigo: "VINCULO_COM_HISTORICO" })).toBe("encerrar");
  });
});

describe("textoDoEncerramento — o que a confirmação diz", () => {
  const RASTRO =
    "Joana Prado já deixou rastro nesta organização, então o vínculo não é apagado: as ocorrências, as mensagens e o nome na trilha continuam.";

  it("com conta, diz que a pessoa pode pedir entrada de novo", () => {
    expect(
      textoDoEncerramento({ nome: "Joana Prado", temConta: true, ehMeuProprioVinculo: false, responsavelEmAberto: 0 }),
    ).toStrictEqual([`${RASTRO} Joana Prado deixa de entrar na organização, e pode pedir entrada de novo.`]);
  });

  /** O sujeito é *"a pessoa"*, e não o nome: com o nome, *"cadastrada"* suporia gênero (crítica C-5). */
  it("sem conta, diz que é preciso cadastrar de novo, com os contatos — sem supor gênero", () => {
    expect(
      textoDoEncerramento({ nome: "Joana Prado", temConta: false, ehMeuProprioVinculo: false, responsavelEmAberto: 0 }),
    ).toStrictEqual([
      `${RASTRO} Sem conta, a pessoa não pede entrada: para voltar, precisa ser cadastrada de novo, com os contatos.`,
    ]);
  });

  it("com ocorrências em aberto, uma linha diz quantas, no singular e no plural", () => {
    const uma = textoDoEncerramento({ nome: "Joana Prado", temConta: true, ehMeuProprioVinculo: false, responsavelEmAberto: 1 });
    expect(uma[1]).toBe(
      "Joana Prado é responsável por 1 ocorrência em aberto. Ela continua atribuída a Joana Prado até alguém reatribuir.",
    );

    const tres = textoDoEncerramento({ nome: "Joana Prado", temConta: true, ehMeuProprioVinculo: false, responsavelEmAberto: 3 });
    expect(tres[1]).toBe(
      "Joana Prado é responsável por 3 ocorrências em aberto. Elas continuam atribuídas a Joana Prado até alguém reatribuir.",
    );
  });

  it("no próprio vínculo, a última linha diz o que se perde, depois da do responsável", () => {
    const linhas = textoDoEncerramento({ nome: "Marina Gestora", temConta: true, ehMeuProprioVinculo: true, responsavelEmAberto: 2 });
    expect(linhas).toHaveLength(3);
    expect(linhas[2]).toBe("Este é o seu próprio vínculo. Ao encerrar, você perde o acesso a esta organização.");
  });

  it("o título pergunta, e não supõe gênero", () => {
    expect(tituloDoEncerramento("Beatriz Nunes")).toBe("Encerrar o acesso de Beatriz Nunes?");
  });
});

/**
 * ============================================================================
 *  A busca de T-08 — critério 10.6, o reuso literal do item 20
 * ============================================================================
 *
 * **Nenhuma linha de normalização é reescrita.** `termosDaBusca` e `casaPeloNome` recebem `string`, e é
 * o que o módulo do item 20 foi escrito para permitir. Desde o item 44j a busca corre sobre as linhas da
 * tabela única, **pedidos de entrada inclusive**.
 *
 * **Filtra no navegador, não por `?busca=` na URL.** Um `round trip` por tecla contra uma nuvem que
 * escala a zero seria o oposto, e ir para o cliente não vaza nada: tudo o que a propriedade carrega já
 * está desenhado na tela.
 */
describe("filtrarPeloNome — o mesmo casamento do modal do item 20", () => {
  const LISTA = [
    linhaDoVinculo(VINCULO("p1", "Ana Paula Souza", "solicitante"), CONTEXTO),
    linhaDoVinculo(VINCULO("p2", "Mariana Silva", "solicitante"), CONTEXTO),
    linhaDoVinculo(VINCULO("p3", "Sebastião Álvares", "solicitante"), CONTEXTO),
    linhaDoPedido(PEDIDO("q1", "Paulo Mendes")),
  ];
  const chaves = (linhas: readonly LinhaDeParticipante[]) => linhas.map((linha) => linha.chave);

  it("busca em branco devolve a lista inteira, na mesma ordem — filtrar nunca reordena", () => {
    expect(filtrarPeloNome(LISTA, "   ")).toStrictEqual(LISTA);
  });

  it("casa por PREFIXO de palavra, não por pedaço — 'ana' não acha Mariana", () => {
    expect(chaves(filtrarPeloNome(LISTA, "ana"))).toStrictEqual(["vinculo:p1"]);
  });

  it("o sobrenome acha, porque é como se procura gente", () => {
    expect(chaves(filtrarPeloNome(LISTA, "silva"))).toStrictEqual(["vinculo:p2"]);
  });

  it("sem acento e sem caixa — quem digita no celular não põe acento", () => {
    expect(chaves(filtrarPeloNome(LISTA, "SEBASTIAO"))).toStrictEqual(["vinculo:p3"]);
  });

  it("todos os termos precisam casar — 'mari sil' acha Mariana Silva e mais ninguém", () => {
    expect(chaves(filtrarPeloNome(LISTA, "mari sil"))).toStrictEqual(["vinculo:p2"]);
  });

  it("não casa papel nem unidade — o critério diz pelo NOME", () => {
    expect(filtrarPeloNome(LISTA, "solicitante")).toStrictEqual([]);
  });

  it("alcança o pedido de entrada, porque a tabela é uma só (item 44j)", () => {
    expect(chaves(filtrarPeloNome(LISTA, "paulo"))).toStrictEqual(["pedido:q1"]);
  });
});

/**
 * ============================================================================
 *  Item 44j — a ordem manual, o telefone legível e as frases de T-08
 * ============================================================================
 *
 * **O que decide mora em função pura**, no precedente do 44g, do 44h e do 44i: o projeto não tem
 * biblioteca de teste de componente, e a tabela, os dois modais e as páginas próprias só desenham o que
 * estas funções escolhem.
 */
describe("a ordem manual — as regras que o 44k também usa", () => {
  const LISTA = ["a", "b", "c"];

  it("mover leva o item à posição final, nos dois sentidos, sem mudar a lista de entrada", () => {
    expect(moverItem(LISTA, 0, 2)).toStrictEqual(["b", "c", "a"]);
    expect(moverItem(LISTA, 2, 0)).toStrictEqual(["c", "a", "b"]);
    expect(moverItem(LISTA, 1, 2)).toStrictEqual(["a", "c", "b"]);
    expect(LISTA).toStrictEqual(["a", "b", "c"]);
  });

  it("mover para a mesma posição, ou de fora da lista, devolve a mesma lista", () => {
    expect(moverItem(LISTA, 1, 1)).toBe(LISTA);
    expect(moverItem(LISTA, -1, 0)).toBe(LISTA);
    expect(moverItem(LISTA, 0, 3)).toBe(LISTA);
    expect(moverItem(LISTA, 0.5, 1)).toBe(LISTA);
  });

  it("o vão é o de cima na metade de cima, e o de baixo na metade de baixo", () => {
    expect(vaoDoArrasto(1, false)).toBe(1);
    expect(vaoDoArrasto(1, true)).toBe(2);
  });

  it("o vão abaixo da própria linha conta uma casa a menos", () => {
    expect(destinoDoVao(0, 2)).toBe(1);
    expect(destinoDoVao(0, 3)).toBe(2);
    expect(destinoDoVao(2, 0)).toBe(0);
    expect(destinoDoVao(1, 1)).toBe(1);
    expect(destinoDoVao(1, 2)).toBe(1);
  });

  it("soltar sobre uma linha dá a posição final, e nos dois vãos vizinhos não move", () => {
    expect(destinoDoArrasto(0, 2, true)).toBe(2);
    expect(destinoDoArrasto(0, 2, false)).toBe(1);
    expect(destinoDoArrasto(2, 0, false)).toBe(0);
    expect(destinoDoArrasto(2, 0, true)).toBe(1);
    expect(destinoDoArrasto(0, 0, true)).toBe(0);
    expect(destinoDoArrasto(0, 1, false)).toBe(0);
    expect(destinoDoArrasto(2, 2, false)).toBe(2);
    expect(destinoDoArrasto(2, 2, true)).toBe(2);
  });

  it("o anúncio diz a posição que a pessoa lê, a partir de um", () => {
    expect(anuncioDeMovimento(1, 3)).toBe("Movido para a posição 1 de 3.");
  });
});

describe("o telefone legível — a tabela, o modal e a edição", () => {
  it("o número brasileiro sai com DDD entre parênteses, celular e fixo", () => {
    expect(telefoneLegivel("+5511988776655")).toBe("(11) 98877-6655");
    expect(telefoneLegivel("+551134567788")).toBe("(11) 3456-7788");
  });

  it("o número de fora sai como veio, em vez de mutilado", () => {
    expect(telefoneLegivel("+14155552671")).toBe("+14155552671");
  });

  it("no campo, o gravado aparece com o país, e volta ao mesmo E.164", () => {
    expect(telefoneNoCampo("+5511981234567")).toBe("+55 (11) 98123-4567");
    expect(telefoneNoCampo("+14155552671")).toBe("+14155552671");
    expect(converterTelefoneDigitado(telefoneNoCampo("+5511981234567"))).toStrictEqual({
      situacao: "convertido",
      valor: "+5511981234567",
    });
  });
});

describe("as frases de T-08 — papéis, datas e o fato", () => {
  it("os três papéis, com a consequência escrita e o alerta só no Encarregado", () => {
    expect(PAPEIS.map((opcao) => [opcao.papel, opcao.rotulo, opcao.alerta])).toStrictEqual([
      ["solicitante", "Solicitante", null],
      ["gestor", "Gestor", null],
      ["encarregado", "Encarregado", "Não consegue fazer nada dentro do sistema."],
    ]);
  });

  it("o rótulo do papel, e o valor desconhecido sai como veio", () => {
    expect(rotuloDoPapel("gestor")).toBe("Gestor");
    expect(rotuloDoPapel("zelador")).toBe("zelador");
    expect(papelDoValor("encarregado")).toBe("encarregado");
    expect(papelDoValor("")).toBeNull();
  });

  it("o primeiro nome é a primeira palavra, aparada", () => {
    expect(primeiroNome("  Paulo Mendes ")).toBe("Paulo");
    expect(primeiroNome("Beatriz")).toBe("Beatriz");
    expect(primeiroNome("")).toBe("");
  });

  it("as datas saem no fuso de São Paulo, e não no do servidor", () => {
    expect(dataCurta("2026-03-02T12:00:00.000Z")).toBe("02/03/2026");
    expect(dataCurta("2026-09-14T02:30:00.000Z")).toBe("13/09/2026");
    expect(dataEHora("2026-09-14T21:42:00.000Z")).toBe("14/09/2026 · 18:42");
    expect(dataEHora("2026-09-15T03:00:00.000Z")).toBe("15/09/2026 · 00:00");
  });

  it("o fato do cabeçalho, no singular, no plural e sem pedido", () => {
    expect(fraseDoFato(5, 1)).toBe("5 participantes e 1 pedido de entrada aguardando decisão.");
    expect(fraseDoFato(1, 3)).toBe("1 participante e 3 pedidos de entrada aguardando decisão.");
    expect(fraseDoFato(6, 0)).toBe("6 participantes. Nenhum pedido de entrada aguardando.");
  });

  it("o fato da edição traz a entrada, e a última atualização quando ela existe", () => {
    expect(fraseDoFatoDeEdicao("Paulo Mendes", "solicitante", "2026-09-16T15:00:00.000Z", null)).toBe(
      "Paulo Mendes, Solicitante desde 16/09/2026.",
    );
    expect(
      fraseDoFatoDeEdicao(
        "Helena Rocha",
        "gestor",
        "2026-03-12T15:00:00.000Z",
        "2026-09-24T15:00:00.000Z",
      ),
    ).toBe("Helena Rocha, Gestor desde 12/03/2026. Última atualização em 24/09/2026.");
  });

  it("os segmentos põem as duas datas em mono, e o resto não", () => {
    const segmentos = fatoDeEdicao(
      "Helena Rocha",
      "gestor",
      "2026-03-12T15:00:00.000Z",
      "2026-09-24T15:00:00.000Z",
    );
    expect(segmentos.filter((segmento) => segmento.mono).map((segmento) => segmento.texto)).toStrictEqual(
      ["12/03/2026", "24/09/2026"],
    );
    expect(new Set(segmentos.map((segmento) => segmento.chave)).size).toBe(segmentos.length);
  });

  it("o rótulo da coluna e o prefixo da pauta dizem atualização, e desde saiu", () => {
    expect(TEXTOS_DA_TABELA.atualizacao).toBe("Última atualização");
    expect(TEXTOS_DA_TABELA.atualizadoEm).toBe("Atualizado em");
    expect(TEXTOS_DA_TABELA).not.toHaveProperty("desde");
  });

  it("o nome do botão de contato diz o tipo, o número e de quem é", () => {
    expect(rotuloDoContato("telefone", 1, "Ana Lima")).toBe("Telefone de Ana Lima");
    expect(rotuloDoContato("telefone", 2, "Ana Lima")).toBe("Telefones de Ana Lima");
    expect(rotuloDoContato("email", 1, "Ana Lima")).toBe("E-mail de Ana Lima");
    expect(rotuloDoContato("email", 3, "Ana Lima")).toBe("E-mails de Ana Lima");
  });
});

describe("responder um pedido — o botão diz o papel (critérios 6 e 7)", () => {
  it("sem papel, o principal diz só Aprovar; com papel, diz qual", () => {
    expect(rotuloDeAprovar(null)).toBe("Aprovar");
    expect(rotuloDeAprovar("encarregado")).toBe("Aprovar como Encarregado");
  });

  it("a mensagem do papel chama a pessoa pelo primeiro nome", () => {
    expect(erroDoPapelNaResposta("Paulo Mendes")).toBe("Escolha o papel com que Paulo entra.");
  });

  it("o aviso do Encarregado e a recusa não supõem gênero", () => {
    const aviso = avisoDoEncarregado("Paulo Mendes");
    expect(aviso.destaque).toBe("Paulo não vai conseguir fazer nada dentro do sistema.");
    expect(aviso.resto).toBe(
      "Aparece como responsável e recebe o trabalho fora do aplicativo. O papel não muda depois: para corrigir, é preciso remover o vínculo e pedir entrada de novo.",
    );
    expect(tituloDaRecusa("Paulo Mendes")).toBe("Recusar o pedido de Paulo Mendes?");
    expect(descricaoDaRecusa("Paulo Mendes")).toBe("Paulo pode pedir entrada de novo quando quiser.");
    for (const texto of [aviso.destaque, aviso.resto, descricaoDaRecusa("Paulo Mendes")]) {
      expect(texto).not.toMatch(/\b(?:Ele|Ela|dele|dela)\b|removê-l/u);
    }
  });

  it("a descrição do modal traz a data e a hora", () => {
    expect(descricaoDoPedido("2026-09-14T21:42:00.000Z")).toBe("Pedido feito em 14/09/2026 · 18:42.");
  });
});

describe("os avisos de T-08 — o desfecho por endereço vira aviso (critério 10)", () => {
  it("os cinco sucessos, sem pronome", () => {
    expect(avisoDeAprovado("Paulo Mendes", "solicitante", "Apartamento 302")).toStrictEqual({
      titulo: "Paulo Mendes entrou como Solicitante",
      descricao: "Na unidade Apartamento 302.",
    });
    expect(avisoDeAprovado("Paulo Mendes", "gestor", null)).toStrictEqual({
      titulo: "Paulo Mendes entrou como Gestor",
      descricao: "Sem unidade registrada.",
    });
    expect(avisoDeRecusado("Paulo Mendes")).toStrictEqual({
      titulo: "Pedido de Paulo Mendes recusado",
      descricao: "Pode pedir entrada de novo quando quiser.",
    });
    expect(avisoDeRemovido("Beatriz Nunes")).toStrictEqual({
      titulo: "Vínculo de Beatriz Nunes removido",
      descricao: "O cadastro da pessoa não é apagado.",
    });
    expect(avisoDeAcessoEncerrado("Beatriz Nunes")).toStrictEqual({
      titulo: "O acesso de Beatriz Nunes foi encerrado",
      descricao: "As ocorrências e o nome na trilha continuam.",
    });
    expect(avisoDeCadastrado("Sérgio Lima", "encarregado")).toStrictEqual({
      titulo: "Sérgio Lima entrou como Encarregado",
      descricao: "Sem conta: recebe atribuições e aparece como responsável.",
    });
    expect(avisoDeSalvo("Sérgio Lima")).toStrictEqual({ titulo: "Dados de Sérgio Lima salvos" });
  });

  it("as seis falhas dizem o que foi tentado", () => {
    expect(FALHA).toStrictEqual({
      aprovar: "Não foi possível aprovar o pedido",
      recusar: "Não foi possível recusar o pedido",
      remover: "Não foi possível remover o vínculo",
      encerrar: "Não foi possível encerrar o acesso",
      cadastrar: "Não foi possível cadastrar a pessoa",
      salvar: "Não foi possível salvar os dados",
    });
  });
});

describe("as linhas da tabela única (critério 1)", () => {
  it("o pedido vira linha com o papel a decidir e o telefone informado, legível e sem finalidade", () => {
    const linha = linhaDoPedido(PEDIDO("q1", "Paulo Mendes"));
    expect(linha).toMatchObject({
      tipo: "pedido",
      chave: "pedido:q1",
      nome: "Paulo Mendes",
      rotuloDoPapel: "a decidir",
      unidade: null,
      telefones: [{ chave: "telefone-informado", valor: "(11) 98877-6655", finalidade: null, whatsapp: false }],
      emails: [],
    });
  });

  it("o pedido sem telefone informado não tem contato nenhum", () => {
    expect(linhaDoPedido(PEDIDO("q2", "Sem Telefone", undefined, null))).toMatchObject({ telefones: [], emails: [] });
  });

  it("o vínculo separa os contatos por tipo, na ordem cadastrada, com finalidade e WhatsApp", () => {
    const linha = linhaDoVinculo(
      VINCULO("p1", "Cláudia Meireles", "solicitante", {
        area: { id: "a1", nome: "Apartamento 101" },
        temConta: false,
        contatos: [
          CONTATO("c1", "telefone", "+5511998124410", { temWhatsapp: true }),
          CONTATO("c2", "email", "claudia@example.com", { finalidade: "trabalho" }),
          CONTATO("c3", "telefone", "+5511333344444", { finalidade: "recado" }),
        ],
      }),
      CONTEXTO,
    );
    expect(linha).toMatchObject({
      tipo: "vinculo",
      chave: "vinculo:p1",
      rotuloDoPapel: "Solicitante",
      unidade: "Apartamento 101",
      ehVoce: false,
      impedimento: null,
    });
    expect(linha.telefones).toStrictEqual([
      { chave: "c1", valor: "(11) 99812-4410", finalidade: "Pessoal", whatsapp: true },
      { chave: "c3", valor: expect.any(String), finalidade: "Recado", whatsapp: false },
    ]);
    expect(linha.emails).toStrictEqual([
      { chave: "c2", valor: "claudia@example.com", finalidade: "Trabalho", whatsapp: false },
    ]);
  });

  it("dois telefones e nenhum e-mail: um tipo só, os dois nele; sem contato, as duas listas vazias", () => {
    const doisTelefones = linhaDoVinculo(
      VINCULO("p2", "Jorge Tavares", "solicitante", {
        contatos: [CONTATO("c1", "telefone", "+5511998124410"), CONTATO("c2", "telefone", "+5511977776666")],
      }),
      CONTEXTO,
    );
    expect(doisTelefones.telefones.map((contato) => contato.chave)).toStrictEqual(["c1", "c2"]);
    expect(doisTelefones.emails).toStrictEqual([]);
    expect(linhaDoVinculo(VINCULO("p9", "Sem Contato", "gestor"), CONTEXTO)).toMatchObject({
      telefones: [],
      emails: [],
    });
  });

  it("a própria linha é marcada, e o impedimento vem do mapa", () => {
    const linha = linhaDoVinculo(VINCULO("p-helena", "Helena Rocha", "gestor"), {
      euPessoaId: "p-helena",
      impedimentos: { "p-helena": "ultimo-gestor" },
    });
    expect(linha).toMatchObject({ ehVoce: true, impedimento: "ultimo-gestor" });
  });

  it("a linha do vínculo traz o instante e o texto da última atualização", () => {
    const linha = linhaDoVinculo(
      VINCULO("p9", "Helena Rocha", "gestor", { atualizadoEm: "2026-09-24T12:00:00.000Z" }),
      CONTEXTO,
    );
    expect(linha.atualizadoEm).toBe("2026-09-24T12:00:00.000Z");
    expect(linha.atualizadoTexto).toBe("24/09/2026");
  });

  it("sem alteração registrada, os dois campos ficam nulos e a célula decide o traço", () => {
    const linha = linhaDoVinculo(VINCULO("p10", "Sem Alteração", "solicitante"), CONTEXTO);
    expect(linha.atualizadoEm).toBeNull();
    expect(linha.atualizadoTexto).toBeNull();
  });

  it("o pedido de entrada nunca tem última atualização: pedido pendente não foi alterado", () => {
    const linha = linhaDoPedido(PEDIDO("q9", "Paulo Mendes"));
    expect(linha.atualizadoEm).toBeNull();
    expect(linha.atualizadoTexto).toBeNull();
  });

  it("a tabela junta pedidos e vínculos", () => {
    const linhas = montarLinhas({
      pedidos: [PEDIDO("q1", "Paulo Mendes")],
      vinculos: [VINCULO("p1", "Ana", "gestor")],
      ...CONTEXTO,
    });
    expect(linhas.map((linha) => linha.chave)).toStrictEqual(["pedido:q1", "vinculo:p1"]);
  });
});

describe("o filtro rápido (critério 2)", () => {
  const LINHAS = montarLinhas({
    pedidos: [PEDIDO("q1", "Paulo Mendes")],
    vinculos: [
      VINCULO("p1", "Beatriz Nunes", "encarregado"),
      VINCULO("p2", "Cláudia Meireles", "solicitante"),
      VINCULO("p-helena", "Helena Rocha", "gestor"),
      VINCULO("p3", "Jorge Tavares", "solicitante"),
      VINCULO("p4", "Rafael Antunes", "encarregado"),
    ],
    ...CONTEXTO,
  });

  it("as contagens do conjunto inteiro, e Todos soma os pedidos", () => {
    expect(contagensDoFiltro(LINHAS)).toStrictEqual({
      todos: 6,
      pedidos: 1,
      solicitantes: 2,
      gestores: 1,
      encarregados: 2,
    });
  });

  it("cada opção separa o que é dela", () => {
    const nomes = (filtro: Filtro) =>
      LINHAS.filter((linha) => pertenceAoFiltro(linha, filtro)).map((linha) => linha.nome);
    expect(nomes("pedidos")).toStrictEqual(["Paulo Mendes"]);
    expect(nomes("gestores")).toStrictEqual(["Helena Rocha"]);
    expect(nomes("encarregados")).toStrictEqual(["Beatriz Nunes", "Rafael Antunes"]);
    expect(nomes("todos")).toHaveLength(6);
  });

  it("os vazios das opções, e o de Todos existe só para não ter ramo sem texto", () => {
    expect(VAZIO_DO_FILTRO.pedidos).toStrictEqual({
      titulo: "Nenhum pedido de entrada aguardando.",
      corpo: "Os pedidos aparecem aqui quando alguém usa o código da organização.",
    });
    expect(VAZIO_DO_FILTRO.solicitantes.titulo).toBe("Nenhum Solicitante nesta organização.");
    expect(VAZIO_DO_FILTRO.gestores.titulo).toBe("Nenhum Gestor nesta organização.");
    expect(VAZIO_DO_FILTRO.encarregados.titulo).toBe("Nenhum Encarregado nesta organização.");
    // Inalcançável pela tela: toda organização tem ao menos o Gestor que a criou (D26), e o
    // `409 ULTIMO_GESTOR` impede que ele saia. Com um vínculo, Todos conta ao menos um.
    expect(VAZIO_DO_FILTRO.todos.titulo).toBe("Ninguém nesta organização.");
    const soOGestor = montarLinhas({ pedidos: [], vinculos: [VINCULO("p", "G", "gestor")], ...CONTEXTO });
    expect(contagensDoFiltro(soOGestor).todos).toBe(1);
  });
});

describe("a ordem por coluna (critério 3)", () => {
  const nomes = (linhas: readonly LinhaDeParticipante[]) => linhas.map((linha) => linha.nome);
  const V = (pessoaId: string, nome: string, papel: string, extras: Parameters<typeof VINCULO>[3] = {}) =>
    linhaDoVinculo(VINCULO(pessoaId, nome, papel, extras), CONTEXTO);

  it("Pessoa, sem distinguir caixa nem acento, nos dois sentidos", () => {
    const linhas = [V("1", "Bruno", "gestor"), V("2", "ana", "gestor"), V("3", "Álvaro", "gestor")];
    expect(nomes(ordenarLinhas(linhas, "pessoa", "crescente"))).toStrictEqual(["Álvaro", "ana", "Bruno"]);
    expect(nomes(ordenarLinhas(linhas, "pessoa", "decrescente"))).toStrictEqual(["Bruno", "ana", "Álvaro"]);
  });

  it("Papel pelo rótulo, e o empate pelo nome", () => {
    const linhas = [V("1", "Zé", "solicitante"), V("2", "Bia", "gestor"), V("3", "Ana", "solicitante")];
    expect(nomes(ordenarLinhas(linhas, "papel", "crescente"))).toStrictEqual(["Bia", "Ana", "Zé"]);
    expect(nomes(ordenarLinhas(linhas, "papel", "decrescente"))).toStrictEqual(["Ana", "Zé", "Bia"]);
  });

  it("Unidade pelo nome, e sem unidade sempre no fim, nos dois sentidos", () => {
    const linhas = [
      V("1", "Sem", "solicitante"),
      V("2", "Trezentos", "solicitante", { area: { id: "a2", nome: "Apartamento 302" } }),
      V("3", "Cento", "solicitante", { area: { id: "a1", nome: "Apartamento 101" } }),
    ];
    expect(nomes(ordenarLinhas(linhas, "unidade", "crescente"))).toStrictEqual(["Cento", "Trezentos", "Sem"]);
    expect(nomes(ordenarLinhas(linhas, "unidade", "decrescente"))).toStrictEqual(["Trezentos", "Cento", "Sem"]);
  });

  it("Última atualização pelo instante, e o empate pelo nome", () => {
    const linhas = [
      V("1", "Novo", "gestor", { atualizadoEm: "2026-09-10T12:00:00.000Z" }),
      V("2", "Velho", "gestor", { atualizadoEm: "2026-01-10T12:00:00.000Z" }),
      V("3", "Antigo", "gestor", { atualizadoEm: "2026-01-10T12:00:00.000Z" }),
    ];
    expect(nomes(ordenarLinhas(linhas, "atualizacao", "crescente"))).toStrictEqual(["Antigo", "Velho", "Novo"]);
    expect(nomes(ordenarLinhas(linhas, "atualizacao", "decrescente"))).toStrictEqual(["Novo", "Antigo", "Velho"]);
  });

  it("o último empate é a chave, e a ordem não depende da entrada", () => {
    const a = V("p2", "Ana", "gestor");
    const b = V("p1", "Ana", "gestor");
    const chaves = (linhas: readonly LinhaDeParticipante[]) => linhas.map((linha) => linha.chave);
    expect(chaves(ordenarLinhas([a, b], "pessoa", "crescente"))).toStrictEqual(["vinculo:p1", "vinculo:p2"]);
    expect(chaves(ordenarLinhas([b, a], "pessoa", "decrescente"))).toStrictEqual(["vinculo:p1", "vinculo:p2"]);
  });

  it("com ordenação escolhida, o pedido não tem lugar reservado", () => {
    const pedido = linhaDoPedido(PEDIDO("q1", "Zuleica"));
    const vinculo = V("1", "Ana", "gestor", { atualizadoEm: "2026-01-01T12:00:00.000Z" });
    expect(nomes(ordenarLinhas([pedido, vinculo], "pessoa", "crescente"))).toStrictEqual(["Ana", "Zuleica"]);
    // Em Última atualização o pedido é nulo, e nulo vai para o fim nos dois sentidos.
    expect(nomes(ordenarLinhas([pedido, vinculo], "atualizacao", "crescente"))).toStrictEqual(["Ana", "Zuleica"]);
    // Em Papel o pedido ordena pelo que a coluna mostra, "a decidir", antes de "Gestor".
    expect(nomes(ordenarLinhas([vinculo, pedido], "papel", "crescente"))).toStrictEqual(["Zuleica", "Ana"]);
    // Em Unidade o pedido não tem unidade, e vai para o fim nos dois sentidos.
    const comUnidade = V("2", "Bia", "solicitante", { area: { id: "a1", nome: "Apartamento 101" } });
    expect(nomes(ordenarLinhas([pedido, comUnidade], "unidade", "decrescente"))).toStrictEqual(["Bia", "Zuleica"]);
  });

  it("sem ordenação: pedidos no topo pela entrada mais recente, depois vínculos pela entrada mais recente", () => {
    const linhas = [
      V("1", "Velho", "gestor", { criadoEm: "2026-01-10T12:00:00.000Z" }),
      linhaDoPedido(PEDIDO("q-antigo", "Pedido Antigo", "2026-09-01T12:00:00.000Z")),
      V("2", "Novo", "solicitante", { criadoEm: "2026-09-10T12:00:00.000Z" }),
      linhaDoPedido(PEDIDO("q-recente", "Pedido Recente", "2026-09-20T12:00:00.000Z")),
    ];
    expect(nomes(ordenarLinhas(linhas, null, "crescente"))).toStrictEqual([
      "Pedido Recente",
      "Pedido Antigo",
      "Novo",
      "Velho",
    ]);
  });

  it("ordenar por atualização põe nulo no fim, nos dois sentidos", () => {
    const comData = linhaDoVinculo(
      VINCULO("p1", "Com Data", "solicitante", { atualizadoEm: "2026-05-01T12:00:00.000Z" }),
      CONTEXTO,
    );
    const maisNova = linhaDoVinculo(
      VINCULO("p2", "Mais Nova", "solicitante", { atualizadoEm: "2026-07-01T12:00:00.000Z" }),
      CONTEXTO,
    );
    const semData = linhaDoVinculo(VINCULO("p3", "Sem Data", "solicitante"), CONTEXTO);
    const linhas = [semData, maisNova, comData];

    expect(nomes(ordenarLinhas(linhas, "atualizacao", "crescente"))).toStrictEqual([
      "Com Data",
      "Mais Nova",
      "Sem Data",
    ]);
    expect(nomes(ordenarLinhas(linhas, "atualizacao", "decrescente"))).toStrictEqual([
      "Mais Nova",
      "Com Data",
      "Sem Data",
    ]);
  });

  it("duas linhas sem alteração empatam pelo nome, e a ordem não oscila", () => {
    const zuleica = linhaDoVinculo(VINCULO("p1", "Zuleica", "solicitante"), CONTEXTO);
    const ana = linhaDoVinculo(VINCULO("p2", "Ana", "solicitante"), CONTEXTO);
    expect(nomes(ordenarLinhas([zuleica, ana], "atualizacao", "crescente"))).toStrictEqual([
      "Ana",
      "Zuleica",
    ]);
    expect(nomes(ordenarLinhas([zuleica, ana], "atualizacao", "decrescente"))).toStrictEqual([
      "Ana",
      "Zuleica",
    ]);
  });

  it("sem ordenação, o vínculo alterado sobe pela alteração e o não alterado fica pela entrada", () => {
    const antigoAlterado = linhaDoVinculo(
      VINCULO("p1", "Antigo Alterado", "solicitante", {
        criadoEm: "2026-01-01T12:00:00.000Z",
        atualizadoEm: "2026-09-20T12:00:00.000Z",
      }),
      CONTEXTO,
    );
    const novoIntocado = linhaDoVinculo(
      VINCULO("p2", "Novo Intocado", "solicitante", { criadoEm: "2026-06-01T12:00:00.000Z" }),
      CONTEXTO,
    );
    expect(nomes(ordenarLinhas([novoIntocado, antigoAlterado], null, "crescente"))).toStrictEqual([
      "Antigo Alterado",
      "Novo Intocado",
    ]);
  });

  it("sem ordenação, o empate de entrada é pelo nome e depois pela chave, e não depende da entrada", () => {
    const mesmoDia = { criadoEm: "2026-05-05T12:00:00.000Z" };
    const b = V("p2", "Ana", "gestor", mesmoDia);
    const a = V("p1", "Ana", "gestor", mesmoDia);
    const c = V("p3", "Bruno", "gestor", mesmoDia);
    const chaves = (linhas: readonly LinhaDeParticipante[]) => linhas.map((linha) => linha.chave);
    const esperado = ["vinculo:p1", "vinculo:p2", "vinculo:p3"];
    expect(chaves(ordenarLinhas([c, b, a], null, "crescente"))).toStrictEqual(esperado);
    expect(chaves(ordenarLinhas([a, c, b], null, "crescente"))).toStrictEqual(esperado);
  });
});

describe("a ordenação em três estados — a regra que o 67 também usa", () => {
  type C = "a" | "b";
  const CRESC_A: Ordenacao<C> = { ordem: "a", sentido: "crescente" };
  const DECRESC_A: Ordenacao<C> = { ordem: "a", sentido: "decrescente" };

  it("na mesma coluna: sem ordem, crescente, decrescente, e volta a sem ordem", () => {
    const primeiro = proximaOrdenacao<C>(SEM_ORDENACAO, "a");
    expect(primeiro).toStrictEqual(CRESC_A);
    const segundo = proximaOrdenacao(primeiro, "a");
    expect(segundo).toStrictEqual(DECRESC_A);
    expect(proximaOrdenacao(segundo, "a")).toStrictEqual(SEM_ORDENACAO);
  });

  it("em outra coluna começa crescente, venha de onde vier", () => {
    const CRESC_B = { ordem: "b", sentido: "crescente" };
    expect(proximaOrdenacao<C>(SEM_ORDENACAO, "b")).toStrictEqual(CRESC_B);
    expect(proximaOrdenacao(CRESC_A, "b")).toStrictEqual(CRESC_B);
    expect(proximaOrdenacao(DECRESC_A, "b")).toStrictEqual(CRESC_B);
  });

  it("aria-sort e o rótulo dizem o estado e o próximo clique", () => {
    expect(ariaSortDa<C>(SEM_ORDENACAO, "a")).toBe("none");
    expect(ariaSortDa(CRESC_A, "a")).toBe("ascending");
    expect(ariaSortDa(DECRESC_A, "a")).toBe("descending");
    expect(ariaSortDa(DECRESC_A, "b")).toBe("none");
    expect(rotuloDoCabecalho<C>(SEM_ORDENACAO, "a", "Pessoa")).toBe("Ordenar por Pessoa");
    expect(rotuloDoCabecalho(CRESC_A, "a", "Pessoa")).toBe("Inverter a ordem de Pessoa");
    expect(rotuloDoCabecalho(DECRESC_A, "a", "Pessoa")).toBe("Tirar a ordenação de Pessoa");
    expect(rotuloDoCabecalho(DECRESC_A, "b", "Papel")).toBe("Ordenar por Papel");
  });

  it("lê do endereço: sem ordem é sem ordenação, e sentido sozinho não vale", () => {
    const ler = (consulta: string) => lerOrdenacao<C>(new URLSearchParams(consulta), ["a", "b"]);
    expect(ler("")).toStrictEqual(SEM_ORDENACAO);
    expect(ler("sentido=decrescente")).toStrictEqual(SEM_ORDENACAO);
    expect(ler("ordem=cor&sentido=decrescente")).toStrictEqual(SEM_ORDENACAO);
    expect(ler("ordem=a")).toStrictEqual(CRESC_A);
    expect(ler("ordem=a&sentido=decrescente")).toStrictEqual(DECRESC_A);
    expect(ler("ordem=a&sentido=cima")).toStrictEqual(CRESC_A);
  });

  it("escreve a coluna sempre que há ordem, e o sentido só quando decrescente", () => {
    const escrever = (ordenacao: Ordenacao<C>) => {
      const consulta = new URLSearchParams();
      escreverOrdenacao(consulta, ordenacao);
      return consulta.toString();
    };
    expect(escrever(SEM_ORDENACAO)).toBe("");
    expect(escrever(CRESC_A)).toBe("ordem=a");
    expect(escrever(DECRESC_A)).toBe("ordem=a&sentido=decrescente");
  });
});

describe("a paginação de vinte (critério 3)", () => {
  const ITENS = Array.from({ length: 43 }, (_, indice) => indice + 1);

  it("vinte por página, e a faixa diz de onde a onde", () => {
    const primeira = paginar(ITENS, 1);
    expect(primeira).toMatchObject({ pagina: 1, totalDePaginas: 3, total: 43, inicio: 1, fim: 20 });
    expect(primeira.itens).toHaveLength(20);
    expect(faixaDaPagina(primeira)).toBe("1–20 de 43");
    expect(faixaDaPagina(paginar(ITENS, 3))).toBe("41–43 de 43");
  });

  it("uma página só também tem faixa", () => {
    expect(faixaDaPagina(paginar(ITENS.slice(0, 6), 1))).toBe("1–6 de 6");
    expect(paginar([], 1)).toMatchObject({ totalDePaginas: 1, inicio: 0, fim: 0, total: 0 });
  });

  it("além do fim, nenhuma linha e zero na faixa", () => {
    const alem = paginar(ITENS, 9);
    expect(alem.itens).toStrictEqual([]);
    expect(faixaDaPagina(alem)).toBe("0 de 43");
  });
});

describe("o filtro por etiqueta (critério 5; respostas.md P1)", () => {
  const ETIQUETAS = [
    { id: "e1", nome: "Eletricista" },
    { id: "e2", nome: "Pintor" },
  ];

  it("o endereço guarda a etiqueta, e o padrão não aparece", () => {
    const endereco = lerEndereco(new URLSearchParams("etiqueta=e1&pagina=3"));
    expect(endereco.etiqueta).toBe("e1");
    expect(escreverEndereco(comEtiqueta(endereco, null))).toBe("");
    expect(escreverEndereco(comEtiqueta(ENDERECO_PADRAO, "e2"))).toBe("etiqueta=e2");
  });

  it("escolher etiqueta volta à primeira página", () => {
    expect(comEtiqueta({ ...ENDERECO_PADRAO, pagina: 4 }, "e1").pagina).toBe(1);
  });

  it("id que não existe mais vale Todas", () => {
    expect(etiquetaVigente("apagada", ETIQUETAS)).toBeNull();
    expect(etiquetaVigente("e2", ETIQUETAS)).toBe("e2");
  });

  const COM_ETIQUETA = montarLinhas({
    pedidos: [PEDIDO("q1", "Paulo Mendes")],
    vinculos: [
      VINCULO("p1", "Beatriz Nunes", "encarregado", { etiquetas: [ETIQUETAS[0]!] }),
      VINCULO("p2", "Cláudia Meireles", "solicitante"),
    ],
    ...CONTEXTO,
  });

  it("sem etiqueta toda linha pertence; com uma, só o vínculo que a tem; pedido nunca", () => {
    expect(COM_ETIQUETA.every((linha) => pertenceAEtiqueta(linha, null))).toBe(true);
    expect(COM_ETIQUETA.filter((linha) => pertenceAEtiqueta(linha, "e1")).map((linha) => linha.chave)).toStrictEqual([
      "vinculo:p1",
    ]);
    const pedido = COM_ETIQUETA.find((linha) => linha.tipo === "pedido")!;
    expect(pertenceAEtiqueta(pedido, "e1")).toBe(false);
  });

  it("as contagens são do conjunto inteiro, e etiqueta sem uso conta zero", () => {
    expect(contagensDeEtiquetas(COM_ETIQUETA, ETIQUETAS)).toStrictEqual({ todas: 3, e1: 1, e2: 0 });
  });
});

describe("o endereço guarda filtro, ordem e página (critério 3)", () => {
  const ler = (consulta: string) => lerEndereco(new URLSearchParams(consulta));

  it("sem nada, o padrão: Todos, sem ordenação, primeira página", () => {
    expect(ler("")).toStrictEqual(ENDERECO_PADRAO);
    expect(ENDERECO_PADRAO).toStrictEqual({
      filtro: "todos",
      ordem: null,
      sentido: "crescente",
      pagina: 1,
      etiqueta: null,
    });
    // Um endereço guardado só com o sentido abre na ordem inicial.
    expect(ler("sentido=decrescente")).toStrictEqual(ENDERECO_PADRAO);
  });

  it("lê os quatro quando são válidos", () => {
    expect(ler("filtro=gestores&ordem=atualizacao&sentido=decrescente&pagina=2")).toStrictEqual({
      filtro: "gestores",
      ordem: "atualizacao",
      sentido: "decrescente",
      pagina: 2,
      etiqueta: null,
    });
  });

  it("valor desconhecido vale o padrão, sem erro", () => {
    expect(ler("filtro=xyz&ordem=cor&sentido=cima&pagina=abc")).toStrictEqual(ENDERECO_PADRAO);
    for (const pagina of ["0", "-2", "2.5", ""]) expect(ler(`pagina=${pagina}`).pagina).toBe(1);
  });

  it("escreve só o que não é padrão, e a coluna sempre que há ordem — inclusive Pessoa", () => {
    expect(escreverEndereco(ENDERECO_PADRAO)).toBe("");
    expect(
      escreverEndereco({ filtro: "pedidos", ordem: "pessoa", sentido: "decrescente", pagina: 1, etiqueta: null }),
    ).toBe("filtro=pedidos&ordem=pessoa&sentido=decrescente");
    expect(escreverEndereco({ ...ENDERECO_PADRAO, ordem: "pessoa" })).toBe("ordem=pessoa");
    expect(escreverEndereco({ ...ENDERECO_PADRAO, ordem: "unidade", pagina: 3 })).toBe("ordem=unidade&pagina=3");
  });

  it("trocar o filtro ou a ordem volta à primeira página; ir a uma página só troca a página", () => {
    const naTerceira = { ...ENDERECO_PADRAO, pagina: 3 };
    expect(comFiltro(naTerceira, "gestores")).toStrictEqual({ ...ENDERECO_PADRAO, filtro: "gestores" });
    expect(comOrdem(naTerceira, "atualizacao")).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "atualizacao" });
    expect(naPagina(ENDERECO_PADRAO, 2)).toStrictEqual({ ...ENDERECO_PADRAO, pagina: 2 });
  });

  it("três cliques na mesma coluna devolvem a ordem inicial (critério 68.3)", () => {
    const um = comOrdem(ENDERECO_PADRAO, "pessoa");
    expect(um).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "pessoa" });
    const dois = comOrdem(um, "pessoa");
    expect(dois).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "pessoa", sentido: "decrescente" });
    expect(comOrdem(dois, "pessoa")).toStrictEqual(ENDERECO_PADRAO);
    expect(comOrdem(dois, "papel")).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "papel" });
  });

  it("um endereço guardado com ordem=desde cai no padrão, e ordem=atualizacao vale", () => {
    expect(ler("ordem=desde&sentido=decrescente")).toStrictEqual(ENDERECO_PADRAO);
    expect(ler("ordem=atualizacao&sentido=decrescente")).toStrictEqual({
      ...ENDERECO_PADRAO,
      ordem: "atualizacao",
      sentido: "decrescente",
    });
  });

  it("o nome acessível do cabeçalho percorre os três estados na coluna nova", () => {
    const rotulo = "Última atualização";
    expect(rotuloDoCabecalho(ENDERECO_PADRAO, "atualizacao", rotulo)).toBe(
      "Ordenar por Última atualização",
    );
    expect(
      rotuloDoCabecalho({ ordem: "atualizacao", sentido: "crescente" }, "atualizacao", rotulo),
    ).toBe("Inverter a ordem de Última atualização");
    expect(
      rotuloDoCabecalho({ ordem: "atualizacao", sentido: "decrescente" }, "atualizacao", rotulo),
    ).toBe("Tirar a ordenação de Última atualização");
  });

  it("aria-sort: none em todas sem ordenação, e o sentido na coluna ativa", () => {
    for (const coluna of ["pessoa", "papel", "unidade", "atualizacao"] as const) {
      expect(ariaSort(ENDERECO_PADRAO, coluna)).toBe("none");
    }
    const desc = comOrdem(comOrdem(ENDERECO_PADRAO, "pessoa"), "pessoa");
    expect(ariaSort(comOrdem(ENDERECO_PADRAO, "pessoa"), "pessoa")).toBe("ascending");
    expect(ariaSort(desc, "pessoa")).toBe("descending");
    expect(ariaSort(desc, "atualizacao")).toBe("none");
  });
});

describe("o estado da tabela — a precedência da §4.4 da spec", () => {
  it("o vazio da opção ganha da busca, e a busca ganha do além do fim", () => {
    expect(estadoDaTabela({ noFiltro: 0, encontradas: 0, pagina: 4, totalDePaginas: 1 })).toBe("vazio-do-filtro");
    expect(estadoDaTabela({ noFiltro: 3, encontradas: 0, pagina: 4, totalDePaginas: 1 })).toBe("busca-vazia");
    expect(estadoDaTabela({ noFiltro: 3, encontradas: 3, pagina: 2, totalDePaginas: 1 })).toBe("alem-do-fim");
    expect(estadoDaTabela({ noFiltro: 3, encontradas: 3, pagina: 1, totalDePaginas: 1 })).toBe("lista");
  });
});

describe("os contatos em edição (critério 9)", () => {
  it("o telefone gravado entra no campo com o país; e-mail e número de fora entram como estão", () => {
    expect(contatoVindoDaApi(CONTATO("c1", "telefone", "+5511981234567", { finalidade: "trabalho" }))).toStrictEqual({
      chave: "c1",
      tipo: "telefone",
      valor: "+55 (11) 98123-4567",
      finalidade: "trabalho",
      temWhatsapp: false,
      observacao: "",
    });
    expect(contatoVindoDaApi(CONTATO("c2", "email", "a@example.com")).valor).toBe("a@example.com");
    expect(contatoVindoDaApi(CONTATO("c3", "telefone", "+14155552671")).valor).toBe("+14155552671");
  });

  it("ler e reescrever sem tocar não é mudança", () => {
    const originais = [
      contatoVindoDaApi(CONTATO("c1", "telefone", "+5511981234567")),
      contatoVindoDaApi(CONTATO("c2", "email", "a@example.com")),
    ];
    expect(listaMudou(originais, originais)).toBe(false);
    expect(listaMudou([...originais].reverse(), originais)).toBe(true);
    expect(paraCorpo(originais)?.[0]?.valor).toBe("+5511981234567");
  });

  it("o contato novo nasce telefone, com o país", () => {
    expect(contatoNovo("n1")).toStrictEqual({
      chave: "n1",
      tipo: "telefone",
      valor: PREFIXO_BR,
      finalidade: "pessoal",
      temWhatsapp: false,
      observacao: "",
    });
  });

  it("trocar para e-mail limpa o WhatsApp e o prefixo sozinho; o digitado fica", () => {
    const telefone = { ...contatoNovo("n1"), temWhatsapp: true };
    expect(comTipo(telefone, "email")).toMatchObject({ tipo: "email", valor: "", temWhatsapp: false });
    const digitado = { ...telefone, valor: "11 98123 4567" };
    expect(comTipo(digitado, "email")).toMatchObject({ valor: "11 98123 4567", temWhatsapp: false });
    const emailVazio: ContatoEmEdicao = { ...contatoNovo("n2"), tipo: "email", valor: "" };
    expect(comTipo(emailVazio, "telefone").valor).toBe(PREFIXO_BR);
    expect(comTipo(telefone, "telefone")).toBe(telefone);
  });

  it("as mensagens do valor, na ordem em que valem", () => {
    const telefone = (valor: string): ContatoEmEdicao => ({ ...contatoNovo("t"), valor });
    const email = (valor: string): ContatoEmEdicao => ({ ...contatoNovo("e"), tipo: "email", valor });
    expect(erroDoContato(telefone("+5511981234567"), true)).toBe("Este contato já está na lista.");
    expect(erroDoContato(telefone(PREFIXO_BR), false)).toBe("Informe o número.");
    expect(erroDoContato(telefone(""), false)).toBe("Informe o número.");
    expect(erroDoContato(telefone("+55 (11) 9812"), false)).toBe(MENSAGEM_DE_TELEFONE);
    expect(erroDoContato(telefone("11 98123 4567"), false)).toBeUndefined();
    expect(erroDoContato(email("  "), false)).toBe("Informe o e-mail.");
    expect(erroDoContato(email("x"), false, "Confira o e-mail deste contato.")).toBe("Confira o e-mail deste contato.");
    expect(erroDoContato(email("a@example.com"), false)).toBeUndefined();
  });

  it("o par repetido só acusa o segundo", () => {
    const um = { ...contatoNovo("a"), valor: "(11) 98123-4567" };
    const dois = { ...contatoNovo("b"), valor: "+5511981234567" };
    expect([...indicesDuplicados([um, dois])]).toStrictEqual([1]);
  });

  it("a leitura de quem tem conta: valor legível, finalidade e a palavra WhatsApp", () => {
    expect(contatoEmLeitura(CONTATO("c1", "telefone", "+5511988776655", { temWhatsapp: true }))).toStrictEqual({
      valor: "(11) 98877-6655",
      finalidade: "Pessoal",
      whatsapp: "Aceita WhatsApp",
    });
    expect(contatoEmLeitura(CONTATO("c2", "email", "paulo@example.com", { finalidade: "trabalho" }))).toStrictEqual({
      valor: "paulo@example.com",
      finalidade: "Trabalho",
      whatsapp: null,
    });
  });
});

describe("o formulário de vínculo valida com o schema da rota (critério 8)", () => {
  it("o cadastro vazio acende o nome, o papel e o número do contato", () => {
    const erros = errosDoFormularioDeVinculo({
      modo: "cadastro",
      editaNomeEContatos: true,
      nome: "  ",
      papel: null,
      contatos: [contatoNovo("c1")],
    });
    expect(erros["nome"]).toBe("Informe o nome.");
    expect(erros["papel"]).toBe("Escolha o papel desta pessoa.");
    expect(erros[campoDoContato("c1")]).toBe("Informe o número.");
  });

  it("o e-mail fora da forma acende a frase do schema, e o resto fica limpo", () => {
    const email: ContatoEmEdicao = { ...contatoNovo("c2"), tipo: "email", valor: "zelador-arroba-exemplo" };
    const erros = errosDoFormularioDeVinculo({
      modo: "cadastro",
      editaNomeEContatos: true,
      nome: "Sérgio Lima",
      papel: "encarregado",
      contatos: [email],
    });
    expect(erros[campoDoContato("c2")]).toBe("Confira o e-mail deste contato.");
    expect(erros["nome"]).toBeUndefined();
    expect(erros["papel"]).toBeUndefined();
  });

  it("quem tem conta não tem campo com problema", () => {
    const erros = errosDoFormularioDeVinculo({
      modo: "correcao",
      editaNomeEContatos: false,
      nome: "",
      papel: null,
      contatos: [],
    });
    expect(Object.values(erros).filter((mensagem) => mensagem !== undefined)).toStrictEqual([]);
  });

  it("a correção de quem não tem conta pede o nome, e não o papel", () => {
    const erros = errosDoFormularioDeVinculo({
      modo: "correcao",
      editaNomeEContatos: true,
      nome: "",
      papel: null,
      contatos: [],
    });
    expect(erros["nome"]).toBe("Informe o nome.");
    expect(erros["papel"]).toBeUndefined();
  });

  it("o erro que o servidor pôs num contato vai para o campo daquele contato", () => {
    const contatos = [contatoNovo("a"), contatoNovo("b")];
    const corpo = {
      codigo: "FORMATO_INVALIDO",
      erros: [
        { campo: "contatos.1.valor", codigo: "VALOR_INVALIDO", mensagem: "Confira o e-mail deste contato." },
        { campo: "nome", codigo: "MUITO_CURTO", mensagem: "Informe o nome." },
        { campo: "contatos.9.valor", codigo: "VALOR_INVALIDO", mensagem: "Fora da lista." },
        { campo: "areaId" },
      ],
    };
    expect(errosDoServidorNoFormulario(corpo, contatos)).toStrictEqual({
      [campoDoContato("b")]: "Confira o e-mail deste contato.",
      nome: "Informe o nome.",
    });
    expect(errosDoServidorNoFormulario(null, contatos)).toStrictEqual({});
    expect(errosDoServidorNoFormulario({ erros: "x" }, contatos)).toStrictEqual({});
  });

  it("o corpo do cadastro passa pelo schema da rota", () => {
    const corpo = corpoDoCadastro({
      nome: " Sérgio Lima ",
      papel: "encarregado",
      areaId: null,
      contatos: [{ ...contatoNovo("a"), valor: "11 98123 4567", temWhatsapp: true }],
    });
    expect(corpo).toStrictEqual({
      nome: "Sérgio Lima",
      papel: "encarregado",
      areaId: null,
      contatos: [
        { tipo: "telefone", valor: "+5511981234567", finalidade: "pessoal", temWhatsapp: true, observacao: null },
      ],
    });
    expect(cadastroDeVinculoSchema.safeParse(corpo).success).toBe(true);
    expect(corpoDoCadastro({ nome: "X", papel: "gestor", areaId: null, contatos: [contatoNovo("a")] })).toBeNull();
  });

  it("a correção de quem tem conta manda só a unidade; a de quem não tem só manda contatos se mudaram", () => {
    const originais = [contatoVindoDaApi(CONTATO("c1", "telefone", "+5511981234567"))];
    const comConta = { editaNomeEContatos: false, nome: "Helena", areaId: "a1", contatos: originais, originais };
    expect(corpoDaCorrecao(comConta)).toStrictEqual({ areaId: "a1" });
    const semMudanca = corpoDaCorrecao({ ...comConta, editaNomeEContatos: true, nome: " Beatriz ", areaId: null });
    expect(semMudanca).toStrictEqual({ nome: "Beatriz", areaId: null });
    expect(correcaoDeVinculoSchema.safeParse(semMudanca).success).toBe(true);
    const semContatos = corpoDaCorrecao({ ...comConta, editaNomeEContatos: true, nome: "Beatriz", areaId: null, contatos: [] });
    expect(semContatos).toStrictEqual({ nome: "Beatriz", areaId: null, contatos: [] });
  });

  it("salvar sem mudança é reconhecido, e espaço nas pontas do nome não é mudança", () => {
    const originais = [contatoVindoDaApi(CONTATO("c1", "telefone", "+5511981234567"))];
    const base = {
      editaNomeEContatos: true,
      nomeOriginal: "Beatriz",
      nome: "Beatriz ",
      areaOriginal: null,
      areaId: null,
      originais,
      contatos: originais,
    };
    expect(edicaoMudou(base)).toBe(false);
    expect(edicaoMudou({ ...base, areaId: "a1" })).toBe(true);
    expect(edicaoMudou({ ...base, nome: "Beatriz N." })).toBe(true);
    expect(edicaoMudou({ ...base, contatos: [] })).toBe(true);
    expect(edicaoMudou({ ...base, editaNomeEContatos: false, nome: "Outro", contatos: [] })).toBe(false);
  });

  it("o seletor de unidade usa uma sentinela no lugar do vazio", () => {
    expect(seletorDaArea(null)).toBe(SEM_UNIDADE);
    expect(seletorDaArea("a1")).toBe("a1");
    expect(areaDoSeletor(SEM_UNIDADE)).toBeNull();
    expect(areaDoSeletor("a1")).toBe("a1");
  });
});

describe("T-08 depois do item 120 — critérios 11, 12 e 26", () => {
  const raiz = fileURLToPath(new URL("../../", import.meta.url));
  const tabela = readFileSync(`${raiz}src/interface/componentes/tabela-de-participantes.tsx`, "utf8");
  const pagina = readFileSync(`${raiz}app/(casca)/vinculos/page.tsx`, "utf8");

  it("o botão Etiquetas não existe mais, e a lista só tem Cadastrar participante no cabeçalho", () => {
    expect(pagina).not.toMatch(/GerenciaDeEtiquetas|gerencia-de-etiquetas|usoPorEtiqueta/u);
  });

  it("o filtro de etiqueta é seleção única com busca, na linha da busca por nome, e a régua de etiquetas saiu", () => {
    // Uma régua só: a dos papéis.
    expect(tabela.match(/<ToggleGroup\b/gu)).toHaveLength(1);
    const linha = tabela.slice(tabela.indexOf("{/* A linha da busca"), tabela.indexOf("{estado === \"vazio-do-filtro\""));
    expect(linha).toContain("htmlFor={`${prefixo}-busca`}");
    expect(linha).toContain("<EscolhaComBusca");
    expect(linha).toContain("comEtiqueta(endereco,");
    // *Todas* é a opção fixa, e não uma das ordenadas e cortadas por `primeirasOpcoes`.
    expect(linha).toContain("fixa={{");
    expect(linha).not.toMatch(/opcoes=\{\[\s*\{\s*valor: "todas"/u);
  });

  it("os dois rótulos ficam acima do campo, nas duas larguras (critério 26)", () => {
    const linha = tabela.slice(tabela.indexOf("{/* A linha da busca"), tabela.indexOf("{estado === \"vazio-do-filtro\""));
    // Rótulo e campo empilhados: nenhuma coluna da linha vira fileira com o rótulo ao lado.
    expect(linha).not.toContain("md:flex-row md:items-center md:gap-3");
    expect(linha.match(/flex flex-col gap-1\.5/gu)?.length).toBeGreaterThanOrEqual(2);
  });
});
