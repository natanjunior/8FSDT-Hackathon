"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import { Button } from "@/interface/componentes/ui/button";

/**
 * ============================================================================
 *  A barra de ações de T-05 — e por que ela deixou de ser a única renderizadora
 * ============================================================================
 *
 * **Ela renderiza exatamente o que recebeu, e nada além.** A lista vem de `acoesDisponiveis`, derivada
 * pelo servidor a partir da máquina de estados — *"desabilitar exige a segunda cópia da máquina de
 * estados"* (`inventario-de-telas.md`), e é isso que este componente não faz.
 *
 * **`formularios` é a mudança do item 19.** `analisar` é botão nu; `atribuir-responsavel` precisa de um
 * modal, e os outros oito comandos precisam de modal, seletor ou campo. Em vez de a barra ganhar **um `if`
 * por comando** — oito ramos até o item 27 —, ela recebe, por comando, **ou o nó pronto ou nada**. Quem
 * monta o nó é a **página**, que é quem tem os candidatos e quem sabe qual ação é a primeira.
 *
 * **Nenhum tipo do Domínio entra aqui.** `comando` é `string`, o rótulo chega pronto, o nó chega pronto e
 * o mapa de status chega pronto.
 *
 * **Dois botões lado a lado, não um menu** (spec §3.9). O protótipo previu *"um primário largo e um Mais
 * ações"* porque *"quatro rótulos legíveis não cabem em 390 px"* — **com dois, cabem**. O menu nasce no
 * primeiro item em que **três** botões renderizáveis coexistirem, que é o **22**.
 *
 * **Alvo de toque ≥ 44 px** (`h-12`) e **rótulo em palavra** — A-3 e A-5.
 */
export type AcaoDisponivel = { comando: string; rotulo: string };

export function BarraDeAcoes({
  ocorrenciaId,
  acoes,
  rotulosDeStatus,
  formularios = {},
}: {
  ocorrenciaId: string;
  /** Já filtrada pelo servidor: só o que tem rótulo e forma, na ordem de `acoesDisponiveis`. */
  acoes: readonly AcaoDisponivel[];
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
  /** Para cada comando com forma própria, o nó pronto. Ausente = botão de disparo direto. */
  formularios?: Readonly<Record<string, ReactNode>>;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * **Some quando não há ação NEM aviso — e a segunda metade é o ponto.**
   *
   * Depois de um `409` a lista pode ficar vazia, e se o componente sumisse aqui o `router.refresh()`
   * desmontaria a frase *"Esta ocorrência mudou enquanto você estava olhando"* no exato caso em que ela
   * existe para ser lida. A tela mantém o componente montado (`page.tsx` o renderiza sempre) e ele decide
   * sozinho se tem algo a mostrar.
   */
  if (acoes.length === 0 && aviso === null) return null;

  async function disparar(comando: string) {
    setEnviando(true);
    setAviso(null);

    // **A tela envia `{}`** — este caminho é só dos comandos sem formulário, que é o botão nu (D23). O
    // `corpoOpcional` do servidor existe para o cliente que NÃO é esta tela.
    const resultado = await executarComando(ocorrenciaId, comando, {}, rotulosDeStatus);
    if (!resultado.ok) setAviso(resultado.aviso);
    setEnviando(false);

    /**
     * **O `refresh` roda nos DOIS desfechos, e é decisão.** No sucesso ele repinta rótulo, histórico e
     * barra a partir de **uma fonte só**. No `409` ele faz o mesmo: consumir o `acoesDisponiveis` que vem
     * no corpo do erro atualizaria os botões deixando o resto da tela com o status velho.
     *
     * **O aviso sobrevive porque o componente não é desmontado**: `page.tsx` o renderiza sempre.
     */
    router.refresh();
  }

  return (
    <>
      {/* A barra é `fixed`; sem este espaçador o *Voltar* fica embaixo dela. **Ele vem antes da barra e
          DEPOIS do resto do documento** — `page.tsx` monta este componente como último filho —, porque
          espaçador colocado acima do *Voltar* não cria folga abaixo dele. E ele aparece e some junto com a
          barra, inclusive no caso em que só há aviso. */}
      <div aria-hidden className="h-24" />
      <div className="border-linha bg-superficie fixed inset-x-0 bottom-0 z-10 border-t px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {aviso !== null && (
            <p
              role="alert"
              className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-sm"
            >
              {aviso}
            </p>
          )}
          {acoes.length > 0 && (
            <div className="flex gap-2">
              {acoes.map((acao, indice) => {
                const formulario = formularios[acao.comando];
                // **O nó já vem com a própria variante**, decidida pela página: ela é quem sabe qual ação
                // é a primeira, e é ela quem monta o gatilho.
                if (formulario !== undefined) {
                  return (
                    <div key={acao.comando} className="flex-1">
                      {formulario}
                    </div>
                  );
                }

                return (
                  <Button
                    key={acao.comando}
                    type="button"
                    variant={indice === 0 ? "default" : "outline"}
                    disabled={enviando}
                    onClick={() => void disparar(acao.comando)}
                    className="h-12 flex-1 text-base"
                  >
                    {enviando ? "Enviando…" : acao.rotulo}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
