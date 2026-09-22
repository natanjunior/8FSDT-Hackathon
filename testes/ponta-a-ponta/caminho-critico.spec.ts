import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * ============================================================================
 *  O caminho crítico do enunciado, de fora para dentro — o item 41b
 * ============================================================================
 *
 * **É o único teste de ponta a ponta do projeto, e é para sempre** (ADR-0008). O que ele prova é
 * **binário**: ou as camadas se falam — navegador, rota do Next, camada de aplicação, agregado,
 * repositório escopado, Postgres, provedor de autenticação —, ou não se falam. **Nenhum outro teste deste
 * repositório toca a autenticação real, e nenhum toca `app/`.**
 *
 * **Ele não é uma suíte, e não cresce.** Ganha asserção quando uma garantia nova precisar de prova de
 * fora; **nunca ganha arquivo**. Um segundo só entra se provar **outro transporte** — e o único candidato
 * nomeado pela ADR-0008 é a leitura offline do RNF7.
 *
 * ---------------------------------------------------------------------------
 *  Os dois pré-requisitos, e eles NÃO são automatizados de propósito
 * ---------------------------------------------------------------------------
 *
 * 1. **A pilha de pé** — `npm run local` (README). Não há `webServer` no `playwright.config.ts`: a pilha
 *    não é um processo, e duplicá-la ali seria uma segunda cópia do procedimento do README que diverge no
 *    primeiro ajuste.
 * 2. **A semente de demonstração aplicada** — `SENHA_DA_DEMONSTRACAO=… npm run semear:demo`. Um
 *    `globalSetup` que a rodasse acrescentaria minutos e **falharia por desenho** quando a demonstração
 *    já existisse (*"a semente recusa quando a demonstração já existe"*, README `:164`).
 *
 * ---------------------------------------------------------------------------
 *  O mundo é o da semente, e este teste só ACRESCENTA
 * ---------------------------------------------------------------------------
 *
 * A regra é a da `arquitetura.md` §7.2: **um teste pode acrescentar ao mundo; nunca alterá-lo.** Ele
 * acrescenta **uma** ocorrência ao Edifício Aurora e não toca em nada semeado. O título carrega a marca
 * do instante da execução, para que toda asserção de lista encontre exatamente a linha dela e nunca uma
 * das 36 da demonstração. Rodar duas vezes cria duas ocorrências marcadas e nada quebra;
 * `npm run semear:demo -- --apagar` limpa tudo.
 *
 * **As contas são de verdade** — criadas por `criarConta`, pelos mesmos caminhos do produto
 * (`semente/mundo.ts:146-160`). É o único lugar do repositório onde existe credencial real com senha
 * conhecida, e é o que faz este teste provar a autenticação em vez de simulá-la (critério 41b.4).
 *
 * ---------------------------------------------------------------------------
 *  Localizadores: só o que o usuário vê
 * ---------------------------------------------------------------------------
 *
 * **Nenhum `data-testid`** — não existe um único no repositório, e criá-los faria um item de *teste*
 * editar arquivos de *produto*. O teste usa `getByRole`, `getByLabel` e `getByText`, que é o que o
 * shadcn/ui torna confiável (os controles nascem com nome acessível) e é o mesmo alvo que o compromisso
 * **A-1** do DoD cobra. **Efeito colateral bem-vindo:** um teste que só enxerga o que o usuário enxerga
 * falha quando a acessibilidade regride.
 *
 * **Onde há índice de posição, o índice É a asserção** — as linhas da trilha são conferidas por posição
 * porque a ordem *do mais antigo para o mais recente* é justamente o que se está provando. Em nenhum
 * outro lugar há índice de posição.
 */

/**
 * **Falha na carga do arquivo, com o comando exato.** Sem isto, a senha ausente apareceria como
 * *"E-mail ou senha incorretos."* na tela de login — indistinguível de defeito de produto.
 */
const SENHA = process.env["SENHA_DA_DEMONSTRACAO"];
if (SENHA === undefined || SENHA === "") {
  throw new Error(
    "SENHA_DA_DEMONSTRACAO não está no ambiente. Rode:\n" +
      "  SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run teste:ponta-a-ponta\n" +
      "É a mesma senha com que a semente de demonstração criou as duas contas (README, «A demonstração»).",
  );
}

const HELENA = "helena.demo@example.com";
const MARCOS = "marcos.demo@example.com";
const AURORA = "Edifício Aurora (demonstração)";
const RECANTO = "Condomínio Recanto Azul (demonstração)";
const ENCARREGADA_DO_AURORA = "Sônia Prado";

/** A marca do instante — é ela que separa esta ocorrência das 36 da demonstração. */
const MARCA = new Date().toISOString().replace(/[:.]/gu, "-");
const TITULO = `Ponta a ponta ${MARCA} — vazamento na garagem`;

const OBSERVACAO_DO_ATENDIMENTO = "A equipe sobe hoje à tarde para ver de onde vem a água.";
const SOLUCAO_APLICADA = "Trecho da manta refeito na junta de dilatação e ralo desobstruído.";
const OBSERVACAO_DA_RESOLUCAO = "Duas horas de teste com mangueira, sem gotejamento.";
const COMENTARIO_DA_AVALIACAO = "Resolveram rápido e me avisaram do começo ao fim.";

/**
 * **Um PNG de 16×16, 79 bytes, montado aqui e não guardado como arquivo.** Binário no repositório para uma
 * asserção só não se paga, e o que este teste prova não depende do conteúdo da imagem.
 *
 * **PNG e não JPEG de propósito:** o controle de foto re-codifica qualquer entrada para JPEG no canvas
 * (item 13a), então o caminho exercitado é o mesmo — e um PNG mínimo válido cabe numa linha.
 */
const FOTO_EM_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mM4YaNBEmIY1TCqYfhqAAAeBCwQMd+aqQAAAABJRU5ErkJggg==";

test("o caminho crítico do enunciado, com autenticação real e a trilha conferida na interface", async ({
  browser,
}) => {
  const contextoDeHelena = await browser.newContext();
  const contextoDeMarcos = await browser.newContext();
  const helena = await contextoDeHelena.newPage();
  const marcos = await contextoDeMarcos.newPage();

  // -------------------------------------------------------------------------
  // 1 · Helena entra e escolhe o Edifício Aurora
  //
  // **Cair em T-02 é comportamento correto, não obstáculo.** Com dois vínculos e sem escolha na sessão,
  // `organizacaoAtiva` vem `null` e a tela pede a escolha (`resolver-contexto.ts:166-175`). O passo 1 é,
  // portanto, uma prova a mais — de graça.
  // -------------------------------------------------------------------------
  await entrar(helena, HELENA);
  await helena.waitForURL(/\/organizacao$/u);
  await expect(
    helena.getByRole("heading", { name: "Em qual organização você quer trabalhar?" }),
  ).toBeVisible();
  await helena.getByRole("button", { name: AURORA }).click();
  await helena.waitForURL(/\/ocorrencias$/u);

  // -------------------------------------------------------------------------
  // 2 · Helena registra a ocorrência marcada — T-04
  // -------------------------------------------------------------------------
  await helena.getByRole("link", { name: "+ Registrar ocorrência" }).click();
  await helena.waitForURL(/\/ocorrencias\/nova$/u);
  await helena.getByLabel("Título").fill(TITULO);
  await helena
    .getByLabel("Descrição")
    .fill("Água pingando do teto da garagem, perto da vaga 12. Piora quando chove.");

  // -------------------------------------------------------------------------
  // A foto — o critério 51.10, e o buraco que deixou o V-11 invisível por 26 dias
  //
  // **O controle de arquivo é cru e fica `sr-only`** (o catálogo não tem peça para ele), então o
  // localizador é o `id`. `setInputFiles` alcança entrada oculta.
  // -------------------------------------------------------------------------
  await helena.locator("input#foto").setInputFiles({
    name: "vazamento.png",
    mimeType: "image/png",
    buffer: Buffer.from(FOTO_EM_BASE64, "base64"),
  });

  // **Esperar a foto ficar pronta antes de registrar.** O formulário não trava enquanto ela sobe (DG-5), e
  // é justamente por isso que o teste precisa esperar: sem isto, o clique poderia sair antes de a
  // referência existir e a ocorrência nasceria sem anexo — passando verde pelo motivo errado.
  await expect(helena.getByText("Foto pronta")).toBeVisible({ timeout: 30_000 });
  // **Categoria e Área deixaram de ser seletores nativos no item 44l**, e o `selectOption` com elas. O
  // gatilho de cada uma é um botão nomeado pelo rótulo do campo — `getByLabel` o alcança, porque botão é
  // elemento rotulável e o `Campo` liga os dois por `htmlFor`. **Qual categoria e qual área continua não
  // importando**, e fixar um nome amarraria o teste ao conteúdo da semente.
  //
  // **Este teste roda em 1280 px** (`playwright.config.ts`), que é tela grande: é o painel ancorado que
  // ele exercita, e não a gaveta do celular.
  await helena.getByLabel("Categoria").click();
  await helena.getByRole("option").first().click();
  await helena.getByLabel("Área").click();
  await helena.getByRole("option").first().click();
  await helena.getByRole("button", { name: "Registrar ocorrência" }).click();

  // Depois do `201`, T-05 da ocorrência criada (critério 11.5). O identificador sai da URL.
  await helena.waitForURL(
    /\/ocorrencias\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
  );
  const ocorrenciaId = helena.url().split("/").pop() ?? "";
  expect(ocorrenciaId).not.toBe("");

  // -------------------------------------------------------------------------
  // 3 · A troca de organização, no meio do percurso — o critério 41b.3
  //
  // **A asserção é de DOIS lados, e é isso que a torna prova:** em Aurora a lista contém a ocorrência
  // recém-registrada; no Recanto Azul ela **não** a contém, **e a lista mostra linhas do Recanto** — isto
  // é, não está apenas vazia. Um lado só não provaria nada: lista vazia depois da troca é indistinguível
  // de consulta quebrada.
  //
  // **Um efeito colateral que é vantagem, e fica declarado:** a troca muda a organização **e** o papel de
  // Helena — Solicitante no Aurora, Gestora no Recanto. As duas listas diferem por dois motivos ao mesmo
  // tempo, e isso **fortalece** a segunda asserção: a ocorrência do Aurora não aparece nem para quem tem
  // `ocorrencia.ler_todas` do outro lado.
  //
  // **É a única prova ponta a ponta que a decisão do PA-19 vai ter, e custa dois cliques.**
  //
  // **O recorte de T-03 mudou de forma no item 44c**, e é daí que vêm os três localizadores abaixo — os
  // dois desta seção e o de Marcos, na seguinte. O título da página passa a ser *"Ocorrências"*, fixo, e
  // as duas frases do critério 14.3 viram os rótulos de um `toggle-group` de escolha única — daí
  // `role="radio"` e `toBeChecked()`. Quem não tem `ocorrencia.ler_todas` não recebe controle (critério
  // 28.5) e lê a mesma frase como texto, que é o critério 44c.9.
  // -------------------------------------------------------------------------
  await helena.goto("/ocorrencias");
  // Critério 44c.9 — sem `ler_todas` o recorte é texto, e não controle. As palavras são as mesmas.
  await expect(helena.getByText("Minhas ocorrências")).toBeVisible();
  await expect(helena.getByRole("link", { name: TITULO })).toBeVisible();

  await trocarDeOrganizacao(helena, RECANTO);
  // Critério 44c.2 — o recorte virou `toggle-group` de escolha única, então a palavra do 14.3 mora
  // numa opção marcada, e não mais num cabeçalho.
  await expect(helena.getByRole("radio", { name: "Todas as ocorrências" })).toBeChecked();
  await expect(helena.getByRole("link", { name: TITULO })).toHaveCount(0);
  // A lista do Recanto **tem** linhas — a semente escreve nas duas organizações. Sem isto, uma consulta
  // quebrada passaria no teste.
  await expect(helena.getByRole("table").getByRole("row")).not.toHaveCount(0);

  await trocarDeOrganizacao(helena, AURORA);
  await expect(helena.getByRole("link", { name: TITULO })).toBeVisible();

  // -------------------------------------------------------------------------
  // 4 · Marcos entra — vínculo único, organização escolhida pelo servidor
  //
  // Com exatamente um vínculo ativo, o servidor escolhe e grava o cookie na própria resposta
  // (contrato §4.3). Ele não passa por T-02.
  // -------------------------------------------------------------------------
  await entrar(marcos, MARCOS);
  await marcos.waitForURL(/\/ocorrencias$/u);
  await expect(marcos.getByRole("radio", { name: "Todas as ocorrências" })).toBeChecked();
  await marcos.getByRole("link", { name: TITULO }).click();
  await marcos.waitForURL(new RegExp(`/ocorrencias/${ocorrenciaId}$`, "u"));

  // -------------------------------------------------------------------------
  // A foto aparece, e os BYTES voltam — critério 51.10
  //
  // **A asserção de visibilidade sozinha não provaria nada.** A foto é desenhada como `div` com
  // `background-image` (decisão do 13b, para os bytes não atravessarem o contêiner), e elemento com
  // `background-image` fica visível mesmo quando a imagem não carrega. Um caminho que gravasse a linha em
  // `anexos` e não guardasse os bytes passaria verde.
  //
  // **A requisição direta é o que transforma a asserção em prova.** O `href` responde `302` para uma URL
  // assinada; o `request` do Playwright segue o redirecionamento com os cookies da sessão.
  //
  // **É a única coisa do repositório que fala com o armazenamento pela rede.** Nenhum teste de integração
  // o alcança — os dois de anexo batem em Postgres, e o do emissor só assina HMAC.
  // -------------------------------------------------------------------------
  const aFoto = marcos.getByRole("img", { name: "Foto anexada à ocorrência" });
  await expect(aFoto).toBeVisible();

  const enderecoDaFoto = await marcos.getByRole("link").filter({ has: aFoto }).getAttribute("href");
  expect(enderecoDaFoto).not.toBeNull();

  const bytes = await marcos.request.get(enderecoDaFoto ?? "");
  expect(bytes.status()).toBe(200);
  expect(bytes.headers()["content-type"]).toContain("image");
  expect((await bytes.body()).byteLength).toBeGreaterThan(0);

  // -------------------------------------------------------------------------
  // 5 · Analisar — `aberta` → `em_analise`
  //
  // **Sem observação, e não é esquecimento:** `analisar` é botão nu em T-05 — não tem entrada no mapa
  // `formularios` da página —, então pela interface ele grava `observacao: null`. Os dois registros com
  // texto vêm dos passos 7 e 8.
  //
  // Os rótulos são os do Gestor (`lenteDeRotulo` → `NOME_DO_STATUS`): «Aberta», «Em análise»,
  // «Em atendimento», «Resolvida».
  // -------------------------------------------------------------------------
  await esperarSituacao(marcos, "Aberta");
  await marcos.getByRole("button", { name: "Analisar" }).click();
  await esperarSituacao(marcos, "Em análise");

  // -------------------------------------------------------------------------
  // 6 · Atribuir a Sônia Prado — a Encarregada do Aurora
  //
  // **Não é «Atribuir a mim».** O botão de auto-atribuição existe e é um clique; atribuir à Encarregada
  // custa dois, percorre a lista de candidatos — a superfície larga do modal — e mantém separadas as duas
  // figuras que o glossário separa: **quem tria** e **quem executa**.
  //
  // `iniciar-atendimento` não exige que quem chama seja o responsável, só que exista um
  // (`iniciar-atendimento.ts:71-72`), então Marcos segue conduzindo.
  //
  // **O escopo `getByRole("dialog")` não é enfeite:** o gatilho e o botão que grava têm o mesmo rótulo,
  // «Atribuir», e um localizador solto pegaria os dois.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Atribuir" }).click();
  const modalDeAtribuicao = marcos.getByRole("dialog");
  await expect(
    modalDeAtribuicao.getByRole("heading", { name: "Atribuir responsável" }),
  ).toBeVisible();
  await modalDeAtribuicao.getByRole("radio", { name: ENCARREGADA_DO_AURORA }).check();
  await modalDeAtribuicao.getByRole("button", { name: "Atribuir" }).click();
  await expect(marcos.getByText(ENCARREGADA_DO_AURORA).first()).toBeVisible();

  // -------------------------------------------------------------------------
  // 7 · Iniciar atendimento, com observação — `em_analise` → `em_atendimento`
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Iniciar atendimento" }).click();
  const modalDeAtendimento = marcos.getByRole("dialog");
  await modalDeAtendimento.getByLabel("Observação (opcional)").fill(OBSERVACAO_DO_ATENDIMENTO);
  await modalDeAtendimento.getByRole("button", { name: "Iniciar" }).click();
  await esperarSituacao(marcos, "Em atendimento");

  // -------------------------------------------------------------------------
  // 8 · Resolver, com a solução aplicada no mesmo modal — `em_atendimento` → `resolvida`
  //
  // **A solução aplicada NÃO é um passo a mais do percurso:** ela viaja no corpo do `resolver`, e o
  // contrato §8.4 diz que enviá-la ali *"equivale a chamar `/registrar-solucao-aplicada` antes"*.
  // -------------------------------------------------------------------------
  await marcos.getByRole("button", { name: "Resolver" }).click();
  const modalDeResolucao = marcos.getByRole("dialog");
  // **O escopo `modalDeResolucao` deixou de ser conveniência e virou necessidade** (item 44p, critério
  // 19): a página tem um campo com este mesmo rótulo, e um localizador solto pegaria os dois.
  await modalDeResolucao.getByLabel("Solução aplicada").fill(SOLUCAO_APLICADA);
  await modalDeResolucao.getByLabel("Observação (opcional)").fill(OBSERVACAO_DA_RESOLUCAO);
  await modalDeResolucao.getByRole("button", { name: "Resolver" }).click();
  await esperarSituacao(marcos, "Resolvida");

  // -------------------------------------------------------------------------
  // 9 · Helena avalia — nota e comentário
  //
  // Ela é a autora, e `avaliar` é o único comando renderizável em `resolvida` para ela.
  // -------------------------------------------------------------------------
  await helena.goto(`/ocorrencias/${ocorrenciaId}`);
  await esperarSituacao(helena, "Resolvida");
  await helena.getByRole("button", { name: "Avaliar" }).click();
  const modalDeAvaliacao = helena.getByRole("dialog");
  await modalDeAvaliacao.getByRole("radio", { name: "5, muito bom" }).check();
  await modalDeAvaliacao.getByLabel("Comentário (opcional)").fill(COMENTARIO_DA_AVALIACAO);
  await modalDeAvaliacao.getByRole("button", { name: "Enviar avaliação" }).click();
  await expect(helena.getByRole("heading", { name: "Sua avaliação" })).toBeVisible();
  await expect(helena.getByText("Nota 5 de 5")).toBeVisible();

  // -------------------------------------------------------------------------
  // 10 · A trilha, conferida NA INTERFACE — o critério 41b.2
  //
  // **Clicando, não digitando a URL** — é o critério 41b.7.
  //
  // **Quatro registros, e não seis:** `atribuir-responsavel` e `avaliar` não transicionam (estão em
  // `SEM_TRANSICAO`, `MaquinaDeEstados.ts:29-43`), então não geram registro de trilha.
  //
  // **`statusAnterior` ausente SÓ no primeiro** — é a premissa P1, e é o campo que faz uma trilha ser
  // trilha. Desde o item 44n ele é dito por extenso, em vez de travessão.
  //
  // **Os nomes são os do glossário, na coluna neutra** (critério 44n.5): a trilha imprime *Em análise*,
  // e não `em_analise`. Não é o rótulo por papel do item 31 — esta tela está fora da lente, e sempre
  // esteve; o que mudou foi o vocabulário neutro que ela usa.
  //
  // **A lista é localizada pelo nome**, e não por `getByRole("list")` seco: a casca põe barra lateral e
  // barra superior nesta tela, e as duas são listas.
  // -------------------------------------------------------------------------
  await helena.getByRole("link", { name: "ver a trilha de auditoria" }).click();
  await helena.waitForURL(new RegExp(`/ocorrencias/${ocorrenciaId}/auditoria$`, "u"));
  await expect(helena.getByRole("heading", { name: "Trilha de auditoria" })).toBeVisible();
  await expect(helena.getByText(TITULO)).toBeVisible();

  const trilha = helena.getByRole("list", { name: "Registros da trilha" });
  await expect(trilha.getByRole("listitem")).toHaveCount(4);

  const esperado = [
    {
      novo: "Aberta",
      anterior: "primeiro registro, sem status anterior",
      autor: "Helena Rocha",
      observacao: "sem observação",
    },
    {
      novo: "Em análise",
      anterior: "Aberta",
      autor: "Marcos Vieira",
      observacao: "sem observação",
    },
    {
      novo: "Em atendimento",
      anterior: "Em análise",
      autor: "Marcos Vieira",
      observacao: OBSERVACAO_DO_ATENDIMENTO,
    },
    {
      novo: "Resolvida",
      anterior: "Em atendimento",
      autor: "Marcos Vieira",
      observacao: OBSERVACAO_DA_RESOLUCAO,
    },
  ];

  for (const [indice, registro] of esperado.entries()) {
    const item = trilha.getByRole("listitem").nth(indice);

    await expect(item).toContainText(`novo status: ${registro.novo}`);
    await expect(item).toContainText(`status anterior: ${registro.anterior}`);
    await expect(item).toContainText(`autor: ${registro.autor}`);
    await expect(item).toContainText(`observação: ${registro.observacao}`);
    // O carimbo com segundos, com o separador da regra de data. **É um dos cinco campos do F5**, e a
    // asserção é de forma: conferir o valor exato amarraria o teste ao relógio de quem o roda.
    await expect(item).toContainText(/data e hora: \d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}:\d{2}/u);
  }

  // -------------------------------------------------------------------------
  // 11 · A asserção de recusa — o critério 41b.8
  //
  // **É asserção, não percurso** — a ADR-0008 proíbe arquivo e permite asserção —, e é a **primeira vez
  // que um teste deste repositório chama um `route.ts`**.
  //
  // Helena é Solicitante no Aurora e **autora** da ocorrência: ela tem `ocorrencia.ler_propria` e não tem
  // `ocorrencia.analisar`. A permissão é conferida **antes** de o recurso ser lido e antes de o corpo ser
  // interpretado (`com-contexto.ts:206-210`), que é o critério **16.4** literal — por isso a requisição
  // vai sem corpo e sem cabeçalho, e ainda assim responde `403`.
  //
  // `helena.request` compartilha os cookies do contexto: é a **própria sessão**, não uma requisição
  // anônima.
  // -------------------------------------------------------------------------
  const recusa = await helena.request.post(`/api/ocorrencias/${ocorrenciaId}/analisar`);
  expect(recusa.status()).toBe(403);
  expect(((await recusa.json()) as { codigo?: string }).codigo).toBe("PERMISSAO_INSUFICIENTE");

  await contextoDeHelena.close();
  await contextoDeMarcos.close();
});

/**
 * T-01 · Entrar. **Autenticação real, sem porta falsa e sem variável que finja sessão** — critério 41b.4,
 * e é a razão de a ADR-0004 e a ADR-0008 recusarem a alternativa: a imagem publicada é pública.
 */
async function entrar(pagina: Page, email: string): Promise<void> {
  await pagina.goto("/entrar");
  await pagina.getByLabel("E-mail").fill(email);
  // **Ancorada, e não por trecho nem exata** (item 44m). Por trecho, "Senha" casa também com o
  // "Mostrar a senha" do botão que o 44m pôs dentro do campo, e o `fill` quebra por modo estrito. Exata
  // não casa com nada, porque o rótulo é "Senha *": o asterisco é um `<span aria-hidden>` dentro do
  // `<label>`, e o motor do localizador não pula `aria-hidden`. A âncora resolve os dois, e sobrevive ao
  // asterisco existir ou não.
  await pagina.getByLabel(/^Senha/u).fill(SENHA as string);
  await pagina.getByRole("button", { name: "Entrar" }).click();
}

/**
 * O seletor de organização da barra superior da casca (`casca/seletor-de-organizacao.tsx`). **Ele era
 * `dropdown-menu` e virou `select` no item 44b**, então o papel do gatilho passou de `button` para
 * `combobox` e o das opções de `menuitem` para `option`. O nome acessível do gatilho é o `aria-label`
 * *Organização*, e não mais o nome da organização ativa.
 *
 * **Depois da troca o destino é `/`**, que é o losango e redespacha para T-03 — por isso a espera é pela
 * URL da lista, e não pela raiz.
 */
async function trocarDeOrganizacao(pagina: Page, destino: string): Promise<void> {
  await pagina.getByRole("combobox", { name: /organização/iu }).click();
  await pagina.getByRole("option", { name: destino }).click();
  await pagina.waitForURL(/\/ocorrencias$/u);
}

/**
 * O bloco 1a de T-05 — *Situação*, o `statusRotulo` que não pode rolar.
 *
 * **Escopado pela seção, e nunca por índice de posição** (§3.7 da spec): a mesma palavra aparece na linha
 * do tempo, dentro de uma frase, e um localizador solto pegaria as duas.
 */
function situacao(pagina: Page): Locator {
  return pagina.locator("section").filter({ hasText: "Situação" }).first();
}

async function esperarSituacao(pagina: Page, rotulo: string): Promise<void> {
  await expect(situacao(pagina)).toContainText(rotulo);
}
