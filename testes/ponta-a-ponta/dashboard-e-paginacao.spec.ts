import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { cobre } from "./cobertura";
import {
  AURORA,
  conteudoDaCasca,
  entrar,
  HELENA,
  marcaDoInstante,
  RECANTO,
  registrarOcorrencia,
  trocarDeOrganizacao,
} from "./mundo";
import { SEM_TRANSBORDO, transbordo } from "./transbordo";

/**
 * ============================================================================
 *  O dashboard e a paginação, contra o mundo de teste da semente
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
 * **O mundo é o gêmeo de teste da semente (`semear:demo -- --teste`), e este arquivo não é dono
 * dele.** Ele lê muito e escreve uma coisa só: **uma** ocorrência no Condomínio Recanto Azul por
 * corrida, com a marca do instante no título, porque a linha de novidades do critério 14b.2 não existe sem que algo chegue depois do corte.
 * Nada semeado muda de estado, nenhuma configuração é tocada, nenhuma senha é redefinida.
 *
 * **De onde vem a massa.** É o mesmo `planoDaDemonstracao` da demonstração, gravado com os nomes do
 * perfil de teste, então o que se prova aqui sobre o painel vale para o painel da demonstração (item 63).
 *
 * **A consequência está em toda asserção deste arquivo, e é a regra do lote:** o Recanto tem 24
 * ocorrências na primeira corrida, 25 na segunda, 26 na terceira. **Nenhuma asserção de contagem
 * absoluta contra a semente** — o que se afirma é forma e relação: os seis status existem e nenhum está
 * a zero, as sete categorias aparecem, todo mês da janela tem linha, a média cai entre 1 e 5, e a página
 * 2 traz os mesmos itens de onde quer que se peça.
 *
 * **Pré-requisitos, e eles não são automatizados de propósito:** a pilha de pé (`npm run local`) e o
 * mundo de teste semeado (`SENHA_DA_DEMONSTRACAO=… npm run semear:demo -- --teste`). Os dois estão
 * no cabeçalho de `caminho-critico.spec.ts`, com o argumento inteiro.
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
 * | **A forma que os gráficos desenham** (57.2, 73.5, 73.6) | Eles são `aria-hidden` por decisão do compromisso A-5, e os números vivem na tabela do `Ver dados` ou na lista para leitor de tela — que é o que tem asserção. Aqui se prova que o do quadro 1 **desenhou**, e que cada série se nomeia em palavra |
 * | A **suavidade** da troca de página (14.7) | O que é mecanizável é o esqueleto **não** reaparecer e a lista anterior **não** sumir; que a transição seja agradável é olho humano |
 * | O recorte de celular e a barra fixa do rodapé | O Playwright roda em 1280 px por decisão do `playwright.config.ts` |
 * | O período escolhido à mão no calendário e a faixa de período inválido | São a escolha de recorte de T-07, e a janela padrão é a que a semente foi construída para encher. Um período escolhido seria outra jornada |
 * | O quarto estado da lista — *página além do fim* | Ele já tem teste de unidade em `estadoDaLista`, e alcançá-lo aqui pediria uma página que não existe, que é URL editada à mão e não gesto de tela |
 */

const MARCA = marcaDoInstante();
const TITULO_DA_NOVA = `Novidade ${MARCA} — lâmpada queimada na escada do bloco B`;
const DESCRICAO_DA_NOVA =
  "A lâmpada do patamar entre o segundo e o terceiro andar está apagada desde ontem à noite.";

/** Os seis status na lente do Gestor, que é a do dashboard — `NOME_DO_STATUS`, critério 32.3. */
const SEIS_STATUS = ["Aberta", "Em análise", "Em atendimento", "Pausada", "Resolvida", "Cancelada"];

/**
 * Os sete quadros de T-07, na ordem da tela, com a pergunta de decisão de cada um (item 73, critérios 1
 * e 2). A numeração da tela é a posição aqui, mais um.
 */
const QUADROS = [
  { titulo: "Entradas e saídas por mês", pergunta: "Está melhorando ou piorando?" },
  { titulo: "Em aberto por idade", pergunta: "O que está esperando demais, e qual ocorrência?" },
  {
    titulo: "Tempo de resolução",
    pergunta: "Quanto demora, e quanto demora para quem espera mais?",
  },
  {
    titulo: "O que está voltando",
    pergunta: "Onde vale atacar a causa em vez de abrir outra ordem de serviço?",
  },
  { titulo: "Em aberto por categoria", pergunta: "Onde está o trabalho que não terminou?" },
  { titulo: "Ocorrências por status", pergunta: "Como se distribui tudo o que já foi registrado?" },
  { titulo: "Satisfação", pergunta: "Quem foi atendido ficou satisfeito?" },
] as const;

/** As sete categorias com que toda organização nasce (critério 4a, semente de categorias). */
const CATEGORIAS_DA_SEMENTE = 7;

/** O tamanho de página do contrato — `LIMITE_PADRAO`. */
const POR_PAGINA = 20;

/**
 * Um dos sete quadros de T-07. **Escopado pela `section` do `Cartao`, e casando o TÍTULO do quadro**, e
 * nunca qualquer texto de dentro dele: com sete quadros, três têm *aberto* no título, e *Em aberto*
 * aparece também no rodapé de outros. O nome acessível do `h2` começa pelo número, `2 · Em aberto por
 * idade`, e a âncora é o que separa um título de outro que o contenha.
 *
 * **O nome vai em expressão regular insensível a caixa**, que é folga barata: o título do quadro foi
 * versal por CSS até o item 110, e hoje é título de bloco em caixa normal.
 */
function quadro(pagina: Page, titulo: string): Locator {
  return pagina.locator("section").filter({
    has: pagina.getByRole("heading", { level: 2, name: new RegExp(`^\\d · ${titulo}`, "iu") }),
  });
}

/**
 * As linhas da lista para leitor de tela que o `GraficoDeBarras` desenha junto do SVG — rótulo e texto,
 * os dois `span` de cada item.
 *
 * **Lido por `textContent`, e não por `innerText`**: a lista é `sr-only`, e o `innerText` de conteúdo
 * recortado depende do motor. O gráfico é `aria-hidden`, então esta lista é o que o quadro diz em texto,
 * e é o que tem asserção.
 */
async function linhasDaLista(secao: Locator): Promise<{ rotulo: string; texto: string }[]> {
  return secao.locator("ul.sr-only > li").evaluateAll((itens) =>
    itens.map((item) => {
      const spans = item.querySelectorAll(":scope > span");
      return {
        rotulo: (spans[0]?.textContent ?? "").trim(),
        texto: (spans[spans.length - 1]?.textContent ?? "").trim(),
      };
    }),
  );
}

/** As células de cada linha do corpo da tabela do `Ver dados` aberto, em ordem. */
async function linhasDaTabela(pagina: Page): Promise<string[][]> {
  return pagina
    .getByRole("dialog")
    .locator("tbody tr")
    .evaluateAll((linhas) =>
      linhas.map((linha) =>
        Array.from(linha.querySelectorAll("th, td")).map((celula) => (celula.textContent ?? "").trim()),
      ),
    );
}

/** Os títulos das colunas da tabela do `Ver dados` aberto. */
async function colunasDaTabela(pagina: Page): Promise<string[]> {
  return pagina
    .getByRole("dialog")
    .locator("thead th")
    .evaluateAll((celulas) => celulas.map((celula) => (celula.textContent ?? "").trim()));
}

/** O último dia do mês de um dia `YYYY-MM-DD`. */
function ultimoDiaDoMes(dia: string): string {
  const ultimo = new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)), 0)).getUTCDate();
  return `${dia.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

/** O número inteiro que abre um texto — `7` de `7 · 4 há mais de 7 dias`. */
const primeiroNumero = (texto: string): number => Number(/^\d+/u.exec(texto)?.[0] ?? Number.NaN);

/**
 * O seletor do link do **título** numa linha da tabela.
 *
 * **Uma linha tem duas âncoras desde o item 67**: o título, que é o alvo de teclado e carrega a camada
 * que cobre a linha, e o gatilho do cartão de Tempo, fora da ordem de tabulação (`tabindex="-1"`). Ler
 * as duas devolveria a mesma linha duas vezes, e o `toHaveLength` da página cairia. Até o item 76 havia
 * uma terceira, *"Conte como foi"*, com `?acao=avaliar`; o `:not([href*="?"])` fica, inofensivo, contra
 * um link com consulta que volte.
 */
const LINK_DO_TITULO = 'tbody a[href^="/ocorrencias/"]:not([tabindex="-1"]):not([href*="?"])';

/** Os endereços de T-05 que a tabela de triagem está mostrando, na ordem em que estão — **um por linha**. */
async function enderecosNaTabela(pagina: Page): Promise<string[]> {
  return pagina
    .locator(LINK_DO_TITULO)
    .evaluateAll((ancoras) => ancoras.map((ancora) => ancora.getAttribute("href") ?? ""));
}

/** Quantos meses de calendário a janela toca — o eixo único do critério 36.2. */
function mesesNaJanela(de: string, ate: string): number {
  const anos = Number(ate.slice(0, 4)) - Number(de.slice(0, 4));
  return anos * 12 + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7))) + 1;
}

/**
 * As duas pontas do recorte, em dia do contrato, lidas do rótulo do seletor de período (item 71).
 *
 * **O rótulo passou a ser a única fonte do recorte aplicado** depois que os dois campos de data saíram da
 * tela: ele é `dd/mm/aaaa – dd/mm/aaaa`, e `mesesNaJanela` conta sobre `YYYY-MM-DD`.
 */
function pontasDoRotulo(rotulo: string): { de: string; ate: string } {
  const [de = "", ate = ""] = rotulo
    .split("–")
    .map((parte) => parte.trim().split("/").reverse().join("-"));
  return { de, ate };
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
  await helena.getByRole("link", { name: "Painel" }).click();
  await helena.waitForURL(/\/dashboard$/u);
  await expect(helena.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();

  // O seletor de período, com a janela padrão dos 90 dias já aplicada (critérios 32.1 e 71.1). O nome
  // acessível carrega o intervalo, e o rótulo visível é o mesmo texto (critério 71.4).
  const seletorDePeriodo = helena.getByRole("button", { name: /^Período: /u });
  await expect(seletorDePeriodo).toBeVisible();
  await expect(seletorDePeriodo).toHaveText(/^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/u);
  // As duas pontas voltam a ser dia do contrato para o resto do passo, que conta os meses da janela.
  const { de, ate } = pontasDoRotulo(await seletorDePeriodo.innerText());
  expect(de).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(ate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(de < ate).toBe(true);

  await seletorDePeriodo.click();
  // O painel do `popover` do Radix é `role="dialog"`, e escopar por ele separa os atalhos de qualquer
  // outro botão da página.
  const painelDoPeriodo = helena.getByRole("dialog");
  for (const atalho of ["últimos 7 dias", "últimos 30 dias", "últimos 90 dias", "este mês"]) {
    await expect(painelDoPeriodo.getByRole("button", { name: atalho, exact: true })).toBeVisible();
  }
  await expect(painelDoPeriodo.getByRole("button", { name: "Aplicar", exact: true })).toBeVisible();
  // No recorte padrão o atalho dos 90 dias é o aplicado: marcado, e não desabilitado (item 110,
  // critério 5, que substituiu o "apagado" do 71.2). Reclicá-lo só fecha o calendário, e o endereço não
  // ganha `de` nem `ate`, como o bloco depois do Escape confere.
  const noventa = painelDoPeriodo.getByRole("button", { name: "últimos 90 dias", exact: true });
  await expect(noventa).toBeEnabled();
  await expect(noventa).toHaveAttribute("aria-current", "true");
  for (const outro of ["últimos 7 dias", "últimos 30 dias", "este mês"]) {
    await expect(
      painelDoPeriodo.getByRole("button", { name: outro, exact: true }),
    ).not.toHaveAttribute("aria-current");
  }

  // Fechar sem aplicar não escreve no endereço: o recorte continua o padrão, sem `de` e sem `ate`.
  await helena.keyboard.press("Escape");
  await expect(painelDoPeriodo).toBeHidden();
  const semRecorte = new URL(helena.url()).searchParams;
  expect(semRecorte.has("de")).toBe(false);
  expect(semRecorte.has("ate")).toBe(false);

  // Reclicar o atalho aplicado fecha o calendário e não escreve no endereço (item 110, critério 5).
  await seletorDePeriodo.click();
  await painelDoPeriodo.getByRole("button", { name: "últimos 90 dias", exact: true }).click();
  await expect(painelDoPeriodo).toBeHidden();
  const depoisDeReclicar = new URL(helena.url()).searchParams;
  expect(depoisDeReclicar.has("de")).toBe(false);
  expect(depoisDeReclicar.has("ate")).toBe(false);

  // **O recibo do período** (critério 103.2). Com a resposta retida, o atalho apertado fica ocupado, o
  // popover continua aberto e o conteúdo recua; quando os números chegam, o popover fecha e o recuo sai.
  const RESPOSTA_DO_RECORTE = /\/dashboard\?.*\bde=/u;
  await helena.route(RESPOSTA_DO_RECORTE, async (rota) => {
    await new Promise((pronto) => setTimeout(pronto, 1500));
    await rota.continue();
  });
  await seletorDePeriodo.click();
  const trintaDias = painelDoPeriodo.getByRole("button", { name: "últimos 30 dias", exact: true });
  await trintaDias.click();
  await expect(trintaDias).toHaveAttribute("aria-busy", "true");
  await expect(painelDoPeriodo).toBeVisible();
  await expect(conteudoDaCasca(helena).locator('[aria-busy="true"]')).toHaveCount(1);
  await expect(painelDoPeriodo).toBeHidden();
  await expect(conteudoDaCasca(helena).locator('[aria-busy="true"]')).toHaveCount(0);
  expect(new URL(helena.url()).searchParams.has("de")).toBe(true);
  await helena.unroute(RESPOSTA_DO_RECORTE);

  // O resto do teste lê o recorte padrão: voltar desfaz, porque o seletor escreve com `push`.
  await helena.goBack();
  await expect.poll(() => new URL(helena.url()).searchParams.has("de")).toBe(false);

  // -------------------------------------------------------------------------
  // 2.0 · A ordem dos sete quadros, e a pergunta de cada um (item 73, critérios 1 e 2)
  //
  // **Os títulos lidos na ordem do documento**, por `textContent`, que lê o texto servido e não o
  // desenhado (o título foi versal por CSS até o item 110, e continua valendo se voltar a ser). A frase
  // que o item 73 tirou da página não existe mais nela.
  // -------------------------------------------------------------------------
  const titulosNaOrdem = await helena
    .locator("section h2")
    .evaluateAll((titulos) => titulos.map((titulo) => (titulo.textContent ?? "").trim()));
  expect(titulosNaOrdem).toHaveLength(QUADROS.length);
  QUADROS.forEach(({ titulo }, i) => {
    expect(titulosNaOrdem[i], `quadro ${String(i + 1)}`).toMatch(
      new RegExp(`^${String(i + 1)} · ${titulo}`, "u"),
    );
  });
  for (const { titulo, pergunta } of QUADROS) {
    await expect(quadro(helena, titulo)).toContainText(pergunta);
  }
  await expect(helena.getByText(/oito vazamentos/iu)).toHaveCount(0);

  const emAbertoPorIdade = quadro(helena, "Em aberto por idade");
  const rodapeDaIdade = await emAbertoPorIdade.getByText(/ao todo, entre Aberta, Em análise, Em atendimento e Pausada\./u).innerText();
  const totalEmAberto = Number(/: (\d+) ao todo/u.exec(rodapeDaIdade)?.[1] ?? Number.NaN);
  expect(Number.isInteger(totalEmAberto), `rodapé do quadro 2: ${rodapeDaIdade}`).toBe(true);

  // -------------------------------------------------------------------------
  // 2.1 · Os três cartões do topo (item 73, critérios 3 e 4)
  //
  // **Cada cartão carrega o segundo termo embaixo do número**, e o de *Em aberto agora* é a soma que o
  // rodapé do quadro 2 escreve: os dois leem o mesmo conjunto.
  // -------------------------------------------------------------------------
  const cartao = (rotulo: string) => helena.getByText(rotulo, { exact: true }).locator("xpath=..");

  const emAbertoAgora = cartao("Em aberto agora");
  await expect(emAbertoAgora).toContainText("no início do período");
  const textoDoEmAberto = await emAbertoAgora.innerText();
  expect(textoDoEmAberto).toMatch(/^Em aberto agora\s+\d+\s/iu);
  expect(Number(/\n\s*(\d+)\s*\n/u.exec(textoDoEmAberto)?.[1])).toBe(totalEmAberto);

  const saldo = cartao("Saldo do período");
  // `innerText`, e não `toContainText`: o `textContent` cola os três parágrafos sem espaço entre eles.
  expect(await saldo.innerText()).toMatch(
    /^Saldo do período\s+(?:[+−]\d+|0)\s+\d+ entr(?:ou|aram), \d+ sa(?:iu|íram)$/iu,
  );

  const maisVelha = cartao("A mais velha em aberto");
  if (totalEmAberto > 0) {
    await expect(maisVelha).toContainText(/\d+ dias?/u);
    await expect(maisVelha.getByRole("link")).toHaveAttribute("href", /^\/ocorrencias\//u);
    await expect(maisVelha.getByRole("link")).toHaveAttribute("target", "_blank");
    await expect(maisVelha.getByRole("link")).toHaveAccessibleName(/, abre em nova aba$/u);
  } else {
    await expect(maisVelha).toContainText("nada em aberto");
    await expect(maisVelha.getByRole("link")).toHaveCount(0);
  }

  cobre(test.info(), "7.2 · 8", {
    criterio: "73.3",
    falta:
      "a conferência do critério 73.4 na tela — em aberto agora menos o saldo é o que estava em aberto no início —, que depende de a semente ter trilha coerente com o status; o banco a prova na integração",
  });

  // -------------------------------------------------------------------------
  // 2.2 · Quadro 1 · Entradas e saídas por mês (item 73, critérios 6, 7 e 12)
  //
  // **O gráfico é `aria-hidden`**, então o que se afirma dentro dele é nó de DOM: a superfície existe, e
  // a identidade de cada série está escrita no rótulo da ponta, com o valor do último mês junto. A legenda
  // de baixo saiu. **O número de cada mês se lê pela tabela do `Ver dados`**, e é ela que tem asserção.
  // -------------------------------------------------------------------------
  const entradasESaidas = quadro(helena, "Entradas e saídas por mês");
  await expect(entradasESaidas).toContainText("no período");

  const grafico = entradasESaidas.locator('[data-slot="chart"]');
  await expect(grafico.locator("svg").first()).toBeVisible();
  // **Uma ocorrência de cada palavra, e não "pelo menos uma"**: duas seriam o rótulo desenhando em todo
  // ponto em vez de só na ponta.
  for (const serie of ["Registradas", "Saíram"]) {
    await expect(
      grafico.locator("svg text").filter({ hasText: new RegExp(`^${serie} \\d+$`, "u") }),
    ).toHaveCount(1);
  }
  await expect(grafico.locator(".recharts-legend-wrapper")).toHaveCount(0);

  // O veredito fica FORA do modal, visível no quadro.
  await expect(
    entradasESaidas.getByText(/o último mês completo|O período não tem mês completo\./u),
  ).toBeVisible();

  // **A nota do mês parcial se afirma pela regra, e não como sempre presente**: ela aparece se e só se o
  // período corta a primeira ou a última ponta. Na janela padrão as duas cortam quase sempre, mas não
  // em 31/03 de ano não bissexto, quando os 90 dias vão de 01/01 a 31/03.
  const algumParcial = !de.endsWith("-01") || ate !== ultimoDiaDoMes(ate);
  await expect(entradasESaidas.getByText(/^\* Mês parcial/u)).toHaveCount(algumParcial ? 1 : 0);

  const verDadosDoFluxo = entradasESaidas.getByRole("button", { name: "Ver dados" });
  await verDadosDoFluxo.click();
  const dialogoDoFluxo = helena.getByRole("dialog", { name: "Entradas e saídas por mês" });
  await expect(dialogoDoFluxo).toBeVisible();
  expect(await colunasDaTabela(helena)).toStrictEqual([
    "Mês",
    "Registradas",
    "Resolvidas",
    "Canceladas",
    "Saíram",
    "Saldo",
  ]);
  const linhasDoFluxo = await linhasDaTabela(helena);
  expect(linhasDoFluxo).toHaveLength(mesesNaJanela(de, ate));
  for (const linha of linhasDoFluxo) {
    const [, registradas, resolvidas, canceladas, sairam] = linha.map(Number);
    // Saíram é resolvidas mais canceladas, em toda linha (critério 73.4).
    expect(sairam, `mês "${linha[0] ?? ""}"`).toBe((resolvidas ?? 0) + (canceladas ?? 0));
    expect(Number.isInteger(registradas)).toBe(true);
  }
  // **O foco volta ao botão quando o `Esc` fecha** — é do primitivo, e é aqui que se prova.
  await helena.keyboard.press("Escape");
  await expect(dialogoDoFluxo).toBeHidden();
  await expect(verDadosDoFluxo).toBeFocused();

  cobre(test.info(), "7.2 · 1", {
    criterio: "73.6, 73.7, 73.12",
    falta:
      "a escala no eixo vertical e o rótulo em todo mês — o desenho é aria-hidden, e o que tem asserção é a tabela, o rótulo de ponta e a nota do mês parcial",
  });

  // -------------------------------------------------------------------------
  // 2.3 · Quadro 2 · Em aberto por idade — as mais velhas primeiro (item 73, critério 8; e o 59)
  //
  // **Nenhuma asserção sobre qual faixa tem quanto.** A semente espalha os registros por cinco meses, e
  // o dia em que a suíte roda decide onde cada um cai. O que é estável é a estrutura e a soma.
  // -------------------------------------------------------------------------
  await expect(emAbertoPorIdade).toContainText("agora");
  await expect(emAbertoPorIdade).toContainText(
    /há mais de 30 dias|Nenhuma em aberto há mais de 30 dias\.|Nada em aberto agora\./u,
  );

  const maisVelhas = emAbertoPorIdade.locator("ol > li");
  const quantasVelhas = await maisVelhas.count();
  expect(quantasVelhas).toBeGreaterThan(0);
  expect(quantasVelhas).toBeLessThanOrEqual(5);
  for (let i = 0; i < quantasVelhas; i += 1) {
    await expect(maisVelhas.nth(i).getByRole("link")).toHaveAttribute("href", /^\/ocorrencias\//u);
    await expect(maisVelhas.nth(i).getByRole("link")).toHaveAttribute("target", "_blank");
    await expect(maisVelhas.nth(i).getByRole("link")).toHaveAccessibleName(/, abre em nova aba$/u);
    await expect(maisVelhas.nth(i)).toContainText(/\d+ dias?$/u);
  }

  // **Clicar no título abre a ocorrência numa aba nova** (item 134), e o painel fica onde estava.
  const [abaNova] = await Promise.all([
    helena.context().waitForEvent("page"),
    maisVelhas.first().getByRole("link").click(),
  ]);
  await abaNova.waitForURL(/\/ocorrencias\/[^/?]+$/u);
  await abaNova.close();
  await expect(helena).toHaveURL(/\/dashboard$/u);

  // **As quatro faixas se leem pela tabela do `Ver dados`**, e não pela lista para leitor de tela: este
  // quadro tem `Ver dados`, e por isso a dispensa.
  await emAbertoPorIdade.getByRole("button", { name: "Ver dados" }).click();
  await expect(helena.getByRole("dialog", { name: "Em aberto por idade" })).toBeVisible();
  const linhasDeIdade = await linhasDaTabela(helena);
  expect(linhasDeIdade.map((linha) => linha[0])).toStrictEqual([
    "Até 7 dias",
    "8 a 30 dias",
    "31 a 90 dias",
    "Mais de 90 dias",
  ]);
  const somaDaIdade = linhasDeIdade.reduce((total, linha) => total + Number(linha[1]), 0);
  expect(somaDaIdade).toBe(totalEmAberto);
  await helena.keyboard.press("Escape");

  cobre(test.info(), "7.2 · 2", {
    criterio: "73.8, 59.2, 59.3, 59.6",
    falta:
      "a oração dos 90 dias no veredito, que só aparece quando a semente deixa alguém acima de 90 dias",
  });

  // -------------------------------------------------------------------------
  // 2.4 · Quadro 3 · Tempo de resolução — nenhum mês omitido (critérios 36.2, 58 e 73.12)
  //
  // **O eixo esperado é calculado a partir do seletor**, e não fixado num número: a janela de 90 dias
  // toca três, quatro ou cinco meses conforme o dia em que a corrida acontece.
  // -------------------------------------------------------------------------
  const tempoDeResolucao = quadro(helena, "Tempo de resolução");
  await expect(tempoDeResolucao).toContainText("no período");
  await expect(tempoDeResolucao).toContainText("Tempo de calendário, com as pausas.");
  await expect(tempoDeResolucao).toContainText(
    /Em \S+(?: de \d{4})?(?:,| houve)|Nenhuma resolução no período\./u,
  );

  await tempoDeResolucao.getByRole("button", { name: "Ver dados" }).click();
  await expect(helena.getByRole("dialog", { name: "Tempo de resolução" })).toBeVisible();
  expect(await colunasDaTabela(helena)).toStrictEqual(["Mês", "Mediana", "p90", "Resoluções"]);
  const linhasDoTempo = await linhasDaTabela(helena);
  expect(linhasDoTempo).toHaveLength(mesesNaJanela(de, ate));
  const mesesSemResolucao = linhasDoTempo.filter((linha) => linha[3] === "0");
  expect(mesesSemResolucao.length).toBeGreaterThan(0);
  for (const linha of mesesSemResolucao) {
    // **A frase, e nunca `0 h`** — critério 36.2: um zero de horas diria que o mês resolveu
    // instantaneamente, quando o que houve foi não ter resolvido nada.
    expect(linha[1], `mês "${linha[0] ?? ""}"`).toBe("nenhuma resolução no mês");
  }
  for (const linha of linhasDoTempo) {
    // **Nenhum valor maior que zero é renderizado como zero** — critério 55.2.
    expect(linha.join(" "), `mês "${linha[0] ?? ""}"`).not.toMatch(/\b0 (?:min|h)\b/u);
  }
  await helena.keyboard.press("Escape");

  cobre(test.info(), "7.2 · 3", {
    criterio: "36.2, 58.3, 58.4, 73.12",
    falta: "as duas linhas do gráfico e o buraco do mês sem resolução — o desenho é aria-hidden",
  });

  // -------------------------------------------------------------------------
  // 2.5 · Quadro 4 · O que está voltando — o corte de topo (critérios 60 e 73.14)
  //
  // **O que se confere é a regra, nunca o número**: o passo 4 deste teste registra uma ocorrência por
  // corrida, e a semente recém-aplicada muda de dia para dia. Ou há a frase de vazio, ou há barras, e
  // tudo o que passou das cinco primeiras empata com a quinta.
  // -------------------------------------------------------------------------
  const oQueEstaVoltando = quadro(helena, "O que está voltando");
  await expect(oQueEstaVoltando).toContainText("no período");
  const duplas = await linhasDaLista(oQueEstaVoltando);
  if (duplas.length === 0) {
    await expect(oQueEstaVoltando).toContainText("Nenhuma dupla se repetiu no período.");
  } else {
    const contagens = duplas.map((dupla) => Number(dupla.texto));
    for (const [i, dupla] of duplas.entries()) {
      expect(dupla.rotulo, "rótulo da dupla").toMatch(/^.+ · .+$/u);
      // O critério 60.2: dupla com uma não aparece.
      expect(contagens[i], `dupla "${dupla.rotulo}"`).toBeGreaterThanOrEqual(2);
      if (i >= 5) expect(contagens[i], "empate com a quinta").toBe(contagens[4]);
    }
    const resto = oQueEstaVoltando.getByText(/^Mais \d+ duplas? com \d+ ocorrências? ou menos$/u);
    if ((await resto.count()) > 0) {
      const maior = Number(/com (\d+)/u.exec(await resto.innerText())?.[1]);
      expect(maior).toBeLessThan(contagens[contagens.length - 1] ?? 0);
    }
  }

  cobre(test.info(), "7.2 · 4", {
    criterio: "60.2, 60.3, 60.4, 73.14",
    falta: "o rótulo em duas linhas sem corte, que é desenho aria-hidden",
  });

  // -------------------------------------------------------------------------
  // 2.6 · Quadro 5 · Em aberto por categoria — as sete, com o segundo número (critérios 56 e 73.9)
  // -------------------------------------------------------------------------
  const emAbertoPorCategoria = quadro(helena, "Em aberto por categoria");
  await expect(emAbertoPorCategoria).toContainText("agora");
  await expect(emAbertoPorCategoria).toContainText("Só o que está em aberto");

  const linhasDeCategoria = await linhasDaLista(emAbertoPorCategoria);
  expect(linhasDeCategoria).toHaveLength(CATEGORIAS_DA_SEMENTE);
  for (const linha of linhasDeCategoria) {
    expect(linha.texto, `categoria "${linha.rotulo}"`).toMatch(
      /^(?:0|\d+ · (?:nenhuma|\d+) há mais de 7 dias)$/u,
    );
  }
  // **A soma é o total do quadro 2** — o critério 15 contra o banco de verdade.
  const somaDaCategoria = linhasDeCategoria.reduce(
    (total, linha) => total + primeiroNumero(linha.texto),
    0,
  );
  expect(somaDaCategoria).toBe(totalEmAberto);

  cobre(test.info(), "7.2 · 5", {
    criterio: "56.1, 56.4, 73.9, 73.15",
    falta: "a barra de cada linha, que é desenho aria-hidden",
  });

  // -------------------------------------------------------------------------
  // 2.7 · Quadro 6 · Ocorrências por status — os SEIS, na ordem do ciclo (critérios 33, 56.3 e 73.11)
  // -------------------------------------------------------------------------
  const ocorrenciasPorStatus = quadro(helena, "Ocorrências por status");
  await expect(ocorrenciasPorStatus).toContainText("agora");
  await expect(ocorrenciasPorStatus).toContainText("Na ordem do ciclo.");

  const linhasDeStatus = await linhasDaLista(ocorrenciasPorStatus);
  expect(linhasDeStatus.map((linha) => linha.rotulo)).toEqual(SEIS_STATUS);
  for (const linha of linhasDeStatus) {
    expect(Number(linha.texto), `status "${linha.rotulo}" no dashboard`).toBeGreaterThan(0);
  }
  // **A soma dos quatro primeiros é o total do quadro 2**, e a de todos passa dele: a ordem dos seis está
  // pinada logo acima, e a seção já afirmou que nenhum está em zero.
  const somaDoStatus = (linhas: readonly { texto: string }[]) =>
    linhas.reduce((total, linha) => total + Number(linha.texto), 0);
  expect(somaDoStatus(linhasDeStatus.slice(0, 4))).toBe(totalEmAberto);
  expect(somaDoStatus(linhasDeStatus)).toBeGreaterThan(totalEmAberto);

  cobre(test.info(), "7.2 · 6", { criterio: "33, 56.3, 73.11, 73.15" });

  // -------------------------------------------------------------------------
  // 2.8 · Quadro 7 · Satisfação — um número de 1 a 5 e as cinco notas (critérios 34 e 73.10)
  //
  // **O denominador ao lado é o critério 34.3:** *"sem ele a média mente quando poucos avaliam"*.
  // -------------------------------------------------------------------------
  const satisfacao = quadro(helena, "Satisfação");
  await expect(satisfacao).toContainText("no período");
  await expect(satisfacao).toContainText("de 1 a 5");
  await expect(satisfacao).not.toContainText("Nenhuma ocorrência avaliada ainda");

  const textoDaMedia = await satisfacao.innerText();
  const lidaNaTela = /(\d+,\d+)\s*de 1 a 5/u.exec(textoDaMedia);
  expect(lidaNaTela, `o quadro 7 imprimiu: ${textoDaMedia}`).not.toBeNull();
  const media = Number((lidaNaTela?.[1] ?? "").replace(",", "."));
  expect(media).toBeGreaterThanOrEqual(1);
  expect(media).toBeLessThanOrEqual(5);

  const denominador = /(\d+) de (\d+) resolvidas avaliadas · \d+% responderam/u.exec(textoDaMedia);
  expect(denominador, `o quadro 7 imprimiu: ${textoDaMedia}`).not.toBeNull();
  const avaliadas = Number(denominador?.[1] ?? "0");
  const resolvidas = Number(denominador?.[2] ?? "0");
  expect(avaliadas).toBeGreaterThan(0);
  expect(resolvidas).toBeGreaterThanOrEqual(avaliadas);

  const notas = await linhasDaLista(satisfacao);
  expect(notas.map((nota) => nota.rotulo)).toStrictEqual([
    "Nota 5",
    "Nota 4",
    "Nota 3",
    "Nota 2",
    "Nota 1",
  ]);
  expect(notas.reduce((total, nota) => total + Number(nota.texto), 0)).toBe(avaliadas);

  cobre(test.info(), "7.2 · 7", { criterio: "34, 73.10" });

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
  await expect(helena.getByText(/Página 1 de \d+ · \d+ ocorrências/u)).toBeVisible();
  await expect(helena.getByText("no corte", { exact: false })).toHaveCount(0);
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

  await helena.locator(`${LINK_DO_TITULO}[href="${primeiraDaPagina2}"]`).click();
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

/**
 * **As portas públicas — item 70, critérios 1 e 5.**
 *
 * Sem sessão, `/entrar` tem os dois links do pé, e os dois abrem em nova aba páginas que respondem sem
 * sessão. Com sessão, a barra lateral leva à mesma página do grupo, que é igual para os dois.
 *
 * **Só lê.** Não escreve na semente, então não disputa o mundo com o teste acima.
 */
test("as portas públicas: a página do grupo e a documentação, com e sem sessão", async ({ browser }) => {
  const NOMES = ["Dario Lacerda", "Larissa Kramer", "Mirian Storino", "Natanael Dias", "Tiago Victor"];

  // 1 · Sem sessão: o pé de T-01
  const anonimo = await browser.newContext();
  const porta = await anonimo.newPage();
  await porta.goto("/entrar");

  const linkDoGrupo = porta.getByRole("link", { name: /^Feito pelo Grupo 1/u });
  const linkDaDocumentacao = porta.getByRole("link", { name: /^Documentação/u });
  await expect(linkDoGrupo).toHaveAttribute("target", "_blank");
  await expect(linkDaDocumentacao).toHaveAttribute("target", "_blank");

  const [grupoSemSessao] = await Promise.all([anonimo.waitForEvent("page"), linkDoGrupo.click()]);
  await grupoSemSessao.waitForURL(/\/grupo$/u);
  await expect(grupoSemSessao.getByRole("heading", { name: "Grupo 1", level: 1 })).toBeVisible();
  for (const nome of NOMES) {
    await expect(grupoSemSessao.getByRole("heading", { name: nome, level: 2 })).toBeVisible();
  }
  // Link sem endereço não existe: só dois LinkedIn e dois GitHub na página inteira.
  await expect(grupoSemSessao.getByRole("link", { name: /^LinkedIn de /u })).toHaveCount(2);
  await expect(grupoSemSessao.getByRole("link", { name: /^GitHub de /u })).toHaveCount(2);

  const [documentacaoSemSessao] = await Promise.all([anonimo.waitForEvent("page"), linkDaDocumentacao.click()]);
  await documentacaoSemSessao.waitForURL(/\/documentacao/u);
  await expect(documentacaoSemSessao).not.toHaveURL(/\/entrar/u);

  // O salto da documentação (critério 94.6): primeiro Tab, e o Enter leva ao título do artigo.
  // `bringToFront` porque ela é uma aba aberta por `target="_blank"`: sem o foco da janela, o `Tab` não
  // move `document.activeElement` no Chromium.
  await documentacaoSemSessao.bringToFront();
  await documentacaoSemSessao.keyboard.press("Tab");
  await expect(documentacaoSemSessao.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await documentacaoSemSessao.keyboard.press("Enter");
  await expect(documentacaoSemSessao.locator("#conteudo")).toBeFocused();
  cobre(test.info(), "7.2 · 10", { criterio: "94.6" });

  await anonimo.close();

  // 2 · Com sessão: a barra lateral leva à mesma página
  const contexto = await browser.newContext();
  const helena = await contexto.newPage();
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  // **Critério 76.1 — o corpo da barra não rola na horizontal.** A medida é a do navegador: largura do
  // conteúdo contra largura visível. Zero é o único valor aceito.
  const corpoDaBarra = helena.locator('[data-sidebar="content"]');
  await expect(corpoDaBarra).toBeVisible();
  expect(await corpoDaBarra.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth)).toBe(0);

  // **Critério 76.2 — o grupo e a documentação moram no pé da barra**, num marco próprio.
  const itemDoGrupo = helena.getByRole("navigation", { name: "Sobre o projeto" }).getByRole("link", { name: /^Sobre o projeto/u });
  await expect(itemDoGrupo).toHaveAttribute("target", "_blank");
  const [grupoComSessao] = await Promise.all([contexto.waitForEvent("page"), itemDoGrupo.click()]);
  await grupoComSessao.waitForURL(/\/grupo$/u);
  for (const nome of NOMES) {
    await expect(grupoComSessao.getByRole("heading", { name: nome, level: 2 })).toBeVisible();
  }
  await expect(
    helena.getByRole("navigation", { name: "Sobre o projeto" }).getByRole("link", { name: /^Documentação/u }),
  ).toHaveAttribute("target", "_blank");
  await contexto.close();
});

/**
 * **O pé termina a página** (critério 120.29). Numa janela mais baixa que o conteúdo, o pé vem depois do
 * último controle e não por cima dele; e em toda janela ele é o fim do documento. **A medida é contra o
 * controle mais baixo do corpo**, e não contra o corpo: o corpo tem `flex-1` e encosta no pé por
 * construção, o que faria o caso passar sem olhar nada. A tela grande entra porque é onde a apresentação
 * vira fileira; e a medida de transbordo põe as telas da moldura sob o critério 31.
 */
test("o pé da moldura termina a página, no celular e na tela grande", async ({ browser }) => {
  for (const viewport of [{ width: 360, height: 560 }, { width: 1440, height: 900 }]) {
    const onde = `a ${String(viewport.width)} × ${String(viewport.height)}`;
    const contexto = await browser.newContext({ viewport });
    const pagina = await contexto.newPage();
    await pagina.goto("/entrar");
    const medida = await pagina.evaluate(() => {
      const pe = document.querySelector("main > footer");
      const corpo = pe?.previousElementSibling;
      const controles = corpo ? [...corpo.querySelectorAll("a, button, input")] : [];
      if (!pe || controles.length === 0) return null;
      return {
        topoDoPe: pe.getBoundingClientRect().top + window.scrollY,
        fimDoConteudo: Math.max(...controles.map((c) => c.getBoundingClientRect().bottom)) + window.scrollY,
        fimDoPe: pe.getBoundingClientRect().bottom + window.scrollY,
        fimDoDocumento: document.documentElement.scrollHeight,
      };
    });
    expect(medida, onde).not.toBeNull();
    expect(medida!.topoDoPe, `o pé não cobre o conteúdo ${onde}`).toBeGreaterThanOrEqual(medida!.fimDoConteudo - 0.5);
    expect(medida!.fimDoPe, `o pé termina a página ${onde}`).toBeGreaterThanOrEqual(medida!.fimDoDocumento - 0.5);
    expect.soft(await transbordo(pagina), `transbordo ${onde}`).toStrictEqual(SEM_TRANSBORDO);
    await contexto.close();
  }
});

/**
 * **O teclado no painel — item 94.**
 *
 * Três coisas que nenhum teste de unidade alcança, porque as três só existem no navegador: a ordem de
 * tabulação depois do salto, a ausência de parada dentro de subárvore `aria-hidden`, e o foco que volta
 * ao gatilho quando a gaveta do celular fecha.
 *
 * **Nenhum arquivo novo** (ADR-0013): a jornada é a do Gestor no painel, que é a deste arquivo.
 */
test("o teclado no painel: o salto, os gráficos fora da tabulação e a gaveta do celular", async ({ browser }) => {
  // 1 · Tela grande: o primeiro Tab é o salto, e ele leva ao conteúdo
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const helena = await contexto.newPage();
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);
  await helena.goto("/dashboard");

  await helena.keyboard.press("Tab");
  const salto = helena.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(salto).toBeFocused();
  await expect(salto).toBeInViewport();
  await helena.keyboard.press("Enter");
  await expect(conteudoDaCasca(helena)).toBeFocused();
  await helena.keyboard.press("Tab");
  expect(await helena.evaluate(() => document.activeElement?.closest("#conteudo") !== null)).toBe(true);
  cobre(test.info(), "7.2 · 10", { criterio: "94.6" });

  // 2 · Nenhum elemento focável dentro de subárvore aria-hidden (D-01)
  await expect(
    helena.locator('[aria-hidden="true"] [tabindex="0"], [aria-hidden="true"] [role="application"]'),
  ).toHaveCount(0);
  cobre(test.info(), "7.2 · 10", { criterio: "94.4" });
  await contexto.close();

  // 3 · Celular: a gaveta mostra o X, e todo fechamento devolve o foco ao gatilho
  const movel = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const celular = await movel.newPage();
  await entrar(celular, HELENA);
  await celular.waitForURL(/\/organizacao$/u);
  await celular.getByRole("button", { name: RECANTO }).click();
  await celular.waitForURL(/\/ocorrencias$/u);

  const gatilho = celular.getByRole("button", { name: "Abrir navegação" });
  await expect(gatilho).toHaveAttribute("aria-expanded", "false");
  await expect(gatilho).toHaveAttribute("aria-controls", "navegacao-da-organizacao");

  // Com a gaveta aberta o Radix marca o resto da página com `aria-hidden`, e uma consulta por papel
  // deixa de achar o gatilho. Por atributo ele continua alcançável, e é assim que se lê o `aria-expanded`
  // do estado aberto.
  const gatilhoPorAtributo = celular.locator('[data-sidebar="trigger"]');
  await gatilho.click();
  await expect(gatilhoPorAtributo).toHaveAttribute("aria-expanded", "true");
  const gaveta = celular.locator("#navegacao-da-organizacao");
  await gaveta.getByRole("button", { name: "Fechar" }).click();
  await expect(gatilho).toBeFocused();

  await gatilho.click();
  await celular.keyboard.press("Escape");
  await expect(gatilho).toBeFocused();

  await gatilho.click();
  await gaveta.getByRole("link", { name: /^Painel/u }).click();
  await celular.waitForURL(/\/dashboard$/u);
  await expect(gatilho).toBeFocused();
  cobre(test.info(), "7.2 · 10", { criterio: "94.7" });
  await movel.close();
});

/**
 * **A exportação em CSV — item 124.** Helena é Gestora do Recanto e Solicitante do Aurora: é a mesma pessoa
 * dos dois lados da guarda. **Nenhuma contagem absoluta** contra a semente: o arquivo se compara com o
 * total que a própria lista declara.
 *
 * O botão é procurado dentro do conteúdo da casca (`conteudoDaCasca`, do item 119), porque o streaming
 * deixa uma cópia escondida do cabeçalho no `<body>` até a troca.
 */
test("a exportação em CSV: o arquivo inteiro, a recusa no servidor e o botão a 360 px", async ({ browser }) => {
  const contexto = await browser.newContext({ acceptDownloads: true });
  const helena = await contexto.newPage();
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  // Critério 1: com filtro e página na URL da tela, o arquivo traz tantas quanto a lista diz que existem.
  await helena.goto("/ocorrencias?status=aberta&pagina=2");
  const [download] = await Promise.all([
    helena.waitForEvent("download"),
    conteudoDaCasca(helena).getByRole("button", { name: "Exportar CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^ocorrencias-condominio-recanto-azul-teste-\d{4}-\d{2}-\d{2}\.csv$/u);
  const bytes = readFileSync(await download.path());
  // Critério 4: BOM e ponto e vírgula.
  expect([...bytes.subarray(0, 3)]).toStrictEqual([0xef, 0xbb, 0xbf]);
  const texto = bytes.toString("utf8").slice(1);
  expect(texto.startsWith("ID;Título;Descrição;Status;")).toBe(true);

  const pagina = (await (await helena.request.get("/api/ocorrencias")).json()) as { totalNoCorte: number };
  const registros = texto.match(/(?:^|\r\n)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12};/gu) ?? [];
  expect(pagina.totalNoCorte).toBeGreaterThan(20); // mais que uma página
  expect(registros).toHaveLength(pagina.totalNoCorte);

  // Critério 9: o botão aparece e cabe a 360 px nas quatro telas.
  await helena.setViewportSize({ width: 360, height: 844 });
  for (const rota of ["/ocorrencias", "/vinculos", "/configuracao/areas", "/configuracao/categorias"]) {
    await helena.goto(rota);
    const botao = conteudoDaCasca(helena).getByRole("button", { name: "Exportar CSV" });
    await expect(botao, rota).toBeVisible();
    await helena.evaluate(() => document.fonts.ready);
    const caixa = await botao.boundingBox();
    expect.soft((caixa?.x ?? 0) + (caixa?.width ?? 0), `botão em ${rota}`).toBeLessThanOrEqual(360);
    expect.soft(await transbordo(helena), `transbordo em ${rota} a 360 px`).toStrictEqual(SEM_TRANSBORDO);
  }

  // Critério 3: no Aurora, Helena é Solicitante. As quatro rotas recusam no servidor.
  await trocarDeOrganizacao(helena, AURORA);
  for (const recurso of ["ocorrencias", "vinculos", "areas", "categorias"]) {
    const recusa = await helena.request.get(`/api/${recurso}/exportacao`);
    expect(recusa.status(), recurso).toBe(403);
    expect(((await recusa.json()) as { codigo?: string }).codigo, recurso).toBe("PERMISSAO_INSUFICIENTE");
  }
  // E o botão não aparece para ela.
  await helena.goto("/ocorrencias");
  await expect(conteudoDaCasca(helena).getByRole("heading", { name: "Ocorrências" })).toBeVisible();
  await expect(helena.getByRole("button", { name: "Exportar CSV" })).toHaveCount(0);

  await contexto.close();
});
