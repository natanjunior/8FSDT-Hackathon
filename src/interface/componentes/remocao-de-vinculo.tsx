"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import {
  razaoDoImpedimento,
  textoDaConfirmacao,
  textoDaRecusa,
  type ImpedimentoNaTela,
} from "@/interface/componentes/frases-da-remocao";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **T-08 · o botão-ou-razão** — o conserto do **PA-25**, e o único `DELETE` do produto.
 *
 * **A razão substitui o botão, e não é mensagem de erro** (critério 10.4, `prototipo-low-fi.md:919`): *"a
 * tela não mostra o botão quando o vínculo não pode sair — o erro só existiria se a tela tivesse falhado
 * antes"*. Quem decide é `impedimentosDeRemocao`, lido pela página na estrada direta.
 *
 * **A confirmação é o `<dialog>` nativo, e não o `AlertDialog` do catálogo.** O `prototipo-low-fi.md:984`
 * mapeia *"confirmação de ato irreversível — aprovar papel, remover vínculo"* para `AlertDialog`, que o
 * projeto **nunca instalou**; a confirmação de **aprovar**, nesta mesma tela e igualmente irreversível, já
 * usa o `<dialog>` nativo (`decisao-de-pedido-de-entrada.tsx:250`). **Um padrão por tela**, e nenhuma
 * dependência nova na última sprint. É o achado **A-5** da spec, registrado e não consertado.
 *
 * **`organizacaoId` é o da renderização daquela aba** — a afirmação da §4.3 do contrato —, recebido por
 * propriedade e **nunca lido do cookie no clique**: a outra aba já reescreveu o cookie, e a afirmação
 * bateria consigo mesma.
 */
export function RemocaoDeVinculo({
  pessoaId,
  nome,
  temConta,
  impedimento,
  organizacaoId,
  ehMeuProprioVinculo,
}: {
  pessoaId: string;
  nome: string;
  temConta: boolean;
  /** `null` é *pode sair* — a ausência no mapa de `impedimentosDeRemocao`. */
  impedimento: ImpedimentoNaTela | null;
  organizacaoId: string;
  ehMeuProprioVinculo: boolean;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const confirmacao = useRef<HTMLDialogElement>(null);

  if (impedimento !== null) {
    const razao = razaoDoImpedimento(nome, impedimento);
    return (
      <p className="text-tinta-suave max-w-xs text-xs leading-relaxed">
        {razao.titulo}
        {razao.complemento !== null && <span className="mt-1 block">{razao.complemento}</span>}
      </p>
    );
  }

  async function remover() {
    setEnviando(true);
    setRecusa(null);

    let removido = false;
    try {
      const resposta = await fetch(`/api/vinculos/${pessoaId}`, {
        method: "DELETE",
        headers: cabecalhosDeEscrita(organizacaoId),
      });

      if (resposta.ok) {
        removido = true;
      } else {
        const problema = (await resposta.json().catch(() => ({}))) as { codigo?: string };
        setRecusa(textoDaRecusa(problema.codigo, nome));
      }
    } catch {
      // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição sobe pela
      // transição e aciona o Error Boundary em vez de mostrar a linha de recusa. Nuvem sem SLA: rede
      // instável é o caso esperado.
      setRecusa(textoDaRecusa(undefined, nome));
    } finally {
      setEnviando(false);
    }

    if (removido) {
      confirmacao.current?.close();
      // A faixa é da página, e vem da URL: o que aconteceu tem de sobreviver ao recarregamento, ou a ação
      // irreversível é comunicada por ausência — que é o que a tela do PA-25 existe para não fazer.
      router.replace(`/vinculos?removido=${encodeURIComponent(nome)}`);
      router.refresh();
    }
  }

  const linhas = textoDaConfirmacao({ nome, temConta, ehMeuProprioVinculo });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={enviando}
        onClick={() => confirmacao.current?.showModal()}
        className="border-linha text-tinta inline-flex min-h-11 w-fit items-center rounded-md border px-3 text-sm"
      >
        Remover
        <span className="sr-only"> o vínculo de {nome}</span>
      </button>

      {recusa !== null && (
        <p
          role="alert"
          className="border-marca/40 bg-accent text-tinta rounded-md border px-3 py-2 text-xs"
        >
          {recusa}{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="text-marca underline underline-offset-4"
          >
            Atualizar a lista
          </button>
        </p>
      )}

      <dialog
        ref={confirmacao}
        className="bg-superficie text-tinta m-auto max-w-md rounded-md p-6 backdrop:bg-black/40"
      >
        <h4 className="text-tinta text-base font-semibold">Remover o vínculo de {nome}?</h4>
        {linhas.map((linha) => (
          <p key={linha} className="text-tinta-suave mt-3 text-sm leading-relaxed">
            {linha}
          </p>
        ))}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => confirmacao.current?.close()}
            className="border-linha h-11 rounded-md border px-5 text-sm"
          >
            Voltar
          </button>
          <Button type="button" disabled={enviando} onClick={remover} className="h-11">
            {enviando ? "Removendo…" : "Remover vínculo"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
