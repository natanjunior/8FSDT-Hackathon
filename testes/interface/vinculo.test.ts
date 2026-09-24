import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  razaoDoImpedimento,
  textoDaConfirmacao,
  textoDaRecusa,
  tituloDaConfirmacao,
  tituloDoImpedimento,
} from "@/interface/componentes/frases-da-remocao";
import {
  FALHA,
  PAPEIS,
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
  fraseDoFato,
  fraseDoFatoDeEdicao,
  papelDoValor,
  primeiroNome,
  rotuloDeAprovar,
  rotuloDoPapel,
  textoDeMaisContatos,
  tituloDaRecusa,
} from "@/interface/componentes/frases-de-participantes";
import {
  ENDERECO_PADRAO,
  VAZIO_DO_FILTRO,
  ariaSort,
  comFiltro,
  comOrdem,
  contagensDoFiltro,
  escreverEndereco,
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
 *  O critério 10.5 — é o ÚNICO `DELETE` do contrato
 * ============================================================================
 *
 * **Um critério de aceitação sem nada que o confira é um critério que ninguém confere.** O 10.5 afirma
 * que não há caminho que apague ocorrência, mensagem, categoria nem área — e o custo de conferir isso é
 * uma varredura de doze linhas.
 *
 * **Não é o mesmo que o portão do contrato:** aquele roda sobre o `openapi.yaml`, e este roda sobre o
 * **código**. O dia em que os dois discordarem é o dia em que alguém escreveu endpoint sem publicar.
 */
describe("o único DELETE do produto", () => {
  it("existe exatamente um export const DELETE em app/api/, e é o de vínculos", () => {
    const raiz = fileURLToPath(new URL("../../app/api/", import.meta.url));

    const rotas = readdirSync(raiz, { recursive: true, encoding: "utf8" })
      .filter((caminho) => caminho.endsWith("route.ts"))
      .filter((caminho) => /^export const DELETE\b/mu.test(readFileSync(`${raiz}${caminho}`, "utf8")))
      // O `readdirSync` recursivo devolve separador do sistema; a asserção é sobre o caminho lógico.
      .map((caminho) => caminho.replace(/\\/gu, "/"));

    expect(rotas).toStrictEqual(["vinculos/[pessoaId]/route.ts"]);
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
  it("a razão do histórico COMEÇA PELO NOME, fala em rastro e enumera as cinco famílias — nunca só três", () => {
    const razao = razaoDoImpedimento("Helena Rocha", "historico");

    expect(razao.startsWith("Helena Rocha já deixou rastro nesta organização")).toBe(true);
    expect(razao).toContain("ocorrência, mensagem, atribuição, decisão de entrada ou configuração");
    expect(razao).not.toContain("registrou ocorrências");
  });

  /**
   * **Critério 44j.5.** A frase que explicava o que o produto não faz saiu da tela: o guia a recusa, e
   * o caminho correto — revogar — continua ⬜. O que fica é a razão.
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

  it("o fato da página de editar", () => {
    expect(fraseDoFatoDeEdicao("Paulo Mendes", "solicitante", "2026-09-16T15:00:00.000Z")).toBe(
      "Paulo Mendes, Solicitante desde 16/09/2026.",
    );
  });

  it("o +N diz a palavra para quem não vê o sinal", () => {
    expect(textoDeMaisContatos(1)).toBe("e mais 1 contato");
    expect(textoDeMaisContatos(2)).toBe("e mais 2 contatos");
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
    expect(avisoDeCadastrado("Sérgio Lima", "encarregado")).toStrictEqual({
      titulo: "Sérgio Lima entrou como Encarregado",
      descricao: "Sem conta: recebe atribuições e aparece como responsável.",
    });
    expect(avisoDeSalvo("Sérgio Lima")).toStrictEqual({ titulo: "Dados de Sérgio Lima salvos" });
  });

  it("as cinco falhas dizem o que foi tentado", () => {
    expect(FALHA).toStrictEqual({
      aprovar: "Não foi possível aprovar o pedido",
      recusar: "Não foi possível recusar o pedido",
      remover: "Não foi possível remover o vínculo",
      cadastrar: "Não foi possível cadastrar a pessoa",
      salvar: "Não foi possível salvar os dados",
    });
  });
});

describe("as linhas da tabela única (critério 1)", () => {
  it("o pedido vira linha com o papel a decidir e o telefone informado, legível", () => {
    const linha = linhaDoPedido(PEDIDO("q1", "Paulo Mendes"));
    expect(linha).toMatchObject({
      tipo: "pedido",
      chave: "pedido:q1",
      nome: "Paulo Mendes",
      rotuloDoPapel: "a decidir",
      unidade: null,
      contato: "(11) 98877-6655",
      maisContatos: 0,
      desdeTexto: "14/09/2026",
    });
    expect(linhaDoPedido(PEDIDO("q2", "Sem Telefone", undefined, null)).contato).toBeNull();
  });

  it("o vínculo mostra o primeiro contato, a palavra WhatsApp e quantos sobram", () => {
    const linha = linhaDoVinculo(
      VINCULO("p1", "Cláudia Meireles", "solicitante", {
        area: { id: "a1", nome: "Apartamento 101" },
        temConta: false,
        contatos: [
          CONTATO("c1", "telefone", "+5511998124410", { temWhatsapp: true }),
          CONTATO("c2", "email", "claudia@example.com"),
        ],
      }),
      CONTEXTO,
    );
    expect(linha).toMatchObject({
      tipo: "vinculo",
      chave: "vinculo:p1",
      rotuloDoPapel: "Solicitante",
      unidade: "Apartamento 101",
      contato: "(11) 99812-4410 · WhatsApp",
      maisContatos: 1,
      desdeTexto: "02/03/2026",
      ehVoce: false,
      impedimento: null,
    });
  });

  it("o e-mail como primeiro contato sai como está, e sem contato a célula fica vazia", () => {
    const comEmail = VINCULO("p-helena", "Helena Rocha", "gestor", {
      contatos: [CONTATO("c1", "email", "helena.rocha@email.com")],
    });
    expect(linhaDoVinculo(comEmail, CONTEXTO).contato).toBe("helena.rocha@email.com");
    expect(linhaDoVinculo(VINCULO("p9", "Sem Contato", "gestor"), CONTEXTO)).toMatchObject({
      contato: null,
      maisContatos: 0,
    });
  });

  it("a própria linha é marcada, e o impedimento vem do mapa", () => {
    const linha = linhaDoVinculo(VINCULO("p-helena", "Helena Rocha", "gestor"), {
      euPessoaId: "p-helena",
      impedimentos: { "p-helena": "ultimo-gestor" },
    });
    expect(linha).toMatchObject({ ehVoce: true, impedimento: "ultimo-gestor" });
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

  it("Desde pelo instante, e o empate pelo nome", () => {
    const linhas = [
      V("1", "Novo", "gestor", { criadoEm: "2026-09-10T12:00:00.000Z" }),
      V("2", "Velho", "gestor", { criadoEm: "2026-01-10T12:00:00.000Z" }),
      V("3", "Antigo", "gestor", { criadoEm: "2026-01-10T12:00:00.000Z" }),
    ];
    expect(nomes(ordenarLinhas(linhas, "desde", "crescente"))).toStrictEqual(["Antigo", "Velho", "Novo"]);
    expect(nomes(ordenarLinhas(linhas, "desde", "decrescente"))).toStrictEqual(["Novo", "Antigo", "Velho"]);
  });

  it("o último empate é a chave, e a ordem não depende da entrada", () => {
    const a = V("p2", "Ana", "gestor");
    const b = V("p1", "Ana", "gestor");
    const chaves = (linhas: readonly LinhaDeParticipante[]) => linhas.map((linha) => linha.chave);
    expect(chaves(ordenarLinhas([a, b], "pessoa", "crescente"))).toStrictEqual(["vinculo:p1", "vinculo:p2"]);
    expect(chaves(ordenarLinhas([b, a], "pessoa", "decrescente"))).toStrictEqual(["vinculo:p1", "vinculo:p2"]);
  });

  it("os pedidos ficam no topo qualquer que seja a ordem", () => {
    const pedido = linhaDoPedido(PEDIDO("q1", "Zuleica"));
    const vinculo = V("1", "Ana", "gestor", { criadoEm: "2026-01-01T12:00:00.000Z" });
    expect(nomes(ordenarLinhas([vinculo, pedido], "pessoa", "crescente"))).toStrictEqual(["Zuleica", "Ana"]);
    expect(nomes(ordenarLinhas([vinculo, pedido], "desde", "crescente"))).toStrictEqual(["Zuleica", "Ana"]);
    expect(nomes(ordenarLinhas([vinculo, pedido], "papel", "decrescente"))).toStrictEqual(["Zuleica", "Ana"]);
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

describe("o endereço guarda filtro, ordem e página (critério 3)", () => {
  const ler = (consulta: string) => lerEndereco(new URLSearchParams(consulta));

  it("sem nada, o padrão: Todos, Pessoa, crescente, primeira página", () => {
    expect(ler("")).toStrictEqual(ENDERECO_PADRAO);
    expect(ENDERECO_PADRAO).toStrictEqual({ filtro: "todos", ordem: "pessoa", sentido: "crescente", pagina: 1 });
  });

  it("lê os quatro quando são válidos", () => {
    expect(ler("filtro=gestores&ordem=desde&sentido=decrescente&pagina=2")).toStrictEqual({
      filtro: "gestores",
      ordem: "desde",
      sentido: "decrescente",
      pagina: 2,
    });
  });

  it("valor desconhecido vale o padrão, sem erro", () => {
    expect(ler("filtro=xyz&ordem=cor&sentido=cima&pagina=abc")).toStrictEqual(ENDERECO_PADRAO);
    for (const pagina of ["0", "-2", "2.5", ""]) expect(ler(`pagina=${pagina}`).pagina).toBe(1);
  });

  it("escreve só o que não é padrão", () => {
    expect(escreverEndereco(ENDERECO_PADRAO)).toBe("");
    expect(escreverEndereco({ filtro: "pedidos", ordem: "pessoa", sentido: "decrescente", pagina: 1 })).toBe(
      "filtro=pedidos&sentido=decrescente",
    );
    expect(escreverEndereco({ ...ENDERECO_PADRAO, ordem: "unidade", pagina: 3 })).toBe("ordem=unidade&pagina=3");
  });

  it("trocar o filtro ou a ordem volta à primeira página; ir a uma página só troca a página", () => {
    const naTerceira = { ...ENDERECO_PADRAO, pagina: 3 };
    expect(comFiltro(naTerceira, "gestores")).toStrictEqual({ ...ENDERECO_PADRAO, filtro: "gestores" });
    expect(comOrdem(naTerceira, "desde")).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "desde" });
    expect(naPagina(ENDERECO_PADRAO, 2)).toStrictEqual({ ...ENDERECO_PADRAO, pagina: 2 });
  });

  it("clicar na coluna ativa inverte o sentido; em outra, ordena crescente", () => {
    const desc = comOrdem(ENDERECO_PADRAO, "pessoa");
    expect(desc).toStrictEqual({ ...ENDERECO_PADRAO, sentido: "decrescente" });
    expect(comOrdem(desc, "pessoa")).toStrictEqual(ENDERECO_PADRAO);
    expect(comOrdem(desc, "papel")).toStrictEqual({ ...ENDERECO_PADRAO, ordem: "papel" });
  });

  it("aria-sort diz a coluna e o sentido, e none nas outras", () => {
    const desc = comOrdem(ENDERECO_PADRAO, "pessoa");
    expect(ariaSort(ENDERECO_PADRAO, "pessoa")).toBe("ascending");
    expect(ariaSort(desc, "pessoa")).toBe("descending");
    expect(ariaSort(desc, "desde")).toBe("none");
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
