import type { SituacaoDoPedido } from "@/dominio/organizacao";

import type {
  AreaLida,
  CategoriaLida,
  PedidoDeEntradaLido,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
  RepositorioEscopadoDePedidosDeEntrada,
} from "./portas";

/**
 * Os dois modelos de leitura da configuração da organização.
 *
 * **O que eles carregam, e que não é da Interface:** o padrão *"só as ativas"*. Ele não é convenção de
 * HTTP — é a regra de produto que o `openapi.yaml` escreve por extenso no parâmetro `ativa`, *"o
 * formulário de registro nunca oferece categoria desativada"*. A Interface traduz `?ativa=false` em
 * `incluirInativas`; quem sabe o que acontece quando ninguém pede nada é esta camada.
 */

export function listarCategorias(
  categorias: RepositorioEscopadoDeCategorias,
  filtro: { incluirInativas?: boolean } = {},
): Promise<readonly CategoriaLida[]> {
  return categorias.listar({ apenasAtivas: filtro.incluirInativas !== true });
}

export function listarAreas(
  areas: RepositorioEscopadoDeAreas,
  filtro: { incluirInativas?: boolean } = {},
): Promise<readonly AreaLida[]> {
  return areas.listar({ apenasAtivas: filtro.incluirInativas !== true });
}

/**
 * Os pedidos que o Gestor abre para decidir.
 *
 * **O padrão *"só os pendentes"* mora aqui**, e não na Interface, pela mesma razão do *"só as ativas"*
 * logo acima: ele é regra de produto, escrita no `openapi.yaml` como `default: [pendente]`. A Interface
 * traduz `?situacao=`; quem sabe o que acontece quando ninguém pede nada é esta camada.
 */
export function listarPedidosDeEntrada(
  pedidos: RepositorioEscopadoDePedidosDeEntrada,
  filtro: { situacoes?: readonly SituacaoDoPedido[] } = {},
): Promise<readonly PedidoDeEntradaLido[]> {
  return pedidos.listar({ situacoes: filtro.situacoes ?? ["pendente"] });
}
