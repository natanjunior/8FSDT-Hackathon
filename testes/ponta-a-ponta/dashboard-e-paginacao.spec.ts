import { expect, test, type Locator, type Page } from "@playwright/test";

import { cobre } from "./cobertura";
import { entrar, HELENA, marcaDoInstante, RECANTO, registrarOcorrencia } from "./mundo";

/**
 * ============================================================================
 *  O dashboard e a paginação, contra a semente de demonstração
 * ============================================================================
 *
 * **O quarto arquivo de ponta a ponta, e ele nasce pela ADR-0012**: o teste cresce por **jornada** do
 * roteiro de validação, com teto de seis arquivos. Esta é a jornada da Parte 7 — as duas telas que só
 * dizem alguma coisa quando há massa atrás delas: T-07, que precisa de meses de dados, e a paginação de
 * T-03, que precisa de mais de vinte ocorrências.
 *
 * **Por que ela vale o custo.** Os itens que ela percorre — `32·33·34·35·36`, `14b` e `43` — estão todos
 * com a coluna `Val` vazia no painel: ninguém abriu o dashboard contra a semente. E `app/` está medido
 * em **0,0% de instruções cobertas** em 60 arquivos; a composição destas duas páginas nunca executou
 * dentro de um teste.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo — exigência da ADR-0012
 * ---------------------------------------------------------------------------
 *
 * **O mundo é a semente de demonstração, e este arquivo não é dono dele.** Ele lê muito e escreve uma
 * coisa só: **uma** ocorrência no Condomínio Recanto Azul por corrida, com a marca do instante no
 * título, porque a linha de novidades do critério 14b.2 não existe sem que algo chegue depois do corte.
 * Nada semeado muda de estado, nenhuma configuração é tocada, nenhuma senha é redefinida.
 *
 * **A consequência está em toda asserção deste arquivo, e é a regra do lote:** o Recanto tem 24
 * ocorrências na primeira corrida, 25 na segunda, 26 na terceira. **Nenhuma asserção de contagem
 * absoluta contra a semente** — o que se afirma é forma e relação: os seis status existem e nenhum está
 * a zero, as sete categorias aparecem, todo mês da janela tem linha, a média cai entre 1 e 5, e a página
 * 2 traz os mesmos itens de onde quer que se peça.
 *
 * **Pré-requisitos, e eles não são automatizados de propósito:** a pilha de pé (`npm run local`) e a
 * semente aplicada (`SENHA_DA_DEMONSTRACAO=… npm run semear:demo`). Os dois estão no cabeçalho de
 * `caminho-critico.spec.ts`, com o argumento inteiro.
 *
 * ---------------------------------------------------------------------------
 *  O passo 10 do roteiro descreve um gesto que o produto não tem mais
 * ---------------------------------------------------------------------------
 *
 * O passo 10 da Parte 7 manda abrir uma ocorrência a partir da página 2 e **clicar em *Voltar***, caindo
 * na página 1 com corte novo. **O *Voltar* de T-05 saiu no item 44g** (critério 44g.10): *"o recorte vive
 * no endereço desta página, e é o botão voltar do navegador que o devolve a quem sai de T-05"*
 * (`app/(casca)/ocorrencias/page.tsx`). Não há botão a clicar, e não há como cair na página 1.
 *
 * **O que este teste afirma no lugar é o que o produto passou a prometer:** o botão voltar do navegador
 * devolve o endereço da página 2 inteiro — `pagina`, `ate` e `totalNoCorte` —, e com ele exatamente as
 * mesmas ocorrências, embora uma nova tenha chegado no meio. É a compensação de deslocamento do 14b
 * funcionando pela fiação, e não pelo teste de unidade. **O roteiro é que ficou para trás; é achado de
 * roteiro, não de produto.**
 *
 * ---------------------------------------------------------------------------
 *  O que este arquivo NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | O **32.5 na forma forte** — os cinco quadros batendo com o resumo que a semente imprime | Exige um mundo intocado, e este teste acrescenta a ele. Continua sendo passada humana |
 * | O **43.1** — o resumo impresso no terminal pelo `npm run semear:demo` | É saída de programa, não de tela. Nenhum navegador a alcança |
 * | **O que o gráfico do bloco 1 desenha** (35) | Ele é `aria-hidden` por decisão do compromisso A-5, e o número por série vive na lista ao lado — que é o que tem asserção. Aqui se prova que ele **desenhou** |
 * | A **suavidade** da troca de página (14.7) | O que é mecanizável é o esqueleto **não** reaparecer e a lista anterior **não** sumir; que a transição seja agradável é olho humano |
 * | O recorte de celular e a barra fixa do rodapé | O Playwright roda em 1280 px por decisão do `playwright.config.ts` |
 * | O período escolhido à mão (`De`, `Até`, `Aplicar`) e a faixa de período inválido | São o formulário de T-07, e a janela padrão é a que a semente foi construída para encher. Um período digitado seria outra jornada |
 * | O quarto estado da lista — *página além do fim* | Ele já tem teste de unidade em `estadoDaLista`, e alcançá-lo aqui pediria uma página que não existe, que é URL editada à mão e não gesto de tela |
 */

const MARCA = marcaDoInstante();
const TITULO_DA_NOVA = `Novidade ${MARCA} — lâmpada queimada na escada do bloco B`;
const DESCRICAO_DA_NOVA =
  "A lâmpada do patamar entre o segundo e o terceiro andar está apagada desde ontem à noite.";

/** Os seis status na lente do Gestor, que é a do dashboard — `NOME_DO_STATUS`, critério 32.3. */
const SEIS_STATUS = ["Aberta", "Em análise", "Em atendimento", "Pausada", "Resolvida", "Cancelada"];

/** As sete categorias com que toda organização nasce (critério 4a, semente de categorias). */
const CATEGORIAS_DA_SEMENTE = 7;

/** O tamanho de página do contrato — `LIMITE_PADRAO`. */
const POR_PAGINA = 20;

/**
 * Um dos cinco quadros de T-07. **Escopado pela `section` do `Cartao`, e nunca por posição:** os cinco
 * são irmãos dentro do `<main>` da casca, e nenhuma outra peça da casca é `section`.
 *
 * **O nome vai em expressão regular insensível a caixa** porque o título do quadro é `uppercase` por
 * CSS, e o que a página serve é *"Backlog por status"*.
 */
function quadro(pagina: Page, titulo: string): Locator {
  return pagina
    .locator("section")
    .filter({ hasText: new RegExp(titulo, "iu") })
    .first();
}

/**
 * As linhas de um `Medidor` — rótulo à esquerda, texto à direita, barra no meio.
 *
 * **Lido por localizador, e não por `split` do texto do item.** A linha do mês sem resolução troca a
 * barra por uma frase de cinco palavras, e qualquer parse posicional sobre o texto inteiro do `li`
 * quebraria justamente ali — que é a linha que o critério 36.2 existe para conferir.
 */
async function linhasDoMedidor(secao: Locator): Promise<{ rotulo: string; texto: string }[]> {
  const itens = secao.getByRole("listitem");
  const quantas = await itens.count();

  const linhas: { rotulo: string; texto: string }[] = [];
  for (let indice = 0; indice < quantas; indice += 1) {
    const colunas = itens.nth(indice).locator(":scope > span");
    linhas.push({
      rotulo: (await colunas.first().innerText()).trim(),
      texto: (await colunas.last().innerText()).trim(),
    });
  }
  return linhas;
}

/** Os endereços de T-05 que a tabela de triagem está mostrando, na ordem em que estão. */
async function enderecosNaTabela(pagina: Page): Promise<string[]> {
  return pagina
    .locator('tbody a[href^="/ocorrencias/"]')
    .evaluateAll((ancoras) => ancoras.map((ancora) => ancora.getAttribute("href") ?? ""));
}

/** Quantos meses de calendário a janela toca — o eixo único do critério 36.2. */
function mesesNaJanela(de: string, ate: string): number {
  const anos = Number(ate.slice(0, 4)) - Number(de.slice(0, 4));
  return anos * 12 + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7))) + 1;
}

/**
 * A sonda da troca de página — critério 14.7, e ela roda **dentro** do navegador.
 *
 * **Uma asserção de fora não alcança isto.** O esqueleto, se aparecesse, viveria os milissegundos entre
 * o clique e a resposta; um `toHaveCount(0)` depois da chegada não afirmaria nada, porque nesse instante
 * ele já teria sumido. O que se instala é um observador que conta **toda** vez que a árvore passou por
 * um estado proibido, e a leitura acontece depois.
 *
 * Dois estados proibidos, os dois em palavras do roteiro: *"nunca aparece o esqueleto cinza"* e *"a
 * lista da página 1 fica na tela"*.
 */
async function instalarSondaDaTroca(pagina: Page): Promise<void> {
  await pagina.evaluate(() => {
    const sonda = { esqueleto: 0, listaVazia: 0 };
    (window as unknown as { __sondaDaTroca: typeof sonda }).__sondaDaTroca = sonda;

    const olhar = (): void => {
      if (document.querySelector('[data-slot="skeleton"]') !== null) sonda.esqueleto += 1;
      if (document.querySelectorAll("tbody tr").length === 0) sonda.listaVazia += 1;
    };

    olhar();
    new MutationObserver(olhar).observe(document.body, { childList: true, subtree: true });
  });
}

async function lerSondaDaTroca(pagina: Page): Promise<{ esqueleto: number; listaVazia: number }> {
  return pagina.evaluate(() => {
    const janela = window as unknown as {
      __sondaDaTroca?: { esqueleto: number; listaVazia: number };
    };
    // **A sonda ausente é FALHA, e não zero.** Ela só some se a troca de página tiver recarregado o
    // documento inteiro — que é o defeito mais grave que este passo poderia encontrar, e o número
    // impossível é o que o faz aparecer como vermelho em vez de como verde.
    return janela.__sondaDaTroca ?? { esqueleto: -1, listaVazia: -1 };
  });
}

test("o dashboard e a paginação contra a semente, com a linha de novidades", async ({ browser }) => {
  const contexto = await browser.newContext();
  const helena = await contexto.newPage();

  // -------------------------------------------------------------------------
  // 1 · Helena entra e escolhe o Recanto Azul, onde ela é Gestora
  //
  // **Os dois vínculos dela são o que torna T-02 obrigatória**, e é o Recanto que interessa aqui: o
  // dashboard pede `dashboard.ler`, que o Solicitante do Aurora não tem, e as 24 ocorrências de que o
  // critério 14b precisa moram deste lado.
  // -------------------------------------------------------------------------
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  // -------------------------------------------------------------------------
  // 2 · O dashboard, pelo menu da casca — passo 2 do roteiro
  // -------------------------------------------------------------------------
  await helena.getByRole("link", { name: "Dashboard" }).click();
  await helena.waitForURL(/\/dashboard$/u);
  await expect(helena.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  // O formulário de período, com a janela padrão dos 90 dias já preenchida (critério 32.1).
  const de = await helena.getByLabel("De", { exact: true }).inputValue();
  const ate = await helena.getByLabel("Até", { exact: true }).inputValue();
  expect(de).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(ate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(de < ate).toBe(true);
  await expect(helena.getByRole("button", { name: "Aplicar" })).toBeVisible();
  await expect(helena.getByRole("link", { name: "últimos 90 dias" })).toBeVisible();

  // -------------------------------------------------------------------------
  // 2.1 · Quadro 1 · Recorrência no período — o gráfico DESENHOU (critério 35)
  //
  // **O que se afirma é que ele existe com superfície**, e não o que ele mostra: o `ChartContainer` é
  // `aria-hidden` por decisão do compromisso A-5, e o número por série vive na lista ao lado — que é o
  // que tem asserção logo abaixo. Um gráfico que não renderiza deixa a lista intacta, e passaria
  // despercebido por qualquer asserção de texto.
  // -------------------------------------------------------------------------
  const recorrencia = quadro(helena, "Recorrência");
  await expect(recorrencia).toContainText("no período");
  await expect(recorrencia).toContainText(
    "Oito vazamentos no mesmo bloco em três meses não são oito ordens de serviço.",
  );
  await expect(recorrencia.locator('[data-slot="chart"] svg').first()).toBeVisible();

  // As duas listas do bloco 1, com o número em texto — A-5. Nenhuma das duas vazia.
  const listasDoBloco1 = recorrencia.getByRole("list");
  await expect(listasDoBloco1).toHaveCount(2);
  expect((await linhasDoMedidor(recorrencia)).length).toBeGreaterThan(1);
  cobre(test.info(), "7.2 · 1", {
    falta:
      "o gráfico de linha por categoria e as barras por área — só a existência de uma superfície de desenho tem asserção",
  });

  // -------------------------------------------------------------------------
  // 2.2 · Quadro 2 · Backlog por status agora — os SEIS, nenhum a zero (critério 33)
  //
  // **`agora` é o critério 33.4**, e não enfeite: sem a palavra, o Gestor lê o backlog como se ele
  // respeitasse o período que acabou de escolher.
  // -------------------------------------------------------------------------
  const backlogPorStatus = quadro(helena, "Backlog por status");
  await expect(backlogPorStatus).toContainText("agora");

  const linhasDeStatus = await linhasDoMedidor(backlogPorStatus);
  expect(linhasDeStatus.map((linha) => linha.rotulo)).toEqual(SEIS_STATUS);
  for (const linha of linhasDeStatus) {
    expect(Number(linha.texto), `status "${linha.rotulo}" no dashboard`).toBeGreaterThan(0);
  }
  cobre(test.info(), "7.2 · 2", { criterio: "33" });

  // -------------------------------------------------------------------------
  // 2.3 · Quadro 3 · Backlog por categoria agora — as sete (critério 33)
  // -------------------------------------------------------------------------
  const backlogPorCategoria = quadro(helena, "Backlog por categoria");
  await expect(backlogPorCategoria).toContainText("agora");

  const linhasDeCategoria = await linhasDoMedidor(backlogPorCategoria);
  expect(linhasDeCategoria).toHaveLength(CATEGORIAS_DA_SEMENTE);
  for (const linha of linhasDeCategoria) {
    expect(Number.isInteger(Number(linha.texto)), `categoria "${linha.rotulo}"`).toBe(true);
  }
  cobre(test.info(), "7.2 · 3", { falta: "os nomes das sete categorias e a barra de cada linha" });

  // -------------------------------------------------------------------------
  // 2.4 · Quadro 4 · Tempo médio de resolução — nenhum mês omitido (critérios 36.2 e 43.2)
  //
  // **O eixo esperado é calculado a partir do que o formulário mostra**, e não fixado num número: a
  // janela de 90 dias toca três, quatro ou cinco meses conforme o dia em que a corrida acontece, e um
  // número escrito aqui seria um teste que muda de resultado na virada do mês.
  // -------------------------------------------------------------------------
  const tempoMedio = quadro(helena, "Tempo médio de resolução");
  await expect(tempoMedio).toContainText("no período");
  await expect(tempoMedio).toContainText("Tempo de calendário, com as pausas.");

  const linhasDeMes = await linhasDoMedidor(tempoMedio);
  expect(linhasDeMes).toHaveLength(mesesNaJanela(de, ate));

  const mesesSemResolucao = linhasDeMes.filter((linha) => linha.texto.startsWith("—"));
  expect(mesesSemResolucao.length).toBeGreaterThan(0);
  await expect(tempoMedio).toContainText("nenhuma resolução no mês");
  for (const mes of mesesSemResolucao) {
    // **`— · 0 resolvidas`, e nunca `0 h`** — critério 36.2: um zero de horas diria que o mês resolveu
    // instantaneamente, quando o que houve foi não ter resolvido nada.
    expect(mes.texto, `mês "${mes.rotulo}"`).toBe("— · 0 resolvidas");
  }
  cobre(test.info(), "7.2 · 4", {
    falta:
      "amarrar a frase nenhuma resolução no mês à linha do mês vazio, e com ela a ausência da barra",
  });

  // -------------------------------------------------------------------------
  // 2.5 · Quadro 5 · Média das avaliações — um número de 1 a 5 (critério 34)
  //
  // **O denominador ao lado é o critério 34.3:** *"sem ele a média mente quando poucos avaliam"*.
  // -------------------------------------------------------------------------
  const mediaDasAvaliacoes = quadro(helena, "Média das avaliações");
  await expect(mediaDasAvaliacoes).toContainText("no período");
  await expect(mediaDasAvaliacoes).toContainText("de 1 a 5");
  await expect(mediaDasAvaliacoes).not.toContainText("Nenhuma ocorrência avaliada ainda");

  const textoDaMedia = await mediaDasAvaliacoes.innerText();
  const lidaNaTela = /(\d+,\d+)\s*de 1 a 5/u.exec(textoDaMedia);
  expect(lidaNaTela, `o quadro 5 imprimiu: ${textoDaMedia}`).not.toBeNull();
  const media = Number((lidaNaTela?.[1] ?? "").replace(",", "."));
  expect(media).toBeGreaterThanOrEqual(1);
  expect(media).toBeLessThanOrEqual(5);

  const denominador = /(\d+) de (\d+) resolvidas avaliadas/u.exec(textoDaMedia);
  expect(denominador, `o quadro 5 imprimiu: ${textoDaMedia}`).not.toBeNull();
  const avaliadas = Number(denominador?.[1] ?? "0");
  const resolvidas = Number(denominador?.[2] ?? "0");
  expect(avaliadas).toBeGreaterThan(0);
  expect(resolvidas).toBeGreaterThanOrEqual(avaliadas);
  cobre(test.info(), "7.2 · 5", { criterio: "34" });

  // -------------------------------------------------------------------------
  // 3 · A lista, com a página 1 cheia — passo 7 do roteiro
  //
  // **A asserção é de forma, nunca de total:** o Recanto tem 24 ocorrências na primeira corrida e ganha
  // uma a cada corrida deste arquivo. O que é estável é a página 1 estar cheia e existir uma página 2.
  // -------------------------------------------------------------------------
  await helena.getByRole("link", { name: "Ocorrências" }).first().click();
  await helena.waitForURL(/\/ocorrencias$/u);

  const navegacaoDePaginas = helena.getByRole("navigation", { name: "Navegação entre páginas" });
  await expect(navegacaoDePaginas).toBeVisible();
  await expect(helena.getByText(/Página 1 de \d+ · \d+ ocorrências no corte/u)).toBeVisible();
  await expect(helena.locator("tbody tr")).toHaveCount(POR_PAGINA);

  // -------------------------------------------------------------------------
  // 3.1 · A troca para a página 2, sem esqueleto e sem lista vazia — critério 14.7
  // -------------------------------------------------------------------------
  await instalarSondaDaTroca(helena);
  await navegacaoDePaginas.getByRole("link", { name: "2", exact: true }).click();

  await helena.waitForURL(/[?&]pagina=2(&|$)/u);
  await expect(helena.getByText(/Página 2 de \d+/u)).toBeVisible();

  const sonda = await lerSondaDaTroca(helena);
  expect(sonda.esqueleto, "o esqueleto cinza apareceu na troca de página").toBe(0);
  expect(sonda.listaVazia, "a lista anterior sumiu antes de a página 2 chegar").toBe(0);
  cobre(test.info(), "7.3 · 7", {
    falta:
      "a lista da página 1 ficar esmaecida na espera — a sonda prova que ela não some, não que ela esmaece",
  });

  // O endereço da página 2 carrega os três parâmetros de paginação — critério 14b.2.
  const enderecoDaPagina2 = helena.url();
  expect(enderecoDaPagina2).toMatch(/[?&]ate=/u);
  expect(enderecoDaPagina2).toMatch(/[?&]totalNoCorte=\d+/u);

  const daPagina2 = await enderecosNaTabela(helena);
  expect(daPagina2.length).toBeGreaterThan(0);
  expect(daPagina2.length).toBeLessThanOrEqual(POR_PAGINA);

  // -------------------------------------------------------------------------
  // 4 · O mesmo endereço numa aba nova — passo 8 do roteiro, critério 14b.2
  //
  // **É aqui que o endereço compartilhável deixa de ser promessa.** A página 2 chegou por transição do
  // cliente; esta abertura é renderização do servidor a partir da URL, e os dois caminhos têm de
  // produzir a mesma lista.
  // -------------------------------------------------------------------------
  const outraAba = await contexto.newPage();
  await outraAba.goto(enderecoDaPagina2);
  await expect(outraAba.getByText(/Página 2 de \d+/u)).toBeVisible();
  expect(await enderecosNaTabela(outraAba)).toEqual(daPagina2);
  cobre(test.info(), "7.3 · 8", { criterio: "14b.2" });

  // -------------------------------------------------------------------------
  // 5 · A linha de novidades — passo 9 do roteiro, critério 14b.2
  //
  // **A única escrita deste arquivo no mundo compartilhado**, e ela acontece numa terceira aba da MESMA
  // sessão, que é o gesto que o roteiro descreve. A ocorrência nasce depois do corte que as outras duas
  // abas carregam, e é isso que faz a frase aparecer.
  // -------------------------------------------------------------------------
  const terceiraAba = await contexto.newPage();
  await terceiraAba.goto("/ocorrencias");
  await registrarOcorrencia(terceiraAba, TITULO_DA_NOVA, DESCRICAO_DA_NOVA);

  await outraAba.reload();
  const deriva = outraAba.getByRole("status").filter({ hasText: "Esta lista é o retrato de" });
  await expect(deriva).toBeVisible();
  await expect(deriva).toContainText(/\d+h\d+/u);
  await expect(deriva).toContainText("1 chegou desde então");
  cobre(test.info(), "7.3 · 9", { criterio: "14b.2" });

  // **A página 2 continua sendo a mesma**, com uma ocorrência nova no conjunto: é a compensação de
  // deslocamento do `totalNoCorte`, e sem ela a lista pularia itens respondendo `200` com vinte linhas.
  expect(await enderecosNaTabela(outraAba)).toEqual(daPagina2);

  // -------------------------------------------------------------------------
  // 5.1 · [Atualizar] refaz o corte e mantém a página — o que a frase promete
  // -------------------------------------------------------------------------
  await deriva.getByRole("button", { name: "Atualizar" }).click();
  await outraAba.waitForURL((url) => !url.searchParams.has("ate"));
  expect(outraAba.url()).toMatch(/[?&]pagina=2(&|$)/u);
  expect(outraAba.url()).not.toMatch(/totalNoCorte/u);
  await expect(
    outraAba.getByRole("status").filter({ hasText: "Esta lista é o retrato de" }),
  ).toHaveCount(0);

  // -------------------------------------------------------------------------
  // 6 · Sair da página 2 para T-05 e voltar pelo navegador — passo 10 do roteiro, critério 14b.9
  //
  // **O gesto mudou, e a razão está no cabeçalho deste arquivo:** T-05 não tem mais *Voltar* (critério
  // 44g.10), e quem devolve o recorte é o botão do navegador. O que se prova é que ele devolve o
  // endereço inteiro — com `ate` e `totalNoCorte` — e, com ele, exatamente as mesmas ocorrências,
  // apesar de uma ter chegado no meio.
  // -------------------------------------------------------------------------
  const primeiraDaPagina2 = daPagina2[0] ?? "";
  expect(primeiraDaPagina2).not.toBe("");

  await helena.locator(`tbody a[href="${primeiraDaPagina2}"]`).click();
  await helena.waitForURL(new RegExp(`${primeiraDaPagina2}$`, "u"));
  await expect(helena.getByRole("button", { name: "Voltar" })).toHaveCount(0);

  await helena.goBack();
  await helena.waitForURL(/[?&]pagina=2(&|$)/u);
  expect(helena.url()).toBe(enderecoDaPagina2);
  await expect(helena.getByText(/Página 2 de \d+/u)).toBeVisible();
  expect(await enderecosNaTabela(helena)).toEqual(daPagina2);
  cobre(test.info(), "7.3 · 10", {
    falta:
      "a volta pela barra lateral caindo na página 1 com corte novo — o teste volta pelo botão do navegador, que devolve a página 2 inteira",
  });

  await terceiraAba.close();
  await outraAba.close();
  await contexto.close();
});
