import type { AreaLida, CategoriaLida, OrganizacaoCriada } from "@/aplicacao/organizacao";

/**
 * As projeções dos schemas `Organizacao`, `Categoria` e `Area` do `openapi.yaml`.
 *
 * Moram na camada de Interface pela mesma razão que `projetarContexto`: há **dois transportes** para a
 * mesma leitura (contrato §5), e uma projeção no handler não existiria para o Server Component.
 *
 * **Elas são o filtro que impede a forma do banco de subir.** `organizacao_id`, `criado_por_pessoa_id`,
 * `atualizado_em` e `logo_caminho` existem no esquema e **não aparecem em resposta nenhuma** — não porque
 * alguém se lembrou de omiti-los, mas porque estes tipos não os têm.
 */

export type OrganizacaoProjetada = {
  id: string;
  nome: string;
  codigoPublico: string;
  criadoEm: string;
  categoriasSemeadas: number;
  areasSemeadas: number;
};

export type CategoriaProjetada = {
  id: string;
  nome: string;
  icone: string;
  ativa: boolean;
  ordem: number;
};

export type AreaProjetada = {
  id: string;
  nome: string;
  tipo: string;
  ativa: boolean;
  ordem: number;
};

export function projetarOrganizacao(criada: OrganizacaoCriada): OrganizacaoProjetada {
  return {
    id: criada.id,
    nome: criada.nome,
    codigoPublico: criada.codigoPublico,
    criadoEm: criada.criadoEm,
    categoriasSemeadas: criada.categoriasSemeadas,
    areasSemeadas: criada.areasSemeadas,
  };
}

export function projetarCategoria(categoria: CategoriaLida): CategoriaProjetada {
  return {
    id: categoria.id,
    nome: categoria.nome,
    // `icone` é `required` no schema e `NOT NULL` na coluna: **nunca vem nulo**, e nenhuma tela precisa
    // de caminho para ausência (contrato §8.1).
    icone: categoria.icone,
    ativa: categoria.ativa,
    ordem: categoria.ordem,
  };
}

export function projetarArea(area: AreaLida): AreaProjetada {
  return {
    id: area.id,
    nome: area.nome,
    // O tipo **vigente**. O congelado é `areaTipo`, e mora na ocorrência (emenda à D10).
    tipo: area.tipo,
    ativa: area.ativa,
    ordem: area.ordem,
  };
}
