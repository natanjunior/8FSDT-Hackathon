import { cookies } from "next/headers";

import { iniciarRedefinicao } from "@/aplicacao/credenciais";
import { montarCredenciais, type ArmazenamentoDeCookies } from "@/composicao";

import { origemDoPedido } from "./confirmacao-de-conta";

/**
 * ============================================================================
 *  A sessão de recuperação — e por que ela não é a sessão do produto
 * ============================================================================
 *
 * O `verifyOtp` do link de redefinição **produz sessão válida**. Gravada nos cookies de sempre, ela seria
 * indistinguível de um login: o produto passaria a ter um segundo modo de entrar, com um endereço de
 * e-mail no lugar da senha. Ninguém decidiu isso, e S2 não pede.
 *
 * **O que este módulo faz é dar ao provedor um pote de cookies diferente.** O ponto de injeção já existe —
 * `ArmazenamentoDeCookies`, que a ADR-0005 criou para que o cliente do provedor recebesse a tradução de
 * HTTP em vez de conhecê-la. Aqui ele recebe um pote com prefixo, e `sessaoAtual()` lê o pote sem prefixo:
 * **as duas sessões coexistem sem se enxergar.**
 *
 * Consequência conferível, e é a verificação manual que fecha o item: abrir o link válido e digitar `/`
 * leva a T-01, não ao shell.
 *
 * **Não é `route.ts` de contrato:** não entra no `openapi.yaml` e não tem `comContexto` — aqui não há
 * sessão do produto a resolver, e é justamente esse o ponto.
 */

/** O prefixo é o mecanismo. Trocá-lo invalida as recuperações em curso, e nada mais. */
export const PREFIXO_DE_REDEFINICAO = "resolveai_redefinicao_";

/**
 * Quinze minutos. O token do provedor vale uma hora (`otp_expiry`), mas o que este cookie guarda é a
 * **travessia entre a aterrissagem e o formulário** — que é uma tela, não uma tarde.
 */
const VALIDADE_EM_SEGUNDOS = 15 * 60;

const OPCOES_DO_COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** Os cookies que pertencem ao fluxo de recuperação, com o prefixo removido. */
export function somenteDeRedefinicao(
  todos: ReadonlyArray<{ readonly name: string; readonly value: string }>,
): Array<{ name: string; value: string }> {
  return todos
    .filter((cookie) => cookie.name.startsWith(PREFIXO_DE_REDEFINICAO))
    .map((cookie) => ({
      name: cookie.name.slice(PREFIXO_DE_REDEFINICAO.length),
      value: cookie.value,
    }));
}

/**
 * O pote paralelo.
 *
 * **A tela de T-13 só chama `emCurso()`**, que lê. Escrever cookie em Server Component em renderização não
 * é possível, e por isso `definir` e `limpar` só são chamados da rota de aterrissagem e da ação.
 */
export async function armazenamentoDeRedefinicao(): Promise<
  ArmazenamentoDeCookies & { emCurso(): boolean; limpar(): void }
> {
  const pote = await cookies();

  const todosOsBrutos = () => pote.getAll().map((c) => ({ name: c.name, value: c.value }));

  return {
    todos: () => somenteDeRedefinicao(todosOsBrutos()),

    definir: (aDefinir) => {
      for (const cookie of aDefinir) {
        pote.set(`${PREFIXO_DE_REDEFINICAO}${cookie.name}`, cookie.value, {
          ...OPCOES_DO_COOKIE,
          // Valor vazio é como o SDK apaga um cookie. Repassamos o apagamento em vez de guardar vazio.
          maxAge: cookie.value === "" ? 0 : VALIDADE_EM_SEGUNDOS,
        });
      }
    },

    emCurso: () =>
      todosOsBrutos().some(
        (cookie) => cookie.name.startsWith(PREFIXO_DE_REDEFINICAO) && cookie.value !== "",
      ),

    limpar: () => {
      for (const cookie of todosOsBrutos()) {
        if (cookie.name.startsWith(PREFIXO_DE_REDEFINICAO)) {
          pote.set(cookie.name, "", { ...OPCOES_DO_COOKIE, maxAge: 0 });
        }
      }
    },
  };
}

/**
 * A aterrissagem do link do e-mail — o endereço que `supabase/templates/recuperacao.html` aponta.
 *
 * **Valida o link aqui, e não no envio do formulário.** É o que faz o link vencido aparecer **antes** de a
 * pessoa escolher uma senha (critério 3), e o token de recuperação é de uso único: validá-lo depois
 * custaria não poder validá-lo agora.
 */
export async function aterrissarRedefinicaoDeSenha(requisicao: Request): Promise<Response> {
  const parametros = new URL(requisicao.url).searchParams;
  const tokenHash = parametros.get("token_hash");

  if (tokenHash === null || tokenHash === "" || parametros.get("type") !== "recovery") {
    return paraDefinirSenha(requisicao, "expirado");
  }

  const resultado = await iniciarRedefinicao(
    montarCredenciais(await armazenamentoDeRedefinicao()),
    tokenHash,
  );

  return paraDefinirSenha(requisicao, resultado.ok ? null : "expirado");
}

/**
 * O redirecionamento é o que tira a credencial da barra de endereços: o formulário vive num endereço
 * limpo, e é isso que faz o critério 4 ser verdade sem depender de disciplina de ninguém.
 *
 * **A origem sai dos cabeçalhos, nunca de `requisicao.url`.** Dentro do container o servidor do Next
 * escuta em `HOSTNAME=0.0.0.0`, e era isso que `requisicao.url` carregava — o `Location` saía como
 * `http://0.0.0.0:3000/definir-senha`, endereço que significa *"todas as interfaces"* e para o qual
 * navegador nenhum consegue ir. **Trocar o host na barra de endereços não resolvia**, porque o valor nunca
 * veio de lá: veio de onde o processo escuta.
 *
 * *(Corrigido em 09/09/2026 — achado V-06, e foi ele que travou a validação do Passo 3: o link do e-mail
 * de recuperação aterrissava em "página inacessível". O mecanismo certo já existia desde o item 6c,
 * `origemDoPedido`, e nunca tinha sido aplicado aqui — este arquivo é do item 6b, anterior a ele.)*
 */
function paraDefinirSenha(requisicao: Request, estado: "expirado" | null): Response {
  const destino = new URL("/definir-senha", origemDoPedido(requisicao.headers));
  if (estado !== null) destino.searchParams.set("estado", estado);
  return Response.redirect(destino, 303);
}
