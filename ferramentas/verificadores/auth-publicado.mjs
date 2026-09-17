import { readFileSync } from "node:fs";
import { join } from "node:path";

import { relatar, RAIZ } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador do Auth publicado — o que a nuvem tem contra o que o repositório diz
 * ============================================================================
 *
 * **O bloco `[auth]` do `supabase/config.toml` governa APENAS a pilha local.**
 * Quem o lê é a CLI, que monta a máquina de quem rodou `supabase start`. O
 * projeto hospedado nunca o leu, e nada neste repositório o publica: a esteira
 * (`.github/workflows/entrega.yml`) roda `supabase link` + `supabase db push`,
 * que são **migrações e só**. Não existe `supabase config push` em lugar
 * nenhum daqui.
 *
 * Consequência, e ela apareceu no navegador em 31/08/2026, na primeira
 * tentativa de percorrer o produto em produção:
 *
 *     http://localhost:3000/?code=94c22bda-…
 *     http://localhost:3000/?error=access_denied&error_code=otp_expired&…
 *
 * `http://localhost:3000` é a *Site URL* **padrão de fábrica** do Supabase. O
 * `site_url` do `config.toml` era verdade local e ficção em produção, e nada
 * dizia isso em voz alta. **Este arquivo é a única coisa que confere a
 * diferença.**
 *
 * ---------------------------------------------------------------------------
 *  Ele LÊ e não escreve — e a recusa é ativa
 * ---------------------------------------------------------------------------
 *
 * Só `GET /v1/projects/{ref}/config/auth`. Nenhum `PATCH`, nenhum `POST`. A
 * alternativa — `supabase config push` na esteira — foi recusada com
 * argumento, e o principal é medido: a CLI 2.101.0 tem **uma só** flag,
 * `--project-ref`. Não há `--only auth`. Empurrar publicaria o `config.toml`
 * **inteiro**, e este arquivo declara portas locais (`[api] port = 54391`,
 * `[db] port = 54392`), `major_version`, `[storage]`, `[inbucket]`,
 * `[studio]` — vinte e tantas afirmações sobre **a máquina de quem
 * desenvolve**. E `config push` não falha na divergência: ele a **apaga**.
 * Vermelho é informação; sobrescrever não é.
 *
 * ---------------------------------------------------------------------------
 *  Dois campos TÊM de divergir; dois TÊM de ser idênticos
 * ---------------------------------------------------------------------------
 *
 * | Campo | Diverge? | Por quê |
 * |---|---|---|
 * | `site_url` | **sim, por necessidade** | sem apontar para a máquina, `npm run local` não entra em conta nenhuma |
 * | `additional_redirect_urls` | **sim, por necessidade** | idem |
 * | `enable_confirmations` | **não** | é a decisão de produto Q-T9, e divergir em silêncio foi o que fez o item 6a fechar sem que a confirmação de e-mail fosse exercida |
 * | template de recuperação | **não** | ele já é agnóstico de ambiente: monta o link com `{{ .SiteURL }}`, não com um host literal |
 *
 * Por isso os dois primeiros **não** são comparados contra o `config.toml`:
 * são comparados contra `URL_PUBLICA`, que é o que produção tem de ter.
 *
 * ---------------------------------------------------------------------------
 *  A polaridade de `mailer_autoconfirm` — LEIA ANTES DE "CONSERTAR"
 * ---------------------------------------------------------------------------
 *
 *     mailer_autoconfirm === !enable_confirmations
 *
 * *Autoconfirm ligado* significa *confirmação de e-mail desligada*. Três
 * fontes, conferidas sem tocar a API:
 *
 * 1. `supabase/auth` (GoTrue), `README.md` — a implementação: *"If you do not
 *    require email confirmation, you may set this to `true`. Defaults to
 *    `false`."*
 * 2. `supabase/auth`, `internal/api/signup.go` — o código:
 *    `if config.Mailer.Autoconfirm { … user.Confirm(tx) }`. Com `true`, o
 *    usuário é confirmado na hora e o e-mail **não sai**.
 * 3. Supabase Docs, *Auth Self-hosting Config* — **diz o contrário**, e está
 *    errada: a frase que ela atribui a `GOTRUE_MAILER_AUTOCONFIRM` é,
 *    caractere por caractere, o comentário do `config.toml:239`, que descreve
 *    `enable_confirmations` — o campo de polaridade invertida. É rótulo colado
 *    no campo errado.
 *
 * **A terceira é o primeiro resultado de busca.** Quem duvidar da comparação
 * vai achá-la e vai "consertar" a polaridade — e no dia seguinte o portão fica
 * **verde** com a produção **exigindo** confirmação, que é o bug inteiro de
 * volta, agora com um verificador atestando que está tudo bem. Um verificador
 * que afirma o contrário do que confere é pior que nenhum. **O controle
 * negativo abaixo não protege contra isto** — ele estraga o campo e vê a
 * conferência disparar, o que acontece com a polaridade certa ou trocada. Só
 * este comentário protege.
 *
 * ---------------------------------------------------------------------------
 *  Por que a leitura do TOML é escopada por seção
 * ---------------------------------------------------------------------------
 *
 * `enable_confirmations` aparece **duas vezes** no `config.toml`:
 *
 *     240:  enable_confirmations = false     ← [auth.email]  · o certo
 *     283:  enable_confirmations = false     ← [auth.sms]    · o errado
 *
 * Uma regex multilinha ingênua casaria a primeira — que hoje é a certa **por
 * posição, não por identidade**. Se a CLI reordenar as seções numa versão
 * futura, o portão passaria a comparar o Auth de e-mail de produção contra a
 * configuração de **SMS**, e ficaria verde afirmando o contrário do que
 * confere. É exatamente a classe de falha que este arquivo existe para matar.
 *
 * ---------------------------------------------------------------------------
 *  Onde ele roda, e o que cada saída quer dizer
 * ---------------------------------------------------------------------------
 *
 * `npm run verificar:auth`. **Fora do `npm run verificar`**, porque exige
 * credencial e rede e o `verificar` tem de passar num clone limpo — mesmo
 * tratamento do `verificar:imagem`, que exige Docker.
 *
 *     0  tudo bate
 *     1  a configuração publicada DIVERGE da declarada (ou o verificador está quebrado)
 *     2  não há credencial para olhar
 *     3  não deu para falar com a API
 *
 * Na esteira roda em dois lugares: um emprego próprio no `entrega.yml`, do
 * qual `migrar` depende, e um emprego próprio no cron de sexta — porque
 * **deriva de configuração não nasce de commit**: alguém clica no painel numa
 * terça e nada no repositório muda.
 */

// ---------------------------------------------------------------------------
// O que o repositório declara
// ---------------------------------------------------------------------------

/** As rotas do produto que o provedor pode usar como destino. Do produto, não do ambiente. */
const ROTAS = ["/confirmar-conta"];

const API = "https://api.supabase.com/v1/projects";

/**
 * A válvula do critério 3 — divergência **nomeada**, nunca silenciosa.
 *
 * Um campo listado aqui não falha: ele imprime, em TODA execução, o campo, a razão e a data. É o que
 * transforma *"os dois ambientes divergem em silêncio"* — que é o defeito do item 6a — em premissa
 * nomeada. É também o único jeito de destravar o portão sem apagá-lo: a razão aparece no diff, num PR, e
 * não numa tela de painel que ninguém revisa.
 *
 * **Vazia de novo desde 17/09/2026, e é o estado certo.** Ela teve duas entradas entre 13 e 17/09, as
 * duas pela mesma causa: sem SMTP próprio, o Supabase não deixava colar o nosso template de recuperação, e
 * as conferências `D` e `E` acusavam o de fábrica. O item `40c` configurou o SMTP pelo Azure
 * Communication Services, o template foi colado, e o dono conferiu em produção que o e-mail chega em
 * português e que o link abre a tela de definir senha nova. As duas entradas saíram, e o portão voltou a
 * ser duro nos cinco campos.
 *
 * **O que NÃO se declara aqui.** A válvula é para divergência que não pode ser resolvida hoje e tem dono
 * escrito. Campo que diverge por descuido se conserta no painel; campo que diverge por decisão vira
 * entrada com a decisão na razão. Uma entrada sem item nem decisão é o portão sendo desligado devagar.
 */
const DIVERGENCIAS = {
  // mailer_autoconfirm: { razao: "…", data: "AAAA-MM-DD" },
};

/**
 * Recorta uma seção do TOML: do cabeçalho `[nome]` até o próximo `[` em começo de linha.
 *
 * **É por isto que não basta uma regex multilinha** — ver a nota sobre `enable_confirmations` no
 * cabeçalho. Linha comentada não abre seção: o `#` vem antes do `[`, e a âncora exige o colchete no
 * começo da linha.
 */
export function secaoDoToml(toml, nome) {
  const abertura = new RegExp(`^\\[${nome.replaceAll(".", "\\.")}\\]\\s*$`, "mu").exec(toml);
  if (abertura === null) throw new Error(`config.toml não tem a seção [${nome}].`);

  const daAbertura = toml.slice(abertura.index + abertura[0].length);
  const proxima = /^\[/mu.exec(daAbertura);
  return proxima === null ? daAbertura : daAbertura.slice(0, proxima.index);
}

/**
 * Um escalar dentro de uma seção já recortada. **Lança** quando não acha.
 *
 * Mesma doutrina do `ambiente-local.mjs:301-302` — *"a CLI já os mudou antes"*. Campo que sumiu é falha,
 * nunca omissão silenciosa: um `?? ""` aqui viraria *"os dois ambientes concordam em nada"*.
 */
export function escalar(secao, campo, onde) {
  const achado = new RegExp(`^\\s*${campo}\\s*=\\s*(.+?)\\s*$`, "mu").exec(secao);
  if (achado === null) throw new Error(`config.toml: campo \`${campo}\` não encontrado em ${onde}.`);
  return achado[1].replace(/^"|"$/gu, "");
}

/** Sem barra final: o painel aceita as duas formas, e a igualdade exata puniria a diferença errada. */
const semBarraFinal = (url) => url.replace(/\/+$/u, "");

/**
 * O esperado — cinco valores, cada um com a sua origem.
 *
 * `urlPublica` sai do ambiente e pode vir vazia aqui: quem cobra a ausência é o passo 3 do `main`, com
 * `::error::` e saída 2. Os outros quatro saem do repositório, e **lançam** se o arquivo tiver mudado de
 * forma.
 */
export function declarado() {
  const toml = readFileSync(join(RAIZ, "supabase", "config.toml"), "utf8");

  const email = secaoDoToml(toml, "auth.email");
  const recuperacao = secaoDoToml(toml, "auth.email.template.recovery");

  // Ler o caminho do TOML, em vez de fixar `supabase/templates/recuperacao.html`, é o que faz o
  // verificador seguir o arquivo se ele for renomeado.
  const caminhoDoCorpo = escalar(recuperacao, "content_path", "[auth.email.template.recovery]");

  return {
    urlPublica: semBarraFinal(process.env.URL_PUBLICA ?? ""),
    rotas: ROTAS,
    confirmacoesLigadas: escalar(email, "enable_confirmations", "[auth.email]") === "true",
    assuntoRecuperacao: escalar(recuperacao, "subject", "[auth.email.template.recovery]"),
    corpoRecuperacao: readFileSync(join(RAIZ, caminhoDoCorpo), "utf8"),
  };
}

// ---------------------------------------------------------------------------
// A comparação — pura, e é ela que os controles exercitam
// ---------------------------------------------------------------------------

/**
 * `uri_allow_list` chega como CADEIA separada por vírgula na Management API, e como lista no GoTrue
 * (`URIAllowList []string`, alimentada por variável de ambiente separada por vírgula). As duas fontes
 * discordam da forma, então normalizo as duas — e **recuso a terceira**, em vez de coagir.
 *
 * Coerção silenciosa aqui é perigosa de um jeito específico: `[]` passa na conferência de *"não contém
 * localhost"* sem conter coisa nenhuma. Uma lista de permissão vazia recebida como `null` viraria verde.
 */
export function listaDePermissao(valor) {
  if (typeof valor === "string") return valor.split(",").map((u) => u.trim()).filter((u) => u !== "");
  if (Array.isArray(valor)) return valor.map((u) => String(u).trim()).filter((u) => u !== "");
  throw new Error(`uri_allow_list veio como \`${valor === null ? "null" : typeof valor}\` — nem cadeia nem lista.`);
}

/**
 * O painel reescreve o HTML colado — indentação, quebras de linha. Comparar byte a byte produziria
 * vermelho permanente, e vermelho permanente é verde: ninguém olha.
 *
 * **O custo, declarado:** uma diferença que seja **só** de espaço dentro de um texto passa despercebida.
 * É o único tipo de divergência que não muda o que a pessoa lê. Texto visível e atributos entram inteiros
 * na comparação.
 */
const semEspacoDemais = (html) => html.replaceAll(/>\s+</gu, "><").replaceAll(/\s+/gu, " ").trim();

const vazio = (valor) => typeof valor !== "string" || valor.trim() === "";

/**
 * As cinco conferências. **Pura:** recebe dois objetos, devolve a lista de falhas. Não lê ambiente, não lê
 * arquivo, não faz rede — é o que permite os controles rodarem antes de qualquer credencial existir.
 *
 * `notas` é um acumulador de saída, e existe por causa da válvula: divergência **declarada** não falha,
 * mas tampouco some — ela sai como nota em toda execução. Passar o acumulador mantém a função
 * determinística (as mesmas entradas dão as mesmas falhas) sem perder a linha que a válvula tem de
 * imprimir.
 *
 * `divergencias` é parâmetro, e não a constante lida de dentro, por causa dos controles. Eles provam que
 * a **comparação** discrimina; declarar uma divergência é decisão de **política**, e uma coisa não pode
 * calar a outra. Com a leitura de dentro, declarar `D` e `E` fazia as duas pararem de disparar contra o
 * controle negativo, e o verificador se acusava de estar quebrado — que foi o que aconteceu em
 * 13/09/2026, na primeira vez que a válvula saiu do vazio. Os controles passam `{}`; a execução real
 * passa o que está declarado.
 */
export function comparar(publicado, esperado, notas = [], divergencias = DIVERGENCIAS) {
  const falhas = [];

  /** A válvula: campo declarado vira nota, não falha. Ver o bloco lá em cima. */
  const acusar = (campo, falha) => {
    const declarada = divergencias[campo];
    if (declarada === undefined) falhas.push(falha);
    else notas.push(`DIVERGÊNCIA DECLARADA · ${campo} · ${declarada.razao} · ${declarada.data}`);
  };

  // --- A · a Site URL ------------------------------------------------------
  if (vazio(publicado.site_url)) {
    acusar("site_url", "A · `site_url` veio vazia ou ausente da API — não há Site URL configurada.");
  } else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/u.test(publicado.site_url)) {
    acusar(
      "site_url",
      `A · a Site URL da nuvem é \`${publicado.site_url}\` — o **padrão de fábrica**, e a origem literal ` +
        `das duas URLs de 31/08/2026. Esperada: \`${esperado.urlPublica}\`.`,
    );
  } else if (semBarraFinal(publicado.site_url) !== esperado.urlPublica) {
    acusar(
      "site_url",
      `A · Site URL publicada \`${publicado.site_url}\`, esperada \`${esperado.urlPublica}\`.`,
    );
  }

  // --- B · a lista de permissão de redirecionamento ------------------------
  let lista = null;
  try {
    lista = listaDePermissao(publicado.uri_allow_list);
  } catch (erro) {
    // Forma inesperada **não** passa pela válvula: isto é erro de forma da resposta, não divergência
    // entre ambientes, e nenhuma razão escrita torna aceitável não saber o que a lista contém.
    falhas.push(`B · ${erro.message}`);
  }

  if (lista !== null) {
    for (const rota of esperado.rotas) {
      const alvo = `${esperado.urlPublica}${rota}`;
      if (!lista.includes(alvo)) {
        acusar("uri_allow_list", `B · a lista de permissão não contém \`${alvo}\`.`);
      }
    }

    // **Não é higiene.** Entrada de `localhost` numa lista de redirecionamento de produção é superfície de
    // redirecionamento aberto, operável por qualquer aplicação na máquina de quem clica no link. E é
    // também o que impede a lista de fábrica de passar por acidente.
    for (const url of lista.filter((u) => /localhost|127\.0\.0\.1/u.test(u))) {
      acusar("uri_allow_list", `B · a lista de permissão de PRODUÇÃO contém \`${url}\`.`);
    }
  }

  // --- C · a confirmação de e-mail — o critério 3, mecânico ----------------
  // `mailer_autoconfirm === !enable_confirmations`. A polaridade está argumentada no cabeçalho, com as
  // três fontes. **Não a inverta sem ler aquilo.**
  if (typeof publicado.mailer_autoconfirm !== "boolean") {
    acusar(
      "mailer_autoconfirm",
      `C · \`mailer_autoconfirm\` veio como \`${JSON.stringify(publicado.mailer_autoconfirm)}\`, e não ` +
        `como booleano — sem ele não dá para afirmar nada sobre a confirmação de e-mail.`,
    );
  } else if (publicado.mailer_autoconfirm !== !esperado.confirmacoesLigadas) {
    acusar(
      "mailer_autoconfirm",
      `C · a confirmação de e-mail está **${publicado.mailer_autoconfirm ? "desligada" : "ligada"}** na ` +
        `nuvem e **${esperado.confirmacoesLigadas ? "ligada" : "desligada"}** no \`config.toml\`. ` +
        `Divergir aqui em silêncio é o que fez o item 6a fechar sem que a confirmação fosse exercida.`,
    );
  }

  // --- D · o assunto do e-mail de recuperação ------------------------------
  if (vazio(publicado.mailer_subjects_recovery)) {
    acusar(
      "mailer_subjects_recovery",
      "D · o assunto do e-mail de recuperação veio vazio — a nuvem está com o assunto de fábrica.",
    );
  } else if (publicado.mailer_subjects_recovery !== esperado.assuntoRecuperacao) {
    acusar(
      "mailer_subjects_recovery",
      `D · assunto publicado \`${publicado.mailer_subjects_recovery}\`, esperado ` +
        `\`${esperado.assuntoRecuperacao}\`.`,
    );
  }

  // --- E · o corpo do e-mail de recuperação --------------------------------
  if (vazio(publicado.mailer_templates_recovery_content)) {
    acusar(
      "mailer_templates_recovery_content",
      "E · **a nuvem está com o template de recuperação de fábrica.** O de fábrica usa " +
        "`{{ .ConfirmationURL }}`: o provedor consome o token no servidor dele e redireciona para a Site " +
        "URL — que é a assinatura do `?error=…otp_expired` de 31/08/2026. O nosso usa `{{ .TokenHash }}` " +
        "e é o que faz o link funcionar em outro aparelho.",
    );
  } else if (
    semEspacoDemais(publicado.mailer_templates_recovery_content) !== semEspacoDemais(esperado.corpoRecuperacao)
  ) {
    acusar(
      "mailer_templates_recovery_content",
      "E · o corpo do e-mail de recuperação publicado não é o de `supabase/templates/recuperacao.html` " +
        "(comparação com espaço em branco normalizado).",
    );
  }

  return falhas;
}

// ---------------------------------------------------------------------------
// Os controles embutidos — a única prova que este arquivo tem
//
// `ferramentas/**` está fora do `tsconfig.json` e do `eslint.config.mjs`, e
// este verificador não tem teste em `testes/`. O Definition of Done já
// autoriza a troca — *"os verificadores do repositório … **com controle
// negativo** — um verificador que aceita tudo é indistinguível de um que
// funciona"* (`definition-of-done.md:216`) — e cobra a contrapartida: **os
// controles SÃO o teste.**
//
// Eles rodam ANTES da rede, e a ordem é deliberada: num clone sem credencial
// nenhuma, quem roda o comando ainda vê a prova de que a comparação
// discrimina — e a falha por credencial ausente fica distinguível da falha por
// divergência, que é a coisa que este arquivo existe para dizer.
//
// O domínio `.invalid` é reservado por RFC 2606 e não resolve: nada aqui pode
// virar requisição por acidente.
// ---------------------------------------------------------------------------

const ESPERADO_DO_CONTROLE = {
  urlPublica: "https://controle.invalid",
  rotas: ["/confirmar-conta"],
  confirmacoesLigadas: false,
  // Com quebra de linha e indentação de propósito: o controle positivo também exercita a normalização
  // de espaço em branco de E, que é a única tolerância da comparação inteira.
  corpoRecuperacao: "<p>corpo\n  do controle</p>",
  assuntoRecuperacao: "Assunto do controle",
};

const PUBLICADO_QUE_CASA = {
  site_url: "https://controle.invalid",
  uri_allow_list: "https://controle.invalid/confirmar-conta",
  mailer_autoconfirm: true,
  mailer_subjects_recovery: "Assunto do controle",
  mailer_templates_recovery_content: "<p>corpo do controle</p>",
};

/**
 * Um estrago por conferência. **A letra é o contrato:** não basta *"alguma falha apareceu"* — cada
 * conferência tem de disparar a sua, senão ela pode estar passando em silêncio. É o que o `imagem.mjs`
 * já escreveu com as quatro dele.
 *
 * B aparece duas vezes porque são **duas metades**: a rota que tem de estar, e o `localhost` que não pode
 * estar. Uma passando e a outra não seria invisível com um caso só.
 *
 * **Limitação declarada, e ela importa:** o estrago de C é `mailer_autoconfirm: false`. Se a polaridade
 * estiver invertida no código, este controle dispara **do mesmo jeito** — ele prova que a conferência C
 * reage, não que ela reage no sentido certo. Contra polaridade trocada só protege o bloco de três fontes
 * no cabeçalho. Leia-o antes de mexer em C.
 */
const ESTRAGOS = [
  ["A", { site_url: "http://localhost:3000" }],
  ["B", { uri_allow_list: "https://controle.invalid/confirmar-conta,http://localhost:3000" }],
  ["B", { uri_allow_list: "https://controle.invalid/outra-rota" }],
  ["C", { mailer_autoconfirm: false }],
  ["D", { mailer_subjects_recovery: "Reset Your Password" }],
  ["E", { mailer_templates_recovery_content: "" }],
];

/** Devolve as falhas dos controles. Vazia quer dizer que a comparação discrimina. */
function conferirOsControles() {
  const falhas = [];

  const doPositivo = comparar(PUBLICADO_QUE_CASA, ESPERADO_DO_CONTROLE, [], {});
  if (doPositivo.length > 0) {
    // Um verificador que recusa tudo é tão inútil quanto um que aceita tudo, com o agravante de ensinar a
    // ignorá-lo.
    falhas.push(
      `CONTROLE POSITIVO RECUSADO — uma configuração que casa deveria passar e não passou: ` +
        `${doPositivo.join(" | ")}`,
    );
  }

  const dispararam = new Set();
  for (const [letra, estrago] of ESTRAGOS) {
    const doNegativo = comparar({ ...PUBLICADO_QUE_CASA, ...estrago }, ESPERADO_DO_CONTROLE, [], {});
    if (doNegativo.some((falha) => falha.startsWith(`${letra} ·`))) dispararam.add(letra);
  }

  const mudas = ["A", "B", "C", "D", "E"].filter((letra) => !dispararam.has(letra));
  if (mudas.length > 0) {
    falhas.push(
      `CONTROLE INCOMPLETO — a(s) conferência(s) ${mudas.join(", ")} não disparou/dispararam contra o ` +
        `controle negativo. Conferência que não dispara contra o controle é conferência que pode estar ` +
        `passando em silêncio.`,
    );
  }

  return falhas;
}

// ---------------------------------------------------------------------------
// A rede — e é só leitura
// ---------------------------------------------------------------------------

/**
 * `GET /v1/projects/{ref}/config/auth`, escopo `auth:read`.
 *
 * **Nenhum `PATCH`, nenhum `POST`, em lugar nenhum deste arquivo.** A escrita pela API de management foi
 * recusada com argumento: deixaria no repositório um escritor do Auth de produção a um `node` de
 * distância — de um acidente, ou de alguém o pendurar na esteira depois.
 *
 * **O `ref` e o token nunca entram numa mensagem.** Os dois são segredos do repositório; o GitHub mascara
 * o que ele conhece, mas a execução na máquina de quem desenvolve não mascara nada.
 */
async function publicado(ref, token) {
  const resposta = await fetch(`${API}/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!resposta.ok) throw new Error(`GET /v1/projects/{ref}/config/auth respondeu ${resposta.status}.`);
  return resposta.json();
}

// ---------------------------------------------------------------------------
// A ordem do main É o desenho
//
//   1. controles embutidos           → falha ⇒ exit 1 (é falha do verificador, e é a pior)
//   2. declarado(), lê o config.toml → falha ⇒ exit 1 (campo sumiu)
//   3. as três variáveis de ambiente → ausente ⇒ ::error:: + exit 2
//   4. publicado(), a rede           → falha ⇒ ::error:: + exit 3
//   5. comparar() + relatar()        → exit 0 ou 1
//
// Três códigos, e cada um responde uma pergunta diferente: **1** a configuração
// publicada diverge (ou o verificador está quebrado) · **2** não há credencial
// para olhar · **3** não deu para falar com a API. Um verde sem rede seria
// exatamente o *"verificador que aceita tudo"*; um vermelho sem explicação
// ensinaria a ignorá-lo.
// ---------------------------------------------------------------------------

const notas = [];

// --- 1 · os controles, e eles imprimem SOZINHOS ----------------------------
// Não vão por `relatar`: ele é o passo 5, e a saída 2 acontece no passo 3.
// Passando por ele, um clone limpo sairia 2 em silêncio — e a prova de que a
// comparação discrimina tem de existir em TODA saída, que é o ponto inteiro de
// os controles rodarem antes da rede. As mesmas linhas entram em `notas` para
// reaparecerem no relatório final quando a execução chega ao fim.
const dosControles = conferirOsControles();

if (dosControles.length > 0) {
  console.error("✗ Auth publicado: os controles embutidos falharam — o verificador não está verificando.\n");
  for (const falha of dosControles) console.error(`   ${falha}`);
  process.exit(1);
}

for (const linha of [
  "controle positivo aceito como deve — a comparação não recusa tudo.",
  "as cinco conferências dispararam contra o controle negativo.",
]) {
  console.log(`   · ${linha}`);
  notas.push(linha);
}

// --- 2 · o que o repositório declara ---------------------------------------
let esperado;
try {
  esperado = declarado();
} catch (erro) {
  console.error(`\n✗ Auth publicado: não deu para ler o que o repositório declara.\n   ${erro.message}`);
  process.exit(1);
}

// --- 3 · a credencial ------------------------------------------------------
const ausentes = ["URL_PUBLICA", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"].filter(
  (nome) => (process.env[nome] ?? "").trim() === "",
);

if (ausentes.length > 0) {
  console.error(
    `::error::${ausentes.join(", ")} não está/estão cadastrada(s). Sem ela(s) este verificador não olha ` +
      `para nada, e a configuração de Auth da nuvem segue sem ninguém conferindo.`,
  );
  console.error(
    "   Na esteira: Settings → Secrets and variables → Actions (`URL_PUBLICA` é *variable*, as outras duas " +
      "são *secret*).\n   Na sua máquina: ponha as três no `.env.local` — ver `.env.example`.",
  );
  process.exit(2);
}

// --- 4 · a configuração publicada ------------------------------------------
let daNuvem;
try {
  daNuvem = await publicado(process.env.SUPABASE_PROJECT_REF, process.env.SUPABASE_ACCESS_TOKEN);
} catch (erro) {
  console.error(
    `::error::Não deu para ler a configuração publicada: ${erro.message} Isto **não** é divergência — é ` +
      `a API de management fora de alcance, token sem o escopo \`auth:read\`, ou projeto errado.`,
  );
  process.exit(3);
}

// --- 5 · a comparação ------------------------------------------------------
const falhas = comparar(daNuvem, esperado, notas);

notas.push(
  "limite declarado: o corpo do e-mail é comparado com espaço em branco normalizado — o painel reescreve " +
    "a indentação do HTML colado, e byte a byte seria vermelho permanente.",
);

process.exit(relatar("Auth publicado", { conferidos: 5, unidade: "campo", falhas, notas }));
