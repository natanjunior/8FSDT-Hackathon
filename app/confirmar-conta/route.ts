import { aterrissarConfirmacaoDeConta } from "@/interface/http";

/**
 * `/confirmar-conta` — a aterrissagem do link do e-mail de confirmação (protótipo, T-01, quadros 5 e 6).
 *
 * **Não é endpoint do contrato**: autenticação é o subdomínio Genérico comprado no provedor (§4.1), então
 * este caminho não existe no `openapi.yaml` e não deve existir. Ele precisa estar cadastrado como *Redirect
 * URL* no projeto do provedor — está na lista de provisionamento.
 *
 * **DORMENTE** — a Q-T9 foi fechada em 22/08/2026 e, em regime, **nenhum e-mail de confirmação é
 * enviado**, então nada chega a este caminho. **O que a mantém assim é só o interruptor *Confirm email*
 * do painel do provedor** — desligado nos dois ambientes por decisão. Desde o item 6c **não** é mais a
 * ausência de destino: o `signUp` manda o link para cá. Ver `interface/http/confirmacao-de-conta.ts`.
 *
 * O cadastro como *Redirect URL* no provedor **continua na lista de provisionamento**, e agora ele é
 * necessário de fato: `emailRedirectTo` fora da lista de permissão é **ignorado** pelo provedor, que
 * volta para a *Site URL* — degradação silenciosa, e é o sintoma de 31/08/2026.
 */
export const GET = aterrissarConfirmacaoDeConta;

export const dynamic = "force-dynamic";
