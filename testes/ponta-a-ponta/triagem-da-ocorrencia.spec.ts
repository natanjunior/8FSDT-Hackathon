import { expect, test, type Page } from "@playwright/test";

import { cobertura, cobre } from "./cobertura";

import {
  AURORA,
  ciclo,
  ENCARREGADA_DO_AURORA,
  entrar,
  esperarSituacao,
  HELENA,
  MARCOS,
  marcaDoInstante,
  NOME_DE_HELENA,
  NOME_DE_MARCOS,
  RECANTO,
  registrarOcorrencia,
  SOLICITANTE_DO_AURORA,
} from "./mundo";
import { SEM_TRANSBORDO, transbordo } from "./transbordo";

/**
 * ============================================================================
 *  A triagem — do formulário do Solicitante à lista do Gestor, à prioridade e
 *  ao responsável
 * ============================================================================
 *
 * **O sétimo arquivo de ponta a ponta, e ele nasce pela ADR-0013**: a 0012 fixou o teto em seis e disse
 * que *"o sétimo exige registro novo"*; a 0013 subiu o teto para sete e deu a ele origem medida. Esta é
 * a jornada das Partes 4.1 a 4.3 do roteiro de validação, mais o cancelamento pelo Solicitante da
 * Parte 4.5.
 *
 * **Por que ela sobrou.** O `caminho-critico.spec.ts` atravessa 4.1 a 4.3 pelo caminho feliz — registra,
 * analisa, atribui, inicia, resolve e avalia — e não olha em volta: dos nove passos de 4.1 ele exerce um,
 * dos nove de 4.2 nenhum, e dos vinte e dois de 4.3 três. O que entra aqui é o **entorno**: a forma do
 * formulário, o recorte e os filtros de T-03, a prioridade com desfazer, a busca do modal de atribuição,
 * e o único cancelamento que nenhum dos seis toca — o do Solicitante sobre a própria ocorrência.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo — exigência da ADR-0012, que a 0013 não revoga
 * ---------------------------------------------------------------------------
 *
 * **O mundo é o gêmeo de teste da semente (`semear:demo -- --teste`), e este arquivo não é dono
 * dele.** Ele **acrescenta** duas ocorrências ao Edifício Aurora por corrida — a **A**, com foto, que é
 * triada até ganhar responsável, e a **C**, sem foto, que morre cancelada pela própria autora. Nada semeado muda de estado: a prioridade,
 * o status e o responsável que este teste escreve são sempre os da ocorrência que ele mesmo criou.
 *
 * **Pré-requisitos, e eles não são automatizados de propósito:** a pilha de pé (`npm run local`) e o
 * mundo de teste semeado (`SENHA_DA_DEMONSTRACAO=… npm run semear:demo -- --teste`). O argumento
 * inteiro está no cabeçalho de `caminho-critico.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 *  Onde o roteiro descreve um produto que não existe mais
 * ---------------------------------------------------------------------------
 *
 * Nove passos do recorte mudaram de forma depois de 17/09/2026, e o teste assere o **produto**:
 *
 * | Passo | O que o roteiro diz | O que o produto faz |
 * |---|---|---|
 * | 2 e 4 | *Área* começa em *"Escolha"* | começa em *"Busque ou escolha"* — o campo virou busca no item 44l |
 * | 2 e 3 | o ícone da categoria fica à direita do seletor | desde o 44p ele mora **dentro de cada opção**, e o gatilho reimprime desenho e nome |
 * | 5 | a sequência termina em *"Foto enviada."* | termina em *"Foto pronta"*, com *"Ela segue junto com a ocorrência."* |
 * | 8 e 48 | a prioridade lê *"Prioridade: Alta"* | são duas palavras na mesma linha, com a forma do seletor preservada |
 * | 8, 9 e 17 | T-05 tem *Voltar* no fim da coluna | saiu no critério 44g.10; quem devolve o recorte é o botão do navegador |
 * | 31 e 35 | o botão de confirmar nasce apagado | ele só fica inerte durante o envio (guia §7, 16/09/2026) |
 * | 26 | *"use as setas: o valor troca e grava"* | o seletor virou `Select` do catálogo no 44p, e a seta **abre a lista**; o teclado grava com uma tecla a mais |
 *
 * ---------------------------------------------------------------------------
 *  O que este arquivo NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | A cauda de 4.3 — *Solução aplicada* com *Salvar* próprio, os dois `F5` que a guardam, o modal *Resolver* já preenchido | chegar lá exige levar a ocorrência a `em_atendimento` e a `resolvida`, que é a espinha do `caminho-critico.spec.ts` |
 * | A lista vazia do Solicitante (14.4) | exige uma conta sem **nenhuma** ocorrência, e Helena tem cinco na semente e ganha mais a cada corrida. Criar conta já tem dono: `nascimento-de-organizacao.spec.ts` |
 * | A ordem vertical do formulário | a 1280 px o bloco *Onde* é grade de duas colunas: a ordem do documento e a que o olho lê divergem por desenho |
 * | As três frases transitórias da foto | *"Preparando a foto…"* e *"Enviando a foto"* duram menos que a asserção num PNG de 79 bytes contra o Azurite local |
 * | Os trinta segundos do passo 22 | a linha do desfazer não tem temporizador. O teste prova que ela sobrevive ao repinte do servidor e a cinco segundos, que é a forma pela qual ela realmente sumiria |
 * | O anel de foco do passo 26 (A-4) | o anel **estar visível** é olho humano. Que o foco **chega** tinha asserção, e ela virou o segundo teste deste arquivo — marcado, porque o foco não chega (**V-14**) |
 * | O recorte de celular | o `playwright.config.ts` fixa 1280 px por decisão registrada |
 *
 * ---------------------------------------------------------------------------
 *  Dois testes, e o segundo nasce marcado
 * ---------------------------------------------------------------------------
 *
 * O primeiro é a jornada inteira, e é verde. O segundo é o **V-14** — o foco depois de gravar a prioridade
 * pelo teclado —, nasce em `test.fixme` com a medição por escrito, e constrói o próprio mundo. Separá-los
 * é decisão: enfiar o V-14 na jornada deixaria noventa por cento de rede de regressão desligada para
 * guardar um defeito de dez linhas.
 */

/** A marca do instante — é ela que separa estas duas ocorrências das 12 do Aurora e das outras corridas. */
const MARCA = marcaDoInstante();

const TITULO_A = `Triagem ${MARCA} — interfone mudo no quarto andar`;
const DESCRICAO_A = "O interfone não toca e não chama a portaria. Começou depois da queda de energia.";

const TITULO_C = `Triagem ${MARCA} — lâmpada piscando na escada`;
const DESCRICAO_C = "A lâmpada do patamar pisca a noite inteira.";

/**
 * **Um PNG de 16×16, 79 bytes, montado aqui e não guardado como arquivo** — o mesmo do
 * `caminho-critico.spec.ts`, e pela mesma razão: binário no repositório para uma asserção só não se paga.
 *
 * **O que esta foto prova aqui é outra coisa.** Lá ela prova que os bytes voltam pela rede (critério
 * 51.10); aqui ela prova que o formulário **não trava enquanto ela sobe** — o título é digitado no meio da
 * subida, sem espera nenhuma entre uma coisa e outra.
 */
const FOTO_EM_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mM4YaNBEmIY1TCqYfhqAAAeBCwQMd+aqQAAAABJRU5ErkJggg==";

/** O selo que o Solicitante lê em `aberta` — a coluna dele no glossário §4. O travessão é o do produto. */
const ABERTA_PARA_O_SOLICITANTE = "Recebida — aguardando análise";

/** Os quatro passos da régua, na lente do Solicitante — `CICLO` de `ciclo.ts` com os nomes do item 31. */
const CICLO_DO_SOLICITANTE = [
  ABERTA_PARA_O_SOLICITANTE,
  "Em análise",
  "Em execução",
  "Resolvida",
];

/** O carimbo de `dataEHora`: `dd/mm/aaaa · hh:mm`. Na régua ele só existe no passo alcançado. */
const CARIMBO = /^\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}$/u;

/** Os dois rótulos de tipo de área — `rotuloDoTipoDeArea`. Toda opção do seletor carrega um dos dois. */
const TIPOS_DE_AREA = ["área comum", "unidade privativa"];

/** As três prioridades, na ordem de `PRIORIDADES`, e **sem opção vazia** — critério 17.6. */
const PRIORIDADES = ["Baixa", "Normal", "Alta"];

/**
 * O aviso do modal de cancelamento **do Solicitante** — critério 18.7, e a primeira vez no produto em que
 * um texto de tela muda em função de quem olha. A frase do Gestor é a de baixo, e ela **não** pode estar
 * nesta tela.
 */
const AVISO_PARA_QUEM_NAO_GESTIONA = "Os Gestores veem esta observação. Não há como editá-la depois.";
const AVISO_DE_VISIBILIDADE = "O Solicitante vê esta observação. Não há como editá-la depois.";

const MOTIVO_DE_C = "Aberta por engano";
const OBSERVACAO_DE_C = "Abri no prédio errado; a escada que pisca é a do bloco vizinho.";

/** Os quatro motivos que o Solicitante autor alcança — `MOTIVOS_DO_AUTOR`. O Gestor recebe sete. */
const MOTIVOS_DO_AUTOR = 4;

/** As seis colunas do recorte B de T-03, na ordem em que `TabelaDeTriagem` as escreve. */
const COLUNAS_DA_TRIAGEM = ["Status", "Título", "Onde", "Prioridade", "Responsável", "Tempo"];

/**
 * A linha do desfazer do seletor de prioridade — critério 17.7.
 *
 * **Escopada por `role="status"` mais o texto**, e nunca por posição: o contêiner que traz a frase **e** o
 * botão é uma região viva de propósito (*"a novidade é a disponibilidade do desfazer, não só a frase"*), e
 * o aviso flutuante do item 44g também é `status`.
 */
function desfazer(pagina: Page) {
  return pagina.getByRole("status").filter({ hasText: "Prioridade alterada" });
}

/**
 * O bloco 1c de T-05 — a identidade que não é o selo: prioridade, categoria, onde, quem registrou, quem
 * responde e quando.
 *
 * **Escopado pela seção que contém *Registrada por***, que é o único rótulo dela que não aparece em mais
 * lugar nenhum da tela.
 */
function identidade(pagina: Page) {
  return pagina.locator("section").filter({ hasText: "Registrada por" }).first();
}

/** Os dois números do painel de recorte, lidos como texto — a comparação é de igualdade entre leituras. */
async function contagensDoRecorte(pagina: Page): Promise<{ todas: string; minhas: string }> {
  const todas = pagina.getByRole("radio", { name: "Todas as ocorrências" });
  const minhas = pagina.getByRole("radio", { name: "Minhas ocorrências" });

  // **Esperar o número chegar vem primeiro.** Ele vive num `<Suspense>` próprio (item 44p, critério 10) e
  // a leitura sem espera pegaria o rótulo sozinho — duas leituras vazias seriam "iguais" por acidente.
  await expect(todas).toHaveText(/\d/u);
  await expect(minhas).toHaveText(/\d/u);

  return {
    todas: (await todas.innerText()).replace(/\s+/gu, " ").trim(),
    minhas: (await minhas.innerText()).replace(/\s+/gu, " ").trim(),
  };
}

test("a triagem pelas bordas: o formulário, o recorte, os filtros, a prioridade e o responsável", async ({
  browser,
}) => {
  const contextoDeHelena = await browser.newContext();
  const contextoDeMarcos = await browser.newContext();
  const helena = await contextoDeHelena.newPage();
  const marcos = await contextoDeMarcos.newPage();

  // -------------------------------------------------------------------------
  // 1 · Helena entra no Aurora e abre T-04 — a forma do formulário
  //
  // **Ela é Solicitante no Aurora e Gestora no Recanto**, e com dois vínculos sem escolha na sessão o
  // servidor pede T-02.
  // -------------------------------------------------------------------------
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: AURORA }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  await helena.getByRole("link", { name: /^Registrar (ocorrência|a primeira)$/u }).click();
  await helena.waitForURL(/\/ocorrencias\/nova$/u);

  // Os dois blocos, cada um uma seção com o próprio título — é o que faz quem navega por regiões achar
  // *O que aconteceu* e *Onde* nas duas larguras.
  await expect(helena.getByRole("heading", { name: "O que aconteceu" })).toBeVisible();
  await expect(helena.getByRole("heading", { name: "Onde" })).toBeVisible();

  // A foto é o **primeiro alvo da tela** (protótipo §2.3), e ela nasce vazia com a palavra no botão.
  await expect(helena.getByRole("button", { name: "Adicionar foto" })).toBeVisible();

  await expect(helena.getByLabel("Título")).toBeVisible();
  await expect(helena.getByLabel("Descrição")).toBeVisible();
  // A dica da descrição é ajuda do campo, e não exemplo dentro dele — guia §9.
  await expect(helena.getByText("Uma ou duas frases bastam.")).toBeVisible();
  await expect(helena.getByLabel("Categoria")).toBeVisible();
  await expect(helena.getByLabel("Área")).toBeVisible();
  await expect(helena.getByLabel("Referência do lugar")).toBeVisible();

  // Os dois botões do rodapé. **A posição relativa não é afirmada**: a 1280 px eles ficam lado a lado, e
  // a pilha vertical que o roteiro descreve é a do celular.
  await expect(helena.getByRole("button", { name: "Registrar ocorrência" })).toBeVisible();
  await expect(helena.getByRole("button", { name: "Cancelar" })).toBeVisible();
  cobre(test.info(), "4.1 · 2", {
    falta: "a ordem vertical do formulário, o rótulo Foto (opcional) e o Escolha inicial da Categoria",
  });

  // -------------------------------------------------------------------------
  // 2 · Categoria — o desenho mora DENTRO da opção, e o gatilho reimprime os dois
  //
  // **É o item 44p, critério 5**, e é onde o roteiro descreve o produto anterior: até o 44l o ícone ficava
  // solto à direita do seletor. Hoje o `SelectValue` reimprime o conteúdo do item escolhido, então trocar
  // de categoria troca **desenho e palavra ao mesmo tempo** — e é isso que se afirma.
  //
  // **Qual categoria não é escolhido por nome**, e sim pela ordem que o Gestor definiu (D18): fixar um
  // nome amarraria o teste ao conteúdo da semente.
  // -------------------------------------------------------------------------
  const gatilhoDaCategoria = helena.getByLabel("Categoria");
  await gatilhoDaCategoria.click();

  const nomesDeCategoria = (await helena.getByRole("option").allInnerTexts()).map((texto) =>
    texto.trim(),
  );
  expect(nomesDeCategoria.length).toBeGreaterThan(1);
  const primeiraCategoria = nomesDeCategoria[0] ?? "";
  const categoriaDeA = nomesDeCategoria[1] ?? "";
  expect(primeiraCategoria).not.toBe("");
  expect(categoriaDeA).not.toBe("");
  expect(categoriaDeA).not.toBe(primeiraCategoria);

  await helena.getByRole("option", { name: primeiraCategoria }).click();
  await expect(gatilhoDaCategoria).toContainText(primeiraCategoria);
  // **Dois desenhos no gatilho**: o da categoria, que veio da opção, e o `▾` do catálogo.
  await expect(gatilhoDaCategoria.locator("svg")).toHaveCount(2);
  const desenhoDaPrimeira = await gatilhoDaCategoria.locator("svg").first().getAttribute("class");

  await gatilhoDaCategoria.click();
  await helena.getByRole("option", { name: categoriaDeA }).click();
  await expect(gatilhoDaCategoria).toContainText(categoriaDeA);
  const desenhoDeA = await gatilhoDaCategoria.locator("svg").first().getAttribute("class");
  // O `lucide-react` publica o nome do desenho na classe do `svg`, e é por ela que se prova a troca: a
  // palavra sozinha não distinguiria um gatilho que reimprimisse o nome e esquecesse o ícone.
  expect(desenhoDeA).not.toBe(desenhoDaPrimeira);
  cobre(test.info(), "4.1 · 3", {
    falta: "o ícone dentro de cada opção da lista — a asserção lê o desenho do gatilho, pela classe do SVG",
  });

  // -------------------------------------------------------------------------
  // 3 · Área — toda opção carrega o tipo, e os dois tipos aparecem
  //
  // **O gatilho começa em *"Busque ou escolha"***, e não em *"Escolha"*: o campo virou busca no item 44l.
  // -------------------------------------------------------------------------
  const gatilhoDaArea = helena.getByLabel("Área");
  await expect(gatilhoDaArea).toContainText("Busque ou escolha");
  await gatilhoDaArea.click();

  const opcoesDeArea = (await helena.getByRole("option").allInnerTexts()).map((texto) =>
    texto.replace(/\s+/gu, " ").trim(),
  );
  expect(opcoesDeArea.length).toBeGreaterThan(1);
  for (const opcao of opcoesDeArea) {
    // **O tipo vai ao lado do nome, nunca no lugar dele** — o mesmo compromisso A-5 do ícone.
    expect(TIPOS_DE_AREA.some((tipo) => opcao.includes(tipo)), `a opção "${opcao}"`).toBe(true);
  }
  for (const tipo of TIPOS_DE_AREA) {
    expect(
      opcoesDeArea.some((opcao) => opcao.includes(tipo)),
      `nenhuma área do Aurora é "${tipo}"`,
    ).toBe(true);
  }
  cobre(test.info(), "4.1 · 4", {
    falta: "a busca filtrando ao digitar, o grupo Usadas por você e a gaveta do celular",
  });

  await helena.getByRole("option").first().click();

  // -------------------------------------------------------------------------
  // 4 · A foto sobe enquanto o título é digitado — o DG-5 na tela
  //
  // **Não há espera entre anexar e digitar, e a ausência é a asserção.** Se o formulário travasse durante
  // a subida, digitar o título falharia por controle inerte — é o único jeito de provar o paralelismo
  // sem interceptar a rede, que é o que este teste recusa fazer (o transporte tem de ser real).
  //
  // **O título é digitado letra a letra, e a Descrição, ainda não alcançada, não acusa** (item 75).
  // Categoria e Área já foram escolhidas; a Descrição é o campo vazio e obrigatório que sobra.
  // -------------------------------------------------------------------------
  await helena.locator("input#foto").setInputFiles({
    name: "interfone.png",
    mimeType: "image/png",
    buffer: Buffer.from(FOTO_EM_BASE64, "base64"),
  });
  await helena.getByLabel("Título").pressSequentially(TITULO_A, { delay: 20 });
  await expect(helena.getByLabel("Descrição")).not.toHaveAttribute("aria-invalid", "true");
  await expect(helena.getByText("Descreva o que aconteceu, em uma frase.")).toHaveCount(0);
  await helena.getByLabel("Descrição").fill(DESCRICAO_A);

  await expect(helena.getByText("Foto pronta")).toBeVisible({ timeout: 30_000 });
  await expect(helena.getByText("Ela segue junto com a ocorrência.")).toBeVisible();
  // O alvo grande vira linha com duas ações de ícone, e a palavra vai no nome acessível — guia §7.
  await expect(helena.getByRole("button", { name: "Trocar a foto" })).toBeVisible();
  await expect(helena.getByRole("button", { name: "Adicionar foto" })).toHaveCount(0);
  cobre(test.info(), "4.1 · 5", {
    falta: "as frases transitórias da foto, que duram menos que a asserção, e o botão de remover",
  });

  await helena.getByRole("button", { name: "Registrar ocorrência" }).click();
  await helena.waitForURL(
    /\/ocorrencias\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
  );
  const ocorrenciaA = helena.url().split("/").pop() ?? "";
  expect(ocorrenciaA).not.toBe("");
  cobre(test.info(), "4.1 · 6", { falta: "a frase Registrando… no botão durante o envio" });

  // -------------------------------------------------------------------------
  // 5 · T-05 pelos olhos de quem abriu — a lente do Solicitante, inteira
  //
  // **O `F5` vem primeiro**, e não é zelo: a tela que chega depois do `201` é a mesma que o servidor
  // renderiza do zero, e provar isso uma vez aqui é o que permite recarregar à vontade mais adiante.
  // -------------------------------------------------------------------------
  await helena.reload();
  await expect(helena.getByRole("heading", { name: TITULO_A, level: 1 })).toBeVisible();
  await esperarSituacao(helena, ABERTA_PARA_O_SOLICITANTE);
  cobre(test.info(), "4.1 · 7", { criterio: "11.7" });

  // **A régua tem quatro passos e um só carimbo.** O primeiro é datado pela premissa P1 — a criação grava
  // o registro inicial —, e os três seguintes estão por alcançar, sem data.
  await expect(ciclo(helena).getByRole("listitem")).toHaveCount(CICLO_DO_SOLICITANTE.length);
  for (const passo of CICLO_DO_SOLICITANTE) {
    await expect(ciclo(helena)).toContainText(passo);
  }
  await expect(ciclo(helena).getByText(CARIMBO)).toHaveCount(1);

  // **Um único botão**, e ele é o destaque porque é o único renderizável em `aberta` para o autor.
  await expect(helena.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(helena.getByRole("button", { name: "Analisar" })).toHaveCount(0);
  await expect(helena.getByRole("button", { name: "Atribuir" })).toHaveCount(0);
  await expect(helena.getByRole("button", { name: "Mais ações ▾" })).toHaveCount(0);

  // **A prioridade é a mesma linha com e sem o controle** (item 44p, critério 20): rótulo, valor, e nenhum
  // seletor — o Solicitante não tem `ocorrencia.alterar_prioridade` em desenho de papel nenhum.
  await expect(identidade(helena)).toContainText("Prioridade");
  await expect(identidade(helena)).toContainText("Normal");
  await expect(identidade(helena).getByRole("combobox")).toHaveCount(0);

  await expect(identidade(helena)).toContainText(NOME_DE_HELENA);
  // Nulo escreve *"sem responsável"*, que é a palavra que a lista já usa — não se inventa um terceiro texto.
  await expect(identidade(helena)).toContainText("sem responsável");
  await expect(identidade(helena)).toContainText(categoriaDeA);
  // **A última mudança é a última linha de Detalhes desde o item 66**, e não mais um bloco próprio.
  await expect(identidade(helena)).toContainText("Última mudança");

  // **A etiqueta da foto é persistente, e não vive na passagem do ponteiro** — critério 6, segunda metade:
  // no toque não há ponteiro, e sem ela não haveria pista de que a foto abre.
  await expect(helena.getByRole("img", { name: "Foto anexada à ocorrência" })).toBeVisible();

  // **A foto abre em diálogo, e o foco volta ao gatilho** — critério 66.2, pelas duas saídas.
  const ampliar = helena.getByRole("button", { name: /Ampliar/u });
  await expect(ampliar).toBeVisible();
  await ampliar.click();
  const foto = helena.getByRole("dialog");
  await expect(foto.getByRole("img", { name: "Foto anexada à ocorrência" })).toBeVisible();
  await helena.keyboard.press("Escape");
  await expect(foto).toHaveCount(0);
  await expect(ampliar).toBeFocused();
  await ampliar.click();
  await expect(foto).toBeVisible();
  await helena.mouse.click(5, 5);
  await expect(foto).toHaveCount(0);
  await expect(ampliar).toBeFocused();

  await expect(helena.getByRole("heading", { name: "Linha do tempo 1" })).toBeVisible();
  await expect(helena.getByRole("link", { name: "Ver a trilha de auditoria" })).toBeVisible();

  // **O predicado das duas frases da conversa é a AUTORIA, e não o papel** — critério 30.4.
  await expect(helena.getByRole("heading", { name: "Mensagens 0" })).toBeVisible();
  await expect(helena.getByLabel(/^Escrever para os Gestores/u)).toBeVisible();
  cobre(test.info(), "4.1 · 8", {
    falta: "o texto do relato e o botão Enviar",
  });

  // -------------------------------------------------------------------------
  // 6 · A ocorrência C, pelo atalho — ela existe para morrer cancelada no fim
  //
  // Sem foto: a foto já tem dono duas vezes neste arquivo e no `caminho-critico`, e repeti-la aqui pagaria
  // a espera da subida por corrida para provar de novo o que já está provado.
  // -------------------------------------------------------------------------
  await helena.goto("/ocorrencias");
  const ocorrenciaC = await registrarOcorrencia(helena, TITULO_C, DESCRICAO_C);
  expect(ocorrenciaC).not.toBe(ocorrenciaA);
  cobre(test.info(), "4.1 · 9", {
    falta: "a segunda ocorrência sem foto, e a lista do Solicitante mostrando as três",
  });

  // -------------------------------------------------------------------------
  // 7 · Marcos entra — a tabela de triagem, e nenhuma ação dentro da linha
  //
  // Com exatamente um vínculo ativo, o servidor escolhe a organização e grava o cookie na própria
  // resposta: ele não passa por T-02.
  // -------------------------------------------------------------------------
  await entrar(marcos, MARCOS);
  await marcos.waitForURL(/\/ocorrencias$/u);

  await expect(marcos.getByRole("columnheader")).toHaveCount(COLUNAS_DA_TRIAGEM.length);
  for (const coluna of COLUNAS_DA_TRIAGEM) {
    await expect(marcos.getByRole("columnheader", { name: coluna })).toBeVisible();
  }

  // Os três chips do item 15 e o botão de registrar. *Prioridade* aparece nos dois lugares pelo mesmo
  // portão — quem altera, filtra e lê a coluna (P-03).
  //
  // **`exact` porque o chip e o cabeçalho que ordena dividem a palavra.** O nome do `name` casa por
  // pedaço, e desde o item 67 a mesma tela traz `Ordenar por Status` no cabeçalho da coluna — o chip sem
  // valor marcado se chama `Status`, e sem `exact` a asserção pediria os dois. Os nomes acessíveis são
  // distintos; quem estava solto era o predicado do teste.
  await expect(marcos.getByRole("button", { name: "Status", exact: true })).toBeVisible();
  await expect(marcos.getByRole("button", { name: "Categoria", exact: true })).toBeVisible();
  await expect(marcos.getByRole("button", { name: "Prioridade", exact: true })).toBeVisible();
  await expect(marcos.getByRole("link", { name: /^Registrar (ocorrência|a primeira)$/u })).toBeVisible();
  cobre(test.info(), "4.2 · 10", {
    falta: "as três novas no topo da lista, com status Aberta e sem responsável",
  });

  // **Nenhuma ação no item — critério 14.5.** Uma ação de lote obrigaria o cliente a adivinhar quais itens
  // a aceitam, que é a segunda cópia da máquina de estados. O item inteiro é um link.
  await expect(marcos.locator("tbody button")).toHaveCount(0);
  await expect(marcos.locator("tbody input")).toHaveCount(0);
  await expect(marcos.getByRole("link", { name: TITULO_A })).toBeVisible();
  cobre(test.info(), "4.2 · 12", { criterio: "14.5" });

  // **O ícone da categoria, ao lado do nome e nunca no lugar dele** — critério 14.6, no recorte que
  // exibe o nome.
  const linhaDeA = marcos.locator("tbody tr").filter({ hasText: TITULO_A });
  const celulaDoTitulo = linhaDeA.locator("td").nth(1);
  await expect(celulaDoTitulo).toContainText(categoriaDeA);
  await expect(celulaDoTitulo.locator("svg")).toHaveCount(1);
  cobre(test.info(), "4.2 · 11", {
    falta: "o recorte de celular — o playwright.config.ts fixa 1280 px por decisão registrada",
  });

  // -------------------------------------------------------------------------
  // 8 · O recorte — a linha some, e os dois números do painel NÃO se mexem
  //
  // **É a assimetria deliberada do repositório**, e é o que faz o número servir: `todas` e `minhas`
  // ignoram os filtros e o `?autor=eu` de propósito, porque existem para o leitor **decidir** qual recorte
  // pedir. Recalculá-los dentro do recorte já pedido seria um espelho de frente para outro.
  // -------------------------------------------------------------------------
  const contagensAntes = await contagensDoRecorte(marcos);

  await marcos.getByRole("radio", { name: "Minhas ocorrências" }).click();
  await marcos.waitForURL(/[?&]autor=eu(&|$)/u);
  await expect(marcos.getByRole("radio", { name: "Minhas ocorrências" })).toBeChecked();
  await expect(marcos.getByRole("link", { name: TITULO_A })).toHaveCount(0);
  expect(await contagensDoRecorte(marcos)).toEqual(contagensAntes);

  await marcos.getByRole("radio", { name: "Todas as ocorrências" }).click();
  await marcos.waitForURL((url) => !url.searchParams.has("autor"));
  await expect(marcos.getByRole("link", { name: TITULO_A })).toBeVisible();
  cobre(test.info(), "4.2 · 13", {
    falta: "a ocorrência do próprio Gestor ficando no recorte — Marcos não é autor de nenhuma do Aurora",
  });

  // -------------------------------------------------------------------------
  // 8.1 · O filtro rápido *Paradas* — item 101, critérios 1 e 6
  //
  // **Um clique, e ele estreita o conjunto em vez de trocá-lo**: combina com o recorte e com os outros
  // filtros, entra em *Limpar filtros*, e o estado mora na URL como o resto.
  //
  // **A prova é a ocorrência recém-registrada sumindo**: ela foi criada agora, então a última atividade
  // dela é de segundos atrás e nenhuma tolerância da organização a alcança. Quantos dias cada linha
  // parada mostra é medido pelos casos de integração, que fixam o corte da página.
  // -------------------------------------------------------------------------
  const paradas = marcos.getByRole("button", { name: "Paradas" });
  await expect(paradas).toHaveAttribute("aria-pressed", "false");

  await paradas.click();
  await marcos.waitForURL(/[?&]parada=sim(&|$)/u);
  await expect(paradas).toHaveAttribute("aria-pressed", "true");
  await expect(marcos.getByRole("link", { name: TITULO_A })).toHaveCount(0);

  await marcos.getByRole("link", { name: "Limpar filtros" }).first().click();
  await marcos.waitForURL((url) => !url.searchParams.has("parada"));
  await expect(paradas).toHaveAttribute("aria-pressed", "false");
  await expect(marcos.getByRole("link", { name: TITULO_A })).toBeVisible();
  expect(await contagensDoRecorte(marcos)).toEqual(contagensAntes);

  // -------------------------------------------------------------------------
  // 9 · O filtro de categoria — a URL é o estado, e o chip carrega a palavra
  //
  // **O rótulo do chip é o sinal, e nunca um ponto colorido** (A-5): com um valor marcado ele passa a ser
  // o **nome do valor**.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Categoria", exact: true }).click();
  await marcos.getByRole("menuitemcheckbox", { name: categoriaDeA }).click();
  await marcos.waitForURL(/[?&]categoriaId=/u);

  await expect(marcos.getByRole("button", { name: `Categoria: ${categoriaDeA}` })).toBeVisible();
  await expect(marcos.getByRole("link", { name: TITULO_A })).toBeVisible();
  expect(await contagensDoRecorte(marcos)).toEqual(contagensAntes);

  // **O endereço compartilhável deixa de ser promessa numa aba nova**: o filtro chegou por transição do
  // cliente, e esta abertura é renderização do servidor a partir da URL.
  const enderecoFiltrado = marcos.url();
  const outraAba = await contextoDeMarcos.newPage();
  await outraAba.goto(enderecoFiltrado);
  await expect(outraAba.getByRole("button", { name: `Categoria: ${categoriaDeA}` })).toBeVisible();
  await expect(outraAba.getByRole("link", { name: TITULO_A })).toBeVisible();
  await outraAba.close();
  cobre(test.info(), "4.2 · 14", {
    falta: "a ausência das outras categorias na lista — a asserção confere a presença de A",
  });

  // -------------------------------------------------------------------------
  // 9.1 · O vazio de FILTRO, e ele nunca é beco — critérios 14.4 e 15.6
  //
  // **Marcos não é autor de nenhuma ocorrência do Aurora** — a semente dá as 12 a Helena e a Diego —, então
  // juntar o recorte ao filtro produz zero por construção, sem que o teste escreva nada para isso.
  //
  // **A frase é a do filtro, e não a do Solicitante.** *"O filtro ganha da visibilidade"* é a decisão nº 1
  // do `respostas.md`: dizer-lhe *"você ainda não registrou nenhuma"* é literalmente a mentira que o
  // critério 14.4 proíbe.
  // -------------------------------------------------------------------------
  await marcos.getByRole("radio", { name: "Minhas ocorrências" }).click();
  await marcos.waitForURL(/[?&]autor=eu(&|$)/u);

  await expect(marcos.getByText("Nenhuma ocorrência com estes filtros.")).toBeVisible();
  // O subtítulo do terceiro vazio traz o recorte em palavras, com os mesmos rótulos dos chips.
  await expect(marcos.getByText(categoriaDeA).first()).toBeVisible();
  // A barra fica em cima do vazio — sem ela, o vazio de filtro seria um beco.
  await expect(marcos.getByRole("button", { name: "Status", exact: true })).toBeVisible();
  await expect(marcos.getByRole("link", { name: "Limpar filtros" }).first()).toBeVisible();
  cobre(test.info(), "4.2 · 15", {
    falta: "o vazio por Status → Resolvida; a asserção chega nele pelo recorte Minhas ocorrências",
  });

  // -------------------------------------------------------------------------
  // 9.2 · A página além do fim — o QUARTO estado, decidido antes dos três vazios
  //
  // **Ele exige um corte com conteúdo**, e é por isso que o recorte sai antes: com `?autor=eu` o corte tem
  // zero, e zero é um dos três vazios, não *"você pediu depois do fim"*. Confundir os dois é o defeito
  // que o critério 44c.3 existe para impedir.
  // -------------------------------------------------------------------------
  await marcos.getByRole("radio", { name: "Todas as ocorrências" }).click();
  await marcos.waitForURL((url) => !url.searchParams.has("autor"));

  await marcos.goto(`${marcos.url()}&pagina=9`);
  await expect(marcos.getByText("Esta página não existe mais.")).toBeVisible();
  await expect(marcos.getByRole("link", { name: "Ir para a primeira página" })).toBeVisible();
  cobre(test.info(), "4.2 · 16", { criterio: "44c.3" });

  await marcos.getByRole("link", { name: "Ir para a primeira página" }).click();
  await marcos.waitForURL((url) => !url.searchParams.has("pagina"));
  const enderecoDaLista = marcos.url();
  expect(enderecoDaLista).toMatch(/[?&]categoriaId=/u);

  // -------------------------------------------------------------------------
  // 9.3 · Sair para T-05 e voltar pelo navegador — o filtro volta inteiro
  //
  // **T-05 não tem mais *Voltar*** (critério 44g.10), e quem devolve o recorte é o botão do navegador. O
  // que se prova é que ele devolve o endereço **inteiro**, e com ele a mesma lista.
  // -------------------------------------------------------------------------
  await marcos.getByRole("link", { name: TITULO_A }).click();
  await marcos.waitForURL(new RegExp(`/ocorrencias/${ocorrenciaA}$`, "u"));
  await expect(marcos.getByRole("button", { name: "Voltar" })).toHaveCount(0);

  await marcos.goBack();
  await marcos.waitForURL(/[?&]categoriaId=/u);
  expect(marcos.url()).toBe(enderecoDaLista);
  await expect(marcos.getByRole("link", { name: TITULO_A })).toBeVisible();
  cobre(test.info(), "4.2 · 17", {
    falta: "o clique em Limpar filtros, e a volta pela barra lateral — a asserção volta pelo navegador",
  });

  // -------------------------------------------------------------------------
  // 10 · T-05 pelos olhos do Gestor — a outra lente, a outra barra
  // -------------------------------------------------------------------------
  await marcos.getByRole("link", { name: TITULO_A }).click();
  await marcos.waitForURL(new RegExp(`/ocorrencias/${ocorrenciaA}$`, "u"));

  // **A lente segue PERMISSÃO, nunca autoria e nunca recorte** — o Gestor lê *"Aberta"* onde o
  // Solicitante lê *"Recebida — aguardando análise"*.
  await esperarSituacao(marcos, "Aberta");
  await expect(ciclo(marcos)).toContainText("Aberta");
  await expect(marcos.getByLabel(/^Escrever para o Solicitante/u)).toBeVisible();

  await expect(marcos.getByRole("button", { name: "Analisar" })).toBeVisible();
  await marcos.getByRole("button", { name: "Mais ações ▾" }).click();
  await expect(marcos.getByRole("menuitem", { name: "Atribuir" })).toBeVisible();
  await expect(marcos.getByRole("menuitem", { name: "Cancelar" })).toBeVisible();
  await marcos.keyboard.press("Escape");
  await expect(marcos.getByRole("menu")).toHaveCount(0);

  // -------------------------------------------------------------------------
  // 11 · A prioridade — o ÚNICO ponto de escrita do produto sem confirmação
  //
  // **É por isso que existe o desfazer.** Com o gatilho em foco, uma tecla troca o valor sem intenção, e o
  // que foi sobrescrito não está na trilha (17.3) nem na linha do tempo (PA-21). A janela de conserto é a
  // linha sob o seletor, e ela é **um passo, nunca uma pilha**.
  // -------------------------------------------------------------------------
  const seletorDePrioridade = marcos.getByLabel("Prioridade");
  await expect(seletorDePrioridade).toHaveText("Normal");

  await seletorDePrioridade.click();
  const opcoesDePrioridade = marcos.getByRole("option");
  // **Três opções, na ordem, e sem opção vazia** — os três valores são válidos e um deles está sempre
  // gravado.
  await expect(opcoesDePrioridade).toHaveCount(PRIORIDADES.length);
  for (const [indice, palavra] of PRIORIDADES.entries()) {
    await expect(opcoesDePrioridade.nth(indice)).toHaveText(palavra);
  }
  cobre(test.info(), "4.3 · 19", {
    falta: "a posição do seletor acima de Categoria, Onde e Registrada por",
  });

  // 11.1 · Grava na mudança — sem botão, sem janela (critério 17.4).
  await marcos.getByRole("option", { name: "Alta" }).click();
  await expect(seletorDePrioridade).toHaveText("Alta");
  await expect(marcos.getByRole("dialog")).toHaveCount(0);
  await expect(marcos.getByRole("button", { name: "Salvar" })).toHaveCount(0);
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Normal para Alta.");

  // O `F5` diz que gravou de verdade — e que a barra não mudou, porque prioridade não é transição.
  await marcos.reload();
  await expect(seletorDePrioridade).toHaveText("Alta");
  await expect(desfazer(marcos)).toHaveCount(0);
  await expect(marcos.getByRole("button", { name: "Analisar" })).toBeVisible();
  await expect(marcos.getByRole("button", { name: "Mais ações ▾" })).toBeVisible();
  cobre(test.info(), "4.3 · 20", { criterio: "17.4" });

  // 11.2 · A linha nomeia os DOIS valores, e sobrevive ao repinte e a cinco segundos.
  await seletorDePrioridade.click();
  await marcos.getByRole("option", { name: "Baixa" }).click();
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Alta para Baixa.");
  await expect(desfazer(marcos).getByRole("button", { name: "Desfazer" })).toBeVisible();
  cobre(test.info(), "4.3 · 21", { criterio: "17.7" });

  // **Cinco segundos, e não trinta.** A linha sai por ação — trocar, desfazer, errar, recarregar ou
  // navegar —, e não por temporizador; provar os trinta do roteiro custaria um sexto do teto de 180 s.
  await marcos.waitForTimeout(5_000);
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Alta para Baixa.");
  cobre(test.info(), "4.3 · 22", {
    falta: "os trinta segundos — a linha não tem temporizador, e a asserção espera cinco segundos",
  });

  // 11.3 · A linha é SUBSTITUÍDA, e continua sendo uma. Pilha seria histórico, e histórico não existe.
  await seletorDePrioridade.click();
  await marcos.getByRole("option", { name: "Normal" }).click();
  await expect(desfazer(marcos)).toHaveCount(1);
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Baixa para Normal.");
  cobre(test.info(), "4.3 · 23", { criterio: "17.7" });

  // 11.4 · Desfazer volta UM passo, e não há desfazer do desfazer.
  await desfazer(marcos).getByRole("button", { name: "Desfazer" }).click();
  await expect(seletorDePrioridade).toHaveText("Baixa");
  await expect(desfazer(marcos)).toHaveCount(0);
  await marcos.reload();
  await expect(seletorDePrioridade).toHaveText("Baixa");
  cobre(test.info(), "4.3 · 24", { criterio: "17.7" });

  // 11.5 · A linha é estado de cliente: recarregar sem clicar a leva embora, e a gravação fica.
  await seletorDePrioridade.click();
  await marcos.getByRole("option", { name: "Alta" }).click();
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Baixa para Alta.");
  await marcos.reload();
  await expect(desfazer(marcos)).toHaveCount(0);
  await expect(seletorDePrioridade).toHaveText("Alta");
  cobre(test.info(), "4.3 · 25", { criterio: "17.7" });

  // -------------------------------------------------------------------------
  // 11.6 · Pelo teclado — e o roteiro descreve aqui o produto anterior
  //
  // **A seta ABRE a lista, e não troca o valor.** Era o último `select` nativo do produto até o item 44p;
  // com o `Select` do catálogo a gravação continua sendo de teclado, com **uma tecla a mais**: abrir,
  // escolher, confirmar. É a única linha do passo 26 do roteiro que a escrita deste teste teve de reler
  // contra o produto.
  //
  // **O que vem DEPOIS de gravar pelo teclado não está aqui**, e tem teste próprio no fim deste arquivo,
  // marcado: o foco não volta ao gatilho, e o *Desfazer* deixa de ser o próximo alvo. É o **V-14**.
  // -------------------------------------------------------------------------
  await seletorDePrioridade.focus();
  await marcos.keyboard.press("Enter");
  await expect(marcos.getByRole("listbox")).toBeVisible();
  await marcos.keyboard.press("ArrowUp");
  await marcos.keyboard.press("Enter");
  await expect(seletorDePrioridade).toHaveText("Normal");
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Alta para Normal.");

  // O teclado grava igual ao ponteiro, e o `F5` é quem diz isso.
  await marcos.reload();
  await expect(seletorDePrioridade).toHaveText("Normal");
  cobre(test.info(), "4.3 · 26", {
    falta: "a visibilidade do anel de foco, e o Tab até o seletor — a asserção põe o foco por código",
  });

  // **Em nenhum momento houve janela ou campo de observação**, e é o que separa este comando dos cinco que
  // abrem modal e do campo de solução aplicada, que tem *Salvar* próprio.
  await expect(marcos.getByRole("dialog")).toHaveCount(0);
  await expect(marcos.getByLabel(/^Observação/u)).toHaveCount(0);
  cobre(test.info(), "4.3 · 27", { criterio: "17.6" });

  // A ocorrência fica em *Alta*, que é onde a triagem a deixa.
  await seletorDePrioridade.click();
  await marcos.getByRole("option", { name: "Alta" }).click();
  await expect(desfazer(marcos)).toContainText("Prioridade alterada de Normal para Alta.");
  cobre(test.info(), "4.3 · 28");

  // -------------------------------------------------------------------------
  // 12 · Analisar — nenhuma janela, e a barra muda de forma
  //
  // ***Iniciar atendimento* ainda NÃO existe**, e a ausência é a invariante 9 na tela: em `em_analise` sem
  // responsável a máquina não o oferece. É o R-08, e é o que impede *Pausar* de ficar em destaque numa
  // ocorrência que ninguém pegou.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Analisar" }).click();
  await expect(marcos.getByRole("dialog")).toHaveCount(0);
  await esperarSituacao(marcos, "Em análise");
  await expect(ciclo(marcos).getByText(CARIMBO)).toHaveCount(2);
  await expect(marcos.getByRole("heading", { name: "Linha do tempo 2" })).toBeVisible();
  cobre(test.info(), "4.3 · 29", { falta: "o texto Em análise. no último item da linha do tempo" });

  await expect(marcos.getByRole("button", { name: "Atribuir" })).toBeVisible();
  await expect(marcos.getByRole("button", { name: "Iniciar atendimento" })).toHaveCount(0);
  await marcos.getByRole("button", { name: "Mais ações ▾" }).click();
  await expect(marcos.getByRole("menuitem", { name: "Pausar" })).toBeVisible();
  await expect(marcos.getByRole("menuitem", { name: "Cancelar" })).toBeVisible();
  await marcos.keyboard.press("Escape");
  await expect(marcos.getByRole("menu")).toHaveCount(0);
  cobre(test.info(), "4.3 · 30", { criterio: "22.3" });

  // -------------------------------------------------------------------------
  // 13 · O modal de atribuição — a fileira do topo, os dois blocos e a busca
  //
  // **Todos os vínculos ativos entram, e nenhum papel é excluído** — o agrupamento **ordena sem excluir**.
  // No Aurora são quatro: Marcos, a Encarregada e dois Solicitantes, e os dois blocos nascem povoados sem
  // que o teste escreva nada.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Atribuir" }).click();
  const modalDeAtribuicao = marcos.getByRole("dialog");
  await expect(
    modalDeAtribuicao.getByRole("heading", { name: "Atribuir responsável" }),
  ).toBeVisible();

  // **A fileira *"Atribuir a mim"* diz em qual identidade ele está prestes a se atribuir** — critério 20.5.
  const fileiraDeMarcos = modalDeAtribuicao.getByRole("radio", { name: "Atribuir a mim" });
  await expect(fileiraDeMarcos).toHaveAccessibleName(new RegExp(`${NOME_DE_MARCOS} · Gestor`, "u"));
  // **E o nome dele aparece uma vez só:** quem chama sai dos dois blocos, para não existirem dois
  // controles enviando o mesmo `pessoaId`.
  await expect(modalDeAtribuicao.getByRole("radio", { name: NOME_DE_MARCOS })).toHaveCount(1);
  await expect(modalDeAtribuicao.getByRole("option", { name: NOME_DE_MARCOS })).toHaveCount(0);
  cobre(test.info(), "4.3 · 32", { criterio: "20.5" });

  await expect(modalDeAtribuicao.getByLabel("Buscar pelo nome")).toBeVisible();
  await expect(modalDeAtribuicao.getByText("Gestores e Encarregados")).toBeVisible();
  await expect(modalDeAtribuicao.getByText("Solicitantes")).toBeVisible();
  await expect(
    modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }),
  ).toBeVisible();
  await expect(modalDeAtribuicao.getByRole("option", { name: NOME_DE_HELENA })).toBeVisible();
  await expect(
    modalDeAtribuicao.getByRole("option", { name: SOLICITANTE_DO_AURORA }),
  ).toBeVisible();
  await expect(modalDeAtribuicao.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(modalDeAtribuicao.getByRole("button", { name: "Atribuir" })).toBeVisible();
  cobre(test.info(), "4.3 · 31", {
    falta: "a frase Quem vai cuidar desta ocorrência. e a ordem dos blocos dentro da janela",
  });

  // **Não grava no toque**, e a razão é dupla: a fileira é item de FORMULÁRIO, e a atribuição aparece na
  // linha do tempo do Solicitante sem ter desfazer.
  await fileiraDeMarcos.check();
  await expect(modalDeAtribuicao).toBeVisible();
  await esperarSituacao(marcos, "Em análise");

  // Escolha única de verdade: o estado `escolhido` é um só — escolher um candidato desmarca a fileira,
  // apesar de ela viver fora do `command` dos grupos (item 66).
  await modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }).click();
  await expect(fileiraDeMarcos).not.toBeChecked();
  cobre(test.info(), "4.3 · 33", { criterio: "20.5" });

  // -------------------------------------------------------------------------
  // 13.1 · A busca — prefixo de PALAVRA, sem acento e sem caixa, e só o nome
  // -------------------------------------------------------------------------
  const busca = modalDeAtribuicao.getByLabel("Buscar pelo nome");

  for (const termo of ["prado", "PRADO", "sonia"]) {
    await busca.fill(termo);
    await expect(
      modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }),
      `a busca por "${termo}"`,
    ).toBeVisible();
    await expect(modalDeAtribuicao.getByRole("option", { name: NOME_DE_HELENA })).toHaveCount(0);
  }

  // Sobrenome é como se procura gente — é a adaptação ao campo que o protótipo não previa.
  await busca.fill("fontes");
  await expect(modalDeAtribuicao.getByRole("option", { name: SOLICITANTE_DO_AURORA })).toBeVisible();
  await expect(
    modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }),
  ).toHaveCount(0);

  // **Prefixo, e não pedaço:** `ado` não acha *Prado*. Sobra só a fileira do topo, que não é filtrada.
  await busca.fill("ado");
  await expect(modalDeAtribuicao.getByRole("radio")).toHaveCount(1);
  await expect(modalDeAtribuicao.getByRole("option")).toHaveCount(0);
  await expect(fileiraDeMarcos).toBeVisible();

  // **Frase própria, diferente de qualquer outra do produto** — trocar uma pela outra faz o Gestor pensar
  // que perdeu dados.
  await busca.fill("zzz");
  await expect(modalDeAtribuicao.getByText("Ninguém com esse nome.")).toBeVisible();
  await expect(fileiraDeMarcos).toBeVisible();
  cobre(test.info(), "4.3 · 34", { criterio: "20.6" });

  // **`Enter` no campo escolhe, e não envia** — o `cmdk` previne o `Enter`. Sem isso, o formulário
  // enviaria e acenderia o erro do campo obrigatório, ou gravaria a pessoa realçada.
  await busca.fill("prado");
  await busca.press("Enter");
  await expect(modalDeAtribuicao).toBeVisible();
  await expect(
    modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(modalDeAtribuicao.getByText("Escolha o responsável.")).toHaveCount(0);
  await esperarSituacao(marcos, "Em análise");
  await busca.fill("");

  // -------------------------------------------------------------------------
  // 13.2 · Seleção que o filtro esconde é APAGADA, e não guardada
  //
  // **É a forma mais silenciosa de gravar a pessoa errada**, e por isso a prova é o clique em *Atribuir*
  // devolver a mensagem do campo obrigatório em vez de gravar alguém que a tela não mostra.
  // -------------------------------------------------------------------------
  await busca.fill("");
  await modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }).click();
  await busca.fill("rocha");
  await expect(
    modalDeAtribuicao.getByRole("option", { name: ENCARREGADA_DO_AURORA }),
  ).toHaveCount(0);
  await expect(modalDeAtribuicao.getByRole("option", { name: NOME_DE_HELENA })).not.toHaveAttribute(
    "aria-checked",
    "true",
  );

  await modalDeAtribuicao.getByRole("button", { name: "Atribuir" }).click();
  await expect(modalDeAtribuicao.getByText("Escolha o responsável.")).toBeVisible();
  await esperarSituacao(marcos, "Em análise");
  cobre(test.info(), "4.3 · 35", { criterio: "20.6" });

  // Reabrir zera o formulário — `aoAbrir` limpa a escolha e a busca.
  await modalDeAtribuicao.getByRole("button", { name: "Cancelar" }).click();
  await expect(marcos.getByRole("dialog")).toHaveCount(0);
  await marcos.getByRole("button", { name: "Atribuir" }).click();
  const modalReaberto = marcos.getByRole("dialog");
  await expect(modalReaberto.getByLabel("Buscar pelo nome")).toHaveValue("");
  cobre(test.info(), "4.3 · 36");

  // -------------------------------------------------------------------------
  // 13.3 · O responsável é um Solicitante, e isso é decisão de contrato
  //
  // *"A lista de candidatos é literalmente a lista de vínculos ativos"* — a D21 protege a possibilidade de
  // **qualquer** vínculo responder por uma ocorrência. Atribuir a um Solicitante é o caso que prova que o
  // agrupamento ordena sem excluir.
  // -------------------------------------------------------------------------
  await modalReaberto.getByRole("option", { name: SOLICITANTE_DO_AURORA }).click();
  await modalReaberto.getByRole("button", { name: "Atribuir" }).click();
  await expect(marcos.getByRole("dialog")).toHaveCount(0);

  await expect(identidade(marcos)).toContainText(SOLICITANTE_DO_AURORA);
  cobre(test.info(), "4.3 · 37", { falta: "a linha do tempo com o ficou responsável, e a bolinha vazada" });
  // **A palavra sai do ESTADO, não da intenção de quem clica** — há responsável, então o menu diz
  // *Reatribuir*. E *Iniciar atendimento* passou a existir.
  await expect(marcos.getByRole("button", { name: "Iniciar atendimento" })).toBeVisible();
  await marcos.getByRole("button", { name: "Mais ações ▾" }).click();
  await expect(marcos.getByRole("menuitem", { name: "Reatribuir" })).toBeVisible();
  await marcos.keyboard.press("Escape");
  await expect(marcos.getByRole("menu")).toHaveCount(0);
  cobre(test.info(), "4.3 · 38", { falta: "Pausar e Cancelar no menu depois da atribuição" });

  // -------------------------------------------------------------------------
  // 14 · Helena cancela a própria ocorrência — a Parte 4.5, que nenhum dos seis toca
  //
  // **Quatro motivos, e não sete.** A lista é filtrada pela MESMA função que o comando de aplicação usa
  // para lançar o `422`: duas regras sobre quais motivos são de quem divergiriam, e a divergência seria um
  // motivo oferecido em tela que o servidor recusa no clique.
  //
  // **O aviso troca de sujeito** — critério 18.7. Para ela, quem lê a observação é o outro lado; dizer-lhe
  // que *"o Solicitante vê esta observação"* seria verdade inútil, dita a ela sobre ela mesma.
  // -------------------------------------------------------------------------
  await helena.goto(`/ocorrencias/${ocorrenciaC}`);
  await esperarSituacao(helena, ABERTA_PARA_O_SOLICITANTE);

  await helena.getByRole("button", { name: "Cancelar" }).click();
  const modalDeCancelamento = helena.getByRole("dialog");
  await expect(
    modalDeCancelamento.getByRole("heading", { name: "Cancelar a ocorrência" }),
  ).toBeVisible();
  await expect(
    modalDeCancelamento.getByText("A ocorrência será encerrada sem resolução. Não há como reabrir."),
  ).toBeVisible();
  await expect(modalDeCancelamento.getByRole("radio")).toHaveCount(MOTIVOS_DO_AUTOR);
  cobre(test.info(), "4.5 · 66", {
    falta: "os nomes dos quatro motivos — a asserção conta quatro e nomeia só Aberta por engano",
  });
  await expect(modalDeCancelamento.getByText(AVISO_PARA_QUEM_NAO_GESTIONA)).toBeVisible();
  await expect(modalDeCancelamento.getByText(AVISO_DE_VISIBILIDADE)).toHaveCount(0);
  cobre(test.info(), "4.5 · 67", { criterio: "18.7" });

  await modalDeCancelamento.getByRole("radio", { name: MOTIVO_DE_C }).check();
  await modalDeCancelamento.getByLabel(/^Observação/u).fill(OBSERVACAO_DE_C);
  await modalDeCancelamento.getByRole("button", { name: "Cancelar a ocorrência" }).click();

  await esperarSituacao(helena, "Cancelada");
  // **`Cancelada` é a mesma palavra nas duas colunas do glossário.** O que muda é a barra: nenhuma ação, e
  // a frase terminal no lugar dela.
  await expect(helena.getByText("Esta ocorrência está encerrada.")).toBeVisible();
  await expect(ciclo(helena)).toContainText("O ciclo não continua.");
  cobre(test.info(), "4.5 · 68", {
    falta: "a barra sem botão nenhum — a asserção confere a frase terminal, não a ausência das ações",
  });

  await contextoDeHelena.close();
  await contextoDeMarcos.close();
});

/**
 * ============================================================================
 *  V-14 · Gravar a prioridade pelo teclado joga o foco no `body`, e o
 *  *Desfazer* deixa de ser alcançável
 * ============================================================================
 *
 * **Medido em 22/09/2026, durante a escrita deste arquivo.** Com o gatilho da prioridade em foco, `Enter`
 * abre a lista, a seta move e `Enter` escolhe: o valor troca e **grava** — isso passa, e está no teste de
 * cima. Logo depois, `document.activeElement` é o `<body>`:
 *
 *     SONDA-FOCO  BODY|id=|role=|texto=Abrir navegaçãoResolve AíEdifício Aurora
 *
 * **Esperava:** o foco de volta no gatilho, e o `Tab` seguinte no *Desfazer*.
 *
 * **A causa provável, e ela está no próprio componente:** `gravar` chama `setEnviando(true)`, o `Select`
 * recebe `disabled={enviando}` e o navegador **tira o foco de um botão que acaba de ser desabilitado**.
 * Quando `enviando` volta a `false`, ninguém devolve o foco. O *Desfazer* sofre do mesmo: ele também é
 * `disabled={enviando}`.
 *
 * **Por que isto importa mais aqui do que em qualquer outro controle do produto.** O seletor de prioridade
 * é *"o único ponto de escrita do produto sem confirmação"*, e o docblock dele escreve a razão de a linha
 * do desfazer existir: *"com o gatilho do seletor em foco, a seta do teclado troca o valor — sem
 * intenção"*. Quem troca sem intenção é, por definição, quem está navegando por teclado — e é justamente
 * ele que, ao terminar a gravação, perde o foco e precisa tabular do começo do documento para achar a
 * janela de conserto que foi construída para ele. O compromisso **A-2** é *ordem de foco igual à de
 * leitura*, e o `body` não está na ordem de leitura nenhuma.
 *
 * **Não é erro de escrita deste teste, e a diferença foi medida:** a primeira versão esperava o foco no
 * *Desfazer* e a segunda esperava o foco no gatilho. As duas leram `BODY`. Nenhuma espera conserta isto,
 * porque não há nada por vir.
 *
 * **Marcado, e não consertado.** O conserto é de produto — devolver o foco ao gatilho quando `enviando`
 * volta a `false`, ou trocar `disabled` por `aria-disabled` com o envio ignorado —, e mexer em
 * `seletor-de-prioridade.tsx` para um teste passar é o que a regra 5 do lote proíbe. Quando o conserto
 * vier, troque `test.fixme` por `test` e ele passa a ser a rede.
 *
 * **Ele constrói o próprio mundo**, e não depende do teste de cima: a regra continua sendo *um teste
 * acrescenta ao mundo, nunca o altera*, e alterar a prioridade de uma ocorrência semeada mudaria o que os
 * outros arquivos do lote leem.
 */
test.fixme(
  "V-14 · depois de gravar a prioridade pelo teclado, o foco volta ao gatilho e o Desfazer é o próximo alvo",
  cobertura([{ roteiro: "4.3 · 26", falta: "a visibilidade do anel de foco" }]),
  async ({ browser }) => {
    const contextoDeHelena = await browser.newContext();
    const contextoDeMarcos = await browser.newContext();
    const helena = await contextoDeHelena.newPage();
    const marcos = await contextoDeMarcos.newPage();

    const titulo = `Foco do teclado ${marcaDoInstante()} — corrimão solto na escada`;

    await entrar(helena, HELENA);
    await helena.waitForURL(/\/organizacao$/u);
    await helena.getByRole("button", { name: AURORA }).click();
    await helena.waitForURL(/\/ocorrencias$/u);
    const ocorrencia = await registrarOcorrencia(
      helena,
      titulo,
      "O corrimão balança no trecho entre o segundo e o terceiro andar.",
    );

    await entrar(marcos, MARCOS);
    await marcos.waitForURL(/\/ocorrencias$/u);
    await marcos.goto(`/ocorrencias/${ocorrencia}`);

    const seletorDePrioridade = marcos.getByLabel("Prioridade");
    await expect(seletorDePrioridade).toHaveText("Normal");

    // Abrir, mover e escolher — três teclas, e o valor troca e grava.
    await seletorDePrioridade.focus();
    await marcos.keyboard.press("Enter");
    await expect(marcos.getByRole("listbox")).toBeVisible();
    await marcos.keyboard.press("ArrowDown");
    await marcos.keyboard.press("Enter");
    await expect(seletorDePrioridade).toHaveText("Alta");
    await expect(desfazer(marcos)).toContainText("Prioridade alterada de Normal para Alta.");

    // **Aqui é onde ele fica vermelho.** O foco está no `<body>`.
    await expect(seletorDePrioridade).toBeFocused();

    // E, com o foco no lugar, o *Desfazer* é o próximo alvo — o DOM é linear, e não há nada entre os dois.
    await marcos.keyboard.press("Tab");
    await expect(desfazer(marcos).getByRole("button", { name: "Desfazer" })).toBeFocused();
    await marcos.keyboard.press("Enter");
    await expect(seletorDePrioridade).toHaveText("Normal");
    await expect(desfazer(marcos)).toHaveCount(0);

    await contextoDeHelena.close();
    await contextoDeMarcos.close();
  },
);

/**
 * **A página assentada**, que é quando a medida vale. Os `loading.tsx` da casca são esqueletos mais
 * estreitos que o conteúdo, e medir neles daria zero falso; a fonte muda a largura do nome no seletor.
 */
async function assentar(pagina: Page): Promise<void> {
  await expect(pagina.locator("main")).toBeVisible();
  await expect(pagina.locator("main .animate-pulse")).toHaveCount(0);
  await pagina.evaluate(async () => {
    await document.fonts.ready;
  });
}

/**
 * O primeiro `href` da tela que casa o padrão. **Falha dizendo o padrão**, em vez de navegar para
 * `/ocorrencias/undefined` e medir a tela de não encontrada.
 */
async function primeiroHref(pagina: Page, padrao: RegExp): Promise<string> {
  const hrefs = await pagina
    .locator("a[href]")
    .evaluateAll((ancoras) => ancoras.map((ancora) => ancora.getAttribute("href") ?? ""));
  const achado = hrefs.find((href) => padrao.test(href));
  expect(achado, `nenhum link casa ${String(padrao)} em ${pagina.url()}`).toBeDefined();
  return achado ?? "";
}

test("o título longo corta na tela grande e quebra no celular, sem empurrar as ações (critério 66.1)", async ({
  browser,
}) => {
  const contexto = await browser.newContext();
  const helena = await contexto.newPage();

  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: AURORA }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  // **150 caracteres, o teto do schema, e uma palavra de 60 sem espaço** — foco da revisão 3.
  const palavraSemEspaco = "x".repeat(60);
  const titulo = `Titulo longo ${marcaDoInstante()} ${palavraSemEspaco} ${"infiltracao no corredor ".repeat(4)}`
    .slice(0, 150)
    .trim();
  await registrarOcorrencia(helena, titulo, "Ocorrência do teste de título longo.");

  const h1 = helena.getByRole("heading", { level: 1 });
  await expect(h1).toHaveAttribute("title", titulo);
  // Helena é Solicitante e a ocorrência está Aberta: a ação dela é *Cancelar*.
  const acao = helena.getByRole("button", { name: "Cancelar" });

  /**
   * **Três medidas, e cada uma diz uma coisa.** O documento não rola na horizontal (item 92); o `<main>`
   * e o cabeçalho da ocorrência não rolam por dentro, que é o que o critério 66.1 cobra do título longo.
   */
  async function acaoDentroDaTela(largura: number): Promise<void> {
    const caixa = await acao.boundingBox();
    expect(caixa).not.toBeNull();
    expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(largura);

    expect(await transbordo(helena)).toStrictEqual(SEM_TRANSBORDO);

    const conteudo = await helena.evaluate(() => {
      const medir = (elemento: Element | null) =>
        elemento === null ? null : { rola: elemento.scrollWidth, cabe: elemento.clientWidth };
      return {
        principal: medir(document.querySelector("main")),
        cabecalho: medir(document.querySelector("main header")),
      };
    });
    expect(conteudo.principal).not.toBeNull();
    expect(conteudo.cabecalho).not.toBeNull();
    expect(conteudo.principal?.rola ?? 0).toBeLessThanOrEqual(conteudo.principal?.cabe ?? 0);
    expect(conteudo.cabecalho?.rola ?? 0).toBeLessThanOrEqual(conteudo.cabecalho?.cabe ?? 0);
  }

  // Tela grande: o título divide a linha com a ação, e corta.
  await acaoDentroDaTela(1280);
  expect(await h1.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(true);

  // Celular: a ação vai para a linha de baixo, e o título quebra inteiro.
  await helena.setViewportSize({ width: 390, height: 844 });
  await acaoDentroDaTela(390);
  expect(await h1.evaluate((elemento) => elemento.scrollWidth > elemento.clientWidth)).toBe(false);
  await esperarSituacao(helena, ABERTA_PARA_O_SOLICITANTE);

  await contexto.close();
});

test("nenhuma tela da casca rola na horizontal em 390 px (critério 92.2)", async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const helena = await contexto.newPage();

  // **Helena é Gestor do Recanto**, o papel que alcança as doze telas, e o nome mais longo do mundo.
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);
  await assentar(helena);

  // **A pré-condição: o nome no seletor está truncado.** É o pior caso da barra; com um nome curto o teste
  // ficaria verde sem provar nada.
  const nomeTruncado = await helena
    .getByRole("combobox", { name: "Organização" })
    .locator('[data-slot="select-value"]')
    .evaluate((valor) => valor.scrollWidth > valor.clientWidth);
  expect(nomeTruncado).toBe(true);

  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const ocorrencia = await primeiroHref(helena, new RegExp(`^/ocorrencias/${UUID}$`, "u"));
  await helena.goto("/vinculos");
  await assentar(helena);
  const edicao = await primeiroHref(helena, new RegExp(`^/vinculos/${UUID}/editar$`, "u"));

  // As doze rotas de `app/(casca)`. `/ocorrencias/nova` mora em `app/(foco)`, sem a barra. `/convidar` chegou
  // com o item 86, depois de a lista do 92 ser escrita (achado A-1 do 93).
  const rotas = [
    "/ocorrencias",
    ocorrencia,
    `${ocorrencia}/auditoria`,
    "/dashboard",
    "/vinculos",
    "/vinculos/nova",
    edicao,
    "/convidar",
    "/configuracao",
    "/configuracao/categorias",
    "/configuracao/areas",
    "/meus-dados",
  ];
  for (const rota of rotas) {
    await helena.goto(rota);
    await assentar(helena);
    // Suave: uma tela com transbordo não esconde as seguintes.
    expect.soft(await transbordo(helena), `transbordo em ${rota}`).toStrictEqual(SEM_TRANSBORDO);
  }

  await contexto.close();
});

/**
 * **As casas do código na viewport, e a letra do mesmo tamanho** (critérios 93.1, 93.2 e 93.4). Cada casa
 * fica entre 0 e a borda, não corta a própria letra, e a letra é o título de página em toda largura: é
 * isso que diz que o conserto cedeu a caixa e não o código.
 */
async function casasDoCodigo(pagina: Page) {
  return pagina.locator('[data-slot="input-otp-slot"]').evaluateAll((casas) =>
    casas.map((casa) => {
      const caixa = casa.getBoundingClientRect();
      return {
        dentro: caixa.left >= 0 && caixa.right <= document.documentElement.clientWidth + 0.5,
        cortada: casa.scrollWidth > casa.clientWidth,
        letra: getComputedStyle(casa).fontSize,
      };
    }),
  );
}

test("o código da organização cabe no celular, nas três telas que o exibem (critério 93.1)", async ({
  browser,
}) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const helena = await contexto.newPage();
  const semSessao = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

  // **Helena é Gestor do Recanto**: alcança `/configuracao` e `/convidar`, e o código sai do link do convite.
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await helena.getByRole("button", { name: RECANTO }).click();
  await helena.waitForURL(/\/ocorrencias$/u);
  await helena.goto("/convidar");
  await assentar(helena);
  const link = (await helena.locator("code").first().innerText()).trim();
  expect(link).toMatch(/\?e=[A-Z0-9]{8}$/u);
  const codigo = link.slice(link.indexOf("?e=") + 3);

  // As quatro do critério, e a de 768 px, onde a barra lateral aparece e passa a apertar a página (spec §3.2).
  const larguras = [320, 360, 390, 414, 768];
  const telas: ReadonlyArray<{ pagina: Page; rota: string; casca: boolean }> = [
    { pagina: helena, rota: "/configuracao", casca: true },
    { pagina: helena, rota: "/convidar", casca: true },
    { pagina: semSessao, rota: `/convite/${codigo}`, casca: false },
  ];

  for (const largura of larguras) {
    for (const { pagina, rota, casca } of telas) {
      await pagina.setViewportSize({ width: largura, height: 844 });
      await pagina.goto(rota);
      await assentar(pagina);
      const onde = `${rota} a ${largura} px`;

      /**
       * **A medida da página, nas telas da casca, começa em 360 px**, e o motivo é defeito de outra peça.
       * A 320 px o grupo `ml-auto` da barra superior (`casca/barra-superior.tsx:30`, com o seletor de
       * organização e o menu de pessoa) termina em 352 px e **o documento rola 32 px na horizontal**, nas
       * duas rotas da casca, com o código já consertado. O item 92 mediu a barra só a 390 px, e nenhum
       * critério aceito cobra 320 dela; o achado foi ao hub com o número medido.
       *
       * **As oito casas do código continuam medidas nas cinco larguras, esta inclusive** — é o que o
       * critério 93.1 cobra, e é o que o conserto deste item entrega.
       */
      if (!casca || largura >= 360) {
        expect.soft(await transbordo(pagina), `transbordo em ${onde}`).toStrictEqual(SEM_TRANSBORDO);
      }

      const casas = await casasDoCodigo(pagina);
      expect.soft(casas, `casas em ${onde}`).toHaveLength(8);
      for (const [indice, casa] of casas.entries()) {
        expect.soft(casa, `casa ${indice + 1} em ${onde}`).toStrictEqual({
          dentro: true,
          cortada: false,
          letra: "26px",
        });
      }
    }

    // **O critério 93.2 pelo nome**: a frase de apoio do código, em `/configuracao`, termina dentro da tela.
    await helena.setViewportSize({ width: largura, height: 844 });
    await helena.goto("/configuracao");
    await assentar(helena);
    const apoio = helena.getByText("É o código do cartaz do elevador.", { exact: false });
    const caixa = await apoio.boundingBox();
    expect
      .soft((caixa?.x ?? 9999) + (caixa?.width ?? 0), `apoio de /configuracao a ${largura} px`)
      .toBeLessThanOrEqual(largura);
  }

  await contexto.close();
  await semSessao.context().close();
});
