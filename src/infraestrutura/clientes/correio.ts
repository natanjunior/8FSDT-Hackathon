import { createTransport } from "nodemailer";

import type { Carteiro, Mensagem } from "@/aplicacao/organizacao";

/**
 * ============================================================================
 *  O carteiro: o e-mail do produto sai por SMTP (item 122, ADR-0022)
 * ============================================================================
 *
 * **SMTP, e não a API HTTP de um provedor**, para que trocar de provedor seja trocar duas variáveis: a
 * Brevo em produção, a caixa de teste da pilha do Supabase no local, um domínio próprio quando houver.
 *
 * **Os tempos são curtos e declarados**: conexão 5 s, saudação 5 s, inatividade 10 s. O envio acontece
 * dentro da requisição, um depois do outro, e vinte chamadas no pior caso têm de caber no teto do ingresso.
 *
 * **Só a recuperação de senha não passa por aqui.** Ela sai pelo provedor de autenticação, com outra
 * credencial e outra cota (ADR-0022).
 */

/** O mínimo que o carteiro usa de um transporte: é o que o teste dubla sem importar o pacote. */
export type TransporteDeCorreio = { sendMail(opcoes: Record<string, unknown>): Promise<unknown> };

type Configuracao = { transporte: TransporteDeCorreio; remetente: string };

let compartilhada: Configuracao | null = null;

/** Lida uma vez por processo, no primeiro envio, como a conta do armazenamento. */
function daConfiguracao(): Configuracao {
  if (compartilhada !== null) return compartilhada;
  const url = process.env.CORREIO_SMTP_URL;
  const remetente = process.env.CORREIO_REMETENTE;
  if (url === undefined || url === "" || remetente === undefined || remetente === "") {
    throw new Error(
      "CORREIO_SMTP_URL ou CORREIO_REMETENTE não está definida. Em produção as duas chegam do Container App " +
        "em tempo de execução, a URL como secret (ADR-0004: a imagem é pública). Localmente o `npm run local` " +
        "as escreve apontando para a caixa de teste do Supabase.",
    );
  }
  compartilhada = {
    transporte: createTransport(url, { connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000 }),
    remetente,
  };
  return compartilhada;
}

/**
 * **A configuração é lida no primeiro envio, e não na montagem**, para que a rota que nunca envia (e o
 * teste de quem só monta portas) não exija as variáveis.
 */
export function criarCarteiro(transporte?: TransporteDeCorreio, remetente?: string): Carteiro {
  return {
    async enviar(mensagem: Mensagem) {
      const usada = transporte !== undefined && remetente !== undefined ? { transporte, remetente } : daConfiguracao();
      await usada.transporte.sendMail({
        from: usada.remetente,
        to: mensagem.para,
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: mensagem.html,
      });
    },
  };
}
