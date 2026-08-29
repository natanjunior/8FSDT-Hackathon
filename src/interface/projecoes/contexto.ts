import type { ResolucaoDeContexto } from "@/aplicacao/contexto";

import { projetarPedidoDeEntrada, type PedidoDeEntradaProjetado } from "./pedido-de-entrada";

/**
 * A projeção do schema `Contexto` do `openapi.yaml`.
 *
 * **Por que a projeção é da camada de Interface e não do handler** (arquitetura.md §5.5): há **dois
 * transportes** para a mesma leitura — o route handler e o Server Component (contrato §5) —, e uma projeção
 * que morasse no handler não existiria para o segundo. As duas estradas deixariam de produzir a mesma
 * resposta.
 *
 * É o **Presenter** da Clean Architecture (CA aula 5, p.8), adotado com a redução que a própria disciplina
 * autoriza (CA aula 8, transcrição 02): **função pura, não classe** — o que se adota é o lugar e a
 * responsabilidade, não a cerimônia.
 */

export type ContextoProjetado = {
  pessoa: { pessoaId: string; nome: string };
  organizacaoAtiva: { id: string; nome: string; codigoPublico: string } | null;
  papel: string | null;
  permissoes: readonly string[];
  vinculos: ReadonlyArray<{
    organizacaoId: string;
    nome: string;
    papel: string;
    codigoPublico: string;
  }>;
  pedidosDeEntrada: readonly PedidoDeEntradaProjetado[];
};

export function projetarContexto(resolucao: ResolucaoDeContexto): ContextoProjetado {
  const ativo = resolucao.ativo;

  return {
    pessoa: {
      pessoaId: resolucao.sessao.pessoaId,
      nome: resolucao.sessao.nome,
    },

    organizacaoAtiva:
      ativo === null
        ? null
        : {
            id: ativo.organizacao.id,
            nome: ativo.organizacao.nome,
            codigoPublico: ativo.organizacao.codigoPublico,
          },

    papel: ativo === null ? null : ativo.vinculo.papel,

    // A lista que a interface usa para desenhar (ou esconder) ações. Vem do agregado `Vinculo` — o mapa
    // papel → permissões é do domínio, e a projeção só o expõe (contrato §4.5).
    permissoes: ativo === null ? [] : ativo.vinculo.permissoes,

    // Todas as organizações em que a Pessoa tem vínculo ativo — o insumo do seletor (face D de T-02) e do
    // menu de troca (item 7b).
    //
    // **`codigoPublico` entra pelo item 7b**, e paga um uso só: a face E de T-02 compara o código digitado
    // com esta lista **antes de enviar**, e assim oferece *"entrar nela"* em vez de arrancar um
    // `409 JA_VINCULADO` cujo corpo não carrega identidade nenhuma (`openapi.yaml:311-312`). O dado já
    // vinha em `VinculoNaOrganizacao` — **nenhuma consulta muda**.
    //
    // **Nada além dos quatro:** não há contagem de ocorrências por organização, porque não há endpoint que
    // a dê sem organização ativa (contrato §4.4).
    vinculos: resolucao.vinculos.map((v) => ({
      organizacaoId: v.organizacao.id,
      nome: v.organizacao.nome,
      papel: v.vinculo.papel,
      codigoPublico: v.organizacao.codigoPublico,
    })),

    /**
     * **Todos os pedidos da Pessoa, nas três situações, em `criadoEm` decrescente** (spec §2.6) — o insumo
     * das faces B e C de T-02.
     *
     * Nesta fatia só existe `pendente`: `aprovado` e `recusado` são produzidos pelo item 8, e até lá a
     * lista tem no máximo um item. A forma, porém, já é a final — é o que faz a face C ser **só tela**
     * quando aquele item chegar.
     */
    pedidosDeEntrada: resolucao.pedidos.map(projetarPedidoDeEntrada),
  };
}
