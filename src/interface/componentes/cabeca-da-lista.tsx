"use client";

import { CabecaQueOrdena } from "./cabeca-que-ordena";
import { useNavegacaoDaLista } from "./navegacao-da-lista";
import {
  ariaSortNaLista,
  consultaComOrdenacao,
  lerOrdenacaoDaLista,
  proximaNaLista,
  rotuloNaLista,
  type ColunaDaLista,
} from "./ordenacao-das-ocorrencias";

/**
 * **A única ilha de cliente da lista de ocorrências** — item 106, critério 1.
 *
 * A lista é desenho de servidor: recebe uma página e a pinta. O que precisa de cliente é o clique de
 * ordenar, porque ele lê o contexto da navegação e passa uma função à `CabecaQueOrdena`, e função não
 * atravessa a fronteira entre servidor e cliente. Por isso o clique mora aqui, e só ele: a lista entrega
 * dados que viajam (`coluna`, `rotulo`, `consultaAtual`) e esta peça monta o resto.
 *
 * **Ordenar é navegação com `push`, e tira a página** — conjunto novo, corte novo. O estado vive na URL,
 * como os filtros: um cabeçalho que guardasse ordem em estado local perderia a ordem no *Voltar* do
 * navegador e a esconderia de quem copia o endereço.
 */
export function CabecaDaLista({
  coluna,
  rotulo,
  consultaAtual,
  largura,
}: {
  coluna: ColunaDaLista;
  rotulo: string;
  consultaAtual: string;
  largura?: string;
}) {
  const { navegar } = useNavegacaoDaLista();
  const ordem = lerOrdenacaoDaLista(new URLSearchParams(consultaAtual));

  return (
    <CabecaQueOrdena
      sentido={ariaSortNaLista(ordem, coluna)}
      rotulo={rotulo}
      nomeAcessivel={rotuloNaLista(ordem, coluna, rotulo)}
      aoClicar={() => {
        navegar(consultaComOrdenacao(consultaAtual, proximaNaLista(ordem, coluna)));
      }}
      {...(largura === undefined ? {} : { largura })}
    />
  );
}
