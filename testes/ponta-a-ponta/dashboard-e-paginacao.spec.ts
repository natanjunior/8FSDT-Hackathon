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
 * | O **32.5 na forma forte** — os cinco quadros **que o resumo cobre** batendo com o resumo que a semente imprime | Exige um mundo intocado, e este teste acrescenta a ele. Continua sendo passada humana |
 * | O **43.1** — o resumo impresso no terminal pelo `npm run semear:demo` | É saída de programa, não de tela. Nenhum navegador a alcança |
 * | **A forma que o gráfico do bloco 1 desenha** (35, 57.2) | Ele é `aria-hidden` por decisão do compromisso A-5, e os dois números de cada mês vivem na lista ao lado — que é o que tem asserção. Aqui se prova que ele **desenhou**, e que cada série se nomeia em palavra |
 * | A **suavidade** da troca de página (14.7) | O que é mecanizável é o esqueleto **não** reaparecer e a lista anterior **não** sumir; que a transição seja agradável é olho humano |
 * | O recorte de celular e a barra fixa do rodapé | O Playwright roda em 1280 px por decisão do `playwright.config.ts`. A exceção é o quadro 4, medido também a 390 px pelo item 61, porque é onde a barra do mês de maior mediana sumia |
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
 * Um dos seis quadros de T-07. **Escopado pela `section` do `Cartao`, e nunca por posição:** os seis
 * são irmãos dentro do `<main>` da casca, e nenhuma outra peça da casca é `section`.
 *
 * **O nome vai em expressão regular insensível a caixa** porque o título do quadro é `uppercase` por
 * CSS, e o que a página serve é *"Ocorrências por status"*.
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

/**
 * As medidas em pixels das linhas COM barra de um `Medidor` — o trilho, a barra, e a porcentagem que a
 * barra declara. A linha do mês sem resolução não tem barra, e sai com `barra: null`.
 *
 * **Lido pelo DOM, e não por papel**, porque a barra é `aria-hidden` (A-5): o que se mede é desenho. O
 * trilho é o segundo filho do `<li>`, e a barra é o filho único dele.
 */
async function medidasDasBarras(
  secao: Locator,
): Promise<{ trilho: number; barra: number | null; porcento: number | null }[]> {
  return secao.getByRole("listitem").evaluateAll((itens) =>
    itens.map((item) => {
      const trilho = item.children[1] as HTMLElement;
      const barra = trilho.firstElementChild as HTMLElement | null;
      return {
        trilho: trilho.getBoundingClientRect().width,
        barra: barra === null ? null : barra.getBoundingClientRect().width,
        porcento: barra === null ? null : Number.parseFloat(barra.style.width),
      };
    }),
  );
}

/**
 * **Barras de trilhos diferentes não se comparam** — item 61. Todo trilho com barra da mesma lista tem a
 * mesma largura, e cada barra mede a própria porcentagem aplicada a ele; juntas, as duas dizem que
 * ordenar as linhas pela barra é ordená-las pela quantidade. A tolerância de 1 px é o arredondamento
 * de subpixel do motor.
 */
function barrasComparaveis(
  medidas: readonly { trilho: number; barra: number | null; porcento: number | null }[],
  onde: string,
): void {
  const comBarra = medidas.filter((medida) => medida.barra !== null);
  expect(comBarra.length, onde).toBeGreaterThan(0);
  const primeiro = comBarra[0]?.trilho ?? 0;
  expect(primeiro, `${onde}: trilho maior que zero`).toBeGreaterThan(0);
  for (const medida of comBarra) {
    expect(Math.abs(medida.trilho - primeiro), `${onde}: trilhos iguais`).toBeLessThanOrEqual(1);
    const esperada = ((medida.porcento ?? 0) / 100) * medida.trilho;
    expect(Math.abs((medida.barra ?? 0) - esperada), `${onde}: barra proporcional`).toBeLessThanOrEqual(1);
  }
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
  // No recorte padrão o atalho é texto apagado, e não link (critério 69.1): o rótulo continua o mesmo.
  await expect(helena.getByText("últimos 90 dias", { exact: true })).toBeVisible();
  await expect(helena.getByRole("link", { name: "últimos 90 dias" })).toHaveCount(0);

  // -------------------------------------------------------------------------
  // 2.1 · Quadro 1 · Recorrência no período — as quatro seções (critérios 35, 57 e 60)
  //
  // **A seção de cima é a que responde a pergunta da tela.** O gráfico desenha duas linhas — quanto foi
  // registrado e quanto foi resolvido em cada mês —, e o mesmo array alimenta a lista ao lado: por isso
  // a contagem de linhas da lista tem de bater com o eixo do quadro 4, e é essa asserção que pega o eixo
  // derivando entre os dois blocos.
  //
  // **O gráfico é `aria-hidden`**, então o que se afirma dentro dele é nó de DOM, nunca papel: a
  // superfície existe, e a identidade de cada série está escrita em palavra duas vezes — no rótulo de
  // ponta, dentro do SVG, e na legenda, fora dele (critério 57.4).
  //
  // **Os índices posicionais saíram daqui no item 60, e a razão é que eles quebrariam em silêncio.** A
  // seção do par entrou em segundo, então `nth(1)` e `nth(2)` passariam a apontar para outra lista e
  // continuariam verdes afirmando a coisa errada. Somar um aos índices não resolveria: a seção do par
  // pode não renderizar lista nenhuma — sem dupla repetida ali há uma frase —, e o índice voltaria a
  // escorregar. As quatro sublistas passam a ser alcançadas pelo próprio título, por `role="group"`
  // mais `aria-labelledby`, e a âncora da expressão é o que separa *Por área* de *Por área e
  // categoria*.
  // -------------------------------------------------------------------------
  const recorrencia = quadro(helena, "Recorrência");
  await expect(recorrencia).toContainText("no período");
  await expect(recorrencia).toContainText(
    "Oito vazamentos no mesmo bloco em três meses não são oito ordens de serviço.",
  );
  await expect(
    recorrencia.getByRole("heading", { name: "Registradas e resolvidas" }),
  ).toBeVisible();

  const grafico = recorrencia.locator('[data-slot="chart"]');
  await expect(grafico.locator("svg").first()).toBeVisible();

  // **Uma ocorrência de cada palavra, e não "pelo menos uma".** Duas seriam o rótulo desenhando em todo
  // ponto em vez de só na ponta, que é o defeito que o `valueAccessor` existe para não ter.
  for (const serie of ["Registradas", "Resolvidas"]) {
    await expect(
      grafico.locator("svg text").filter({ hasText: new RegExp(`^${serie}$`, "u") }),
    ).toHaveCount(1);
  }

  const legenda = grafico.locator(".recharts-legend-wrapper");
  await expect(legenda).toContainText("Registradas");
  await expect(legenda).toContainText("Resolvidas");

  // As QUATRO seções do bloco 1, cada uma pelo nome acessível do `h3` dela. A âncora da expressão é o
  // que separa *Por área* de *Por área e categoria*; `exact` não serve, porque o título é `uppercase`
  // por CSS e o que a página serve é a caixa mista.
  const fluxo = recorrencia.getByRole("group", { name: /^Registradas e resolvidas$/iu });
  const par = recorrencia.getByRole("group", { name: /^Por área e categoria$/iu });
  const porCategoria = recorrencia.getByRole("group", { name: /^Por categoria$/iu });
  const porArea = recorrencia.getByRole("group", { name: /^Por área$/iu });

  for (const secao of [fluxo, par, porCategoria, porArea]) {
    await expect(secao).toBeVisible();
  }

  const mesesDoFluxo = await linhasDoMedidor(fluxo);
  expect(mesesDoFluxo).toHaveLength(mesesNaJanela(de, ate));
  for (const mes of mesesDoFluxo) {
    // **A gramática é do critério 57.5**, e o singular vale dos dois lados.
    expect(mes.texto, `mês "${mes.rotulo}"`).toMatch(/^\d+ registradas? · \d+ resolvidas?$/u);
  }

  // **Nenhuma contagem absoluta contra a semente na seção do par**, e o número está atrás da regra: o
  // Recanto tem UMA dupla repetida na janela padrão e a Aurora não tem nenhuma, e o passo 4 deste teste
  // registra uma ocorrência por corrida, que move o par de posição na segunda. O que se afirma é a
  // gramática: ou linhas no formato `rótulo · rótulo` com um inteiro de dois para cima, ou a frase de
  // vazio. As duas formas são corretas, e por isso as duas estão aqui.
  const duplas = await linhasDoMedidor(par);
  if (duplas.length === 0) {
    await expect(par).toContainText("Nenhuma dupla se repetiu no período.");
  } else {
    for (const dupla of duplas) {
      expect(dupla.rotulo, "rótulo da dupla").toMatch(/^.+ · .+$/u);
      // O critério 60.2: dupla com uma não aparece.
      expect(Number(dupla.texto), `dupla "${dupla.rotulo}"`).toBeGreaterThanOrEqual(2);
    }
  }

  // As duas listas de baixo continuam onde estavam, e nenhuma das duas vazia.
  expect((await linhasDoMedidor(porCategoria)).length).toBeGreaterThan(1);
  expect((await linhasDoMedidor(porArea)).length).toBeGreaterThan(1);

  cobre(test.info(), "7.2 · 1", {
    criterio: "57.2, 57.4, 57.5, 60.2, 60.3, 60.4",
    falta:
      "que as duas linhas não se empilhem e que os dois rótulos de ponta não se sobreponham — o desenho é aria-hidden, e o que tem asserção é a existência dele; e, na seção do par, o corte por posição da lista e a contagem exata contra a semente, que continuam sendo olho humano",
  });

  // -------------------------------------------------------------------------
  // 2.2 · Quadro 2 · Ocorrências por status agora — os SEIS, nenhum a zero (critérios 33 e 56.3)
  //
  // **`agora` é o critério 33.4**, e não enfeite: sem a palavra, o Gestor leria o quadro como se ele
  // respeitasse o período que acabou de escolher. **O título deixou de dizer `backlog`** (item 56):
  // este quadro conta tudo o que a organização registrou, inclusive os terminais.
  // -------------------------------------------------------------------------
  const ocorrenciasPorStatus = quadro(helena, "Ocorrências por status");
  await expect(ocorrenciasPorStatus).toContainText("agora");

  const linhasDeStatus = await linhasDoMedidor(ocorrenciasPorStatus);
  expect(linhasDeStatus.map((linha) => linha.rotulo)).toEqual(SEIS_STATUS);
  for (const linha of linhasDeStatus) {
    expect(Number(linha.texto), `status "${linha.rotulo}" no dashboard`).toBeGreaterThan(0);
  }
  cobre(test.info(), "7.2 · 2", { criterio: "33, 56.3" });

  // -------------------------------------------------------------------------
  // 2.3 · Quadro 3 · Em aberto por categoria agora — as sete (critérios 33, 56.1 e 56.4)
  // -------------------------------------------------------------------------
  const emAbertoPorCategoria = quadro(helena, "Em aberto por categoria");
  await expect(emAbertoPorCategoria).toContainText("agora");
  await expect(emAbertoPorCategoria).toContainText("Só o que está em aberto");

  const linhasDeCategoria = await linhasDoMedidor(emAbertoPorCategoria);
  expect(linhasDeCategoria).toHaveLength(CATEGORIAS_DA_SEMENTE);
  for (const linha of linhasDeCategoria) {
    expect(Number.isInteger(Number(linha.texto)), `categoria "${linha.rotulo}"`).toBe(true);
  }

  // **A soma do quadro 3 é a soma das QUATRO primeiras linhas do quadro 2** — e é igualdade exata por
  // construção: `ocorrencias.categoria_id` é `not null` desde a migração 005, e o `join` casa
  // `organizacao_id`, então nenhuma ocorrência em aberto fica fora de uma categoria. O `slice(0, 4)` é
  // seguro porque a ordem dos seis está pinada logo acima, na ordem do ciclo.
  //
  // **É a asserção que pega a regressão que a gramática não pega.** Se o filtro de status voltar para o
  // `where`, a igualdade some junto com as categorias a zero; se o filtro sumir, a desigualdade estrita
  // cai. A desigualdade é estrita porque a seção 2.2 já afirmou que nenhum dos seis está em zero.
  const soma = (linhas: readonly { texto: string }[]) =>
    linhas.reduce((total, linha) => total + Number(linha.texto), 0);
  const naoTerminais = soma(linhasDeStatus.slice(0, 4));

  expect(soma(linhasDeCategoria)).toBe(naoTerminais);
  expect(soma(linhasDeCategoria)).toBeLessThan(soma(linhasDeStatus));

  cobre(test.info(), "7.2 · 3", {
    criterio: "56.1, 56.4",
    falta: "os nomes das sete categorias e a barra de cada linha",
  });

  // -------------------------------------------------------------------------
  // 2.4 · Quadro 4 · Tempo de resolução — nenhum mês omitido (critérios 36.2 e 43.2)
  //
  // **O eixo esperado é calculado a partir do que o formulário mostra**, e não fixado num número: a
  // janela de 90 dias toca três, quatro ou cinco meses conforme o dia em que a corrida acontece, e um
  // número escrito aqui seria um teste que muda de resultado na virada do mês.
  // -------------------------------------------------------------------------
  const tempoDeResolucao = quadro(helena, "Tempo de resolução");
  await expect(tempoDeResolucao).toContainText("no período");
  await expect(tempoDeResolucao).toContainText("Tempo de calendário, com as pausas.");
  await expect(tempoDeResolucao).toContainText(
    "Mês com três resoluções ou menos mostra as durações uma a uma.",
  );

  const linhasDeMes = await linhasDoMedidor(tempoDeResolucao);
  expect(linhasDeMes).toHaveLength(mesesNaJanela(de, ate));

  const mesesSemResolucao = linhasDeMes.filter((linha) => linha.texto.startsWith("—"));
  expect(mesesSemResolucao.length).toBeGreaterThan(0);
  await expect(tempoDeResolucao).toContainText("nenhuma resolução no mês");
  for (const mes of mesesSemResolucao) {
    // **`— · 0 resolvidas`, e nunca `0 h`** — critério 36.2: um zero de horas diria que o mês resolveu
    // instantaneamente, quando o que houve foi não ter resolvido nada.
    expect(mes.texto, `mês "${mes.rotulo}"`).toBe("— · 0 resolvidas");
  }

  // **O mês COM resolução escreve uma das DUAS formas do item 58**, e a gramática não aposta em qual: a
  // semente espalha os instantes pelo balde do mês, então quantas resoluções cada mês recebe muda com o
  // dia em que a suíte roda. É a mesma cautela do eixo de meses calculado, algumas linhas acima.
  //
  // - quatro ou mais: `mediana 12 min · p90 2,1 dias · 11 resolvidas`
  // - três ou menos:  `6 min, 12 min, 3,0 dias · 3 resolvidas`
  //
  // **A unidade cabe à magnitude** — item 55, critérios 55.1 e 55.2.
  const DURACAO = String.raw`(?:menos de 1 min|\d+ min|\d+ h|\d+,\d dias)`;
  const LINHA_COM_RESOLUCAO = new RegExp(
    String.raw`^(?:mediana ${DURACAO} · p90 ${DURACAO}|${DURACAO}(?:, ${DURACAO}){0,2}) · \d+ resolvidas?$`,
    "u",
  );

  const mesesComResolucao = linhasDeMes.filter((linha) => !linha.texto.startsWith("—"));
  expect(mesesComResolucao.length).toBeGreaterThan(0);
  for (const mes of mesesComResolucao) {
    expect(mes.texto, `mês "${mes.rotulo}"`).toMatch(LINHA_COM_RESOLUCAO);
    // **Nenhum valor maior que zero é renderizado como zero** — critério 55.2, e o defeito que o item 55
    // conserta. **A gramática acima sozinha não pega a regressão**, porque `0 h` casa com `\d+ h`; esta
    // linha é o que separa o conserto de um retorno ao `maximumFractionDigits: 0`. Ela vale para **cada**
    // duração da linha, e não só para a primeira: desde o item 58 o mês pequeno escreve até três.
    //
    // **Desde o item 62 o zero é impossível por construção**: a Aplicação publica quatro casas com piso de
    // `0.0001` para valor positivo, e a tela escreve `menos de 1 min` para tudo abaixo do minuto cheio, que
    // é o degrau que a gramática acima aceita. Se um mês render `0 min` mesmo assim, o defeito voltou.
    expect(mes.texto, `mês "${mes.rotulo}"`).not.toMatch(/\b0 (?:min|h)\b/u);
  }
  // O item 61 — **as barras dos meses se comparam**, nas duas larguras. Em 23/09/2026 julho, de mediana
  // maior, desenhava 51 px e agosto 140 px a 1280 px, e a 390 px o trilho de julho media zero: cada linha
  // era uma grade própria, e o texto longo do mês pequeno comia o trilho. **Nenhum mês é nomeado aqui**:
  // o caso julho × agosto está no teste de interface, com os números escritos, e este afirma a regra que
  // torna o caso impossível, qualquer que seja o mês que a janela mostre.
  barrasComparaveis(await medidasDasBarras(tempoDeResolucao), "quadro 4 em 1280 px");

  // O mês sem resolução não desenha barra — critério 61.3, e a falta que o passo 4 do roteiro declarava.
  const medidasDoQuadro4 = await medidasDasBarras(tempoDeResolucao);
  linhasDeMes.forEach((linha, indice) => {
    if (linha.texto.startsWith("—")) {
      expect(medidasDoQuadro4[indice]?.barra, `mês "${linha.rotulo}"`).toBeNull();
    }
  });

  // O mesmo defeito, em escala pequena, no quadro 2 — achado A-61-4. **Vem DEPOIS do quadro 4 de
  // propósito**: contra o código velho, `3` e `12` já dariam trilhos diferentes, e a falha do passo 3
  // tem de ser a do quadro 4, que é o caso do item.
  barrasComparaveis(await medidasDasBarras(ocorrenciasPorStatus), "quadro 2 em 1280 px");

  const tamanhoOriginal = helena.viewportSize() ?? { width: 1280, height: 720 };
  await helena.setViewportSize({ width: 390, height: 844 });
  barrasComparaveis(await medidasDasBarras(tempoDeResolucao), "quadro 4 em 390 px");
  await helena.setViewportSize(tamanhoOriginal);

  await expect(tempoDeResolucao).toContainText("A barra é a mediana.");

  cobre(test.info(), "7.2 · 4", { criterio: "58.3, 58.4, 61.1, 61.2, 61.3" });

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
  // 2.6 · Quadro 6 · Em aberto por idade agora — as quatro faixas (critérios 59.2 a 59.6)
  //
  // **É o único quadro do painel que enxerga o que NÃO foi resolvido**, e o que ele prova aqui é a
  // igualdade: a soma das quatro faixas é a soma do quadro 3, porque os dois contam o mesmo conjunto —
  // as não terminais — por dois cortes. **Nenhum schema declara essa igualdade**: ela vive em dois
  // `where` que ninguém obriga a concordar, e é esta linha que pega um deles escorregando.
  //
  // **Nenhuma asserção sobre qual faixa tem quanto.** A semente espalha os registros por cinco meses, e
  // o dia em que a suíte roda decide onde cada um cai. O que é estável é a estrutura e a soma.
  // -------------------------------------------------------------------------
  const emAbertoPorIdade = quadro(helena, "Em aberto por idade");
  await expect(emAbertoPorIdade).toContainText("agora");
  await expect(emAbertoPorIdade).toContainText(
    "Há quanto tempo o que está em aberto espera, contando do registro.",
  );

  // **As quatro, sempre, inclusive as que estão em zero** — critério 59.2. Os textos são inteiros e
  // literais: uma faixa que mudasse de rótulo sem que ninguém percebesse é o defeito que isto pega.
  const linhasDeIdade = await linhasDoMedidor(emAbertoPorIdade);
  expect(linhasDeIdade.map((linha) => linha.rotulo)).toStrictEqual([
    "Até 7 dias",
    "8 a 30 dias",
    "31 a 90 dias",
    "Mais de 90 dias",
  ]);

  // O número em texto, em toda linha — critério 59.4 e compromisso A-5.
  for (const linha of linhasDeIdade) {
    expect(Number.isInteger(Number(linha.texto)), `faixa "${linha.rotulo}"`).toBe(true);
  }

  // **A asserção forte.** `soma` é a mesma da seção 2.3.
  expect(soma(linhasDeIdade)).toBe(soma(linhasDeCategoria));

  cobre(test.info(), "7.2 · 6", {
    criterio: "59.2, 59.3, 59.4, 59.6",
    falta:
      "a oração que aponta a faixa mais velha, que só aparece quando a semente deixa alguém acima de 90 dias",
  });

  // -------------------------------------------------------------------------
  // 3 · A lista, com a página 1 cheia — passo 8 do roteiro
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
  cobre(test.info(), "7.3 · 8", {
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
  cobre(test.info(), "7.3 · 9", { criterio: "14b.2" });

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
  cobre(test.info(), "7.3 · 10", { criterio: "14b.2" });

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
  cobre(test.info(), "7.3 · 11", {
    falta:
      "a volta pela barra lateral caindo na página 1 com corte novo — o teste volta pelo botão do navegador, que devolve a página 2 inteira",
  });

  await terceiraAba.close();
  await outraAba.close();
  await contexto.close();
});
