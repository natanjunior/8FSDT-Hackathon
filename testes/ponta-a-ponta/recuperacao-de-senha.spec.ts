import { expect, test, type APIRequestContext } from "@playwright/test";

import { cobre } from "./cobertura";

/**
 * ============================================================================
 *  A recuperação de senha, do pedido ao e-mail e à senha nova — o item 6b
 * ============================================================================
 *
 * **O segundo arquivo de ponta a ponta, e ele nasce pela ADR-0012**: o teste cresce por **jornada** do
 * roteiro de validação, com teto de seis arquivos. Esta é a jornada do Passo 3 da Parte 2, a que o
 * roteiro chama de *"o item mais valioso da passada"* porque nenhum teste a alcançava.
 *
 * **O que mudou para ela deixar de ser só humana.** O argumento de que "nenhum teste alcança" era
 * verdadeiro contra o Supabase da nuvem, onde o e-mail sai de verdade e o token vive no relógio deles.
 * Localmente o e-mail cai na caixa de teste que `npm run local` sobe junto (`supabase start` roda sem
 * exclusões), e o template de recuperação já é o nosso — `supabase/config.toml`, bloco
 * `[auth.email.template.recovery]`. As duas metades ficam conferíveis sem tocar no painel da nuvem.
 *
 * ---------------------------------------------------------------------------
 *  O dono do mundo é este arquivo — exigência da ADR-0012
 * ---------------------------------------------------------------------------
 *
 * **Ele não usa a semente de demonstração, e não podia usar.** Redefinir a senha de Helena ou de Marcos
 * desarmaria todos os outros testes do lote, que entram com a senha conhecida. Então a conta é **própria**
 * e nasce aqui, com a marca do instante no endereço: cada execução cria uma conta a mais e **nenhuma
 * execução altera o que já existia**. A conta nasce sem vínculo nenhum, então não aparece em organização
 * alguma e não é vista por nenhum outro teste.
 *
 * `npm run semear:demo -- --apagar` não a remove — ela não é da demonstração. Quem quiser limpá-las
 * remove os usuários pelo painel do provedor local.
 *
 * ---------------------------------------------------------------------------
 *  O host é 127.0.0.1, e é o único arquivo do lote que não herda o `baseURL`
 * ---------------------------------------------------------------------------
 *
 * O link do e-mail é montado pelo provedor com a `site_url` do `supabase/config.toml`, que é
 * `http://127.0.0.1:3000`. O `playwright.config.ts` aponta para `http://localhost:3000` — e **as duas
 * origens não compartilham cookie**, embora as duas sejam loopback. Um percurso que começasse em
 * `localhost` e aterrissasse em `127.0.0.1` perderia o cookie de recuperação no meio, e o formulário de
 * senha nova nunca apareceria.
 *
 * Por isso **toda navegação deste arquivo é absoluta** e sai de `ORIGEM`. Não é descuido com o `baseURL`:
 * é o host que o provedor escolheu, escrito onde dá para ler.
 *
 * O cookie de recuperação sai com o atributo de transporte seguro (o contêiner roda em modo de produção),
 * e `127.0.0.1` é loopback — o navegador o guarda sobre `http://` porque loopback é origem confiável. É a
 * mesma razão pela qual o achado **A-10** foi corrigido trocando `host.docker.internal` por `localhost`.
 *
 * ---------------------------------------------------------------------------
 *  Este arquivo só roda na máquina de quem desenvolve
 * ---------------------------------------------------------------------------
 *
 * Ele lê a caixa de e-mail local pela rede. A esteira sobe a pilha **sem** o serviço de caixa de entrada,
 * então lá este arquivo falharia por ausência de ambiente, e não por defeito. A ADR-0012 já declara isso:
 * *"um dos seis só roda na máquina de quem desenvolve"*.
 *
 * ---------------------------------------------------------------------------
 *  O que ele NÃO prova, e cada linha tem dono
 * ---------------------------------------------------------------------------
 *
 * | O que fica de fora | Por quê |
 * |---|---|
 * | A entrega por SMTP de verdade | Em produção o envio sai por outro provedor (item 40c). A caixa local prova o template e o token, não a entrega |
 * | A expiração de 24 h do link | É relógio do provedor. A face é uma só — todo motivo de falha vira o mesmo desfecho —, e o token adulterado a exercita, que é o que o roteiro manda fazer |
 * | A confirmação de conta (6c) e o celular (6d) | A confirmação está desligada localmente, e o celular pede outro aparelho |
 * | O limite de envios | A recusa por excesso de pedidos tem frase própria na tela, e o ambiente local sobe com o limite praticamente desligado: provar a frase aqui exigiria um ambiente que este arquivo não tem |
 */

/** O host do provedor, e o do e-mail. Ver o cabeçalho. */
const ORIGEM = "http://127.0.0.1:3000";

/** A caixa de e-mail local que `supabase start` sobe — a porta é a do bloco `[inbucket]` do config. */
const CAIXA = "http://127.0.0.1:54694";

/** A marca do instante — é ela que faz a conta deste arquivo ser própria e a caixa ser só dela. */
const MARCA = new Date().toISOString().replace(/[:.]/gu, "-").toLowerCase();

const NOME = "Pessoa da Recuperação";
const EMAIL = `recuperacao.${MARCA}@example.com`;

/**
 * **O endereço que não existe, e ele também carrega a marca.** Um endereço fixo poderia virar conta de
 * verdade um dia — por engano de alguém, ou por outro teste —, e a asserção do critério 6b.1 passaria a
 * comparar duas frases de sucesso. Com a marca, ele é inexistente por construção.
 */
const EMAIL_INEXISTENTE = `ninguem.${MARCA}@example.com`;

const SENHA_ANTIGA = "ResolveAi!2026";
const SENHA_NOVA = "ResolveAi!2026-depois";

/**
 * A frase da face de sucesso de T-12. **É a mesma para conta que existe e para conta que não existe**, e
 * essa identidade é o critério 6b.1: uma tela que diferenciasse os dois casos seria um verificador de
 * quem tem conta no produto, operável por qualquer um, sem sessão.
 */
const FRASE_DO_ENVIO = "Se existe uma conta com este e-mail, o link foi enviado. Confira também o spam.";

interface ResumoDaCaixa {
  readonly messages: ReadonlyArray<{ readonly ID: string }>;
}

interface MensagemDaCaixa {
  readonly Subject: string;
  readonly HTML: string;
}

test("a recuperação de senha, do pedido ao e-mail e à senha nova, com o link adulterado recusado", async ({
  page: pagina,
}) => {
  // -------------------------------------------------------------------------
  // 1 · A conta própria nasce — T-11
  //
  // Sem vínculo nenhum, o destino depois de criar é a face A de T-02: *"Entrar em uma organização"*. É
  // ali que fica o "Sair" que este teste usa no passo seguinte.
  // -------------------------------------------------------------------------
  await pagina.goto(`${ORIGEM}/criar-conta`);
  await pagina.getByLabel("Seu nome").fill(NOME);
  await pagina.getByLabel("E-mail").fill(EMAIL);
  // **Ancorada, e não por trecho** — "Senha" por trecho casa também com o "Mostrar a senha" do botão que
  // vive dentro do campo, e o `fill` quebraria por modo estrito.
  await pagina.getByLabel(/^Senha/u).fill(SENHA_ANTIGA);
  await pagina.getByRole("button", { name: "Criar conta" }).click();

  await pagina.waitForURL(/\/organizacao$/u);
  await expect(pagina.getByRole("heading", { name: "Entrar em uma organização" })).toBeVisible();

  // -------------------------------------------------------------------------
  // 2 · Sai, e esquece a senha — o caminho de T-01 para T-12
  //
  // **Pelo botão, e não apagando cookie**: o percurso de quem esquece a senha começa deslogado, e sair
  // pela tela é o mesmo caminho que a pessoa percorre.
  // -------------------------------------------------------------------------
  await pagina.getByRole("button", { name: "Sair" }).click();
  await pagina.waitForURL(/\/entrar$/u);

  await pagina.getByRole("link", { name: "Esqueci a senha" }).click();
  await pagina.waitForURL(/\/redefinir-senha$/u);

  await pagina.getByLabel("E-mail").fill(EMAIL);
  await pagina.getByRole("button", { name: "Enviar o link" }).click();

  // A face de sucesso **substitui** o formulário, e a frase é a que o critério cobra.
  await expect(pagina.getByText("Confira o seu e-mail")).toBeVisible();
  await expect(pagina.getByText(FRASE_DO_ENVIO)).toBeVisible();
  cobre(test.info(), "2.3 · 1");

  // -------------------------------------------------------------------------
  // 3 · O mesmo pedido, com endereço que não existe — o critério 6b.1
  //
  // **A asserção é a identidade das duas frases**, e por isso as duas são conferidas contra a MESMA
  // constante. Se um dia a tela responder "este e-mail não está cadastrado", é aqui que aparece.
  // -------------------------------------------------------------------------
  await pagina.goto(`${ORIGEM}/redefinir-senha`);
  await pagina.getByLabel("E-mail").fill(EMAIL_INEXISTENTE);
  await pagina.getByRole("button", { name: "Enviar o link" }).click();

  await expect(pagina.getByText("Confira o seu e-mail")).toBeVisible();
  await expect(pagina.getByText(FRASE_DO_ENVIO)).toBeVisible();

  // **E a caixa do endereço inexistente continua vazia.** Sem esta linha, a asserção acima provaria só
  // que as duas telas dizem a mesma coisa — e não que o produto de fato não mandou nada para um
  // endereço que não tem conta.
  const paraNinguem = await buscarNaCaixa(pagina.request, EMAIL_INEXISTENTE);
  expect(paraNinguem.messages).toHaveLength(0);
  cobre(test.info(), "2.3 · 2", { criterio: "6b.1" });

  // -------------------------------------------------------------------------
  // 4 · O e-mail, e o corpo é o nosso — o passo 3 do roteiro
  //
  // **A busca é pelo endereço deste teste**, e é isso que a torna segura no mundo compartilhado: a caixa
  // é de todo mundo, e este arquivo lê só o que ele mesmo provocou. Nada é apagado.
  // -------------------------------------------------------------------------
  const mensagem = await esperarOEmail(pagina.request, EMAIL);

  expect(mensagem.Subject).toBe("Redefinir a sua senha no Resolve Aí");
  // As três frases de `supabase/templates/recuperacao.html`. Se o provedor cair no texto padrão em
  // inglês — o modo de falha que o roteiro manda conferir —, nenhuma delas está lá.
  expect(mensagem.HTML).toContain("Redefinir a sua senha");
  expect(mensagem.HTML).toContain(
    "Você pediu uma senha nova no Resolve Aí. O link abaixo vale por uma hora.",
  );
  expect(mensagem.HTML).toContain("Se não foi você quem pediu, ignore este e-mail");
  cobre(test.info(), "2.3 · 3");

  const link = enderecoDoLink(mensagem.HTML);
  // **O host do link é o da `site_url`**, e é a razão de este arquivo inteiro viver em `127.0.0.1`.
  expect(link.origin).toBe(ORIGEM);
  expect(link.searchParams.get("type")).toBe("recovery");

  const token = link.searchParams.get("token_hash") ?? "";
  expect(token).not.toBe("");

  // -------------------------------------------------------------------------
  // 5 · O link que não serve mais — o critério 6b.3
  //
  // **Um caractere trocado, e não vinte e quatro horas de espera.** O adaptador mapeia todo motivo de
  // falha para o mesmo desfecho, e a face de T-13 é uma só: *"Este link expirou"*. Esperar o relógio
  // provaria a mesma tela por um caminho que ninguém pode percorrer num teste.
  //
  // **Vem antes do link íntegro, de propósito.** O token de recuperação é de uso único: gastá-lo
  // primeiro deixaria o adulterado indistinguível de um token já consumido.
  //
  // **Sem o botão, a tela é um beco** — é por isso que ele é asserção, e não enfeite.
  // -------------------------------------------------------------------------
  const adulterado = new URL(link.toString());
  adulterado.searchParams.set("token_hash", comUmCaractereTrocado(token));

  await pagina.goto(adulterado.toString());
  await pagina.waitForURL(/\/definir-senha\?estado=expirado$/u);
  await expect(pagina.getByText("Este link expirou")).toBeVisible();
  await expect(pagina.getByText("Peça um novo.")).toBeVisible();
  await expect(pagina.getByRole("link", { name: "Pedir um novo link" })).toBeVisible();
  cobre(test.info(), "2.3 · 6", { criterio: "6b.3" });

  // -------------------------------------------------------------------------
  // 6 · O link íntegro, e o formulário que não pede a senha antiga — o critério 6b.2
  //
  // **A volta à porta antes de abrir o link não é enfeite:** ela é o que torna o passo 8 conferível. O
  // formulário de senha nova substitui a própria entrada no histórico quando termina, então o que o
  // botão voltar reencontra é **o que veio antes dele** — e o que vem antes de quem abre o link do
  // e-mail é a porta.
  // -------------------------------------------------------------------------
  await pagina.goto(`${ORIGEM}/entrar`);
  await pagina.goto(link.toString());
  await pagina.waitForURL(/\/definir-senha$/u);

  await expect(pagina.getByLabel(/^Nova senha/u)).toBeVisible();
  // **Não pede a antiga, e a asserção é dos dois lados:** nenhum campo com esse nome, e um campo só no
  // formulário inteiro. Só a primeira metade deixaria passar um segundo campo chamado de outra coisa.
  await expect(pagina.getByLabel(/senha (atual|antiga)/iu)).toHaveCount(0);
  await expect(pagina.locator("form input")).toHaveCount(1);
  cobre(test.info(), "2.3 · 4", { criterio: "6b.2" });

  // -------------------------------------------------------------------------
  // 7 · A senha nova
  // -------------------------------------------------------------------------
  await pagina.getByLabel(/^Nova senha/u).fill(SENHA_NOVA);
  await pagina.getByRole("button", { name: "Definir a senha" }).click();

  await pagina.waitForURL(/\/entrar$/u);
  // O aviso mora no layout raiz e sobrevive à navegação — é o que o guia §7 pede de um desfecho.
  await expect(pagina.getByText("Senha alterada")).toBeVisible();

  // -------------------------------------------------------------------------
  // 8 · O botão voltar não reencontra o formulário — o critério 6b.4
  //
  // **É o único endereço do produto que carrega credencial na URL**, e o que impede a credencial de ser
  // reusada são duas coisas juntas, conferidas aqui uma a uma: a entrada do histórico foi substituída,
  // e o token foi gasto. Sem a segunda, digitar o endereço à mão traria o formulário de volta.
  // -------------------------------------------------------------------------
  await pagina.goBack();
  await expect(pagina).toHaveURL(new RegExp(`^${ORIGEM}/entrar$`, "u"));
  await expect(pagina.getByLabel(/^Nova senha/u)).toHaveCount(0);

  await pagina.goto(`${ORIGEM}/definir-senha`);
  await pagina.waitForURL(/\/entrar$/u);
  cobre(test.info(), "2.3 · 5", { criterio: "6b.4" });

  // -------------------------------------------------------------------------
  // 9 · E ela entra com a senha nova
  //
  // **Sem esta asserção o percurso inteiro poderia ter gravado nada.** A tela dizer "Senha alterada" é
  // afirmação da interface; entrar com a senha nova é o provedor concordando.
  //
  // **E o erro de campo segue a regra do item 75, digitado letra a letra.** Com `fill`, o valor entra
  // num evento só, e o defeito de acusar a senha na primeira tecla do e-mail passaria sem ninguém ver.
  // -------------------------------------------------------------------------
  const senha = pagina.getByLabel(/^Senha/u);
  await pagina.getByLabel("E-mail").pressSequentially(EMAIL, { delay: 20 });
  await expect(senha).not.toHaveAttribute("aria-invalid", "true");
  await expect(pagina.getByText("Informe a senha.")).toHaveCount(0);

  // Tentar entrar com a senha vazia acende o erro e leva o foco a ela.
  await pagina.getByRole("button", { name: "Entrar" }).click();
  await expect(senha).toHaveAttribute("aria-invalid", "true");
  await expect(pagina.getByText("Informe a senha.")).toBeVisible();
  await expect(senha).toBeFocused();
  await expect(pagina).toHaveURL(new RegExp(`^${ORIGEM}/entrar$`, "u"));

  await senha.pressSequentially(SENHA_NOVA, { delay: 20 });
  await pagina.getByRole("button", { name: "Entrar" }).click();

  await pagina.waitForURL(/\/organizacao$/u);
  await expect(pagina.getByRole("heading", { name: "Entrar em uma organização" })).toBeVisible();
});

/**
 * A busca na caixa local, pelo endereço de destino. **Lê, e nunca apaga** — a caixa é mundo
 * compartilhado, e apagar mensagens alteraria o mundo de quem estiver conferindo à mão ao lado.
 */
async function buscarNaCaixa(
  requisicao: APIRequestContext,
  destinatario: string,
): Promise<ResumoDaCaixa> {
  const resposta = await requisicao.get(
    `${CAIXA}/api/v1/search?query=${encodeURIComponent(`to:${destinatario}`)}`,
  );
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as ResumoDaCaixa;
}

/**
 * Espera a mensagem chegar e devolve o corpo inteiro.
 *
 * **A espera é explícita porque o envio é assíncrono**: a tela responde a face de sucesso antes de o
 * provedor entregar a mensagem ao servidor de e-mail. Sem a espera, o teste leria a caixa vazia e
 * chamaria isso de defeito.
 */
async function esperarOEmail(
  requisicao: APIRequestContext,
  destinatario: string,
): Promise<MensagemDaCaixa> {
  await expect
    .poll(async () => (await buscarNaCaixa(requisicao, destinatario)).messages.length, {
      timeout: 30_000,
      message: `Nenhum e-mail para ${destinatario} na caixa local (${CAIXA}).`,
    })
    .toBeGreaterThan(0);

  const resumo = await buscarNaCaixa(requisicao, destinatario);
  // **Uma, e só uma.** Duas mensagens para o mesmo endereço significariam que o pedido saiu duas vezes,
  // e a asserção de identidade do critério 6b.1 dependeria de qual delas fosse lida.
  expect(resumo.messages).toHaveLength(1);

  const primeira = resumo.messages[0];
  expect(primeira).toBeDefined();

  const resposta = await requisicao.get(`${CAIXA}/api/v1/message/${primeira?.ID ?? ""}`);
  expect(resposta.status()).toBe(200);
  return (await resposta.json()) as MensagemDaCaixa;
}

/**
 * O endereço do único link do e-mail.
 *
 * **O `&` do endereço chega escapado no corpo HTML**, porque o corpo é HTML: sem desfazer o escape, o
 * segundo parâmetro viraria parte do valor do primeiro e o `type` sumiria.
 */
function enderecoDoLink(corpo: string): URL {
  const achado = /href="([^"]*\/redefinir-senha\/link[^"]*)"/u.exec(corpo);
  expect(achado, "O corpo do e-mail não traz o link de redefinição.").not.toBeNull();
  return new URL((achado?.[1] ?? "").replaceAll("&amp;", "&"));
}

/**
 * Troca o último caractere do token por outro. **É o que o roteiro manda fazer** para exercitar a face
 * do link vencido sem esperar o relógio do provedor.
 */
function comUmCaractereTrocado(token: string): string {
  const ultimo = token.slice(-1);
  return `${token.slice(0, -1)}${ultimo === "a" ? "b" : "a"}`;
}
