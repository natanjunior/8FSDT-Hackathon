"use client";

import { useState, type FocusEvent, type FocusEventHandler, type FormEvent } from "react";
import { flushSync } from "react-dom";

/**
 * ============================================================================
 *  O formulário tocado — critério 44g.2, e o mecanismo único do produto
 * ============================================================================
 *
 * **A regra é uma só desde o item 75 (24/09/2026):** o erro de um campo aparece quando a pessoa sai dele,
 * ou quando tenta enviar. Antes disso, nenhum campo mostra erro. Digitar num campo não acusa nem ele nem os
 * outros; atravessar um campo com Tab, sem digitar, conta como sair dele. Era a exceção de T-04 (44l.7), e
 * virou regra porque a anterior, a de revelar tudo depois da primeira interação, acendia *"Informe a
 * senha."* em `/entrar` na primeira tecla do e-mail. Mexer em controle que não é campo não mexe no estado
 * (a busca pelo nome do modal de atribuição filtra a lista e não é valor enviado).
 *
 * **Quando a saída conta** (`saidaConta`): não conta se o foco foi para dentro do próprio campo (a seta
 * entre as opções de um grupo) ou para a lista que ele controla por `aria-controls` (o `Select` de T-04,
 * cuja lista mora num portal); não conta se foi para um link ou para um elemento com `SAI_SEM_ACUSAR`
 * (Cancelar e o X dos modais), porque sair da tela ou fechar o modal não é alcançar o próximo campo.
 * Conta em todo o resto, inclusive quando o foco vai para o fundo da página.
 *
 * **Quem calcula os erros é quem usa o gancho**, a partir dos valores de agora: pelo estado, nos
 * componentes controlados (`erros`), ou pelo `FormData` do `<form>`, nos não controlados (`validar`).
 * Nas telas de credencial e de T-02, `validar` chama `errosDoSchema` com o mesmo schema da ação. Os não
 * controlados releem o `FormData` ao mudar e ao sair, porque sair de um campo vazio nunca mudado também
 * precisa ter o erro para mostrar.
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

export type EstadoDeInteracao = {
  readonly tentouEnviar: boolean;
  /** Os campos de onde a pessoa saiu: o erro deles aparece. */
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
  tentouEnviar: false,
  saidos: [],
  alterados: [],
};

/** O atributo que os botões de saída levam: o foco que vai para eles não acusa o campo de onde saiu. */
export const SAI_SEM_ACUSAR = "data-sai-sem-acusar";

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
      return { ...estado, alterados: comMais(estado.alterados, evento.campo) };
    case "saiu":
      if (!campos.includes(evento.campo)) return estado;
      return { ...estado, saidos: comMais(estado.saidos, evento.campo) };
    case "tentou-enviar":
      return { ...estado, tentouEnviar: true };
    case "recomecou":
      return SEM_INTERACAO;
  }
}

export function erroVisivel(
  estado: EstadoDeInteracao,
  campo: string,
  erros: ErrosDeCampo,
  errosDoServidor: ErrosDeCampo = {},
): string | undefined {
  const doCliente = erros[campo];
  const revelado = estado.tentouEnviar || estado.saidos.includes(campo);
  if (doCliente !== undefined && revelado) return doCliente;
  if (estado.alterados.includes(campo)) return undefined;
  return errosDoServidor[campo];
}

export function primeiroComProblema(campos: readonly string[], erros: ErrosDeCampo): string | null {
  return campos.find((campo) => erros[campo] !== undefined) ?? null;
}

/** Se o foco que foi de `de` para `para` conta como a pessoa sair do campo. Ver o cabeçalho. */
function saidaConta(de: Element, para: EventTarget | null): boolean {
  if (!(para instanceof Element)) return true;
  if (de.contains(para)) return false;
  const controlada = de.getAttribute("aria-controls");
  if (controlada !== null && document.getElementById(controlada)?.contains(para) === true) return false;
  return para.closest(`a[href], [${SAI_SEM_ACUSAR}]`) === null;
}

type OpcoesDoFormulario = {
  /** Nome do campo → `id` do elemento que recebe o foco, **na ordem do documento**. */
  readonly campos: Readonly<Record<string, string>>;
} & (
  | { readonly erros: ErrosDeCampo; readonly validar?: undefined }
  | { readonly validar: (dados: FormData) => ErrosDeCampo; readonly erros?: undefined }
);

export type FormularioTocado = {
  readonly erroDe: (campo: string, errosDoServidor?: ErrosDeCampo) => string | undefined;
  readonly mudou: (campo: string) => void;
  /** Para controle que já decide sozinho quando a pessoa saiu (o `SeletorDeArea`). O resto usa `aoSair`. */
  readonly saiu: (campo: string) => void;
  /** Para o `onBlur` do campo controlado, ou do `fieldset` do grupo: marca a saída quando ela conta. */
  readonly aoSair: (campo: string) => FocusEventHandler<HTMLElement>;
  /** Marca a tentativa e diz se pode enviar; se não pode, leva o foco ao primeiro problema. */
  readonly tentarEnviar: (atuais?: ErrosDeCampo) => boolean;
  readonly recomecar: () => void;
  /** Para o `onChange` do `<form>` não controlado: relê os erros e marca o campo que mudou. */
  readonly aoMudarNoFormulario: (evento: FormEvent<HTMLFormElement>) => void;
  /** Para o `onBlur` do `<form>` não controlado: relê os erros e marca o campo de onde a pessoa saiu. */
  readonly aoSairNoFormulario: (evento: FocusEvent<HTMLFormElement>) => void;
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

function ehCampoDoFormulario(
  alvo: EventTarget | null,
): alvo is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement
  );
}

export function useFormularioTocado(opcoes: OpcoesDoFormulario): FormularioTocado {
  const { campos } = opcoes;
  const nomes = Object.keys(campos);
  const [estado, setEstado] = useState<EstadoDeInteracao>(SEM_INTERACAO);
  const [errosLidos, setErrosLidos] = useState<ErrosDeCampo>({});
  const erros = opcoes.validar === undefined ? opcoes.erros : errosLidos;

  const aplicar = (evento: EventoDeInteracao) => {
    setEstado((anterior) => interagir(anterior, evento, nomes));
  };

  const tentarEnviar = (atuais: ErrosDeCampo = erros): boolean => {
    // **O estado de erro vai para o DOM antes do foco** (critério 116.6). Sem isto o React confirma o
    // estado só depois que o manipulador volta, e o foco chega a um campo que ainda não aponta para a
    // mensagem: quem não vê a tela ouve só o rótulo. `flushSync` confirma tudo o que está pendente no
    // evento, inclusive o `setErrosLidos` de `aoEnviarFormulario` e o que a tela marcou antes de chamar.
    flushSync(() => aplicar({ tipo: "tentou-enviar" }));
    const primeiro = primeiroComProblema(nomes, atuais);
    if (primeiro === null) return true;
    focar(campos[primeiro]);
    return false;
  };

  return {
    erroDe: (campo, errosDoServidor) => erroVisivel(estado, campo, erros, errosDoServidor),
    mudou: (campo) => aplicar({ tipo: "mudou", campo }),
    saiu: (campo) => aplicar({ tipo: "saiu", campo }),
    // `currentTarget`, e nunca `target`: num grupo, `target` é a opção que perdeu o foco, e a seta para a
    // opção vizinha contaria como saída.
    aoSair: (campo) => (evento) => {
      if (saidaConta(evento.currentTarget, evento.relatedTarget)) aplicar({ tipo: "saiu", campo });
    },
    tentarEnviar,
    recomecar: () => aplicar({ tipo: "recomecou" }),
    aoMudarNoFormulario: (evento) => {
      if (opcoes.validar !== undefined) setErrosLidos(opcoes.validar(new FormData(evento.currentTarget)));
      const alvo = evento.target;
      if (ehCampoDoFormulario(alvo)) aplicar({ tipo: "mudou", campo: alvo.name });
    },
    // Aqui o tratador mora no `<form>`, então o campo de onde a pessoa saiu é o `target`.
    aoSairNoFormulario: (evento) => {
      if (opcoes.validar !== undefined) setErrosLidos(opcoes.validar(new FormData(evento.currentTarget)));
      const alvo = evento.target;
      if (ehCampoDoFormulario(alvo) && saidaConta(alvo, evento.relatedTarget)) {
        aplicar({ tipo: "saiu", campo: alvo.name });
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
