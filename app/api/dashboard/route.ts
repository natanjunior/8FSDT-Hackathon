import { verDashboard } from "@/aplicacao/dashboard";
import { comContexto, lerJanelaDoDashboardDaUrl } from "@/interface/http";
import { projetarDashboard } from "@/interface/projecoes";

/**
 * **`GET /dashboard`** — os seis indicadores, numa resposta só.
 *
 * **Um endpoint e não cinco**, e a razão é de plataforma (contrato §8.7): *"o dashboard é uma tela, e numa
 * aplicação com escala a zero cinco requisições podem significar cinco esperas de cold start onde uma
 * bastaria"*.
 *
 * **`dashboard.ler` — Gestor.** É o `403 PERMISSAO_INSUFICIENTE` do critério 32.1, e quem o produz é o
 * `comContexto`, com `vinculo.pode(...)` e nunca com o papel (contrato §4.5). A permissão está declarada
 * desde a primeira fatia (`Permissao.ts:29`) e **nunca havia sido exercida** — esta é a primeira vez.
 *
 * **Nenhum corpo, nenhuma escrita, nenhum outro método.** A rota exporta `GET` e mais nada.
 */
export const GET = comContexto({ exige: "dashboard.ler" }, async ({ repos, requisicao }) =>
  projetarDashboard(
    await verDashboard(
      repos.dashboard,
      lerJanelaDoDashboardDaUrl(new URL(requisicao.url).searchParams),
    ),
  ),
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
