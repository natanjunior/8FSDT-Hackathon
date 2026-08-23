import type {
  AreaLida,
  CategoriaLida,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
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
