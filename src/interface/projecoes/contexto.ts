import type { ResolucaoDeContexto } from "@/aplicacao/contexto";

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
  vinculos: ReadonlyArray<{ organizacaoId: string; nome: string; papel: string }>;
  pedidosDeEntrada: readonly never[];
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

    // Todas as organizações em que a Pessoa tem vínculo ativo — o insumo do seletor (face D de T-02).
    // **Nada além de nome e papel:** não há contagem de ocorrências por organização, porque não há
    // endpoint que a dê sem organização ativa (contrato §4.4).
    vinculos: resolucao.vinculos.map((v) => ({
      organizacaoId: v.organizacao.id,
      nome: v.organizacao.nome,
      papel: v.vinculo.papel,
    })),

    /**
     * **Sempre vazio nesta fatia, e isso é verdade e não omissão.** O schema declara o campo como
     * `required`, e `[]` é o valor correto porque `POST /pedidos-de-entrada` não existe ainda: nenhum
     * pedido pode ter sido criado. As faces **B** e **C** de T-02, que são as que consomem esta lista,
     * estão fora da fatia pela mesma razão.
     *
     * Quando o endpoint entrar, esta linha passa a ler `pedidos_de_entrada` — e o campo não muda de forma,
     * que é o que torna a evolução aditiva (contrato §11).
     */
    pedidosDeEntrada: [],
  };
}
