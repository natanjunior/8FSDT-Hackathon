"use client";

import { useState, type FormEvent } from "react";

/**
 * ============================================================================
 *  O formulário tocado — critério 44g.2, e o mecanismo único do produto
 * ============================================================================
 *
 * **A regra é do guia §7 (16/09/2026):** nenhum campo mostra problema antes da primeira interação com o
 * formulário; depois dela, todo campo com problema mostra. Mudar o valor de um campo conta; tentar enviar
 * conta; passar o foco sem mudar nada **não** conta, e mexer em controle que não é campo também não (a
 * busca pelo nome do modal de atribuição filtra a lista e não é valor enviado).
 *
 * **Dois modos.** `formulario` é a regra geral. `campo` é a exceção de T-04 (17/09/2026): o erro de um
 * campo aparece quando a pessoa sai dele ou quando tenta registrar. Nenhuma tela do 44g usa `campo`; ele
 * está aqui porque o 44l depende só deste item.
 *
 * **Quem calcula os erros é quem usa o gancho**, a partir dos valores de agora: pelo estado, nos
 * componentes controlados (`erros`), ou pelo `FormData` do `<form>`, nos não controlados (`validar`).
 * Nas telas de credencial e de T-02, `validar` chama `errosDoSchema` com o mesmo schema da ação.
 *
 * **O erro que o servidor devolveu** aparece embaixo do campo sem depender da interação, porque é resposta
 * a um envio, e some quando aquele campo muda. **A resposta do servidor recomeça o estado**: o React 19
 * esvazia o formulário com `action` ao fim da ação, e um formulário que continuasse tocado acenderia
 * *"Informe o seu e-mail."* ao lado de *"E-mail ou senha incorretos."*. Quem chama `recomecar()` é a função
 * da ação, logo depois do `await`.
 *
 * **A decisão mora em funções puras com teste** (`interagir`, `erroVisivel`, `primeiroComProblema`), e o
 * gancho só as liga ao React: o projeto não tem biblioteca de teste de componente.
 *
 * **Tentar enviar com problema** não envia, e leva o foco ao primeiro campo com problema na ordem de
 * `campos`, que é a do documento. Num grupo de escolha, o foco vai à primeira opção que aceita foco.
 */

export type ErrosDeCampo = Readonly<Record<string, string | undefined>>;

export type ModoDeRevelar = "formulario" | "campo";

export type EstadoDeInteracao = {
  readonly interagiu: boolean;
  readonly tentouEnviar: boolean;
  /** Os campos que perderam o foco. Só o modo `campo` os lê. */
  readonly saidos: readonly string[];
  /** Os campos que mudaram desde a última resposta: o erro do servidor deles não aparece mais. */
  readonly alterados: readonly string[];
};

export type EventoDeInteracao =
  | { readonly tipo: "mudou"; readonly campo: string }
  | { readonly tipo: "saiu"; readonly campo: string }
  | { readonly tipo: "tentou-enviar" }
  | { readonly tipo: "recomecou" };

export const SEM_INTERACAO: EstadoDeInteracao = {
  interagiu: false,
  tentouEnviar: false,
  saidos: [],
  alterados: [],
};

function comMais(lista: readonly string[], item: string): readonly string[] {
  return lista.includes(item) ? lista : [...lista, item];
}

export function interagir(
  estado: EstadoDeInteracao,
  evento: EventoDeInteracao,
  campos: readonly string[],
): EstadoDeInteracao {
  switch (evento.tipo) {
    case "mudou":
      if (!campos.includes(evento.campo)) return estado;
      return { ...estado, interagiu: true, alterados: comMais(estado.alterados, evento.campo) };
    case "saiu":
      if (!campos.includes(evento.campo)) return estado;
      return { ...estado, saidos: comMais(estado.saidos, evento.campo) };
    case "tentou-enviar":
      return { ...estado, interagiu: true, tentouEnviar: true };
    case "recomecou":
      return SEM_INTERACAO;
  }
}

export function erroVisivel(
  estado: EstadoDeInteracao,
  modo: ModoDeRevelar,
  campo: string,
  erros: ErrosDeCampo,
  errosDoServidor: ErrosDeCampo = {},
): string | undefined {
  const doCliente = erros[campo];
  const revelado =
    modo === "formulario" ? estado.interagiu : estado.tentouEnviar || estado.saidos.includes(campo);
  if (doCliente !== undefined && revelado) return doCliente;
  if (estado.alterados.includes(campo)) return undefined;
  return errosDoServidor[campo];
}

export function primeiroComProblema(campos: readonly string[], erros: ErrosDeCampo): string | null {
  return campos.find((campo) => erros[campo] !== undefined) ?? null;
}

type OpcoesDoFormulario = {
  /** Nome do campo → `id` do elemento que recebe o foco, **na ordem do documento**. */
  readonly campos: Readonly<Record<string, string>>;
  readonly modo?: ModoDeRevelar;
} & (
  | { readonly erros: ErrosDeCampo; readonly validar?: undefined }
  | { readonly validar: (dados: FormData) => ErrosDeCampo; readonly erros?: undefined }
);

export type FormularioTocado = {
  readonly interagiu: boolean;
  readonly erroDe: (campo: string, errosDoServidor?: ErrosDeCampo) => string | undefined;
  readonly mudou: (campo: string) => void;
  readonly saiu: (campo: string) => void;
  /** Marca a interação e diz se pode enviar; se não pode, leva o foco ao primeiro problema. */
  readonly tentarEnviar: (atuais?: ErrosDeCampo) => boolean;
  readonly recomecar: () => void;
  /** Para o `onChange` do `<form>` não controlado: relê os erros e marca o campo que mudou. */
  readonly aoMudarNoFormulario: (evento: FormEvent<HTMLFormElement>) => void;
  /** Para o `onSubmit`: previne o envio **só** quando há problema. */
  readonly aoEnviarFormulario: (evento: FormEvent<HTMLFormElement>) => boolean;
};

const FOCAVEL = "input, textarea, select, button, [tabindex]";
const OPCAO_LIVRE = 'input[type="radio"]:not(:disabled)';
const FOCAVEL_LIVRE =
  "input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex='-1'])";

function focar(id: string | undefined): void {
  if (id === undefined) return;
  const elemento = document.getElementById(id);
  if (elemento === null) return;
  const alvo = elemento.matches(FOCAVEL)
    ? elemento
    : (elemento.querySelector<HTMLElement>(OPCAO_LIVRE) ?? elemento.querySelector<HTMLElement>(FOCAVEL_LIVRE));
  alvo?.focus();
}

export function useFormularioTocado(opcoes: OpcoesDoFormulario): FormularioTocado {
  const { campos, modo = "formulario" } = opcoes;
  const nomes = Object.keys(campos);
  const [estado, setEstado] = useState<EstadoDeInteracao>(SEM_INTERACAO);
  const [errosLidos, setErrosLidos] = useState<ErrosDeCampo>({});
  const erros = opcoes.validar === undefined ? opcoes.erros : errosLidos;

  const aplicar = (evento: EventoDeInteracao) => {
    setEstado((anterior) => interagir(anterior, evento, nomes));
  };

  const tentarEnviar = (atuais: ErrosDeCampo = erros): boolean => {
    aplicar({ tipo: "tentou-enviar" });
    const primeiro = primeiroComProblema(nomes, atuais);
    if (primeiro === null) return true;
    focar(campos[primeiro]);
    return false;
  };

  return {
    interagiu: estado.interagiu,
    erroDe: (campo, errosDoServidor) => erroVisivel(estado, modo, campo, erros, errosDoServidor),
    mudou: (campo) => aplicar({ tipo: "mudou", campo }),
    saiu: (campo) => aplicar({ tipo: "saiu", campo }),
    tentarEnviar,
    recomecar: () => aplicar({ tipo: "recomecou" }),
    aoMudarNoFormulario: (evento) => {
      if (opcoes.validar !== undefined) setErrosLidos(opcoes.validar(new FormData(evento.currentTarget)));
      const alvo = evento.target;
      if (
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLTextAreaElement ||
        alvo instanceof HTMLSelectElement
      ) {
        aplicar({ tipo: "mudou", campo: alvo.name });
      }
    },
    aoEnviarFormulario: (evento) => {
      const atuais =
        opcoes.validar === undefined ? erros : opcoes.validar(new FormData(evento.currentTarget));
      if (opcoes.validar !== undefined) setErrosLidos(atuais);
      const valido = tentarEnviar(atuais);
      if (!valido) evento.preventDefault();
      return valido;
    },
  };
}
