/** Superfície pública de `infraestrutura/repositorios/organizacao` (ADR-0006, regra 3). */
export { repositorioGlobalDeVinculos } from "./vinculos-globais";
export { repositorioEscopadoDeVinculos } from "./vinculos-escopados";
export { repositorioEscopadoDeEtiquetas } from "./etiquetas-escopadas";
export { repositorioEscopadoDeConvitesPessoais } from "./convites-pessoais-escopados";
export { leituraDeConvitesPessoais, repositorioDeConvitesPessoais } from "./convites-pessoais";
export { CHAVES_DA_FUSAO, conferirChavesDaFusao, type ChaveDoCatalogo } from "./chaves-da-fusao";
export { repositorioDeOrganizacoes } from "./organizacoes";
export { repositorioDeConvites } from "./convites";
export { repositorioEscopadoDaOrganizacao } from "./organizacao-escopada";
export { repositorioEscopadoDaConfiguracao } from "./configuracao-escopada";
export { repositorioEscopadoDeCategorias } from "./categorias-escopadas";
export { repositorioEscopadoDeAreas } from "./areas-escopadas";
export {
  repositorioDePedidosDeEntrada,
  repositorioEscopadoDePedidosDeEntrada,
  repositorioGlobalDePedidosDeEntrada,
} from "./pedidos-de-entrada";
