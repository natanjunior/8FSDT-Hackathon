"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/interface/componentes/ui/button";

/**
 * ============================================================================
 *  A barra de ações de T-05 — a primeira do produto
 * ============================================================================
 *
 * **Ela renderiza exatamente o que recebeu, e nada além.** A lista vem de `acoesDisponiveis`, derivada
 * pelo servidor a partir da máquina de estados — *"desabilitar exige a segunda cópia da máquina de
 * estados"* (`inventario-de-telas.md`), e é isso que este componente não faz.
 *
 * **Nenhum tipo do Domínio entra aqui.** `comando` é `string` e o rótulo chega pronto: importar
 * `rotuloDeComando` arrastaria a máquina de estados para dentro do pacote do navegador.
 *
 * **Fixa no rodapé, com um primário largo** (protótipo D-3, decisão 2): *"mantém o primário na zona onde
 * o polegar chega com uma mão só"*. **Não há menu "Mais ações"** — com um comando renderizável ele seria
 * inalcançável, e nasce no item em que um segundo botão passar a caber na mesma tela.
 *
 * **Alvo de toque ≥ 44 px** (`h-12`) e **rótulo em palavra** — A-3 e A-5.
 */
export type AcaoDisponivel = { comando: string; rotulo: string };

/** O que a tela mostra quando o comando é recusado por estado — a resposta mais completa que o
 *  inventário dá a um erro (`inventario-de-telas.md`). */
const MENSAGEM_GENERICA = "Não foi possível executar agora. Tente de novo.";

export function BarraDeAcoes({
  ocorrenciaId,
  acoes,
  rotulosDeStatus,
}: {
  ocorrenciaId: string;
  /** Já filtrada pelo servidor: só o que tem rótulo, na ordem de `acoesDisponiveis`. */
  acoes: readonly AcaoDisponivel[];
  /** O mapa pronto, para a frase do `409`. O navegador não monta rótulo. */
  rotulosDeStatus: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const primario = acoes[0];
  /**
   * **Some quando não há botão NEM aviso — e a segunda metade é o ponto.**
   *
   * Depois de um `409` a lista fica vazia (o outro Gestor já analisou), e se o componente sumisse aqui
   * o `router.refresh()` desmontaria a frase *"Esta ocorrência mudou enquanto você estava olhando"* no
   * exato caso em que ela existe para ser lida. **Nesta fatia isso seria 100% dos `409`**, porque
   * `analisar` é o único comando renderizável. A tela mantém o componente montado (`page.tsx` o renderiza
   * sempre) e ele decide sozinho se tem algo a mostrar.
   */
  if (primario === undefined && aviso === null) return null;

  async function executar(comando: string) {
    setEnviando(true);
    setAviso(null);

    try {
      const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/${comando}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // **A tela envia `{}` de qualquer forma** — `analisar` é botão nu, sem formulário (D23). O
        // `corpoOpcional` do servidor existe para o cliente que NÃO é esta tela.
        body: "{}",
      });

      if (!resposta.ok) {
        const problema = (await resposta.json().catch(() => ({}))) as {
          codigo?: string;
          statusAtual?: string;
          detail?: string;
        };

        if (problema.codigo === "TRANSICAO_NAO_PERMITIDA" && problema.statusAtual !== undefined) {
          // A frase do inventário, montada com o `statusAtual` que o contrato pôs no corpo do erro
          // exatamente para isto. **É o caso das duas pessoas triando ao mesmo tempo.**
          const rotulo = rotulosDeStatus[problema.statusAtual] ?? problema.statusAtual;
          setAviso(`Esta ocorrência mudou enquanto você estava olhando: agora ela está ${rotulo}.`);
        } else {
          setAviso(problema.detail ?? MENSAGEM_GENERICA);
        }
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição aciona o Error
      // Boundary em vez de mostrar a linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
      setAviso(MENSAGEM_GENERICA);
    } finally {
      setEnviando(false);
    }

    /**
     * **O `refresh` roda nos DOIS desfechos, e é decisão.** No sucesso ele repinta rótulo, histórico e
     * barra a partir de **uma fonte só**. No `409` ele faz o mesmo: consumir o `acoesDisponiveis` que
     * vem no corpo do erro atualizaria os botões deixando o resto da tela com o status velho — pior que
     * o que o inventário quis evitar. **O resultado observável é o que ele encomendou**; o mecanismo é
     * outro, e está declarado na §3.9 da spec.
     *
     * **O aviso sobrevive porque o componente não é desmontado**: `page.tsx` o renderiza sempre, e ele
     * mesmo decide o que mostrar. Se a tela o montasse só quando `acoes` não está vazia, o `refresh` do
     * `409` trocaria o ramo do JSX, o componente perderia o `useState` e a frase sumiria junto com a
     * barra — que é exatamente o caso para o qual ela existe.
     */
    router.refresh();
  }

  return (
    <>
      {/* A barra é `fixed`; sem este espaçador o *Voltar* fica embaixo dela. **Ele vem antes da barra e
          DEPOIS do resto do documento** — `page.tsx` monta este componente como último filho —, porque
          espaçador colocado acima do *Voltar* não cria folga abaixo dele: no fim da rolagem o último
          elemento do fluxo continua sendo o que a barra cobre. E ele aparece e some junto com a barra,
          inclusive no caso em que só há aviso. */}
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
          {primario !== undefined && (
            <Button
              type="button"
              disabled={enviando}
              onClick={() => void executar(primario.comando)}
              className="h-12 w-full text-base"
            >
              {enviando ? "Enviando…" : primario.rotulo}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
