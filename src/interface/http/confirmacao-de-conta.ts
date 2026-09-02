import { headers } from "next/headers";

import { confirmarPorCodigo } from "@/aplicacao/credenciais";
import { montarCredenciais } from "@/composicao";

import { armazenamentoDeCookies } from "./com-contexto";

/**
 * O caminho da aterrissagem, e ele é **um literal só** deste lado.
 *
 * **Tem de continuar dizendo o mesmo que o `ROTAS` de
 * `ferramentas/verificadores/auth-publicado.mjs`**, que é quem confere a lista de permissão do provedor
 * publicado. São dois literais em duas linguagens e **nenhum verificador os compara**: renomear a rota é
 * mudar os dois arquivos. Mora ao lado do handler que a serve para que renomear um cobre renomear o outro.
 */
export const CAMINHO_DA_CONFIRMACAO = "/confirmar-conta";

/**
 * O destino que o `signUp` manda ao provedor — **item 6c, critério 1**.
 *
 * **Pura**, e é o alvo do teste do critério 4: ela **recebe** a origem em vez de descobri-la, então outra
 * origem dá outro destino — que é o que prova *"montado a partir da URL pública, e não de constante"*.
 *
 * ---------------------------------------------------------------------------
 *  Por que a origem do PEDIDO, e não uma variável de ambiente
 * ---------------------------------------------------------------------------
 *
 * A alternativa óbvia era `URL_PUBLICA` como variável de **execução** da aplicação, e ela foi recusada
 * com três razões (spec do 6c, §2):
 *
 * 1. **Acrescentaria um passo manual de produção a um lote que existe porque um passo manual não foi
 *    dado.** As variáveis de execução não passam pela esteira — entram no Container App uma vez, à mão —
 *    e nenhum portão as confere: o verificador do Auth lê o Supabase, não o Container App. Esquecer o
 *    passo produziria a omissão silenciosa do `emailRedirectTo`, que é **este** defeito.
 * 2. **O nome colidiria consigo mesmo**: `URL_PUBLICA` já é variável de *ferramenta* do verificador, e no
 *    `.env.local` de quem desenvolve os dois valores são diferentes.
 * 3. **Não provaria o que parece provar**: o valor do portão vive nas *variables* do GitHub e o da
 *    aplicação vive no Container App. São dois lugares, e o verde de um não diz nada sobre o outro.
 *
 * **Ler a URL é traduzir HTTP**, e é a camada de Interface quem o faz — a mesma frase que `portas.ts` já
 * escreve sobre `iniciarRedefinicao`. Pôr a Infraestrutura a descobrir onde a aplicação está publicada
 * seria decisão de transporte dentro do adaptador do SDK.
 *
 * **O gatilho para rever isto, nomeado:** no dia em que existir uma **segunda origem** — domínio próprio,
 * CDN, ambiente de ensaio —, a origem passa a ser valor **declarado**, e a mudança fica confinada a esta
 * função, que já a recebe de fora. **Nada do que este item constrói vira lixo nesse mundo.**
 */
export function montarDestinoDeConfirmacao(origem: string): string {
  return new URL(CAMINHO_DA_CONFIRMACAO, origem).toString();
}

/**
 * A origem do pedido, com a precedência decidida na spec §3.1. **Pura: recebe os cabeçalhos.**
 *
 * 1. **`Origin`**, quando presente e utilizável. Numa *Server Action* ele **não é valor livre**: o
 *    framework compara `Origin` com `Host`/`X-Forwarded-Host` e **recusa o pedido** antes de o nosso
 *    código rodar (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, seção *Security*).
 * 2. **`x-forwarded-proto`** (primeiro valor da lista de saltos) com **`x-forwarded-host`** ou, na falta
 *    dele, **`host`**. É o par que sobrevive ao *ingress* do Container Apps, que termina o TLS antes do
 *    container: lá dentro o esquema é `http`, e só `x-forwarded-proto` sabe que a pessoa está em `https`.
 * 3. **Lança**, nomeando o que faltou.
 *
 * **Lança, e não omite.** Omitir o `emailRedirectTo` é literalmente o defeito que este item conserta; um
 * `?? ""` aqui o reintroduziria no dia em que um cabeçalho mudasse de nome. É a doutrina do `escalar()`
 * do verificador do Auth publicado — *campo que sumiu é falha, nunca omissão silenciosa*.
 *
 * **O ramo 3 não é alcançável por um navegador**: pedido HTTP/1.1 sem `Host` é malformado. E quem a chama
 * o faz **antes** de qualquer ida ao provedor — não existe conta meio criada por causa dela.
 *
 * **Por que não `requisicao.url`.** Ela existe no handler, mas **não na ação** — e é a ação que faz o
 * `signUp`. Além disso, atrás do *ingress* o esquema de `requisicao.url` é `http`.
 */
export function origemDoPedido(cabecalhos: Headers): string {
  const origem = cabecalhos.get("origin")?.trim();
  if (origem !== undefined && utilizavel(origem)) return origem;

  const anfitriao = (cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"))?.trim();
  if (anfitriao !== undefined && anfitriao !== "") {
    // A lista pode trazer mais de um salto (`https,http`); o primeiro é o que a pessoa usou.
    const declarado = cabecalhos.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const esquema = declarado === undefined || declarado === "" ? "http" : declarado;
    return `${esquema}://${anfitriao}`;
  }

  throw new Error(
    "Não deu para descobrir a origem do pedido: nem `Origin`, nem `X-Forwarded-Host`, nem `Host`. " +
      "Sem ela o link de confirmação de conta cairia na Site URL crua — a raiz —, que é o defeito do " +
      "item 6c.",
  );
}

/**
 * `Origin: null` é a origem opaca, e `new URL("null")` lança — a falha aqui é o **sinal** de cair para o
 * ramo 2, não um erro. Aceitar só `http`/`https` também recusa esquema que o provedor descartaria.
 */
function utilizavel(origem: string): boolean {
  try {
    const url = new URL(origem);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * O destino, do pedido que está em curso. **É tudo o que fica impuro neste arquivo.**
 *
 * Quem a chama é a ação de T-11 (`src/interface/acoes/index.ts`), que é quem tem a requisição na mão.
 */
export async function destinoDeConfirmacao(): Promise<string> {
  return montarDestinoDeConfirmacao(origemDoPedido(await headers()));
}

/**
 * A aterrissagem do link do e-mail de confirmação de conta.
 *
 * **Não é tela** — é o estado que o inventário descreve como *"o estado que não é tela"*: zero campos
 * próprios, e a única ação é entrar. Ele consome o código do link, cria a sessão e devolve a pessoa a T-01
 * com a linha certa acima do formulário (protótipo, T-01, quadros 5 e 6).
 *
 * ---------------------------------------------------------------------------
 *  DORMENTE — existe, e o que a mantém dormente é UM interruptor de painel
 * ---------------------------------------------------------------------------
 *
 * **O hub fechou a Q-T9 em 22/08/2026: a confirmação de e-mail NÃO é obrigatória antes do primeiro
 * login.** Em regime, o interruptor *Confirm email* fica **desligado nos dois ambientes por decisão** —
 * não por esquecimento —, o provedor não envia e-mail de confirmação, e nada aterrissa aqui.
 *
 * **O que mudou com o item 6c, e é o motivo desta redação:** não é mais a **ausência de destino** que a
 * mantém dormente. Desde aquele item o `signUp` manda `emailRedirectTo` para cá
 * (`interface/acoes` → `aplicacao/credenciais` → `infraestrutura/clientes/autenticacao.ts`), então o
 * endereço existe e está certo. **Sobrou só o interruptor.**
 *
 * **E dormente aqui NÃO quer dizer inalcançável por construção:** um clique no painel a alcança em
 * minutos, e é exatamente para isso que a validação do 6c abre uma janela curta, de propósito. O que este
 * comentário não afirma — e não pode — é que o caminho já foi exercido em produção: isso é a coluna
 * `Val`, e é do humano, e **na hora em que esta linha foi escrita não havia acontecido**.
 *
 * **Por que ela fica.** Virar o interruptor é decisão de painel, e apagar a rota cobraria reescrevê-la no
 * mesmo dia. O item 6b precisa da mesma mecânica de aterrissagem para T-13.
 *
 * **Nota de método, e é o que este comentário existe para não repetir.** A redação anterior justificava a
 * rota citando *"a recomendação da Q-T9"* — recomendação de uma questão que estava **aberta**. Virou o
 * achado A-6a-1 da spec do item 6a. Recomendação não decide nada (convenção 6 do `CLAUDE.md`).
 *
 * **Não é `route.ts` de contrato**, então não entra no `openapi.yaml` e não tem `comContexto`: aqui não há
 * sessão a resolver ainda — é o pedido que a cria.
 */
export async function aterrissarConfirmacaoDeConta(requisicao: Request): Promise<Response> {
  const codigo = new URL(requisicao.url).searchParams.get("code");

  // **A ausência de `code` cobre DOIS casos, e o segundo não é óbvio.** O primeiro é o link truncado. O
  // segundo é o retorno de erro do próprio provedor: quando o link vence, o `/auth/v1/verify` redireciona
  // para o destino autorizado com `?error=access_denied&error_code=otp_expired&…` **e sem `code`** — foi a
  // segunda URL de 31/08/2026. Os dois caem na mesma face de recusa de T-01, que é o que o critério 3 do
  // item 6c manda reusar: *"não é tela nova"*.
  //
  // **Não "conserte" este `if` distinguindo os casos** sem reler aquele critério: separá-los é criar a
  // tela que ele proíbe.
  if (codigo === null || codigo === "") {
    return redirecionarParaEntrar(requisicao, "expirada");
  }

  const resultado = await confirmarPorCodigo(
    montarCredenciais(await armazenamentoDeCookies()),
    codigo,
  );

  return redirecionarParaEntrar(requisicao, resultado.ok ? "confirmada" : "expirada");
}

function redirecionarParaEntrar(requisicao: Request, estado: "confirmada" | "expirada"): Response {
  const destino = new URL("/entrar", requisicao.url);
  destino.searchParams.set("confirmacao", estado);
  return Response.redirect(destino, 303);
}
