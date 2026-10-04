import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// `@/interface/http` alcança `next/headers`; o que se testa aqui é puro. O mesmo arranjo de
// `credencial.test.ts`.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado neste teste");
  },
  headers: () => {
    throw new Error("headers() não é usado neste teste");
  },
}));

import {
  TEXTOS_DO_CONVITE_PESSOAL,
  conviteNoDetalhe,
  desfechoDoAceite,
  rodapeDoModal,
} from "@/interface/componentes/convite-pessoal";
import {
  FRASE_DO_MOTIVO,
  desfechoDoEnvioUnico,
  desfechoDoLote,
  fraseDoImpedimento,
  linhaDoUltimoEnvio,
  principalDoModal,
  excessoDoLote,
  faixaDaSelecao,
  perguntaDoLote,
  rotuloDoBotaoEmMassa,
} from "@/interface/componentes/envio-de-convite";
import { paginar, type LinhaDeParticipante } from "@/interface/componentes/linhas-de-participantes";
import { modulosDoQr } from "@/interface/componentes/qr";
import {
  SELECAO_VAZIA,
  alternar,
  alternarPagina,
  estadoDaPagina,
  selecionavel,
} from "@/interface/componentes/selecao-de-participantes";
import { MOTIVOS_DE_NAO_ENVIO } from "@/dominio/organizacao";
import { LoteDeEnvioInvalido } from "@/aplicacao/organizacao";
import { destinoDoConvite, linkDoConvite, linkDoConvitePessoal, problemaDe } from "@/interface/http";
import { envioDeConvitesSchema } from "@/interface/schemas";
import { projetarConvitePessoal } from "@/interface/projecoes";

/**
 * ============================================================================
 *  Unitário de INTERFACE — o convite por link (item 86)
 * ============================================================================
 *
 * O que decide mora em função pura (o destino do `?e=`, o link, a matriz do QR), e o que é ordem de
 * código vira guarda sobre a fonte, no precedente de `casca.test.ts`.
 */
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (relativo: string) => readFileSync(RAIZ + relativo, "utf8");

describe("destinoDoConvite — o ?e= do link (critério 86.6)", () => {
  it("leva o código, em maiúscula e sem espaço, para a página do convite", () => {
    expect(destinoDoConvite({ e: "K7M4QX2P" })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: " k7m4qx2p " })).toBe("/convite/K7M4QX2P");
  });

  it("repetido pega o primeiro, e vazio ou ausente segue o caminho de hoje", () => {
    expect(destinoDoConvite({ e: ["K7M4QX2P", "OUTRO123"] })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: "" })).toBeNull();
    expect(destinoDoConvite({ e: "   " })).toBeNull();
    expect(destinoDoConvite({})).toBeNull();
  });

  it("não deixa o valor escapar do caminho", () => {
    expect(destinoDoConvite({ e: "../../api/contexto" })).toBe("/convite/..%2F..%2FAPI%2FCONTEXTO");
  });

  it("no despachante, o ?e= vem antes da checagem de sessão", () => {
    const fonte = ler("app/page.tsx");
    const convite = fonte.indexOf("destinoDoConvite(");
    const sessao = fonte.indexOf("resolverEscopoParaTela(");
    expect(convite).toBeGreaterThan(-1);
    expect(sessao).toBeGreaterThan(convite);
  });
});

describe("linkDoConvite — o que o Gestor manda", () => {
  it("é a origem, a barra e o ?e= com o código", () => {
    expect(linkDoConvite("https://resolveai.exemplo", "K7M4QX2P")).toBe(
      "https://resolveai.exemplo/?e=K7M4QX2P",
    );
  });
});

describe("a página do convite — critérios 86.2 e 86.3 na fonte", () => {
  const PAGINA = "app/convite/[codigo]/page.tsx";

  it("lê pela estrada direta, e só por ela", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("resolverConviteParaTela(");
    expect(fonte).not.toContain("resolverParaTela(");
    expect(fonte).not.toContain("resolverEscopoParaTela(");
  });

  it("os cinco estados têm as frases da spec, e nenhum fala de revogação", () => {
    const fonte = ler(PAGINA);
    for (const frase of [
      "Convite não encontrado",
      "Confira o link com quem enviou.",
      "Você recebeu um convite para participar desta organização.",
      "Você já participa desta organização",
      "Pedido enviado",
      "está aguardando o Gestor.",
      "Peça para entrar. Um Gestor decide.",
    ]) {
      expect(fonte, frase).toContain(frase);
    }
    expect(fonte).not.toMatch(/revog/iu);
  });

  it("sem sessão, a página não desenha nada além de nome, código e as duas saídas", () => {
    const fonte = ler(PAGINA);
    const semSessao = fonte.slice(
      fonte.indexOf("function FaceSemSessao"),
      fonte.indexOf("function FaceJaParticipa"),
    );
    expect(semSessao).toContain("<ExibicaoDeCodigo");
    expect(semSessao).toContain("/criar-conta?destino=");
    expect(semSessao).toContain("/entrar?destino=");
    expect(semSessao).not.toMatch(/\.id\b|pessoa|contagem|quantidade/u);
  });

  it("o formulário recebe o código travado, e ele vai escondido no envio", () => {
    const formulario = ler("src/interface/componentes/formulario-de-pedido-de-entrada.tsx");
    expect(formulario).toContain("codigoFixo");
    expect(formulario).toContain('<input type="hidden" name="codigo" value={codigoFixo} />');
    expect(formulario).toContain("<ExibicaoDeCodigo");
  });
});

describe("o QR do convite", () => {
  /** O padrão de localização: 7 × 7, borda escura, anel claro, miolo 3 × 3 escuro. */
  function temLocalizador(m: boolean[][], linha: number, coluna: number): boolean {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const borda = i === 0 || i === 6 || j === 0 || j === 6;
        const miolo = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (m[linha + i]![coluna + j] !== (borda || miolo)) return false;
      }
    }
    return true;
  }

  it("é uma matriz quadrada com os três localizadores nos cantos, sem borda embutida", () => {
    const m = modulosDoQr("https://resolveai.exemplo/?e=K7M4QX2P");
    const n = m.length;
    expect(m.every((linha) => linha.length === n)).toBe(true);
    expect((n - 17) % 4).toBe(0); // 21, 25, 29…: tamanho de QR de versão válida
    expect(temLocalizador(m, 0, 0)).toBe(true);
    expect(temLocalizador(m, 0, n - 7)).toBe(true);
    expect(temLocalizador(m, n - 7, 0)).toBe(true);
  });

  it("links diferentes dão matrizes diferentes", () => {
    expect(modulosDoQr("https://a.exemplo/?e=K7M4QX2P")).not.toStrictEqual(
      modulosDoQr("https://a.exemplo/?e=K7M4QX2Q"),
    );
  });
});

describe("o convite mora na configuração — critérios 120.21 e 120.22", () => {
  it("a página /convidar não existe mais, e o menu não a oferece", () => {
    expect(() => ler("app/(casca)/convidar/page.tsx")).toThrow();
    const menu = ler("src/interface/componentes/casca/navegacao.tsx");
    expect(menu).not.toContain('destino="/convidar"');
    expect(menu).not.toContain('rotulo="Convidar pessoas"');
  });

  it("criar a organização leva à aba de participantes da configuração, com o aviso", () => {
    const fonte = ler("src/interface/componentes/formulario-de-nova-organizacao.tsx");
    expect(fonte).toContain('router.push("/configuracao?aba=participantes")');
    expect(fonte).not.toContain('router.push("/convidar")');
    // O destino de antes do 116 também não volta (era a guarda de `convite.test.ts:166`).
    expect(fonte).not.toContain('router.push("/ocorrencias")');
    expect(fonte).toContain('avisarSucesso("Organização criada")');
  });

  it("o cartão tem três colunas: o código como na Identidade, o link que se copia, e o QR", () => {
    const cartao = ler("src/interface/componentes/convite-da-organizacao.tsx");
    const codigo = cartao.indexOf("<CodigoDaOrganizacao codigo={organizacao.codigoPublico} />");
    const link = cartao.indexOf("<CopiaDoLink link={link} />");
    const qr = cartao.indexOf("<QrDoLink");
    expect(codigo).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(codigo);
    expect(qr).toBeGreaterThan(link);
    // Três colunas só a partir de `xl`: o código pede até 398 px e o QR 224, e a `lg` cada terço dá ~210.
    expect(cartao).toContain("xl:grid-cols-[minmax(0,24.875rem)_minmax(0,1fr)_auto]");
    expect(cartao).not.toMatch(/\blg:grid-cols-3\b/u);
  });

  it("Copiar link copia o link, e o link não aparece escrito fora da falha", () => {
    const fonte = ler("src/interface/componentes/link-do-convite.tsx");
    expect(fonte).toContain("useCopiar(link)");
    expect(fonte).toContain('{desfecho === "copiado" ? "Copiado" : "Copiar link"}');
    expect(fonte).not.toContain("<code");
    // Na falha da área de transferência, o link aparece selecionado para Ctrl+C.
    expect(fonte).toContain("select-all");
  });

  it("a página guarda o cartão por vinculo.gerir, como a aba", () => {
    const pagina = ler("app/(casca)/configuracao/page.tsx");
    const participantes = pagina.slice(pagina.indexOf("participantes: geriVinculos"), pagina.indexOf("historico: ("));
    expect(participantes).toContain("<ConviteDaOrganizacao");
    expect(pagina.indexOf("montarLinkDoConvite(")).toBeGreaterThan(pagina.indexOf("const geriVinculos"));
  });
});

describe("o convite pessoal, do lado do Gestor (item 121, critérios 1 e 9)", () => {
  it("as duas rotas do Gestor existem, exportam só POST, e exigem vinculo.gerir", () => {
    for (const rota of [
      "app/api/vinculos/[pessoaId]/convite/route.ts",
      "app/api/vinculos/[pessoaId]/convite/renovacao/route.ts",
    ]) {
      const fonte = ler(rota);
      expect(fonte.match(/^export const (GET|POST|PUT|PATCH|DELETE) /gmu), rota).toStrictEqual(["export const POST "]);
      expect(fonte, rota).toContain('comContexto({ exige: "vinculo.gerir" }');
    }
  });
});

describe("o convite pessoal, nas telas (item 121)", () => {
  it("o detalhe mostra o botão só para quem pode receber convite", () => {
    expect(conviteNoDetalhe({ papel: "solicitante", temConta: false })).toBe("botao");
    expect(conviteNoDetalhe({ papel: "gestor", temConta: false })).toBe("botao");
    expect(conviteNoDetalhe({ papel: "encarregado", temConta: false })).toBe("encarregado");
    expect(conviteNoDetalhe({ papel: "solicitante", temConta: true })).toBe("com-conta");
  });

  it("o botão Entrar segue, refaz a página ou diz que não foi possível (critério 4)", () => {
    expect(desfechoDoAceite(200)).toBe("ir");
    expect(desfechoDoAceite(404)).toBe("refazer");
    expect(desfechoDoAceite(409)).toBe("refazer");
    expect(desfechoDoAceite(500)).toBe("falha");
    expect(desfechoDoAceite(0)).toBe("falha");
  });

  it("o link pessoal é a página do convite sobre a origem do pedido", () => {
    const token = "T".repeat(43);
    expect(linkDoConvitePessoal("https://x.example", token)).toBe(`https://x.example/convite-pessoal/${token}`);
  });

  it("o rodapé do modal diz quando e quem gerou, em dd/mm", () => {
    expect(rodapeDoModal("2026-10-02T15:00:00.000Z", "Ana Lima")).toBe("Gerado em 02/10 por Ana Lima");
  });

  it("a resposta sem sessão leva só os nomes e o papel, e nao-vale vai sozinho (critério 8)", () => {
    expect(projetarConvitePessoal(null)).toStrictEqual({ situacao: "nao-vale" });
    expect(
      projetarConvitePessoal({
        situacao: "sem-sessao",
        pessoa: { nome: "Maria Souza" },
        organizacao: { id: "org-jardim", nome: "Jardim das Acácias" },
        papel: "solicitante",
      }),
    ).toStrictEqual({
      situacao: "sem-sessao",
      pessoa: { nome: "Maria Souza" },
      organizacao: { nome: "Jardim das Acácias" },
      papel: "solicitante",
    });
  });

  it("a página lê só pela estrada direta, tem as quatro faces e não marca gênero", () => {
    const pagina = ler("app/convite-pessoal/[token]/page.tsx");
    expect(pagina).toContain("resolverConvitePessoalParaTela(token)");
    expect(pagina).not.toContain("@/composicao");
    for (const situacao of ['"sem-sessao"', '"pode-aceitar"', '"ja-participa"']) expect(pagina).toContain(situacao);
    expect(pagina).toContain("TEXTOS.naoVale");
    // A face sem sessão monta o cadastro com o token e o nome, e nunca com o e-mail.
    expect(pagina).toContain("<FormularioDeCadastro convite={token} nomeInicial={convite.pessoa.nome}");
    expect(pagina).not.toMatch(/email/iu);
    // A face de quem tem conta diz em que conta a pessoa está, e dá o caminho de sair.
    expect(pagina).toContain("contaEmUso(contexto.pessoa.nome)");
    expect(pagina).toContain("<CaminhoDeSair />");
    expect(pagina).not.toMatch(/convidad[ao]/iu);
    expect(JSON.stringify(TEXTOS_DO_CONVITE_PESSOAL)).not.toMatch(/convidad[ao]/iu);
  });

  it("o detalhe monta o modal só quando o convite cabe", () => {
    const detalhe = ler("app/(casca)/vinculos/[pessoaId]/editar/page.tsx");
    expect(detalhe).toContain('convite === "botao" && situacaoDoEmail !== null ? (');
    expect(detalhe).toContain("<ConvidarParticipante");
    expect(detalhe).toContain("TEXTOS_DO_CONVITE_PESSOAL.semConviteEncarregado");
  });
});

describe("o envio por e-mail (item 122)", () => {
  const UUID = "4f6c1d6e-2b7a-4c1e-9f3a-1c2d3e4f5a6b";

  it("a rota existe, exporta só POST, exige vinculo.gerir e lê o corpo pelo schema", () => {
    const fonte = ler("app/api/convites-pessoais/envios/route.ts");
    expect(fonte.match(/^export const (GET|POST|PUT|PATCH|DELETE) /gmu)).toStrictEqual(["export const POST "]);
    expect(fonte).toContain('{ exige: "vinculo.gerir", corpo: envioDeConvitesSchema }');
  });

  it("a rota não está em lista fechada nenhuma: roda com sessão e organização", () => {
    const lint = ler("eslint.config.mjs");
    expect(lint).not.toContain("convites-pessoais/envios");
  });

  it("o schema confere só a forma: lista de UUID, sem campo a mais", () => {
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: "x" }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: ["nao-e-uuid"] }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: [UUID], extra: 1 }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: [] }).success).toBe(true);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: Array.from({ length: 25 }, () => UUID) }).success).toBe(true);
  });

  it("o lote inválido é 422, com o código próprio", () => {
    const { status, corpo } = problemaDe(new LoteDeEnvioInvalido("Envie até 20 por vez."), "/api/convites-pessoais/envios");
    expect(status).toBe(422);
    expect(corpo.codigo).toBe("LOTE_DE_ENVIO_INVALIDO");
  });
});

describe("a seleção e o envio em massa (item 122)", () => {
  const vinculoNaLinha = (id: string) =>
    ({ tipo: "vinculo", chave: `vinculo:${id}`, nome: `Pessoa ${id}`, vinculo: { pessoa: { pessoaId: id } } }) as unknown as LinhaDeParticipante;
  const pedidoNaLinha = (id: string) =>
    ({ tipo: "pedido", chave: `pedido:${id}`, nome: `Pedido ${id}` }) as unknown as LinhaDeParticipante;
  const comoVinculo = (linha: LinhaDeParticipante) => {
    if (!selecionavel(linha)) throw new Error("linha de pedido");
    return linha;
  };

  it("só linha de vínculo é selecionável, inclusive Encarregado, quem tem conta e o próprio Gestor", () => {
    expect(selecionavel(vinculoNaLinha("a"))).toBe(true);
    expect(selecionavel(pedidoNaLinha("p"))).toBe(false);
  });

  it("alternar marca e desmarca, e a seleção sobrevive à troca de página", () => {
    const linhas = Array.from({ length: 30 }, (_, i) => vinculoNaLinha(`v${String(i)}`));
    const primeira = paginar(linhas, 1).itens;
    const segunda = paginar(linhas, 2).itens;
    let selecao = alternar(SELECAO_VAZIA, comoVinculo(primeira[0]!));
    selecao = alternar(selecao, comoVinculo(segunda[0]!));
    expect([...selecao.keys()]).toStrictEqual([
      comoVinculo(primeira[0]!).vinculo.pessoa.pessoaId,
      comoVinculo(segunda[0]!).vinculo.pessoa.pessoaId,
    ]);
    expect(alternar(selecao, comoVinculo(primeira[0]!)).size).toBe(1);
  });

  it("a caixa do cabeçalho: nenhuma, parte, todas, e página só de pedidos", () => {
    const pagina = [vinculoNaLinha("a"), vinculoNaLinha("b"), pedidoNaLinha("p")];
    expect(estadoDaPagina(SELECAO_VAZIA, pagina)).toBe(false);
    expect(estadoDaPagina(alternar(SELECAO_VAZIA, comoVinculo(pagina[0]!)), pagina)).toBe("indeterminate");
    expect(estadoDaPagina(alternarPagina(SELECAO_VAZIA, pagina), pagina)).toBe(true);
    expect(estadoDaPagina(SELECAO_VAZIA, [pedidoNaLinha("p")])).toBe(false);
  });

  it("marcar a página não toca o que está marcado fora dela, e desmarcar tira só as dela", () => {
    const fora = vinculoNaLinha("fora");
    const pagina = [vinculoNaLinha("a"), vinculoNaLinha("b")];
    const marcada = alternarPagina(alternar(SELECAO_VAZIA, comoVinculo(fora)), pagina);
    expect(marcada.size).toBe(3);
    const desmarcada = alternarPagina(marcada, pagina);
    expect([...desmarcada.keys()]).toStrictEqual(["fora"]);
  });

  it("as frases da faixa, do botão, da pergunta e do excesso", () => {
    expect(faixaDaSelecao(1)).toBe("1 selecionado");
    expect(faixaDaSelecao(3)).toBe("3 selecionados");
    expect(rotuloDoBotaoEmMassa(3)).toBe("Convidar por e-mail (3)");
    expect(perguntaDoLote(1)).toBe("Enviar convite por e-mail para 1 participante?");
    expect(perguntaDoLote(12)).toBe("Enviar convite por e-mail para 12 participantes?");
    expect(excessoDoLote(20)).toBeNull();
    expect(excessoDoLote(23)).toBe("Envie até 20 por vez. Desmarque 3 para continuar.");
  });

  it("as sete frases dos motivos, exatas", () => {
    expect(Object.keys(FRASE_DO_MOTIVO).sort()).toStrictEqual([...MOTIVOS_DE_NAO_ENVIO].sort());
    expect(FRASE_DO_MOTIVO).toStrictEqual({
      "vinculo-revogado": "Não participa mais",
      "sem-email": "Sem e-mail cadastrado",
      "ja-tem-conta": "Já usa o aplicativo",
      encarregado: "Encarregados não recebem convite",
      "limite-do-dia": "Este endereço já recebeu convite hoje",
      "limite-do-participante": "Já recebeu os 10 convites por e-mail",
      "falha-no-envio": "O e-mail não pôde ser enviado. Tente de novo mais tarde",
    });
  });

  it("o lote: 200 é o resumo; 422, 500 e a rede são a falha inteira", () => {
    expect(desfechoDoLote(200)).toBe("resumo");
    expect(desfechoDoLote(422)).toBe("falha-inteira");
    expect(desfechoDoLote(500)).toBe("falha-inteira");
    expect(desfechoDoLote(0)).toBe("falha-inteira");
  });

  it("a tabela monta a caixa só na linha selecionável, pelo provedor, e não escreve a seleção no endereço", () => {
    const tabela = ler("src/interface/componentes/tabela-de-participantes.tsx");
    expect(tabela).toContain('import { Checkbox } from "@/interface/componentes/ui/checkbox"');
    expect(tabela).toContain("{selecionavel(linha) && (");
    expect(tabela).toContain("useSelecao()");
    expect(tabela).not.toMatch(/escreverEndereco\([^)]*selecao/u);
    expect(tabela).not.toContain("localStorage");
  });

  it("a página monta o provedor em volta do cabeçalho e da tabela, e o botão antes do cadastro", () => {
    const pagina = ler("app/(casca)/vinculos/page.tsx");
    expect(pagina.indexOf("<ProvedorDaSelecao>")).toBeLessThan(pagina.indexOf("<CabecalhoDaPagina"));
    expect(pagina.indexOf("</ProvedorDaSelecao>")).toBeGreaterThan(pagina.indexOf("<TabelaDeParticipantes"));
    expect(pagina.indexOf("<ConviteEmMassa")).toBeLessThan(pagina.indexOf("Cadastrar participante"));
  });

  it("o diálogo é AlertDialog, confirma com botão comum, some o Enviar acima do lote e não fecha enviando", () => {
    const dialogo = ler("src/interface/componentes/convite-em-massa.tsx");
    expect(dialogo).toContain("<AlertDialog ");
    expect(dialogo).not.toContain("<AlertDialogAction");
    expect(dialogo).toContain("excessoDoLote(n) === null && (");
    expect(dialogo).toContain("onEscapeKeyDown");
    expect(dialogo).toContain("if (enviando) return;");
  });
});

describe("o bloco de e-mail no modal do convite (item 122)", () => {
  it("a linha do último envio diz hoje no mesmo dia de Brasília, e a data em outro", () => {
    const agora = new Date("2026-10-04T16:00:00.000Z");
    expect(linhaDoUltimoEnvio("2026-10-04T13:00:00.000Z", agora)).toBe("Último convite por e-mail: hoje às 10:00");
    expect(linhaDoUltimoEnvio("2026-09-28T13:00:00.000Z", agora)).toBe("Último convite por e-mail: em 28/09 às 10:00");
  });

  it("à meia-noite de Brasília, o envio das 23:30 não é de hoje às 00:10", () => {
    expect(linhaDoUltimoEnvio("2026-10-04T02:30:00.000Z", new Date("2026-10-04T03:10:00.000Z"))).toBe(
      "Último convite por e-mail: em 03/10 às 23:30",
    );
  });

  it("as frases dos três impedimentos", () => {
    expect(fraseDoImpedimento("sem-email")).toBe("Sem e-mail cadastrado.");
    expect(fraseDoImpedimento("limite-do-dia")).toBe("Este endereço já recebeu convite hoje. O próximo pode sair amanhã.");
    expect(fraseDoImpedimento("limite-do-participante")).toBe("Já recebeu os 10 convites por e-mail.");
  });

  it("um botão principal por vez", () => {
    expect(principalDoModal({ impedimento: null })).toBe("email");
    expect(principalDoModal({ impedimento: "limite-do-dia" })).toBe("copiar");
    expect(principalDoModal({ impedimento: "sem-email" })).toBe("copiar");
  });

  it("o envio de um: saiu só com um enviado; o resto é falhou", () => {
    expect(desfechoDoEnvioUnico({ status: 200, corpo: { enviados: [{}], naoEnviados: [] } })).toBe("saiu");
    expect(desfechoDoEnvioUnico({ status: 200, corpo: { enviados: [], naoEnviados: [{}] } })).toBe("falhou");
    expect(desfechoDoEnvioUnico({ status: 500, corpo: null })).toBe("falhou");
    expect(desfechoDoEnvioUnico({ status: 0, corpo: null })).toBe("falhou");
  });

  it("o modal: o botão de e-mail só quando não há impedimento, sem disabled com motivo, e o link em todos os ramos", () => {
    const modal = ler("src/interface/componentes/convidar-participante.tsx");
    expect(modal).toContain('principalDoModal(situacao) === "email" && email !== null && (');
    expect(modal).toContain('<BotaoDeCopiar link={convite.link} principal={principal === "copiar"} />');
    // Os únicos `disabled` são os do carregamento.
    const desabilitados = modal.match(/disabled=\{[^}]+\}/gu) ?? [];
    expect(desabilitados.every((d) => /enviando/u.test(d))).toBe(true);
    expect(modal).toContain('href="#contatos"');
  });

  it("o detalhe lê a situação do e-mail e a passa ao modal", () => {
    const detalhe = ler("app/(casca)/vinculos/[pessoaId]/editar/page.tsx");
    expect(detalhe).toContain("situacaoDoConvitePorEmail(escopo.repos, vinculo)");
    expect(detalhe).toContain("situacaoDoEmail={situacaoDoEmail}");
    expect(ler("src/interface/componentes/sub-formulario-de-contatos.tsx")).toContain('id="contatos"');
  });
});
