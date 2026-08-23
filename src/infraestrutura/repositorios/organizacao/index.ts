/** Superfície pública de `infraestrutura/repositorios/organizacao` (ADR-0006, regra 3). */
export { repositorioGlobalDeVinculos } from "./vinculos-globais";
export { repositorioEscopadoDeVinculos } from "./vinculos-escopados";
export { repositorioDeOrganizacoes } from "./organizacoes";
export { repositorioEscopadoDeCategorias } from "./categorias-escopadas";
export { repositorioEscopadoDeAreas } from "./areas-escopadas";
export {
  repositorioDePedidosDeEntrada,
  repositorioGlobalDePedidosDeEntrada,
} from "./pedidos-de-entrada";
