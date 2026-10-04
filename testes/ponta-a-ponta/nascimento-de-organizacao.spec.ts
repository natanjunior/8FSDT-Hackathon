import { expect, test, type Locator, type Page } from "@playwright/test";

import { ID_DO_SCRIPT_DO_TEMA } from "@/interface/componentes/tema";
import {
  FRASE_ABRINDO,
  PREFIXO_DO_CACHE,
  URL_DA_CASCA,
  URL_DA_HORA,
} from "@/interface/trabalhador/constantes";

import { cobre } from "./cobertura";
import { SEM_TRANSBORDO, transbordo } from "./transbordo";

/**
 * ============================================================================
 *  O nascimento de uma organização, e a vida dos vínculos — Partes 2 e 6
 * ============================================================================
 *
 * **O quinto arquivo de ponta a ponta, e ele nasce pela ADR-0012**: o teste cresce por **jornada** do
 * roteiro de validação, com teto de seis arquivos. Esta é a jornada que vai do primeiro cadastro até a
 * remoção de um vínculo — Parte 2 (passos 1, 2, 4, 5 e 6) e Parte 6 inteira.
 *
 * **O que ele prova é a fiação, e não o vocabulário.** As palavras destas telas já têm teste de unidade
 * em `testes/interface/vinculo.test.ts` e em `testes/interface/configuracao.test.ts`. O que nenhum teste
 * alcançava é o percurso: criar conta, fundar organização, pedir entrada com o código, decidir o pedido,
 * cadastrar quem não tem conta, entrar numa segunda organização e remover um vínculo — sete comandos que
 * atravessam tela, rota, Aplicação e banco, e voltam para a janela do outro lado.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo é este arquivo — exigência da ADR-0012
 * ---------------------------------------------------------------------------
 *
 * **Ele não toca a semente de demonstração, e não podia tocar.** Toda ação daqui é escrita: aprovar,
 * recusar, cadastrar, remover. Feita no Recanto Azul ou no Aurora, cada uma delas desarmaria os outros
 * arquivos do lote — a lista de participantes que eles leem mudaria de tamanho, e um vínculo removido não
 * volta. Então **as três contas e as duas organizações nascem aqui**, com a marca do instante no endereço
 * e no nome: cada execução acrescenta um mundo novo e **nenhuma execução altera o que já existia**.
 *
 * Por isso ele também **não importa `mundo.ts`**: aquele módulo é o dos localizadores da semente, e a
 * primeira coisa que ele faz é exigir `SENHA_DA_DEMONSTRACAO` no ambiente. Este arquivo escolhe a própria
 * senha e roda sem a semente aplicada. É a mesma escolha de `recuperacao-de-senha.spec.ts`.
 *
 * **O que ele deixa para trás:** três contas, duas organizações, quatro vínculos e duas pessoas sem
 * conta, por corrida. `npm run semear:demo -- --apagar` não os remove — eles não são da demonstração.
 *
 * ---------------------------------------------------------------------------
 *  Três janelas, porque são três pessoas
 * ---------------------------------------------------------------------------
 *
 * `A` funda a organização e decide; `B` pede entrada nas duas; `C` funda a segunda. Cada uma tem contexto
 * próprio — a sessão mora em cookie, e duas pessoas na mesma jarra seriam uma pessoa só.
 *
 * ---------------------------------------------------------------------------
 *  Duas divergências entre o roteiro e o produto, declaradas aqui
 * ---------------------------------------------------------------------------
 *
 * **1 · O código público não aparece ao criar a organização; ele mora em T-15.** O passo 2 da Parte 2
 * manda anotá-lo logo depois de criar, e era o achado **V-01** — *"nenhuma tela mostra o código"*. A
 * lacuna foi fechada pelo item 46 · 47, que pôs o código no cartão *Identidade* da Configuração, com o
 * botão *Copiar*. **É de lá que este teste o lê**, que é por onde um Gestor de hoje o leria.
 *
 * **2 · O botão de aprovar NÃO fica indisponível sem papel escolhido.** O item 2 do passo 5 diz que fica;
 * o produto faz o contrário por decisão escrita — *"o principal nunca desabilitado"*
 * (`escolhas-do-vinculo.tsx`, e a decisão 1 de `decisao-de-pedido-de-entrada.tsx`, item 44j). Clicado sem
 * papel, ele **acende a frase** *"Escolha o papel com que … entra."* e leva o foco à primeira opção. O
 * critério 8.4 quer que ninguém aprove às cegas, e é isso que este teste afirma — pelo caminho que o
 * produto tem, e não pelo que o roteiro descreve.
 *
 * ---------------------------------------------------------------------------
 *  O que ele NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | Os dois outros ramos do item 10 | O 10.2 (vínculo com rastro) e o 10.3 (a última Gestora) pedem um mundo que este arquivo não constrói: alguém que já agiu, e uma segunda Gestora para remover a primeira |
 * | A confirmação de conta (6c) | Está desligada no ambiente local, e ligá-la derrubaria a entrega de e-mail da esteira |
 * | A segunda frase da face B de T-02 | É o achado **V-03**, condenado e à espera de item de backlog. Amarrá-la aqui compraria uma quebra programada |
 * | O tema (44), que o passo 1 valida junto | Já tem dono: `tema.test.ts` e `variante-escura.test.ts` |
 * | O telefone vindo de **outra** organização (a segunda metade do 8.5) | Exigiria que `B` tivesse contato cadastrado noutra organização antes de pedir entrada nesta. O que se afirma aqui é que o telefone mostrado é **o informado no pedido** |
 * | A ordem dos seletores de T-04 (o item 5 do passo 2) | É do teste 6 do lote, que mexe na ordem e confere o efeito |
 */

/** A marca do instante — é ela que torna as contas e as organizações próprias desta corrida. */
const MARCA = new Date().toISOString().replace(/[:.]/gu, "-").toLowerCase();

/** A senha das três contas. **Não é a da demonstração**: nenhuma conta daqui é de lá. */
const SENHA = "ResolveAi!2026";

const NOME_A = "Fundadora do Nascimento";
const EMAIL_A = `fundadora.${MARCA}@example.com`;

const NOME_B = "Entrante do Nascimento";
const PRIMEIRO_NOME_B = "Entrante";
const EMAIL_B = `entrante.${MARCA}@example.com`;

const NOME_C = "Gestor da Segunda";
const EMAIL_C = `segunda.${MARCA}@example.com`;

/**
 * **O endereço que não existe, e ele também carrega a marca** — a mesma razão de
 * `recuperacao-de-senha.spec.ts`: um endereço fixo poderia virar conta de verdade um dia, e a asserção do
 * critério 6a.3 passaria a comparar dois sucessos.
 */
const EMAIL_INEXISTENTE = `ninguem.${MARCA}@example.com`;

const ORGANIZACAO_A = `Nascimento ${MARCA}`;
const ORGANIZACAO_C = `Segunda Casa ${MARCA}`;

/** Quem volta à aplicação — o ator do item 98, que nasce nesta corrida como os outros. */
const NOME_R = "Quem Volta ao Nascimento";
const EMAIL_R = `retorno.${MARCA}@example.com`;
const ORGANIZACAO_R = `Retorno ${MARCA}`;

/**
 * **O código inventado do critério 7a.1.**
 *
 * Desde o item 65 o campo só aceita o alfabeto do sorteio, em oito casas: um código com `O` e `0`, que era
 * inventado por construção, nem entra mais. Este é um código válido que ninguém sorteou, e a aposta é
 * declarada: a chance de uma organização do banco local ter tirado exatamente este número é de uma em
 * 1,1 × 10¹² por organização.
 */
const CODIGO_INVENTADO = "ZZZZ2222";

const TELEFONE_DIGITADO = "(11) 95521-7788";
/** O mesmo número como a tabela e o modal de T-08 o escrevem (`telefoneLegivel`). */
const TELEFONE_NA_TELA = "(11) 95521-7788";

const MOTIVO_DA_RECUSA = `Ainda não confirmei o cadastro com a administração. ${MARCA}`;

const ENCARREGADO = "Rafael Sem Conta";
const ENCARREGADO_CORRIGIDO = "Rafael Sem Conta Antunes";
const PESSOA_PARA_REMOVER = "Pessoa Para Remover";

/** As sete da semente (`CATEGORIAS_SEMENTE`), na ordem em que nascem. */
const CATEGORIAS_DA_SEMENTE = [
  "Problemas de iluminação",
  "Equipamentos quebrados",
  "Falta de acessibilidade",
  "Problemas de limpeza",
  "Vazamentos",
  "Problemas de segurança",
  "Solicitações de manutenção",
];

/** T-11 · criar conta. O destino de quem não tem vínculo nenhum é a face A de T-02. */
async function criarConta(pagina: Page, nome: string, email: string): Promise<void> {
  await pagina.goto("/criar-conta");
  await pagina.getByLabel("Seu nome").fill(nome);
  await pagina.getByLabel("E-mail").fill(email);
  // **Ancorada, e não por trecho** — "Senha" por trecho casa também com o "Mostrar a senha" do botão que
  // vive dentro do campo (item 44m), e o `fill` quebraria por modo estrito.
  await pagina.getByLabel(/^Senha/u).fill(SENHA);
  await pagina.getByRole("button", { name: "Criar conta" }).click();
  await pagina.waitForURL(/\/organizacao$/u);
}

/** T-01 · entrar. Autenticação real, sem porta falsa — critério 41b.4. */
async function entrar(pagina: Page, email: string, senha: string): Promise<void> {
  await pagina.goto("/entrar");
  await pagina.getByLabel("E-mail").fill(email);
  await pagina.getByLabel(/^Senha/u).fill(senha);
  await pagina.getByRole("button", { name: "Entrar" }).click();
}

/**
 * Funda a organização pela tela própria — a `/organizacao/criar` que o item 44o separou da face A.
 *
 * O destino é Convidar pessoas, desde o item 116 (critério 7).
 */
async function criarOrganizacao(pagina: Page, nome: string): Promise<void> {
  await pagina.getByRole("link", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/organizacao\/criar$/u);
  await pagina.getByLabel("Nome da organização").fill(nome);
  await pagina.getByRole("button", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/convidar$/u);
  // **A criação entrega o código que a tela prometeu** (critério 116.7).
  await expect(pagina.getByRole("heading", { name: "Convidar pessoas", level: 1 })).toBeVisible();
  await expect(pagina.getByRole("button", { name: "Copiar o código" })).toBeVisible();
}

/**
 * Escreve o código nas oito casas de T-02 (item 65).
 *
 * **`fill` sozinho não serve num campo que já tem valor.** O `input-otp` põe o cursor na última casa ao
 * receber foco, e o `fill` do Playwright insere o texto na seleção que encontra: o que entra é uma casa
 * trocada, não o código novo. Selecionar tudo e digitar é o que a pessoa faz, e é o que exercita a
 * conversão de minúscula e a recusa de tecla fora do alfabeto.
 */
async function preencherCodigo(pagina: Page, codigo: string): Promise<void> {
  const campo = pagina.getByLabel("Código da organização");
  await campo.press("ControlOrMeta+a");
  await campo.pressSequentially(codigo);
  await expect(campo).toHaveValue(codigo);
}

/**
 * Lê o código público em T-15 · Configuração.
 *
 * **Desde o item 65 o código mora nas casas de um campo desabilitado**, e o texto delas não é conteúdo de
 * elemento: o valor é o do campo. O nome acessível é o rótulo da exibição.
 */
async function lerCodigoPublico(pagina: Page): Promise<string> {
  await pagina.goto("/configuracao");
  const campo = pagina.getByLabel("Código da organização");
  await expect(campo).toBeDisabled();
  return (await campo.inputValue()).trim();
}

/** A linha de uma pessoa na tabela de T-08 — o escopo de toda ação de linha. */
function linhaDe(pagina: Page, nome: string): Locator {
  return pagina.getByRole("row").filter({ hasText: nome });
}

/** O gatilho da decisão, na linha do pedido. O nome acessível carrega o nome de quem pediu. */
function responderOPedidoDe(pagina: Page, nome: string): Locator {
  return linhaDe(pagina, nome).getByRole("button", {
    name: new RegExp(`^Responder o pedido de ${nome}$`, "u"),
  });
}

test("o nascimento de uma organização, e a vida dos vínculos: criar conta, fundar, pedir entrada, decidir, cadastrar e remover", async ({
  browser,
}) => {
  const contextoDeA = await browser.newContext();
  const contextoDeB = await browser.newContext();
  const contextoDeC = await browser.newContext();
  const a = await contextoDeA.newPage();
  const b = await contextoDeB.newPage();
  const c = await contextoDeC.newPage();

  // -------------------------------------------------------------------------
  // 1 · A conta de A nasce, e a regra da senha está escrita ANTES de digitar
  //
  // **Critério 6a.1, e a ordem da asserção é a prova.** A frase é conferida com o formulário em branco:
  // afirmá-la depois do envio não distinguiria ajuda de mensagem de erro, que é exatamente a diferença
  // que o critério existe para cobrar.
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // O escuro vem do servidor, e o script do tema vem antes do corpo — critério 72.1
  //
  // **Sem navegador**: a requisição devolve o HTML como o servidor o escreveu, antes de qualquer script
  // rodar. Se ele já diz escuro, a pintura clara não tem de onde vir.
  // -------------------------------------------------------------------------
  const htmlCru = await (await contextoDeA.request.get("/criar-conta")).text();
  expect(htmlCru).toMatch(/<html[^>]*\sdata-theme="dark"/u);
  const posicaoDoScript = htmlCru.indexOf(`id="${ID_DO_SCRIPT_DO_TEMA}"`);
  expect(posicaoDoScript).toBeGreaterThan(-1);
  expect(posicaoDoScript).toBeLessThan(htmlCru.indexOf("<body"));
  // **O contraste também não pisca** (critério 85.1): o servidor nunca o escreve, e o mesmo script do
  // `<head>`, que já vem antes do corpo, é quem o liga. O HTML cru não pode trazer o atributo.
  expect(htmlCru).not.toMatch(/<html[^>]*\sdata-contraste=/u);

  await a.goto("/criar-conta");
  await expect(a.getByText("No mínimo 6 caracteres.")).toBeVisible();
  cobre(test.info(), "2.1 · 6a · 2", { criterio: "6a.1" });

  await a.getByLabel("Seu nome").fill(NOME_A);
  await a.getByLabel("E-mail").fill(EMAIL_A);
  await a.getByLabel(/^Senha/u).fill(SENHA);
  cobre(test.info(), "2.1 · 6a · 1", {
    falta: "a contagem — o teste preenche os três campos rotulados, e não afirma que não existe um quarto",
  });
  await a.getByRole("button", { name: "Criar conta" }).click();
  await a.waitForURL(/\/organizacao$/u);
  await expect(a.getByRole("heading", { name: "Entrar em uma organização" })).toBeVisible();
  cobre(test.info(), "6.1 · 1", {
    falta:
      "«um formulário só — o do código»: a asserção é o título da face A, e não a ausência de um segundo formulário",
  });

  // **O nome digitado aparece na tela** — critério 6a.2. Na face A ele aparece já preenchido no campo do
  // pedido de entrada, que é o que a tela sabe sobre quem acabou de entrar.
  await expect(a.getByLabel("Seu nome")).toHaveValue(NOME_A);
  cobre(test.info(), "2.1 · 6a · 5", { criterio: "6a.2" });

  // -------------------------------------------------------------------------
  // 2 · As três recusas de T-01 e T-11 — critérios 6a.3 e 6a.4
  //
  // **A doutrina do não-confirmar, e o único lugar em que ela cede.** Entrar com a senha errada e entrar
  // com um endereço que não existe dão **a mesma frase**: uma tela que as distinguisse viraria um
  // verificador de quem tem conta, operável sem sessão. Criar conta com e-mail repetido **confirma** que
  // o e-mail existe — e confirma de propósito, porque negá-lo deixaria a pessoa presa (T-11).
  // -------------------------------------------------------------------------
  await a.getByRole("button", { name: "Sair" }).click();
  await a.waitForURL(/\/entrar$/u);

  await entrar(a, EMAIL_A, "senha-que-nao-e-a-dela");
  await expect(a.getByText("E-mail ou senha incorretos.")).toBeVisible();
  // **A recusa não apaga o e-mail** (critério 103.6). A senha, sim.
  await expect(a.getByLabel("E-mail")).toHaveValue(EMAIL_A);
  await expect(a.getByLabel(/^Senha/u)).toHaveValue("");

  await entrar(a, EMAIL_INEXISTENTE, SENHA);
  await expect(a.getByText("E-mail ou senha incorretos.")).toBeVisible();
  cobre(test.info(), "2.1 · 6a · 3", { criterio: "6a.3" });

  await a.getByRole("link", { name: "Criar conta" }).click();
  await a.waitForURL(/\/criar-conta$/u);
  await a.getByLabel("Seu nome").fill(NOME_A);
  await a.getByLabel("E-mail").fill(EMAIL_A);
  await a.getByLabel(/^Senha/u).fill(SENHA);
  await a.getByRole("button", { name: "Criar conta" }).click();

  // A frase **e os dois caminhos** — é o que o critério 6a.4 cobra, e é o que a torna útil em vez de um
  // beco: entrar, logo abaixo, e recuperar a senha, aqui.
  await expect(a.getByText("Já existe uma conta com este e-mail. Entre em vez de criar.")).toBeVisible();
  await expect(a.getByLabel("Seu nome")).toHaveValue(NOME_A);
  await expect(a.getByLabel("E-mail")).toHaveValue(EMAIL_A);
  await expect(a.getByLabel(/^Senha/u)).toHaveValue("");
  await expect(a.getByRole("link", { name: "Esqueci a senha" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Já tenho conta" })).toBeVisible();
  cobre(test.info(), "2.1 · 6a · 4", { criterio: "6a.4" });

  await a.getByRole("link", { name: "Já tenho conta" }).click();
  await a.waitForURL(/\/entrar$/u);
  await a.getByLabel("E-mail").fill(EMAIL_A);
  await a.getByLabel(/^Senha/u).fill(SENHA);
  await a.getByRole("button", { name: "Entrar" }).click();
  await a.waitForURL(/\/organizacao$/u);

  // -------------------------------------------------------------------------
  // 3 · A organização nasce, e A já está dentro dela — critérios 1.3, 1.1, 2.3 e 3.1
  //
  // **1.3 é afirmado pelo destino, e não por uma frase:** criar leva direto a T-03, e nenhuma tela pede
  // para escolher a organização. Se o cookie de organização não tivesse saído do `201`, a rota `/`
  // devolveria para T-02 — foi o que o achado A-10 produziu em outro host, e é a mesma falha que esta
  // espera de URL pegaria.
  // -------------------------------------------------------------------------
  await criarOrganizacao(a, ORGANIZACAO_A);
  await expect(a.getByRole("combobox", { name: /organização/iu })).toHaveText(ORGANIZACAO_A);
  cobre(test.info(), "2.2 · 1", { criterio: "1.3" });
  // O nome de quem entrou, agora dentro da casca — a outra metade do 6a.2.
  await expect(a.getByRole("button", { name: `Conta de ${NOME_A}` })).toBeVisible();

  const codigoDeA = await lerCodigoPublico(a);
  expect(codigoDeA).toMatch(/^[A-Z0-9]{6,12}$/u);
  cobre(test.info(), "2.2 · 2", {
    falta:
      "o nome do cartão «Identidade» — a caixa do código é achada pelo botão «Copiar» ao lado, e não pelo título",
  });

  // As sete categorias, com a frase que diz **como** elas chegaram ali — critério 2.3. Sem a frase, quem
  // abre a tela não sabe se as encontrou ou se alguém as digitou.
  await a.goto("/configuracao/categorias");
  await expect(a.getByText("Sete foram criadas junto com a organização.")).toBeVisible();
  // Sete linhas mais a do cabeçalho. A contagem é a prova de que **não há uma oitava**; os nomes, de que
  // são estas sete.
  await expect(a.getByRole("row")).toHaveCount(CATEGORIAS_DA_SEMENTE.length + 1);
  for (const categoria of CATEGORIAS_DA_SEMENTE) {
    await expect(a.getByRole("cell", { name: categoria })).toBeVisible();
  }
  cobre(test.info(), "2.2 · 3", {
    falta:
      "a frase do roteiro é «Sete categorias foram criadas junto com a organização.»; o produto escreve «Sete foram criadas junto com a organização.», e é essa que o teste assere",
  });

  // As duas áreas, **uma de cada tipo** — critério 3.1. A asserção é por linha, e não por célula solta:
  // *Área comum* é nome de uma e rótulo de tipo da outra, e um localizador solto pegaria as duas.
  await a.goto("/configuracao/areas");
  await expect(a.getByRole("row")).toHaveCount(3);
  await expect(a.getByRole("row").filter({ hasText: "Área comum" })).toHaveCount(1);
  const linhaPrivativa = a.getByRole("row").filter({ hasText: "Unidade privativa" });
  await expect(linhaPrivativa).toHaveCount(1);
  await expect(linhaPrivativa).toContainText("Unidade");
  cobre(test.info(), "2.2 · 4", { criterio: "3.1" });

  // -------------------------------------------------------------------------
  // 3a · A aparência antes de entrar — critérios 114.2, 114.4, 114.7 e 114.8
  //
  // **B ainda não tem conta**, e é o único momento do arquivo em que uma tela de fora da casca está
  // aberta sem sessão. O controle do canto abre o mesmo grupo do menu da pessoa. Sob movimento reduzido,
  // o menu entra com a duração devolvida e sem geometria.
  // -------------------------------------------------------------------------
  await b.emulateMedia({ reducedMotion: "reduce" });
  await b.goto("/entrar");
  const controleDeAparencia = b.getByRole("button", { name: "Aparência" });
  await controleDeAparencia.focus();
  await b.keyboard.press("Enter");
  const menuDaMoldura = b.getByRole("menu");
  await expect(menuDaMoldura).toBeVisible();
  await expect(b.getByRole("group", { name: "Aparência" })).toBeVisible();

  const movimento = await menuDaMoldura.evaluate((menu) => {
    const estilo = getComputedStyle(menu);
    return {
      duracao: estilo.animationDuration,
      escala: estilo.getPropertyValue("--tw-enter-scale").trim(),
      deslocamento: estilo.getPropertyValue("--tw-enter-translate-y").trim(),
    };
  });
  expect(movimento).toEqual({ duracao: "0.15s", escala: "1", deslocamento: "0" });
  await b.emulateMedia({ reducedMotion: null });

  // Busca por digitação: «a» pousa no contraste, e o Enter o liga sem fechar o menu.
  //
  // **Uma letra por abertura do menu.** O Radix acumula o que se digita por um segundo
  // (`@radix-ui/react-menu/dist/index.mjs:218`): um «t» logo depois do «a» viraria a busca «at», que não
  // casa com nada, e o foco ficaria parado. Fechar e reabrir zera a busca, porque o conteúdo remonta.
  await b.keyboard.press("a");
  const contrasteNaMoldura = b.getByRole("menuitemcheckbox", { name: "Alto contraste" });
  await expect(contrasteNaMoldura).toBeFocused();
  await b.keyboard.press("Enter");
  await expect(b.locator("html")).toHaveAttribute("data-contraste", "alto");
  await expect(contrasteNaMoldura).toHaveAttribute("aria-checked", "true");
  await b.keyboard.press("Escape");
  await expect(menuDaMoldura).toHaveCount(0);

  // Reaberto, o foco cai no primeiro item, que é o tema: a seta leva ao contraste, e o «t» volta ao
  // tema, que continua no teclado, marcado, inerte e com a razão. (Digitar «t» já no tema não provaria
  // nada: com uma letra só, o Radix pula o item atual.)
  await controleDeAparencia.focus();
  await b.keyboard.press("Enter");
  await expect(menuDaMoldura).toBeVisible();
  await b.keyboard.press("ArrowDown");
  await expect(contrasteNaMoldura).toBeFocused();
  await b.keyboard.press("t");
  const temaNaMoldura = b.getByRole("menuitemcheckbox", { name: "Tema escuro" });
  await expect(temaNaMoldura).toBeFocused();
  await expect(temaNaMoldura).toHaveAttribute("aria-checked", "true");
  await expect(temaNaMoldura).toHaveAttribute("aria-disabled", "true");
  await expect(temaNaMoldura).toHaveAccessibleDescription("O alto contraste define as cores.");
  // Enter no item inerte não muda nada: nem o atributo, nem o cookie.
  await b.keyboard.press("Enter");
  await expect(b.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await contextoDeB.cookies()).find((cookie) => cookie.name === "tema")).toBeUndefined();

  // Desligar devolve a página ao estado de partida, para o resto do arquivo. Pela seta, e não por «a»:
  // o «t» de agora há pouco ainda está na busca.
  await b.keyboard.press("ArrowDown");
  await expect(contrasteNaMoldura).toBeFocused();
  await b.keyboard.press("Enter");
  await expect(b.locator("html")).not.toHaveAttribute("data-contraste");
  await b.keyboard.press("Escape");
  await expect(menuDaMoldura).toHaveCount(0);

  // A documentação tem o interruptor dela, e não o nosso.
  await b.goto("/documentacao");
  await expect(b.getByRole("button", { name: "Aparência" })).toHaveCount(0);

  // -------------------------------------------------------------------------
  // 4 · A conta de B, e o código inventado ANTES do verdadeiro — critérios 7a.1 e 7a.4
  //
  // **A ordem é obrigatória, e o roteiro a corrigiu por isso** (achado V-04): assim que existe pedido
  // pendente, T-02 troca para a face B, **que não tem campo de código**. A janela para testar código
  // inválido fecha e não reabre.
  // -------------------------------------------------------------------------
  await criarConta(b, NOME_B, EMAIL_B);

  await preencherCodigo(b, CODIGO_INVENTADO);
  cobre(test.info(), "2.4 · 1");
  await b.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(
    b.getByText("Nenhuma organização usa este código. Confira as letras e os números."),
  ).toBeVisible();
  // **E nada da organização vaza junto** — a recusa não diz o nome de organização nenhuma.
  await expect(b.getByText(ORGANIZACAO_A)).toHaveCount(0);
  cobre(test.info(), "2.4 · 2", { criterio: "7a.1" });

  await preencherCodigo(b, codigoDeA);
  await b.getByLabel("Telefone (opcional)").fill(TELEFONE_DIGITADO);
  await b.getByRole("button", { name: "Pedir entrada" }).click();

  // A face B: o título, o nome da organização e a ausência do campo de código — critério 7a.4. A segunda
  // frase da tela **não** é afirmada aqui: é o achado V-03, e o cabeçalho diz por quê.
  await expect(b.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await expect(b.getByText(ORGANIZACAO_A)).toBeVisible();
  await expect(b.getByLabel("Código da organização")).toHaveCount(0);
  cobre(test.info(), "2.4 · 3", {
    falta:
      "quando o pedido foi feito, e a frase que avisa onde a resposta aparece — a segunda é o achado V-03",
  });

  // -------------------------------------------------------------------------
  // 5 · A decide: o pedido, a recusa, e a aprovação depois de B refazer
  //
  // Critérios 8.5 (o nome e o telefone informado), 8.4 (nenhum papel pré-selecionado, e a consequência
  // escrita onde a escolha é feita), 8.3 (o motivo não chega a quem foi recusado) e 8.1.
  // -------------------------------------------------------------------------
  await a.getByRole("link", { name: "Participantes" }).click();
  await a.waitForURL(/\/vinculos$/u);

  await expect(linhaDe(a, NOME_B)).toContainText("pedido de entrada");
  await responderOPedidoDe(a, NOME_B).click();

  const modalDoPedido = a.getByRole("dialog");
  await expect(modalDoPedido.getByRole("heading", { name: "Responder pedido de entrada" })).toBeVisible();
  // **O telefone é o que B informou no pedido**, escrito como a tela o escreve — critério 8.5.
  await expect(modalDoPedido).toContainText(TELEFONE_NA_TELA);
  cobre(test.info(), "2.5 · 1", {
    falta:
      "o telefone vindo de outra organização, que é a segunda metade do 8.5 — o que se afirma é que o mostrado é o informado no pedido",
  });

  // **Nenhum papel vem marcado** — a primeira das três decisões que o PA-25 produziu.
  await expect(modalDoPedido.getByRole("radio", { checked: true })).toHaveCount(0);
  // **A consequência está escrita ao lado de cada papel**, e a de Encarregado é a que o inventário cobra
  // em destaque.
  await expect(modalDoPedido.getByText("Registra e acompanha as próprias ocorrências.")).toBeVisible();
  await expect(modalDoPedido.getByText("Não consegue fazer nada dentro do sistema.")).toBeVisible();
  cobre(test.info(), "2.5 · 3", {
    falta: "a consequência do papel Gestor — o teste afirma as de Solicitante e de Encarregado",
  });

  // Aprovar sem escolher papel **não aprova** — ver a divergência 2 do cabeçalho.
  await modalDoPedido.getByRole("button", { name: "Aprovar" }).click();
  await expect(modalDoPedido.getByText(`Escolha o papel com que ${PRIMEIRO_NOME_B} entra.`)).toBeVisible();
  await expect(modalDoPedido.getByRole("heading", { name: "Responder pedido de entrada" })).toBeVisible();

  await modalDoPedido.getByRole("button", { name: "Recusar pedido" }).click();
  await expect(modalDoPedido.getByRole("heading", { name: `Recusar o pedido de ${NOME_B}?` })).toBeVisible();
  await modalDoPedido.getByLabel("Motivo").fill(MOTIVO_DA_RECUSA);
  await modalDoPedido.getByRole("button", { name: "Recusar pedido" }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await expect(linhaDe(a, NOME_B)).toHaveCount(0);
  cobre(test.info(), "2.5 · 4", {
    falta:
      "«a confirmação diz o papel em palavras» — a confirmação da recusa nomeia a pessoa, e papel nenhum aparece nela",
  });

  // Do lado de B: a recusa aparece, **e o motivo não** — critério 8.3. A observação é para os Gestores.
  await b.reload();
  await expect(b.getByRole("heading", { name: "Pedido não aprovado" })).toBeVisible();
  await expect(b.getByText(MOTIVO_DA_RECUSA)).toHaveCount(0);
  cobre(test.info(), "2.5 · 5", { criterio: "8.3" });

  // **Recusado pode ser refeito** — é a suposição S4 do modelo, e é por isso que a face C tem o campo.
  await preencherCodigo(b, codigoDeA);
  await b.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(b.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();

  await a.reload();
  await responderOPedidoDe(a, NOME_B).click();
  const modalDaAprovacao = a.getByRole("dialog");
  await modalDaAprovacao.getByRole("radio", { name: /^Solicitante/u }).check();
  // **O controle positivo do "nenhum papel marcado" de cima.** Sem esta linha, aquela asserção passaria
  // verde também num dia em que o localizador deixasse de enxergar papel marcado nenhum — e o critério
  // 8.4 estaria sendo afirmado por um localizador cego.
  await expect(modalDaAprovacao.getByRole("radio", { checked: true })).toHaveCount(1);
  // **O botão diz o papel** — o trabalho que a confirmação separada fazia antes do item 44j.
  await modalDaAprovacao.getByRole("button", { name: "Aprovar como Solicitante" }).click();
  cobre(test.info(), "2.5 · 2", { criterio: "8.4" });
  await expect(a.getByRole("dialog")).toHaveCount(0);

  const linhaDeB = linhaDe(a, NOME_B);
  await expect(linhaDeB).toContainText("Solicitante");
  await expect(linhaDeB).not.toContainText("pedido de entrada");
  cobre(test.info(), "2.5 · 6", { criterio: "7a.2, 8.1" });

  // -------------------------------------------------------------------------
  // 6 · A cadastra quem não tem conta, corrige o nome dele, e não corrige o de B
  //
  // Critérios 9a.1 e 9a.3. **A diferença que o item existe para criar:** o nome de quem tem conta vem da
  // conta, e a tela de T-08 nem oferece o campo — é a forma que o produto deu à recusa.
  // -------------------------------------------------------------------------
  await a.getByRole("link", { name: "Cadastrar participante" }).click();
  await a.waitForURL(/\/vinculos\/nova$/u);
  await a.getByLabel("Nome").fill(ENCARREGADO);
  await a.getByRole("radio", { name: /^Encarregado/u }).check();
  await a.getByRole("button", { name: "Cadastrar" }).click();
  await a.waitForURL(/\/vinculos$/u);

  // **Aparece na lista imediatamente** — critério 9a.1 —, com o selo de quem não tem conta.
  await expect(linhaDe(a, ENCARREGADO)).toContainText("Encarregado");
  await expect(linhaDe(a, ENCARREGADO)).toContainText("sem conta");
  cobre(test.info(), "2.6 · 1", { criterio: "9a.1" });

  await linhaDe(a, ENCARREGADO).getByRole("link", { name: "Editar participante" }).click();
  await a.waitForURL(/\/vinculos\/[0-9a-f-]+\/editar$/u);
  await a.getByLabel("Nome").fill(ENCARREGADO_CORRIGIDO);
  await a.getByRole("button", { name: "Salvar" }).click();
  await a.waitForURL(/\/vinculos$/u);
  await expect(linhaDe(a, ENCARREGADO_CORRIGIDO)).toHaveCount(1);
  cobre(test.info(), "2.6 · 4", { criterio: "9a.3" });
  cobre(test.info(), "2.6 · 2", {
    falta:
      "os dois na mesma leitura — o papel de B é afirmado antes de o Encarregado existir, e o do Encarregado depois",
  });

  await linhaDe(a, NOME_B).getByRole("link", { name: "Editar participante" }).click();
  await a.waitForURL(/\/vinculos\/[0-9a-f-]+\/editar$/u);
  // **O nome de quem tem conta está em leitura**, e não há campo para digitá-lo.
  //
  // **A asserção é por rótulo, e o motivo é o mesmo do item 44m:** o rótulo de campo obrigatório é
  // *"Nome *"*, com o asterisco num `span` `aria-hidden` dentro do `label` — e o motor do localizador
  // não o pula. Um `getByRole("textbox", { name: "Nome" })`, que casa por nome exato, **não acharia o
  // campo nem onde ele existe**, e a ausência aqui seria afirmada por um localizador cego. O `getByLabel`
  // casa por trecho, e a mesma chamada acabou de preencher o campo do Encarregado, duas linhas acima.
  await expect(a.getByLabel("Nome")).toHaveCount(0);
  await expect(a.getByText(NOME_B).first()).toBeVisible();
  cobre(test.info(), "2.6 · 3", {
    falta:
      "a frase que explica — o teste afirma a ausência do campo e o nome em leitura, e não o texto que diz que o nome vem da conta",
  });

  // -------------------------------------------------------------------------
  // 7 · A segunda organização nasce, com a conta de C
  // -------------------------------------------------------------------------
  await criarConta(c, NOME_C, EMAIL_C);
  await criarOrganizacao(c, ORGANIZACAO_C);
  cobre(test.info(), "6.1 · 2", {
    falta:
      "o convite ao lado do cartão e a régua do «ou», a cor do botão de criar, a ausência da nota «campo obrigatório» e a lista de ocorrências vazia no fim",
  });
  const codigoDeC = await lerCodigoPublico(c);
  expect(codigoDeC).toMatch(/^[A-Z0-9]{6,12}$/u);
  expect(codigoDeC).not.toBe(codigoDeA);
  cobre(test.info(), "6.1 · 3", {
    falta:
      "o caminho pelo menu da esquerda e o clique em «Copiar» — o teste vai pelo endereço e lê o código do texto, sem a área de transferência",
  });

  // -------------------------------------------------------------------------
  // 8 · B pede entrada na segunda SEM sair da primeira — critério 7b.1
  //
  // **O caminho é o menu da conta**, e não o seletor de organização: até o item 44o ele morava lá, e o
  // 44b, que trocou o seletor por uma lista de escolha, o perdeu (critério 44o.14).
  // -------------------------------------------------------------------------
  await b.reload();
  await b.waitForURL(/\/ocorrencias$/u);
  // **O sistema deixou de decidir** (critério 72.1): o Chromium do Playwright tem esquema claro por
  // padrão, e a página abre escura mesmo assim.
  await expect(b.locator("html")).toHaveAttribute("data-theme", "dark");

  // **O tema, pelo teclado** (critério 72.3): o gatilho abre com Enter, as setas chegam ao item, e o
  // leitor de tela lê o papel, o nome e o estado.
  const gatilhoDeB = b.getByRole("button", { name: `Conta de ${NOME_B}` });
  await gatilhoDeB.focus();
  await b.keyboard.press("Enter");
  // O grupo titulado (critério 114.5): o leitor diz o nome do grupo ao entrar nele.
  await expect(b.getByRole("group", { name: "Aparência" })).toBeVisible();
  const itemDeTema =b.getByRole("menuitemcheckbox", { name: "Tema escuro" });
  await expect(itemDeTema).toHaveAttribute("aria-checked", "true");
  await expect(itemDeTema).not.toHaveAttribute("aria-pressed");
  while (!(await itemDeTema.evaluate((elemento) => elemento === document.activeElement))) {
    await b.keyboard.press("ArrowDown");
  }
  await expect(itemDeTema).toBeFocused();

  // Trocar não fecha o menu, e o Enter troca uma vez só.
  await b.keyboard.press("Enter");
  await expect(itemDeTema).toBeVisible();
  await expect(itemDeTema).toHaveAttribute("aria-checked", "false");
  await expect(b.locator("html")).toHaveAttribute("data-theme", "light");
  expect((await contextoDeB.cookies()).find((cookie) => cookie.name === "tema")?.value).toBe("claro");

  // **O alto contraste, pelo teclado** (critérios 85.1 e 85.3). Ele vence o tema: com o claro guardado,
  // ligar o contraste escurece a página, e o *Tema escuro* fica inerte, e marcado, porque a tela é escura.
  const itemDeContraste = b.getByRole("menuitemcheckbox", { name: "Alto contraste" });
  await expect(itemDeContraste).toHaveAttribute("aria-checked", "false");
  await b.keyboard.press("ArrowDown");
  await expect(itemDeContraste).toBeFocused();
  await b.keyboard.press("Enter");
  await expect(itemDeContraste).toHaveAttribute("aria-checked", "true");
  await expect(b.locator("html")).toHaveAttribute("data-contraste", "alto");
  expect((await contextoDeB.cookies()).find((cookie) => cookie.name === "contraste")?.value).toBe("alto");
  // **O tema diz o que a tela pinta** (critério 114.3): com o contraste ligado, é escuro, mesmo com o
  // claro guardado.
  await expect(itemDeTema).toHaveAttribute("aria-checked", "true");
  await expect(itemDeTema).toHaveAttribute("aria-disabled", "true");
  await expect(itemDeTema).toHaveAccessibleDescription("O alto contraste define as cores.");
  // **Inerte, e não fora do teclado** (critério 114.4): a busca por digitação chega nele, e o Enter não
  // troca o tema guardado.
  await b.keyboard.press("t");
  await expect(itemDeTema).toBeFocused();
  await b.keyboard.press("Enter");
  await expect(b.locator("html")).toHaveAttribute("data-theme", "light");
  expect((await contextoDeB.cookies()).find((cookie) => cookie.name === "tema")?.value).toBe("claro");
  expect(
    await b.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
  ).toBe("dark");

  // Recarregar: o script do `<head>` lê os dois cookies antes da primeira pintura.
  await b.reload();
  await expect(b.locator("html")).toHaveAttribute("data-contraste", "alto");
  await expect(b.locator("html")).toHaveAttribute("data-theme", "light");

  // Desligar devolve o claro guardado, e o *Tema escuro* volta a responder.
  await gatilhoDeB.click();
  await b.getByRole("menuitemcheckbox", { name: "Alto contraste" }).click();
  await expect(b.locator("html")).not.toHaveAttribute("data-contraste");
  await expect(b.getByRole("menuitemcheckbox", { name: "Tema escuro" })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  // E o tema volta a dizer o guardado: sol, desmarcado.
  await expect(b.getByRole("menuitemcheckbox", { name: "Tema escuro" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  expect(
    await b.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
  ).not.toBe("dark");

  // E o caminho que o passo 8 já fazia, agora com o menu aberto pelo teclado.
  await b.getByRole("menuitem", { name: "Entrar em outra organização" }).click();
  await b.waitForURL(/entrar-em-outra=true$/u);

  // Navegação por link: o `<html>` é do layout raiz, que a navegação suave não refaz.
  await expect(b.locator("html")).toHaveAttribute("data-theme", "light");
  cobre(test.info(), "6.2 · 4", {
    falta:
      "o conteúdo do menu — nome, e-mail, «Meus dados» e «Sair»; o teste afirma só o item «Entrar em outra organização»",
  });

  await expect(b.getByRole("heading", { name: "Entrar em outra organização" })).toBeVisible();
  // A frase que o critério 7b.1 exige em palavras: **o vínculo na primeira não é tocado**.
  await expect(b.getByText("Pedir entrada em outra não tira você daqui.")).toBeVisible();

  await preencherCodigo(b, codigoDeC);
  await b.getByRole("button", { name: "Pedir entrada" }).click();
  // A lista de pedidos é o *aqui* que a face B promete — sem ela, o pedido sumiria da vista.
  await expect(b.getByText("Aguardando a decisão de um Gestor")).toBeVisible();
  await expect(b.getByText(ORGANIZACAO_C)).toBeVisible();
  cobre(test.info(), "6.2 · 5", {
    falta: "o rótulo da seção «SEUS PEDIDOS», que nenhuma asserção toca",
  });

  // -------------------------------------------------------------------------
  // 9 · C aprova, e B passa a ter duas — critérios 7b.2 e 7b.3
  // -------------------------------------------------------------------------
  await c.getByRole("link", { name: "Participantes" }).click();
  await c.waitForURL(/\/vinculos$/u);
  await responderOPedidoDe(c, NOME_B).click();
  const modalDeC = c.getByRole("dialog");
  await modalDeC.getByRole("radio", { name: /^Solicitante/u }).check();
  await modalDeC.getByRole("button", { name: "Aprovar como Solicitante" }).click();
  await expect(c.getByRole("dialog")).toHaveCount(0);
  await expect(linhaDe(c, NOME_B)).toContainText("Solicitante");
  cobre(test.info(), "6.2 · 6");

  // **Entrar numa nova não troca sozinho** — critério 7b.2. A ativa continua sendo a primeira.
  await b.goto("/ocorrencias");

  // Navegação dura: o servidor devolve escuro, e o script do `<head>` lê o cookie e troca para claro.
  // É o mesmo caminho de quem volta depois de um deploy: a escolha mora no navegador, e nenhum deploy a
  // toca (critério 72.4).
  await expect(b.locator("html")).toHaveAttribute("data-theme", "light");

  const seletorDeB = b.getByRole("combobox", { name: /organização/iu });
  await expect(seletorDeB).toHaveText(ORGANIZACAO_A);
  await seletorDeB.click();
  await expect(b.getByRole("option", { name: ORGANIZACAO_A })).toBeVisible();
  await expect(b.getByRole("option", { name: ORGANIZACAO_C })).toBeVisible();
  cobre(test.info(), "6.2 · 7", { criterio: "7b.2" });

  // E a troca leva à outra — critério 7b.3.
  await b.getByRole("option", { name: ORGANIZACAO_C }).click();
  await b.waitForURL(/\/ocorrencias$/u);
  await expect(b.getByRole("combobox", { name: /organização/iu })).toHaveText(ORGANIZACAO_C);
  cobre(test.info(), "6.2 · 8", {
    falta:
      "a frase «Trocando…», a lista vazia do outro lado e a volta para a primeira organização",
  });

  // -------------------------------------------------------------------------
  // 10 · C cadastra alguém sem conta e a remove — critério 10.4, ramo sem conta
  //
  // **A frase do ramo sem conta não é enfeite:** quem não tem conta não pode pedir entrada de novo, e o
  // cadastro que fica não é o cadastro que volta — re-cadastrar cria outra linha, e os contatos são
  // redigitados. Confirmação existe para dizer o custo do clique.
  // -------------------------------------------------------------------------
  await c.getByRole("link", { name: "Cadastrar participante" }).click();
  await c.waitForURL(/\/vinculos\/nova$/u);
  await c.getByLabel("Nome").fill(PESSOA_PARA_REMOVER);
  await c.getByRole("radio", { name: /^Encarregado/u }).check();
  await c.getByRole("button", { name: "Cadastrar" }).click();
  await c.waitForURL(/\/vinculos$/u);
  await expect(linhaDe(c, PESSOA_PARA_REMOVER)).toHaveCount(1);

  await linhaDe(c, PESSOA_PARA_REMOVER).getByRole("button", { name: "Remover da organização" }).click();
  const confirmacao = c.getByRole("alertdialog");
  await expect(
    confirmacao.getByRole("heading", { name: `Remover ${PESSOA_PARA_REMOVER} da organização?` }),
  ).toBeVisible();
  await expect(confirmacao).toContainText(
    `Remover o vínculo de ${PESSOA_PARA_REMOVER}. O cadastro da pessoa não é apagado, mas ela não tem conta e não pode pedir entrada: para voltar, precisa ser cadastrada de novo, com os contatos.`,
  );
  await confirmacao.getByRole("button", { name: "Remover" }).click();

  await expect(c.getByRole("alertdialog")).toHaveCount(0);
  await expect(linhaDe(c, PESSOA_PARA_REMOVER)).toHaveCount(0);
  cobre(test.info(), "6.3 · 11", { criterio: "10.4" });
});

/**
 * ============================================================================
 *  O convite por link (item 86)
 * ============================================================================
 *
 * **Quatro pessoas, quatro janelas**, pelo mesmo motivo do teste acima: `G` funda e convida; `N` não tem
 * conta e chega pelo link; `O` já usa outra organização e pede pelo link; e uma janela sem ninguém, que é
 * quem abre um código que não existe. **Tudo nasce aqui**, com a marca do instante.
 */
test("o convite por link: sem conta, criar conta e voltar, pedir, a outra organização e o Gestor que aprova", async ({
  browser,
}) => {
  const NOME_G = "Gestora do Convite";
  const EMAIL_G = `gestora-convite.${MARCA}@example.com`;
  const NOME_N = "Novata do Convite";
  const EMAIL_N = `novata-convite.${MARCA}@example.com`;
  const NOME_O = "Vizinho de Outra Casa";
  const EMAIL_O = `vizinho-convite.${MARCA}@example.com`;
  const ORG_CONVITE = `Convite ${MARCA}`;
  const ORG_DO_VIZINHO = `Casa do Vizinho ${MARCA}`;

  const g = await (await browser.newContext()).newPage();
  const contextoDeN = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const n = await contextoDeN.newPage();
  const contextoDeO = await browser.newContext();
  const o = await contextoDeO.newPage();
  const ninguem = await (await browser.newContext()).newPage();

  // 1 · G funda e abre "Convidar pessoas" pelo menu (critério 86.1, a metade visível).
  await criarConta(g, NOME_G, EMAIL_G);
  await criarOrganizacao(g, ORG_CONVITE);
  await g.getByRole("link", { name: "Convidar pessoas" }).click();
  await g.waitForURL(/\/convidar$/u);
  const link = (await g.locator("code").first().innerText()).trim();
  expect(link).toMatch(/\/\?e=[A-Z0-9]{8}$/u);
  const codigo = link.slice(link.indexOf("?e=") + 3);
  await expect(g.getByRole("img", { name: `QR do link de convite para ${ORG_CONVITE}` })).toBeVisible();

  // 2 · Quem já participa abre o próprio link.
  await g.goto(`/?e=${codigo}`);
  await g.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  await expect(g.getByRole("heading", { name: "Você já participa desta organização" })).toBeVisible();

  // 3 · Código que não leva a lugar nenhum, sem sessão.
  await ninguem.goto("/?e=ZZZZ2222");
  await expect(ninguem.getByRole("heading", { name: "Convite não encontrado" })).toBeVisible();

  // 3b · A rota, sem sessão: o corpo tem EXATAMENTE nome, código e situação (86.2), o inexistente é 404 e o
  // malformado é 400. É o único teste que exercita `GET /convites/{codigo}` pela rota, e não pela estrada
  // direta da página.
  const lido = await ninguem.request.get(`/api/convites/${codigo}`);
  expect(lido.status()).toBe(200);
  expect(await lido.json()).toStrictEqual({
    organizacao: { nome: ORG_CONVITE, codigoPublico: codigo },
    situacao: "sem-sessao",
  });
  const inexistente = await ninguem.request.get("/api/convites/ZZZZ2222");
  expect(inexistente.status()).toBe(404);
  expect((await inexistente.json()).codigo).toBe("CODIGO_PUBLICO_NAO_ENCONTRADO");
  expect((await ninguem.request.get("/api/convites/k7m4")).status()).toBe(400);

  // 4 · Sem sessão, no celular: o ?e= vem antes da sessão (86.6) e a página cabe em 360 × 640 (86.7).
  await n.goto(`/?e=${codigo}`);
  await n.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  await expect(n.getByRole("heading", { name: ORG_CONVITE })).toBeVisible();
  await expect(n.getByLabel("Código da organização")).toBeDisabled();
  expect(await transbordo(n)).toStrictEqual(SEM_TRANSBORDO);
  const criar = n.getByRole("link", { name: "Criar conta" });
  const caixa = await criar.boundingBox();
  expect((caixa?.y ?? 9999) + (caixa?.height ?? 0)).toBeLessThanOrEqual(640);

  // 5 · Cria a conta pelo convite e volta sozinha para ele (86.4).
  await criar.click();
  await n.waitForURL(/\/criar-conta\?destino=/u);
  await n.getByLabel("Seu nome").fill(NOME_N);
  await n.getByLabel("E-mail").fill(EMAIL_N);
  await n.getByLabel(/^Senha/u).fill(SENHA);
  await n.getByRole("button", { name: "Criar conta" }).click();
  await n.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  const pedir = n.getByRole("button", { name: "Pedir entrada" });
  await expect(pedir).toBeVisible();
  // Com os três campos da P1, o botão ainda cabe acima da dobra (86.7). Se falhar aqui, a volta é a
  // opção 3 da P1, e não tirar os campos.
  const botao = await pedir.boundingBox();
  expect((botao?.y ?? 9999) + (botao?.height ?? 0)).toBeLessThanOrEqual(640);
  expect(await transbordo(n)).toStrictEqual(SEM_TRANSBORDO);

  // 6 · Pede, e a página refeita diz que o pedido espera o Gestor; sem organização, não há "Voltar para".
  await pedir.click();
  await expect(n.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await expect(n.getByRole("link", { name: /^Voltar para/u })).toHaveCount(0);
  // Abrir de novo não cria segundo pedido: a mesma face.
  await n.goto(`/?e=${codigo}`);
  await expect(n.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();

  // 7 · O vizinho, em outra organização, pede pelo link e continua nela (86.5).
  await criarConta(o, NOME_O, EMAIL_O);
  await criarOrganizacao(o, ORG_DO_VIZINHO);
  const cookieAntes = (await contextoDeO.cookies()).find((c) => c.name === "resolveai_organizacao")
    ?.value;
  expect(cookieAntes).toBeDefined();
  await o.goto(`/?e=${codigo}`);
  await o.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(o.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  const cookieDepois = (await contextoDeO.cookies()).find((c) => c.name === "resolveai_organizacao")
    ?.value;
  expect(cookieDepois).toBe(cookieAntes);
  await o.getByRole("link", { name: `Voltar para ${ORG_DO_VIZINHO}` }).click();
  await expect(o.getByRole("combobox", { name: /organização/iu })).toHaveText(ORG_DO_VIZINHO);

  // 8 · Sair e entrar pelo convite também volta a ele, sem pedir por ela (86.4, a outra metade).
  await contextoDeN.clearCookies();
  await n.goto(`/convite/${codigo}`);
  await n.getByRole("link", { name: "Entrar" }).click();
  await n.getByLabel("E-mail").fill(EMAIL_N);
  await n.getByLabel(/^Senha/u).fill(SENHA);
  await n.getByRole("button", { name: "Entrar" }).click();
  await n.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  await expect(n.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();

  // 9 · G vê os dois pedidos em Participantes, aprova N como Solicitante, e N é recusada em /convidar (86.1).
  await g.goto("/vinculos");
  await responderOPedidoDe(g, NOME_N).click();
  // Os localizadores do passo 5 do teste de cima, escopados ao diálogo.
  const modalDoConvite = g.getByRole("dialog");
  await modalDoConvite.getByRole("radio", { name: /^Solicitante/u }).check();
  await modalDoConvite.getByRole("button", { name: "Aprovar como Solicitante" }).click();
  await expect(g.getByRole("dialog")).toHaveCount(0);
  await expect(linhaDe(g, NOME_O)).toBeVisible();

  await n.goto("/convidar");
  await expect(n.getByText("Seu papel nesta organização não dá acesso a esta página.")).toBeVisible();
  await expect(n.locator("code")).toHaveCount(0);
  await expect(n.getByRole("link", { name: "Convidar pessoas" })).toHaveCount(0);
});

/**
 * ============================================================================
 *  O QR na área (item 111)
 * ============================================================================
 *
 * O mesmo caminho do convite, por outra porta: a etiqueta colada no lugar. Quatro janelas: a Gestora que
 * gera o QR, a Solicitante que lê no celular (com e sem sessão, numa organização e noutra), quem não
 * participa, e uma janela sem ninguém, que abre o QR adulterado.
 */
test("o QR na área: o Gestor gera, quem participa registra com a área, quem não participa pede entrada", async ({
  browser,
}) => {
  const NOME_G = "Gestora do QR";
  const EMAIL_G = `gestora-qr.${MARCA}@example.com`;
  const NOME_S = "Solicitante do QR";
  const EMAIL_S = `solicitante-qr.${MARCA}@example.com`;
  const NOME_V = "Visitante do QR";
  const EMAIL_V = `visitante-qr.${MARCA}@example.com`;
  const ORG_QR = `Prédio do QR ${MARCA}`;
  const ORG_DA_S = `Outra casa da Solicitante ${MARCA}`;
  // A primeira área da semente (`Semente.ts`), que as duas organizações do teste trazem.
  const primeiraArea = "Área comum";

  const g = await (await browser.newContext()).newPage();
  const contextoDeS = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const s = await contextoDeS.newPage();
  const v = await (await browser.newContext()).newPage();
  const ninguem = await (await browser.newContext()).newPage();

  // 1 · G funda; a semente traz "Área comum" e "Unidade". Abre o QR da primeira pela tabela (111.1).
  await criarConta(g, NOME_G, EMAIL_G);
  await criarOrganizacao(g, ORG_QR);
  await g.goto("/configuracao/areas");
  await g.getByRole("link", { name: "QR da área" }).first().click();
  await g.waitForURL(/\/configuracao\/areas\/[0-9a-f-]{36}\/qr$/u);
  const areaId = g.url().split("/").at(-2)!;
  await expect(g.getByRole("img", { name: `QR da área ${primeiraArea} em ${ORG_QR}` })).toBeVisible();
  const codigo = await lerCodigoPublico(g);
  const link = `/convite/${codigo}?area=${areaId}`;

  // 2 · S cria conta, cria a própria organização e pede entrada no prédio; G aprova como Solicitante.
  await criarConta(s, NOME_S, EMAIL_S);
  await criarOrganizacao(s, ORG_DA_S);
  await s.goto(`/convite/${codigo}`);
  await s.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(s.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await g.goto("/vinculos");
  await responderOPedidoDe(g, NOME_S).click();
  const modal = g.getByRole("dialog");
  await modal.getByRole("radio", { name: /^Solicitante/u }).check();
  await modal.getByRole("button", { name: "Aprovar como Solicitante" }).click();
  await expect(g.getByRole("dialog")).toHaveCount(0);

  // 3 · S está na própria organização e lê o QR: troca, com um Set-Cookie só, e cai no registro (111.3).
  const respostaDaTroca = s.waitForResponse(
    (r) => r.url().endsWith("/api/contexto/organizacao") && r.request().method() === "PUT",
  );
  await s.goto(link);
  const troca = await respostaDaTroca;
  expect(troca.status()).toBe(200);
  const cookiesDaTroca = (await troca.headersArray()).filter(
    (h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("resolveai_organizacao="),
  );
  expect(cookiesDaTroca).toHaveLength(1);
  await s.waitForURL(new RegExp(`/ocorrencias/nova\\?area=${areaId}$`, "u"));
  await expect(s.getByText(`Em ${ORG_QR}.`)).toBeVisible();
  await expect(s.getByRole("combobox", { name: /Área/u })).toContainText(primeiraArea);

  // 4 · Já nela, lê de novo: registro direto, sem PUT (111.2). Cancelar sem escrever não pergunta nada.
  let houvePut = false;
  s.on("request", (r) => {
    if (r.url().endsWith("/api/contexto/organizacao") && r.method() === "PUT") houvePut = true;
  });
  await s.goto(link);
  await s.waitForURL(new RegExp(`/ocorrencias/nova\\?area=${areaId}$`, "u"));
  expect(houvePut).toBe(false);
  await s.getByRole("button", { name: "Cancelar" }).click();
  // Sem nada escrito, Cancelar sai direto para a lista: a espera pela URL é a prova, e a contagem do
  // diálogo confirma que ele não abriu no caminho.
  await s.waitForURL(/\/ocorrencias$/u);
  await expect(s.getByRole("alertdialog")).toHaveCount(0);

  // 5 · Sem sessão, no celular: o nome da organização, os dois botões acima de 640, sem rolar de lado
  //     (111.4, 111.9). Entrar volta sozinho ao registro com a área.
  await contextoDeS.clearCookies();
  await s.goto(link);
  await expect(s.getByRole("heading", { name: ORG_QR })).toBeVisible();
  await expect(s.getByText(primeiraArea, { exact: true })).toHaveCount(0);
  expect(await transbordo(s)).toStrictEqual(SEM_TRANSBORDO);
  for (const nome of ["Entrar", "Entrar na organização"]) {
    const caixa = await s.getByRole("link", { name: nome, exact: true }).boundingBox();
    expect((caixa?.y ?? 9999) + (caixa?.height ?? 0), nome).toBeLessThanOrEqual(640);
  }
  await s.getByRole("link", { name: "Entrar", exact: true }).click();
  await s.getByLabel("E-mail").fill(EMAIL_S);
  await s.getByLabel(/^Senha/u).fill(SENHA);
  await s.getByRole("button", { name: "Entrar" }).click();
  await s.waitForURL(new RegExp(`/ocorrencias/nova\\?area=${areaId}$`, "u"));
  await expect(s.getByRole("combobox", { name: /Área/u })).toContainText(primeiraArea);

  // 6 · Quem não participa: vai ao convite e pede; o registro não abre (111.5). E a recusa, além do desvio:
  //     abrir o registro com a área do prédio, direto, não mostra o formulário.
  await criarConta(v, NOME_V, EMAIL_V);
  await v.goto(link);
  await v.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  await v.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(v.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await v.goto(link);
  await v.waitForURL(new RegExp(`/convite/${codigo}$`, "u"));
  await v.goto(`/ocorrencias/nova?area=${areaId}`);
  await expect(v).not.toHaveURL(/\/ocorrencias\/nova/u);
  // S tem duas organizações. Na outra, a área do prédio é de fora: o registro abre sem área, com o aviso
  // de sempre, e nada diz de onde ela é (111.7, 7a e 7b).
  await trocarPeloContrato(s, ORG_DA_S);
  await s.goto(`/ocorrencias/nova?area=${areaId}`);
  await expect(s.getByText(TEXTO_DA_AREA_INDISPONIVEL)).toBeVisible();
  await expect(s.getByText(`Em ${ORG_DA_S}.`)).toBeVisible();
  await expect(s.getByText(ORG_QR)).toHaveCount(0);
  await expect(s.getByRole("combobox", { name: /Área/u })).not.toContainText(primeiraArea);

  // 7 · O código que não leva a organização, ou a área fora do formato: QR não encontrado, com saída.
  await ninguem.goto(`/convite/${codigo}?area=nao-e-uuid`);
  await expect(ninguem.getByRole("heading", { name: "QR não encontrado" })).toBeVisible();
  await expect(ninguem.getByRole("link", { name: "Ir para o início" })).toBeVisible();
  await ninguem.goto(`/convite/${CODIGO_INVENTADO}?area=${areaId}`);
  await expect(ninguem.getByRole("heading", { name: "QR não encontrado" })).toBeVisible();
  //    Desativada: G desativa a área, S lê o QR e o registro abre sem área, com o mesmo aviso.
  await desativarArea(g, primeiraArea);
  await s.goto(link);
  await s.waitForURL(new RegExp(`/ocorrencias/nova\\?area=${areaId}$`, "u"));
  await expect(s.getByText(TEXTO_DA_AREA_INDISPONIVEL)).toBeVisible();

  // 8 · S, Solicitante, é recusada no QR da área digitando o endereço (cenário "quem não configura").
  await s.goto(`/configuracao/areas/${areaId}/qr`);
  await expect(s.getByRole("img", { name: /^QR da área/u })).toHaveCount(0);
});

/** O aviso único do registro aberto por um QR cuja área não está entre as ativas (111.7a). */
const TEXTO_DA_AREA_INDISPONIVEL = "Esta área não está mais disponível. Escolha onde é.";

/**
 * Troca a organização ativa pelo `PUT /contexto/organizacao`, o mesmo que o seletor chama. **Pelo
 * contrato, e não pelo seletor**, porque este contexto está em 360 px e o seletor da barra superior muda
 * de forma no celular (item 92). A troca pela tela não é o que este teste prova.
 */
async function trocarPeloContrato(pagina: Page, nome: string): Promise<void> {
  const contexto = (await (await pagina.request.get("/api/contexto")).json()) as {
    vinculos: { organizacaoId: string; nome: string }[];
  };
  const vinculo = contexto.vinculos.find((v) => v.nome === nome);
  expect(vinculo, nome).toBeDefined();
  const resposta = await pagina.request.put("/api/contexto/organizacao", {
    data: { organizacaoId: vinculo!.organizacaoId },
  });
  expect(resposta.status()).toBe(200);
}

/** Desativa uma área pela ação de situação da linha dela, com a confirmação. */
async function desativarArea(pagina: Page, nome: string): Promise<void> {
  await pagina.goto("/configuracao/areas");
  const linha = pagina.getByRole("row").filter({ hasText: nome });
  await linha.getByRole("button", { name: "Desativar", exact: true }).click();
  await pagina.getByRole("alertdialog").getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(pagina.getByRole("alertdialog")).toHaveCount(0);
  // Pela linha, e não por `getByText("Inativa")`, que casa com a aba "Inativas" e passaria sem desativar.
  await expect(pagina.getByRole("row").filter({ hasText: nome })).toContainText("Inativa");
}

/**
 * ============================================================================
 *  O retorno: a casca guardada, e a saída que a apaga — item 98
 * ============================================================================
 *
 * **O único contexto do ponta a ponta com o trabalhador de serviço liberado** (`playwright.config.ts`
 * bloqueia por padrão). É a jornada de quem já usou a aplicação e volta a ela, e mora neste arquivo porque
 * ele já sai e volta a entrar; o teto de arquivos da ADR-0012 fica como está.
 *
 * **"Faz mais de 4 minutos" é escrito, e não esperado**: a página grava uma hora antiga no Cache Storage,
 * o que qualquer pessoa pode fazer apagando o armazenamento do site. **E a sonda da casca é segurada**
 * pela rota do contexto, senão a casca trocaria pela tela antes de o teste a ver.
 */
test("o retorno: a casca guardada pinta sem esperar a rede, o cache só tem ela, e a saída o apaga", async ({
  browser,
}) => {
  const contexto = await browser.newContext({ serviceWorkers: "allow" });
  const r = await contexto.newPage();

  await criarConta(r, NOME_R, EMAIL_R);
  await criarOrganizacao(r, ORGANIZACAO_R);
  await r.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // 1 · Percorre telas de dentro, que fazem página, RSC e API com o trabalhador no controle.
  for (const caminho of ["/ocorrencias", "/vinculos", "/configuracao", "/meus-dados"]) {
    await r.goto(caminho);
    await expect(r.getByRole("combobox", { name: /organização/iu })).toHaveText(ORGANIZACAO_R);
  }

  // 2 · Critério 98.2: igualdade de conjunto, e não "contém a casca".
  const guardado = async () =>
    r.evaluate(async () => {
      const nomes = await caches.keys();
      const urls: string[] = [];
      for (const nome of nomes) {
        for (const pedido of await (await caches.open(nome)).keys())
          urls.push(new URL(pedido.url).pathname);
      }
      return { nomes, urls: urls.sort() };
    });
  const antes = await guardado();
  expect(antes.nomes).toHaveLength(1);
  expect(antes.nomes[0]?.startsWith(PREFIXO_DO_CACHE)).toBe(true);
  expect(antes.urls).toStrictEqual([URL_DA_CASCA, URL_DA_HORA].sort());

  // 3 · Critério 98.1: com a última resposta antiga, a casca pinta sem esperar a rede, e não diz de quem é.
  let soltarASonda: () => void = () => {};
  const sondaPresa = new Promise<void>((soltar) => {
    soltarASonda = soltar;
  });
  await contexto.route("**/robots.txt", async (rota) => {
    await sondaPresa;
    await rota.continue();
  });
  await r.evaluate(
    async ({ prefixo, urlDaHora }) => {
      const nome = (await caches.keys()).find((n) => n.startsWith(prefixo));
      if (nome === undefined) throw new Error("o cache do trabalhador sumiu");
      await (await caches.open(nome)).put(urlDaHora, new Response("0"));
    },
    { prefixo: PREFIXO_DO_CACHE, urlDaHora: URL_DA_HORA },
  );
  await r.goto("/ocorrencias");
  await expect(r.getByRole("status")).toHaveText(FRASE_ABRINDO);
  await expect(r.getByText(ORGANIZACAO_R)).toHaveCount(0);

  // E troca sozinha pela tela quando a sonda responde.
  soltarASonda();
  await expect(r.getByRole("combobox", { name: /organização/iu })).toHaveText(ORGANIZACAO_R);
  await contexto.unroute("**/robots.txt");

  // 4 · Critério 98.3: a saída apaga, e o voltar não devolve nada do que se viu.
  await r.getByRole("button", { name: `Conta de ${NOME_R}` }).click();
  await r.getByRole("menuitem", { name: "Sair" }).click();
  await r.waitForURL(/\/entrar$/u);
  const depois = await guardado();
  for (const url of depois.urls) expect([URL_DA_CASCA, URL_DA_HORA]).toContain(url);

  await r.goBack();
  await r.waitForLoadState("load");
  await expect(r).toHaveURL(/\/entrar/u);
  await expect(r.getByText(ORGANIZACAO_R)).toHaveCount(0);
  await expect(r.getByText(NOME_R)).toHaveCount(0);

  await contexto.close();
});
