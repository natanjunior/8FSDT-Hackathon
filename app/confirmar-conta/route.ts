import { aterrissarConfirmacaoDeConta } from "@/interface/http";

/**
 * `/confirmar-conta` — a aterrissagem do link do e-mail de confirmação (protótipo, T-01, quadros 5 e 6).
 *
 * **Não é endpoint do contrato**: autenticação é o subdomínio Genérico comprado no provedor (§4.1), então
 * este caminho não existe no `openapi.yaml` e não deve existir. Ele precisa estar cadastrado como *Redirect
 * URL* no projeto do provedor — está na lista de provisionamento.
 *
 * **DORMENTE** — a Q-T9 foi fechada em 22/08/2026 e **nenhum e-mail de confirmação é enviado**, então nada
 * chega a este caminho. Ver `interface/http/confirmacao-de-conta.ts` para o porquê de ele ficar. O cadastro
 * como *Redirect URL* no provedor **continua na lista de provisionamento**: cadastrar a URL não liga coisa
 * nenhuma, e tirá-la seria trabalho a refazer no dia do interruptor (spec §3.2).
 */
export const GET = aterrissarConfirmacaoDeConta;

export const dynamic = "force-dynamic";
