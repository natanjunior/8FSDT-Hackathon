import { expect, test, type Locator, type Page } from "@playwright/test";

import { cobertura, cobre } from "./cobertura";
import { SEM_TRANSBORDO, transbordo } from "./transbordo";

/**
 * ============================================================================
 *  A configuração da organização — Parte 3
 * ============================================================================
 *
 * **O sexto e último arquivo de ponta a ponta do lote, e ele nasce pela ADR-0012**: o teste cresce por
 * **jornada** do roteiro de validação, com teto de seis arquivos. Esta é a jornada de quem acabou de
 * fundar uma organização e vai ajustá-la — as duas listas de T-09 e T-14, o ícone de T-09 e os contatos
 * de T-08.
 *
 * **O que ele prova é a fiação, e não o vocabulário.** As palavras destas telas já têm teste de unidade
 * em `testes/interface/configuracao.test.ts` e em `testes/interface/vinculo.test.ts`. O que nenhum teste
 * alcançava é o percurso: desativar em T-09 e a categoria sumir do seletor de T-04; reordenar em T-09 e
 * em T-14 e a ordem nova chegar ao mesmo seletor; trocar o tipo de uma área e ler o aviso que o servidor
 * ajudou a escrever; guardar dois contatos, reordená-los, e salvar **só** a unidade sem que os contatos
 * sejam substituídos.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo é este arquivo — exigência da ADR-0012
 * ---------------------------------------------------------------------------
 *
 * **Ele não toca a semente de demonstração, e não podia tocar.** Este teste termina com **zero
 * categorias ativas**, que é o que o critério 4a.4 pede para conferir. Feito no Recanto Azul ou no
 * Aurora, isso desarmaria todos os outros arquivos do lote de uma vez: `mundo.ts` registra ocorrência
 * escolhendo *a primeira categoria*, e sem categoria ativa T-04 nem desenha formulário. Então **a conta e
 * a organização nascem aqui**, com a marca do instante no endereço e no nome.
 *
 * Por isso ele também **não importa `mundo.ts`**: aquele módulo é o dos localizadores da semente, e a
 * primeira coisa que ele faz é exigir `SENHA_DA_DEMONSTRACAO` no ambiente. É a mesma escolha de
 * `recuperacao-de-senha.spec.ts` e de `nascimento-de-organizacao.spec.ts`.
 *
 * **O que ele deixa para trás:** uma conta, uma organização com as sete categorias todas desativadas, e
 * uma pessoa sem conta com dois contatos, por corrida. `npm run semear:demo -- --apagar` não os remove —
 * eles não são da demonstração.
 *
 * **Uma janela só, porque é uma pessoa só.** Toda a Parte 3 é trabalho de Gestor, e o roteiro a começa
 * dizendo *"a organização do Passo 2, com você como Gestor"*.
 *
 * ---------------------------------------------------------------------------
 *  Dois testes, e o segundo nasce marcado
 * ---------------------------------------------------------------------------
 *
 * **O critério 4a.1 é o único desta jornada que o produto não cumpre**, e ele vive num `test.fixme`
 * próprio, com a razão escrita em cima dele. Pô-lo dentro da jornada faria um defeito de uma linha cegar
 * os outros oito critérios, que passam; apagá-lo esconderia o achado. O `fixme` não roda, então o teste
 * marcado **não custa segundo nenhum** enquanto o defeito existir, e volta a custar no dia em que alguém
 * o desmarcar.
 *
 * ---------------------------------------------------------------------------
 *  Três divergências entre o roteiro e o produto, declaradas aqui
 * ---------------------------------------------------------------------------
 *
 * **1 · A ajuda do E.164 não é uma frase; é o prefixo que o campo já traz.** O passo 10 manda ler
 * *"Vai ser guardado como +5511955217788"* antes de salvar. Essa frase **não existe no produto**, e não é
 * omissão de um canto: o campo de telefone **nasce com `+55 ` dentro** (`telefone.ts`, `PREFIXO_BR`), e é
 * essa a ajuda que a tela dá — ela mostra o formato em vez de descrevê-lo. O teste afirma o que o produto
 * faz, e o passo 10 continua alcançado pela outra metade: o número digitado como gente escreve chega ao
 * banco em E.164, e é o `GET /vinculos` desta mesma função que o prova.
 *
 * **2 · O botão NÃO fica indisponível com o contato repetido.** O passo 13 diz *"botão indisponível,
 * requisição não sai"*. O produto faz metade disso, por decisão escrita — *"o principal nunca fica
 * desabilitado por campo inválido"* (guia §7, e `modal.tsx`). Clicado com o repetido na lista, ele
 * acende o erro no campo e **não envia**. O que o critério quer é que a requisição não saia, e é isso que
 * este teste afirma: a página não muda de endereço e `GET /vinculos` continua com dois contatos.
 *
 * **3 · O rodapé do seletor de ícone diz *"Escolhido:"*, e não *"Ícone:"*.** O passo 8 escreve a segunda
 * forma. A frase do produto nomeia o rótulo do desenho.
 *
 * ---------------------------------------------------------------------------
 *  O que ele NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | A grade de ícones pelo teclado, com o anel de foco visível (A-4) | A asserção possível é que o foco chegou; o anel estar visível é olho humano, e está na lista do que continua sendo passada à mão |
 * | Arrastar pela alça, em T-09, T-14 e nos contatos | A alça só existe onde há ponteiro fino, e o que ela faz as setas fazem — que é a razão de as setas existirem (item 44j) |
 * | As outras seis sementes ficarem idênticas **pixel a pixel** depois da troca de ícone | O que se afirma é o desenho de cada uma, pela classe que o `lucide` escreve no `svg`, e o nome ao lado dele |
 * | A faixa do 5.2 na forma longa | Ela precisa de ocorrência já registrada na área, e este arquivo não registra nenhuma: a organização nasce e termina vazia |
 * | O recorte de celular das duas listas | O Playwright roda em 1280 px por decisão do `playwright.config.ts`, e a segunda linha da célula do nome é do M-3 |
 * | Reativar | O caminho de volta tem teste de unidade, e o que esta jornada cobra é o estado em que a desativação deixa as outras telas |
 */

/** A marca do instante — é ela que torna a conta e a organização próprias desta corrida. */
const MARCA = new Date().toISOString().replace(/[:.]/gu, "-").toLowerCase();

/** A senha da conta. **Não é a da demonstração**: nenhuma conta daqui é de lá. */
const SENHA = "ResolveAi!2026";

const NOME_DA_GESTORA = "Gestora da Configuração";

const ENCARREGADO = `Encarregado ${MARCA}`;

/** O telefone do passo 10, como gente escreve e como o banco guarda. */
const TELEFONE_DIGITADO = "(11) 95521-7788";
const TELEFONE_EM_E164 = "+5511955217788";
/** O mesmo número noutro formato — o repetido do passo 13. */
const TELEFONE_REPETIDO = "11955217788";
const EMAIL_DO_ENCARREGADO = `encarregado.${MARCA}@example.com`;

/**
 * As sete da semente (`CATEGORIAS_SEMENTE`), na ordem em que nascem, **com o desenho de cada uma**.
 *
 * **O nome do ícone é o handle possível, e não há outro.** O desenho nasce `aria-hidden` de propósito
 * (compromisso A-5: o ícone acompanha a palavra, nunca a substitui), então ele não tem nome acessível
 * para um localizador semântico alcançar. O `lucide` escreve `lucide-{nome}` na classe do `svg`, e é por
 * ali que se pergunta qual desenho está naquela linha.
 */
const SEMENTES = [
  { nome: "Problemas de iluminação", icone: "lightbulb" },
  { nome: "Equipamentos quebrados", icone: "unplug" },
  { nome: "Falta de acessibilidade", icone: "accessibility" },
  { nome: "Problemas de limpeza", icone: "trash-2" },
  { nome: "Vazamentos", icone: "droplets" },
  { nome: "Problemas de segurança", icone: "shield" },
  { nome: "Solicitações de manutenção", icone: "wrench" },
] as const;

/** As duas áreas da semente (`AREAS_SEMENTE`), na ordem em que nascem. */
const AREA_COMUM = "Área comum";
const UNIDADE = "Unidade";

/**
 * A conta e a organização deste teste, do zero — T-11 e a `/organizacao/criar` que o item 44o separou da
 * face A de T-02.
 *
 * **O sufixo separa os dois testes do arquivo:** eles rodam em contextos diferentes, e duas contas com o
 * mesmo endereço fariam o segundo esbarrar no *"Já existe uma conta com este e-mail"* do primeiro.
 *
 * Criar leva direto a T-03, e a organização nasce com as sete categorias e as duas áreas da POL-01 — o
 * mundo inteiro de que esta jornada precisa.
 */
async function organizacaoPropria(pagina: Page, sufixo: string): Promise<string> {
  const organizacao = `Configuração ${sufixo} ${MARCA}`;

  await pagina.goto("/criar-conta");
  await pagina.getByLabel("Seu nome").fill(NOME_DA_GESTORA);
  await pagina.getByLabel("E-mail").fill(`configuracao.${sufixo}.${MARCA}@example.com`);
  // **Ancorada, e não por trecho** — "Senha" por trecho casa também com o "Mostrar a senha" do botão que
  // vive dentro do campo (item 44m), e o `fill` quebraria por modo estrito.
  await pagina.getByLabel(/^Senha/u).fill(SENHA);
  await pagina.getByRole("button", { name: "Criar conta" }).click();
  await pagina.waitForURL(/\/organizacao$/u);

  await pagina.getByRole("link", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/organizacao\/criar$/u);
  await pagina.getByLabel("Nome da organização").fill(organizacao);
  await pagina.getByRole("button", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/ocorrencias$/u);

  await expect(pagina.getByRole("combobox", { name: /organização/iu })).toHaveText(organizacao);
  return organizacao;
}

/** A linha de um item nas tabelas de T-09, T-14 e T-08 — o escopo de toda ação de linha. */
function linhaDe(pagina: Page, nome: string): Locator {
  return pagina.getByRole("row").filter({ hasText: nome });
}

/**
 * A linha que está **naquela posição**, contada a partir do cabeçalho.
 *
 * `nth(0)` é a linha de rótulos; a primeira da lista é `nth(1)`, e o número da coluna *Ordem* é o mesmo
 * índice. A vaga tracejada que o arrasto desenha também é uma `<tr>`, mas só existe **durante** o
 * arrasto, e aqui ninguém arrasta.
 */
function naPosicao(pagina: Page, posicao: number): Locator {
  return pagina.getByRole("row").nth(posicao);
}

/**
 * Desativa um item de T-09 ou de T-14, pela confirmação própria do critério 7.
 *
 * **O rótulo do botão da confirmação é parâmetro porque ele MUDA na última ativa** — *"Desativar mesmo
 * assim"* —, e é metade do que o critério 4a.4 cobra. `exact` porque *"Desativar"* é prefixo do outro.
 */
async function desativar(
  pagina: Page,
  nome: string,
  opcoes: { readonly ultima?: boolean; readonly conferir?: (confirmacao: Locator) => Promise<void> } = {},
): Promise<void> {
  await linhaDe(pagina, nome).getByRole("button", { name: "Desativar", exact: true }).click();

  const confirmacao = pagina.getByRole("alertdialog");
  await expect(confirmacao.getByRole("heading", { name: `Desativar ${nome}?` })).toBeVisible();
  await opcoes.conferir?.(confirmacao);

  const rotulo = opcoes.ultima === true ? "Desativar mesmo assim" : "Desativar";
  await confirmacao.getByRole("button", { name: rotulo, exact: true }).click();

  await expect(pagina.getByRole("alertdialog")).toHaveCount(0);
  // A linha continua, e a ação dela virou a de volta — é a metade de *"não apaga"* que se vê aqui.
  await expect(linhaDe(pagina, nome).getByRole("button", { name: "Reativar" })).toBeVisible();
}

/**
 * Sobe uma linha uma posição, **e espera a gravação**.
 *
 * **A espera pela resposta não é zelo, é a asserção.** A lista é otimista: ela já se reordenou na tela
 * antes de o `PUT` do item 50 sair. Sem esperar, um `reload` logo em seguida poderia chegar ao servidor
 * antes da gravação, e o vermelho falaria de corrida em vez de falar do produto.
 */
async function subirUmaPosicao(pagina: Page, nome: string, endpointDaOrdem: string): Promise<void> {
  const gravou = pagina.waitForResponse(
    (resposta) =>
      resposta.url().includes(endpointDaOrdem) && resposta.request().method() === "PUT" && resposta.ok(),
  );
  await linhaDe(pagina, nome).getByRole("button", { name: "Subir uma posição" }).click();
  await gravou;
}

/**
 * Escolhe uma célula da grade de 25 ícones, **pela etiqueta, que é o que uma pessoa toca**.
 *
 * **O rádio é `sr-only` de propósito**, e não `display:none`: o segundo o tiraria da ordem de foco, e o
 * compromisso A-2 é ordem de foco igual à de leitura. A consequência para quem automatiza é que o
 * `<label>` de 44 px cobre o controle inteiro — um clique no rádio esbarra nela. Clicar a etiqueta é o
 * caminho da pessoa, e o `toBeChecked` de depois é o que prova que o `htmlFor` ligou os dois (A-1).
 */
async function escolherIcone(modal: Locator, rotulo: string): Promise<void> {
  const opcao = modal.getByRole("radio", { name: rotulo });
  const id = await opcao.getAttribute("id");
  expect(id).not.toBeNull();
  await modal.locator(`label[for="${id ?? ""}"]`).click();
  await expect(opcao).toBeChecked();
}

/** Os contatos de uma pessoa, lidos pela rede — `GET /vinculos`, que é o único lugar onde eles saem. */
async function contatosDe(
  pagina: Page,
  nome: string,
): Promise<ReadonlyArray<{ id: string; valor: string; tipo: string }>> {
  const resposta = await pagina.request.get("/api/vinculos");
  expect(resposta.ok()).toBe(true);
  const corpo = (await resposta.json()) as {
    itens: ReadonlyArray<{
      pessoa: { nome: string; contatos: ReadonlyArray<{ id: string; valor: string; tipo: string }> };
    }>;
  };
  const achado = corpo.itens.find((item) => item.pessoa.nome === nome);
  expect(achado, `«${nome}» não está em GET /vinculos`).toBeDefined();
  return achado?.pessoa.contatos ?? [];
}

test("a configuração da organização: nome repetido, desativar até a última, ordem, tipo, ícone e os contatos do vínculo", async ({
  page,
}) => {
  // -------------------------------------------------------------------------
  // 0 · A conta e a organização próprias
  // -------------------------------------------------------------------------
  await organizacaoPropria(page, "jornada");
  // -------------------------------------------------------------------------
  // 0b · As regras do atendimento, e a mudança que fica — critérios 99.6 e 99.8
  //
  // **Antes de tudo que mexe nas listas**, porque a trilha começa vazia numa organização recém-fundada,
  // e é essa frase que o cartão precisa mostrar no primeiro passo.
  // -------------------------------------------------------------------------
  await page.goto("/configuracao");
  await expect(page.getByText("Nenhuma regra foi alterada desde a criação da organização.")).toBeVisible();

  await page
    .getByRole("region", { name: "Regras do atendimento" })
    .getByRole("button", { name: "Editar" })
    .click();
  const modalDasRegras = page.getByRole("dialog");
  await modalDasRegras.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDasRegras.getByText("Altere uma regra antes de salvar.")).toBeVisible();

  await modalDasRegras.getByRole("switch", { name: "Exigir a solução ao resolver" }).click();
  await modalDasRegras.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDasRegras).toBeHidden();
  await expect(page.getByText("Exigir a solução ao resolver: de Não para Sim")).toBeVisible();

  // **O mesmo `PATCH` direto ao servidor, com o mesmo valor: `200` e nenhuma linha a mais.** É o
  // critério 99.6 pelo lado que a tela não alcança — gravar o que já está lá não é mudança.
  const repetido = await page.request.patch("/api/configuracao", {
    data: { exigirSolucaoAoResolver: true },
  });
  expect(repetido.status()).toBe(200);
  await page.reload();
  await expect(page.getByText("Exigir a solução ao resolver: de Não para Sim")).toHaveCount(1);

  // -------------------------------------------------------------------------
  // 0c · Os dias para parada — item 101, critérios 4 e 5
  //
  // **A tela recusa antes de enviar**, e é o cenário *"dias fora da faixa"*: 120 acende a frase no campo
  // e nada vai ao servidor. Com 15, o cartão passa a dizer *"15 dias"* e a trilha guarda a mudança com a
  // unidade nas duas pontas.
  // -------------------------------------------------------------------------
  await page
    .getByRole("region", { name: "Regras do atendimento" })
    .getByRole("button", { name: "Editar" })
    .click();
  const campoDosDias = modalDasRegras.getByLabel(
    "Dias sem atividade até a ocorrência contar como parada",
  );
  await expect(modalDasRegras.getByText("De 1 a 90. Pausadas não contam.")).toBeVisible();

  await campoDosDias.fill("120");
  await modalDasRegras.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDasRegras.getByText("Use um número de 1 a 90.")).toBeVisible();
  await expect(modalDasRegras).toBeVisible();

  await campoDosDias.fill("15");
  await modalDasRegras.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDasRegras).toBeHidden();
  await expect(page.getByText("15 dias", { exact: true })).toBeVisible();
  await expect(page.getByText("Dias até contar como parada: de 7 dias para 15 dias")).toBeVisible();

  // Volta ao padrão: os passos seguintes contam com a organização recém-fundada.
  const diasDevolvidos = await page.request.patch("/api/configuracao", {
    data: { diasParaParada: 7 },
  });
  expect(diasDevolvidos.status()).toBe(200);
  await page.reload();

  // **Critério 99.8, medido:** a tela inteira cabe em 360 px, sem rolagem lateral.
  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload();
  expect(await transbordo(page)).toStrictEqual(SEM_TRANSBORDO);
  await page.setViewportSize({ width: 1280, height: 800 });

  // A regra volta ao padrão: os passos seguintes desta jornada contam com a organização recém-fundada.
  const devolvida = await page.request.patch("/api/configuracao", {
    data: { exigirSolucaoAoResolver: false },
  });
  expect(devolvida.status()).toBe(200);

  // -------------------------------------------------------------------------
  // 0c · O texto que quem abre lê — critérios 100.1, 100.2, 100.5 e 100.7
  // -------------------------------------------------------------------------
  await page.reload();
  const cartaoDosRotulos = page.getByRole("region", { name: "Como quem abre lê o status" });
  // **Sem customização, o cartão mostra o padrão** — o critério 2 pelo lado da tela.
  await expect(cartaoDosRotulos.getByText("Em execução")).toBeVisible();

  await cartaoDosRotulos.getByRole("button", { name: "Editar" }).click();
  const modalDosRotulos = page.getByRole("dialog");

  // **Os seis pontos do ciclo estão na tela** — critério 1, e é a metade que o teste de unidade não
  // alcança: a lista pode estar certa e o modal desenhar cinco campos.
  await expect(modalDosRotulos.getByRole("textbox")).toHaveCount(6);

  await modalDosRotulos.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDosRotulos.getByText("Altere um texto antes de salvar.")).toBeVisible();

  await modalDosRotulos.getByLabel("Em análise").fill("o síndico está avaliando");
  await modalDosRotulos.getByRole("button", { name: "Salvar" }).click();
  await expect(modalDosRotulos).toBeHidden();
  await expect(
    page.getByText("Texto de Em análise: do padrão para “o síndico está avaliando”"),
  ).toBeVisible();

  // **O teto cabe no celular** — critério 5. A medida é com o teto de fato: quarenta caracteres LARGOS,
  // porque é o pior caso do cartão, e um texto curto mediria a tela e não o teto.
  const QUARENTA_LARGOS = "W".repeat(40);
  await cartaoDosRotulos.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Em atendimento").fill(QUARENTA_LARGOS);
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.setViewportSize({ width: 360, height: 740 });
  await page.reload();
  await expect(cartaoDosRotulos.getByText(QUARENTA_LARGOS)).toBeVisible();
  expect(await transbordo(page)).toStrictEqual(SEM_TRANSBORDO);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();

  // Os dois voltam ao padrão, e a volta **também deixa linha** — o critério 7. O de quarenta largos
  // porque a jornada segue, e o de Em análise porque é a linha de trilha que o caso afirma.
  await cartaoDosRotulos.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Em atendimento").fill("");
  await page.getByRole("dialog").getByLabel("Em análise").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("Texto de Em análise: de “o síndico está avaliando” para o padrão"),
  ).toBeVisible();


  // -------------------------------------------------------------------------
  // 1 · O nome repetido é recusado, e nada é criado — metade do critério 4a.1
  //
  // **A outra metade — *"no campo, não em faixa"* — é o `test.fixme` do fim do arquivo.** Aqui se afirma
  // só o que o produto cumpre: a mensagem aparece dentro do modal e a lista continua com sete. Onde ela
  // aparece é o defeito, e ele tem teste próprio para não cegar o resto desta jornada.
  // -------------------------------------------------------------------------
  await page.goto("/configuracao/categorias");
  await expect(page.getByText("Sete foram criadas junto com a organização.")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(SEMENTES.length + 1);

  await page.getByRole("button", { name: "Criar categoria" }).click();
  const modalDeCriar = page.getByRole("dialog");
  await expect(modalDeCriar.getByRole("heading", { name: "Criar categoria" })).toBeVisible();

  // Quem não toca na grade nasce com a etiqueta neutra, e o rodapé do seletor diz qual é — ver a
  // divergência 3 do cabeçalho.
  await expect(modalDeCriar.getByText(/^Escolhido:/u)).toContainText("Etiqueta");
  cobre(test.info(), "3 · 8", {
    falta:
      "a categoria criada de fato — o teste lê o rodapé e cancela, e nenhuma categoria nova nasce para conferir a etiqueta neutra na lista",
  });

  await modalDeCriar.getByLabel("Nome").fill(SEMENTES[4].nome);
  await modalDeCriar.getByRole("button", { name: "Criar categoria" }).click();
  await expect(modalDeCriar.getByText("Já existe uma categoria com este nome.")).toBeVisible();
  // O modal não fecha com a recusa: a pessoa corrige onde estava.
  await expect(modalDeCriar.getByRole("heading", { name: "Criar categoria" })).toBeVisible();

  await modalDeCriar.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // **A recusa recusou mesmo:** continuam sendo sete, e não oito.
  await expect(page.getByRole("row")).toHaveCount(SEMENTES.length + 1);
  cobre(test.info(), "3 · 1", {
    falta:
      "«no campo, não em faixa» — aqui só a frase e a lista intacta; a forma é o defeito de produto do `test.fixme` do fim do arquivo",
  });

  // -------------------------------------------------------------------------
  // 2 · A desativada fica na lista e some do seletor de T-04 — critério 4a.2
  //
  // **A explicação de que desativar não apaga é conferida onde a pessoa decide**, e não no corpo da tela:
  // foi para lá que o item 44k a mudou, e é a diferença entre avisar e avisar a tempo.
  // -------------------------------------------------------------------------
  const desativada = SEMENTES[3].nome;
  await desativar(page, desativada, {
    conferir: async (confirmacao) => {
      await expect(confirmacao).toContainText(
        "Ela deixa de aparecer no formulário de registro. As ocorrências já registradas continuam com esta categoria, e você pode reativá-la quando quiser.",
      );
      // Não é a última ativa: a frase do bloqueio não aparece, e o botão não muda de nome.
      await expect(
        confirmacao.getByText("Sem nenhuma categoria ativa, ninguém consegue registrar ocorrência."),
      ).toHaveCount(0);
    },
  });
  await expect(linhaDe(page, desativada)).toContainText("Inativa");
  await expect(page.getByRole("row")).toHaveCount(SEMENTES.length + 1);

  // -------------------------------------------------------------------------
  // 3 · A ordem, nas duas listas — critérios 4a.5 e 5.4
  //
  // **A troca escolhida é entre duas ATIVAS**, e isso é escolha: subir uma linha para trocar de lugar com
  // a inativa mudaria T-09 sem mudar T-04, e a metade do critério que fala do seletor ficaria afirmada
  // por um movimento invisível do outro lado.
  // -------------------------------------------------------------------------
  const subiu = SEMENTES[5].nome;
  const desceu = SEMENTES[4].nome;
  await expect(naPosicao(page, 5)).toContainText(desceu);
  await expect(naPosicao(page, 6)).toContainText(subiu);

  await subirUmaPosicao(page, subiu, "/api/categorias/ordem");
  await expect(naPosicao(page, 5)).toContainText(subiu);
  await expect(naPosicao(page, 6)).toContainText(desceu);

  // Recarregar é o que separa *a tela se moveu* de *a ordem foi gravada*.
  await page.reload();
  await expect(naPosicao(page, 5)).toContainText(subiu);
  await expect(naPosicao(page, 6)).toContainText(desceu);

  await page.goto("/configuracao/areas");
  await expect(page.getByRole("row")).toHaveCount(3);
  await expect(naPosicao(page, 1)).toContainText(AREA_COMUM);
  await expect(naPosicao(page, 2)).toContainText(UNIDADE);

  await subirUmaPosicao(page, UNIDADE, "/api/areas/ordem");
  await page.reload();
  await expect(naPosicao(page, 1)).toContainText(UNIDADE);
  await expect(naPosicao(page, 2)).toContainText(AREA_COMUM);

  // -------------------------------------------------------------------------
  // 4 · O outro lado das três mudanças: o seletor de T-04
  //
  // Uma visita só, porque as três metades que faltam moram na mesma tela — o 4a.2 (a desativada sumiu), o
  // 4a.5 (a ordem nova das categorias) e o 5.4 (a ordem nova das áreas).
  // -------------------------------------------------------------------------
  await page.goto("/ocorrencias/nova");

  await page.getByLabel("Categoria").click();
  const categoriasNoSeletor = page.getByRole("option");
  const esperadas = [
    SEMENTES[0].nome,
    SEMENTES[1].nome,
    SEMENTES[2].nome,
    subiu,
    desceu,
    SEMENTES[6].nome,
  ];
  await expect(categoriasNoSeletor).toHaveCount(esperadas.length);
  for (const [indice, nome] of esperadas.entries()) {
    await expect(categoriasNoSeletor.nth(indice)).toContainText(nome);
  }
  // A desativada não está em lugar nenhum da lista — a outra metade do 4a.2.
  await expect(page.getByRole("option", { name: desativada })).toHaveCount(0);
  cobre(test.info(), "3 · 3", { criterio: "4a.2" });

  // **A segunda visita é decisão, e custa um carregamento.** As duas listas de T-04 são peças
  // diferentes — a categoria é o `select` do catálogo, a área é o painel com busca do item 44l —, e a
  // primeira é modal: enquanto ela está aberta, o `radix-ui` desliga o ponteiro do resto do documento.
  // Fechar uma e abrir a outra no mesmo documento deixou o gatilho da área **com foco e sem painel** na
  // corrida de 22/09/2026. Um documento novo não tem nada aberto, e a asserção passa a falar da ordem em
  // vez de falar do fechamento.
  await page.goto("/ocorrencias/nova");
  await page.getByLabel("Área").click();
  const areasNoSeletor = page.getByRole("option");
  await expect(areasNoSeletor).toHaveCount(2);
  // **A asserção é pela ausência na primeira e pela presença na segunda**, e não pelo texto da primeira:
  // a palavra *Unidade* também é o rótulo do tipo da outra, e um localizador por trecho pegaria as duas.
  await expect(areasNoSeletor.nth(0)).not.toContainText(AREA_COMUM);
  await expect(areasNoSeletor.nth(1)).toContainText(AREA_COMUM);
  cobre(test.info(), "3 · 4", { criterio: "4a.5, 5.4" });
  cobre(test.info(), "2.2 · 5", { criterio: "2.3, 3.3" });

  // -------------------------------------------------------------------------
  // 5 · O tipo de uma área, e o aviso nos dois momentos — critério 5.2
  //
  // **Dois textos, e cada um no seu instante.** Dentro do modal, assim que o tipo escolhido difere do
  // atual, e sem número: ele fala do que vai acontecer. Depois de salvar, o aviso diz o que aconteceu —
  // e **com zero ocorrências ele é a forma curta**, que é a que este arquivo alcança, porque a
  // organização nasceu e continua sem nenhuma ocorrência registrada.
  // -------------------------------------------------------------------------
  await page.goto("/configuracao/areas");
  await linhaDe(page, AREA_COMUM).getByRole("button", { name: "Editar" }).click();

  const modalDaArea = page.getByRole("dialog");
  await expect(modalDaArea.getByRole("heading", { name: "Editar área" })).toBeVisible();
  // A opção que é o tipo de hoje se apresenta como tal, e por isso o rótulo não casa exato.
  await expect(modalDaArea.getByRole("radio", { name: /^Área comum/u })).toBeChecked();
  await expect(modalDaArea.getByText("Mudar o tipo vale de agora em diante")).toHaveCount(0);

  await modalDaArea.getByRole("radio", { name: /^Unidade privativa/u }).check();
  await expect(modalDaArea).toContainText(
    "Mudar o tipo vale de agora em diante — o passado não muda. As ocorrências já registradas mantêm o tipo que a área tinha quando foram criadas.",
  );

  await modalDaArea.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(`${AREA_COMUM} passou a ser Unidade privativa.`)).toBeVisible();
  await expect(linhaDe(page, AREA_COMUM)).toContainText("Unidade privativa");
  cobre(test.info(), "3 · 5", { criterio: "5.2" });

  // -------------------------------------------------------------------------
  // 6 · O ícone de uma categoria — critérios 4b.3 e 4b.4
  //
  // **Só a linha dela muda.** As outras seis sementes são conferidas uma a uma, pelo desenho e pelo nome
  // ao lado dele: é o 4b.4 na forma que ele pede — *ao lado do nome, nunca no lugar dele*.
  //
  // **O desenho novo não está em nenhuma semente**, e isso é escolha: trocar `droplets` por `wrench`
  // faria a asserção passar também num dia em que a troca não tivesse acontecido e o localizador
  // estivesse pegando a linha errada.
  // -------------------------------------------------------------------------
  await page.goto("/configuracao/categorias");
  const comIconeNovo = SEMENTES[4].nome;

  await linhaDe(page, comIconeNovo).getByRole("button", { name: "Editar" }).click();
  const modalDaCategoria = page.getByRole("dialog");
  await expect(modalDaCategoria.getByRole("heading", { name: "Editar categoria" })).toBeVisible();
  await expect(modalDaCategoria.getByText(/^Escolhido:/u)).toContainText("Gotas");

  await escolherIcone(modalDaCategoria, "Chama");
  await expect(modalDaCategoria.getByText(/^Escolhido:/u)).toContainText("Chama");
  await modalDaCategoria.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await expect(linhaDe(page, comIconeNovo).locator("svg.lucide-flame")).toHaveCount(1);
  for (const semente of SEMENTES) {
    if (semente.nome === comIconeNovo) continue;
    const linha = linhaDe(page, semente.nome);
    await expect(linha.locator(`svg.lucide-${semente.icone}`)).toHaveCount(1);
    await expect(linha).toContainText(semente.nome);
  }
  cobre(test.info(), "3 · 6", { criterio: "4b.3" });
  cobre(test.info(), "3 · 7", {
    falta:
      "«à esquerda do nome» — a asserção prova o desenho na linha e o nome escrito ao lado, e não a posição relativa dos dois",
  });

  // -------------------------------------------------------------------------
  // 7 · Os contatos do vínculo — item 9b
  //
  // **O telefone é digitado como gente escreve**, e o campo já vem com o país dentro: é a ajuda do E.164
  // que o produto dá, e a divergência 1 do cabeçalho explica por que não é uma frase.
  // -------------------------------------------------------------------------
  await page.goto("/vinculos/nova");
  await page.getByLabel("Nome").fill(ENCARREGADO);
  await page.getByRole("radio", { name: /^Encarregado/u }).check();

  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await expect(page.getByLabel("Número ou e-mail do contato 1")).toHaveValue("+55 ");
  await page.getByLabel("Número ou e-mail do contato 1").fill(TELEFONE_DIGITADO);
  await page.getByRole("switch", { name: "WhatsApp do contato 1" }).click();
  await expect(page.getByRole("switch", { name: "WhatsApp do contato 1" })).toBeChecked();

  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await page
    .getByRole("radiogroup", { name: "Tipo do contato 2" })
    .getByRole("radio", { name: "E-mail" })
    .click();
  await page.getByLabel("Número ou e-mail do contato 2").fill(EMAIL_DO_ENCARREGADO);

  await page.getByRole("button", { name: "Cadastrar" }).click();
  await page.waitForURL(/\/vinculos$/u);
  await expect(linhaDe(page, ENCARREGADO)).toContainText("Encarregado");

  // **O digitado virou E.164 do lado de dentro** — a metade do passo 10 que sobrevive à divergência 1.
  const recemCadastrados = await contatosDe(page, ENCARREGADO);
  expect(recemCadastrados.map((contato) => contato.valor)).toEqual([
    TELEFONE_EM_E164,
    EMAIL_DO_ENCARREGADO,
  ]);
  cobre(test.info(), "3 · 10", { criterio: "9b M-1" });

  // -------------------------------------------------------------------------
  // 8 · A ordem dos contatos é a cadeia de tentativa — passo 11
  //
  // Descer o contato 1 é alteração de verdade, e não de enfeite: a posição **é** o significado, e o
  // `PATCH` manda a lista inteira porque ela mudou.
  // -------------------------------------------------------------------------
  const abrirEdicao = async () => {
    await linhaDe(page, ENCARREGADO).getByRole("link", { name: "Editar participante" }).click();
    await page.waitForURL(/\/vinculos\/[0-9a-f-]+\/editar$/u);
  };

  await abrirEdicao();
  await page.getByRole("button", { name: "Descer o contato 1" }).click();
  await expect(page.getByLabel("Número ou e-mail do contato 1")).toHaveValue(EMAIL_DO_ENCARREGADO);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL(/\/vinculos$/u);

  const depoisDaTroca = await contatosDe(page, ENCARREGADO);
  expect(depoisDaTroca.map((contato) => contato.valor)).toEqual([
    EMAIL_DO_ENCARREGADO,
    TELEFONE_EM_E164,
  ]);
  cobre(test.info(), "3 · 11");

  // -------------------------------------------------------------------------
  // 9 · Salvar SÓ a unidade não substitui os contatos — passo 12
  //
  // **É o caso que o item 9b mais arrisca quebrar**, e é o único do lote conferido pela rede: os `id` dos
  // contatos são invisíveis na tela, e um formulário que mandasse a lista sem ela ter mudado trocaria
  // todos eles sem que nada na tela mudasse de aparência.
  // -------------------------------------------------------------------------
  const idsAntes = depoisDaTroca.map((contato) => contato.id);
  expect(idsAntes).toHaveLength(2);

  await abrirEdicao();
  await page.getByLabel("Unidade").click();
  await page.getByRole("option", { name: AREA_COMUM, exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL(/\/vinculos$/u);
  await expect(linhaDe(page, ENCARREGADO)).toContainText(AREA_COMUM);
  cobre(test.info(), "2.6 · 5", { criterio: "9a.3" });

  const depoisDaUnidade = await contatosDe(page, ENCARREGADO);
  expect(depoisDaUnidade.map((contato) => contato.id)).toEqual(idsAntes);
  cobre(test.info(), "3 · 12");

  // -------------------------------------------------------------------------
  // 10 · O mesmo número noutro formato é recusado — passo 13
  //
  // A comparação acontece sobre o valor **normalizado**, e não sobre o digitado: é o que faz
  // `11955217788` e `(11) 95521-7788` serem o mesmo contato, como são para o `UNIQUE` da tabela.
  //
  // Ver a divergência 2 do cabeçalho: o botão continua clicável, e o que o critério cobra é que a
  // requisição não saia.
  // -------------------------------------------------------------------------
  await abrirEdicao();
  const enderecoDaEdicao = page.url();

  await page.getByRole("button", { name: "Adicionar contato" }).click();
  await page.getByLabel("Número ou e-mail do contato 3").fill(TELEFONE_REPETIDO);
  await expect(page.getByText("Este contato já está na lista.")).toBeVisible();

  await page.getByRole("button", { name: "Salvar" }).click();
  // Não navegou, e nada foi gravado: continuam sendo dois contatos, com os mesmos `id`.
  expect(page.url()).toBe(enderecoDaEdicao);
  await expect(page.getByText("Este contato já está na lista.")).toBeVisible();
  const depoisDaRecusa = await contatosDe(page, ENCARREGADO);
  expect(depoisDaRecusa.map((contato) => contato.id)).toEqual(idsAntes);
  cobre(test.info(), "3 · 13", {
    falta:
      "«no campo» e o foco que vai até o erro — o teste afirma a frase, o endereço que não muda e os dois contatos intactos",
  });

  // -------------------------------------------------------------------------
  // 11 · A última ativa, nos dois lugares — critério 4a.4
  //
  // **Este bloco fica por último de propósito.** Ele termina com zero categorias ativas, e daí em diante
  // T-04 não desenha formulário: qualquer coisa que dependa de registrar teria de vir antes.
  //
  // São **dois lugares**, e a frase é a mesma nos dois: dentro da confirmação, antes do clique, e em
  // faixa acima da lista, depois dele. O terceiro lugar é a própria T-04, que troca o formulário pelo
  // bloqueio com o caminho de volta.
  // -------------------------------------------------------------------------
  await page.goto("/configuracao/categorias");

  // Até sobrarem duas ativas. A desativada do passo 2 já não conta.
  for (const semente of [SEMENTES[0], SEMENTES[1], SEMENTES[2], SEMENTES[6]]) {
    await desativar(page, semente.nome);
  }

  const fraseDoBloqueio = "Sem nenhuma categoria ativa, ninguém consegue registrar ocorrência.";

  // A penúltima ativa: confirmação simples, sem a frase e sem o botão de insistir.
  await desativar(page, subiu, {
    conferir: async (confirmacao) => {
      await expect(confirmacao.getByText(fraseDoBloqueio)).toHaveCount(0);
      await expect(confirmacao.getByRole("button", { name: "Desativar mesmo assim" })).toHaveCount(0);
    },
  });
  await expect(page.getByText(fraseDoBloqueio)).toHaveCount(0);

  // A última ativa: a frase e o botão que insiste.
  await desativar(page, desceu, {
    ultima: true,
    conferir: async (confirmacao) => {
      await expect(confirmacao.getByText(fraseDoBloqueio)).toBeVisible();
      await expect(confirmacao.getByRole("button", { name: "Desativar", exact: true })).toHaveCount(0);
    },
  });

  // O segundo lugar: a faixa acima da lista, que fica.
  await expect(page.getByText(fraseDoBloqueio)).toBeVisible();
  cobre(test.info(), "3 · 2", { criterio: "4a.4" });
  // E as sete continuam lá, todas marcadas — desativar nunca apagou nada (4a.2).
  await expect(page.getByRole("row")).toHaveCount(SEMENTES.length + 1);

  // T-04 troca o formulário pelo bloqueio, com o caminho de volta para quem pode percorrê-lo.
  await page.goto("/ocorrencias/nova");
  // **O título do vazio não é `heading`, e por isso o localizador é o texto.** O `Empty` do catálogo
  // desenha `EmptyTitle` como `div`: a página já tem o seu `h1` — *Registrar ocorrência* —, e um segundo
  // nível de título aqui competiria com ele em vez de descrever a região.
  await expect(page.getByText("Esta organização não tem categorias ativas.")).toBeVisible();
  // **O botão e a segunda frase andam juntos**, e é a regra que o item 44h passou tirando becos do
  // produto: quem pode configurar lê o caminho, e não só a má notícia.
  await expect(
    page.getByText(
      "Sem categoria, ninguém consegue dizer que tipo de problema aconteceu. Reative ao menos uma para voltar a receber ocorrências.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para Categorias" })).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveCount(0);
});

/**
 * ============================================================================
 *  DEFEITO DE PRODUTO · A recusa do nome repetido sai em faixa, e não no campo
 * ============================================================================
 *
 * **O achado, medido em 22/09/2026 ao escrever este arquivo.** O critério **4a.1** pede
 * *"«Já existe uma categoria com este nome.» **no campo**, não em faixa"*. O produto mostra a frase
 * **em faixa dentro do modal**, e o campo continua sem `aria-invalid` e sem apontar para ela.
 *
 * **A causa é rastreável, e não é a tela.** `ModalDeCategoria` diz em voz alta que o quer no campo —
 * *"o erro do servidor no campo `nome` vai para baixo do campo, e nesse caso a caixa do modal não
 * aparece"* —, e entrega esse trabalho a `errosDoNomeNoCorpo` (`regras-do-nome.ts`). Aquela função lê
 * **só** o `erros[]` do corpo, que é a extensão do `400 FORMATO_INVALIDO` (`problema.ts`). O nome
 * repetido não é `400`: é **`409 CATEGORIA_NOME_DUPLICADO`** (`aplicacao/organizacao/erros.ts`), e o
 * `409` não carrega `erros[]`. Então `errosDoServidor.nome` fica indefinido, e a única saída que sobra é
 * o `ErroDoFormulario` do fim do modal — a faixa que o critério recusa por nome. O mesmo vale para
 * `AREA_NOME_DUPLICADO` em T-14.
 *
 * **Por que nasce marcado, e não consertado.** Consertar é mudar código de produção — `errosDoNomeNoCorpo`
 * ou a resposta do `409` —, e a regra deste lote é que teste não muda comportamento de produção. É item
 * de backlog, e o teste abaixo é a prova executável que ele fecha.
 *
 * **Por que não é erro de escrita.** O localizador é o mesmo `getByLabel("Nome")` que preenche o campo
 * duas linhas antes e funciona; o que falta é o atributo. A corrida de 22/09/2026 registrou o campo
 * renderizado com `aria-required="true"` e **sem** `aria-invalid`, com o valor `Vazamentos` dentro.
 *
 * **Ele custa zero enquanto estiver marcado:** `test.fixme` não executa, e a conta e a organização deste
 * teste só nascem no dia em que alguém o desmarcar.
 */
test.fixme(
  "a recusa do nome repetido aparece no campo, e não em faixa — critério 4a.1",
  cobertura([{ roteiro: "3 · 1", criterio: "4a.1" }]),
  async ({ page }) => {
    await organizacaoPropria(page, "recusa");

    await page.goto("/configuracao/categorias");
    await page.getByRole("button", { name: "Criar categoria" }).click();

    const modal = page.getByRole("dialog");
    await modal.getByLabel("Nome").fill(SEMENTES[4].nome);
    await modal.getByRole("button", { name: "Criar categoria" }).click();

    // **"No campo" tem prova de forma, e não só de texto.** O campo fica `aria-invalid` e aponta para a
    // mensagem pelo `aria-describedby`: é a mesma ligação que um leitor de tela percorre.
    const campo = modal.getByLabel("Nome");
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    const idDaMensagem = await campo.getAttribute("aria-describedby");
    expect(idDaMensagem).not.toBeNull();
    await expect(modal.locator(`[id="${idDaMensagem ?? ""}"]`)).toHaveText(
      "Já existe uma categoria com este nome.",
    );

    // **"Não em faixa"** é afirmado pela ausência de `role="alert"` dentro do modal: `ErroDoFormulario` é
    // a única peça destas telas que o carrega, e o modal a suprime quando o servidor diz qual campo errou.
    await expect(modal.getByRole("alert")).toHaveCount(0);
  },
);
