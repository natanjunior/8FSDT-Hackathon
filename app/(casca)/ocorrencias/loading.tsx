import { EsqueletoDaLista } from "@/interface/componentes/esqueleto-da-lista";

/**
 * A espera de T-03 no nível da rota — critério 44c.7.
 *
 * **A casca não entra aqui**, e é de propósito: este arquivo vive dentro de `app/(casca)/`, então a barra
 * superior e a lateral já estão pintadas quando ele aparece. É o guia §8, em letra.
 *
 * **O título vem de verdade**, e não em esqueleto: ele é conhecido sem consultar nada. O que fica em
 * esqueleto é o recorte, que depende de permissão, e a lista.
 */
export default function Carregando() {
  return <EsqueletoDaLista comCabecalhoDePagina />;
}
