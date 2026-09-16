/** Superfície pública de `infraestrutura/repositorios/organizacao` (ADR-0006, regra 3). */
export { repositorioGlobalDeVinculos } from "./vinculos-globais";
export { repositorioEscopadoDeVinculos } from "./vinculos-escopados";
export { repositorioDeOrganizacoes } from "./organizacoes";
export { repositorioEscopadoDaOrganizacao } from "./organizacao-escopada";
export { repositorioEscopadoDeCategorias } from "./categorias-escopadas";
export { repositorioEscopadoDeAreas } from "./areas-escopadas";
export {
  repositorioDePedidosDeEntrada,
  repositorioEscopadoDePedidosDeEntrada,
  repositorioGlobalDePedidosDeEntrada,
} from "./pedidos-de-entrada";
