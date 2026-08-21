import { semOrganizacao } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * `GET /contexto` — *quem sou eu, e em quais organizações* (contrato §8.0).
 *
 * **O primeiro pedido de qualquer cliente**, e o único endpoint que uma Pessoa sem nenhum vínculo consegue
 * usar — é ele que sustenta T-02.
 *
 * Uma linha, e é o ponto: o ajudante do anel externo já resolveu a sessão, garantiu a `Pessoa`, listou os
 * vínculos partindo de `vinculos` e gravou o cookie quando havia exatamente um. O que resta ao handler é o
 * que a tabela de camadas lhe permite — **traduzir**.
 *
 * `semOrganizacao` porque este é o primeiro dos quatro endpoints da lista fechada da §4.4: ele precisa
 * listar os vínculos de **todas** as organizações da Pessoa, então não há escopo a aplicar.
 */
export const GET = semOrganizacao(({ resolucao }) => projetarContexto(resolucao));

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
