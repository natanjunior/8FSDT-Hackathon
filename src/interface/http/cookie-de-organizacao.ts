import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * O **cookie de sessão assinado pelo servidor** que guarda a organização ativa (contrato §4.3).
 *
 * Três propriedades, e cada uma responde a uma linha do contrato:
 *
 * - **Assinado**, porque o `organizacaoId` aparece uma vez só em todo o contrato — no corpo do
 *   `PUT /contexto/organizacao` — e em nenhum outro lugar o cliente nomeia uma organização (§4.2). Um
 *   cookie não assinado devolveria essa capacidade ao cliente pela porta de trás.
 * - **Amarrado ao `usuarioId`**, para que o cookie de uma sessão não valha em outra.
 * - **`httpOnly`**, porque nenhum código de página precisa lê-lo: quem diz qual é a organização ativa é
 *   `GET /contexto`.
 *
 * Ainda assim, ele **não é a autoridade**: a resolução confere se há vínculo ativo naquela organização, e
 * um cookie que aponte para vínculo revogado cai na regra do estado inicial como se não existisse. A
 * assinatura evita adivinhação; a autorização continua sendo do banco.
 */
export const NOME_DO_COOKIE = "resolveai_organizacao";

/** Sete dias — o mesmo horizonte em que o projeto Supabase free pausa por inatividade (RNF5). */
const VALIDADE_EM_SEGUNDOS = 7 * 24 * 60 * 60;

export type OpcoesDeCookie = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function segredo(): string {
  const valor = process.env.SEGREDO_DE_SESSAO;
  if (valor === undefined || valor.length < 32) {
    throw new Error(
      "SEGREDO_DE_SESSAO ausente ou curta demais (mínimo 32 caracteres). Ela chega ao container em " +
        "tempo de execução — nunca como ARG de build (ADR-0004: a imagem é pública).",
    );
  }
  return valor;
}

function assinatura(organizacaoId: string, usuarioId: string): string {
  return createHmac("sha256", segredo())
    .update(`${organizacaoId}.${usuarioId}`)
    .digest("base64url");
}

export function assinarOrganizacao(
  organizacaoId: string,
  usuarioId: string,
): { valor: string; opcoes: OpcoesDeCookie } {
  return {
    valor: `${organizacaoId}.${assinatura(organizacaoId, usuarioId)}`,
    opcoes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VALIDADE_EM_SEGUNDOS,
    },
  };
}

/**
 * Lê a organização do cookie, ou `null` se ele estiver ausente, malformado ou com assinatura inválida.
 *
 * **Não lança.** Cookie inválido é indistinguível de cookie ausente do ponto de vista do fluxo — os dois
 * levam à regra do estado inicial da §4.3 —, e transformar isso em erro brica a sessão de quem trocou de
 * conta no mesmo navegador.
 */
export function lerOrganizacaoAssinada(bruto: string | undefined, usuarioId: string): string | null {
  if (bruto === undefined) return null;

  const separador = bruto.lastIndexOf(".");
  if (separador <= 0) return null;

  const organizacaoId = bruto.slice(0, separador);
  const recebida = Buffer.from(bruto.slice(separador + 1));
  const esperada = Buffer.from(assinatura(organizacaoId, usuarioId));

  if (recebida.length !== esperada.length) return null;
  return timingSafeEqual(recebida, esperada) ? organizacaoId : null;
}
