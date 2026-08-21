import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PortaDeAutenticacao, SessaoDoProvedor } from "@/aplicacao/contexto";
import type {
  PortaDeCredenciais,
  RecusaDeCredencial,
  ResultadoDeCredencial,
} from "@/aplicacao/credenciais";

/**
 * ============================================================================
 *  O cliente do provedor de autenticação. **Único lugar, junto com
 *  `banco.ts`, autorizado a importar um SDK** (ADR-0006, regra de lint 1).
 * ============================================================================
 *
 * Implementa as duas portas que a Aplicação declarou:
 *
 * - `PortaDeAutenticacao` — a metade que o ponto único de contexto consome. É **o ACL**: o que sai daqui é
 *   `{ usuarioId, nomeSugerido }`, e nada mais. Nem token, nem claim, nem objeto do SDK.
 * - `PortaDeCredenciais` — as três operações das telas T-01 e T-11.
 *
 * **Por que o SDK roda no servidor e não no navegador.** A documentação de telas diz que as quatro telas
 * de credencial *"chamam o SDK do provedor"* (inventário, §4) e não diz onde. Aqui ele roda no servidor,
 * chamado por *Server Action*, por duas razões: a regra de fronteira só é verdadeira se o SDK não estiver
 * no bundle do navegador — e um formulário de cliente não tem como receber a porta por injeção —, e no App
 * Router a sincronia do cookie de sessão feita pelo servidor é a que não se desencontra. **É divergência
 * de local de execução, não de provedor nem de capacidade.** Registrada no relatório.
 */

/** O que a camada de Interface entrega: a leitura e a escrita de cookies da requisição. */
export interface ArmazenamentoDeCookies {
  todos(): ReadonlyArray<{ readonly name: string; readonly value: string }>;
  definir(
    cookies: ReadonlyArray<{
      readonly name: string;
      readonly value: string;
      readonly options?: Record<string, unknown>;
    }>,
  ): void;
}

/**
 * **Por que os nomes não têm o prefixo `NEXT_PUBLIC_`, contra a convenção do provedor.**
 *
 * `NEXT_PUBLIC_*` existe para variáveis que o Next.js **embute no bundle do navegador em tempo de build**.
 * Nesta fatia nenhuma variável precisa disso: o SDK roda no servidor (ver o cabeçalho deste arquivo), então
 * nada do provedor chega ao navegador. Usar o prefixo anunciaria um embutimento que não acontece — e é
 * justamente sobre embutimento que a regra de segredo da ADR-0004 fala.
 *
 * O ganho é concreto e verificável: **a imagem não carrega configuração nenhuma.** O `Dockerfile` não tem
 * `ARG`, não recebe `--build-arg` e não copia `.env`; as quatro variáveis chegam como ambiente do Container
 * App, em tempo de execução. Se um dia uma tela de cliente precisar da URL do provedor, o prefixo volta
 * **naquele momento e por decisão**, não por herança.
 */
function cliente(cookies: ArmazenamentoDeCookies): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const chaveAnonima = process.env.SUPABASE_CHAVE_ANONIMA;

  if (url === undefined || url === "" || chaveAnonima === undefined || chaveAnonima === "") {
    throw new Error(
      "SUPABASE_URL e SUPABASE_CHAVE_ANONIMA são obrigatórias, e chegam em tempo de EXECUÇÃO — nunca como " +
        "ARG de build (ADR-0004: a imagem é pública).",
    );
  }

  return createServerClient(url, chaveAnonima, {
    cookies: {
      getAll: () => cookies.todos().map((c) => ({ name: c.name, value: c.value })),
      setAll: (aDefinir) => {
        cookies.definir(aDefinir);
      },
    },
  });
}

/**
 * A porta que o ponto único de contexto consome.
 *
 * **Duas formas de a sessão chegar**, e o contrato §4.1 declara as duas: cookie do provedor (o PWA, no
 * navegador) e `Authorization: Bearer <access_token>` (`curl`, Postman, testes de ponta a ponta). O
 * `openapi.yaml` lista os dois esquemas em `security`, então implementar só o cookie deixaria metade do
 * contrato sem cumprimento — e é justamente a metade com que o avaliador confere a API.
 *
 * @param tokenPortador o `access_token` do cabeçalho, quando houver. Quem o lê é a camada de Interface —
 *                      ler cabeçalho é *traduzir HTTP*, e é só o que ela pode fazer.
 */
export function criarAutenticacao(
  cookies: ArmazenamentoDeCookies,
  tokenPortador: string | null = null,
): PortaDeAutenticacao {
  return {
    async sessaoAtual(): Promise<SessaoDoProvedor | null> {
      const { data, error } =
        tokenPortador === null
          ? await cliente(cookies).auth.getUser()
          : await cliente(cookies).auth.getUser(tokenPortador);

      if (error !== null || data.user === null) return null;

      const metadados = data.user.user_metadata as Record<string, unknown> | null;
      const nome = metadados?.["nome"];

      return {
        usuarioId: data.user.id,
        nomeSugerido: typeof nome === "string" && nome.trim() !== "" ? nome.trim() : null,
      };
    },
  };
}

/** A porta das três operações de credencial. */
export function criarCredenciais(cookies: ArmazenamentoDeCookies): PortaDeCredenciais {
  return {
    async entrar(email, senha): Promise<ResultadoDeCredencial> {
      const { error } = await cliente(cookies).auth.signInWithPassword({ email, password: senha });
      if (error === null) return { ok: true };
      return { ok: false, recusa: traduzirEntrada(error.code, error.message) };
    },

    async criarConta(nome, email, senha): Promise<ResultadoDeCredencial> {
      const { data, error } = await cliente(cookies).auth.signUp({
        email,
        password: senha,
        // É daqui que o ACL semeia `pessoas.nome` (contrato §4.1).
        options: { data: { nome } },
      });

      if (error !== null) {
        return { ok: false, recusa: traduzirCadastro(error.code, error.message) };
      }

      // Sessão ausente depois de um `signUp` bem-sucedido significa confirmação de e-mail obrigatória —
      // é o interruptor do provedor que decide o fim de T-11 (inventário, Q-T9).
      return { ok: true, precisaConfirmarEmail: data.session === null };
    },

    async confirmarPorCodigo(codigo): Promise<ResultadoDeCredencial> {
      const { error } = await cliente(cookies).auth.exchangeCodeForSession(codigo);
      if (error === null) return { ok: true };
      return { ok: false, recusa: "LINK_INVALIDO_OU_EXPIRADO" };
    },

    async sair(): Promise<void> {
      await cliente(cookies).auth.signOut();
    },
  };
}

// ---------------------------------------------------------------------------

function traduzirEntrada(codigo: string | undefined, mensagem: string): RecusaDeCredencial {
  if (codigo === "email_not_confirmed") return "EMAIL_NAO_CONFIRMADO";
  if (codigo === "invalid_credentials" || /invalid login credentials/i.test(mensagem)) {
    return "CREDENCIAL_INVALIDA";
  }
  return "FALHA_DO_PROVEDOR";
}

function traduzirCadastro(codigo: string | undefined, mensagem: string): RecusaDeCredencial {
  if (codigo === "user_already_exists" || /already registered/i.test(mensagem)) return "CONTA_JA_EXISTE";
  if (codigo === "weak_password" || /password/i.test(mensagem)) return "SENHA_RECUSADA_PELO_PROVEDOR";
  return "FALHA_DO_PROVEDOR";
}
