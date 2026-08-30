import { SemVinculoNaOrganizacao } from "./erros";
import type { ResolucaoDeContexto } from "./resolver-contexto";

/**
 * ============================================================================
 *  A regra de `PUT /contexto/organizacao` — e ela não faz consulta nenhuma
 * ============================================================================
 *
 * **É a primeira função de aplicação do projeto sem porta e sem `await`**, e a forma tem razão: o
 * critério 7b.3 pede validar *"que existe vínculo ativo daquela Pessoa naquela organização"*, e a
 * resolução de contexto **já carregou** essa lista antes de o handler começar
 * (`resolver-contexto.ts:114-117`). Uma consulta aqui seria a segunda leitura da mesma coisa, cobrada de
 * quem está esperando uma tela trocar — sob a escala a zero do RNF5.
 *
 * **Mora na Aplicação, e não no `route.ts`, porque a recusa é regra.** `SemVinculoNaOrganizacao` existe
 * nesta camada desde a primeira fatia e nunca foi lançada; este é o primeiro e único lançador.
 *
 * **A mesma resposta para organização inexistente e para organização real sem vínculo** (contrato §4.3),
 * e não é uma checagem a mais: a função **nunca soube a diferença**. Ela procura numa lista; o que não
 * está lá é uma coisa só.
 *
 * **`escolhidaAutomaticamente: false` não é enfeite:** `true` é o sinal que faz `abrirRequisicao` gravar
 * o cookie sozinho (`com-contexto.ts:290-296`). Aqui quem grava é o handler, uma vez, com o valor que o
 * cliente pediu — e regravar duas vezes na mesma resposta é o tipo de coisa que só aparece em produção.
 *
 * @throws SemVinculoNaOrganizacao quando a organização não está entre os vínculos ativos da Pessoa.
 */
export function escolherOrganizacaoAtiva(
  resolucao: ResolucaoDeContexto,
  organizacaoId: string,
): ResolucaoDeContexto {
  const escolhido = resolucao.vinculos.find((v) => v.organizacao.id === organizacaoId);
  if (escolhido === undefined) throw new SemVinculoNaOrganizacao();

  return { ...resolucao, ativo: escolhido, escolhidaAutomaticamente: false };
}
