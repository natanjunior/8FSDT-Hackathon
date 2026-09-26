import { expect, type Locator, type Page } from "@playwright/test";

/**
 * ============================================================================
 *  O mundo de teste da semente — os localizadores num módulo só
 * ============================================================================
 *
 * **A ADR-0012 pede exatamente isto.** Ela deixa o teste de ponta a ponta crescer por jornada, com teto
 * de seis arquivos, e cobra em troca que *"os localizadores compartilhados morem num módulo só"* — para
 * que uma troca de rótulo custe **uma** edição, e não seis. Este é o módulo.
 *
 * **Ele não é um arquivo de teste, e a extensão diz isso.** O `playwright.config.ts` roda
 * `*.spec.ts`; os projetos do Vitest incluem `*.test.ts`. `mundo.ts` não casa com nenhum dos dois.
 *
 * ---------------------------------------------------------------------------
 *  Quem é dono deste mundo
 * ---------------------------------------------------------------------------
 *
 * **Ninguém daqui.** O mundo é o gêmeo de teste da semente, aplicado à mão antes da corrida:
 *
 *     SENHA_DA_DEMONSTRACAO=… npm run semear:demo -- --teste
 *
 * É o mesmo plano da demonstração, com outras organizações e outras contas. As corridas escreviam na
 * demonstração, e o painel dela passava a medir o robô (item 63).
 *
 * Quem importa este módulo herda a regra da `arquitetura.md` §7.2 — **um teste acrescenta ao mundo;
 * nunca o altera**, agora sobre o gêmeo. Acrescentar é registrar ocorrência nova, com a marca do instante no título.
 * Alterar seria trocar a senha de Helena, desativar uma categoria do Recanto ou remover um vínculo: cada
 * uma dessas desarma os outros arquivos do lote. Quem precisa alterar **cria o próprio mundo**, e é o que
 * `recuperacao-de-senha.spec.ts` faz.
 *
 * ---------------------------------------------------------------------------
 *  O que ainda NÃO passa por aqui, e está declarado
 * ---------------------------------------------------------------------------
 *
 * `caminho-critico.spec.ts` é anterior a este módulo e mantém as próprias cópias de `entrar`,
 * `trocarDeOrganizacao` e `esperarSituacao`. Enquanto ele não migrar, uma troca de rótulo de T-01 ou do
 * seletor de organização custa **duas** edições, e não uma. A migração é mecânica e não pertence à
 * escrita de um teste novo — ela muda um arquivo que já está verde.
 */

/**
 * **Falha na carga do módulo, com o comando exato.** Sem isto, a senha ausente apareceria como
 * *"E-mail ou senha incorretos."* na tela de login — indistinguível de defeito de produto.
 */
const SENHA_DO_AMBIENTE = process.env["SENHA_DA_DEMONSTRACAO"];
if (SENHA_DO_AMBIENTE === undefined || SENHA_DO_AMBIENTE === "") {
  throw new Error(
    "SENHA_DA_DEMONSTRACAO não está no ambiente. Rode:\n" +
      "  SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run semear:demo -- --teste\n" +
      "  SENHA_DA_DEMONSTRACAO=ResolveAi!2026 npm run teste:ponta-a-ponta\n" +
      "É a mesma senha com que a semente criou as contas do mundo de teste (README, «A demonstração»).",
  );
}

export const SENHA: string = SENHA_DO_AMBIENTE;

/** As duas contas que a semente cria no perfil de teste. Helena tem dois vínculos; Marcos, um. */
export const HELENA = "helena.teste@example.com";
export const MARCOS = "marcos.teste@example.com";

export const NOME_DE_HELENA = "Helena Rocha";
export const NOME_DE_MARCOS = "Marcos Vieira";

export const AURORA = "Edifício Aurora (teste)";
export const RECANTO = "Condomínio Recanto Azul (teste)";

/** A Encarregada sem conta do Aurora (`semente/plano.ts`). */
export const ENCARREGADA_DO_AURORA = "Sônia Prado";

/**
 * O Solicitante sem conta do Aurora (`semente/plano.ts`), com a unidade *Sala 405*.
 *
 * **Ele existe aqui porque o modal de atribuição reparte em dois blocos**, e provar a repartição exige
 * alguém do bloco de baixo que **não** seja quem está olhando nem quem registrou. Helena serve para o
 * bloco; ele serve para a escolha, porque atribuir a ela mudaria o que o resto do lote lê.
 */
export const SOLICITANTE_DO_AURORA = "Diego Fontes";

/**
 * A marca do instante — é ela que separa a ocorrência de uma corrida da das outras e das do mundo de
 * teste. Toda asserção de lista encontra exatamente a linha dela.
 */
export function marcaDoInstante(): string {
  return new Date().toISOString().replace(/[:.]/gu, "-");
}

/**
 * T-01 · Entrar. **Autenticação real, sem porta falsa e sem variável que finja sessão** — critério
 * 41b.4, e é a razão de a ADR-0004 e a ADR-0008 recusarem a alternativa: a imagem publicada é pública.
 *
 * **O rótulo da senha é ancorado, e não por trecho nem exato** (item 44m). Por trecho, *"Senha"* casa
 * também com o *"Mostrar a senha"* do botão que o 44m pôs dentro do campo. Exato não casa com nada,
 * porque o rótulo é *"Senha *"* — o asterisco é um `span` com `aria-hidden` dentro do `label`, e o motor
 * do localizador não pula `aria-hidden`.
 */
export async function entrar(pagina: Page, email: string): Promise<void> {
  await pagina.goto("/entrar");
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.getByLabel(/^Senha/u).fill(SENHA);
  await pagina.getByRole("button", { name: "Entrar" }).click();
}

/**
 * O seletor de organização da barra superior da casca. **Ele era `dropdown-menu` e virou `select` no
 * item 44b**, então o papel do gatilho passou de `button` para `combobox` e o das opções de `menuitem`
 * para `option`. O nome acessível do gatilho é o `aria-label` *Organização*.
 *
 * **Depois da troca o destino é `/`**, que redespacha para T-03 — por isso a espera é pela URL da lista.
 */
export async function trocarDeOrganizacao(pagina: Page, destino: string): Promise<void> {
  await pagina.getByRole("combobox", { name: /organização/iu }).click();
  await pagina.getByRole("option", { name: destino }).click();
  await pagina.waitForURL(/\/ocorrencias$/u);
}

/**
 * O selo de T-05 — o estado atual, no cabeçalho (item 66).
 *
 * **Escopado pelo grupo *Situação*, que só contém o selo:** a mesma palavra aparece na régua do ciclo, nas
 * frases da linha do tempo e, em teste, pode aparecer no título. O grupo não alcança nenhum deles.
 *
 * **Localizado por atributo, e não por `getByRole`:** com um modal aberto, o `Dialog` do Radix marca
 * `aria-hidden` em tudo que fica fora dele, e o localizador por papel deixaria de achar o selo — que é
 * justamente o que três passos afirmam com o modal na tela.
 */
export function situacao(pagina: Page): Locator {
  return pagina.locator('[role="group"][aria-label="Situação"]');
}

export async function esperarSituacao(pagina: Page, rotulo: string): Promise<void> {
  await expect(situacao(pagina)).toContainText(rotulo);
}

/**
 * O bloco *O ciclo* de T-05 — a régua com a marca do que saiu da linha reta (critério 44d.7).
 *
 * **Irmão do bloco de situação, e nunca dentro dele**, por decisão da própria página: se a régua morasse
 * lá dentro, `toContainText("Aberta")` passaria em qualquer estado e a asserção de situação deixaria de
 * afirmar o que existe para afirmar.
 */
export function ciclo(pagina: Page): Locator {
  return pagina.locator("section").filter({ hasText: "O ciclo" }).first();
}

/**
 * T-04 · registrar uma ocorrência, **sem foto**.
 *
 * A foto é a prova do critério 51.10 e ela já tem dono — `caminho-critico.spec.ts` busca os bytes pela
 * rede. Repeti-la aqui pagaria a espera da subida por corrida para provar de novo o que já está provado.
 *
 * **Categoria e Área deixaram de ser seletores nativos no item 44l**, e o `selectOption` com elas. O
 * gatilho de cada uma é um botão nomeado pelo rótulo do campo — `getByLabel` o alcança, porque botão é
 * elemento rotulável e o `Campo` liga os dois por `htmlFor`. **Qual categoria e qual área não importa**,
 * e fixar um nome amarraria o teste ao conteúdo da semente.
 *
 * Devolve o identificador da ocorrência, lido da URL de T-05.
 */
export async function registrarOcorrencia(
  pagina: Page,
  titulo: string,
  descricao: string,
): Promise<string> {
  await pagina.getByRole("link", { name: "+ Registrar ocorrência" }).click();
  await pagina.waitForURL(/\/ocorrencias\/nova$/u);
  await pagina.getByLabel("Título").fill(titulo);
  await pagina.getByLabel("Descrição").fill(descricao);
  await pagina.getByLabel("Categoria").click();
  await pagina.getByRole("option").first().click();
  await pagina.getByLabel("Área").click();
  await pagina.getByRole("option").first().click();
  await pagina.getByRole("button", { name: "Registrar ocorrência" }).click();

  await pagina.waitForURL(
    /\/ocorrencias\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
  );
  const id = pagina.url().split("/").pop() ?? "";
  expect(id).not.toBe("");
  return id;
}

/**
 * Abre um comando que mora no menu *"Mais ações ▾"* da barra (item 23).
 *
 * **O gatilho lá dentro é `menuitem`, e não `button`** — `ModalDeMotivo` e `ModalDeAtribuicao` trocam a
 * forma do gatilho pela variante `"menu"`, para o diálogo poder viver dentro do menu sem ser desmontado
 * no clique.
 */
export async function abrirNoMenu(pagina: Page, rotulo: string): Promise<Locator> {
  await pagina.getByRole("button", { name: "Mais ações ▾" }).click();
  await pagina.getByRole("menuitem", { name: rotulo }).click();
  return pagina.getByRole("dialog");
}

/**
 * Fecha o menu que ficou aberto atrás do diálogo.
 *
 * **O menu abre com `modal` desligado e o item tem `onSelect` prevenido** — sem isso o diálogo montado
 * lá dentro morreria no instante em que o clique deveria abri-lo. O custo está declarado no próprio
 * componente: *"o menu fica aberto atrás do diálogo e continua aberto quando ele fecha"*. Uma tecla
 * resolve, e sem ela o menu cobre a barra na ação seguinte.
 */
export async function fecharOMenu(pagina: Page): Promise<void> {
  // **Esperar o diálogo sumir vem primeiro, e não é zelo:** ele não fecha durante o envio, e uma tecla
  // disparada nesse intervalo fecharia o diálogo em vez do menu — abandonando o comando pela metade.
  await expect(pagina.getByRole("dialog")).toHaveCount(0);

  const menu = pagina.getByRole("menu");
  if ((await menu.count()) === 0) return;
  await pagina.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
}
