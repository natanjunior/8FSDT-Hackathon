import { aterrissarConfirmacaoDeConta } from "@/interface/http";

/**
 * `/confirmar-conta` — a aterrissagem do link do e-mail de confirmação (protótipo, T-01, quadros 5 e 6).
 *
 * **Não é endpoint do contrato**: autenticação é o subdomínio Genérico comprado no provedor (§4.1), então
 * este caminho não existe no `openapi.yaml` e não deve existir. Ele precisa estar cadastrado como *Redirect
 * URL* no projeto do provedor — está na lista de provisionamento.
 */
export const GET = aterrissarConfirmacaoDeConta;

export const dynamic = "force-dynamic";
