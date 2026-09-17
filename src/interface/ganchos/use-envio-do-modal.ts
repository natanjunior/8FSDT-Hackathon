"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useState } from "react";

import {
  avisarConclusao,
  avisarErro,
  MENSAGEM_GENERICA,
  type AvisoDeConclusao,
} from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  O envio de um modal — a sequência do guia §7, escrita uma vez
 * ============================================================================
 *
 * | Momento | O que acontece |
 * |---|---|
 * | Enviando | o botão mostra o indicador; campos e botão secundário ficam inertes; o modal **não fecha** |
 * | Sucesso | sai o aviso de sucesso, o modal fecha e a página se atualiza |
 * | Erro | sai o aviso de erro, a mensagem fica dentro do modal, e o modal continua aberto |
 * | Fechar depois de um erro | atualiza a página, que é o que faz o `409` mostrar as ações novas |
 * | Reabrir | começa limpo: `aoAbrir` devolve os campos ao começo |
 *
 * **Por que existe agora.** O ciclo `aberto · enviando · aviso · precisaRepintar` estava copiado nos cinco
 * modais de T-05, e a extração foi adiada porque não haveria sexto modal (spec do item 27, A-3). O 44i, o
 * 44j e o 44k trazem pelo menos oito. **A decisão mora em `cicloDoModal`, que é pura e tem teste**; o
 * gancho só aplica os efeitos.
 *
 * **O gancho não conhece `executarComando`**: recebe a função que envia, porque o 44j chama
 * `/pedidos-de-entrada/{id}/aprovar` e o 44k chama `PATCH /areas`.
 *
 * **`deu-certo` e `falhou` não dependem do estado anterior**, e é isso que permite aplicá-los depois do
 * `await` com o estado capturado no clique.
 */

export type EstadoDoModal = {
  readonly aberto: boolean;
  readonly enviando: boolean;
  readonly aviso: string | null;
  /** Houve escrita que falhou com o modal aberto: fechar tem de atualizar a página. */
  readonly precisaAtualizar: boolean;
};

export const MODAL_FECHADO: EstadoDoModal = {
  aberto: false,
  enviando: false,
  aviso: null,
  precisaAtualizar: false,
};

export type EventoDoModal =
  | { readonly tipo: "abriu" }
  | { readonly tipo: "pediu-fechar" }
  | { readonly tipo: "enviou" }
  | { readonly tipo: "deu-certo" }
  | { readonly tipo: "falhou"; readonly aviso: string };

export type EfeitoDoModal = "limpar-campos" | "avisar-sucesso" | "avisar-falha" | "atualizar-pagina";

type Passo = { readonly estado: EstadoDoModal; readonly efeitos: readonly EfeitoDoModal[] };

export function cicloDoModal(estado: EstadoDoModal, evento: EventoDoModal): Passo {
  switch (evento.tipo) {
    case "abriu":
      return {
        estado: { aberto: true, enviando: false, aviso: null, precisaAtualizar: false },
        efeitos: ["limpar-campos"],
      };
    case "pediu-fechar":
      if (estado.enviando) return { estado, efeitos: [] };
      return { estado: MODAL_FECHADO, efeitos: estado.precisaAtualizar ? ["atualizar-pagina"] : [] };
    case "enviou":
      if (estado.enviando) return { estado, efeitos: [] };
      return { estado: { ...estado, enviando: true, aviso: null }, efeitos: [] };
    case "deu-certo":
      return { estado: MODAL_FECHADO, efeitos: ["avisar-sucesso", "atualizar-pagina"] };
    case "falhou":
      return {
        estado: { aberto: true, enviando: false, aviso: evento.aviso, precisaAtualizar: true },
        efeitos: ["avisar-falha"],
      };
  }
}

export type DesfechoDoEnvio<T> =
  | { readonly ok: true; readonly valor?: T }
  | { readonly ok: false; readonly aviso: string };

export type EnvioDoModal = {
  readonly aberto: boolean;
  readonly enviando: boolean;
  readonly aviso: string | null;
  readonly mudarAbertura: (proximo: boolean) => void;
  readonly confirmar: () => Promise<void>;
};

export function useEnvioDoModal<T = undefined>(opcoes: {
  readonly enviar: () => Promise<DesfechoDoEnvio<T>>;
  readonly aoConcluir: (valor: T | undefined) => AvisoDeConclusao;
  readonly tituloDaFalha: string;
  readonly aoAbrir?: () => void;
}): EnvioDoModal {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDoModal>(MODAL_FECHADO);

  const executar = (efeitos: readonly EfeitoDoModal[], valor?: T) => {
    for (const efeito of efeitos) {
      if (efeito === "limpar-campos") opcoes.aoAbrir?.();
      if (efeito === "avisar-sucesso") avisarConclusao(opcoes.aoConcluir(valor));
      if (efeito === "avisar-falha") avisarErro(opcoes.tituloDaFalha);
      if (efeito === "atualizar-pagina") router.refresh();
    }
  };

  const aplicar = (de: EstadoDoModal, evento: EventoDoModal, valor?: T) => {
    const passo = cicloDoModal(de, evento);
    setEstado(passo.estado);
    executar(passo.efeitos, valor);
  };

  return {
    aberto: estado.aberto,
    enviando: estado.enviando,
    aviso: estado.aviso,
    mudarAbertura: (proximo) => aplicar(estado, proximo ? { tipo: "abriu" } : { tipo: "pediu-fechar" }),
    confirmar: async () => {
      if (estado.enviando) return;
      const emEnvio = cicloDoModal(estado, { tipo: "enviou" }).estado;
      setEstado(emEnvio);

      let desfecho: DesfechoDoEnvio<T>;
      try {
        desfecho = await opcoes.enviar();
      } catch (erro) {
        // Quem envia devolve o desfecho e não lança; se lançar, o modal não pode ficar travado em
        // "enviando". O erro de controle do Next continua subindo.
        unstable_rethrow(erro);
        desfecho = { ok: false, aviso: MENSAGEM_GENERICA };
      }

      if (desfecho.ok) aplicar(emEnvio, { tipo: "deu-certo" }, desfecho.valor);
      else aplicar(emEnvio, { tipo: "falhou", aviso: desfecho.aviso });
    },
  };
}
