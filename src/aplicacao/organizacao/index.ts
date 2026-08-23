/** Superfície pública do módulo `aplicacao/organizacao` (ADR-0006, regra 3). */
export { criarOrganizacao } from "./criar-organizacao";
export { listarAreas, listarCategorias } from "./consultas";
export { CodigoPublicoEmUso } from "./erros";
export type {
  AreaLida,
  CategoriaLida,
  NovaOrganizacao,
  OrganizacaoCriada,
  RepositorioDeOrganizacoes,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
} from "./portas";
