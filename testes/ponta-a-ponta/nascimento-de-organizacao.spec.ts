import { expect, test, type Locator, type Page } from "@playwright/test";

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

/**
 * **O código inventado do critério 7a.1, e ele é inventado por construção.**
 *
 * Passa no formato que a tela confere antes de enviar — `^[A-Z0-9]{6,12}$` — e **não pode existir**: o
 * sorteio usa `ALFABETO_DO_CODIGO`, que tira `I`, `O`, `0` e `1` justamente porque quem transcreve erra.
 * Um código só de `O` e `0` nunca sai daquele sorteio. Sem isso, a asserção de *não encontrado* estaria
 * apostando que nenhuma organização do banco local tirou aquele número.
 */
const CODIGO_INVENTADO = "OOO000";

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
 * O destino é T-03 no estado vazio, e **o critério 44o.4 manda que isso não mude**.
 */
async function criarOrganizacao(pagina: Page, nome: string): Promise<void> {
  await pagina.getByRole("link", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/organizacao\/criar$/u);
  await pagina.getByLabel("Nome da organização").fill(nome);
  await pagina.getByRole("button", { name: "Criar uma organização" }).click();
  await pagina.waitForURL(/\/ocorrencias$/u);
}

/**
 * Lê o código público em T-15 · Configuração.
 *
 * **O código é desenhado em grupos**, cada um num `span` — e os grupos são texto em linha, sem espaço no
 * documento, para que *"selecionar à mão e copiar pelo botão deem o mesmo código"*. Por isso o texto do
 * invólucro devolve o código inteiro, sem o espaço que os olhos veem.
 */
async function lerCodigoPublico(pagina: Page): Promise<string> {
  await pagina.goto("/configuracao");
  const caixa = pagina
    .locator("dd")
    .filter({ has: pagina.getByRole("button", { name: "Copiar" }) })
    .locator("span")
    .first();
  await expect(caixa).toBeVisible();
  return ((await caixa.textContent()) ?? "").trim();
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
  await a.goto("/criar-conta");
  await expect(a.getByText("No mínimo 6 caracteres.")).toBeVisible();

  await a.getByLabel("Seu nome").fill(NOME_A);
  await a.getByLabel("E-mail").fill(EMAIL_A);
  await a.getByLabel(/^Senha/u).fill(SENHA);
  await a.getByRole("button", { name: "Criar conta" }).click();
  await a.waitForURL(/\/organizacao$/u);
  await expect(a.getByRole("heading", { name: "Entrar em uma organização" })).toBeVisible();

  // **O nome digitado aparece na tela** — critério 6a.2. Na face A ele aparece já preenchido no campo do
  // pedido de entrada, que é o que a tela sabe sobre quem acabou de entrar.
  await expect(a.getByLabel("Seu nome")).toHaveValue(NOME_A);

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

  await entrar(a, EMAIL_INEXISTENTE, SENHA);
  await expect(a.getByText("E-mail ou senha incorretos.")).toBeVisible();

  await a.getByRole("link", { name: "Criar conta" }).click();
  await a.waitForURL(/\/criar-conta$/u);
  await a.getByLabel("Seu nome").fill(NOME_A);
  await a.getByLabel("E-mail").fill(EMAIL_A);
  await a.getByLabel(/^Senha/u).fill(SENHA);
  await a.getByRole("button", { name: "Criar conta" }).click();

  // A frase **e os dois caminhos** — é o que o critério 6a.4 cobra, e é o que a torna útil em vez de um
  // beco: entrar, logo abaixo, e recuperar a senha, aqui.
  await expect(a.getByText("Já existe uma conta com este e-mail. Entre em vez de criar.")).toBeVisible();
  await expect(a.getByRole("link", { name: "Esqueci a senha" })).toBeVisible();
  await expect(a.getByRole("link", { name: "Já tenho conta" })).toBeVisible();

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
  // O nome de quem entrou, agora dentro da casca — a outra metade do 6a.2.
  await expect(a.getByRole("button", { name: `Conta de ${NOME_A}` })).toBeVisible();

  const codigoDeA = await lerCodigoPublico(a);
  expect(codigoDeA).toMatch(/^[A-Z0-9]{6,12}$/u);

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

  // As duas áreas, **uma de cada tipo** — critério 3.1. A asserção é por linha, e não por célula solta:
  // *Área comum* é nome de uma e rótulo de tipo da outra, e um localizador solto pegaria as duas.
  await a.goto("/configuracao/areas");
  await expect(a.getByRole("row")).toHaveCount(3);
  await expect(a.getByRole("row").filter({ hasText: "Área comum" })).toHaveCount(1);
  const linhaPrivativa = a.getByRole("row").filter({ hasText: "Unidade privativa" });
  await expect(linhaPrivativa).toHaveCount(1);
  await expect(linhaPrivativa).toContainText("Unidade");

  // -------------------------------------------------------------------------
  // 4 · A conta de B, e o código inventado ANTES do verdadeiro — critérios 7a.1 e 7a.4
  //
  // **A ordem é obrigatória, e o roteiro a corrigiu por isso** (achado V-04): assim que existe pedido
  // pendente, T-02 troca para a face B, **que não tem campo de código**. A janela para testar código
  // inválido fecha e não reabre.
  // -------------------------------------------------------------------------
  await criarConta(b, NOME_B, EMAIL_B);

  await b.getByLabel("Código da organização").fill(CODIGO_INVENTADO);
  await b.getByRole("button", { name: "Pedir entrada" }).click();
  await expect(
    b.getByText("Nenhuma organização usa este código. Confira as letras e os números."),
  ).toBeVisible();
  // **E nada da organização vaza junto** — a recusa não diz o nome de organização nenhuma.
  await expect(b.getByText(ORGANIZACAO_A)).toHaveCount(0);

  await b.getByLabel("Código da organização").fill(codigoDeA);
  await b.getByLabel("Telefone (opcional)").fill(TELEFONE_DIGITADO);
  await b.getByRole("button", { name: "Pedir entrada" }).click();

  // A face B: o título, o nome da organização e a ausência do campo de código — critério 7a.4. A segunda
  // frase da tela **não** é afirmada aqui: é o achado V-03, e o cabeçalho diz por quê.
  await expect(b.getByRole("heading", { name: "Pedido enviado" })).toBeVisible();
  await expect(b.getByText(ORGANIZACAO_A)).toBeVisible();
  await expect(b.getByLabel("Código da organização")).toHaveCount(0);

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

  // **Nenhum papel vem marcado** — a primeira das três decisões que o PA-25 produziu.
  await expect(modalDoPedido.getByRole("radio", { checked: true })).toHaveCount(0);
  // **A consequência está escrita ao lado de cada papel**, e a de Encarregado é a que o inventário cobra
  // em destaque.
  await expect(modalDoPedido.getByText("Registra e acompanha as próprias ocorrências.")).toBeVisible();
  await expect(modalDoPedido.getByText("Não consegue fazer nada dentro do sistema.")).toBeVisible();

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

  // Do lado de B: a recusa aparece, **e o motivo não** — critério 8.3. A observação é para os Gestores.
  await b.reload();
  await expect(b.getByRole("heading", { name: "Pedido não aprovado" })).toBeVisible();
  await expect(b.getByText(MOTIVO_DA_RECUSA)).toHaveCount(0);

  // **Recusado pode ser refeito** — é a suposição S4 do modelo, e é por isso que a face C tem o campo.
  await b.getByLabel("Código da organização").fill(codigoDeA);
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
  await expect(a.getByRole("dialog")).toHaveCount(0);

  const linhaDeB = linhaDe(a, NOME_B);
  await expect(linhaDeB).toContainText("Solicitante");
  await expect(linhaDeB).not.toContainText("pedido de entrada");

  // -------------------------------------------------------------------------
  // 6 · A cadastra quem não tem conta, corrige o nome dele, e não corrige o de B
  //
  // Critérios 9a.1 e 9a.3. **A diferença que o item existe para criar:** o nome de quem tem conta vem da
  // conta, e a tela de T-08 nem oferece o campo — é a forma que o produto deu à recusa.
  // -------------------------------------------------------------------------
  await a.getByRole("link", { name: "Cadastrar pessoa sem conta" }).click();
  await a.waitForURL(/\/vinculos\/nova$/u);
  await a.getByLabel("Nome").fill(ENCARREGADO);
  await a.getByRole("radio", { name: /^Encarregado/u }).check();
  await a.getByRole("button", { name: "Cadastrar" }).click();
  await a.waitForURL(/\/vinculos$/u);

  // **Aparece na lista imediatamente** — critério 9a.1 —, com o selo de quem não tem conta.
  await expect(linhaDe(a, ENCARREGADO)).toContainText("Encarregado");
  await expect(linhaDe(a, ENCARREGADO)).toContainText("sem conta");

  await linhaDe(a, ENCARREGADO).getByRole("link", { name: "Editar participante" }).click();
  await a.waitForURL(/\/vinculos\/[0-9a-f-]+\/editar$/u);
  await a.getByLabel("Nome").fill(ENCARREGADO_CORRIGIDO);
  await a.getByRole("button", { name: "Salvar" }).click();
  await a.waitForURL(/\/vinculos$/u);
  await expect(linhaDe(a, ENCARREGADO_CORRIGIDO)).toHaveCount(1);

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

  // -------------------------------------------------------------------------
  // 7 · A segunda organização nasce, com a conta de C
  // -------------------------------------------------------------------------
  await criarConta(c, NOME_C, EMAIL_C);
  await criarOrganizacao(c, ORGANIZACAO_C);
  const codigoDeC = await lerCodigoPublico(c);
  expect(codigoDeC).toMatch(/^[A-Z0-9]{6,12}$/u);
  expect(codigoDeC).not.toBe(codigoDeA);

  // -------------------------------------------------------------------------
  // 8 · B pede entrada na segunda SEM sair da primeira — critério 7b.1
  //
  // **O caminho é o menu da conta**, e não o seletor de organização: até o item 44o ele morava lá, e o
  // 44b, que trocou o seletor por uma lista de escolha, o perdeu (critério 44o.14).
  // -------------------------------------------------------------------------
  await b.reload();
  await b.waitForURL(/\/ocorrencias$/u);
  await b.getByRole("button", { name: `Conta de ${NOME_B}` }).click();
  await b.getByRole("menuitem", { name: "Entrar em outra organização" }).click();
  await b.waitForURL(/entrar-em-outra=true$/u);

  await expect(b.getByRole("heading", { name: "Entrar em outra organização" })).toBeVisible();
  // A frase que o critério 7b.1 exige em palavras: **o vínculo na primeira não é tocado**.
  await expect(b.getByText("Pedir entrada em outra não tira você daqui.")).toBeVisible();

  await b.getByLabel("Código da organização").fill(codigoDeC);
  await b.getByRole("button", { name: "Pedir entrada" }).click();
  // A lista de pedidos é o *aqui* que a face B promete — sem ela, o pedido sumiria da vista.
  await expect(b.getByText("Aguardando a decisão de um Gestor")).toBeVisible();
  await expect(b.getByText(ORGANIZACAO_C)).toBeVisible();

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

  // **Entrar numa nova não troca sozinho** — critério 7b.2. A ativa continua sendo a primeira.
  await b.goto("/ocorrencias");
  const seletorDeB = b.getByRole("combobox", { name: /organização/iu });
  await expect(seletorDeB).toHaveText(ORGANIZACAO_A);
  await seletorDeB.click();
  await expect(b.getByRole("option", { name: ORGANIZACAO_A })).toBeVisible();
  await expect(b.getByRole("option", { name: ORGANIZACAO_C })).toBeVisible();

  // E a troca leva à outra — critério 7b.3.
  await b.getByRole("option", { name: ORGANIZACAO_C }).click();
  await b.waitForURL(/\/ocorrencias$/u);
  await expect(b.getByRole("combobox", { name: /organização/iu })).toHaveText(ORGANIZACAO_C);

  // -------------------------------------------------------------------------
  // 10 · C cadastra alguém sem conta e a remove — critério 10.4, ramo sem conta
  //
  // **A frase do ramo sem conta não é enfeite:** quem não tem conta não pode pedir entrada de novo, e o
  // cadastro que fica não é o cadastro que volta — re-cadastrar cria outra linha, e os contatos são
  // redigitados. Confirmação existe para dizer o custo do clique.
  // -------------------------------------------------------------------------
  await c.getByRole("link", { name: "Cadastrar pessoa sem conta" }).click();
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
});
